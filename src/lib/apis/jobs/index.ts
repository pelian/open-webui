/**
 * Jobs API client for Aiden backend integration (AIP-19)
 */

import { AIDEN_API_BASE_URL } from '$lib/constants';

export interface JobConversation {
	id: string;
	title: string | null;
	last_message_at: string | null;
	message_count: number;
}

export interface Job {
	job_id: string;
	name: string;
	summary: string | null;
	status: string;
	state: string;
	owner_subject_id: string | null;
	owner_name: string | null;
	persona_id: string | null;
	workspace_id: string | null;
	autonomy_level: string;
	progress: number;
	current_step: string | null;
	created_at: string;
	updated_at: string;
	orientation_chips: OrientationChip[];
	conversations?: JobConversation[];
	tags?: string[];
	archived?: boolean;
	archived_at?: string | null;
}

export interface OrientationChip {
	type: 'directive' | 'mission' | 'mandate';
	id: string;
	label: string;
}

export interface JobListItem {
	job_id: string;
	name: string;
	status: string;
	summary?: string | null;
	owner_subject_id: string | null;
	owner_name: string | null;
	progress: number;
	last_activity: string;
	orientation_chips: OrientationChip[];
	tags?: string[];
	archived?: boolean;
	starred?: boolean;
	pending_decisions_count?: number;
}

export interface JobListResponse {
	jobs: JobListItem[];
	total: number;
	limit: number;
	offset: number;
}

export interface JobStatusResponse {
	job_id: string;
	status: string;
	state: string;
	progress: number;
	current_step: string | null;
	waiting_for: string | null;
}

export interface CreateJobRequest {
	name: string;
	goal: string;
	workspace_ref?: string;
	team_ref?: string;
	persona_hint?: string;
	autonomy_level?: string;
	visibility?: string;
	conversation_id?: string;
	owner_user_id?: string;
}

export interface PendingDecision {
	id: string;
	question: string;
	options: string[];
	context: string | null;
	created_at: string;
}

export interface DecisionHistoryItem {
	id: string;
	question: string;
	response: string;
	rationale: string | null;
	created_at: string;
	resolved_at: string;
}

export interface JobDecisionsResponse {
	pending: PendingDecision[];
	history: DecisionHistoryItem[];
}

export interface CollaboratorInfo {
	user_id: string;
	role: string;
	name?: string;
	email?: string;
}

export interface JobCollaboratorsResponse {
	owner: string | null;
	collaborators: CollaboratorInfo[];
}

export interface ActivityItem {
	timestamp: string;
	action: string;
	description: string;
}

export interface JobActivityResponse {
	activities: ActivityItem[];
	total: number;
}

export interface DirectiveDetail {
	id: string;
	label: string;
	description: string;
	mission_id: string | null;
	domains: string[];
	status: string;
	priority: number;
	persona_scope: string[] | null;
	autonomy_hint: string;
	scope: string;
	workspace_id: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface MissionDetail {
	id: string;
	label: string;
	description: string;
	mandate_ids: string[];
	status: string;
	priority: number;
	persona_weights: Record<string, number>;
	tags: string[];
	created_at?: string;
	updated_at?: string;
}

export interface MandateDetail {
	id: string;
	label: string;
	description: string;
	priority: number;
	status: string;
	domains: string[];
	created_at?: string;
	updated_at?: string;
}

// Type aliases for cleaner component imports
export type Directive = DirectiveDetail;
export type Mission = MissionDetail;
export type Mandate = MandateDetail;

export interface ConversationJobResponse {
	job_id: string | null;
	name: string | null;
	status: string | null;
	attached: boolean;
}

/**
 * List jobs with optional filters
 */
export async function getJobs(
	token: string,
	params: {
		status?: string;
		owner?: string;
		workspace?: string;
		visibility?: string;
		archived?: string;
		search?: string;
		sort?: string;
		limit?: number;
		offset?: number;
	} = {}
): Promise<JobListResponse> {
	const searchParams = new URLSearchParams();
	if (params.status) searchParams.set('status', params.status);
	if (params.owner) searchParams.set('owner', params.owner);
	if (params.workspace) searchParams.set('workspace', params.workspace);
	if (params.visibility) searchParams.set('visibility', params.visibility);
	if (params.archived) searchParams.set('archived', params.archived);
	if (params.search) searchParams.set('search', params.search);
	if (params.sort) searchParams.set('sort', params.sort);
	if (params.limit) searchParams.set('limit', params.limit.toString());
	if (params.offset) searchParams.set('offset', params.offset.toString());

	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs?${searchParams.toString()}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch jobs: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get job details by ID
 */
export async function getJob(token: string, jobId: string): Promise<Job> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch job: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get lightweight job status (for polling)
 */
export async function getJobStatus(token: string, jobId: string): Promise<JobStatusResponse> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/status`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch job status: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Create a new job
 */
export async function createJob(token: string, request: CreateJobRequest): Promise<Job> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(request)
	});

	if (!response.ok) {
		throw new Error(`Failed to create job: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Update job properties
 */
export async function updateJob(
	token: string,
	jobId: string,
	updates: Partial<{ name: string; summary: string; status: string }>
): Promise<Job> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(updates)
	});

	if (!response.ok) {
		throw new Error(`Failed to update job: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Cancel a job (marks as cancelled but keeps in history)
 */
export async function cancelJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to cancel job: ${response.statusText}`);
	}
}

