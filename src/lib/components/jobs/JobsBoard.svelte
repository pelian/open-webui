<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getJobs, archiveJob, unarchiveJob, removeJob, type JobListItem, type JobListResponse } from '$lib/apis/jobs';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Search from '$lib/components/icons/Search.svelte';
	import JobCard from './JobCard.svelte';

	const i18n = getContext('i18n');

	// Delete confirmation
	let showDeleteConfirm = false;
	let selectedJobId: string | null = null;
	let selectedJobName: string = '';

	// Filter state
	let statusFilter: string = '';
	let ownerFilter: string = '';
	let searchQuery: string = '';

	// Sort state
	type SortOption = 'recent_activity' | 'last_edited' | 'date_created';
	let sortBy: SortOption = 'recent_activity';
	let showSortDropdown = false;

	const sortOptions: { value: SortOption; label: string }[] = [
		{ value: 'recent_activity', label: 'Recent Activity' },
		{ value: 'last_edited', label: 'Last Edited' },
		{ value: 'date_created', label: 'Date Created' }
	];

	// Pagination
	let limit = 20;
	let offset = 0;

	// Data
	let jobs: JobListItem[] = [];
	let total = 0;
	let loading = true;
	let error: string | null = null;

	// Quick filter buttons
	let quickFilter: 'all' | 'my' | 'shared' | 'active' | 'waiting' | 'archived' = 'all';

	// Debounce timer for search
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
			} else if (quickFilter === 'shared') {
				params.visibility = 'shared';
			} else if (quickFilter === 'active') {
				params.status = 'RUNNING';
			} else if (quickFilter === 'waiting') {
				params.status = 'WAITING_ON_USER';
			} else if (quickFilter === 'archived') {
				params.archived = 'true';
			}

			// By default, exclude archived jobs unless viewing archived filter
			if (quickFilter !== 'archived') {
				params.archived = 'false';
			}

			// Apply search query
			if (searchQuery.trim()) {
				params.search = searchQuery.trim();
			}

			// Apply sort
			params.sort = sortBy;

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

	function handleSearch() {
		// Debounce search to avoid too many API calls
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}
		searchDebounceTimer = setTimeout(() => {
			offset = 0;
			loadJobs();
		}, 300);
	}

	function handleSort(option: SortOption) {
		sortBy = option;
		showSortDropdown = false;
		offset = 0;
		loadJobs();
	}

	function handleJobClick(jobId: string) {
		goto(`/jobs/${jobId}`);
	}

	async function handleStar(event: CustomEvent<{ jobId: string; starred: boolean }>) {
		const { jobId, starred } = event.detail;
		// TODO: Implement star API
		toast.info($i18n.t(starred ? 'Job starred' : 'Job unstarred'));
	}

	function handleEdit(event: CustomEvent<{ jobId: string }>) {
		const { jobId } = event.detail;
		goto(`/jobs/${jobId}`);
	}

	async function handleArchive(event: CustomEvent<{ jobId: string; archived: boolean }>) {
		const { jobId, archived } = event.detail;
		try {
			if (archived) {
				await archiveJob(localStorage.token, jobId);
				toast.success($i18n.t('Job archived'));
			} else {
				await unarchiveJob(localStorage.token, jobId);
				toast.success($i18n.t('Job unarchived'));
			}
			loadJobs();
		} catch (e) {
			toast.error($i18n.t('Failed to update job'));
		}
	}

	function handleDelete(event: CustomEvent<{ jobId: string }>) {
		const { jobId } = event.detail;
		const job = jobs.find(j => j.job_id === jobId);
		selectedJobId = jobId;
		selectedJobName = job?.name ?? 'this job';
		showDeleteConfirm = true;
	}

	async function confirmDelete() {
		if (!selectedJobId) return;
		try {
			await removeJob(localStorage.token, selectedJobId);
			toast.success($i18n.t('Job deleted'));
			loadJobs();
		} catch (e) {
			toast.error($i18n.t('Failed to delete job'));
		}
		showDeleteConfirm = false;
		selectedJobId = null;
	}

	function getSortLabel(value: SortOption): string {
		const option = sortOptions.find((o) => o.value === value);
		return option ? option.label : 'Recent Activity';
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.sort-dropdown')) {
			showSortDropdown = false;
		}
	}

	onMount(() => {
		loadJobs();
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<ConfirmDialog
	bind:show={showDeleteConfirm}
	title={$i18n.t('Delete job?')}
	on:confirm={confirmDelete}
>
	<div class="text-sm text-gray-500 truncate">
		{$i18n.t('This will delete')} <span class="font-semibold">{selectedJobName}</span>.
	</div>
</ConfirmDialog>

<div class="w-full min-h-full h-full px-3 md:px-[18px]">
	<!-- Header -->
	<div class="flex flex-col gap-1 px-1 mt-1.5 mb-3">
		<div class="flex justify-between items-center">
			<div class="flex items-center md:self-center text-xl font-medium px-0.5 gap-2 shrink-0">
				<div>{$i18n.t('Jobs')}</div>
				<div class="text-lg font-medium text-gray-500 dark:text-gray-500">
					{total}
				</div>
			</div>

			<div class="flex w-full justify-end gap-1.5">
				<button
					class="px-2 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition font-medium text-sm flex items-center"
					on:click={() => goto('/jobs/new')}
				>
					<Plus className="size-3" strokeWidth="2.5" />
					<div class="ml-1 text-xs">{$i18n.t('New Job')}</div>
				</button>
			</div>
		</div>
	</div>

	<!-- Search and Filters Container -->
	<div class="py-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30">
		<!-- Search Input -->
		<div class="px-3.5 flex flex-1 items-center w-full space-x-2 py-0.5 pb-2">
			<div class="flex flex-1 items-center">
				<div class="self-center ml-1 mr-3">
					<Search className="size-3.5" />
				</div>
				<input
					class="w-full text-sm py-1 rounded-r-xl outline-hidden bg-transparent"
					bind:value={searchQuery}
					on:input={handleSearch}
					placeholder={$i18n.t('Search Jobs')}
				/>
			</div>
		</div>

		<!-- Quick Filters and Sort -->
		<div class="px-3 flex justify-between">
			<div
				class="flex w-full bg-transparent overflow-x-auto scrollbar-none"
				on:wheel={(e) => {
					if (e.deltaY !== 0) {
						e.preventDefault();
						e.currentTarget.scrollLeft += e.deltaY;
					}
				}}
			>
				<div class="flex gap-1.5 w-fit text-center text-sm rounded-full bg-transparent px-0.5 whitespace-nowrap">
					<button
						class="px-3 py-1.5 rounded-xl text-sm transition {quickFilter === 'all'
							? 'bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-white'
							: 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'}"
						on:click={() => handleQuickFilter('all')}
					>
						{$i18n.t('All')}
					</button>
					<button
						class="px-3 py-1.5 rounded-xl text-sm transition {quickFilter === 'my'
							? 'bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-white'
							: 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'}"
						on:click={() => handleQuickFilter('my')}
					>
						{$i18n.t('My Jobs')}
					</button>
					<button
						class="px-3 py-1.5 rounded-xl text-sm transition {quickFilter === 'shared'
							? 'bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-white'
							: 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'}"
						on:click={() => handleQuickFilter('shared')}
					>
						{$i18n.t('Shared')}
					</button>
					<button
						class="px-3 py-1.5 rounded-xl text-sm transition {quickFilter === 'active'
							? 'bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-white'
							: 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'}"
						on:click={() => handleQuickFilter('active')}
					>
						{$i18n.t('Active')}
					</button>
					<button
						class="px-3 py-1.5 rounded-xl text-sm transition {quickFilter === 'waiting'
							? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
							: 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'}"
						on:click={() => handleQuickFilter('waiting')}
					>
						{$i18n.t('Waiting')}
					</button>
					<button
						class="px-3 py-1.5 rounded-xl text-sm transition {quickFilter === 'archived'
							? 'bg-gray-100 dark:bg-gray-850 text-gray-900 dark:text-white'
							: 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'}"
						on:click={() => handleQuickFilter('archived')}
					>
						{$i18n.t('Archived')}
					</button>
				</div>
			</div>

			<!-- Sort Dropdown -->
			<div class="relative sort-dropdown ml-2">
				<button
					class="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-xl transition whitespace-nowrap"
					on:click|stopPropagation={() => (showSortDropdown = !showSortDropdown)}
				>
					<span>{getSortLabel(sortBy)}</span>
					<svg
						class="size-3 transition-transform {showSortDropdown ? 'rotate-180' : ''}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
					</svg>
				</button>

				{#if showSortDropdown}
					<div
						class="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl shadow-lg z-10 py-1"
					>
						{#each sortOptions as option}
							<button
								class="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition {sortBy === option.value
									? 'text-blue-600 dark:text-blue-400'
									: 'text-gray-700 dark:text-gray-300'}"
								on:click={() => handleSort(option.value)}
							>
								{$i18n.t(option.label)}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Jobs Grid -->
	<div class="mt-4">
		{#if loading}
			<div class="flex items-center justify-center py-20">
				<Spinner className="size-6" />
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
				<p class="text-sm">{error}</p>
				<button
					class="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
					on:click={loadJobs}
				>
					{$i18n.t('Try again')}
				</button>
			</div>
		{:else if jobs.length === 0}
			<div class="w-full h-full flex flex-col items-center justify-center">
				<div class="py-20 text-center">
					<div class="text-sm text-gray-400 dark:text-gray-600">
						{$i18n.t('No Jobs')}
					</div>
					<div class="mt-1 text-xs text-gray-300 dark:text-gray-700">
						{$i18n.t('Create your first job by clicking on the + New Job button above.')}
					</div>
				</div>
			</div>
		{:else}
			<div class="gap-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each jobs as job (job.job_id)}
					<JobCard
						{job}
						on:click={(e) => handleJobClick(e.detail.jobId)}
						on:star={handleStar}
						on:edit={handleEdit}
						on:archive={handleArchive}
						on:delete={handleDelete}
					/>
				{/each}
			</div>

			<!-- Pagination -->
			{#if total > limit}
				<div class="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
					<span>
						{$i18n.t('Showing {{start}}-{{end}} of {{total}}', {
							start: offset + 1,
							end: Math.min(offset + limit, total),
							total
						})}
					</span>
					<div class="flex gap-2">
						<button
							class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition"
							disabled={offset === 0}
							on:click={() => {
								offset = Math.max(0, offset - limit);
								loadJobs();
							}}
						>
							{$i18n.t('Previous')}
						</button>
						<button
							class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition"
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
