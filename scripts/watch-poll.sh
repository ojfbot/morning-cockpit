#!/bin/bash
# Scheduled runner for the Anthropic watch poller (ADR-0016).
#
# Deliberately NOT `claude -p`. The house pattern for scheduled AGENTIC work is
# core/scripts/trace-triager.sh, which runs claude headless in an isolated worktree. This job
# is not agentic: every step is deterministic and the scoring model is local Ollama, so an
# agent loop would add cost, nondeterminism, and an API key in the launchd environment for no
# gain. See implementation-notes.md, Deviation #1.
#
# Never fails the schedule: every degradation path logs and exits 0. The run ledger is what
# tells you whether a green exit actually did anything.

set -euo pipefail

REPO="/Users/yuri/ojfbot/morning-cockpit"
RUN_LOG="$HOME/.claude/morning-cockpit-watch.jsonl"
SINCE="${WATCH_SINCE:-2d}"

log_run() {
  # status, detail — one JSON line per run, matching the trace-triager ledger convention.
  mkdir -p "$(dirname "$RUN_LOG")"
  printf '{"ts":"%s","source":"morning-cockpit-watch","status":"%s","detail":"%s","since":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$SINCE" >> "$RUN_LOG"
}

# Resolve node — launchd's PATH is minimal (the skill-architecture-audit rail pattern).
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.local/share/fnm/aliases/default/bin" "$HOME/.fnm/aliases/default/bin" \
           /opt/homebrew/bin "$HOME/.local/bin"; do
    if [ -x "$d/node" ]; then PATH="$d:$PATH"; export PATH; break; fi
  done
fi

if ! command -v node >/dev/null 2>&1; then
  log_run "skipped" "node not found on PATH"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  # pnpm is usually a corepack shim next to node; if it is missing there is nothing to run.
  log_run "skipped" "pnpm not found on PATH"
  exit 0
fi

cd "$REPO" || { log_run "skipped" "repo not found at $REPO"; exit 0; }

# The scorer needs the local model. Without it the poller still completes on the
# deterministic floor, but the brief is much blunter — worth recording either way.
OLLAMA_URL="${COCKPIT_OLLAMA_URL:-http://127.0.0.1:11434}"
if ! curl -sS -m 5 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  log_run "degraded" "ollama unreachable at $OLLAMA_URL — deterministic scoring only"
fi

log_run "started" "since=$SINCE"

# macOS has no GNU timeout; background the run and hand-roll the watchdog (house pattern).
set +e
pnpm --filter @cockpit/watch poll -- --since "$SINCE" &
CHILD=$!

# BACKSTOP ONLY — must stay comfortably above the CLI's own --deadline-mins (default 25).
# The CLI stops scoring at its deadline and still stages a brief and closes its run row; a
# kill here skips that `finally`, leaving `runs` stuck at 'started' and committing scored
# items to seen_items without ever briefing them. If this watchdog is what stops the job,
# something is wrong — not merely slow.
WAITED=0
LIMIT=$(( 45 * 60 ))
while kill -0 "$CHILD" 2>/dev/null; do
  if [ "$WAITED" -ge "$LIMIT" ]; then
    kill -TERM "$CHILD" 2>/dev/null
    sleep 5
    kill -KILL "$CHILD" 2>/dev/null
    log_run "timeout" "exceeded ${LIMIT}s"
    exit 0
  fi
  sleep 10
  WAITED=$(( WAITED + 10 ))
done

wait "$CHILD"
RC=$?
set -e

if [ "$RC" -eq 0 ]; then
  log_run "finished" "ok"
else
  log_run "failed" "exit $RC"
fi

# Always exit 0: a failed poll must not put the LaunchAgent into a failure state.
exit 0
