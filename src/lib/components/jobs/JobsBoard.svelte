<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { getJobs, type JobListItem, type JobListResponse } from '$lib/apis/jobs';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import JobStatusBadge from './JobStatusBadge.svelte';
	import OrientationChips from './OrientationChips.svelte';

	const i18n = getContext('i18n');

	// Filter state
	let statusFilter: string = '';
	let ownerFilter: string = '';
	let searchQuery: string = '';

	// Pagination
	let limit = 20;
	let offset = 0;

	// Data
	let jobs: JobListItem[] = [];
	let total = 0;
	let loading = true;
	let error: string | null = null;

	// Quick filter buttons
	let quickFilter: 'all' | 'my' | 'active' | 'waiting' = 'all';

	async function loadJobs() {
		loading = true;
		error = null;

		try {
			const params: Record<string, string | number> = { limit, offset };

			if (statusFilter) params.status = statusFilter;
			if (ownerFilter) params.owner = ownerFilter;

			// Apply quick filters
			if (quickFilter === 'my') {
				params.owner = 'me';
			} else if (quickFilter === 'active') {
				params.status = 'RUNNING';
			} else if (quickFilter === 'waiting') {
				params.status = 'WAITING_ON_USER';
			}

			const response: JobListResponse = await getJobs(localStorage.token, params);
			jobs = response.jobs;
			total = response.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load jobs';
			console.error('Failed to load jobs:', e);
		} finally {
			loading = false;
		}
	}

	function handleQuickFilter(filter: typeof quickFilter) {
		quickFilter = filter;
		offset = 0;
		loadJobs();
	}

	function handleJobClick(jobId: string) {
		goto(`/jobs/${jobId}`);
	}

	function formatDate(dateString: string): string {
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

	onMount(() => {
		loadJobs();
	});
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between mb-3">
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">
				{$i18n.t('Jobs')}
			</h1>
			<button
				class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
				on:click={() => goto('/jobs/new')}
			>
				{$i18n.t('New Job')}
			</button>
		</div>

		<!-- Quick Filters -->
		<div class="flex items-center gap-2">
			<button
				class="px-3 py-1.5 rounded-lg text-sm font-medium transition {quickFilter === 'all'
					? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
					: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}"
				on:click={() => handleQuickFilter('all')}
			>
				{$i18n.t('All')}
			</button>
			<button
				class="px-3 py-1.5 rounded-lg text-sm font-medium transition {quickFilter === 'my'
					? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
					: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}"
				on:click={() => handleQuickFilter('my')}
			>
				{$i18n.t('My Jobs')}
			</button>
			<button
				class="px-3 py-1.5 rounded-lg text-sm font-medium transition {quickFilter === 'active'
					? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
					: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}"
				on:click={() => handleQuickFilter('active')}
			>
				{$i18n.t('Active')}
			</button>
			<button
				class="px-3 py-1.5 rounded-lg text-sm font-medium transition {quickFilter === 'waiting'
					? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
					: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}"
				on:click={() => handleQuickFilter('waiting')}
			>
				{$i18n.t('Waiting on me')}
			</button>
		</div>
	</div>

	<!-- Jobs List -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center h-48">
				<Spinner className="size-6" />
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
				<p class="text-sm">{error}</p>
				<button
					class="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
					on:click={loadJobs}
				>
					{$i18n.t('Try again')}
				</button>
			</div>
		{:else if jobs.length === 0}
			<div class="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
				<svg
					class="size-12 mb-3 text-gray-300 dark:text-gray-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z"
					/>
				</svg>
				<p class="text-sm">{$i18n.t('No jobs found')}</p>
				<button
					class="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
					on:click={() => goto('/jobs/new')}
				>
					{$i18n.t('Create your first job')}
				</button>
			</div>
		{:else}
			<div class="divide-y divide-gray-100 dark:divide-gray-800">
				{#each jobs as job (job.job_id)}
					<button
						class="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
						on:click={() => handleJobClick(job.job_id)}
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h3 class="font-medium text-gray-900 dark:text-white truncate">
										{job.name}
									</h3>
									<JobStatusBadge status={job.status} />
								</div>

								<!-- Orientation Chips -->
								{#if job.orientation_chips && job.orientation_chips.length > 0}
									<div class="mb-1.5">
										<OrientationChips chips={job.orientation_chips} size="sm" />
									</div>
								{/if}

								<div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
									{#if job.owner_subject_id}
										<span>{job.owner_subject_id}</span>
									{/if}
									{#if job.persona_id}
										<span
											class="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
										>
											{job.persona_id}
										</span>
									{/if}
									{#if job.progress > 0}
										<span>{job.progress}%</span>
									{/if}
								</div>
							</div>

							<div class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
								{formatDate(job.last_activity)}
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Pagination -->
			{#if total > limit}
				<div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<span class="text-sm text-gray-500 dark:text-gray-400">
						{$i18n.t('Showing {{start}}-{{end}} of {{total}}', {
							start: offset + 1,
							end: Math.min(offset + limit, total),
							total
						})}
					</span>
					<div class="flex gap-2">
						<button
							class="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
							disabled={offset === 0}
							on:click={() => {
								offset = Math.max(0, offset - limit);
								loadJobs();
							}}
						>
							{$i18n.t('Previous')}
						</button>
						<button
							class="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
							disabled={offset + limit >= total}
							on:click={() => {
								offset = offset + limit;
								loadJobs();
							}}
						>
							{$i18n.t('Next')}
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
