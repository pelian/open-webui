<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { OrientationChip } from '$lib/apis/jobs';

	export let chips: OrientationChip[] = [];
	export let size: 'sm' | 'md' = 'md';
	export let clickable: boolean = true;

	const dispatch = createEventDispatcher<{
		click: { chip: OrientationChip };
	}>();

	const typeConfig: Record<string, { bgClass: string; textClass: string; icon: string }> = {
		directive: {
			bgClass: 'bg-blue-50 dark:bg-blue-900/20',
			textClass: 'text-blue-700 dark:text-blue-300',
			icon: 'D'
		},
		mission: {
			bgClass: 'bg-purple-50 dark:bg-purple-900/20',
			textClass: 'text-purple-700 dark:text-purple-300',
			icon: 'M'
		},
		mandate: {
			bgClass: 'bg-amber-50 dark:bg-amber-900/20',
			textClass: 'text-amber-700 dark:text-amber-300',
			icon: 'A'
		}
	};

	function handleChipClick(chip: OrientationChip) {
		if (clickable) {
			dispatch('click', { chip });
		}
	}

	$: sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
</script>

<div class="flex flex-wrap gap-1">
	{#each chips as chip (chip.id)}
		{@const config = typeConfig[chip.type] || typeConfig.directive}
		<button
			class="inline-flex items-center gap-1 rounded {sizeClass} {config.bgClass} {config.textClass} {clickable
				? 'hover:opacity-80 cursor-pointer'
				: 'cursor-default'} transition"
			on:click={() => handleChipClick(chip)}
			disabled={!clickable}
		>
			<span
				class="font-semibold {size === 'sm' ? 'text-[10px]' : 'text-xs'} opacity-60"
			>
				{config.icon}
			</span>
			<span class="truncate max-w-[120px]">{chip.label}</span>
		</button>
	{/each}
</div>
