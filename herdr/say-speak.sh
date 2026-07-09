#!/bin/sh
set -eu

# .env from the plugin config dir takes precedence; ./.env is a local-dev fallback.
load_env() {
  local_env="${HERDR_PLUGIN_ROOT:-.}/.env"

  if [ -n "${HERDR_PLUGIN_CONFIG_DIR:-}" ] && [ -f "$HERDR_PLUGIN_CONFIG_DIR/.env" ]; then
    # shellcheck disable=SC1090
    . "$HERDR_PLUGIN_CONFIG_DIR/.env"
  elif [ -f "$local_env" ]; then
    # shellcheck disable=SC1090
    . "$local_env"
  fi
}

json_value() {
  name="$1"
  json="${2:-}"
  query="$3"

  if [ -z "$json" ]; then
    return 0
  fi

  printf '%s' "$json" | jq -r "$query // empty" 2>/dev/null || {
    echo "failed to parse $name with jq" >&2
    return 1
  }
}

first_value() {
  for value in "$@"; do
    if [ -n "$value" ] && [ "$value" != "null" ]; then
      printf '%s' "$value"
      return 0
    fi
  done
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Collapse whitespace and strip a leading agent spinner (braille U+2800-28FF)
# that Claude prepends to its OSC title while working.
clean_line() {
  printf '%s' "$1" \
    | perl -CSD -pe 's/^\s*[\x{2800}-\x{28FF}]+\s*//; s/\s+/ /g; s/^ //; s/ $//'
}

# Fallback for agents that set no OSC title: reduce raw terminal output to the
# last speakable *content* line. Done entirely in perl (-CSD) — macOS awk's
# multibyte string compare is broken (it reports "実装" == "❯" as true) and BSD
# sed can't match \e/\a. Strips ANSI/OSC escapes and control bytes, then skips
# terminal chrome — box borders, the footer hint bar, a bare prompt — so we
# never voice "auto mode on shift+tab to cycle".
last_speakable_line() {
  printf '%s' "$1" | perl -CSD -e '
    local $/; my $t = <STDIN>;
    $t =~ s/\e\][^\a]*(?:\a|\e\\)//g;
    $t =~ s/\e[@-_][0-?]*[ -\/]*[@-~]//g;
    my $last = "";
    for my $l (split /\n/, $t) {
      $l =~ s/[\x00-\x1f\x7f]//g;
      $l =~ s/\s+/ /g; $l =~ s/^ //; $l =~ s/ $//;
      (my $p = $l) =~ s/[\x{2500}-\x{257F}\s]//g;   # drop box-drawing + spaces
      next if $p eq q{};
      next if $l =~ /^\x{23F5}/;                     # footer hint bar (⏵)
      next if $l eq qq{\x{276F}} || $l eq q{>};      # bare prompt (❯ or >)
      $last = $l;
    }
    print $last;
  '
}

speak() {
  line="$1"
  say_bin="${SAY_BIN:-say}"

  if ! command_exists "$say_bin"; then
    echo "say binary not found: $say_bin (set SAY_BIN or install github:HikaruEgashira/say)" >&2
    return 1
  fi

  "$say_bin" "$line"
}

dry_run() {
  load_env

  ok=1
  say_bin="${SAY_BIN:-say}"
  statuses="${SAY_STATUSES:-done blocked}"
  lines="${SAY_LINES:-12}"

  echo "Say plugin dry-run"
  echo

  if command_exists "$say_bin"; then
    echo "say: ok ($say_bin)"
  else
    echo "say: missing ($say_bin); set SAY_BIN or install github:HikaruEgashira/say"
    ok=0
  fi

  if command_exists jq; then
    echo "jq: ok"
  else
    echo "jq: missing"
    ok=0
  fi

  echo "SAY_STATUSES: $statuses"
  echo "SAY_LINES: $lines"

  echo
  echo "Sample spoken line:"
  echo "Implemented the say plugin and pushed the branch."

  if [ "$ok" -eq 1 ]; then
    echo
    echo "Result: ok"
    return 0
  fi

  echo
  echo "Result: failed"
  return 1
}

test_speak() {
  load_env

  say_bin="${SAY_BIN:-say}"
  echo "Say plugin test"
  echo

  if ! command_exists "$say_bin"; then
    echo "say: missing ($say_bin)"
    echo
    echo "Result: failed"
    return 1
  fi

  line="This is a test line from the Herdr say plugin."
  echo "Speaking:"
  echo "$line"
  echo

  if speak "$line"; then
    echo "Result: spoken"
    return 0
  fi

  echo "Result: failed"
  return 1
}

if [ "${1:-}" = "--dry-run" ]; then
  dry_run
  exit $?
fi

if [ "${1:-}" = "--test" ]; then
  test_speak
  exit $?
fi

load_env

event_json="${HERDR_PLUGIN_EVENT_JSON:-}"
context_json="${HERDR_PLUGIN_CONTEXT_JSON:-}"

status="$(first_value \
  "$(json_value HERDR_PLUGIN_EVENT_JSON "$event_json" '.data.agent_status')" \
  "$(json_value HERDR_PLUGIN_CONTEXT_JSON "$context_json" '.focused_pane_status')" \
  "$(json_value HERDR_PLUGIN_CONTEXT_JSON "$context_json" '.agent_status')" \
)"
status="$(printf '%s' "$status" | tr '[:upper:]' '[:lower:]')"

# Only speak on terminal states; idle/working/unknown would speak constantly.
statuses="${SAY_STATUSES:-done blocked}"
matched=0
for s in $statuses; do
  if [ "$status" = "$s" ]; then
    matched=1
    break
  fi
done
[ "$matched" -eq 1 ] || exit 0

# Primary source: the OSC title the agent set — its own one-line task summary
# (e.g. "herdr plugin を実装する"). This is what pane.agent_status_changed carries.
line="$(clean_line "$(first_value \
  "$(json_value HERDR_PLUGIN_EVENT_JSON "$event_json" '.data.title')" \
  "$(json_value HERDR_PLUGIN_CONTEXT_JSON "$context_json" '.title')" \
)")"

# Fallback for agents with no OSC title: the last content line of the pane.
if [ -z "$line" ]; then
  pane_id="$(first_value \
    "$(json_value HERDR_PLUGIN_EVENT_JSON "$event_json" '.data.pane_id')" \
    "$(json_value HERDR_PLUGIN_CONTEXT_JSON "$context_json" '.pane_id')" \
    "${HERDR_PANE_ID:-}" \
  )"
  if [ -n "$pane_id" ]; then
    herdr_bin="${HERDR_BIN_PATH:-herdr}"
    lines="${SAY_LINES:-12}"
    raw="$("$herdr_bin" pane read "$pane_id" --source recent-unwrapped --lines "$lines" 2>/dev/null || true)"
    line="$(last_speakable_line "$raw")"
  fi
fi

# Nothing speakable — stay silent rather than voice the bare status word.
[ -n "$line" ] || exit 0

speak "$line"
