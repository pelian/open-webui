#!/bin/bash
# sync-antenna.sh - Listen for pelian:sync signals and pull changes
#
# This runs on the aiden server as a systemd service.
# It subscribes to Valkey channel pelian:sync and pulls when signaled.
#
# Install as service:
#   sudo cp deploy/pelian-sync-antenna.service /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now pelian-sync-antenna

set -e

REPO_DIR="$HOME/dev/pelian-open-webui"
VALKEY_HOST="localhost"
VALKEY_PORT="6379"
CHANNEL="pelian:sync"

cd "$REPO_DIR"

echo "[pelian-antenna] Starting sync antenna for pelian-open-webui"
echo "[pelian-antenna] Repo: $REPO_DIR"
echo "[pelian-antenna] Channel: $CHANNEL"

# Subscribe to Valkey channel
redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" SUBSCRIBE "$CHANNEL" | while read -r type; do
    read -r channel
    read -r message

    if [ "$type" = "message" ]; then
        echo "[pelian-antenna] $(date): Received sync signal"
        echo "[pelian-antenna] Message: $message"

        # Extract branch from message (JSON)
        BRANCH=$(echo "$message" | grep -oP '"branch"\s*:\s*"\K[^"]+' || echo "main")
        echo "[pelian-antenna] Branch: $BRANCH"

        # Pull changes
        cd "$REPO_DIR"
        git fetch gitlab 2>&1 | sed 's/^/[pelian-antenna] /'
        git reset --hard "gitlab/$BRANCH" 2>&1 | sed 's/^/[pelian-antenna] /'

        echo "[pelian-antenna] Sync complete"

        # Optionally rebuild Docker (if webhook configured)
        if [ -n "$PELIAN_REBUILD_WEBHOOK" ]; then
            echo "[pelian-antenna] Triggering rebuild webhook..."
            curl -s -X POST "$PELIAN_REBUILD_WEBHOOK" || echo "[pelian-antenna] Webhook failed"
        fi
    fi
done
