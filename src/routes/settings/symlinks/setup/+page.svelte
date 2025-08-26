<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { Save, Loader2, Trash2, FolderPlus, CheckCircle2, XCircle, BellRing } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  const linksDirs = writable([]);
  const mountDirs = writable([]);
  const radarrApiKey = writable('');
  const sonarrApiKey = writable('');
  const discordWebhook = writable('');
  const saving = writable(false);

  // ✅ Toast system
  const toast = writable(null);
  function showToast(msg, type = "success") {
    toast.set({ msg, type });
    setTimeout(() => toast.set(null), 3000);
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/v1/symlinks/config');
      if (res.ok) {
        const data = await res.json();
        linksDirs.set(data.links_dirs || []);
        mountDirs.set(data.mount_dirs || []);
        radarrApiKey.set(data.radarr_api_key || '');
        sonarrApiKey.set(data.sonarr_api_key || '');
        discordWebhook.set(data.discord_webhook_url || ''); // ✅ Discord
      } else {
        showToast('❌ Erreur lors du chargement', 'error');
      }
    } catch {
      showToast('🌐 Erreur réseau', 'error');
    }
  }

  async function saveConfig() {
    saving.set(true);
    try {
      const res = await fetch('/api/v1/symlinks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          links_dirs: $linksDirs,
          mount_dirs: $mountDirs,
          radarr_api_key: $radarrApiKey,
          sonarr_api_key: $sonarrApiKey,
          discord_webhook_url: $discordWebhook   // ✅ ajouté
        })
      });
      if (res.ok) {
        showToast('✅ Configuration sauvegardée !', 'success');
      } else {
        showToast('❌ Erreur lors de la sauvegarde', 'error');
      }
    } catch {
      showToast('🌐 Erreur réseau', 'error');
    } finally {
      saving.set(false);
    }
  }

  function addLinksDir() {
    linksDirs.update(dirs => [...dirs, { path: '', manager: 'sonarr' }]);
  }
  function removeLinksDir(index) {
    linksDirs.update(dirs => dirs.filter((_, i) => i !== index));
  }

  function addMountDir() {
    mountDirs.update(dirs => [...dirs, ""]);
  }
  function removeMountDir(index) {
    mountDirs.update(dirs => dirs.filter((_, i) => i !== index));
  }

  onMount(loadConfig);
</script>

<main class="w-full max-w-5xl mx-auto p-8 space-y-10">
  <!-- Toast -->
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

  <!-- Header -->
  <header class="text-center space-y-2">
    <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 drop-shadow">
      ⚙️ Configuration Symlinks
    </h1>
    <p class="text-sm text-gray-600 dark:text-gray-400">Gérez vos dossiers, API keys et notifications.</p>
  </header>

  <form class="space-y-12" on:submit|preventDefault={saveConfig}>
    <!-- Liens symboliques -->
    <fieldset class="space-y-4">
      <legend class="legend-azure text-lg font-semibold">📂 Dossiers symlinks</legend>
      <div class="space-y-3">
        {#each $linksDirs as linkDir, index (index)}
          <div in:fade out:fade class="flex flex-col md:flex-row gap-3 
              bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-4 rounded-xl shadow 
              border border-gray-200 dark:border-gray-700">
            <input
              id={`linkDir-path-${index}`}
              type="text"
              bind:value={$linksDirs[index].path}
              placeholder="/home/ubuntu/Medias/shows"
              class="flex-1 input"
              required
            />
            <select
              id={`linkDir-manager-${index}`}
              bind:value={$linksDirs[index].manager}
              class="input text-sm"
              required
            >
              <option value="sonarr">Sonarr</option>
              <option value="radarr">Radarr</option>
            </select>
            <button type="button" on:click={() => removeLinksDir(index)}
              class="text-red-500 hover:text-red-600 hover:scale-110 transition">
              <Trash2 class="w-5 h-5"/>
            </button>
          </div>
        {/each}
      </div>

      <button type="button" on:click={addLinksDir} class="btn-outline">
        <FolderPlus class="w-4 h-4"/> Ajouter un dossier
      </button>
    </fieldset>

    <!-- Dossiers montés -->
    <fieldset class="space-y-4">
      <legend class="legend-azure text-lg font-semibold">🗂️ Dossiers montés</legend>
      <div class="space-y-3">
        {#each $mountDirs as mountDir, index (index)}
          <div in:fade out:fade class="flex items-center gap-3 
              bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-4 rounded-xl shadow 
              border border-gray-200 dark:border-gray-700">
            <input id={`mountDir-${index}`} type="text"
              bind:value={$mountDirs[index]} placeholder="/home/ubuntu/alldebrid/torrents"
              class="flex-1 input" required/>
            <button type="button" on:click={() => removeMountDir(index)}
              class="text-red-500 hover:text-red-600 hover:scale-110 transition">
              <Trash2 class="w-5 h-5"/>
            </button>
          </div>
        {/each}
      </div>

      <button type="button" on:click={addMountDir} class="btn-outline">
        <FolderPlus class="w-4 h-4"/> Ajouter un dossier monté
      </button>
    </fieldset>

    <!-- API Keys -->
    <fieldset class="space-y-6">
      <legend class="legend-azure text-lg font-semibold">🔑 Clés API</legend>
      <div class="grid gap-6 md:grid-cols-2">
        <div>
          <label for="radarrApiKey" class="label">Radarr API Key</label>
          <input id="radarrApiKey" type="text" bind:value={$radarrApiKey} class="input w-full" required/>
        </div>
        <div>
          <label for="sonarrApiKey" class="label">Sonarr API Key</label>
          <input id="sonarrApiKey" type="text" bind:value={$sonarrApiKey} class="input w-full" required/>
        </div>
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
          class="flex-1 input"
        />
      </div>
    </fieldset>

    <!-- Bouton -->
    <div class="flex items-center space-x-4">
      <button type="submit" class="btn-primary" disabled={$saving}>
        {#if $saving}
          <Loader2 class="animate-spin w-5 h-5"/> Sauvegarde...
        {:else}
          <Save class="w-5 h-5"/> Sauvegarder
        {/if}
      </button>
    </div>
  </form>
</main>

<style>
  .legend-azure { color: #00BFFF; font-weight: 600; margin-bottom: .5rem; display:block; }
  .label { display:block; margin-bottom:.25rem; font-weight:500; }
  .input {
    border-radius:.5rem; border:1px solid var(--tw-border-color);
    padding:.5rem 1rem; background-color: var(--tw-bg);
    transition: all .2s ease;
  }
  .btn-primary {
    display:inline-flex; align-items:center; gap:.5rem;
    background: linear-gradient(to right,#059669,#0d9488);
    color:white; padding:.75rem 1.5rem; border-radius:.75rem;
    font-weight:600; box-shadow:0 2px 6px rgba(0,0,0,.15);
    transition: all .2s ease;
  }
  .btn-primary:hover { filter:brightness(1.1); transform:scale(.98); }
  .btn-outline {
    display:inline-flex; align-items:center; gap:.5rem;
    padding:.5rem 1rem; border:1px solid #059669; border-radius:.5rem;
    color:#059669; font-weight:500; transition:.2s;
  }
  .btn-outline:hover { background:#ecfdf5; }
</style>
