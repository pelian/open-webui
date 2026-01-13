#!/bin/bash
# sync-upstream.sh - Safely sync Pelian Open WebUI with upstream releases
#
# Usage:
#   ./scripts/sync-upstream.sh [version]
#
# Examples:
#   ./scripts/sync-upstream.sh v0.7.2    # Sync to specific version
#   ./scripts/sync-upstream.sh           # Sync to latest upstream/main
#
# What this script does:
#   1. Creates a backup branch of your current state
#   2. Fetches upstream changes
#   3. Merges the target version/branch
#   4. Handles conflicts using our conflict resolution strategy
#   5. Verifies Pelian customizations survived

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Pelian-only files that should NEVER be overwritten by upstream
PELIAN_ONLY_FILES=(
    "docker-compose.aiden.yaml"
    "docker-compose.dev.yaml"
    "docker-compose.postgres.yaml"
    "env.aiden.example"
    "FORK_MAINTENANCE.md"
    "backend/open_webui/routers/aiden.py"
    "src/lib/apis/jobs/index.ts"
    "src/lib/components/jobs/*"
    "src/lib/services/rtvi.ts"
    "src/routes/(app)/jobs/*"
)

# Files where we should keep OUR version during conflicts
KEEP_OURS=(
    "src/lib/constants.ts"              # Has AIDEN_API_BASE_URL
    "src/lib/stores/index.ts"           # Has jobs store
    "backend/open_webui/main.py"        # Has aiden router imports
)

# Files where we should accept THEIRS but then re-apply our changes
MERGE_CAREFULLY=(
    "src/lib/components/layout/Sidebar.svelte"
    "package.json"
    "Dockerfile"
)

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check we're in the right directory
if [ ! -f "package.json" ] || ! grep -q "open-webui" package.json; then
    log_error "Must run from pelian-open-webui root directory"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
log_info "Current branch: $CURRENT_BRANCH"

# Determine target
TARGET="${1:-upstream/main}"
if [[ "$TARGET" == v* ]]; then
    # It's a version tag
    VERSION="$TARGET"
    TARGET="tags/$VERSION"
else
    VERSION="latest"
fi

log_info "Target: $TARGET ($VERSION)"

# Step 1: Create backup branch
BACKUP_BRANCH="backup/pre-sync-$(date +%Y%m%d-%H%M%S)"
log_info "Creating backup branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH"
log_success "Backup created at $BACKUP_BRANCH"

# Step 2: Stash any uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    log_info "Stashing uncommitted changes..."
    git stash push -m "Pre-sync stash $(date +%Y%m%d-%H%M%S)"
    STASHED=true
else
    STASHED=false
fi

# Step 3: Fetch upstream
log_info "Fetching upstream..."
git fetch upstream --tags

# Step 4: Show what's changing
echo ""
log_info "=== Changes Summary ==="
COMMITS_BEHIND=$(git rev-list --count HEAD..$TARGET 2>/dev/null || echo "unknown")
COMMITS_AHEAD=$(git rev-list --count $TARGET..HEAD 2>/dev/null || echo "unknown")
echo "  Commits behind upstream: $COMMITS_BEHIND"
echo "  Commits ahead (your customizations): $COMMITS_AHEAD"
echo ""

# Step 5: Attempt merge
log_info "Merging $TARGET..."

if git merge "$TARGET" --no-edit 2>/dev/null; then
    log_success "Merge completed without conflicts!"
