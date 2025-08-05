<script lang="ts">
	import { page } from '$app/stores';
	import { Separator } from '$lib/components/ui/separator';
	import { Progress } from '$lib/components/ui/progress';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { Save, Loader2, Trash2 } from 'lucide-svelte';

	const formProgress = getContext<Writable<number>>('formProgress');
	formProgress.set(4);

	const linksDirs = writable<string[]>([]);
	const mountDirs = writable<string[]>([]);
	const radarrApiKey = writable('');
	const sonarrApiKey = writable('');
	const message = writable('');
	const saving = writable(false);

	async function loadConfig() {
		try {
			const res = await fetch('/api/v1/symlinks/config');
			if (res.ok) {
				const data = await res.json();
				linksDirs.set(data.links_dirs || []);
				mountDirs.set(data.mount_dirs || []);
				radarrApiKey.set(data.radarr_api_key || '');
				sonarrApiKey.set(data.sonarr_api_key || '');
			} else {
				message.set('Erreur lors du chargement de la configuration');
			}
		} catch {
			message.set('Erreur réseau lors du chargement');
		}
	}

	async function saveConfig() {
		saving.set(true);
		message.set('');
		try {
			const res = await fetch('/api/v1/symlinks/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					links_dirs: $linksDirs,
					mount_dirs: $mountDirs,
					radarr_api_key: $radarrApiKey,
					sonarr_api_key: $sonarrApiKey
				})
			});
			if (res.ok) {
				message.set('Configuration sauvegardée avec succès !');
			} else {
				message.set('Erreur lors de la sauvegarde');
			}
		} catch {
			message.set('Erreur réseau lors de la sauvegarde');
		} finally {
			saving.set(false);
		}
	}

	function addLinksDir() {
		linksDirs.update(dirs => [...dirs, '']);
	}

	function addMountDir() {
		mountDirs.update(dirs => [...dirs, '']);
	}

	function removeLinksDir(index: number) {
		linksDirs.update(dirs => dirs.filter((_, i) => i !== index));
	}

	function removeMountDir(index: number) {
		mountDirs.update(dirs => dirs.filter((_, i) => i !== index));
	}

	onMount(loadConfig);
</script>

<main class="flex h-full w-full flex-col items-center overflow-x-hidden p-8 py-32 md:px-24 lg:px-32">
	<div class="flex w-full max-w-6xl flex-col items-start">
		<Progress class="mb-2 w-full" max={4} value={$formProgress} />
		<h1 class="mb-2 text-2xl font-bold md:text-3xl lg:text-4xl">Étape 4/4 : Configuration des symlinks</h1>
		<p class="text-base md:text-lg text-gray-600 dark:text-gray-400">Définissez les dossiers utilisés pour les liens symboliques et les clés API de Radarr/Sonarr.
</p>
	</div>

	<div class="mt-4 flex w-full max-w-6xl flex-col">
		<Separator class="mb-8" />

  <form class="w-full space-y-6" on:submit|preventDefault={saveConfig}>
    <!-- Dossiers Liens Symboliques -->
    <fieldset>
      <legend class="legend-azure">Dossiers des liens symboliques</legend>
      {#each $linksDirs as linkDir, index}
        <div class="flex items-center space-x-2 mb-2">
          <label for={`linkDir-${index}`} class="sr-only">Chemin lien symbolique {index + 1}</label>
          <input
            id={`linkDir-${index}`}
            name={`linkDir-${index}`}
            type="text"
            bind:value={$linksDirs[index]}
            placeholder="/links"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 hover:scale-[1.01]"
            required
          />
          <button
            type="button"
            on:click={() => removeLinksDir(index)}
            class="text-red-500 hover:text-red-600 transition-transform hover:scale-110"
            aria-label={`Supprimer le chemin lien symbolique ${index + 1}`}
          >
            <Trash2 class="w-5 h-5" />
          </button>
        </div>
      {/each}
      <button type="button" on:click={addLinksDir} class="mt-2 inline-flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-700 transition-transform hover:scale-105">
        ➕ Ajouter un chemin
      </button>
    </fieldset>

    <!-- Dossiers montés RealDebrid -->
    <fieldset>
      <legend  class="legend-azure">Dossiers montés RealDebrid/Alledbrid</legend>
      {#each $mountDirs as mountDir, index}
        <div class="flex items-center space-x-2 mb-2">
          <label for={`mountDir-${index}`} class="sr-only">Chemin RealDebrid {index + 1}</label>
          <input
            id={`mountDir-${index}`}
            name={`mountDir-${index}`}
            type="text"
            bind:value={$mountDirs[index]}
            placeholder="/mnt/rd"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 hover:scale-[1.01]"
            required
          />
          <button
            type="button"
            on:click={() => removeMountDir(index)}
            class="text-red-500 hover:text-red-600 transition-transform hover:scale-110"
            aria-label={`Supprimer le chemin RealDebrid ${index + 1}`}
          >
            <Trash2 class="w-5 h-5" />
          </button>
        </div>
      {/each}
      <button type="button" on:click={addMountDir} class="mt-2 inline-flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-700 transition-transform hover:scale-105">
        ➕ Ajouter un chemin
      </button>
    </fieldset>

    <!-- API Keys -->
    <div>
      <label for="radarrApiKey" class="legend-azure">Clé API Radarr</label>
      <input
        id="radarrApiKey"
        type="text"
        bind:value={$radarrApiKey}
        placeholder="radarr ApiKey"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 hover:scale-[1.01]"
        required
      />
    </div>

    <div>
      <label for="sonarrApiKey" class="legend-azure">Clé API Sonarr</label>
      <input
        id="sonarrApiKey"
        type="text"
        bind:value={$sonarrApiKey}
        placeholder="sonarr ApiKey"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 hover:scale-[1.01]"
        required
      />
    </div>

    <!-- Bouton de sauvegarde -->
    <div class="flex items-center space-x-4">
      <button
        type="submit"
        class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-medium shadow-md hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={$saving}
      >
        {#if $saving}
          <Loader2 class="animate-spin w-5 h-5" />
          Sauvegarde...
        {:else}
          <Save class="w-5 h-5" />
          Sauvegarder
        {/if}
      </button>

      {#if $message}
        <p class="text-sm text-emerald-600 dark:text-emerald-400">{ $message }</p>
      {/if}
    </div>
  </form>
	</div>

	<div class="mt-8 self-end">
		<a href="/onboarding/ssd" class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-white shadow-md transition-transform duration-150 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-emerald-400">
			✅ Terminer
		</a>
	</div>
</main>
<style>
  label {
    color: var(--text-color);
  }
  .legend-azure {
    color: #00BFFF; /* Bleu azur classique */
    font-weight: 500;
    margin-bottom: 0.5rem;
    display: block;
  }
</style>

