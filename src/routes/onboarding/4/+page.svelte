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
  const mountDirs = writable<string[]>([]);

  const radarrApiKey = writable('');
  const sonarrApiKey = writable('');
  const tmdbApiKey = writable('');
  const discordWebhook = writable('');
  const alldebridInstances = writable<AllDebridInstance[]>([]);

  // === Options automatiques ===
  const autoRepairBrokenSymlinks = writable(false);
  const autoSeasonarrMissingEnabled = writable(false);
  const autoSeasonarrMissingRunIntervalMinutes = writable(180);
  const autoSeasonarrMissingMaxShowsPerRun = writable(50);
  const orphanScanCheckEverySeconds = writable(60);
  const orphanScanIntervalMinutes = writable(180);

  $: hasActiveAllDebridInstance = $alldebridInstances.some(
    (instance) =>
      Boolean(instance.enabled) &&
      Boolean(instance.api_key?.trim()) &&
      Boolean(instance.mount_path?.trim())
  );

  const saving = writable(false);
  const toast = writable<ToastState>(null);

  // === Explorateur ===
  let showExplorer = false;
  let explorerIndex: number | null = null;
  let defaultMediaPath = '';
  let explorerStartPath = '';

  let detectingMountDirs = false;

  let retargetSourceMount = '';
  let retargetDestinationMount = '';
  let retargetCount: number | null = null;
  let retargetLoading = false;
  let retargetApplying = false;
  let retargetResult: { retargeted_count?: number; error_count?: number; errors?: unknown[] } | null = null;
  let retargetConfirm = '';
  let retargetTestDone = false;

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

    explorerStartPath =
      index !== null && $linksDirs[index]?.path
        ? $linksDirs[index].path
        : defaultMediaPath;

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
      mountDirs.set(data.mount_dirs || []);

      radarrApiKey.set(data.radarr_api_key || '');
      sonarrApiKey.set(data.sonarr_api_key || '');
      tmdbApiKey.set(data.tmdb_api_key || '');
      discordWebhook.set(data.discord_webhook_url || '');

      autoRepairBrokenSymlinks.set(data.auto_repair_broken_symlinks ?? false);
      autoSeasonarrMissingEnabled.set(data.auto_seasonarr_missing_enabled ?? false);
      autoSeasonarrMissingRunIntervalMinutes.set(
        data.auto_seasonarr_missing_run_interval_minutes ?? 180
      );
      autoSeasonarrMissingMaxShowsPerRun.set(
        data.auto_seasonarr_missing_max_shows_per_run ?? 50
      );
      orphanScanCheckEverySeconds.set(
        data.orphan_scan_check_every_seconds ?? 60
      );
      orphanScanIntervalMinutes.set(
        data.orphan_scan_interval_minutes ?? 180
      );

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
  async function saveConfig(showSuccessToast = true) {
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
        mount_dirs: $mountDirs
          .filter((path) => path && path.trim() !== '')
          .map((path) => path.trim()),

        radarr_api_key: $radarrApiKey,
        sonarr_api_key: $sonarrApiKey,
        tmdb_api_key: $tmdbApiKey,
        discord_webhook_url: $discordWebhook,

        auto_repair_broken_symlinks: $autoRepairBrokenSymlinks,
        auto_seasonarr_missing_enabled: $autoSeasonarrMissingEnabled,
        auto_seasonarr_missing_run_interval_minutes: Number(
          $autoSeasonarrMissingRunIntervalMinutes || 180
        ),
        auto_seasonarr_missing_max_shows_per_run: Number(
          $autoSeasonarrMissingMaxShowsPerRun || 50
        ),
        orphan_scan_check_every_seconds: Number(
          $orphanScanCheckEverySeconds || 60
        ),
        orphan_scan_interval_minutes: Number(
          $orphanScanIntervalMinutes || 180
        ),

        alldebrid_instances: cleanedInstances
      };

      const res = await fetch('/api/v1/symlinks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });

      if (res.ok) {
        if (showSuccessToast) {
          showToast('✅ Configuration complète sauvegardée !');
        }

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


  async function detectMountDirs() {
    detectingMountDirs = true;

    try {
      await saveConfig(false);

      const res = await fetch('/api/v1/symlinks/detect-mount-dirs', {
        method: 'POST'
      });

      if (!res.ok) {
        const err: any = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur pendant la détection des mount dirs');
      }

      const data = await res.json();
      mountDirs.set(data.mount_dirs || []);

      showToast(
        `✅ ${data.detected_count || 0} mount dir(s) détecté(s) en ${data.elapsed || 0}s`
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : '❌ Erreur pendant la détection des mount dirs', 'error');
    } finally {
      detectingMountDirs = false;
    }
  }

  async function refreshRetargetCount(resetTestDone = true, clearResult = true) {
    if (clearResult) {
      retargetResult = null;
    }

    retargetCount = null;

    if (resetTestDone) {
      retargetTestDone = false;
    }

    if (!retargetSourceMount || !retargetDestinationMount) {
      showToast('Choisis une source et une destination', 'error');
      return;
    }

    if (retargetSourceMount === retargetDestinationMount) {
      showToast('Source et destination doivent être différentes', 'error');
      return;
    }

    retargetLoading = true;

    try {
      const res = await fetch('/api/v1/symlinks/retarget/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_mount: retargetSourceMount,
          destination_mount: retargetDestinationMount
        })
      });

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || 'Erreur pendant le comptage retarget');
      }

      retargetCount = data.count;
      showToast(`✅ ${data.count} symlink(s) concerné(s)`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '❌ Erreur retarget count', 'error');
    } finally {
      retargetLoading = false;
    }
  }

  async function applyRetarget(limit: number | null = null) {
    retargetResult = null;

    if (retargetCount === null) {
      showToast('Lance d’abord une prévisualisation', 'error');
      return;
    }

    if (retargetCount <= 0) {
      showToast('Aucun symlink à retarget', 'error');
      return;
    }

    if (retargetConfirm !== 'RETARGET') {
      showToast('Tape RETARGET pour confirmer', 'error');
      return;
    }

    retargetApplying = true;

    try {
      const payload: {
        source_mount: string;
        destination_mount: string;
        expected_count: number;
        confirm: string;
        limit?: number;
      } = {
        source_mount: retargetSourceMount,
        destination_mount: retargetDestinationMount,
        expected_count: retargetCount,
        confirm: retargetConfirm
      };

      if (limit !== null) {
        payload.limit = limit;
      }

      const res = await fetch('/api/v1/symlinks/retarget/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || 'Erreur pendant le retarget');
      }

      retargetResult = data;

      if (limit === 1) {
        retargetTestDone = true;
        retargetConfirm = '';
        await refreshRetargetCount(false, false);
      } else {
        retargetCount = null;
        retargetConfirm = '';
        retargetTestDone = false;
      }

      showToast(`✅ ${data.retargeted_count} symlink(s) retargeté(s)`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '❌ Erreur pendant le retarget', 'error');
    } finally {
      retargetApplying = false;
    }
  }

  // === LIENS SYMLINKS ===
  function removeLinksDir(index: number) {
    linksDirs.update((dirs) => dirs.filter((_, i) => i !== index));
  }

  // === DOSSIERS MOUNT / WEBDAV ===
  function addMountDir() {
    mountDirs.update((dirs) => [...dirs, '']);
  }

  function removeMountDir(index: number) {
    mountDirs.update((dirs) => dirs.filter((_, i) => i !== index));
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
      Dossiers, mount WebDAV, API Keys, Discord, options automatiques et instances AllDebrid.
    </p>
  </div>

  <div class="mt-4 flex w-full max-w-6xl flex-col">
    <Separator class="mb-8" />

    <form class="w-full space-y-12" on:submit|preventDefault={() => saveConfig()}>
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

      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">📦 Dossiers mount / WebDAV</legend>

        <p class="text-sm text-gray-500 dark:text-gray-400">
          Ces chemins sont détectés automatiquement depuis les cibles des symlinks.
          Tu peux ensuite choisir, modifier ou supprimer ceux que tu veux garder.
        </p>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            on:click={detectMountDirs}
            class="btn-outline"
            disabled={detectingMountDirs}
          >
            {#if detectingMountDirs}
              <Loader2 class="animate-spin w-4 h-4" />
              Détection…
            {:else}
              <FolderPlus class="w-4 h-4" />
              Détecter les mount dirs
            {/if}
          </button>

          <button
            type="button"
            on:click={addMountDir}
            class="btn-outline"
          >
            <FolderPlus class="w-4 h-4" />
            Ajouter un mount manuel
          </button>
        </div>

        {#if $mountDirs.length === 0}
          <div class="text-sm text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            Aucun mount dir détecté pour le moment. Configure tes dossiers symlinks, puis lance la détection.
          </div>
        {:else}
          <div class="space-y-3">
            {#each $mountDirs as mountDir, index (index)}
              <div
                class="flex flex-col md:flex-row gap-3 bg-white/70 dark:bg-gray-800/60 backdrop-blur-lg p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700"
              >
                <input
                  type="text"
                  bind:value={$mountDirs[index]}
                  placeholder="/mnt/alldebrid/__all__"
                  class="flex-1 input font-medium"
                />

                <span class="input font-medium opacity-70 select-none">
                  Mount
                </span>

                <button
                  type="button"
                  on:click={() => removeMountDir(index)}
                  class="text-red-500 hover:text-red-600 hover:scale-110 transition"
                  aria-label="Supprimer ce dossier mount"
                >
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">🔁 Retarget symlinks entre mounts</legend>

        <p class="text-sm text-gray-500 dark:text-gray-400">
          Permet de modifier les cibles des symlinks locaux d’un mount vers un autre.
          Ne supprime aucun fichier distant.
        </p>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label for="retarget-source" class="label">Source mount actuelle</label>
            <select
              id="retarget-source"
              bind:value={retargetSourceMount}
              class="input w-full"
            >
              <option value="">Choisir une source</option>
              {#each $mountDirs as mountDir}
                {#if mountDir && mountDir.trim() !== ''}
                  <option value={mountDir}>{mountDir}</option>
                {/if}
              {/each}
            </select>
          </div>

          <div>
            <label for="retarget-destination" class="label">Destination mount</label>
            <select
              id="retarget-destination"
              bind:value={retargetDestinationMount}
              class="input w-full"
            >
              <option value="">Choisir une destination</option>
              {#each $mountDirs as mountDir}
                {#if mountDir && mountDir.trim() !== ''}
                  <option value={mountDir}>{mountDir}</option>
                {/if}
              {/each}
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            on:click={() => refreshRetargetCount()}
            class="btn-outline"
            disabled={retargetLoading || retargetApplying}
          >
            {#if retargetLoading}
              <Loader2 class="animate-spin w-4 h-4" />
              Comptage…
            {:else}
              Prévisualiser le nombre
            {/if}
          </button>
        </div>

        {#if retargetCount !== null}
          <div class="option-card space-y-4">
            <div class="text-sm text-gray-700 dark:text-gray-200">
              <strong>{retargetCount}</strong> symlink(s) seront retargetés.
            </div>

            <div>
              <label for="retarget-confirm" class="label">
                Confirmation
              </label>

              <input
                id="retarget-confirm"
                type="text"
                bind:value={retargetConfirm}
                placeholder="Tape RETARGET"
                class="input w-full max-w-xs font-medium"
              />
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                on:click={() => applyRetarget(1)}
                class="btn-outline"
                disabled={retargetApplying}
              >
                {#if retargetApplying}
                  <Loader2 class="animate-spin w-4 h-4" />
                  Application…
                {:else}
                  Tester sur 1 symlink
                {/if}
              </button>

              <button
                type="button"
                on:click={() => applyRetarget(null)}
                class="btn-danger"
                disabled={retargetApplying || !retargetTestDone}
              >
                Appliquer à tous
              </button>

              {#if !retargetTestDone}
                <p class="text-xs text-yellow-600 dark:text-yellow-400">
                  Lance d’abord “Tester sur 1 symlink” avant d’appliquer à tous.
                </p>
              {/if}
            </div>
          </div>
        {/if}

        {#if retargetResult}
          <div class="option-card space-y-2">
            <div class="text-sm text-gray-700 dark:text-gray-200">
              Résultat :
              <strong>{retargetResult.retargeted_count}</strong> retargeté(s),
              <strong>{retargetResult.error_count}</strong> erreur(s).
            </div>

            {#if retargetResult.errors?.length}
              <pre class="text-xs whitespace-pre-wrap overflow-auto bg-black/80 text-white p-3 rounded-lg">{JSON.stringify(retargetResult.errors, null, 2)}</pre>
            {/if}
          </div>
        {/if}
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

      <fieldset class="space-y-5">
        <legend class="legend-azure text-lg font-semibold">🛠️ Options automatiques</legend>

        <div class="grid gap-5">
          <div class="option-card">
            <div class="flex items-start justify-between gap-5">
              <div class="space-y-2">
                <label
                  for="autoRepairBrokenSymlinks"
                  class="block text-base font-semibold text-gray-800 dark:text-gray-100"
                >
                  Réparer automatiquement les symlinks brisés
                </label>

                <p class="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Si cette option est activée, le backend détecte les symlinks cassés,
                  les supprime automatiquement, puis relance Radarr ou Sonarr afin de
                  régénérer des liens propres.
                </p>

                <p class="text-sm leading-relaxed text-emerald-600 dark:text-emerald-400">
                  Mode sécurisé SeasonIt actif : les épisodes ne sont supprimés que si
                  un pack validé par Sonarr est confirmé en cache AllDebrid.
                </p>
              </div>

              <label class="switch" aria-label="Réparer automatiquement les symlinks brisés">
                <input
                  id="autoRepairBrokenSymlinks"
                  type="checkbox"
                  bind:checked={$autoRepairBrokenSymlinks}
                />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <div class="option-card">
            <div class="flex items-start justify-between gap-5">
              <div class="space-y-2">
                <label
                  for="autoSeasonarrMissingEnabled"
                  class="block text-base font-semibold text-gray-800 dark:text-gray-100"
                >
                  Lancer automatiquement Seasonarr sur les épisodes manquants
                </label>

                <p class="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Si cette option est activée, SSD autorise le lancement automatique
                  de Seasonarr sur les séries qui ont des saisons terminées avec des
                  épisodes manquants.
                </p>

                <p class="text-sm leading-relaxed text-emerald-600 dark:text-emerald-400">
                  Mode sécurisé actif : aucune suppression n’est faite sans pack validé
                  par Sonarr et confirmé en cache AllDebrid.
                </p>
              </div>

              <label class="switch" aria-label="Lancer automatiquement Seasonarr sur les épisodes manquants">
                <input
                  id="autoSeasonarrMissingEnabled"
                  type="checkbox"
                  bind:checked={$autoSeasonarrMissingEnabled}
                />
                <span class="slider"></span>
              </label>
            </div>

            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  for="autoSeasonarrMissingRunIntervalMinutes"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Intervalle entre deux lancements
                </label>

                <div class="mt-2 flex items-center gap-3">
                  <input
                    id="autoSeasonarrMissingRunIntervalMinutes"
                    type="number"
                    min="15"
                    step="15"
                    bind:value={$autoSeasonarrMissingRunIntervalMinutes}
                    class="input w-28"
                  />

                  <span class="text-sm text-gray-500 dark:text-gray-400">
                    minutes
                  </span>
                </div>

                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Minimum sécurisé : 15 minutes. Recommandé : 180 minutes.
                </p>
              </div>

              <div>
                <label
                  for="autoSeasonarrMissingMaxShowsPerRun"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Séries maximum par passage
                </label>

                <div class="mt-2 flex items-center gap-3">
                  <input
                    id="autoSeasonarrMissingMaxShowsPerRun"
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    bind:value={$autoSeasonarrMissingMaxShowsPerRun}
                    class="input w-28"
                  />

                  <span class="text-sm text-gray-500 dark:text-gray-400">
                    séries
                  </span>
                </div>

                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Défaut : 50. Maximum sécurisé : 500.
                </p>
              </div>
            </div>
          </div>

          {#if hasActiveAllDebridInstance}
            <div class="option-card">
              <div class="space-y-5">
                <div class="space-y-2">
                  <h3 class="block text-base font-semibold text-gray-800 dark:text-gray-100">
                    Orphelins AllDebrid / Decypharr
                  </h3>

                  <p class="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Ces réglages contrôlent le scan et la suppression automatique des
                    torrents orphelins quand au moins une instance AllDebrid est activée.
                  </p>

                  <p class="text-sm leading-relaxed text-emerald-600 dark:text-emerald-400">
                    Instance AllDebrid active détectée : le backend peut lancer le scan
                    orphelins automatiquement.
                  </p>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      for="orphanScanCheckEverySeconds"
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Vérifier l’activation toutes les
                    </label>

                    <div class="mt-2 flex items-center gap-3">
                      <input
                        id="orphanScanCheckEverySeconds"
                        type="number"
                        min="10"
                        max="3600"
                        step="10"
                        bind:value={$orphanScanCheckEverySeconds}
                        class="input w-28"
                      />

                      <span class="text-sm text-gray-500 dark:text-gray-400">
                        secondes
                      </span>
                    </div>

                    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Défaut : 60 secondes. Minimum sécurisé : 10 secondes.
                    </p>
                  </div>

                  <div>
                    <label
                      for="orphanScanIntervalMinutes"
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Relancer le scan orphelins toutes les
                    </label>

                    <div class="mt-2 flex items-center gap-3">
                      <input
                        id="orphanScanIntervalMinutes"
                        type="number"
                        min="15"
                        max="1440"
                        step="15"
                        bind:value={$orphanScanIntervalMinutes}
                        class="input w-28"
                      />

                      <span class="text-sm text-gray-500 dark:text-gray-400">
                        minutes
                      </span>
                    </div>

                    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Défaut : 180 minutes. Minimum sécurisé : 15 minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="legend-azure text-lg font-semibold">
          🧩 Instances AllDebrid –
          <span class="text-sm font-normal">scan et suppression des torrents orphelins</span>
        </legend>

        <p class="text-sm leading-relaxed text-emerald-600 dark:text-emerald-400">
          Au moins une instance AllDebrid active avec une clé API valide est nécessaire :
          Seasonarr l’utilise pour vérifier si les releases validées par Sonarr sont
          disponibles en cache AllDebrid avant toute suppression sécurisée.
        </p>

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

                <div class="flex items-center gap-3 mt-7">
                  <label class="switch switch-small" aria-label="Instance AllDebrid activée">
                    <input
                      id={`ad-enabled-${index}`}
                      type="checkbox"
                      bind:checked={$alldebridInstances[index].enabled}
                    />
                    <span class="slider"></span>
                  </label>

                  <label for={`ad-enabled-${index}`} class="text-sm text-gray-600 dark:text-gray-300">
                    {$alldebridInstances[index].enabled ? 'Instance activée' : 'Instance désactivée'}
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
            <FileExplorer startPath={explorerStartPath || defaultMediaPath} onSelect={handleSelect} />
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

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
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

  :global(.dark) .btn-outline:hover {
    background: rgba(16, 185, 129, 0.12);
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

  .option-card {
    padding: 1.25rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background:
      linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.9),
        rgba(240, 253, 250, 0.72)
      );
    box-shadow:
      0 10px 25px rgba(15, 23, 42, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(14px);
    transition:
      transform 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .option-card:hover {
    transform: translateY(-1px);
    border-color: rgba(16, 185, 129, 0.45);
    box-shadow:
      0 14px 32px rgba(15, 23, 42, 0.12),
      0 0 0 1px rgba(16, 185, 129, 0.08);
  }

  :global(.dark) .option-card {
    border-color: rgba(255, 255, 255, 0.12);
    background:
      linear-gradient(
        135deg,
        rgba(31, 41, 55, 0.82),
        rgba(15, 23, 42, 0.92)
      );
    box-shadow:
      0 10px 25px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  :global(.dark) .option-card:hover {
    border-color: rgba(52, 211, 153, 0.45);
    box-shadow:
      0 14px 32px rgba(0, 0, 0, 0.35),
      0 0 0 1px rgba(52, 211, 153, 0.08);
  }

  .switch {
    position: relative;
    display: inline-flex;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
    cursor: pointer;
  }

  .switch-small {
    width: 40px;
    height: 22px;
  }

  .switch input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: linear-gradient(135deg, #cbd5e1, #94a3b8);
    box-shadow:
      inset 0 2px 4px rgba(15, 23, 42, 0.18),
      0 1px 2px rgba(15, 23, 42, 0.08);
    transition:
      background 0.25s ease,
      box-shadow 0.25s ease;
  }

  .slider::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    left: 3px;
    top: 3px;
    border-radius: 50%;
    background: white;
    box-shadow:
      0 3px 8px rgba(15, 23, 42, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    transition:
      transform 0.25s ease,
      box-shadow 0.25s ease;
  }

  .switch-small .slider::before {
    width: 16px;
    height: 16px;
  }

  .switch input:checked + .slider {
    background: linear-gradient(135deg, #10b981, #0d9488);
    box-shadow:
      0 0 0 3px rgba(16, 185, 129, 0.12),
      inset 0 2px 4px rgba(15, 23, 42, 0.16);
  }

  .switch input:checked + .slider::before {
    transform: translateX(20px);
    box-shadow:
      0 3px 9px rgba(5, 150, 105, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .switch-small input:checked + .slider::before {
    transform: translateX(18px);
  }

  .switch input:focus-visible + .slider {
    outline: 3px solid rgba(16, 185, 129, 0.35);
    outline-offset: 3px;
  }

  :global(.dark) .slider {
    background: linear-gradient(135deg, #475569, #334155);
  }

  :global(.dark) .slider::before {
    background: #f8fafc;
  }

  :global(.dark) .switch input:checked + .slider {
    background: linear-gradient(135deg, #34d399, #14b8a6);
  }

</style>