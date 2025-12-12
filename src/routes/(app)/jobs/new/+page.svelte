<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { showSidebar, user } from '$lib/stores';
	import { createJob, type CreateJobRequest } from '$lib/apis/jobs';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	// Form state
	let name = '';
	let goal = '';
	let autonomyLevel: 'supervised' | 'guided' | 'autonomous' = 'supervised';

	// UI state
	let loading = false;
	let error: string | null = null;

	async function handleSubmit() {
		if (!name.trim() || !goal.trim()) {
			error = 'Name and goal are required';
			return;
		}

		loading = true;
		error = null;

		try {
			const request: CreateJobRequest = {
				name: name.trim(),
				goal: goal.trim(),
				autonomy_level: autonomyLevel
			};

			const job = await createJob(localStorage.token, request);
			goto(`/jobs/${job.job_id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create job';
			console.error('Failed to create job:', e);
		} finally {
			loading = false;
		}
	}

	function handleCancel() {
		goto('/jobs');
	}
</script>

<div
	id="new-job-container"
	class="flex flex-col w-full h-screen max-h-[100dvh] {$showSidebar
		? 'md:max-w-[calc(100%-260px)]'
		: ''}"
>
	<!-- Header -->
	<nav class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center gap-3">
			<button
				class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
				on:click={handleCancel}
			>
				<svg
					class="size-5 text-gray-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					/>
				</svg>
			</button>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">
				{$i18n.t('Create New Job')}
			</h1>
		</div>
	</nav>

	<!-- Form -->
	<div class="flex-1 overflow-y-auto p-4">
		<div class="max-w-2xl mx-auto">
			<form on:submit|preventDefault={handleSubmit} class="space-y-6">
				{#if error}
					<div
						class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm"
					>
						{error}
					</div>
				{/if}

				<!-- Job Name -->
				<div>
					<label
						for="name"
						class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
					>
						{$i18n.t('Job Name')}
					</label>
					<input
						id="name"
						type="text"
						bind:value={name}
						placeholder={$i18n.t('e.g., Research competitor pricing')}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
						required
					/>
				</div>

				<!-- Goal / Description -->
				<div>
					<label
						for="goal"
						class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
					>
						{$i18n.t('Goal')}
					</label>
					<textarea
						id="goal"
						bind:value={goal}
						placeholder={$i18n.t('Describe what you want Aiden to accomplish...')}
						rows="4"
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent resize-none"
						required
					></textarea>
					<p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
						{$i18n.t('Be specific about the desired outcome. Aiden will break this down into actionable steps.')}
					</p>
				</div>

				<!-- Autonomy Level -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						{$i18n.t('Autonomy Level')}
					</label>
					<div class="space-y-2">
						<label
							class="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition {autonomyLevel ===
							'supervised'
								? 'ring-2 ring-black dark:ring-white border-transparent'
								: ''}"
						>
							<input
								type="radio"
								name="autonomy"
								value="supervised"
								bind:group={autonomyLevel}
								class="mt-0.5"
							/>
							<div>
								<div class="font-medium text-gray-900 dark:text-white text-sm">
									{$i18n.t('Supervised')}
								</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									{$i18n.t('Aiden asks for approval before each major step')}
								</div>
							</div>
						</label>

						<label
							class="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition {autonomyLevel ===
							'guided'
								? 'ring-2 ring-black dark:ring-white border-transparent'
								: ''}"
						>
							<input
								type="radio"
								name="autonomy"
								value="guided"
								bind:group={autonomyLevel}
								class="mt-0.5"
							/>
							<div>
								<div class="font-medium text-gray-900 dark:text-white text-sm">
									{$i18n.t('Guided')}
								</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									{$i18n.t('Aiden proceeds with low-risk steps, asks for critical decisions')}
								</div>
							</div>
						</label>

						<label
							class="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition {autonomyLevel ===
							'autonomous'
								? 'ring-2 ring-black dark:ring-white border-transparent'
								: ''}"
						>
							<input
								type="radio"
								name="autonomy"
								value="autonomous"
								bind:group={autonomyLevel}
								class="mt-0.5"
							/>
							<div>
								<div class="font-medium text-gray-900 dark:text-white text-sm">
									{$i18n.t('Autonomous')}
								</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									{$i18n.t('Aiden works independently, reports on completion')}
								</div>
							</div>
						</label>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
					<button
						type="button"
						on:click={handleCancel}
						class="px-3.5 py-1.5 text-sm font-medium dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white bg-gray-100 text-gray-700 hover:bg-gray-200 transition rounded-full"
					>
						{$i18n.t('Cancel')}
					</button>
					<button
						type="submit"
						disabled={loading || !name.trim() || !goal.trim()}
						class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{#if loading}
							<Spinner className="size-4" />
						{/if}
						{$i18n.t('Create Job')}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
