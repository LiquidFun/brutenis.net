#!/usr/bin/env bash
set -euo pipefail

if [ ! -f /tmp/cert.pem ]; then
  echo "Generating self-signed certificate..."
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
    -keyout /tmp/key.pem -out /tmp/cert.pem -days 365 -nodes \
    -subj '/CN=localhost' 2>/dev/null
fi

WHITELIST=(
  --whitelist="$(pwd)"
  --whitelist=/tmp/key.pem
  --whitelist=/tmp/cert.pem
  --whitelist="$HOME/.npm"
  --whitelist="$HOME/.config/astro"
  --read-only="$HOME/.config/astro"
)

# If node lives under $HOME (nvm, fnm, volta, etc.), whitelist it read-only
NODE_DIR="$(dirname "$(dirname "$(readlink -f "$(which node)")")")"
if [[ "$NODE_DIR" == "$HOME"* ]]; then
  WHITELIST+=(--whitelist="$NODE_DIR" --read-only="$NODE_DIR")
fi

exec env ASTRO_TELEMETRY_DISABLED=1 firejail --noprofile \
  "${WHITELIST[@]}" \
  -- npx astro dev --host 0.0.0.0
