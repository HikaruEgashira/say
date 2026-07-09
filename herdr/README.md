# say — Herdr plugin

A [Herdr](https://herdr.dev/) plugin that speaks the agent's first output line
aloud via the [`say`](../README.md) CLI when an agent reaches `done` or
`blocked`. It is the voice counterpart to a push notification: with several
agent panes running in parallel, you hear which one just finished or got stuck
without watching every pane.

The standard line selection matches `say hook`: choose the first non-empty
line from agent output. Herdr uses the agent's one-line OSC title when present;
if no title is available, it reads the pane and speaks the first non-empty
content line after stripping terminal escape sequences and chrome. There is no
canned phrasing — `say` renders whatever the agent emitted.

## Requirements

- macOS
- Herdr >= 0.7.0
- [`say`](../README.md) on PATH (`mise use github:HikaruEgashira/say`)
- `sh`, `jq`, `perl`, `awk`

## Install

```sh
herdr plugin install HikaruEgashira/say/herdr
```

No `.env` is required — the defaults (`say` on PATH, trigger on `done`/`blocked`)
work out of the box. Override only if needed:

```sh
config_dir="$(herdr plugin config-dir hikaruegashira.say)"
cp .env.example "$config_dir/.env"
$EDITOR "$config_dir/.env"
```

| Variable | Description | Default |
|---|---|---|
| `SAY_BIN` | Path to the `say` binary | `say` |
| `SAY_STATUSES` | Statuses that trigger speech (space-separated) | `done blocked` |
| `SAY_LINES` | Recent pane lines scanned for the first non-empty content line | `12` |

## dry-run

Checks configuration and prints a sample line. Nothing is spoken.

```sh
herdr plugin action invoke dry-run
herdr plugin log list --plugin hikaruegashira.say --limit 1 | jq -r '.result.logs[-1].stdout'
```

## test

Speaks a real test line through `say`.

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
