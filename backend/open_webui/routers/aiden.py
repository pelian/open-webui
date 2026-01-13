"""
Aiden API Proxy Router (AIP-19: Jobs Integration)

This router proxies requests to the Aiden backend API, handling:
- CORS issues (browser can't directly call Aiden API on different port)
- Authentication forwarding
- Environment-based URL configuration

The actual Aiden API endpoint is configured via AIDEN_API_BASE_URL environment variable.
"""

import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from open_webui.utils.auth import get_current_user

log = logging.getLogger(__name__)

router = APIRouter()

# Aiden API base URL - configurable via environment
AIDEN_API_BASE_URL = os.environ.get("AIDEN_API_BASE_URL", "http://localhost:8000")


async def proxy_request(
    request: Request,
    path: str,
    method: str = "GET",
    user: dict = None,
) -> Response:
    """
    Proxy a request to the Aiden API backend.
    """
    url = f"{AIDEN_API_BASE_URL}/{path}"

    # Forward headers, adding user context
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)

    # Add user identity for Aiden backend
    if user:
        headers["X-User-Id"] = user.id
        headers["X-User-Email"] = user.email or ""
        headers["X-User-Name"] = user.name or ""
        headers["X-User-Role"] = user.role or "user"

    # Get request body if present
    body = None
    if method in ("POST", "PUT", "PATCH"):
        body = await request.body()

    # Forward query params
    params = dict(request.query_params)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                content=body,
            )

            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type"),
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Aiden API timeout")
    except httpx.RequestError as e:
        log.error(f"Aiden API request error: {e}")
        raise HTTPException(status_code=502, detail=f"Aiden API unavailable: {str(e)}")


# ============================================================================
# Jobs API Proxy Routes
# ============================================================================

@router.get("/jobs")
async def list_jobs(request: Request, user=Depends(get_current_user)):
    """List all jobs for the current user."""
    return await proxy_request(request, "jobs", "GET", user)


@router.post("/jobs")
async def create_job(request: Request, user=Depends(get_current_user)):
    """Create a new job."""
    return await proxy_request(request, "jobs", "POST", user)


@router.get("/jobs/{job_id}")
async def get_job(request: Request, job_id: str, user=Depends(get_current_user)):
    """Get a specific job by ID."""
    return await proxy_request(request, f"jobs/{job_id}", "GET", user)


@router.get("/jobs/{job_id}/status")
async def get_job_status(request: Request, job_id: str, user=Depends(get_current_user)):
    """Get job status."""
    return await proxy_request(request, f"jobs/{job_id}/status", "GET", user)


@router.patch("/jobs/{job_id}")
async def update_job(request: Request, job_id: str, user=Depends(get_current_user)):
    """Update a job."""
    return await proxy_request(request, f"jobs/{job_id}", "PATCH", user)


@router.delete("/jobs/{job_id}")
async def delete_job(request: Request, job_id: str, user=Depends(get_current_user)):
    """Delete a job."""
    return await proxy_request(request, f"jobs/{job_id}", "DELETE", user)


@router.post("/jobs/{job_id}/pause")
async def pause_job(request: Request, job_id: str, user=Depends(get_current_user)):
    """Pause a job."""
    return await proxy_request(request, f"jobs/{job_id}/pause", "POST", user)


@router.post("/jobs/{job_id}/resume")
async def resume_job(request: Request, job_id: str, user=Depends(get_current_user)):
    """Resume a paused job."""
    return await proxy_request(request, f"jobs/{job_id}/resume", "POST", user)


# ============================================================================
# Conversation-Job Binding
# ============================================================================

@router.get("/jobs/conversation/{conversation_id}")
async def get_job_for_conversation(
    request: Request, conversation_id: str, user=Depends(get_current_user)
):
    """Get the job attached to a conversation."""
    return await proxy_request(request, f"jobs/conversation/{conversation_id}", "GET", user)


