<script lang="ts">
	import { onMount } from 'svelte';

	import { page } from '$app/stores';
	import { showSidebar } from '$lib/stores';

	import JobDetail from '$lib/components/jobs/JobDetail.svelte';

	let loaded = false;

	onMount(async () => {
		loaded = true;
	});
</script>

{#if loaded}
	<div
		id="job-container"
		class="w-full h-full {$showSidebar ? 'md:max-w-[calc(100%-260px)]' : ''}"
	>
		<JobDetail jobId={$page.params.id} />
	</div>
{/if}
