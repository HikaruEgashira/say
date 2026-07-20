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

# Fallback for panes with no title: reduce raw terminal output to the head of
# the last agent message. Done entirely in perl (-CSD) — macOS awk's
# multibyte string compare is broken (it reports "実装" == "❯" as true) and BSD
# sed can't match \e/\a. Strips ANSI/OSC escapes and control bytes, drops
# terminal chrome — box borders, footer, prompts, tool-use/timing/recap lines —
# then prefers the last ⏺-anchored message and joins its visual rows. A window
# starting mid-message still yields a tail fragment; the
# claude-stop-title.sh hook path avoids scraping entirely.
speakable_message() {
  printf '%s' "$1" | perl -CSD -e '
    local $/; my $t = <STDIN>;
    $t =~ s/\e\][^\a]*(?:\a|\e\\)//g;
    $t =~ s/\e[@-_][0-?]*[ -\/]*[@-~]//g;
    my @lines;
    for my $l (split /\n/, $t) {
      $l =~ s/[\x00-\x1f\x7f]//g;
      $l =~ s/\s+/ /g; $l =~ s/^ //; $l =~ s/ $//;
      (my $p = $l) =~ s/[\x{2500}-\x{257F}\s]//g;   # drop box-drawing + spaces
      next if $p eq q{};
      next if $l =~ /^\x{23F5}/;                     # footer hint bar (⏵)
      next if $l eq qq{\x{276F}} || $l eq q{>};      # bare prompt (❯ or >)
      next if $l =~ /^\x{2026} \+\d+ tool use/;      # collapsed "… +4 tool uses"
      next if $l =~ /^[\x{2700}-\x{27BF}\x{00B7}] /; # spinner/timing "✻ Churned for 41m"
      next if $l =~ /^[\x{2800}-\x{28FF}]/;          # braille spinner
      next if $l =~ /^[\x{23BF}\x{2514}\x{23A3}]/;   # tool-result gutter (⎿)
      next if $l =~ /^\x{203B} recap:/;              # recap banner (※)
      next if $l =~ /\(disable recaps in \/config\)/;
      next if $l =~ /^\x{23FA} ?[A-Z]\w+\(/;         # tool call: ⏺ Bash(…)
      next if $l =~ /^\x{23FA} ?.*\x{2026}$/;        # transient: ⏺ Running…
      push @lines, $l;
    }
    exit 0 unless @lines;
    for my $i (reverse 0 .. $#lines) {
      if ($lines[$i] =~ /^\x{23FA} ?(.+)/) {         # last agent message (⏺)
        my @message = ($1, @lines[$i + 1 .. $#lines]);
        print join q{ }, @message;
        exit 0;
      }
    }
    print join q{ }, @lines;
  '
}

speak() {
  line="$1"
  say_bin="${SAY_BIN:-say-hook}"

  if ! command_exists "$say_bin"; then
    echo "say-hook binary not found: $say_bin (set SAY_BIN or install github:HikaruEgashira/say-hook)" >&2
    return 1
  fi

  "$say_bin" "$line"
}

excerpt() {
  say_bin="${SAY_BIN:-say-hook}"
  printf '%s' "$1" | "$say_bin" excerpt
}

dry_run() {
  load_env

  ok=1
  say_bin="${SAY_BIN:-say-hook}"
  statuses="${SAY_STATUSES:-done blocked}"
  lines="${SAY_LINES:-40}"

  echo "say-hook plugin dry-run"
  echo

  if command_exists "$say_bin"; then
    echo "say-hook: ok ($say_bin)"
  else
    echo "say-hook: missing ($say_bin); set SAY_BIN or install github:HikaruEgashira/say-hook"
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

  hook_path="$HOME/.claude/hooks/herdr-say-hook-title.sh"
  if [ -f "$hook_path" ]; then
    echo "claude Stop hook: ok ($hook_path)"
  else
    echo "claude Stop hook: not installed (run the Install Claude Hook action for exact excerpt speech)"
  fi

  echo
  echo "Sample spoken line:"
  echo "Implemented the say-hook plugin and pushed the branch."

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

  say_bin="${SAY_BIN:-say-hook}"
  echo "say-hook plugin test"
  echo

  if ! command_exists "$say_bin"; then
    echo "say-hook: missing ($say_bin)"
    echo
    echo "Result: failed"
    return 1
  fi

  line="This is a test line from the Herdr say-hook plugin."
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

# Copy claude-stop-title.sh next to herdr's own claude integration hook and
# register it as a Claude Code Stop hook. Idempotent.
install_claude_hook() {
  src="${HERDR_PLUGIN_ROOT:-.}/claude-stop-title.sh"
  hook_path="$HOME/.claude/hooks/herdr-say-hook-title.sh"
  settings="$HOME/.claude/settings.json"
  say_bin="${SAY_BIN:-say-hook}"

  if ! command_exists jq; then
    echo "jq is required"
    return 1
  fi
  if [ ! -f "$src" ]; then
    echo "claude-stop-title.sh not found: $src"
    return 1
  fi

  mkdir -p "$HOME/.claude/hooks"
  cp "$src" "$hook_path"
  chmod +x "$hook_path"
  echo "installed: $hook_path"

  say_bin_arg="$(jq -rn --arg value "$say_bin" '$value | @sh')"
  hook_path_arg="$(jq -rn --arg value "$hook_path" '$value | @sh')"
  cmd="env SAY_BIN=$say_bin_arg sh $hook_path_arg"
  [ -f "$settings" ] || printf '{}\n' > "$settings"
  tmp="$(mktemp)"
  if jq --arg cmd "$cmd" --arg hook_path "$hook_path" \
    '.hooks.Stop = ([.hooks.Stop[]?
      | .hooks = [.hooks[]? | select(((.command // "") | contains($hook_path)) | not)]
      | select((.hooks | length) > 0)]
      + [{matcher: "*", hooks: [{type: "command", command: $cmd, async: true}]}])' \
    "$settings" > "$tmp"; then
    mv "$tmp" "$settings"
    echo "registered Stop hook in $settings"
  else
    rm -f "$tmp"
    echo "failed to update $settings"
    return 1
  fi
}

if [ "${1:-}" = "--dry-run" ]; then
  dry_run
  exit $?
fi

if [ "${1:-}" = "--install-claude-hook" ]; then
  load_env
  install_claude_hook
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

# Primary source: the pane title reported by claude-stop-title.sh.
line="$(clean_line "$(first_value \
  "$(json_value HERDR_PLUGIN_EVENT_JSON "$event_json" '.data.title')" \
  "$(json_value HERDR_PLUGIN_CONTEXT_JSON "$context_json" '.title')" \
)")"

pane_id="$(first_value \
  "$(json_value HERDR_PLUGIN_EVENT_JSON "$event_json" '.data.pane_id')" \
  "$(json_value HERDR_PLUGIN_CONTEXT_JSON "$context_json" '.pane_id')" \
  "${HERDR_PANE_ID:-}" \
)"
herdr_bin="${HERDR_BIN_PATH:-herdr}"

# The Stop hook's title report can race the status flip: the event then
# carries title=null even though the report lands moments later. Re-read the
# pane briefly before giving up on the title.
if [ -z "$line" ] && [ -n "$pane_id" ]; then
  for _ in 1 2 3; do
    line="$(clean_line "$(json_value pane_get \
      "$("$herdr_bin" pane get "$pane_id" 2>/dev/null || true)" \
      '.result.pane.title')")"
    [ -n "$line" ] && break
    sleep 0.4
  done
fi

# Last resort for panes with no title source: scrape the screen.
if [ -z "$line" ] && [ -n "$pane_id" ]; then
  lines="${SAY_LINES:-40}"
  raw="$("$herdr_bin" pane read "$pane_id" --source recent-unwrapped --lines "$lines" 2>/dev/null || true)"
  line="$(speakable_message "$raw")"
fi

# Nothing speakable — stay silent rather than voice the bare status word.
[ -n "$line" ] || exit 0

line="$(excerpt "$line")"
[ -n "$line" ] || exit 0

speak "$line"
