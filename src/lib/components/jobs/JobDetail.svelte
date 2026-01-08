<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getJob,
		getJobStatus,
		pauseJob,
		resumeJob,
		cancelJob,
		removeJob,
		type Job,
		type JobStatusResponse
	} from '$lib/apis/jobs';
	import { toast } from 'svelte-sonner';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import JobStatusBadge from './JobStatusBadge.svelte';
	import OrientationBreadcrumb from './OrientationBreadcrumb.svelte';
	import OrientationPanel from './OrientationPanel.svelte';
	import JobRightPanel from './JobRightPanel.svelte';

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

	async function handleRemove() {
		if (!confirm($i18n.t('Are you sure you want to permanently remove this job? This cannot be undone.'))) return;

		try {
			await removeJob(localStorage.token, jobId);
			toast.success($i18n.t('Job removed'));
			goto('/jobs');
		} catch (e) {
			toast.error($i18n.t('Failed to remove job'));
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

						{#if ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status.toUpperCase())}
							<button
								class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
								on:click={handleRemove}
							>
								{$i18n.t('Remove')}
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

				<!-- Conversations Section (Claude Projects-style) -->
				<div class="mb-6">
					<!-- Chat Input -->
					<div class="mb-4">
						<div class="relative">
							<input
								type="text"
								placeholder={$i18n.t('Start a new conversation...')}
								class="w-full px-4 py-3 pr-12 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								on:keydown={(e) => {
									if (e.key === 'Enter' && e.currentTarget.value.trim()) {
										// TODO: Create new conversation
										console.log('New conversation:', e.currentTarget.value);
										e.currentTarget.value = '';
									}
								}}
							/>
							<button
								class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-500 transition"
							>
								<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
								</svg>
							</button>
						</div>
					</div>

					<!-- Conversations List -->
					<div class="space-y-2">
						{#if job.conversations && job.conversations.length > 0}
							{#each job.conversations as conversation}
								<button
									class="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition group"
									on:click={() => {
										// TODO: Open conversation
										console.log('Open conversation:', conversation.id);
									}}
								>
									<div class="flex items-start justify-between">
										<div class="flex-1 min-w-0">
											<div class="text-sm font-medium text-gray-900 dark:text-white truncate">
												{conversation.title || 'Untitled conversation'}
											</div>
											<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
												{conversation.last_message_at ? formatDate(conversation.last_message_at) : 'No messages yet'}
											</div>
										</div>
										<button
											class="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
											on:click|stopPropagation={() => {
												// TODO: Conversation options menu
											}}
										>
											<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
											</svg>
										</button>
									</div>
								</button>
							{/each}
						{:else}
							<div class="text-center py-8 text-gray-500 dark:text-gray-400">
								<svg class="size-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
								</svg>
								<p class="text-sm">{$i18n.t('No conversations yet')}</p>
								<p class="text-xs mt-1">{$i18n.t('Start a conversation above to work on this job')}</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Timestamps (collapsed to footer) -->
				<div class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
					<span>{$i18n.t('Created')} {formatDate(job.created_at)}</span>
					<span>·</span>
					<span>{$i18n.t('Updated')} {formatDate(job.updated_at)}</span>
				</div>

				</div>
		{/if}
	</div>

	<!-- Right Panel with Status, Decisions, Activity, Collaborators -->
	{#if job}
		<JobRightPanel {job} on:updated={loadJob} />
	{/if}

	<!-- Orientation Side Panel (slides over right panel) -->
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
