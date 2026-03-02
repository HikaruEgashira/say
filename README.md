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

## ElevenLabs v3 Audio Tags

The `eleven_v3` model supports **Audio Tags** — words in square brackets that control emotion and delivery:

| Category | Tags |
|---|---|
| Emotion | `[excited]`, `[calm]`, `[frustrated]`, `[relieved]`, `[nervous]`, `[sorrowful]` |
| Reactions | `[sighs]`, `[laughs]`, `[gasps]`, `[whispers]`, `[gulps]` |
| Delivery | `[pause]`, `[short pause]`, `[long pause]`, `[rushed]`, `[hesitates]` |

> **Note:** `eleven_v3` does NOT support SSML `<break>` tags. Use `[pause]` instead.

```bash
say "[excited] The build succeeded!"
say "[sighs] An error occurred, please check the logs"
say "[pause] Processing complete [pause] Ready for next step"
```

## Claude Code Slash Command

A `/say-setup` slash command is included. Clone this repo and Claude Code will pick it up automatically from `.claude/commands/`.

```
/say-setup
```

The wizard will:
1. Install `say` via `mise`
2. Configure `ELEVENLABS_API_KEY`
3. Ask personalization questions (language, tone, detail level)
4. Generate and write a tailored instruction to `~/.claude/CLAUDE.md`
5. Run a test notification

## Use with Claude Code

Add the following to your `CLAUDE.md` to get expressive audio notifications when Claude finishes a task:

```markdown
- On task completion, run `say` with ElevenLabs v3 Audio Tags for expressive delivery.
  - Success: `say "[excited] Task completed successfully"`
  - Failure: `say "[sighs] An error occurred, please check the output"`
  - Long pause: `say "[pause] Done [pause] Ready for review"`
```

## License

MIT
