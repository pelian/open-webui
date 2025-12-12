# Pelian Open WebUI Fork Maintenance

This is a fork of [Open WebUI](https://github.com/open-webui/open-webui) with Aiden-specific customizations.

## Repository Structure

- **origin**: `https://github.com/pelian/open-webui.git` (your fork)
- **upstream**: `https://github.com/open-webui/open-webui.git` (official repo)

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

## Building Docker Image

```bash
# Build from this directory
docker build -t pelian-open-webui:latest .

# Or use docker-compose
docker-compose -f docker-compose.aiden.yaml up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AIDEN_API_BASE_URL` | Aiden backend URL | `http://localhost:8000` |
| `WEBUI_AUTH` | Enable authentication | `true` |
| `OLLAMA_BASE_URL` | Ollama/vLLM endpoint | - |

## Deployment

The Docker container running on DGX Spark uses this build:
- Container ID: `58a0dcaae1b2...`
- Image built from: `pelian-open-webui:latest`

To update the deployed instance:
```bash
# On DGX Spark
cd /path/to/pelian-open-webui
git pull origin main
docker build -t pelian-open-webui:latest .
docker-compose -f docker-compose.aiden.yaml up -d
```
