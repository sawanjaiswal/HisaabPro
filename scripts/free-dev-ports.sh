#!/usr/bin/env bash
# Free HisaabPro dev ports from stale/orphaned processes before `npm run dev*`.
# Only touches the ports passed as args (defaults to both HP dev ports), so it
# never kills another project's server. strictPort (vite) + the API EADDRINUSE
# guard still fail loudly if a port somehow stays occupied after this runs.
#
# Usage: sh scripts/free-dev-ports.sh [port ...]   (default: 5001 5002)

set -u
ports=("$@")
if [ "${#ports[@]}" -eq 0 ]; then
  ports=(5001 5002)
fi

for p in "${ports[@]}"; do
  pids=$(lsof -ti "tcp:${p}" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "› freeing stale HisaabPro port ${p} (pid: ${pids//$'\n'/ })"
    kill ${pids} 2>/dev/null || true
    sleep 0.3
    # escalate only if it ignored SIGTERM
    still=$(lsof -ti "tcp:${p}" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "${still}" ] && kill -9 ${still} 2>/dev/null || true
  fi
done

exit 0
