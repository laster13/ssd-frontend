<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import {
    Save, Loader2, Trash2, FolderPlus, CheckCircle2, XCircle, BellRing
  } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import FileExplorer from '$lib/components/FileExplorer.svelte';

  // === STORES ===
  const linksDirs = writable([]);
  const radarrApiKey = writable('');
  const sonarrApiKey = writable('');
  const tmdbApiKey = writable('');
  const discordWebhook = writable('');
  const alldebridInstances = writable([]);

  const saving = writable(false);
  const toast = writable(null);

  // === Explorateur ===
  let showExplorer = false;
  let explorerIndex = null;
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

  function openExplorer(index = null) {
    explorerIndex = index;
    showExplorer = true;
  }

  function handleSelect(paths) {
    if (!paths || paths.length === 0) {
      showExplorer = false;
      return;
    }

    linksDirs.update(dirs => {
      const existingPaths = new Set(dirs.map(d => d.path));
      if (explorerIndex !== null && dirs[explorerIndex]) {
        const [first, ...rest] = paths;
        dirs[explorerIndex].path = first;
        const newDirs = rest
          .filter(p => !existingPaths.has(p))
          .map(path => ({ path, manager: 'sonarr' }));
        return [...dirs, ...newDirs];
      }
      const newDirs = paths
        .filter(p => !existingPaths.has(p))
        .map(path => ({ path, manager: 'sonarr' }));
      return [...dirs, ...newDirs];
    });
    showExplorer = false;
    explorerIndex = null;
  }

  // === TOAST SYSTEM ===
  function showToast(msg, type = 'success') {
    toast.set({ msg, type });
    setTimeout(() => toast.set(null), 3000);
  }

  // === CHARGEMENT CONFIG ===
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
      }

      // 🔹 Charge aussi les instances AllDebrid
      const alldebridRes = await fetch('/api/v1/instances/alldebrid');
      if (alldebridRes.ok) {
        alldebridInstances.set(await alldebridRes.json());
      }
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

      const updatedConfig = {
        ...currentData,
        links_dirs: $linksDirs,
        radarr_api_key: $radarrApiKey,
        sonarr_api_key: $sonarrApiKey,
        tmdb_api_key: $tmdbApiKey,
        discord_webhook_url: $discordWebhook,
        alldebrid_instances: $alldebridInstances
      };

      const res = await fetch('/api/v1/symlinks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });

      if (res.ok) showToast('✅ Configuration complète sauvegardée !');
      else showToast('❌ Erreur lors de la sauvegarde', 'error');
    } catch {
      showToast('🌐 Erreur réseau', 'error');
    } finally {
      saving.set(false);
    }
  }

  // === LIENS SYMLINKS ===
  function addLinksDir() {
    linksDirs.update(dirs => [...dirs, { path: '', manager: 'sonarr' }]);
  }
  function removeLinksDir(index) {
    linksDirs.update(dirs => dirs.filter((_, i) => i !== index));
  }

  // === INSTANCES ALLDEBRID ===
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

  async function deleteInstance(name) {
    if (!confirm(`Supprimer l'instance "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/v1/instances/alldebrid/${name}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`🗑️ Instance ${name} supprimée`);
        loadConfig();
      } else showToast('❌ Erreur lors de la suppression', 'error');
    } catch {
      showToast('🌐 Erreur réseau', 'error');
    }
  }

  onMount(async () => {
    await initDefaultPath();
    await loadConfig();
  });
</script>

<main class="w-full max-w-5xl mx-auto p-8 space-y-10">

  <!-- ✅ Toast -->
  {#if $toast}
    <div in:slide out:fade
      class="fixed top-4 right-4 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 
        { $toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white' }">
      {#if $toast.type === 'success'}
        <CheckCircle2 class="w-5 h-5"/>
      {:else}
        <XCircle class="w-5 h-5"/>
      {/if}
      <span class="font-medium">{$toast.msg}</span>
    </div>
  {/if}

  <!-- 🧭 Header -->
  <header class="text-center space-y-2">
    <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 drop-shadow">
      ⚙️ Configuration générale
    </h1>
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Dossiers, API Keys, Discord & AllDebrid.
    </p>
  </header>

  <form class="space-y-12" on:submit|preventDefault={saveConfig}>

    <!-- 📂 Liens symboliques -->
    <fieldset class="space-y-4">
      <legend class="legend-azure text-lg font-semibold">📂 Dossiers symlinks</legend>

      <div class="space-y-3">
        {#each $linksDirs as linkDir, index (index)}
          <div
            class="flex flex-col md:flex-row gap-3 bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700"
          >
            <!-- bouton explorer design -->
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

    <!-- 🔑 API Keys -->
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
              <a href="https://www.themoviedb.org/settings/api?language=fr"
                 target="_blank"
                 class="underline hover:text-yellow-700 transition">
                themoviedb.org
              </a>.
            </span>
          </div>
        </div>
      </div>
    </fieldset>

    <!-- 🔔 Discord Webhook -->
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

    <!-- 🧩 Instances AllDebrid -->
    <fieldset class="space-y-4">
      <legend class="legend-azure text-lg font-semibold">
        🧩 Instances AllDebrid –
        <span class="text-sm font-normal">Suppression optionnelle des fichiers non rattachés à un symlink</span>
      </legend>

      <div class="space-y-4">
        {#each $alldebridInstances as instance, index (index)}
          <div
            class="flex flex-col gap-4 bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-5 rounded-xl shadow border border-gray-200 dark:border-gray-700"
          >
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label for={`ad-name-${index}`} class="block text-sm text-gray-600 mb-1">Nom de l’instance</label>
                <input id={`ad-name-${index}`} placeholder="Ex : AllDebrid_Premier" bind:value={$alldebridInstances[index].name} class="input" />
              </div>
              <div>
                <label for={`ad-key-${index}`} class="block text-sm text-gray-600 mb-1">Clé API</label>
                <input id={`ad-key-${index}`} placeholder="API Key AllDebrid" bind:value={$alldebridInstances[index].api_key} class="input" />
              </div>
              <div>
                <label for={`ad-mount-${index}`} class="block text-sm text-gray-600 mb-1">
                  Chemin de montage
                </label>

                <input
                  id={`ad-mount-${index}`}
                  placeholder="/mnt/alldebrid/torrents"
                  bind:value={$alldebridInstances[index].mount_path}
                  class="input"
                />

                <div class="flex items-center text-yellow-600 text-sm mt-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01M10.29 3.86l-7.37 12.8A1 1 0 004 19h16a1 1 0 00.87-1.47l-7.37-12.8a1 1 0 00-1.74 0z" />
                  </svg>
                  <span>Assurez-vous que le dossier soit le même que celui de decypharr (torrents/__all__).</span>
                </div>
              </div>
              <div>
                <label for={`ad-cache-${index}`} class="block text-sm text-gray-600 mb-1">Chemin cache</label>
                <input id={`ad-cache-${index}`} placeholder="/home/ubuntu/docker/ubuntu/decypharr/cache/alldebrid" bind:value={$alldebridInstances[index].cache_path} class="input w-full" />
              </div>
            </div>
            <div class="flex justify-end">
              <button type="button" on:click={() => deleteInstance(instance.name)} class="text-red-500 hover:text-red-600 flex items-center gap-1 text-sm">
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

  <!-- 🟢 Explorateur (Modal centré, stable, sans effet) -->
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
</main>

<style>
  :global(.dark) {} /* Forcer Svelte à garder les sélecteurs dark */

  .legend-azure {
    color:#00BFFF;
    font-weight:600;
    margin-bottom:.5rem;
    display:block;
  }
  .label {
    display:block;
    margin-bottom:.25rem;
    font-weight:500;
  }
  .sr-only {
    position:absolute;
    width:1px;
    height:1px;
    padding:0;
    margin:-1px;
    overflow:hidden;
    clip:rect(0,0,0,0);
    white-space:nowrap;
    border:0;
  }

  /* Champs API et AllDebrid */
  .input {
    border-radius:.5rem;
    border:1px solid rgba(100, 116, 139, 0.25);
    padding:.5rem 1rem;
    background-color: rgba(255, 255, 255, 0.9);
    color:inherit;
    transition: border-color .2s ease, background-color .2s ease;
  }
  :global(.dark) .input {
    background-color: rgba(30, 41, 59, 0.6);
    border-color: rgba(255, 255, 255, 0.15);
  }
  .input:focus {
    outline:none;
    border-color: #10b981;
    background-color: rgba(255,255,255,0.98);
  }
  :global(.dark) .input:focus {
    border-color: #34d399;
    background-color: rgba(30,41,59,0.9);
  }

  /* Boutons */
  .btn-primary {
    display:inline-flex;
    align-items:center;
    gap:.5rem;
    background: linear-gradient(to right,#059669,#0d9488);
    color:white;
    padding:.75rem 1.5rem;
    border-radius:.75rem;
    font-weight:600;
    box-shadow:0 2px 6px rgba(0,0,0,.15);
    transition: all .2s ease;
  }
  .btn-primary:hover {
    filter:brightness(1.1);
    transform:scale(.98);
  }
  .btn-outline {
    display:inline-flex;
    align-items:center;
    gap:.5rem;
    padding:.5rem 1rem;
    border:1px solid #059669;
    border-radius:.5rem;
    color:#059669;
    font-weight:500;
    transition:.2s;
  }
  .btn-outline:hover {
    background:#ecfdf5;
  }

  /* Bouton Explorer design */
  .explorer-btn {
    display:flex;
    align-items:center;
    justify-content:center;
    width:42px;
    height:42px;
    border-radius:50%;
    background:transparent;
    border:2px solid transparent;
    color:#10b981;
    transition: all .2s ease;
  }
  .explorer-btn:hover {
    border-color:#10b981;
    background:rgba(16,185,129,0.05);
    transform:scale(1.08);
  }
  :global(.dark) .explorer-btn {
    color:#34d399;
  }
  :global(.dark) .explorer-btn:hover {
    border-color:#34d399;
    background:rgba(52,211,153,0.08);
  }
</style>