@router.post("/jobs/conversation/{conversation_id}/attach")
async def attach_job_to_conversation(
    request: Request, conversation_id: str, user=Depends(get_current_user)
):
    """Attach a job to a conversation."""
    return await proxy_request(request, f"jobs/conversation/{conversation_id}/attach", "POST", user)


# ============================================================================
# Orientation Hierarchy (Directives, Missions, Mandates)
# ============================================================================

@router.get("/jobs/orientation/directives/{directive_id}")
async def get_directive(
    request: Request, directive_id: str, user=Depends(get_current_user)
):
    """Get a directive."""
    return await proxy_request(request, f"jobs/orientation/directives/{directive_id}", "GET", user)


@router.patch("/jobs/orientation/directives/{directive_id}")
async def update_directive(
    request: Request, directive_id: str, user=Depends(get_current_user)
):
    """Update a directive."""
    return await proxy_request(request, f"jobs/orientation/directives/{directive_id}", "PATCH", user)


@router.get("/jobs/orientation/missions/{mission_id}")
async def get_mission(
    request: Request, mission_id: str, user=Depends(get_current_user)
):
    """Get a mission."""
    return await proxy_request(request, f"jobs/orientation/missions/{mission_id}", "GET", user)


@router.get("/jobs/orientation/mandates/{mandate_id}")
async def get_mandate(
    request: Request, mandate_id: str, user=Depends(get_current_user)
):
    """Get a mandate."""
    return await proxy_request(request, f"jobs/orientation/mandates/{mandate_id}", "GET", user)


# ============================================================================
# Governance (Admin-only in future)
# ============================================================================

@router.get("/jobs/governance/proposals")
async def list_proposals(request: Request, user=Depends(get_current_user)):
    """List governance proposals."""
    return await proxy_request(request, "jobs/governance/proposals", "GET", user)


@router.get("/jobs/governance/pending-count")
async def get_pending_count(request: Request, user=Depends(get_current_user)):
    """Get count of pending governance proposals."""
    return await proxy_request(request, "jobs/governance/pending-count", "GET", user)


@router.post("/jobs/governance/proposals/{proposal_id}/approve")
async def approve_proposal(
    request: Request, proposal_id: str, user=Depends(get_current_user)
):
    """Approve a governance proposal."""
    return await proxy_request(request, f"jobs/governance/proposals/{proposal_id}/approve", "POST", user)


@router.post("/jobs/governance/proposals/{proposal_id}/reject")
async def reject_proposal(
    request: Request, proposal_id: str, user=Depends(get_current_user)
):
    """Reject a governance proposal."""
    return await proxy_request(request, f"jobs/governance/proposals/{proposal_id}/reject", "POST", user)


# ============================================================================
# Pelian Auto-Update System
# ============================================================================

import subprocess
import asyncio
from datetime import datetime


