#!/bin/sh
set -e

mkdir -p /app/config
mkdir -p /app/static
mkdir -p /app/build/client

if [ -n "$BACKEND_URL" ]; then
  BACKEND_URL_VALUE="$BACKEND_URL"
elif [ -n "$SSD_SUBDOMAIN" ] && [ -n "$SSD_DOMAIN" ]; then
  BACKEND_URL_VALUE="https://$SSD_SUBDOMAIN.$SSD_DOMAIN"
elif [ -n "$SSD_DOMAIN" ]; then
  BACKEND_URL_VALUE="https://$SSD_DOMAIN"
else
  echo "❌ BACKEND_URL manquant"
  echo "   Définis BACKEND_URL, ou SSD_SUBDOMAIN + SSD_DOMAIN."
  exit 1
fi

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
  cat > /app/static/settings.json <<EOF
{
  "applications": [],
  "dossiers": {
    "on_item_type": [],
    "authentification": {
      "authappli": "basique"
    },
    "domaine": {}
  }
}
EOF
fi

if [ ! -f /app/static/services.json ]; then
  echo '[]' > /app/static/services.json
fi

rm -f /app/build/client/settings.json
rm -f /app/build/client/services.json

ln -sfn /app/static/settings.json /app/build/client/settings.json
ln -sfn /app/static/services.json /app/build/client/services.json

if [ -n "$SSD_UID" ] && [ -n "$SSD_GID" ]; then
  chown -R "$SSD_UID:$SSD_GID" /app/static || true
fi

echo "✅ /app/config/servers.json généré"
cat /app/config/servers.json

echo "✅ /settings.json lié vers /app/static/settings.json"
echo "✅ /services.json lié vers /app/static/services.json"

if [ -d /opt/ssd-frontend-scripts ]; then
  mkdir -p /app/scripts

  if [ -z "$(find /app/scripts -maxdepth 1 -type f -name '*.sh' 2>/dev/null)" ]; then
    cp -a /opt/ssd-frontend-scripts/. /app/scripts/
    chmod +x /app/scripts/*.sh 2>/dev/null || true
    echo "✅ scripts copiés vers /app/scripts"
  else
    echo "✅ scripts déjà présents dans /app/scripts"
  fi

  if [ -n "$SSD_UID" ] && [ -n "$SSD_GID" ]; then
    chown -R "$SSD_UID:$SSD_GID" /app/scripts || true
  fi
fi

exec "$@"