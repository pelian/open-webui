<script lang="ts">
	import { createEventDispatcher, getContext } from 'svelte';
	import type { JobListItem } from '$lib/apis/jobs';
	import JobStatusBadge from './JobStatusBadge.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import EllipsisHorizontal from '$lib/components/icons/EllipsisHorizontal.svelte';
	import JobCardMenu from './JobCardMenu.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();

	export let job: JobListItem;

	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);
		const diffMonths = Math.floor(diffDays / 30);

		if (diffMins < 1) return 'Updated just now';
		if (diffMins < 60) return `Updated ${diffMins}m ago`;
		if (diffHours < 24) return `Updated ${diffHours}h ago`;
		if (diffDays < 30) return `Updated ${diffDays}d ago`;
		if (diffMonths < 12) return `Updated ${diffMonths}mo ago`;

		return `Updated ${date.toLocaleDateString()}`;
	}

	// Determine if job is in draft state (QUEUED, PENDING, DRAFT)
	$: isDraft = ['QUEUED', 'PENDING', 'DRAFT'].includes(job.status.toUpperCase());

	// Check if job needs attention (has pending decisions or waiting on user)
	$: needsAttention = job.status.toUpperCase() === 'WAITING_ON_USER' || (job.pending_decisions_count ?? 0) > 0;
</script>

<div
	class="group relative flex flex-col cursor-pointer w-full px-4 py-4 rounded-2xl transition hover:bg-white dark:hover:bg-gray-850 {isDraft
		? 'border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-850/50'
		: 'border border-gray-100/50 dark:border-gray-850/30 bg-transparent'}"
	on:click={() => dispatch('click', { jobId: job.job_id })}
	on:keydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			dispatch('click', { jobId: job.job_id });
		}
	}}
	role="button"
	tabindex="0"
>
	<!-- Notification dot -->
	{#if needsAttention}
		<div class="absolute -top-1 -right-1 z-10">
			<span class="relative flex size-3">
				<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
				<span class="relative inline-flex rounded-full size-3 bg-red-500"></span>
			</span>
		</div>
	{/if}

	<!-- Header with title and menu -->
	<div class="flex items-start justify-between gap-2 mb-1">
		<h3 class="font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1 min-w-0">
			{job.name}
		</h3>

		<!-- Hover menu -->
		<div class="opacity-0 group-hover:opacity-100 transition shrink-0" on:click|stopPropagation={() => {}}>
			<JobCardMenu
				jobId={job.job_id}
				starred={job.starred ?? false}
				archived={job.archived ?? false}
				on:star={(e) => dispatch('star', e.detail)}
				on:edit={(e) => dispatch('edit', e.detail)}
				on:archive={(e) => dispatch('archive', e.detail)}
				on:delete={(e) => dispatch('delete', e.detail)}
			>
				<button
					class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
					type="button"
					aria-label={$i18n.t('Job options')}
				>
					<EllipsisHorizontal className="size-5" />
				</button>
			</JobCardMenu>
		</div>
	</div>

	<!-- Status badge row -->
	<div class="flex items-center gap-2 mb-2">
		{#if isDraft}
			<span class="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded uppercase">
				Draft
			</span>
		{:else}
			<JobStatusBadge status={job.status} size="sm" />
		{/if}
	</div>

	<!-- Description -->
	<div class="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 min-h-[3rem] mb-3">
		{#if job.summary}
			{job.summary}
		{:else}
			<span class="italic">{$i18n.t('No description')}</span>
		{/if}
	</div>

	<!-- Tags -->
	{#if job.tags && job.tags.length > 0}
		<div class="flex flex-wrap gap-1 mb-2">
			{#each job.tags.slice(0, 3) as tag}
				<span class="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
					{tag}
				</span>
			{/each}
			{#if job.tags.length > 3}
				<span class="px-1.5 py-0.5 text-[10px] text-gray-400">+{job.tags.length - 3}</span>
			{/if}
		</div>
	{/if}

	<!-- Footer with timestamp -->
	<div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-auto pt-1">
		<span>{formatRelativeTime(job.last_activity)}</span>
		{#if job.owner_name}
			<Tooltip content={job.owner_name} placement="top">
				<span class="truncate max-w-[100px]">By {job.owner_name}</span>
			</Tooltip>
		{/if}
	</div>
</div>
