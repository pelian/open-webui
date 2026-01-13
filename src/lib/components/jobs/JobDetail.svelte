<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';
	import { settings, config } from '$lib/stores';
	import {
		getJob,
		getJobStatus,
		pauseJob,
		resumeJob,
		startJob,
		cancelJob,
		removeJob,
		updateJob,
		archiveJob,
		unarchiveJob,
		type Job,
		type JobStatusResponse
	} from '$lib/apis/jobs';
	import { createNewChat } from '$lib/apis/chats';
	import { toast } from 'svelte-sonner';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import JobStatusBadge from './JobStatusBadge.svelte';
	import OrientationBreadcrumb from './OrientationBreadcrumb.svelte';
	import OrientationPanel from './OrientationPanel.svelte';
	import JobRightPanel from './JobRightPanel.svelte';
	import ConversationMenu from './ConversationMenu.svelte';

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

	// Inline editing
	let editingName = false;
	let editingNameValue = '';
	let editingSummary = false;
	let editingSummaryValue = '';
	let savingName = false;
	let savingSummary = false;

	// Summary expansion
	let summaryExpanded = false;
	const SUMMARY_PREVIEW_LENGTH = 500; // ~4-5 lines

	function getSummaryPreview(summary: string): string {
		if (summary.length <= SUMMARY_PREVIEW_LENGTH) return summary;
		return summary.slice(0, SUMMARY_PREVIEW_LENGTH).trim() + '...';
	}

	function shouldShowExpandButton(summary: string | null): boolean {
		return !!summary && summary.length > SUMMARY_PREVIEW_LENGTH;
	}

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

	async function handleStart() {
		try {
			await startJob(localStorage.token, jobId);
			toast.success($i18n.t('Job started'));
			await loadJob();
			startPolling();
		} catch (e) {
			toast.error($i18n.t('Failed to start job'));
		}
	}

	function startEditName() {
		if (!job) return;
		editingNameValue = job.name;
		editingName = true;
	}

	async function saveNameEdit() {
		if (!job || !editingNameValue.trim()) return;
		savingName = true;
		try {
			await updateJob(localStorage.token, jobId, { name: editingNameValue.trim() });
			job.name = editingNameValue.trim();
			editingName = false;
			toast.success($i18n.t('Name updated'));
		} catch (e) {
			toast.error($i18n.t('Failed to update name'));
		} finally {
			savingName = false;
		}
	}

	function cancelNameEdit() {
		editingName = false;
		editingNameValue = '';
	}

	function startEditSummary() {
		if (!job) return;
		editingSummaryValue = job.summary || '';
		editingSummary = true;
	}

	async function saveSummaryEdit() {
		if (!job) return;
		savingSummary = true;
		try {
			await updateJob(localStorage.token, jobId, { summary: editingSummaryValue.trim() || null });
			job.summary = editingSummaryValue.trim() || null;
			editingSummary = false;
			toast.success($i18n.t('Summary updated'));
		} catch (e) {
			toast.error($i18n.t('Failed to update summary'));
		} finally {
			savingSummary = false;
		}
	}

	function cancelSummaryEdit() {
		editingSummary = false;
		editingSummaryValue = '';
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

	async function handleArchive() {
		if (!job) return;

		try {
			if (job.archived) {
				await unarchiveJob(localStorage.token, jobId);
				job.archived = false;
				toast.success($i18n.t('Job unarchived'));
			} else {
				await archiveJob(localStorage.token, jobId);
				job.archived = true;
				toast.success($i18n.t('Job archived'));
			}
		} catch (e) {
			toast.error($i18n.t(job.archived ? 'Failed to unarchive job' : 'Failed to archive job'));
		}
	}

	async function startNewChat(initialMessage: string) {
		if (!job) return;

		try {
			// Get user's default model or config default
			const defaultModels = $settings?.models ??
				($config?.default_models ? $config.default_models.split(',') : ['']);

			// Create a new chat associated with this job
			// Include job context in meta for system prompt injection
			// Use crypto.randomUUID() if available, fallback for HTTP contexts
			const chatId = typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
					const r = Math.random() * 16 | 0;
					return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
				});
			const chat = await createNewChat(
				localStorage.token,
				{
					id: chatId,
					title: job.name,
					models: defaultModels,
					history: {
						currentId: null,
						messages: {}
					},
					messages: [],
					tags: [],
					timestamp: Date.now(),
					// Store job context in chat meta for system prompt injection
					meta: {
						job_id: jobId,
						job_name: job.name,
						job_goal: job.summary || job.name
					}
				},
				null, // No folder
				jobId // Associate with this job
			);

			if (chat) {
				// Store the initial message to be sent after navigation
				localStorage.setItem('pendingMessage', JSON.stringify({
					chatId: chat.id,
					message: initialMessage,
					jobId: jobId
				}));

				// Navigate to the new chat
				goto(`/c/${chat.id}`);
			}
		} catch (e) {
			console.error('Failed to create chat:', e);
			toast.error($i18n.t('Failed to start conversation'));
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

							<!-- Editable Job Name -->
							{#if editingName}
								<div class="flex items-center gap-2 flex-1">
									<input
										type="text"
										bind:value={editingNameValue}
										class="flex-1 px-2 py-1 text-xl font-semibold bg-white dark:bg-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
										on:keydown={(e) => {
											if (e.key === 'Enter') saveNameEdit();
											if (e.key === 'Escape') cancelNameEdit();
										}}
										autofocus
									/>
									<button
										class="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
										on:click={saveNameEdit}
										disabled={savingName}
									>
										{#if savingName}
											<Spinner className="size-5" />
										{:else}
											<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 13 4 4L19 7" />
											</svg>
										{/if}
									</button>
									<button
										class="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
										on:click={cancelNameEdit}
									>
										<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{:else}
								<button
									class="group flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400"
									on:click={startEditName}
								>
									<span class="truncate">{job.name}</span>
									<svg class="size-4 opacity-0 group-hover:opacity-100 transition text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
									</svg>
								</button>
							{/if}

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
						<!-- Start button for QUEUED/PENDING jobs -->
						{#if ['QUEUED', 'PENDING', 'DRAFT'].includes(job.status.toUpperCase())}
							<button
								class="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition flex items-center gap-2"
								on:click={handleStart}
							>
								<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								{$i18n.t('Start Job')}
							</button>
						{/if}

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
								class="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition flex items-center gap-1.5"
								on:click={handleArchive}
							>
								{#if job.archived}
									<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
									</svg>
									{$i18n.t('Unarchive')}
								{:else}
									<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
									</svg>
									{$i18n.t('Archive')}
								{/if}
							</button>
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
				<!-- Description (Editable) -->
				<div class="mb-6">
					<div class="flex items-center justify-between mb-2">
						<h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">
							{$i18n.t('Description')}
						</h2>
						{#if !editingSummary}
							<button
								class="p-1 text-gray-400 hover:text-blue-500 transition"
								on:click={startEditSummary}
								title={$i18n.t('Edit description')}
							>
								<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
								</svg>
							</button>
						{/if}
					</div>

					{#if editingSummary}
						<div class="space-y-2">
							<textarea
								bind:value={editingSummaryValue}
								rows="8"
								class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px]"
								placeholder={$i18n.t('Describe the goal, context, requirements, and success criteria for this job...')}
								on:keydown={(e) => {
									if (e.key === 'Escape') cancelSummaryEdit();
								}}
							></textarea>
							<div class="flex items-center justify-between">
								<span class="text-xs text-gray-400">
									{editingSummaryValue.length.toLocaleString()} {$i18n.t('characters')}
								</span>
								<div class="flex gap-2">
									<button
										class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
										on:click={cancelSummaryEdit}
									>
										{$i18n.t('Cancel')}
									</button>
									<button
										class="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
										on:click={saveSummaryEdit}
										disabled={savingSummary}
									>
										{#if savingSummary}
											<Spinner className="size-4" />
										{:else}
											{$i18n.t('Save')}
										{/if}
									</button>
								</div>
							</div>
						</div>
					{:else if job.summary}
						<div>
							<div class="prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-white leading-relaxed">
								{@html marked.parse(DOMPurify.sanitize(summaryExpanded ? job.summary : getSummaryPreview(job.summary)))}
							</div>
							{#if shouldShowExpandButton(job.summary)}
								<button
									class="mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition"
									on:click={() => (summaryExpanded = !summaryExpanded)}
								>
									{summaryExpanded ? $i18n.t('Show less') : $i18n.t('Show more')}
								</button>
							{/if}
						</div>
					{:else}
						<button
							class="text-sm text-gray-400 hover:text-blue-500 transition italic"
							on:click={startEditSummary}
						>
							{$i18n.t('Click to add a description...')}
						</button>
					{/if}
				</div>

				<!-- Conversations Section (Claude Projects-style) -->
				<div class="mb-6">
					<!-- Chat Input - Matches main MessageInput styling -->
					<div class="mb-4">
						<form
							class="w-full flex flex-col gap-1.5"
							on:submit|preventDefault={(e) => {
								const input = e.currentTarget.querySelector('textarea');
								if (input && input.value.trim()) {
									const message = input.value.trim();
									startNewChat(message);
									input.value = '';
								}
							}}
						>
							<div
								class="flex-1 flex flex-col relative w-full shadow-lg rounded-3xl border border-gray-100/30 dark:border-gray-850/30 hover:border-gray-200 focus-within:border-gray-100 hover:dark:border-gray-800 focus-within:dark:border-gray-800 transition px-1 bg-white/5 dark:bg-gray-500/5 backdrop-blur-sm dark:text-gray-100"
							>
								<!-- Text input area -->
								<div class="px-2.5">
									<div class="scrollbar-hidden text-left bg-transparent dark:text-gray-100 outline-hidden w-full pb-1 px-1 resize-none h-fit max-h-96 overflow-auto pt-2.5">
										<textarea
											id="job-chat-input"
											class="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border-none resize-none focus:outline-none focus:ring-0 text-sm min-h-[80px]"
											placeholder={$i18n.t('How can I help with this job?')}
											on:input={(e) => {
												// Auto-resize textarea
												e.currentTarget.style.height = 'auto';
												e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 384) + 'px';
											}}
											on:keydown={(e) => {
												if (e.key === 'Enter' && !e.shiftKey) {
													e.preventDefault();
													e.currentTarget.closest('form')?.requestSubmit();
												}
											}}
										></textarea>
									</div>
								</div>

								<!-- Bottom row with send button -->
								<div class="flex justify-between mt-0.5 mb-2.5 mx-0.5 max-w-full" dir="ltr">
									<div class="ml-1 self-end flex items-center flex-1">
										<!-- Placeholder for future attachment button -->
									</div>
									<div class="mr-1 self-end flex items-center">
										<button
											type="submit"
											class="bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full p-1.5 self-center"
											aria-label={$i18n.t('Send message')}
										>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-5">
												<path fill-rule="evenodd" d="M8 14a.75.75 0 0 1-.75-.75V4.56L4.03 7.78a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69A.75.75 0 0 1 8 14Z" clip-rule="evenodd" />
											</svg>
										</button>
									</div>
								</div>
							</div>
						</form>
					</div>

					<!-- Conversations List -->
					<div class="space-y-2">
						{#if job.conversations && job.conversations.length > 0}
							{#each job.conversations as conversation}
								<div
									class="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition group cursor-pointer"
									on:click={() => {
										// TODO: Open conversation
										console.log('Open conversation:', conversation.id);
									}}
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											console.log('Open conversation:', conversation.id);
										}
									}}
									role="button"
									tabindex="0"
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
										<div on:click|stopPropagation={() => {}}>
											<ConversationMenu
												conversationId={conversation.id}
												starred={false}
												on:star={(e) => {
													// TODO: Toggle star status
													console.log('Star conversation:', e.detail);
													toast.success($i18n.t('Conversation starred'));
												}}
												on:rename={(e) => {
													// TODO: Open rename dialog
													console.log('Rename conversation:', e.detail);
												}}
												on:delete={(e) => {
													// TODO: Delete conversation with confirmation
													console.log('Delete conversation:', e.detail);
												}}
											>
												<button
													class="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
													aria-label={$i18n.t('Conversation options')}
												>
													<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
													</svg>
												</button>
											</ConversationMenu>
										</div>
									</div>
								</div>
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
