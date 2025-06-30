<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Loader2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	let containers = [];
	let loading = true;
	let error = '';
	let loadingId: string | null = null;
	let currentAction: 'start' | 'stop' | 'restart' | null = null;
	let intervalId: any;
	let domainMap: Record<string, string> = {};

	// Chargement des conteneurs et domaines
	async function loadContainers() {
		try {
			// 1. Charger les domaines avant les conteneurs
                        const resDomains = await fetch('/api/v1/scripts/domains');

			if (!resDomains.ok) throw new Error('Erreur chargement domaines');
			domainMap = await resDomains.json();

			// 2. Charger les conteneurs
			const res = await fetch('/api/docker');
			if (!res.ok) throw new Error('Erreur réseau');
			const data = await res.json();

			// 3. Associer les domaines à chaque conteneur
			containers = data.containers.map((c: any) => {
				const matchedDomain = domainMap[c.name] || null;
				console.log(`Conteneur ${c.name} → ${matchedDomain}`);
				return { ...c, domain: matchedDomain };
			});

			error = '';
		} catch (e) {
			error = 'Impossible de charger les conteneurs.';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	// Actions Docker
	async function sendAction(id: string, action: 'start' | 'stop' | 'restart') {
		loadingId = id;
		currentAction = action;
		try {
			const res = await fetch('/api/docker', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, action })
			});
			if (!res.ok) throw new Error('Erreur action');
		} catch (e) {
			console.error(e);
			alert(`Erreur lors de ${action} ${id}`);
		} finally {
			loadingId = null;
			currentAction = null;
			await loadContainers();
		}
	}

	onMount(() => {
		loadContainers();
		intervalId = setInterval(loadContainers, 1000);
	});

	onDestroy(() => {
		clearInterval(intervalId);
	});
</script>

<div class="px-6 pt-32 pb-8">
	<h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4">Conteneurs Docker</h2>

	{#if loading}
		<p class="text-zinc-700 dark:text-white">Chargement…</p>
	{:else if error}
		<p class="text-red-500">{error}</p>
	{:else if containers.length === 0}
		<p class="text-zinc-700 dark:text-white">Aucun conteneur trouvé.</p>
	{:else}
		<div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
			{#each containers as c}
				<div class="rounded-xl bg-white dark:bg-zinc-800 p-4 text-zinc-900 dark:text-white shadow-sm text-sm flex flex-col justify-between border border-zinc-200 dark:border-zinc-700">
					<div>
						<h3 class="text-base font-semibold mb-1 text-indigo-600 dark:text-indigo-400">
							{#if c.domain}
								<a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer">{c.name}</a>
							{:else}
								{c.name}
							{/if}
						</h3>
						<p class="text-xs text-zinc-600 dark:text-zinc-400 truncate"><strong>Image:</strong> {c.image}</p>
						<p class="text-xs text-zinc-600 dark:text-zinc-400 truncate"><strong>ID:</strong> {c.id}</p>
						<p class="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-1"><strong>CPU:</strong> {c.cpu}</p>
						<p class="text-xs text-zinc-600 dark:text-zinc-400 truncate"><strong>RAM:</strong> {c.memPerc}</p>
						{#if c.domain}
							<p class="text-xs text-zinc-600 dark:text-zinc-400 truncate"><strong>Domaine:</strong> {c.domain}</p>
						{/if}
						<p class="flex items-center gap-2 mt-2 mb-3">
							<span class={`w-2 h-2 rounded-full ${c.status.includes('Up') ? 'bg-green-500' : 'bg-red-500'}`}></span>
							<span class="text-xs text-zinc-700 dark:text-zinc-300">{c.status}</span>
						</p>
					</div>
					<div class="flex justify-end gap-2 flex-wrap mt-auto">
						<Button size="sm" variant="default" disabled={loadingId === c.id} on:click={() => sendAction(c.id, 'restart')}>
							{#if loadingId === c.id && currentAction === 'restart'}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								<span class="text-xs">Redémarrage</span>
							{:else}
								<span class="text-xs">Redémarrer</span>
							{/if}
						</Button>
						{#if !c.status.includes('Up')}
							<Button size="sm" variant="default" disabled={loadingId === c.id} on:click={() => sendAction(c.id, 'start')}>
								{#if loadingId === c.id && currentAction === 'start'}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									<span class="text-xs">Démarrage</span>
								{:else}
									<span class="text-xs">Démarrer</span>
								{/if}
							</Button>
						{/if}
						{#if c.status.includes('Up')}
							<Button size="sm" variant="destructive" disabled={loadingId === c.id} on:click={() => sendAction(c.id, 'stop')}>
								{#if loadingId === c.id && currentAction === 'stop'}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									<span class="text-xs">Arrêt</span>
								{:else}
									<span class="text-xs">Arrêter</span>
								{/if}
							</Button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
