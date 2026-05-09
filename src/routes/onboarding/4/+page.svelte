<script lang="ts">
  import { Separator } from '$lib/components/ui/separator';
  import { Progress } from '$lib/components/ui/progress';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import {
    Save, Loader2, Trash2, FolderPlus, CheckCircle2, XCircle, BellRing
  } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import FileExplorer from '$lib/components/FileExplorer.svelte';

  const formProgress = getContext<Writable<number>>('formProgress');
  formProgress.set(2);

  // === TYPES ===
  type LinkDir = {
    path: string;
    manager: string;
  };

  type AllDebridInstance = {
    name: string;
    api_key: string;
    mount_path: string;
    rate_limit: number;
    priority: number;
    enabled: boolean;
  };

  type ToastState = {
    msg: string;
    type: 'success' | 'error';
  } | null;

  // === STORES ===
  const linksDirs = writable<LinkDir[]>([]);
  const radarrApiKey = writable('');
  const sonarrApiKey = writable('');
  const tmdbApiKey = writable('');
  const discordWebhook = writable('');
  const alldebridInstances = writable<AllDebridInstance[]>([]);
  const saving = writable(false);
  const toast = writable<ToastState>(null);

  // === Explorateur ===
  let showExplorer = false;
  let explorerIndex: number | null = null;
  let defaultMediaPath = '';

  async function initDefaultPath() {
    try {
      const res = await fetch('/api/v1/symlinks/fs');
      if (res.ok) {
        const data = await res.json();
        defaultMediaPath = data.root || '/Medias';
      } else {
        defaultMediaPath = '/Medias';
      }
    } catch {
      defaultMediaPath = '/Medias';
    }
  }

  function openExplorer(index: number | null = null) {
    explorerIndex = index;
    showExplorer = true;
  }

  function handleSelect(paths: string[]) {
    if (!paths || paths.length === 0) {
      showExplorer = false;
      return;
    }

    linksDirs.update((dirs) => {
      const existingPaths = new Set(dirs.map((d) => d.path));

      if (explorerIndex !== null && dirs[explorerIndex]) {
        const [first, ...rest] = paths;
        dirs[explorerIndex].path = first;

        const refreshedPaths = new Set(dirs.map((d) => d.path));
        const newDirs = rest
          .filter((p) => !refreshedPaths.has(p))
          .map((path) => ({ path, manager: 'sonarr' }));

        return [...dirs, ...newDirs];
      }

      const newDirs = paths
        .filter((p) => !existingPaths.has(p))
        .map((path) => ({ path, manager: 'sonarr' }));

      return [...dirs, ...newDirs];
    });

    showExplorer = false;
    explorerIndex = null;
  }

  // === TOAST SYSTEM ===
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toast.set({ msg, type });
    setTimeout(() => toast.set(null), 3000);
  }

  // === CHARGEMENT CONFIG ===
  async function loadConfig() {
    try {
      const res = await fetch('/api/v1/symlinks/config');
      if (!res.ok) {
        showToast('❌ Impossible de charger la configuration', 'error');
        return;
      }

      const data = await res.json();

      linksDirs.set(data.links_dirs || []);
      radarrApiKey.set(data.radarr_api_key || '');
      sonarrApiKey.set(data.sonarr_api_key || '');
      tmdbApiKey.set(data.tmdb_api_key || '');
      discordWebhook.set(data.discord_webhook_url || '');
      alldebridInstances.set(
        (data.alldebrid_instances || []).map((instance: Partial<AllDebridInstance>) => ({
          name: instance.name || '',
          api_key: instance.api_key || '',
          mount_path: instance.mount_path || '',
          rate_limit: instance.rate_limit ?? 0.2,
          priority: instance.priority ?? 1,
          enabled: instance.enabled ?? true
        }))
      );
    } catch {
      showToast('🌐 Erreur réseau', 'error');
    }
  }

  // === SAUVEGARDE CONFIG ===
  async function saveConfig() {
    saving.set(true);

    try {
      const currentRes = await fetch('/api/v1/symlinks/config');
      const currentData = currentRes.ok ? await currentRes.json() : {};

      const cleanedInstances = $alldebridInstances.map((instance) => ({
        name: instance.name?.trim() || '',
        api_key: instance.api_key?.trim() || '',
        mount_path: instance.mount_path?.trim() || '',
        rate_limit: Number(instance.rate_limit ?? 0.2),
        priority: Number(instance.priority ?? 1),
        enabled: Boolean(instance.enabled ?? true)
      }));

      const updatedConfig = {
        ...currentData,
        links_dirs: $linksDirs,
        radarr_api_key: $radarrApiKey,
        sonarr_api_key: $sonarrApiKey,
        tmdb_api_key: $tmdbApiKey,
        discord_webhook_url: $discordWebhook,
        alldebrid_instances: cleanedInstances
      };

      const res = await fetch('/api/v1/symlinks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });

      if (res.ok) {
        showToast('✅ Configuration complète sauvegardée !');
        await loadConfig();
      } else {
        showToast('❌ Erreur lors de la sauvegarde', 'error');
      }
    } catch {
      showToast('🌐 Erreur réseau', 'error');
    } finally {
      saving.set(false);
    }
  }

  // === LIENS SYMLINKS ===
  function removeLinksDir(index: number) {
    linksDirs.update((dirs) => dirs.filter((_, i) => i !== index));
  }

  // === INSTANCES ALLDEBRID ===
  function addInstance() {
    alldebridInstances.update((list) => [
      ...list,
      {
        name: '',
        api_key: '',
        mount_path: '',
        rate_limit: 0.2,
        priority: 1,
        enabled: true
      }
    ]);
  }

  function removeInstance(index: number) {
    alldebridInstances.update((list) => list.filter((_, i) => i !== index));
  }

  onMount(async () => {
    await initDefaultPath();
    await loadConfig();
  });
</script>

<main class="flex h-full w-full flex-col items-center overflow-x-hidden p-8 py-32 md:px-24 lg:px-32">
  {#if $toast}
    <div
      in:slide
      out:fade
      class="fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2
        {$toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}"
    >
      {#if $toast.type === 'success'}
        <CheckCircle2 class="w-5 h-5" />
      {:else}
        <XCircle class="w-5 h-5" />
      {/if}
      <span class="font-medium">{$toast.msg}</span>
    </div>
  {/if}

  <div class="flex w-full max-w-6xl flex-col items-start">
    <Progress class="mb-2 w-full" max={4} value={$formProgress} />
    <h1 class="mb-2 text-2xl font-bold md:text-3xl lg:text-4xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
      Étape 3/4 : Configuration générale
    </h1>
    <p class="text-base md:text-lg text-gray-600 dark:text-gray-400">
      Dossiers, API Keys, Discord et instances AllDebrid.
    </p>
  </div>

  <div class="mt-4 flex w-full max-w-6xl flex-col">
    <Separator class="mb-8" />

    <form class="w-full space-y-12" on:submit|preventDefault={saveConfig}>
      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">📂 Dossiers symlinks</legend>

        <div class="space-y-3">
          {#each $linksDirs as linkDir, index (index)}
            <div
              class="flex flex-col md:flex-row gap-3 bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700"
            >
              <button
                type="button"
                on:click={() => openExplorer(index)}
                class="explorer-btn"
                aria-label="Ouvrir l’explorateur de fichiers"
                title="Ouvrir l’explorateur"
              >
                <FolderPlus class="w-5 h-5" />
              </button>

              <input
                type="text"
                bind:value={$linksDirs[index].path}
                placeholder="/Medias/shows"
                class="flex-1 input font-medium"
                required
              />

              <select bind:value={$linksDirs[index].manager} class="input font-medium" required>
                <option value="sonarr">Sonarr</option>
                <option value="radarr">Radarr</option>
              </select>

              <button
                type="button"
                on:click={() => removeLinksDir(index)}
                class="text-red-500 hover:text-red-600 hover:scale-110 transition"
                aria-label="Supprimer ce dossier"
              >
                <Trash2 class="w-5 h-5" />
              </button>
            </div>
          {/each}
        </div>

        <button type="button" on:click={() => openExplorer(null)} class="btn-outline">
          <FolderPlus class="w-4 h-4" /> Ajouter un dossier
        </button>
      </fieldset>

      <fieldset class="space-y-6">
        <legend class="legend-azure text-lg font-semibold">🔑 Clés API</legend>

        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <label for="radarrApiKey" class="label">Radarr API Key</label>
            <input id="radarrApiKey" type="text" bind:value={$radarrApiKey} class="input w-full" required />
          </div>

          <div>
            <label for="sonarrApiKey" class="label">Sonarr API Key</label>
            <input id="sonarrApiKey" type="text" bind:value={$sonarrApiKey} class="input w-full" required />
          </div>

          <div>
            <label for="tmdbApiKey" class="label">TMDB API Key</label>
            <input
              id="tmdbApiKey"
              type="text"
              bind:value={$tmdbApiKey}
              class="input w-full"
              required
            />
            <div class="flex items-center text-yellow-600 text-sm mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01M10.29 3.86l-7.37 12.8A1 1 0 004 19h16a1 1 0 00.87-1.47l-7.37-12.8a1 1 0 00-1.74 0z" />
              </svg>
              <span>
                Obtenez votre clé API sur
                <a
                  href="https://www.themoviedb.org/settings/api?language=fr"
                  target="_blank"
                  rel="noreferrer"
                  class="underline hover:text-yellow-700 transition"
                >
                  themoviedb.org
                </a>.
              </span>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="space-y-6">
        <legend class="legend-azure text-lg font-semibold">🔔 Notifications Discord</legend>

        <div class="flex items-center gap-3 bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700">
          <BellRing class="w-5 h-5 text-indigo-500" />
          <label for="discordWebhook" class="sr-only">Discord Webhook</label>
          <input
            id="discordWebhook"
            type="text"
            bind:value={$discordWebhook}
            placeholder="https://discord.com/api/webhooks/xxxxx/xxxxx"
            class="flex-1 input"
          />
        </div>
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">
          🧩 Instances AllDebrid –
          <span class="text-sm font-normal">scan et suppression des torrents orphelins</span>
        </legend>

        <div class="space-y-4">
          {#each $alldebridInstances as instance, index (index)}
            <div
              class="flex flex-col gap-4 bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-5 rounded-xl shadow border border-gray-200 dark:border-gray-700"
            >
              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label for={`ad-name-${index}`} class="block text-sm text-gray-600 mb-1">Nom de l’instance</label>
                  <input
                    id={`ad-name-${index}`}
                    placeholder="Ex : alldebrid_main"
                    bind:value={$alldebridInstances[index].name}
                    class="input"
                  />
                </div>

                <div>
                  <label for={`ad-key-${index}`} class="block text-sm text-gray-600 mb-1">Clé API</label>
                  <input
                    id={`ad-key-${index}`}
                    placeholder="API Key AllDebrid"
                    bind:value={$alldebridInstances[index].api_key}
                    class="input"
                  />
                </div>

                <div>
                  <label for={`ad-mount-${index}`} class="block text-sm text-gray-600 mb-1">
                    Chemin WebDAV / mount
                  </label>
                  <input
                    id={`ad-mount-${index}`}
                    placeholder="/mnt/alldebrid/__all__"
                    bind:value={$alldebridInstances[index].mount_path}
                    class="input"
                  />
                  <div class="flex items-center text-yellow-600 text-sm mt-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 9v2m0 4h.01M10.29 3.86l-7.37 12.8A1 1 0 004 19h16a1 1 0 00.87-1.47l-7.37-12.8a1 1 0 00-1.74 0z" />
                    </svg>
                    <span>
                      Dossier réellement comparé aux symlinks, par exemple
                      <code>/mnt/alldebrid/__all__</code>.
                    </span>
                  </div>
                </div>

                <div>
                  <label for={`ad-rate-${index}`} class="block text-sm text-gray-600 mb-1">Rate limit</label>
                  <input
                    id={`ad-rate-${index}`}
                    type="number"
                    step="0.1"
                    min="0"
                    bind:value={$alldebridInstances[index].rate_limit}
                    class="input"
                  />
                </div>

                <div>
                  <label for={`ad-priority-${index}`} class="block text-sm text-gray-600 mb-1">Priorité</label>
                  <input
                    id={`ad-priority-${index}`}
                    type="number"
                    min="1"
                    bind:value={$alldebridInstances[index].priority}
                    class="input"
                  />
                </div>

                <div class="flex items-center gap-2 mt-7">
                  <input
                    id={`ad-enabled-${index}`}
                    type="checkbox"
                    bind:checked={$alldebridInstances[index].enabled}
                  />
                  <label for={`ad-enabled-${index}`} class="text-sm text-gray-600">
                    Instance activée
                  </label>
                </div>
              </div>

              <div class="flex justify-end">
                <button
                  type="button"
                  on:click={() => removeInstance(index)}
                  class="text-red-500 hover:text-red-600 flex items-center gap-1 text-sm"
                >
                  <Trash2 class="w-4 h-4" /> Supprimer
                </button>
              </div>
            </div>
          {/each}
        </div>

        <button type="button" on:click={addInstance} class="btn-outline">
          <FolderPlus class="w-4 h-4" /> Ajouter une instance
        </button>
      </fieldset>

      <div class="flex items-center space-x-4">
        <button type="submit" class="btn-primary" disabled={$saving}>
          {#if $saving}
            <Loader2 class="animate-spin w-5 h-5" /> Sauvegarde…
          {:else}
            <Save class="w-5 h-5" /> Sauvegarder
          {/if}
        </button>
      </div>
    </form>
  </div>

  {#if showExplorer}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="presentation"
      tabindex="-1"
      on:click={(e) => { if (e.target === e.currentTarget) showExplorer = false; }}
      on:keydown={(e) => { if (e.key === 'Escape') showExplorer = false; }}
    >
      <div
        class="relative w-[90%] max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-300 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
      >
        <div class="p-4 w-full" role="document">
          <button
            type="button"
            class="w-full text-left bg-transparent border-none p-0 m-0 cursor-default"
            aria-hidden="true"
            on:click|stopPropagation
            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); }}
          >
            <FileExplorer startPath={defaultMediaPath} onSelect={handleSelect} />
          </button>
        </div>
      </div>
    </div>
  {/if}

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
    color: #00bfff;
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: block;
  }

  .label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .input {
    border-radius: 0.5rem;
    border: 1px solid rgba(100, 116, 139, 0.25);
    padding: 0.5rem 1rem;
    background-color: rgba(255, 255, 255, 0.9);
    color: inherit;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  :global(.dark) .input {
    background-color: rgba(30, 41, 59, 0.6);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .input:focus {
    outline: none;
    border-color: #10b981;
    background-color: rgba(255, 255, 255, 0.98);
  }

  :global(.dark) .input:focus {
    border-color: #34d399;
    background-color: rgba(30, 41, 59, 0.9);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(to right, #059669, #0d9488);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: 600;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    filter: brightness(1.1);
    transform: scale(0.98);
  }

  .btn-outline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid #059669;
    border-radius: 0.5rem;
    color: #059669;
    font-weight: 500;
    transition: 0.2s;
  }

  .btn-outline:hover {
    background: #ecfdf5;
  }

  .explorer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: transparent;
    border: 2px solid transparent;
    color: #10b981;
    transition: all 0.2s ease;
  }

  .explorer-btn:hover {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
    transform: scale(1.08);
  }

  :global(.dark) .explorer-btn {
    color: #34d399;
  }

  :global(.dark) .explorer-btn:hover {
    border-color: #34d399;
    background: rgba(52, 211, 153, 0.08);
  }
</style>