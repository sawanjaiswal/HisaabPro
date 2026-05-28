#!/usr/bin/env bash
# Post-deploy smoke test for HisaabPro API.
# Usage: API=https://api.hisaabpro.in ./scripts/smoke-deploy.sh
# Exit 0 = all expectations met. Non-zero = a check failed.
set -uo pipefail

API="${API:-http://localhost:4000}"
fail=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ok   %-48s %s\n' "$desc" "$actual"
  else
    printf '  FAIL %-48s got %s, want %s\n' "$desc" "$actual" "$expected"
    fail=1
  fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@" 2>/dev/null; }

echo "Smoke test → $API"

# Health — public, must be 200
check "GET /api/health (public)" 200 "$(code "$API/api/health")"

# CSRF token — public bootstrap, must be 200
check "GET /api/auth/csrf-token (public)" 200 "$(code "$API/api/auth/csrf-token")"

# Identity — must require auth
check "GET /api/auth/me (no auth)" 401 "$(code "$API/api/auth/me")"

# Presence read — must require auth (#150)
check "GET /api/presence/party/x (no auth)" 401 "$(code "$API/api/presence/party/smoke")"

# Mutation without CSRF/auth — CSRF guard fires first → 403
check "POST /api/presence/heartbeat (no csrf)" 403 \
  "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$API/api/presence/heartbeat")"

# A protected resource list — must require auth, never 5xx
check "GET /api/parties (no auth)" 401 "$(code "$API/api/parties")"

echo
if [ "$fail" -eq 0 ]; then
  echo "SMOKE PASS"
else
  echo "SMOKE FAIL — see above"
fi
exit "$fail"