/**
 * Move a job to trash (soft delete)
 * Jobs in trash can be restored or permanently deleted.
 */
export async function removeJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/trash`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ detail: response.statusText }));
		throw new Error(error.detail || `Failed to trash job: ${response.statusText}`);
	}
}

/**
 * Restore a job from trash
 */
export async function restoreJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/restore`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ detail: response.statusText }));
		throw new Error(error.detail || `Failed to restore job: ${response.statusText}`);
	}
}

/**
 * Permanently delete a job (irreversible)
 * Admin only for hard_delete=true
 */
export async function permanentlyDeleteJob(token: string, jobId: string, hardDelete: boolean = false): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/permanent?hard_delete=${hardDelete}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ detail: response.statusText }));
		throw new Error(error.detail || `Failed to delete job: ${response.statusText}`);
	}
}

/**
 * Pause a running job
 */
export async function pauseJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/pause`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to pause job: ${response.statusText}`);
	}
}

/**
 * Resume a paused job
 */
export async function resumeJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/resume`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to resume job: ${response.statusText}`);
	}
}

/**
 * Start a queued job
 */
export async function startJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/start`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to start job: ${response.statusText}`);
	}
}

/**
 * Archive a job
 */
export async function archiveJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/archive`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to archive job: ${response.statusText}`);
	}
}

/**
 * Unarchive a job
 */
export async function unarchiveJob(token: string, jobId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/unarchive`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to unarchive job: ${response.statusText}`);
	}
}

/**
 * Get directive details (read-only)
 */
export async function getDirective(token: string, directiveId: string): Promise<DirectiveDetail> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/orientation/directives/${directiveId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch directive: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get mission details (read-only)
 */
export async function getMission(token: string, missionId: string): Promise<MissionDetail> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/orientation/missions/${missionId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch mission: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get mandate details (read-only)
 */
export async function getMandate(token: string, mandateId: string): Promise<MandateDetail> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/orientation/mandates/${mandateId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch mandate: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get job attached to a conversation
 */
export async function getJobForConversation(
	token: string,
	conversationId: string
): Promise<ConversationJobResponse> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/conversation/${conversationId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch conversation job: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Attach a conversation to a job
 */
export async function attachConversationToJob(
	token: string,
	conversationId: string,
	jobId: string
): Promise<ConversationJobResponse> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/conversation/${conversationId}/attach`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ job_id: jobId })
	});

	if (!response.ok) {
		throw new Error(`Failed to attach conversation to job: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Update job autonomy level
 */
export async function updateAutonomy(
	token: string,
	jobId: string,
	autonomyLevel: 'supervised' | 'guided' | 'autonomous'
): Promise<Job> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/autonomy`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ autonomy_level: autonomyLevel })
	});

	if (!response.ok) {
		throw new Error(`Failed to update autonomy: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get job collaborators
 */
export async function getCollaborators(
	token: string,
	jobId: string
): Promise<JobCollaboratorsResponse> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/collaborators`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to get collaborators: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Add a collaborator to a job
 */
export async function addCollaborator(
	token: string,
	jobId: string,
	userId: string,
	role: string = 'viewer'
): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/collaborators`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ user_id: userId, role })
	});

	if (!response.ok) {
		throw new Error(`Failed to add collaborator: ${response.statusText}`);
	}
}

