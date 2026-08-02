#!/usr/bin/env bash
# Kiren node installer — connect-back agent, no sudo required.
# The agent dials OUT to the hub over WebSocket. No inbound ports, no public IP.
# Usage:
#   curl -fsSL <server>/api/nodes/install.sh | bash -s -- <hub-url> <token>
set -euo pipefail

HUB="${1:-}"
TOKEN="${2:-}"

if [[ -z "$HUB" ]]; then echo "usage: install.sh <ws://hub/ws/node> <token>"; exit 1; fi
if [[ -z "$TOKEN" ]]; then echo "missing node token"; exit 1; fi

AGENT_DIR="$HOME/.kiren-agent"
mkdir -p "$AGENT_DIR"

# The agent source is inlined by the server in place of __AGENT_JS__.
cat > "$AGENT_DIR/agent.js" <<'KIREN_AGENT'
__AGENT_JS__
KIREN_AGENT

chmod +x "$AGENT_DIR/agent.js"

cat > "$AGENT_DIR/agent.env" <<EOF
HUB=${HUB}
TOKEN=${TOKEN}
EOF

echo "[kiren-agent] installed to $AGENT_DIR/agent.js"
command -v node >/dev/null 2>&1 || { echo "[kiren-agent] WARN: node not found. Install node >= 18 to run the agent."; exit 0; }

command -v docker >/dev/null 2>&1 || echo "[kiren-agent] WARN: docker not found — container RPCs will fail."
command -v cloudflared >/dev/null 2>&1 || echo "[kiren-agent] WARN: cloudflared not found — tunnels unavailable. See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"

cat > "$AGENT_DIR/run.sh" <<'RUNEOF'
#!/usr/bin/env bash
cd "$HOME/.kiren-agent"
set -a; source agent.env; set +a
exec node agent.js >> agent.log 2>&1
RUNEOF
chmod +x "$AGENT_DIR/run.sh"

echo ""
echo "[kiren-agent] done."
echo "[kiren-agent] run now:      $AGENT_DIR/run.sh"
echo "[kiren-agent] autostart:    (crontab -l 2>/dev/null; echo '@reboot $AGENT_DIR/run.sh') | crontab -"
echo "[kiren-agent] logs:         tail -f $AGENT_DIR/agent.log"
