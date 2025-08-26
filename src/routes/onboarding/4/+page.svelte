<script lang="ts">
  import { Separator } from '$lib/components/ui/separator';
  import { Progress } from '$lib/components/ui/progress';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { Save, Loader2, Trash2, FolderPlus, CheckCircle2, XCircle } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  const formProgress = getContext<Writable<number>>('formProgress');
  formProgress.set(2);

  const linksDirs = writable<{ path: string; manager: string }[]>([]);
  const mountDirs = writable<string[]>([]); // ✅ Ajouté
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
        mountDirs.set(data.mount_dirs || []); // ✅ Ajout
        radarrApiKey.set(data.radarr_api_key || '');
        sonarrApiKey.set(data.sonarr_api_key || '');
      } else {
        message.set('❌ Erreur lors du chargement de la configuration');
      }
    } catch {
      message.set('🌐 Erreur réseau lors du chargement');
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
          mount_dirs: $mountDirs, // ✅ Ajout
          radarr_api_key: $radarrApiKey,
          sonarr_api_key: $sonarrApiKey
        })
      });
      if (res.ok) {
        message.set('✅ Configuration sauvegardée avec succès !');
      } else {
        message.set('❌ Erreur lors de la sauvegarde');
      }
    } catch {
      message.set('   Erreur réseau lors de la sauvegarde');
    } finally {
      saving.set(false);
    }
  }

  function addLinksDir() {
    linksDirs.update(dirs => [...dirs, { path: '', manager: 'sonarr' }]);
  }
  function removeLinksDir(index: number) {
    linksDirs.update(dirs => dirs.filter((_, i) => i !== index));
  }

  function addMountDir() {
    mountDirs.update(dirs => [...dirs, '']);
  }
  function removeMountDir(index: number) {
    mountDirs.update(dirs => dirs.filter((_, i) => i !== index));
  }

  onMount(loadConfig);
</script>

<main class="flex h-full w-full flex-col items-center overflow-x-hidden p-8 py-32 md:px-24 lg:px-32">
  <div class="flex w-full max-w-6xl flex-col items-start">
    <Progress class="mb-2 w-full" max={4} value={$formProgress} />
    <h1 class="mb-2 text-2xl font-bold md:text-3xl lg:text-4xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
        Étape 3/4 : Configuration des symlinks
    </h1>
    <p class="text-base md:text-lg text-gray-600 dark:text-gray-400">
      Définissez les dossiers utilisés pour les liens symboliques, les montages, et les clés API de Radarr/Sonarr.
    </p>
  </div>

  <div class="mt-4 flex w-full max-w-6xl flex-col">
    <Separator class="mb-8" />

    <form class="w-full space-y-10" on:submit|preventDefault={saveConfig}>
      <!-- Dossiers Liens Symboliques -->
      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">📂 Dossiers des liens symboliques</legend>
        {#each $linksDirs as linkDir, index (index)}
          <div in:slide out:fade class="flex flex-col md:flex-row md:items-center md:space-x-3 gap-2 bg-white/70 dark:bg-gray-800/60 backdrop-blur p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <input
              id={`linkDir-path-${index}`}
              type="text"
              bind:value={$linksDirs[index].path}
              placeholder="/home/maman/Medias/shows"
              class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              required
            />

            <select
              id={`linkDir-manager-${index}`}
              bind:value={$linksDirs[index].manager}
              class="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 transition"
              required
            >
              <option value="sonarr">Sonarr</option>
              <option value="radarr">Radarr</option>
            </select>

            <button
              type="button"
              on:click={() => removeLinksDir(index)}
              class="text-red-500 hover:text-red-600 transition-transform hover:scale-110"
              aria-label={`Supprimer le dossier ${index + 1}`}
            >
              <Trash2 class="w-5 h-5" />
            </button>
          </div>
        {/each}

        <button
          type="button"
          on:click={addLinksDir}
          class="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500 text-emerald-600 font-medium bg-white/60 dark:bg-gray-800/40 backdrop-blur hover:bg-emerald-50 dark:hover:bg-gray-800 transition"
        >
          <FolderPlus class="w-4 h-4" /> Ajouter un dossier
        </button>
      </fieldset>

      <!-- Dossiers montés -->
      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">🗂️ Dossiers montés</legend>
        {#each $mountDirs as mountDir, index (index)}
          <div in:slide out:fade class="flex items-center gap-2 bg-white/70 dark:bg-gray-800/60 backdrop-blur p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <input
              id={`mountDir-${index}`}
              type="text"
              bind:value={$mountDirs[index]}
              placeholder="/home/maman/alldebrid/torrents"
              class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              required
            />
            <button
              type="button"
              on:click={() => removeMountDir(index)}
              class="text-red-500 hover:text-red-600 transition-transform hover:scale-110"
            >
              <Trash2 class="w-5 h-5" />
            </button>
          </div>
        {/each}

        <button
          type="button"
          on:click={addMountDir}
          class="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500 text-emerald-600 font-medium bg-white/60 dark:bg-gray-800/40 backdrop-blur hover:bg-emerald-50 dark:hover:bg-gray-800 transition"
        >
          <FolderPlus class="w-4 h-4" /> Ajouter un dossier monté
        </button>
      </fieldset>

      <!-- API Keys -->
      <fieldset class="space-y-6">
        <div>
          <label for="radarrApiKey" class="legend-azure">🔑 Clé API Radarr</label>
          <input
            id="radarrApiKey"
            type="text"
            bind:value={$radarrApiKey}
            placeholder="Radarr ApiKey"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            required
          />
        </div>

        <div>
          <label for="sonarrApiKey" class="legend-azure">🔑 Clé API Sonarr</label>
          <input
            id="sonarrApiKey"
            type="text"
            bind:value={$sonarrApiKey}
            placeholder="Sonarr ApiKey"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            required
          />
        </div>
      </fieldset>

      <!-- Bouton de sauvegarde + feedback -->
      <div class="flex items-center space-x-4">
        <button
            type="submit"
            class="flex items-center gap-2 px-6 py-3 rounded-xl 
                   bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 
                   text-white font-semibold shadow-md 
                   hover:brightness-110 active:scale-95 
                   transition-all duration-200 
                   disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div in:fade out:fade class="flex items-center gap-2 px-3 py-2 rounded-lg shadow text-sm font-medium
            { $message.startsWith('✅') 
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }">
            {#if $message.startsWith('✅')}
              <CheckCircle2 class="w-4 h-4" />
            {:else}
              <XCircle class="w-4 h-4" />
            {/if}
            <span>{$message}</span>
          </div>
        {/if}
      </div>
    </form>
  </div>

  <div class="mt-8 self-end">
    <a
        href="/onboarding/5"
        class="px-4 py-2 text-sm font-semibold rounded-lg shadow-md
               bg-gradient-to-r from-emerald-600 to-lime-500
               hover:from-emerald-500 hover:to-lime-400
               disabled:opacity-50 transition-all inline-flex items-center justify-center"
    >
        ✅ Terminer
    </a>
  </div>
</main>

<style>
  .legend-azure {
    color: #00BFFF;
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: block;
  }
</style>
