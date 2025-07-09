<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { Save, Loader2 } from 'lucide-svelte';

  const linksDir = writable('');
  const mountDir = writable('');
  const message = writable('');
  const saving = writable(false);

  async function loadConfig() {
    try {
      const res = await fetch('/api/v1/symlinks/config');
      if (res.ok) {
        const data = await res.json();
        linksDir.set(data.links_dir);
        mountDir.set(data.mount_dir);
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
          links_dir: $linksDir,
          mount_dir: $mountDir
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

  onMount(loadConfig);
</script>

<main class="p-8 space-y-6 min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-200 w-full">
  <div class="space-y-1 w-full">
    <h1 class="text-2xl font-semibold">Configuration Alfred</h1>
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Définissez les dossiers utilisés pour les liens symboliques et les fichiers montés RealDebrid.
    </p>
  </div>

  <form class="w-full space-y-6" on:submit|preventDefault={saveConfig}>
    <div>
      <label for="linksDir" class="block mb-2 font-medium">Dossier des liens symboliques</label>
      <input
        id="linksDir"
        type="text"
        bind:value={$linksDir}
        placeholder="/links"
        class="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
    </div>

    <div>
      <label for="mountDir" class="block mb-2 font-medium">Dossier monté RealDebrid</label>
      <input
        id="mountDir"
        type="text"
        bind:value={$mountDir}
        placeholder="/mnt/rd"
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
