<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { Save, Loader2, Trash2 } from 'lucide-svelte';

  const linksDirs = writable([]);  // Tableau pour stocker plusieurs chemins de liens symboliques
  const mountDirs = writable([]);  // Tableau pour stocker plusieurs chemins de montages
  const radarrApiKey = writable('');
  const sonarrApiKey = writable('');
  const message = writable('');
  const saving = writable(false);

  // Fonction pour charger la configuration initiale
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

  // Fonction pour sauvegarder la configuration
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

  // Ajouter un chemin de lien symbolique
  function addLinksDir() {
    linksDirs.update(dirs => [...dirs, '']);
  }

  // Ajouter un chemin de montage
  function addMountDir() {
    mountDirs.update(dirs => [...dirs, '']);
  }

  // Supprimer un chemin de lien symbolique
  function removeLinksDir(index) {
    linksDirs.update(dirs => dirs.filter((_, i) => i !== index));
  }

  // Supprimer un chemin de montage
  function removeMountDir(index) {
    mountDirs.update(dirs => dirs.filter((_, i) => i !== index));
  }

  // Charger la configuration initiale
  onMount(loadConfig);
</script>

<main class="p-8 space-y-6 min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-200 w-full">
  <div class="space-y-1 w-full">
    <h1 class="text-2xl font-semibold">Configuration Alfred</h1>
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Définissez les dossiers utilisés pour les liens symboliques et les clés API de Radarr/Sonarr.
    </p>
  </div>

  <form class="w-full space-y-6" on:submit|preventDefault={saveConfig}>
    <!-- Liste des chemins des liens symboliques -->
    <div>
      <label for="linksDirs" class="block mb-2 font-medium">Dossiers des liens symboliques</label>
      {#each $linksDirs as linkDir, index}
        <div class="flex items-center space-x-2">
          <input
            id="linksDir-{index}"
            type="text"
            bind:value={$linksDirs[index]}
            placeholder="/links"
            class="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button type="button" on:click={() => removeLinksDir(index)} class="text-red-600">
            <Trash2 class="w-5 h-5" />
          </button>
        </div>
      {/each}
      <button type="button" on:click={addLinksDir} class="text-blue-600">Ajouter un chemin</button>
    </div>

    <!-- Liste des chemins des montages -->
    <div>
      <label for="mountDirs" class="block mb-2 font-medium">Dossiers montés RealDebrid</label>
      {#each $mountDirs as mountDir, index}
        <div class="flex items-center space-x-2">
          <input
            id="mountDir-{index}"
            type="text"
            bind:value={$mountDirs[index]}
            placeholder="/mnt/rd"
            class="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button type="button" on:click={() => removeMountDir(index)} class="text-red-600">
            <Trash2 class="w-5 h-5" />
          </button>
        </div>
      {/each}
      <button type="button" on:click={addMountDir} class="text-blue-600">Ajouter un chemin</button>
    </div>

    <!-- Clés API -->
    <div>
      <label for="radarrApiKey" class="block mb-2 font-medium">Clé API Radarr</label>
      <input
        id="radarrApiKey"
        type="text"
        bind:value={$radarrApiKey}
        placeholder="xxxxxxxxxxxxxxxxxxxx"
        class="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
    </div>

    <div>
      <label for="sonarrApiKey" class="block mb-2 font-medium">Clé API Sonarr</label>
      <input
        id="sonarrApiKey"
        type="text"
        bind:value={$sonarrApiKey}
        placeholder="xxxxxxxxxxxxxxxxxxxx"
        class="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
    </div>

    <div class="flex items-center space-x-4">
      <button
        type="submit"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={$saving}
      >
        {#if $saving}
          <Loader2 class="animate-spin w-5 h-5" />
          Sauvegarde en cours...
        {:else}
          <Save class="w-5 h-5" /> Sauvegarder
        {/if}
      </button>

      {#if $message}
        <p class="text-sm text-green-600 dark:text-green-400">{ $message }</p>
      {/if}
    </div>
  </form>
</main>

<style>
  label {
    color: var(--text-color);
  }
</style>
