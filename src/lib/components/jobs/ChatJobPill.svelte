<script lang="ts">
	import { createEventDispatcher, getContext, onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getJobForConversation, type ConversationJobResponse } from '$lib/apis/jobs';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Briefcase from '$lib/components/icons/Briefcase.svelte';

	const i18n: Writable<i18nType> = getContext('i18n');

	export let conversationId: string | null = null;

	const dispatch = createEventDispatcher<{
		attach: void;
	}>();

	let jobData: ConversationJobResponse | null = null;
	let loading = false;
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	const statusConfig: Record<string, { bgClass: string; textClass: string }> = {
		QUEUED: { bgClass: 'bg-gray-100 dark:bg-gray-800', textClass: 'text-gray-600 dark:text-gray-400' },
		RUNNING: { bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-700 dark:text-blue-300' },
		WAITING_ON_USER: { bgClass: 'bg-amber-100 dark:bg-amber-900/30', textClass: 'text-amber-700 dark:text-amber-300' },
		COMPLETED: { bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300' },
		FAILED: { bgClass: 'bg-red-100 dark:bg-red-900/30', textClass: 'text-red-700 dark:text-red-300' },
		CANCELLED: { bgClass: 'bg-gray-100 dark:bg-gray-800', textClass: 'text-gray-500 dark:text-gray-500' },
		PAUSED: { bgClass: 'bg-purple-100 dark:bg-purple-900/30', textClass: 'text-purple-700 dark:text-purple-300' }
	};

	$: config = jobData?.status ? statusConfig[jobData.status] || statusConfig.QUEUED : statusConfig.QUEUED;

	async function loadJobData() {
		if (!conversationId) {
			jobData = null;
			return;
		}

		loading = true;
		try {
			const token = localStorage.token;
			jobData = await getJobForConversation(token, conversationId);
		} catch (e) {
			console.error('Failed to load job for conversation:', e);
			jobData = null;
		} finally {
			loading = false;
		}
	}

	function handleClick() {
		if (jobData?.attached && jobData?.job_id) {
			goto(`/jobs/${jobData.job_id}`);
		} else {
			dispatch('attach');
		}
	}

	onMount(() => {
		loadJobData();
		// Poll for updates every 10 seconds
		pollInterval = setInterval(loadJobData, 10000);
	});

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	// Reload when conversation changes
	$: if (conversationId) {
		loadJobData();
	}
</script>

{#if !loading}
	{#if jobData?.attached && jobData?.job_id}
		<!-- Attached job pill -->
		<Tooltip content={$i18n.t('View Job')}>
			<button
				class="flex items-center gap-1.5 px-2 py-1 rounded-lg transition {config.bgClass} {config.textClass} hover:opacity-80"
				on:click={handleClick}
			>
				<Briefcase class="size-3.5" />
				<span class="text-xs font-medium truncate max-w-[120px]">
					{jobData.name || $i18n.t('Job')}
				</span>
				<span class="text-[10px] opacity-75">
					{jobData.status}
				</span>
			</button>
		</Tooltip>
	{:else}
		<!-- No job attached - show attach button -->
		<Tooltip content={$i18n.t('Attach to Job')}>
			<button
				class="flex items-center gap-1.5 px-2 py-1 rounded-lg transition bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600"
				on:click={handleClick}
			>
				<Briefcase class="size-3.5" />
				<span class="text-xs">
					{$i18n.t('No Job')}
				</span>
			</button>
		</Tooltip>
	{/if}
{/if}
