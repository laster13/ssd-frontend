<script lang="ts">
	import type { PageData } from './$types';
	import SeedboxForm from '$lib/forms/seedbox-form.svelte';
	import { Separator } from '$lib/components/ui/separator';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { Progress } from '$lib/components/ui/progress';

	const formProgress = getContext<Writable<number>>('formProgress');
	formProgress.set(1);

	export let data: PageData;
</script>

<div class="flex h-full w-full flex-col items-center overflow-x-hidden p-8 py-32 md:px-24 lg:px-32">
	<div class="flex w-full max-w-6xl flex-col items-start">
		<Progress class="mb-2 w-full" max={6} value={$formProgress} />
		<h1 class="mb-2 text-2xl font-bold md:text-3xl lg:text-4xl">Step 2/3</h1>
		<p class="text-base md:text-lg">Configuration des infos, compléter si necessaire puis valider.</p>
	</div>
	<div class="mt-4 flex w-full max-w-6xl flex-col">
		<Separator class="mb-8" />
		<SeedboxForm data={data.form} actionUrl="/settings/seedbox?onboarding=true" />
	</div>
</div>
