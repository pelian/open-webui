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
