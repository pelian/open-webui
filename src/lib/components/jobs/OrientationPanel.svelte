<script lang="ts">
	import { createEventDispatcher, getContext, onMount } from 'svelte';
	import { getDirective, getMission, getMandate, type Directive, type Mission, type Mandate } from '$lib/apis/jobs';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	const i18n: Writable<i18nType> = getContext('i18n');

	export let type: 'directive' | 'mission' | 'mandate';
	export let id: string;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let loading = true;
	let error: string | null = null;
	let data: Directive | Mission | Mandate | null = null;

	const typeConfig = {
		directive: {
			label: 'Directive',
			bgClass: 'bg-blue-50 dark:bg-blue-900/20',
			textClass: 'text-blue-700 dark:text-blue-300',
			borderClass: 'border-blue-200 dark:border-blue-800'
		},
		mission: {
			label: 'Mission',
			bgClass: 'bg-purple-50 dark:bg-purple-900/20',
			textClass: 'text-purple-700 dark:text-purple-300',
			borderClass: 'border-purple-200 dark:border-purple-800'
		},
		mandate: {
			label: 'Mandate',
			bgClass: 'bg-amber-50 dark:bg-amber-900/20',
			textClass: 'text-amber-700 dark:text-amber-300',
			borderClass: 'border-amber-200 dark:border-amber-800'
		}
	};

	$: config = typeConfig[type];

	async function loadData() {
		loading = true;
		error = null;

		try {
			const token = localStorage.token;
			switch (type) {
				case 'directive':
					data = await getDirective(token, id);
					break;
				case 'mission':
					data = await getMission(token, id);
					break;
				case 'mandate':
					data = await getMandate(token, id);
					break;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
			console.error(`Failed to load ${type}:`, e);
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	onMount(() => {
		loadData();
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<!-- Backdrop -->
<button
	class="fixed inset-0 bg-black/30 z-40"
	on:click={handleClose}
	aria-label="Close panel"
></button>

<!-- Panel -->
<div
	class="fixed right-0 top-0 h-full w-96 max-w-full bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col"
	role="dialog"
	aria-labelledby="panel-title"
>
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center gap-2">
			<span
				class="px-2 py-0.5 text-xs font-medium rounded {config.bgClass} {config.textClass}"
			>
				{config.label}
			</span>
			{#if data}
				<h2 id="panel-title" class="font-semibold text-gray-900 dark:text-white truncate">
					{data.label}
				</h2>
			{/if}
		</div>
		<button
			class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition"
			on:click={handleClose}
			aria-label="Close"
		>
			<svg class="size-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if loading}
			<div class="flex items-center justify-center h-32">
				<Spinner className="size-6" />
			</div>
		{:else if error}
			<div class="text-center py-8 text-gray-500 dark:text-gray-400">
				<p class="text-sm">{error}</p>
				<button
					class="mt-2 text-blue-600 dark:text-blue-400 text-sm hover:underline"
					on:click={loadData}
				>
					{$i18n.t('Try again')}
				</button>
			</div>
		{:else if data}
			<!-- Description -->
			{#if data.description}
				<div class="mb-4">
					<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
						{$i18n.t('Description')}
					</h3>
					<p class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
						{data.description}
					</p>
				</div>
			{/if}

			<!-- Status -->
			<div class="mb-4">
				<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
					{$i18n.t('Status')}
				</h3>
				<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded capitalize bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
					{data.status}
				</span>
			</div>

			<!-- Type-specific fields -->
			{#if type === 'directive' && 'scope' in data}
				<div class="mb-4">
					<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
						{$i18n.t('Scope')}
					</h3>
					<span class="text-sm text-gray-900 dark:text-white capitalize">
						{data.scope || 'workspace'}
					</span>
				</div>
			{/if}

			{#if type === 'mission' && 'priority' in data}
				<div class="mb-4">
					<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
						{$i18n.t('Priority')}
					</h3>
					<span class="text-sm text-gray-900 dark:text-white">
						{data.priority ?? '-'}
					</span>
				</div>
			{/if}

			{#if type === 'mandate' && 'rationale' in data}
				<div class="mb-4">
					<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
						{$i18n.t('Rationale')}
					</h3>
					<p class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
						{data.rationale || '-'}
					</p>
				</div>
			{/if}

			<!-- Parent links -->
			{#if 'parent_mission_id' in data && data.parent_mission_id}
				<div class="mb-4">
					<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
						{$i18n.t('Parent Mission')}
					</h3>
					<span class="text-sm text-purple-600 dark:text-purple-400">
						{data.parent_mission_id}
					</span>
				</div>
			{/if}

			{#if 'governing_mandate_id' in data && data.governing_mandate_id}
				<div class="mb-4">
					<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
						{$i18n.t('Governing Mandate')}
					</h3>
					<span class="text-sm text-amber-600 dark:text-amber-400">
						{data.governing_mandate_id}
					</span>
				</div>
			{/if}

			<!-- Timestamps -->
			<div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
				{#if data.created_at}
					<div class="flex justify-between text-xs">
						<span class="text-gray-500 dark:text-gray-400">{$i18n.t('Created')}</span>
						<span class="text-gray-700 dark:text-gray-300">{formatDate(data.created_at)}</span>
					</div>
				{/if}
				{#if data.updated_at}
					<div class="flex justify-between text-xs">
						<span class="text-gray-500 dark:text-gray-400">{$i18n.t('Updated')}</span>
						<span class="text-gray-700 dark:text-gray-300">{formatDate(data.updated_at)}</span>
					</div>
				{/if}
			</div>

			<!-- Read-only notice -->
			<div class="mt-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
				<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
					{$i18n.t('View only. Manage governance objects in Aiden Control Interface.')}
				</p>
			</div>
		{/if}
	</div>
</div>