else
    log_warn "Merge has conflicts. Applying resolution strategy..."

    # Get list of conflicting files
    CONFLICTS=$(git diff --name-only --diff-filter=U)

    for file in $CONFLICTS; do
        echo ""
        log_info "Resolving: $file"

        # Check if it's a Pelian-only file
        for pattern in "${PELIAN_ONLY_FILES[@]}"; do
            if [[ "$file" == $pattern ]]; then
                log_info "  -> Keeping OURS (Pelian-only file)"
                git checkout --ours "$file"
                git add "$file"
                continue 2
            fi
        done

        # Check if we should keep ours
        for keep in "${KEEP_OURS[@]}"; do
            if [[ "$file" == "$keep" ]]; then
                log_info "  -> Keeping OURS (customization file)"
                git checkout --ours "$file"
                git add "$file"
                continue 2
            fi
        done

        # Check if it's a careful merge file
        for careful in "${MERGE_CAREFULLY[@]}"; do
            if [[ "$file" == "$careful" ]]; then
                log_warn "  -> MANUAL REVIEW NEEDED: $file"
                log_warn "     This file has both upstream changes and our customizations"
                log_warn "     Opening in editor after merge completes..."
                continue 2
            fi
        done

        # Default: accept theirs for files we haven't modified intentionally
        log_info "  -> Accepting THEIRS (upstream change)"
        git checkout --theirs "$file"
        git add "$file"
    done

    # Check if there are still unresolved conflicts
    REMAINING=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        echo ""
        log_warn "=== Manual Resolution Required ==="
        log_warn "The following files need manual review:"
        echo "$REMAINING"
        echo ""
        log_info "After resolving, run:"
        log_info "  git add <resolved-files>"
        log_info "  git commit"
        exit 1
    fi

    # Complete the merge
    git commit --no-edit
    log_success "Merge completed with automatic conflict resolution"
fi

# Step 6: Verify Pelian customizations
echo ""
log_info "=== Verifying Pelian Customizations ==="

MISSING=()

# Check critical files exist
CRITICAL_FILES=(
    "src/lib/apis/jobs/index.ts"
    "src/lib/components/jobs/JobsBoard.svelte"
    "src/lib/services/rtvi.ts"
    "backend/open_webui/routers/aiden.py"
    "docker-compose.aiden.yaml"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "  $file"
    else
        log_error "  MISSING: $file"
        MISSING+=("$file")
    fi
done

# Check constants.ts has AIDEN_API_BASE_URL
if grep -q "AIDEN_API_BASE_URL" src/lib/constants.ts 2>/dev/null; then
    log_success "  AIDEN_API_BASE_URL in constants.ts"
else
    log_error "  MISSING: AIDEN_API_BASE_URL in constants.ts"
    MISSING+=("AIDEN_API_BASE_URL")
fi

# Check Sidebar.svelte has Jobs button
if grep -q "jobs" src/lib/components/layout/Sidebar.svelte 2>/dev/null; then
    log_success "  Jobs button in Sidebar.svelte"
else
    log_warn "  Jobs button may be missing from Sidebar.svelte - check manually"
fi

# Check main.py has aiden router
if grep -q "aiden" backend/open_webui/main.py 2>/dev/null; then
    log_success "  Aiden router in main.py"
else
    log_error "  MISSING: Aiden router import in main.py"
    MISSING+=("aiden router")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    log_error "=== Some customizations are missing! ==="
    log_warn "You may need to restore from backup branch: $BACKUP_BRANCH"
    log_info "  git diff $BACKUP_BRANCH -- <file>"
    log_info "  git checkout $BACKUP_BRANCH -- <file>"
fi

# Step 7: Restore stash if we created one
if [ "$STASHED" = true ]; then
    log_info "Restoring stashed changes..."
    git stash pop || log_warn "Could not auto-restore stash. Run 'git stash pop' manually."
fi

# Final summary
echo ""
log_success "=== Sync Complete ==="
echo "  Target: $TARGET"
echo "  Backup: $BACKUP_BRANCH"
echo ""
log_info "Next steps:"
echo "  1. Review changes: git diff $BACKUP_BRANCH"
echo "  2. Test the build: npm run build"
echo "  3. Test Docker: docker build -t pelian-open-webui:test ."
echo "  4. If issues, restore: git reset --hard $BACKUP_BRANCH"
echo "  5. Push when ready: git push origin $CURRENT_BRANCH"
