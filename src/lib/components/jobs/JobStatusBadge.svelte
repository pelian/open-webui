<script lang="ts">
	export let status: string;
	export let size: 'sm' | 'md' = 'sm';

	const statusConfig: Record<string, { label: string; className: string }> = {
		QUEUED: {
			label: 'Queued',
			className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
		},
		RUNNING: {
			label: 'Running',
			className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
		},
		WAITING_ON_USER: {
			label: 'Waiting on you',
			className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
		},
		COMPLETED: {
			label: 'Completed',
			className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
		},
		FAILED: {
			label: 'Failed',
			className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
		},
		CANCELLED: {
			label: 'Cancelled',
			className: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
		},
		PAUSED: {
			label: 'Paused',
			className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
		}
	};

	$: config = statusConfig[status.toUpperCase()] || {
		label: status,
		className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
	};

	$: sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';
</script>

<span class="inline-flex items-center rounded font-medium {sizeClass} {config.className}">
	{#if status.toUpperCase() === 'RUNNING'}
		<span class="mr-1 size-1.5 bg-current rounded-full animate-pulse"></span>
	{/if}
	{config.label}
</span>
