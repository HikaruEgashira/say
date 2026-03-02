# say

A CLI that replaces the system `say` command using [ElevenLabs](https://elevenlabs.io) V3 Text-to-Speech.

## Install

```bash
mise use github:HikaruEgashira/say
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

## Use with Claude Code

Add the following to your `CLAUDE.md` to get audio notifications when Claude finishes a task:

```markdown
- On task completion, run `say` to announce what was done in one sentence.
```

## License

MIT
