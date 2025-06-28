<script lang="ts">
	import Header from '$lib/components/header.svelte';
	import DockerContainerList from '$lib/components/DockerContainerList.svelte';
</script>

<svelte:head>
	<title>SSDv2 | Home</title>
</svelte:head>

<!-- ? ajoute ici le header -->
<Header />

<!-- puis ta page principale -->
<DockerContainerList />

