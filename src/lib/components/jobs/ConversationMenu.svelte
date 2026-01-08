<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { flyAndScale } from '$lib/utils/transitions';
	import { getContext, createEventDispatcher } from 'svelte';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';
	import Pencil from '$lib/components/icons/Pencil.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Bookmark from '$lib/components/icons/Bookmark.svelte';
	import BookmarkSlash from '$lib/components/icons/BookmarkSlash.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();

	export let conversationId: string;
	export let starred = false;
	export let onClose: () => void = () => {};

	let show = false;

	function handleStar() {
		dispatch('star', { id: conversationId, starred: !starred });
		show = false;
	}

	function handleRename() {
		dispatch('rename', { id: conversationId });
		show = false;
	}

	function handleDelete() {
		dispatch('delete', { id: conversationId });
		show = false;
	}
</script>

<Dropdown
	bind:show
	on:change={(e) => {
		if (e.detail === false) {
			onClose();
		}
	}}
>
	<Tooltip content={$i18n.t('More')}>
		<slot />
	</Tooltip>

	<div slot="content">
		<DropdownMenu.Content
			class="w-full max-w-[160px] rounded-2xl px-1 py-1 border border-gray-100 dark:border-gray-800 z-50 bg-white dark:bg-gray-850 dark:text-white shadow-lg transition"
			sideOffset={-2}
			side="bottom"
			align="end"
			transition={flyAndScale}
		>
			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
				on:click={handleStar}
			>
				{#if starred}
					<BookmarkSlash strokeWidth="1.5" />
					<div class="flex items-center">{$i18n.t('Unstar')}</div>
				{:else}
					<Bookmark strokeWidth="1.5" />
					<div class="flex items-center">{$i18n.t('Star')}</div>
				{/if}
			</DropdownMenu.Item>

			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
				on:click={handleRename}
			>
				<Pencil strokeWidth="1.5" />
				<div class="flex items-center">{$i18n.t('Rename')}</div>
			</DropdownMenu.Item>

			<hr class="border-gray-100 dark:border-gray-800 my-1" />

			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl"
				on:click={handleDelete}
			>
				<GarbageBin strokeWidth="1.5" />
				<div class="flex items-center">{$i18n.t('Delete')}</div>
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</div>
</Dropdown>
