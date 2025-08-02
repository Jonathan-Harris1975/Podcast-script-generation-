

## New endpoint: POST /compose/ready-for-tts

Merges intro + main (+chunks) + outro to a single SSML block, and returns:
- `transcript.plain` — human-readable text (no SSML)
- `transcript.ssml` — final SSML for TTS
- `tts_maker.body` — payload you can send directly to **tts-chunker-service** `/tts/chunked`
