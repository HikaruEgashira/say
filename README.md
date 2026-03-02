# say

A CLI tool that replaces the system `say` command using [ElevenLabs](https://elevenlabs.io) V3 Text-to-Speech — producing natural, high-quality voice output.

## Requirements

- [Bun](https://bun.sh) v1.x
- An [ElevenLabs](https://elevenlabs.io) API key
- macOS (uses `afplay` for playback) or Linux with `mpg123`

## Installation

```bash
git clone https://github.com/HikaruEgashira/say.git
cd say
bun install
```

Create a `.env` file:

```env
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here   # optional, defaults to George
ELEVENLABS_SPEED=1.3                     # optional, default 1.3 (1.0 = normal)
```

Add the script to a directory that appears before `/usr/bin` in your `PATH` so it shadows the built-in `say` command.

## Usage

```bash
say "Hello, world!"
say "Task completed"
```

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | — | Voice ID (default: `JBFqnCBsd6RMkjVDRZzb`) |
| `ELEVENLABS_SPEED` | — | Speech speed multiplier (default: `1.3`) |

## Use with Claude Code

You can instruct Claude Code to announce task completion using this command. Add the following to your `CLAUDE.md`:

```markdown
- On task completion, run the `say` command to announce what was done in one sentence.
  (e.g. `say "Fixed the authentication bug and all tests pass"`)
```

This gives you audio feedback when Claude finishes long-running tasks without you needing to watch the terminal.

## License

MIT
