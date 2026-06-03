#!/bin/sh
set -e

mkdir -p /app/config
mkdir -p /app/static
mkdir -p /app/build/client

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

if [ ! -f /app/static/settings.json ]; then
  echo '{}' > /app/static/settings.json
fi

if [ ! -f /app/static/services.json ]; then
  echo '[]' > /app/static/services.json
fi

cp /app/static/settings.json /app/build/client/settings.json
cp /app/static/services.json /app/build/client/services.json

echo "✅ /app/config/servers.json généré"
cat /app/config/servers.json

echo "✅ /app/build/client/settings.json prêt"
echo "✅ /app/build/client/services.json prêt"

exec "$@"