# say-hook — Herdr plugin

A [Herdr](https://herdr.dev/) plugin that speaks the agent's opening excerpt
aloud via the [`say-hook`](../README.md) CLI when an agent reaches `done` or
`blocked`. It is the voice counterpart to a push notification: with several
agent panes running in parallel, you hear which one just finished or got stuck
without watching every pane.

The standard selection matches `say-hook hook`: normalize whitespace, stop at
the first `.`, `,`, or `。` (including it), and cap output at 200 characters.
Sources, in order:

1. **Pane title** — with the Claude hook installed (see below), a Claude Code
   Stop hook reports the same excerpt as the herdr pane title.
2. **Screen scrape** — for panes with no title, the pane is read and the last
   ⏺-anchored message head is spoken after stripping terminal escape
   sequences and chrome. This is best-effort: a long message can scroll its
   head out of the window, leaving only a tail fragment.

There is no canned phrasing — `say-hook` renders whatever the agent emitted.

## Requirements

- macOS
- Herdr >= 0.7.0
- [`say-hook`](../README.md) on PATH (`mise use github:HikaruEgashira/say-hook`)
- `sh`, `jq`, `perl`, `awk`

## Install

```sh
herdr plugin install HikaruEgashira/say-hook/herdr
```

For Claude Code panes, also install the Stop hook so speech uses the final
message excerpt instead of screen scraping:

```sh
herdr plugin action invoke install-claude-hook
```

This copies `claude-stop-title.sh` to `~/.claude/hooks/herdr-say-hook-title.sh`
and registers it under `hooks.Stop` in `~/.claude/settings.json` (idempotent).

No `.env` is required — the defaults (`say-hook` on PATH, trigger on `done`/`blocked`)
work out of the box. Override only if needed:

```sh
config_dir="$(herdr plugin config-dir hikaruegashira.say-hook)"
cp .env.example "$config_dir/.env"
$EDITOR "$config_dir/.env"
```

| Variable | Description | Default |
|---|---|---|
| `SAY_BIN` | Path to the `say-hook` binary | `say-hook` |
| `SAY_STATUSES` | Statuses that trigger speech (space-separated) | `done blocked` |
| `SAY_LINES` | Recent pane lines scanned by the screen-scrape fallback | `40` |

## dry-run

Checks configuration and prints a sample line. Nothing is spoken.

```sh
herdr plugin action invoke dry-run
herdr plugin log list --plugin hikaruegashira.say-hook --limit 1 | jq -r '.result.logs[-1].stdout'
```

## test

Speaks a real test line through `say-hook`.

```sh
herdr plugin action invoke test
```

## Local development

```sh
herdr plugin link .
```

During local development, `./.env` is also read as a fallback.

## License

[MIT](../README.md)
