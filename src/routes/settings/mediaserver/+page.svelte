<script lang="ts">
	import type { PageData } from './$types';
	import MediaServerForm from '$lib/forms/media-server-form.svelte';

	export let data: PageData;
</script>

<div class="flex flex-col">
	<h2 class="text-xl font-medium md:text-2xl">Media Server Settings</h2>
	<p class="text-sm text-muted-foreground md:text-base">
		Configuration du serveur de Médias SSD.
	</p>

	<MediaServerForm data={data.form} actionUrl="/settings/mediaserver" />
</div>
