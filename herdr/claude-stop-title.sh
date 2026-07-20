#!/bin/sh
# Claude Code Stop hook installed by the herdr say-hook plugin.
set -eu

[ "${HERDR_ENV:-}" = "1" ] || exit 0
[ -n "${HERDR_PANE_ID:-}" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
say_bin="${SAY_BIN:-say-hook}"
command -v "$say_bin" >/dev/null 2>&1 || exit 0

herdr_bin="${HERDR_BIN_PATH:-herdr}"
command -v "$herdr_bin" >/dev/null 2>&1 || exit 0

message="$(jq -r '
  select(.stop_hook_active | not)
  | .last_assistant_message // ""
' 2>/dev/null || true)"
line="$(printf '%s' "$message" | "$say_bin" excerpt)"
[ -n "$line" ] || exit 0

# TTL keeps a finished turn's title from being spoken for a later, unrelated
# blocked event; done fires within seconds of Stop, well inside the window.
"$herdr_bin" pane report-metadata "$HERDR_PANE_ID" \
  --source herdr:say-hook --title "$line" --ttl-ms 120000 >/dev/null 2>&1 || true
