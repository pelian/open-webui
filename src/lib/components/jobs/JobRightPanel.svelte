<script lang="ts">
	import { createEventDispatcher, getContext, onMount } from 'svelte';
	import {
		type Job,
		type PendingDecision,
		type DecisionHistoryItem,
		type ActivityItem,
		type CollaboratorInfo,
		type JobFile,
		updateAutonomy,
		getDecisions,
		submitDecision,
		getActivity,
		getCollaborators,
		addCollaborator,
		removeCollaborator,
		getJobFiles,
		uploadJobFile,
		deleteJobFile
	} from '$lib/apis/jobs';
	import { toast } from 'svelte-sonner';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();

	export let job: Job;

	// Track job_id to prevent reloading on every job mutation
	let loadedJobId: string | null = null;

	// Section collapse states
	let statusCollapsed = false;
	let attentionCollapsed = false;
	let activityCollapsed = false;
	let decisionsCollapsed = false;
	let filesCollapsed = true;
	let collaboratorsCollapsed = false;

	// Data
	let pendingDecisions: PendingDecision[] = [];
	let decisionHistory: DecisionHistoryItem[] = [];
	let activities: ActivityItem[] = [];
	let collaborators: CollaboratorInfo[] = [];
	let jobOwner: string | null = null;
	let files: JobFile[] = [];

	// Loading states
	let loadingDecisions = false;
	let loadingActivity = false;
	let loadingCollaborators = false;
	let loadingFiles = false;
	let submittingDecision: string | null = null;
	let updatingAutonomy = false;
	let uploadingFile = false;
	let draggingOver = false;

	// Add collaborator form
	let showAddCollaborator = false;
	let newCollaboratorId = '';
	let newCollaboratorRole = 'viewer';

	// Autonomy dropdown
	let showAutonomyDropdown = false;
	const autonomyOptions = [
		{ value: 'supervised', label: 'Supervised', description: 'Pauses at every decision' },
		{ value: 'guided', label: 'Guided', description: 'Asks before significant changes' },
		{ value: 'autonomous', label: 'Autonomous', description: 'Runs with post-hoc review' }
	];

	async function loadDecisions() {
		loadingDecisions = true;
		try {
			const data = await getDecisions(localStorage.token, job.job_id);
			pendingDecisions = data.pending;
			decisionHistory = data.history;
		} catch (e) {
			console.error('Failed to load decisions:', e);
		} finally {
			loadingDecisions = false;
		}
	}

	async function loadActivity() {
		loadingActivity = true;
		try {
			const data = await getActivity(localStorage.token, job.job_id);
			activities = data.activities;
		} catch (e) {
			console.error('Failed to load activity:', e);
		} finally {
			loadingActivity = false;
		}
	}

	async function loadCollaborators() {
		loadingCollaborators = true;
		try {
			const data = await getCollaborators(localStorage.token, job.job_id);
			jobOwner = data.owner;
			collaborators = data.collaborators;
		} catch (e) {
			console.error('Failed to load collaborators:', e);
		} finally {
			loadingCollaborators = false;
		}
	}

	async function handleAutonomyChange(level: string) {
		updatingAutonomy = true;
		showAutonomyDropdown = false;
		try {
			await updateAutonomy(
				localStorage.token,
				job.job_id,
				level as 'supervised' | 'guided' | 'autonomous'
			);
			job.autonomy_level = level;
			toast.success($i18n.t('Autonomy level updated'));
			dispatch('updated');
		} catch (e) {
			toast.error($i18n.t('Failed to update autonomy level'));
		} finally {
			updatingAutonomy = false;
		}
	}

	async function handleSubmitDecision(decisionId: string, response: string) {
		submittingDecision = decisionId;
		try {
			await submitDecision(localStorage.token, job.job_id, decisionId, response);
			toast.success($i18n.t('Decision submitted'));
			await loadDecisions();
			dispatch('updated');
		} catch (e) {
			toast.error($i18n.t('Failed to submit decision'));
		} finally {
			submittingDecision = null;
		}
	}

	async function handleAddCollaborator() {
		if (!newCollaboratorId.trim()) return;

		try {
			await addCollaborator(localStorage.token, job.job_id, newCollaboratorId, newCollaboratorRole);
			toast.success($i18n.t('Collaborator added'));
			newCollaboratorId = '';
			showAddCollaborator = false;
			await loadCollaborators();
		} catch (e) {
			toast.error($i18n.t('Failed to add collaborator'));
		}
	}

	async function handleRemoveCollaborator(userId: string) {
		try {
			await removeCollaborator(localStorage.token, job.job_id, userId);
			toast.success($i18n.t('Collaborator removed'));
			await loadCollaborators();
		} catch (e) {
			toast.error($i18n.t('Failed to remove collaborator'));
		}
	}

	async function loadFiles() {
		loadingFiles = true;
		try {
			const data = await getJobFiles(localStorage.token, job.job_id);
			files = data.files;
		} catch (e) {
			console.error('Failed to load files:', e);
			files = [];
		} finally {
			loadingFiles = false;
		}
	}

	async function handleFileUpload(fileList: FileList | null) {
		if (!fileList || fileList.length === 0) return;

		uploadingFile = true;
		try {
			for (const file of Array.from(fileList)) {
				await uploadJobFile(localStorage.token, job.job_id, file);
			}
			toast.success($i18n.t('File uploaded'));
			await loadFiles();
		} catch (e) {
			toast.error($i18n.t('Failed to upload file'));
		} finally {
			uploadingFile = false;
		}
	}

	async function handleDeleteFile(fileId: string) {
		try {
			await deleteJobFile(localStorage.token, job.job_id, fileId);
			toast.success($i18n.t('File deleted'));
			await loadFiles();
		} catch (e) {
			toast.error($i18n.t('Failed to delete file'));
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		draggingOver = true;
	}

	function handleDragLeave() {
		draggingOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		draggingOver = false;
		handleFileUpload(e.dataTransfer?.files ?? null);
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString();
	}

	function getAutonomyLabel(level: string): string {
		const option = autonomyOptions.find((o) => o.value === level);
		return option?.label || 'Supervised';
	}

	// Load data only when job_id changes (not on every job mutation)
	async function loadAllData() {
		if (job && job.job_id !== loadedJobId) {
			loadedJobId = job.job_id;
			await Promise.all([loadDecisions(), loadActivity(), loadCollaborators(), loadFiles()]);
		}
	}

	// Initial load on mount
	onMount(() => {
		loadAllData();
	});

	// Reload when job_id changes
	$: if (job?.job_id && job.job_id !== loadedJobId) {
		loadAllData();
	}
</script>

<div class="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
	<!-- Status Section -->
	<div class="border-b border-gray-200 dark:border-gray-700">
		<button
			class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
			on:click={() => (statusCollapsed = !statusCollapsed)}
		>
			<span class="text-sm font-medium text-gray-900 dark:text-white">{$i18n.t('Status')}</span>
			<svg
				class="size-4 text-gray-500 transition-transform {statusCollapsed ? '' : 'rotate-180'}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
			</svg>
		</button>

		{#if !statusCollapsed}
			<div class="px-4 pb-4 space-y-3">
				<!-- Phase -->
				{#if job.state}
					<div>
						<div class="text-xs text-gray-500 dark:text-gray-400 mb-1">{$i18n.t('Phase')}</div>
						<div class="text-sm text-gray-900 dark:text-white capitalize">{job.state}</div>
					</div>
				{/if}

				<!-- Progress -->
				{#if job.progress > 0}
					<div>
						<div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
							<span>{$i18n.t('Progress')}</span>
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

				<!-- Autonomy -->
				<div class="relative">
					<div class="text-xs text-gray-500 dark:text-gray-400 mb-1">{$i18n.t('Autonomy')}</div>
					<button
						class="w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
						on:click|stopPropagation={() => (showAutonomyDropdown = !showAutonomyDropdown)}
						disabled={updatingAutonomy}
					>
						<span class="capitalize">{getAutonomyLabel(job.autonomy_level)}</span>
						{#if updatingAutonomy}
							<Spinner className="size-4" />
						{:else}
							<svg class="size-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
							</svg>
						{/if}
					</button>

					{#if showAutonomyDropdown}
						<div
							class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20"
						>
							{#each autonomyOptions as option}
								<button
									class="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition first:rounded-t-lg last:rounded-b-lg {job.autonomy_level ===
									option.value
										? 'bg-blue-50 dark:bg-blue-900/20'
										: ''}"
									on:click={() => handleAutonomyChange(option.value)}
								>
									<div class="text-sm text-gray-900 dark:text-white">{option.label}</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Needs Attention Section -->
	{#if pendingDecisions.length > 0}
		<div class="border-b border-gray-200 dark:border-gray-700">
			<button
				class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
				on:click={() => (attentionCollapsed = !attentionCollapsed)}
			>
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-gray-900 dark:text-white">{$i18n.t('Needs Attention')}</span>
					<span
						class="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full"
					>
						{pendingDecisions.length}
					</span>
				</div>
				<svg
					class="size-4 text-gray-500 transition-transform {attentionCollapsed ? '' : 'rotate-180'}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
				</svg>
			</button>

			{#if !attentionCollapsed}
				<div class="px-4 pb-4 space-y-3">
					{#each pendingDecisions as decision}
						<div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
							<p class="text-sm text-gray-900 dark:text-white mb-2">{decision.question}</p>

							{#if decision.options.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each decision.options as option}
										<button
											class="px-2.5 py-1 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
											on:click={() => handleSubmitDecision(decision.id, option)}
											disabled={submittingDecision === decision.id}
										>
											{#if submittingDecision === decision.id}
												<Spinner className="size-3" />
											{:else}
												{option}
											{/if}
										</button>
									{/each}
								</div>
							{:else}
								<input
									type="text"
									placeholder={$i18n.t('Type your response...')}
									class="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded"
									on:keydown={(e) => {
										if (e.key === 'Enter') {
											handleSubmitDecision(decision.id, e.currentTarget.value);
										}
									}}
								/>
							{/if}

							<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
								{formatRelativeTime(decision.created_at)}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Activity Section -->
	<div class="border-b border-gray-200 dark:border-gray-700">
		<button
			class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
			on:click={() => (activityCollapsed = !activityCollapsed)}
		>
			<span class="text-sm font-medium text-gray-900 dark:text-white">{$i18n.t('Activity')}</span>
			<svg
				class="size-4 text-gray-500 transition-transform {activityCollapsed ? '' : 'rotate-180'}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
			</svg>
		</button>

		{#if !activityCollapsed}
			<div class="px-4 pb-4">
				{#if loadingActivity}
					<div class="flex justify-center py-4">
						<Spinner className="size-5" />
					</div>
				{:else if activities.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400">{$i18n.t('No activity yet')}</p>
				{:else}
					<div class="space-y-2">
						{#each activities.slice(0, 10) as activity}
							<div class="text-sm">
								<div class="text-gray-900 dark:text-white">{activity.description}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">
									{formatRelativeTime(activity.timestamp)}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Decisions History Section -->
	{#if decisionHistory.length > 0}
		<div class="border-b border-gray-200 dark:border-gray-700">
			<button
				class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
				on:click={() => (decisionsCollapsed = !decisionsCollapsed)}
			>
				<span class="text-sm font-medium text-gray-900 dark:text-white">{$i18n.t('Decisions')}</span>
				<svg
					class="size-4 text-gray-500 transition-transform {decisionsCollapsed ? '' : 'rotate-180'}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
				</svg>
			</button>

			{#if !decisionsCollapsed}
				<div class="px-4 pb-4 space-y-2">
					{#each decisionHistory.slice(0, 5) as decision}
						<div class="text-sm">
							<div class="text-gray-500 dark:text-gray-400">{decision.question}</div>
							<div class="text-gray-900 dark:text-white flex items-center gap-1.5">
								<svg class="size-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 13 4 4L19 7" />
								</svg>
								{decision.response}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Files Section -->
	<div class="border-b border-gray-200 dark:border-gray-700">
		<button
			class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
			on:click={() => (filesCollapsed = !filesCollapsed)}
		>
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-gray-900 dark:text-white">{$i18n.t('Files')}</span>
				{#if files.length > 0}
					<span class="px-1.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
						{files.length}
					</span>
				{/if}
			</div>
			<svg
				class="size-4 text-gray-500 transition-transform {filesCollapsed ? '' : 'rotate-180'}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
			</svg>
		</button>

		{#if !filesCollapsed}
			<div class="px-4 pb-4">
				<!-- Drag and Drop Zone -->
				<div
					class="relative mb-3 p-4 border-2 border-dashed rounded-lg transition-colors {draggingOver
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
						: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}"
					on:dragover={handleDragOver}
					on:dragleave={handleDragLeave}
					on:drop={handleDrop}
					role="button"
					tabindex="0"
				>
					<input
						type="file"
						multiple
						class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
						on:change={(e) => handleFileUpload(e.currentTarget.files)}
						disabled={uploadingFile}
					/>
					<div class="text-center">
						{#if uploadingFile}
							<Spinner className="size-6 mx-auto mb-2" />
							<p class="text-sm text-gray-500 dark:text-gray-400">{$i18n.t('Uploading...')}</p>
						{:else}
							<svg class="size-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
							</svg>
							<p class="text-sm text-gray-500 dark:text-gray-400">{$i18n.t('Drop files here or click to upload')}</p>
						{/if}
					</div>
				</div>

				<!-- File List -->
				{#if loadingFiles}
					<div class="flex justify-center py-4">
						<Spinner className="size-5" />
					</div>
				{:else if files.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400 text-center">{$i18n.t('No files attached')}</p>
				{:else}
					<div class="space-y-2">
						{#each files as file}
							<div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg group">
								<div class="flex items-center gap-2 min-w-0 flex-1">
									<svg class="size-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
									</svg>
									<div class="min-w-0 flex-1">
										<p class="text-sm text-gray-900 dark:text-white truncate">{file.filename}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
									</div>
								</div>
								<button
									class="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
									on:click={() => handleDeleteFile(file.id)}
									title={$i18n.t('Delete file')}
								>
									<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Collaborators Section -->
	<div class="border-b border-gray-200 dark:border-gray-700">
		<button
			class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
			on:click={() => (collaboratorsCollapsed = !collaboratorsCollapsed)}
		>
			<span class="text-sm font-medium text-gray-900 dark:text-white">{$i18n.t('Collaborators')}</span>
			<svg
				class="size-4 text-gray-500 transition-transform {collaboratorsCollapsed ? '' : 'rotate-180'}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
			</svg>
		</button>

		{#if !collaboratorsCollapsed}
			<div class="px-4 pb-4">
				{#if loadingCollaborators}
					<div class="flex justify-center py-4">
						<Spinner className="size-5" />
					</div>
				{:else}
					<div class="space-y-2">
						<!-- Owner -->
						{#if jobOwner}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div class="size-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
										<span class="text-xs font-medium text-blue-600 dark:text-blue-400">
											{jobOwner.charAt(0).toUpperCase()}
										</span>
									</div>
									<span class="text-sm text-gray-900 dark:text-white">{jobOwner}</span>
								</div>
								<span class="text-xs text-gray-500 dark:text-gray-400">{$i18n.t('Owner')}</span>
							</div>
						{/if}

						<!-- Collaborators -->
						{#each collaborators as collab}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div class="size-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
										<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
											{collab.user_id.charAt(0).toUpperCase()}
										</span>
									</div>
									<span class="text-sm text-gray-900 dark:text-white">{collab.user_id}</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-xs text-gray-500 dark:text-gray-400 capitalize">{collab.role}</span>
									<button
										class="p-1 text-gray-400 hover:text-red-500 transition"
										on:click={() => handleRemoveCollaborator(collab.user_id)}
									>
										<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>
						{/each}

						<!-- Add Collaborator -->
						{#if showAddCollaborator}
							<div class="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-2">
								<input
									type="text"
									bind:value={newCollaboratorId}
									placeholder={$i18n.t('User ID')}
									class="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
								/>
								<select
									bind:value={newCollaboratorRole}
									class="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
								>
									<option value="viewer">{$i18n.t('Viewer')}</option>
									<option value="editor">{$i18n.t('Editor')}</option>
									<option value="admin">{$i18n.t('Admin')}</option>
								</select>
								<div class="flex gap-2">
									<button
										class="flex-1 px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
										on:click={handleAddCollaborator}
									>
										{$i18n.t('Add')}
									</button>
									<button
										class="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
										on:click={() => (showAddCollaborator = false)}
									>
										{$i18n.t('Cancel')}
									</button>
								</div>
							</div>
						{:else}
							<button
								class="w-full mt-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center justify-center gap-1.5"
								on:click={() => (showAddCollaborator = true)}
							>
								<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								{$i18n.t('Add Collaborator')}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