@router.get("/pelian/version")
async def get_pelian_version_status(user=Depends(get_current_user)):
    """
    Get Pelian fork version status.

    Returns current version, upstream latest, and commits behind.
    Admin-only endpoint.
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # Get current version from package.json or VERSION file
        from open_webui.config import VERSION
        current_version = VERSION

        # Check upstream releases via GitHub API
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Get latest upstream release
            response = await client.get(
                "https://api.github.com/repos/open-webui/open-webui/releases/latest"
            )
            if response.status_code == 200:
                data = response.json()
                latest_upstream = data.get("tag_name", "").lstrip("v")
                release_url = data.get("html_url", "")
                release_date = data.get("published_at", "")
            else:
                latest_upstream = current_version
                release_url = ""
                release_date = ""

        # Check git status if running from git repo
        commits_behind = 0
        commits_ahead = 0
        git_available = False

        try:
            # Try to get git status from the repo
            result = subprocess.run(
                ["git", "fetch", "upstream", "--tags"],
                capture_output=True,
                timeout=10,
                cwd="/app"  # Typical Docker mount point
            )

            # Count commits behind upstream
            result = subprocess.run(
                ["git", "rev-list", "--count", f"HEAD..upstream/main"],
                capture_output=True,
                text=True,
                timeout=5,
                cwd="/app"
            )
            if result.returncode == 0:
                commits_behind = int(result.stdout.strip())
                git_available = True

            # Count commits ahead (our customizations)
            result = subprocess.run(
                ["git", "rev-list", "--count", f"upstream/main..HEAD"],
                capture_output=True,
                text=True,
                timeout=5,
                cwd="/app"
            )
            if result.returncode == 0:
                commits_ahead = int(result.stdout.strip())

        except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
            log.debug(f"Git status check failed: {e}")

        return {
            "current_version": current_version,
            "latest_upstream": latest_upstream,
            "release_url": release_url,
            "release_date": release_date,
            "commits_behind": commits_behind,
            "commits_ahead": commits_ahead,
            "update_available": latest_upstream != current_version,
            "git_available": git_available,
            "fork": "pelian",
            "checked_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        log.error(f"Version check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Version check failed: {str(e)}")


@router.post("/pelian/update/prepare")
async def prepare_pelian_update(
    request: Request,
    user=Depends(get_current_user),
    target_version: Optional[str] = None,
):
    """
    Prepare a Pelian update by merging upstream changes.

    This endpoint triggers the sync-upstream.sh script to merge
    upstream changes into the Pelian fork. After preparation,
    the Docker image needs to be rebuilt.

    Admin-only endpoint.

    Args:
        target_version: Specific version to sync to (e.g., "v0.7.2").
                       If not specified, syncs to latest upstream/main.
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # Determine target
        target = target_version or "upstream/main"

        # Run the sync script
        # Note: This assumes the script is available in the container or via mounted volume
        script_path = "/app/scripts/sync-upstream.sh"

        result = subprocess.run(
            [script_path, target],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd="/app"
        )

        if result.returncode == 0:
            return {
                "status": "success",
                "message": f"Successfully prepared update to {target}",
                "output": result.stdout,
                "next_steps": [
                    "Review the changes: git diff backup/pre-sync-*",
                    "Rebuild Docker image: docker build -t pelian-open-webui:latest .",
                    "Restart container: docker compose -f docker-compose.aiden.yaml up -d",
                ],
            }
        else:
            return {
                "status": "error",
                "message": "Update preparation failed",
                "output": result.stdout,
                "error": result.stderr,
                "rollback": "If issues occurred, rollback with: git reset --hard backup/pre-sync-*",
            }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Update preparation timed out. Check server logs."
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Sync script not found. Ensure scripts/sync-upstream.sh exists."
        )
    except Exception as e:
        log.error(f"Update preparation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


@router.post("/pelian/update/rebuild")
async def trigger_pelian_rebuild(user=Depends(get_current_user)):
    """
    Trigger a Docker rebuild webhook (if configured).

    This is an optional endpoint that can trigger an external
    webhook to rebuild and redeploy the container.

    Admin-only endpoint.
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    webhook_url = os.environ.get("PELIAN_REBUILD_WEBHOOK_URL")
    webhook_secret = os.environ.get("PELIAN_REBUILD_WEBHOOK_SECRET", "")

    if not webhook_url:
        return {
            "status": "not_configured",
            "message": "Rebuild webhook not configured",
            "manual_steps": [
                "SSH to host: ssh aiden",
                "Navigate to repo: cd ~/dev/pelian-open-webui",
                "Rebuild: docker build -t pelian-open-webui:latest .",
                "Restart: docker compose -f docker-compose.aiden.yaml up -d",
            ],
        }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook_url,
                headers={"X-Webhook-Secret": webhook_secret},
                json={"action": "rebuild", "source": "pelian-admin"},
            )

            if response.status_code == 200:
                return {
                    "status": "triggered",
                    "message": "Rebuild webhook triggered successfully",
                    "webhook_response": response.text,
                }
            else:
                return {
                    "status": "error",
                    "message": f"Webhook returned {response.status_code}",
                    "webhook_response": response.text,
                }

    except Exception as e:
        log.error(f"Rebuild webhook failed: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook failed: {str(e)}")
