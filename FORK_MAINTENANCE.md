# Pelian Open WebUI Fork Maintenance

This is a fork of [Open WebUI](https://github.com/open-webui/open-webui) with Aiden-specific customizations.

## Repository Structure

- **origin**: `https://github.com/pelian/open-webui.git` (your fork)
- **upstream**: `https://github.com/open-webui/open-webui.git` (official repo)

---

## Multi-Environment Deployment Strategy

Open WebUI can run on multiple environments while maintaining a consistent experience:

| Environment | Purpose | Network |
|-------------|---------|---------|
| **MacBook** | Development | Local |
| **RTX 3090** | Edge/LAN services | Home LAN |
| **Cloud** | Remote/Away access | Internet |

### Architecture: Shared PostgreSQL Database (Recommended)

All instances connect to a single PostgreSQL database for synchronized state:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   MacBook   │     │  RTX 3090   │     │    Cloud    │
│  (dev/test) │     │  (primary)  │     │  (remote)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL  │
                    │  (Supabase/  │
                    │   Neon/etc)  │
                    └─────────────┘
```

**Pros**: Real-time sync, users/settings shared automatically
**Cons**: Requires internet, external DB service

### Alternative: SQLite with Periodic Export

For offline-first or development:
```bash
# Export database from running instance
docker cp pelian-open-webui:/app/backend/data/webui.db ./webui-backup.db

# Import to another instance
docker cp ./webui-backup.db pelian-open-webui:/app/backend/data/webui.db
docker restart pelian-open-webui
```

---

## Data Persistence

### What's in the Database (`webui.db`)

| Table | Contents | Sync Priority |
|-------|----------|---------------|
| `user` | User accounts (Joseph, Jia) | **Critical** |
| `auth` | Password hashes, tokens | **Critical** |
| `config` | UI settings, TTS config | High |
| `function` | Pipe, Action, Filter functions | High |
| `chat` | Conversation history | Medium |
| `file` | Uploaded files metadata | Medium |
| `knowledge` | RAG knowledge bases | Medium |

### Critical Environment Variables

```bash
# Database (for multi-instance sync)
DATABASE_URL=postgresql://user:pass@host:5432/openwebui

# Authentication (MUST be same across all instances!)
WEBUI_SECRET_KEY=your-consistent-secret-key-here

# Aiden Services
OLLAMA_BASE_URL=http://gits-gateway:8080       # GITS Gateway (LLM inference)
AIDEN_API_BASE_URL=http://aiden-api:8000       # Jobs API
```

### TTS Configuration (stored in database)

Currently configured in Admin Settings > Audio > TTS:
- **Engine**: OpenAI-compatible
- **API Base URL**: `http://spark-99b5:8800/v1`
- **Model**: `lumi-default`
- **Voice**: `af_heart`

---

## Aiden Service Integration

### 1. GITS Gateway (LLM Inference)
Routes requests through the cascading inference tier:
```bash
OLLAMA_BASE_URL=http://localhost:8080  # or gateway host
```

### 2. Jobs API
Backend for job management (AIP-19):
```bash
AIDEN_API_BASE_URL=http://localhost:8000
```

### 3. TTS Gateway
Text-to-speech via Kokoro (configured in UI, stored in DB):
- Navigate to: Admin Settings > Audio > Text-to-Speech
- Set API Base URL to TTS Gateway endpoint

---

## Aiden Customizations

### Jobs Sidebar (AIP-19)
Adds job management UI to the sidebar:

| File | Purpose |
|------|---------|
| `src/lib/apis/jobs/index.ts` | Jobs API client |
| `src/lib/components/jobs/*.svelte` | Jobs UI components |
| `src/lib/components/icons/Briefcase.svelte` | Sidebar icon |
| `src/lib/components/layout/Sidebar.svelte` | Modified to add Jobs button |
| `src/lib/constants.ts` | Added `AIDEN_API_BASE_URL` |
| `src/routes/(app)/jobs/**` | Jobs pages |
| `docker-compose.aiden.yaml` | Aiden deployment config |

---

## Syncing with Upstream

### Automated Sync (Recommended)

Use the sync script for safe, automated upgrades:

```bash
# Sync to a specific version (e.g., v0.7.2)
./scripts/sync-upstream.sh v0.7.2

# Sync to latest upstream/main
./scripts/sync-upstream.sh
```

The script will:
1. Create a backup branch before making changes
2. Fetch upstream and merge the target version
3. Auto-resolve conflicts using our customization strategy
4. Verify Pelian customizations survived the merge
5. Provide rollback instructions if something goes wrong

### Manual Sync Process

If you prefer manual control:

```bash
# 1. Fetch upstream changes
git fetch upstream --tags

# 2. Check what's new
git log HEAD..upstream/main --oneline | head -20
git log HEAD..v0.7.2 --oneline | head -20  # For specific version

# 3. Create backup branch
git branch backup/pre-sync-$(date +%Y%m%d)

# 4. Merge the target
git merge v0.7.2  # or upstream/main

# 5. Resolve conflicts (see strategy below)

# 6. Push to fork
git push origin main
```

### Conflict Resolution Strategy

| File Category | Strategy | Reason |
|--------------|----------|--------|
| **Pelian-only files** | Keep OURS | Jobs, RTVI, Aiden configs |
| **Modified core files** | Keep OURS, manually merge features | constants.ts, main.py |
| **UI components** | Accept THEIRS, re-add our hooks | Sidebar.svelte |
| **Dependencies** | Accept THEIRS, verify compat | package.json |
| **Unmodified files** | Accept THEIRS | Upstream improvements |

#### Files to Watch During Merge

| File | Our Customization | Action |
|------|-------------------|--------|
| `src/lib/constants.ts` | `AIDEN_API_BASE_URL` | Ensure constant is preserved |
| `src/lib/stores/index.ts` | `jobs` store export | Ensure export is preserved |
| `src/lib/components/layout/Sidebar.svelte` | Jobs button | Re-add Jobs NavItem if lost |
| `backend/open_webui/main.py` | Aiden router import | Ensure `from .routers import aiden` preserved |
| `package.json` | `realtime-ai` dependency | Ensure RTVI deps preserved |

### Post-Merge Verification

```bash
# 1. Check critical files exist
ls -la src/lib/apis/jobs/
ls -la src/lib/components/jobs/
ls -la backend/open_webui/routers/aiden.py

# 2. Verify customizations
grep -n "AIDEN_API_BASE_URL" src/lib/constants.ts
grep -n "jobs" src/lib/components/layout/Sidebar.svelte
grep -n "aiden" backend/open_webui/main.py

# 3. Test the build
npm run build

# 4. Test Docker build
docker build -t pelian-open-webui:test .
```

### Rollback if Something Breaks

```bash
# Find backup branch
git branch | grep backup/

# Hard reset to backup
git reset --hard backup/pre-sync-YYYYMMDD

# Or restore specific files
git checkout backup/pre-sync-YYYYMMDD -- src/lib/constants.ts
```

---

## Building Docker Image

```bash
# Build from this directory
docker build -t pelian-open-webui:latest .

# Or use docker-compose
docker-compose -f docker-compose.aiden.yaml up -d
```

---

## Deployment Workflow

### Development (MacBook)
```bash
cd ~/dev/pelian-open-webui
git pull origin main
docker-compose -f docker-compose.aiden.yaml up -d
```

### Production (RTX 3090 / Cloud)
```bash
cd /opt/pelian-open-webui
git pull origin main
docker build -t pelian-open-webui:latest .
docker-compose -f docker-compose.aiden.yaml up -d
```

### User Management
Users are stored in the database. For multi-instance deployment:
1. Use shared PostgreSQL (recommended)
2. Or export/import the SQLite database between instances

Current users:
- `joseph@pelian.com` (admin)
- `jia@pelian.com` (user)
