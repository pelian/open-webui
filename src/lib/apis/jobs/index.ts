/**
 * Jobs API client for Aiden backend integration (AIP-19)
 */

import { AIDEN_API_BASE_URL } from '$lib/constants';

export interface Job {
	job_id: string;
	name: string;
	summary: string | null;
	status: string;
	state: string;
	owner_subject_id: string | null;
	persona_id: string | null;
	workspace_id: string | null;
	autonomy_level: string;
	progress: number;
	current_step: string | null;
	created_at: string;
	updated_at: string;
	orientation_chips: OrientationChip[];
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
	owner_subject_id: string | null;
	persona_id: string | null;
	progress: number;
	last_activity: string;
	orientation_chips: OrientationChip[];
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
	conversation_id?: string;
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
		limit?: number;
		offset?: number;
	} = {}
): Promise<JobListResponse> {
	const searchParams = new URLSearchParams();
	if (params.status) searchParams.set('status', params.status);
	if (params.owner) searchParams.set('owner', params.owner);
	if (params.workspace) searchParams.set('workspace', params.workspace);
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
	updates: Partial<{ name: string; status: string }>
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
 * Cancel a job
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
