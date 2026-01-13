#!/bin/bash
# git-push-gitlab.sh - Push to GitLab and trigger sync to aiden server
#
# Usage:
#   .sync/git-push-gitlab.sh [--branch <branch>]
#
# This script:
#   1. Pushes to GitLab
#   2. Publishes sync signal to Valkey
#   3. aiden's sync-antenna pulls changes
#
# Prerequisites:
#   - GitLab remote configured: git remote add gitlab http://aiden.neko-trench.ts.net:8929/pelian/pelian-open-webui.git
#   - Valkey running on aiden:6379

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse args
BRANCH=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --branch|-b)
            BRANCH="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Default to current branch
if [ -z "$BRANCH" ]; then
    BRANCH=$(git branch --show-current)
fi

echo -e "${GREEN}[pelian-sync]${NC} Branch: $BRANCH"

# Check gitlab remote exists
if ! git remote get-url gitlab &>/dev/null; then
    echo -e "${RED}[ERROR]${NC} GitLab remote not configured"
    echo "Run: git remote add gitlab http://aiden.neko-trench.ts.net:8929/pelian/pelian-open-webui.git"
    exit 1
fi

# Push to GitLab
echo -e "${GREEN}[pelian-sync]${NC} Pushing to GitLab..."
git push gitlab "$BRANCH" --force-with-lease

# Publish sync signal to Valkey
# Channel: pelian:sync (separate from aiden:sync)
VALKEY_HOST="aiden.neko-trench.ts.net"
VALKEY_PORT="6379"
SYNC_MESSAGE="{\"repo\":\"pelian-open-webui\",\"branch\":\"$BRANCH\",\"timestamp\":$(date +%s)}"

echo -e "${GREEN}[pelian-sync]${NC} Publishing sync signal..."
if command -v redis-cli &>/dev/null; then
    echo "$SYNC_MESSAGE" | redis-cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" PUBLISH pelian:sync "$SYNC_MESSAGE" >/dev/null
    echo -e "${GREEN}[pelian-sync]${NC} Sync signal published to pelian:sync"
else
    echo -e "${YELLOW}[WARN]${NC} redis-cli not installed. Manual sync required on aiden."
    echo "  ssh aiden 'cd ~/dev/pelian-open-webui && git fetch gitlab && git reset --hard gitlab/$BRANCH'"
fi

echo -e "${GREEN}[pelian-sync]${NC} Done!"
