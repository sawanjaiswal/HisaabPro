#!/usr/bin/env bash
# Capacitor CLI Node 22+ runner
# Automatically resolves Node >= 22 from NVM or Homebrew to prevent [fatal] node version mismatch

for node_dir in \
  "$HOME/.nvm/versions/node/v22.23.2/bin" \
  "$HOME/.nvm/versions/node/v22.15.0/bin" \
  "$HOME/.nvm/versions/node/v23.11.0/bin" \
  "/opt/homebrew/opt/node@22/bin" \
  "/opt/homebrew/bin"; do
  if [ -x "$node_dir/node" ]; then
    export PATH="$node_dir:$PATH"
    break
  fi
done

exec npx @capacitor/cli "$@"
