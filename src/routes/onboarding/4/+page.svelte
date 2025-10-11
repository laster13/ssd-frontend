<script lang="ts">
  import { Separator } from '$lib/components/ui/separator';
  import { Progress } from '$lib/components/ui/progress';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { Save, Loader2, Trash2, FolderPlus, CheckCircle2, XCircle, BellRing } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  const formProgress = getContext<Writable<number>>('formProgress');
  formProgress.set(2);

  const linksDirs = writable<{ path: string; manager: string }[]>([]);
  const radarrApiKey = writable('');
  const sonarrApiKey = writable('');
  const tmdbApiKey = writable('');
  const message = writable('');
  const discordWebhook = writable('');
  const saving = writable(false);

  // === INSTANCES ALLDEBRID ===
  const alldebridInstances = writable<
    {
      name: string;
      api_key: string;
      mount_path: string;
      cache_path: string;
      rate_limit?: number;
      priority?: number;
      enabled?: boolean;
    }[]
  >([]);

  function addInstance() {
    alldebridInstances.update(list => [
      ...list,
      {
        name: '',
        api_key: '',
        mount_path: '',
        cache_path: '',
        rate_limit: 0.2,
        priority: 1,
        enabled: true
      }
    ]);
  }

  async function deleteInstance(name: string) {
    if (!confirm(`Supprimer l'instance "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/v1/instances/alldebrid/${name}`, { method: 'DELETE' });
      if (res.ok) {
        message.set(`🗑️ Instance ${name} supprimée`);
        loadConfig();
      } else {
        message.set('❌ Erreur lors de la suppression');
      }
    } catch {
      message.set('🌐 Erreur réseau');
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/v1/symlinks/config');
      if (res.ok) {
        const data = await res.json();
        linksDirs.set(data.links_dirs || []);
        radarrApiKey.set(data.radarr_api_key || '');
        sonarrApiKey.set(data.sonarr_api_key || '');
        tmdbApiKey.set(data.tmdb_api_key || '');
        discordWebhook.set(data.discord_webhook_url || '');
      } else {
        message.set('❌ Erreur lors du chargement de la configuration');
      }

      // 🔹 Charge aussi les instances AllDebrid
      const alldebridRes = await fetch('/api/v1/instances/alldebrid');
      if (alldebridRes.ok) {
        alldebridInstances.set(await alldebridRes.json());
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
          radarr_api_key: $radarrApiKey,
          sonarr_api_key: $sonarrApiKey,
          tmdb_api_key: $tmdbApiKey,
          discord_webhook_url: $discordWebhook,
          alldebrid_instances: $alldebridInstances
        })
      });
      if (res.ok) {
        message.set('✅ Configuration sauvegardée avec succès !');
      } else {
        message.set('❌ Erreur lors de la sauvegarde');
      }
    } catch {
      message.set('🌐 Erreur réseau lors de la sauvegarde');
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
              placeholder="/home/ubuntu/Medias/shows"
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

        <div>
            <label for="tmdbApiKey" class="legend-azure">🔑 Clé API TMDB</label>
            <input
                id="tmdbApiKey"
                type="text"
                bind:value={$tmdbApiKey}
                placeholder="TMDB ApiKey"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                required
            />
        </div>
      </fieldset>

      <!-- Discord Webhook -->
      <fieldset class="space-y-6">
        <legend class="legend-azure text-lg font-semibold">🔔 Notifications Discord</legend>
        <div class="flex items-center gap-3 
            bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-4 rounded-xl shadow 
            border border-gray-200 dark:border-gray-700">
          <BellRing class="w-5 h-5 text-indigo-500"/>
          <input id="discordWebhook" type="text"
            bind:value={$discordWebhook}
            placeholder="https://discord.com/api/webhooks/xxxxx/xxxxx"
            class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>
      </fieldset>

      <!-- 🧩 Instances AllDebrid -->
      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">
          🧩 Instances AllDebrid -
          <span class="text-sm font-normal">
            Suppression des fichiers Alldebrid non rattachés à un symlink (Optionnel)
          </span>
        </legend>

        <div class="space-y-4">
          {#each $alldebridInstances as instance, index (index)}
            <div
              in:fade
              out:fade
              class="flex flex-col gap-4 bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-5 rounded-xl shadow border border-gray-200 dark:border-gray-700"
            >
              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label for={`ad-name-${index}`} class="block text-sm text-gray-600 mb-1">
                    Nom de l'instance
                  </label>
                  <input
                    id={`ad-name-${index}`}
                    placeholder="Ex : AllDebrid_Premier"
                    bind:value={$alldebridInstances[index].name}
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>

                <div>
                  <label for={`ad-key-${index}`} class="block text-sm text-gray-600 mb-1">
                    Clé API
                  </label>
                  <input
                    id={`ad-key-${index}`}
                    placeholder="API Key AllDebrid"
                    bind:value={$alldebridInstances[index].api_key}
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>

                <div>
                  <label for={`ad-mount-${index}`} class="block text-sm text-gray-600 mb-1">
                    Chemin de montage
                  </label>
                  <input
                    id={`ad-mount-${index}`}
                    placeholder="/mnt/alldebrid/torrents"
                    bind:value={$alldebridInstances[index].mount_path}
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>

                <div>
                  <label for={`ad-cache-${index}`} class="block text-sm text-gray-600 mb-1">
                    Chemin cache
                  </label>
                  <input
                    id={`ad-cache-${index}`}
                    placeholder="/home/ubuntu/docker/ubuntu/decypharr/cache/alldebrid"
                    bind:value={$alldebridInstances[index].cache_path}
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  type="button"
                  on:click={() => deleteInstance(instance.name)}
                  class="text-red-500 hover:text-red-600 flex items-center gap-1 text-sm"
                >
                  <Trash2 class="w-4 h-4" /> Supprimer
                </button>
              </div>
            </div>
          {/each}
        </div>

        <button
          type="button"
          on:click={addInstance}
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500 text-emerald-600 font-medium bg-white/60 dark:bg-gray-800/40 backdrop-blur hover:bg-emerald-50 dark:hover:bg-gray-800 transition"
        >
          <FolderPlus class="w-4 h-4" /> Ajouter une instance
        </button>
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