/**
 * Remove a collaborator from a job
 */
export async function removeCollaborator(
	token: string,
	jobId: string,
	userId: string
): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/collaborators/${userId}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to remove collaborator: ${response.statusText}`);
	}
}

/**
 * Request a decision from the user (creates a pending decision)
 */
export async function requestDecision(
	token: string,
	jobId: string,
	question: string,
	options: string[] = [],
	context?: string
): Promise<{ decision_id: string; message: string }> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/decisions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ question, options, context })
	});

	if (!response.ok) {
		throw new Error(`Failed to request decision: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get pending and completed decisions for a job
 */
export async function getDecisions(
	token: string,
	jobId: string
): Promise<JobDecisionsResponse> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/decisions`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to get decisions: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Submit a decision response
 */
export async function submitDecision(
	token: string,
	jobId: string,
	decisionId: string,
	response: string,
	rationale?: string
): Promise<{ message: string; remaining: number }> {
	const res = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/decisions/${decisionId}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ response, rationale })
	});

	if (!res.ok) {
		throw new Error(`Failed to submit decision: ${res.statusText}`);
	}

	return res.json();
}

/**
 * Get activity log for a job
 */
export async function getActivity(
	token: string,
	jobId: string,
	limit: number = 50
): Promise<JobActivityResponse> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/activity?limit=${limit}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to get activity: ${response.statusText}`);
	}

	return response.json();
}

// ============== Job Files ==============

export interface JobFile {
	id: string;
	filename: string;
	size: number;
	content_type: string;
	uploaded_at: string;
	url?: string;  // URL for downloading/previewing the file
}

export interface JobFilesResponse {
	files: JobFile[];
}

/**
 * Get files attached to a job
 */
export async function getJobFiles(token: string, jobId: string): Promise<JobFilesResponse> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/files`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to get job files: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Upload a file to a job
 */
export async function uploadJobFile(token: string, jobId: string, file: File): Promise<JobFile> {
	const formData = new FormData();
	formData.append('file', file);

	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/files`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`
		},
		body: formData
	});

	if (!response.ok) {
		throw new Error(`Failed to upload file: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Delete a file from a job
 */
export async function deleteJobFile(token: string, jobId: string, fileId: string): Promise<void> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/jobs/${jobId}/files/${fileId}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to delete file: ${response.statusText}`);
	}
}


// ============================================================================
// Pelian Update System
// ============================================================================

export interface PelianVersionStatus {
	current_version: string;
	latest_upstream: string;
	release_url: string;
	release_date: string;
	commits_behind: number;
	commits_ahead: number;
	update_available: boolean;
	git_available: boolean;
	fork: string;
	checked_at: string;
}

export interface PelianUpdateResult {
	status: 'success' | 'error' | 'not_configured' | 'triggered';
	message: string;
	output?: string;
	error?: string;
	next_steps?: string[];
	manual_steps?: string[];
	rollback?: string;
	webhook_response?: string;
}

/**
 * Get Pelian fork version status
 */
export async function getPelianVersionStatus(token: string): Promise<PelianVersionStatus> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/pelian/version`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to get version status: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Prepare a Pelian update by merging upstream changes
 */
export async function preparePelianUpdate(
	token: string,
	targetVersion?: string
): Promise<PelianUpdateResult> {
	const url = new URL(`${AIDEN_API_BASE_URL}/pelian/update/prepare`);
	if (targetVersion) {
		url.searchParams.set('target_version', targetVersion);
	}

	const response = await fetch(url.toString(), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to prepare update: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Trigger a Docker rebuild (if webhook is configured)
 */
export async function triggerPelianRebuild(token: string): Promise<PelianUpdateResult> {
	const response = await fetch(`${AIDEN_API_BASE_URL}/pelian/update/rebuild`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to trigger rebuild: ${response.statusText}`);
	}

	return response.json();
}
