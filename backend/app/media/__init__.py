"""AI-generated media: provider interface (base.py), concrete providers
(gemini_image.py), and provider selection (registry.py) — mirrors voice/'s
own STT/TTS provider pattern. See app/utils/media_storage.py for saving a
generated file into an agent's workspace and app/utils/agent_tools.py for
how a provider becomes a model-callable tool.
"""
