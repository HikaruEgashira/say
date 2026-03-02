# say

A CLI that replaces the system `say` command using [ElevenLabs](https://elevenlabs.io) V3 Text-to-Speech.

## Install

```bash
mise use github:HikaruEgashira/say
```

```claude
setup following instruction https://raw.githubusercontent.com/HikaruEgashira/say/refs/heads/main/.claude/commands/say-setup.md
```

## Configuration

Set the following environment variables (e.g. in `.env`):

| Variable | Required | Description |
|---|---|---|
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | — | Voice ID (default: `JBFqnCBsd6RMkjVDRZzb`) |
| `ELEVENLABS_SPEED` | — | Speech speed multiplier (default: `1.3`) |

## Usage

```bash
say "Hello, world!"
```

## License

MIT
