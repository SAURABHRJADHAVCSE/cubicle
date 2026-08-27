"""WebRTC voice-call signaling over the existing Socket.io connection.

Session state is a plain in-memory dict, one `aiortc.RTCPeerConnection`
per call — deliberately not a DB table or a Celery task: a live
bidirectional media stream doesn't fit either model, and losing calls on
an API restart is an acceptable trade for a single-replica self-hosted app.
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Literal

import structlog
from aiortc import RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription
from aiortc.sdp import candidate_from_sdp

from app.config import get_settings
from app.database import async_session_factory
from app.models.agent import Agent
from app.voice.audio import AudioQueueTrack
from app.voice.pipeline import CallAudioPipeline
from app.ws.manager import sio

logger = structlog.get_logger()


def build_ice_server_list() -> list[dict]:
    """Also consumed by GET /calls/config (app/api/calls.py) so the
    frontend's RTCPeerConnection uses the exact same server list as the
    backend's — one source of truth, not two copies to keep in sync."""
    settings = get_settings()
    servers = [{"urls": [settings.stun_url]}]
    if settings.turn_url:
        servers.append(
            {
                "urls": [settings.turn_url],
                "username": settings.turn_username,
                "credential": settings.turn_credential,
            }
        )
    return servers


def _build_rtc_configuration() -> RTCConfiguration:
    return RTCConfiguration(
        iceServers=[
            RTCIceServer(urls=s["urls"], username=s.get("username"), credential=s.get("credential"))
            for s in build_ice_server_list()
        ]
    )


@dataclass
class CallSession:
    call_id: str
    agent_id: str
    sid: str
    pc: RTCPeerConnection
    outgoing_track: AudioQueueTrack
    agent: Agent
    state: Literal["connecting", "connected", "ended"] = "connecting"
    pipeline_task: object | None = field(default=None, repr=False)
    # The mic track can arrive (via aiortc's "track" event) before the
    # browser has even received call:answer and learned its own call_id —
    # starting the pipeline immediately would emit call:status/transcript
    # messages the frontend can't match to anything yet and silently drops.
    # These two flags gate the actual pipeline start on *both* the track
    # having arrived *and* the answer having been sent, in whichever order
    # they happen to race in.
    answer_sent: bool = False
    incoming_track: object | None = field(default=None, repr=False)


_active_calls: dict[str, CallSession] = {}


async def _emit_status(call_id: str, sid: str, message: str) -> None:
    await sio.emit("call:status", {"call_id": call_id, "message": message}, room=sid)


async def _emit_transcript(call_id: str, sid: str, role: str, text: str) -> None:
    await sio.emit("call:transcript", {"call_id": call_id, "role": role, "text": text}, room=sid)


async def _cleanup(call_id: str, reason: str) -> None:
    session = _active_calls.pop(call_id, None)
    if session is None:
        return
    session.state = "ended"
    if session.pipeline_task is not None:
        session.pipeline_task.cancel()
    await session.pc.close()
    await sio.emit("call:ended", {"call_id": call_id, "reason": reason}, room=session.sid)


@sio.on("call:offer")
async def call_offer(sid: str, data: dict) -> None:
    agent_id = data.get("agent_id")
    sdp = data.get("sdp")
    if not agent_id or not sdp:
        await sio.emit("call:error", {"call_id": None, "message": "Missing agent_id or sdp"}, room=sid)
        return

    async with async_session_factory() as db:
        agent = await db.get(Agent, uuid.UUID(agent_id))

    if agent is None:
        await sio.emit("call:error", {"call_id": None, "message": "Agent not found"}, room=sid)
        return
    if agent.engine_type != "api":
        await sio.emit(
            "call:error",
            {"call_id": None, "message": "Voice calls need an API-based agent, not a CLI subprocess one."},
            room=sid,
        )
        return

    call_id = uuid.uuid4().hex
    pc = RTCPeerConnection(configuration=_build_rtc_configuration())
    outgoing = AudioQueueTrack()
    pc.addTrack(outgoing)

    session = CallSession(
        call_id=call_id, agent_id=agent_id, sid=sid, pc=pc, outgoing_track=outgoing, agent=agent
    )
    _active_calls[call_id] = session

    def _maybe_start_pipeline() -> None:
        if not (session.answer_sent and session.incoming_track is not None):
            return
        pipeline = CallAudioPipeline(
            agent=session.agent,
            outgoing=outgoing,
            emit_status=lambda msg: _emit_status(call_id, sid, msg),
            emit_transcript=lambda role, text: _emit_transcript(call_id, sid, role, text),
        )
        session.pipeline_task = asyncio.create_task(pipeline.start(session.incoming_track))

    @pc.on("track")
    def on_track(track):
        logger.info("voice_call_track_received", call_id=call_id, kind=track.kind)
        if track.kind != "audio":
            return
        session.incoming_track = track
        _maybe_start_pipeline()

    @pc.on("connectionstatechange")
    async def on_state_change():
        if pc.connectionState == "connected":
            session.state = "connected"
            await sio.emit("call:status", {"call_id": call_id, "message": "connected"}, room=sid)
        elif pc.connectionState in ("failed", "closed"):
            await _cleanup(call_id, "error" if pc.connectionState == "failed" else "hangup")

    # No server->browser candidate trickling: aiortc has no "icecandidate"
    # event (confirmed against its source — it only emits
    # iceconnectionstatechange/icegatheringstatechange). It gathers ICE
    # candidates internally and embeds them directly in the SDP returned
    # by setLocalDescription below, so the answer alone is sufficient.

    await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp, type="offer"))
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await sio.emit(
        "call:answer", {"call_id": call_id, "sdp": pc.localDescription.sdp}, room=sid
    )
    session.answer_sent = True
    _maybe_start_pipeline()
    logger.info("voice_call_started", call_id=call_id, agent_id=agent_id)


@sio.on("call:ice_candidate")
async def call_ice_candidate(sid: str, data: dict) -> None:
    session = _active_calls.get(data.get("call_id", ""))
    if session is None or session.sid != sid:
        return
    candidate_init = data.get("candidate")
    if not candidate_init or not candidate_init.get("candidate"):
        return
    # The browser sends an RTCIceCandidateInit (`{candidate: "candidate:...
    # sdp string...", sdpMid, sdpMLineIndex}`) — aiortc's addIceCandidate
    # wants a structured RTCIceCandidate instead, built via candidate_from_sdp
    # from the sdp-line portion (without the leading "candidate:" token).
    sdp_line = candidate_init["candidate"].removeprefix("candidate:")
    candidate = candidate_from_sdp(sdp_line)
    candidate.sdpMid = candidate_init.get("sdpMid")
    candidate.sdpMLineIndex = candidate_init.get("sdpMLineIndex")
    await session.pc.addIceCandidate(candidate)


@sio.on("call:hangup")
async def call_hangup(sid: str, data: dict) -> None:
    call_id = data.get("call_id", "")
    session = _active_calls.get(call_id)
    if session is not None and session.sid == sid:
        await _cleanup(call_id, "hangup")


async def handle_disconnect(sid: str) -> None:
    """Called from manager.py's `disconnect` handler — ends any call this
    socket was party to (a single-user app has at most 1-2 concurrent
    calls, so a linear scan needs no indexing)."""
    for call_id, session in list(_active_calls.items()):
        if session.sid == sid:
            await _cleanup(call_id, "disconnected")
