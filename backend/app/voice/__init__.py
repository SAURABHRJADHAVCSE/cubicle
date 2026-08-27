"""Voice-call audio pipeline: transport plumbing (audio.py), STT/TTS
provider interfaces (stt.py/tts.py), provider selection (registry.py), and
turn-taking orchestration (pipeline.py). See app/ws/calls.py for the
WebRTC signaling that owns a CallAudioPipeline per call.
"""
