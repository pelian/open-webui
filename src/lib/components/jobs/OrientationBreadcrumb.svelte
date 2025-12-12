<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { OrientationChip } from '$lib/apis/jobs';

	export let chips: OrientationChip[] = [];

	const dispatch = createEventDispatcher<{
		click: { type: string; id: string };
	}>();

	// Sort chips by type: Mandate > Mission > Directive (hierarchy order)
	$: sortedChips = [...chips].sort((a, b) => {
		const order = { mandate: 0, mission: 1, directive: 2 };
		return (order[a.type] ?? 3) - (order[b.type] ?? 3);
	});

	const typeConfig: Record<string, { label: string; bgClass: string; textClass: string }> = {
		mandate: {
			label: 'Mandate',
			bgClass: 'bg-amber-50 dark:bg-amber-900/20',
			textClass: 'text-amber-700 dark:text-amber-300'
		},
		mission: {
			label: 'Mission',
			bgClass: 'bg-purple-50 dark:bg-purple-900/20',
			textClass: 'text-purple-700 dark:text-purple-300'
		},
		directive: {
			label: 'Directive',
			bgClass: 'bg-blue-50 dark:bg-blue-900/20',
			textClass: 'text-blue-700 dark:text-blue-300'
		}
	};

	function handleClick(chip: OrientationChip) {
		dispatch('click', { type: chip.type, id: chip.id });
	}
</script>

{#if sortedChips.length > 0}
	<nav class="flex items-center text-sm" aria-label="Orientation breadcrumb">
		{#each sortedChips as chip, index (chip.id)}
			{@const config = typeConfig[chip.type] || typeConfig.directive}
			{#if index > 0}
				<svg
					class="mx-1.5 size-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			{/if}
			<button
				class="inline-flex items-center gap-1 px-2 py-0.5 rounded {config.bgClass} {config.textClass} hover:opacity-80 transition max-w-[200px]"
				on:click={() => handleClick(chip)}
				title="{config.label}: {chip.label}"
			>
				<span class="text-[10px] font-semibold opacity-60">{config.label[0]}</span>
				<span class="truncate">{chip.label}</span>
			</button>
		{/each}
	</nav>
{/if}
