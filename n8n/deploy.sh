#!/usr/bin/env bash
# Deploys Postpilot workflows + credentials to the self-hosted n8n over SSH.
# Usage: APP_BASE_URL=https://your-app n8n/deploy.sh   (APP_SECRET / GEMINI_API_KEY / SMTP_USER / SMTP_PASS read from web/.env.local if unset)
# Secrets are stamped into copies in a temp dir and removed from the VM and container afterwards; nothing secret is committed.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f web/.env.local ]; then
  APP_SECRET="${APP_SECRET:-$(grep '^APP_SECRET=' web/.env.local | cut -d= -f2-)}"
  GEMINI_API_KEY="${GEMINI_API_KEY:-$(grep '^GEMINI_API_KEY=' web/.env.local | cut -d= -f2-)}"
  SMTP_USER="${SMTP_USER:-$(grep '^SMTP_USER=' web/.env.local | cut -d= -f2-)}"
  SMTP_PASS="${SMTP_PASS:-$(grep '^SMTP_PASS=' web/.env.local | cut -d= -f2-)}"
fi
SMTP_USER="${SMTP_USER:-disabled}"; SMTP_PASS="${SMTP_PASS:-disabled}"   # optional: approval emails only
: "${APP_BASE_URL:?set APP_BASE_URL}" "${APP_SECRET:?}" "${GEMINI_API_KEY:?}"
VM="${N8N_SSH:-ubuntu@152.67.183.135}"; KEY="${N8N_SSH_KEY:-$HOME/.ssh/oracle_n8n}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for f in n8n/workflows/*.json; do sed "s|APP_BASE_URL_HERE|$APP_BASE_URL|g" "$f" > "$TMP/$(basename "$f")"; done
sed -e "s|APP_SECRET_HERE|$APP_SECRET|" -e "s|GEMINI_API_KEY_HERE|$GEMINI_API_KEY|" -e "s|SMTP_USER_HERE|$SMTP_USER|" -e "s|SMTP_PASS_HERE|$SMTP_PASS|" n8n/credentials.template.json > "$TMP/credentials.json"
cat > "$TMP/remote.sh" <<'REMOTE'
set -euo pipefail
cd ~/n8n
docker compose exec -T -u root n8n rm -rf /tmp/pp-deploy
docker cp /tmp/pp-deploy n8n-n8n-1:/tmp/pp-deploy
docker compose exec -T -u root n8n chown -R node:node /tmp/pp-deploy
docker compose exec -T n8n n8n import:credentials --input=/tmp/pp-deploy/credentials.json 2>&1 | grep -i "imported"
for f in /tmp/pp-deploy/postpilot-*.json; do docker compose exec -T n8n n8n import:workflow --input="$f" 2>&1 | grep -i "imported"; done
for id in PostpilotGenerate01 PostpilotPublish001 PostpilotAnalytics1 PostpilotNotify0001; do docker compose exec -T n8n n8n update:workflow --id=$id --active=true >/dev/null 2>&1; done
docker compose exec -T -u root n8n rm -rf /tmp/pp-deploy
rm -rf /tmp/pp-deploy
docker compose restart n8n >/dev/null 2>&1
echo "n8n restarting; workflows activate in ~60s"
REMOTE
ssh -n -i "$KEY" "$VM" 'rm -rf /tmp/pp-deploy && mkdir -p /tmp/pp-deploy'
scp -q -i "$KEY" "$TMP"/*.json "$TMP/remote.sh" "$VM:/tmp/pp-deploy/"
ssh -n -i "$KEY" "$VM" 'bash /tmp/pp-deploy/remote.sh'
