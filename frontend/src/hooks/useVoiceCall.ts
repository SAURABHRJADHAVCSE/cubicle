"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type {
  CallAnswerEvent,
  CallEndedEvent,
  CallErrorEvent,
  CallIceCandidateEvent,
  CallStatusEvent,
  CallTranscriptEvent,
} from "@/types/events";

export type CallState = "idle" | "connecting" | "ringing" | "connected" | "ended" | "error";

interface Transcript {
  role: "user" | "agent";
  text: string;
}

/** Drives one WebRTC voice call to an agent — mic capture, signaling over
 * the existing Socket.io connection, and playback of the agent's replies.
 * See backend/app/ws/calls.py for the server side of this protocol. */
export function useVoiceCall(agentId: string | null) {
  const [state, setState] = useState<CallState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    callIdRef.current = null;
    pendingCandidatesRef.current = [];
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  }, []);

  const hangUp = useCallback(() => {
    if (callIdRef.current) {
      getSocket().emit("call:hangup", { call_id: callIdRef.current });
    }
    cleanup();
    setState("ended");
  }, [cleanup]);

  const startCall = useCallback(async () => {
    if (!agentId) return;
    setState("connecting");
    setStatusMessage(null);
    setTranscripts([]);

    try {
      const [config, mic] = await Promise.all([
        api.calls.config(),
        navigator.mediaDevices.getUserMedia({ audio: true }),
      ]);
      micStreamRef.current = mic;

      const pc = new RTCPeerConnection({ iceServers: config.ice_servers });
      pcRef.current = pc;
      mic.getTracks().forEach((track) => pc.addTrack(track, mic));

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
      };
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const candidate = event.candidate.toJSON();
        if (callIdRef.current) {
          getSocket().emit("call:ice_candidate", { call_id: callIdRef.current, candidate });
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setState("ringing");
      getSocket().emit("call:offer", { agent_id: agentId, sdp: pc.localDescription!.sdp });
    } catch {
      cleanup();
      setState("error");
      setStatusMessage("Couldn't access the microphone or reach the call server.");
    }
  }, [agentId, cleanup]);

  useEffect(() => {
    const socket = getSocket();

    const onAnswer = async (payload: CallAnswerEvent) => {
      const pc = pcRef.current;
      if (!pc) return;
      callIdRef.current = payload.call_id;
      await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      pendingCandidatesRef.current.forEach((candidate) =>
        socket.emit("call:ice_candidate", { call_id: payload.call_id, candidate }),
      );
      pendingCandidatesRef.current = [];
    };

    const onIceCandidate = (payload: CallIceCandidateEvent) => {
      if (payload.call_id !== callIdRef.current) return;
      pcRef.current?.addIceCandidate(payload.candidate).catch(() => {});
    };

    const onStatus = (payload: CallStatusEvent) => {
      if (payload.call_id !== callIdRef.current) return;
      // "connected" is a state transition (already shown via the header's
      // state pill), not an informational message — don't let it clobber a
      // more useful one, e.g. "voice provider not configured", which can
      // otherwise arrive moments before this and disappear unread.
      if (payload.message === "connected") {
        setState("connected");
      } else {
        setStatusMessage(payload.message);
      }
    };

    const onTranscript = (payload: CallTranscriptEvent) => {
      if (payload.call_id !== callIdRef.current) return;
      setTranscripts((prev) => [...prev, { role: payload.role, text: payload.text }]);
    };

    const onEnded = (payload: CallEndedEvent) => {
      if (payload.call_id !== callIdRef.current) return;
      cleanup();
      setState("ended");
    };

    const onError = (payload: CallErrorEvent) => {
      if (payload.call_id !== null && payload.call_id !== callIdRef.current) return;
      cleanup();
      setState("error");
      setStatusMessage(payload.message);
    };

    socket.on("call:answer", onAnswer);
    socket.on("call:ice_candidate", onIceCandidate);
    socket.on("call:status", onStatus);
    socket.on("call:transcript", onTranscript);
    socket.on("call:ended", onEnded);
    socket.on("call:error", onError);
    return () => {
      socket.off("call:answer", onAnswer);
      socket.off("call:ice_candidate", onIceCandidate);
      socket.off("call:status", onStatus);
      socket.off("call:transcript", onTranscript);
      socket.off("call:ended", onEnded);
      socket.off("call:error", onError);
    };
  }, [cleanup]);

  // Belt-and-suspenders: end the call if the component unmounts mid-call
  // (e.g. the user navigates away) rather than leaking mic access.
  useEffect(() => () => cleanup(), [cleanup]);

  return { state, statusMessage, transcripts, remoteAudioRef, startCall, hangUp };
}
