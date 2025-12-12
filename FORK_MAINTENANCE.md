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

### 1. Fetch upstream changes
```bash
git fetch upstream
```

### 2. Check what's new
```bash
git log main..upstream/main --oneline
```

### 3. Merge or rebase
```bash
# Option A: Merge (preserves history, creates merge commit)
git merge upstream/main

# Option B: Rebase (cleaner history, may require conflict resolution)
git rebase upstream/main
```

### 4. Resolve conflicts
If conflicts occur in customized files:
- `src/lib/components/layout/Sidebar.svelte` - Re-add Jobs button
- `src/lib/constants.ts` - Re-add `AIDEN_API_BASE_URL`

### 5. Push to fork
```bash
git push origin main
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
