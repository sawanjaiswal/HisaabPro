#!/usr/bin/env bash
#
# HisaabPro — bring the whole local stack up with one command.
#
#   ./start-all.sh              backend + web, with preflight checks
#   ./start-all.sh --no-checks  skip preflight (faster restart loop)
#   ./start-all.sh --api-only   just the backend
#   ./start-all.sh --web-only   just the web client
#
# Ctrl-C stops everything. Both servers log into this terminal, prefixed [api]
# and [web], so a stack trace tells you which process it came from.
#
# The preflight checks:
# 1. Postgres running
# 2. hisaabpro database exists
# 3. Prisma migrations up to date
# 4. Ports 5001 (API) and 5002 (Web) are free

set -uo pipefail
cd "$(dirname "$0")"

API_PORT=5001
WEB_PORT=5002
RUN_CHECKS=1
RUN_API=1
RUN_WEB=1

for arg in "$@"; do
  case "$arg" in
    --no-checks) RUN_CHECKS=0 ;;
    --api-only)  RUN_WEB=0 ;;
    --web-only)  RUN_API=0 ;;
    -h|--help)   sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)"; exit 2 ;;
  esac
done

bold()  { printf '\033[1m%s\033[0m\n' "$1"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn()  { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()   { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

# LISTEN only. Plain `lsof -ti tcp:port` also returns ESTABLISHED sockets.
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }

# Which project a pid belongs to, by its working directory.
owner_of() {
  cwd=$(lsof -a -p "$1" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
  case "$cwd" in
    "$(pwd -P)"*) echo "this repo" ;;
    "") echo "unknown" ;;
    *) basename "$cwd" ;;
  esac
}

# ── preflight ────────────────────────────────────────────────────────────────
if [ "$RUN_CHECKS" = "1" ]; then
  bold "Preflight"

  # 1. Postgres
  if ! pg_isready -q 2>/dev/null; then
    warn "Postgres is not accepting connections — starting postgresql@17…"
    brew services start postgresql@17 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1
    for _ in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 0.5; done
    pg_isready -q 2>/dev/null || die "Postgres still down. Try: brew services list"
  fi
  ok "Postgres up"

  # 2. Database exists
  DB_NAME="hisaabpro_dev"
  if [ -f server/.env ]; then
    EXTRACTED_DB=$(grep -E '^DATABASE_URL=' server/.env | head -1 | sed -E 's/.*\/([^?]+)(\?.*)?/\1/' | tr -d '"' | tr -d "'")
    [ -n "$EXTRACTED_DB" ] && DB_NAME="$EXTRACTED_DB"
  fi
  if ! psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
    warn "Database $DB_NAME does not exist — creating it…"
    createdb "$DB_NAME" 2>/dev/null || die "Could not create database $DB_NAME. Run: createdb $DB_NAME"
  fi
  ok "Database $DB_NAME present"

  # 3. Pending migrations
  PENDING=$( (cd server && npx prisma migrate status 2>/dev/null) | grep -c "have not yet been applied" || true)
  if [ "${PENDING:-0}" -gt 0 ]; then
    warn "Migrations are PENDING — a new column will look like it does not exist."
    warn "Apply them:  cd server && npx prisma migrate deploy"
  else
    ok "Migrations up to date"
  fi

  # 4. Ports free
  for p in $([ "$RUN_API" = 1 ] && echo $API_PORT) $([ "$RUN_WEB" = 1 ] && echo $WEB_PORT); do
    PID=$(port_pid "$p")
    if [ -n "$PID" ]; then
      printf '  \033[31m✗\033[0m Port %s is held by PID %s — %s\n' "$p" "$PID" "$(owner_of "$PID")"
      printf '      %s\n' "$(ps -p "$PID" -o command= 2>/dev/null | cut -c1-88)"
      printf '      Stop everything this repo started:  ./stop-all.sh\n'
      printf '      Foreign process? Run: ./stop-all.sh --force\n'
      exit 1
    fi
  done
  ok "Ports free"
  echo
fi

# ── run ──────────────────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  trap - INT TERM EXIT
  echo
  bold "Stopping…"
  for pid in "${PIDS[@]:-}"; do
    [ -n "${pid:-}" ] && kill -- -"$pid" 2>/dev/null
  done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

# `set -m` + kill -PID kills the whole process group
set -m

if [ "$RUN_API" = "1" ]; then
  bold "Starting backend → http://localhost:$API_PORT"
  ( npm --prefix server run dev 2>&1 | sed $'s/^/\033[36m[api]\033[0m /' ) &
  PIDS+=($!)
fi

if [ "$RUN_WEB" = "1" ]; then
  bold "Starting web     → http://localhost:$WEB_PORT"
  ( npm run dev:web 2>&1 | sed $'s/^/\033[35m[web]\033[0m /' ) &
  PIDS+=($!)
fi

# Wait for backend health probe
if [ "$RUN_API" = "1" ]; then
  for _ in $(seq 1 40); do
    curl -sf -o /dev/null "http://localhost:$API_PORT/api/health" && { echo; ok "backend healthy"; break; }
    sleep 0.5
  done
fi

echo
bold "Ready — Ctrl-C stops both"
[ "$RUN_WEB" = "1" ] && echo "  web  http://localhost:$WEB_PORT"
[ "$RUN_API" = "1" ] && echo "  api  http://localhost:$API_PORT"
echo

wait
