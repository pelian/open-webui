<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { createEventDispatcher, getContext } from 'svelte';
	import { fade } from 'svelte/transition';

	import Star from '$lib/components/icons/Star.svelte';
	import PencilSolid from '$lib/components/icons/PencilSolid.svelte';
	import ArchiveBox from '$lib/components/icons/ArchiveBox.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();

	export let jobId: string;
	export let starred = false;
	export let archived = false;
	export let inTrash = false;

	export let show = false;
	export let className = 'max-w-[180px]';
</script>

<DropdownMenu.Root bind:open={show}>
	<DropdownMenu.Trigger>
		<slot />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content
		class="w-full {className} text-sm rounded-2xl px-1 py-1 border border-gray-100 dark:border-gray-800 z-50 bg-white dark:bg-gray-850 dark:text-white shadow-lg"
		sideOffset={6}
		side="bottom"
		align="end"
		transition={(e) => fade(e, { duration: 100 })}
	>
		<DropdownMenu.Item
			class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl {starred ? 'text-yellow-500' : ''}"
			on:click={() => {
				dispatch('star', { jobId, starred: !starred });
			}}
		>
			<Star className="size-4" />
			<div class="flex items-center">{starred ? $i18n.t('Unstar') : $i18n.t('Star')}</div>
		</DropdownMenu.Item>

		<DropdownMenu.Item
			class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
			on:click={() => {
				dispatch('edit', { jobId });
			}}
		>
			<PencilSolid className="size-4" />
			<div class="flex items-center">{$i18n.t('Edit details')}</div>
		</DropdownMenu.Item>

		<DropdownMenu.Item
			class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
			on:click={() => {
				dispatch('archive', { jobId, archived: !archived });
			}}
		>
			<ArchiveBox className="size-4" />
			<div class="flex items-center">{archived ? $i18n.t('Unarchive') : $i18n.t('Archive')}</div>
		</DropdownMenu.Item>

		{#if inTrash}
			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl"
				on:click={() => {
					dispatch('restore', { jobId });
				}}
			>
				<ArchiveBox className="size-4" />
				<div class="flex items-center">{$i18n.t('Restore')}</div>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
				on:click={() => {
					dispatch('permanentDelete', { jobId });
				}}
			>
				<GarbageBin className="size-4" />
				<div class="flex items-center">{$i18n.t('Delete permanently')}</div>
			</DropdownMenu.Item>
		{:else}
			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
				on:click={() => {
					dispatch('delete', { jobId });
				}}
			>
				<GarbageBin className="size-4" />
				<div class="flex items-center">{$i18n.t('Delete')}</div>
			</DropdownMenu.Item>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
