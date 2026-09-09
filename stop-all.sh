#!/usr/bin/env bash
#
# HisaabPro — stop everything this repo started.
#
#   ./stop-all.sh             stop HisaabPro's dev processes
#   ./stop-all.sh --dry-run   show what would be stopped, touch nothing
#   ./stop-all.sh --force     also stop a FOREIGN process squatting on our ports
#
# "Ours" means a process whose working directory is inside this repo. Foreign
# processes are reported and left alone unless --force is given.

set -uo pipefail
cd "$(dirname "$0")"
REPO="$(pwd -P)"

PORTS=(5001 5002)
DRY=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY=1 ;;
    --force|-f)   FORCE=1 ;;
    -h|--help)    sed -n '3,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)"; exit 2 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

cwd_of() { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-; }
cmd_of() { ps -p "$1" -o command= 2>/dev/null | cut -c1-100; }
listener_on() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }

OURS=()
FOREIGN=()

# 1. Whatever is LISTENING on our ports.
for port in "${PORTS[@]}"; do
  pid=$(listener_on "$port")
  [ -z "$pid" ] && continue
  cwd=$(cwd_of "$pid")
  case "$cwd" in
    "$REPO"*) OURS+=("$pid:$port") ;;
    *)        FOREIGN+=("$pid:$port:${cwd:-unknown}") ;;
  esac
done

# 2. Our own node processes that are NOT listening (supervisors/children)
for pid in $(pgrep -x node 2>/dev/null; pgrep -f tsx 2>/dev/null); do
  cwd=$(cwd_of "$pid")
  case "$cwd" in
    "$REPO"*) printf '%s\n' "${OURS[@]:-}" | grep -q "^$pid:" || OURS+=("$pid:-") ;;
  esac
done

if [ ${#OURS[@]} -eq 0 ] && [ ${#FOREIGN[@]} -eq 0 ]; then
  ok "Nothing running — ports ${PORTS[*]} are free and no HisaabPro node process is up."
  exit 0
fi

# ── report ───────────────────────────────────────────────────────────────────
if [ ${#OURS[@]} -gt 0 ]; then
  bold "HisaabPro processes"
  for entry in "${OURS[@]}"; do
    pid=${entry%%:*}; port=${entry##*:}
    label=$([ "$port" = "-" ] && echo "         " || printf ':%-8s' "$port")
    printf '  %-7s %s %s\n' "$pid" "$label" "$(cmd_of "$pid")"
  done
fi

if [ ${#FOREIGN[@]} -gt 0 ]; then
  echo
  bold "NOT HisaabPro — another project is on our port"
  for entry in "${FOREIGN[@]}"; do
    pid=${entry%%:*}; rest=${entry#*:}; port=${rest%%:*}; cwd=${rest#*:}
    printf '  %-7s :%-6s %s\n' "$pid" "$port" "$(cmd_of "$pid")"
    printf '          cwd: %s\n' "$cwd"
  done
  [ "$FORCE" = "0" ] && warn "Left alone. Stop them yourself, or re-run with --force."
fi

if [ "$DRY" = "1" ]; then
  echo; ok "Dry run — nothing was stopped."
  exit 0
fi

# ── stop ─────────────────────────────────────────────────────────────────────
TARGETS=()
for entry in "${OURS[@]:-}"; do [ -n "$entry" ] && TARGETS+=("${entry%%:*}"); done
if [ "$FORCE" = "1" ]; then
  for entry in "${FOREIGN[@]:-}"; do [ -n "$entry" ] && TARGETS+=("${entry%%:*}"); done
fi
[ ${#TARGETS[@]} -eq 0 ] && exit 0

echo
bold "Stopping…"
for pid in "${TARGETS[@]}"; do kill -TERM "$pid" 2>/dev/null; done
for _ in $(seq 1 20); do
  alive=0
  for pid in "${TARGETS[@]}"; do kill -0 "$pid" 2>/dev/null && alive=1; done
  [ "$alive" = "0" ] && break
  sleep 0.25
done
for pid in "${TARGETS[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    warn "PID $pid ignored SIGTERM — sending SIGKILL"
    kill -KILL "$pid" 2>/dev/null
  fi
done

sleep 0.5
for port in "${PORTS[@]}"; do
  pid=$(listener_on "$port")
  if [ -z "$pid" ]; then ok "port $port free"; else warn "port $port STILL held by PID $pid"; fi
done
