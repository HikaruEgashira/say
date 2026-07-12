#!/bin/sh
# Claude Code Stop hook installed by the herdr say-hook plugin (say-hook-speak.sh
# --install-claude-hook). Reports the final message's first line as the herdr
# pane title, so pane.agent_status_changed carries the exact line `say-hook hook`
# would speak — instead of whatever the screen-scrape fallback finds.
set -eu

[ "${HERDR_ENV:-}" = "1" ] || exit 0
[ -n "${HERDR_PANE_ID:-}" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

herdr_bin="${HERDR_BIN_PATH:-herdr}"
command -v "$herdr_bin" >/dev/null 2>&1 || exit 0

line="$(jq -r '
  select(.stop_hook_active | not)
  | .last_assistant_message // ""
  | split("\n")
  | map(sub("^\\s+"; "") | sub("\\s+$"; ""))
  | map(select(. != ""))
  | .[0] // empty
' 2>/dev/null || true)"
[ -n "$line" ] || exit 0

# TTL keeps a finished turn's title from being spoken for a later, unrelated
# blocked event; done fires within seconds of Stop, well inside the window.
"$herdr_bin" pane report-metadata "$HERDR_PANE_ID" \
  --source herdr:say-hook --title "$line" --ttl-ms 120000 >/dev/null 2>&1 || true
