<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getJob,
		getJobStatus,
		pauseJob,
		resumeJob,
		cancelJob,
		type Job,
		type JobStatusResponse
	} from '$lib/apis/jobs';
	import { toast } from 'svelte-sonner';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import JobStatusBadge from './JobStatusBadge.svelte';
	import OrientationBreadcrumb from './OrientationBreadcrumb.svelte';
	import OrientationPanel from './OrientationPanel.svelte';

	const i18n = getContext('i18n');

	export let jobId: string;

	let job: Job | null = null;
	let loading = true;
	let error: string | null = null;

	// Status polling
	let statusPollInterval: ReturnType<typeof setInterval> | null = null;
	let currentStatus: JobStatusResponse | null = null;

	// Orientation panel
	let showOrientationPanel = false;
	let selectedOrientation: { type: 'directive' | 'mission' | 'mandate'; id: string } | null = null;

	async function loadJob() {
		loading = true;
		error = null;

		try {
			job = await getJob(localStorage.token, jobId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load job';
			console.error('Failed to load job:', e);
		} finally {
			loading = false;
		}
	}

	async function pollStatus() {
		if (!job) return;

		try {
			currentStatus = await getJobStatus(localStorage.token, jobId);

			// Update job status from poll
			if (job && currentStatus) {
				job.status = currentStatus.status;
				job.state = currentStatus.state;
				job.progress = currentStatus.progress;
				job.current_step = currentStatus.current_step;
			}

			// Stop polling if job is in terminal state
			if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(currentStatus.status.toUpperCase())) {
				stopPolling();
			}
		} catch (e) {
			console.error('Failed to poll status:', e);
		}
	}

	function startPolling() {
		if (statusPollInterval) return;
		statusPollInterval = setInterval(pollStatus, 3000);
	}

	function stopPolling() {
		if (statusPollInterval) {
			clearInterval(statusPollInterval);
			statusPollInterval = null;
		}
	}

	async function handlePause() {
		try {
			await pauseJob(localStorage.token, jobId);
			toast.success($i18n.t('Job paused'));
			await loadJob();
		} catch (e) {
			toast.error($i18n.t('Failed to pause job'));
		}
	}

	async function handleResume() {
		try {
			await resumeJob(localStorage.token, jobId);
			toast.success($i18n.t('Job resumed'));
			await loadJob();
			startPolling();
		} catch (e) {
			toast.error($i18n.t('Failed to resume job'));
		}
	}

	async function handleCancel() {
		if (!confirm($i18n.t('Are you sure you want to cancel this job?'))) return;

		try {
			await cancelJob(localStorage.token, jobId);
			toast.success($i18n.t('Job cancelled'));
			await loadJob();
		} catch (e) {
			toast.error($i18n.t('Failed to cancel job'));
		}
	}

	function handleOrientationClick(event: CustomEvent<{ type: string; id: string }>) {
		const { type, id } = event.detail;
		selectedOrientation = { type: type as 'directive' | 'mission' | 'mandate', id };
		showOrientationPanel = true;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	onMount(async () => {
		await loadJob();

		// Start polling if job is active
		if (job && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status.toUpperCase())) {
			startPolling();
		}
	});

	onDestroy(() => {
		stopPolling();
	});
</script>

<div class="flex h-full">
	<!-- Main Content -->
	<div class="flex-1 flex flex-col overflow-hidden">
		{#if loading}
			<div class="flex items-center justify-center h-full">
				<Spinner className="size-6" />
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
				<p class="text-sm">{error}</p>
				<button
					class="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
					on:click={loadJob}
				>
					{$i18n.t('Try again')}
				</button>
			</div>
		{:else if job}
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-3 mb-2">
							<button
								class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
								on:click={() => goto('/jobs')}
							>
								<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>
							<h1 class="text-xl font-semibold text-gray-900 dark:text-white truncate">
								{job.name}
							</h1>
							<JobStatusBadge status={job.status} size="md" />
						</div>

						<!-- Orientation Breadcrumb -->
						{#if job.orientation_chips && job.orientation_chips.length > 0}
							<OrientationBreadcrumb
								chips={job.orientation_chips}
								on:click={handleOrientationClick}
							/>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2">
						{#if job.status.toUpperCase() === 'RUNNING'}
							<button
								class="px-3 py-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
								on:click={handlePause}
							>
								{$i18n.t('Pause')}
							</button>
						{:else if job.status.toUpperCase() === 'PAUSED'}
							<button
								class="px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
								on:click={handleResume}
							>
								{$i18n.t('Resume')}
							</button>
						{/if}

						{#if !['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status.toUpperCase())}
							<button
								class="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
								on:click={handleCancel}
							>
								{$i18n.t('Cancel')}
							</button>
						{/if}
					</div>
				</div>

				<!-- Progress Bar -->
				{#if job.progress > 0 && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status.toUpperCase())}
					<div class="mt-3">
						<div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
							<span>{job.current_step || $i18n.t('In progress')}</span>
							<span>{job.progress}%</span>
						</div>
						<div class="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
							<div
								class="h-full bg-blue-500 transition-all duration-300"
								style="width: {job.progress}%"
							></div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Job Content -->
			<div class="flex-1 overflow-y-auto p-6">
				<!-- Summary -->
				{#if job.summary}
					<div class="mb-6">
						<h2 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
							{$i18n.t('Summary')}
						</h2>
						<p class="text-gray-900 dark:text-white">{job.summary}</p>
					</div>
				{/if}

				<!-- Metadata -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<div>
						<div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
							{$i18n.t('Owner')}
						</div>
						<div class="text-sm text-gray-900 dark:text-white">
							{job.owner_subject_id || '-'}
						</div>
					</div>
					<div>
						<div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
							{$i18n.t('Persona')}
						</div>
						<div class="text-sm text-gray-900 dark:text-white">
							{job.persona_id || 'aiden'}
						</div>
					</div>
					<div>
						<div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
							{$i18n.t('Autonomy')}
						</div>
						<div class="text-sm text-gray-900 dark:text-white capitalize">
							{job.autonomy_level || 'L1'}
						</div>
					</div>
					<div>
						<div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
							{$i18n.t('Workspace')}
						</div>
						<div class="text-sm text-gray-900 dark:text-white">
							{job.workspace_id || '-'}
						</div>
					</div>
				</div>

				<!-- Timestamps -->
				<div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
					<div>
						{$i18n.t('Created')}: {formatDate(job.created_at)}
					</div>
					<div>
						{$i18n.t('Updated')}: {formatDate(job.updated_at)}
					</div>
				</div>

				<!-- Waiting on User -->
				{#if currentStatus?.waiting_for === 'user_clarification'}
					<div
						class="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
					>
						<div class="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
							<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span class="font-medium">{$i18n.t('Waiting for your input')}</span>
						</div>
						<p class="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
							{$i18n.t('This job requires clarification. Check the linked conversation for details.')}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Orientation Side Panel -->
	{#if showOrientationPanel && selectedOrientation}
		<OrientationPanel
			type={selectedOrientation.type}
			id={selectedOrientation.id}
			on:close={() => {
				showOrientationPanel = false;
				selectedOrientation = null;
			}}
		/>
	{/if}
</div>
