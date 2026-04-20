# say

A CLI that replaces the system `say` command using [ElevenLabs](https://elevenlabs.io) V3 Text-to-Speech.

demo: https://screen.studio/share/sl41XjhC?state=uploading

## Install

```bash
mise use github:HikaruEgashira/say
```

```claude
setup following instruction https://raw.githubusercontent.com/HikaruEgashira/say/refs/heads/main/.claude/commands/say-setup.md
```

## Configuration

Store your ElevenLabs API key in the macOS Keychain:

```bash
security add-generic-password -a "$USER" -s "elevenlabs-api-key" -W
```

Optional environment variables:

| Variable | Description |
|---|---|
| `ELEVENLABS_VOICE_ID` | Voice ID (default: `JBFqnCBsd6RMkjVDRZzb`) |
| `ELEVENLABS_SPEED` | Speech speed multiplier (default: `1.3`) |
| `SAY_MAX_CHARS` | Max characters sent to TTS (default: `200`) |
| `SAY_MAX_SECONDS` | Max playback duration in seconds (default: `30`) |

## Usage

```bash
say "Hello, world!"
```

## License

MIT
