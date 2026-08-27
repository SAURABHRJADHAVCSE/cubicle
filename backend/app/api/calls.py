"""Voice-call config: ICE servers the frontend's RTCPeerConnection needs,
and whether STT/TTS is configured (so the UI can set expectations before
the call even starts — see app/ws/calls.py for the actual signaling)."""

from fastapi import APIRouter

from app.schemas.call import CallConfigResponse
from app.voice.registry import get_stt_provider, get_tts_provider
from app.ws.calls import build_ice_server_list

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("/config", response_model=CallConfigResponse)
async def call_config() -> CallConfigResponse:
    return CallConfigResponse(
        ice_servers=build_ice_server_list(),
        voice_configured=get_stt_provider().is_configured() and get_tts_provider().is_configured(),
    )
