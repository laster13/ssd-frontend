#!/bin/sh
set -e

mkdir -p /app/config

BACKEND_URL_VALUE="${BACKEND_URL:-https://ssdv2.streamfusion.fr}"

API_KEY_VALUE="${BACKEND_API_KEY:-}"

if [ -z "$API_KEY_VALUE" ] && [ -f /app/backend-data/settings.json ]; then
  API_KEY_VALUE="$(jq -r '.api_key // ""' /app/backend-data/settings.json)"
fi

cat > /app/config/servers.json <<EOF
{
  "backendUrl": "$BACKEND_URL_VALUE",
  "apiKey": "$API_KEY_VALUE"
}
EOF

echo "✅ /app/config/servers.json généré"
cat /app/config/servers.json

exec "$@"