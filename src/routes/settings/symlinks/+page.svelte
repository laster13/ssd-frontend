<script>
    import { onMount } from 'svelte';
    import { writable, derived, get } from 'svelte/store';
    import { FolderSearch } from 'lucide-svelte';

    import {
        Search, Eye, Trash, RefreshCw, Info, Scan,
        Download, Upload, Filter, Loader2, CheckCircle2
    } from 'lucide-svelte';
    import { goto } from '$app/navigation';

	// 🔍 LOG ici pour déboguer les variables d'environnement injectées par Vite
	console.log("🧪 import.meta.env :", import.meta.env);

    const baseURL = import.meta.env.DEV
      ? import.meta.env.VITE_BACKEND_URL_HTTP
      : import.meta.env.VITE_BACKEND_URL_HTTPS;
    console.log("🌍 baseURL utilisé :", baseURL);


    const symlinks = writable([]);
    const search = writable('');
    const rowsPerPage = writable(10);
    const currentPage = writable(1);
    const scanStatus = writable(false);
    const selected = writable([]);
    const showOrphansOnly = writable(false);
    const logs = writable([]);
    const linksDir = writable('');
    const totalItems = writable(0);
    const orphaned = writable(0);
    const uniqueTargets = writable(0);

    const exporting = writable(false);
    const exportSuccess = writable(false);

    const importing = writable(false);
    const importSuccess = writable(false);

    const refreshing = writable(false);
    const refreshSuccess = writable(false);

    const scanning = writable(false);
    const scanSuccess = writable(false);

    const deleting = writable({});
    const deleteSuccess = writable({});

    const selectedDir = writable('');
    const availableDirs = writable([]);

    const bulkDeleting = writable(false);
    const bulkDeleteSuccess = writable(false);
    const allSymlinks = writable([]);




    let sortedColumn = null;
    let ascending = true;
    let mounted = false;
export const allBrokenCount = writable(0)


    $: if (mounted && $search !== undefined) {
        currentPage.set(1);
        refreshList();
    }

    $: if (mounted && $showOrphansOnly !== undefined) {
        refreshList();
    }

// 🧮 Nombre de symlinks cassés
$: brokenCount = $symlinks.filter(i => i.ref_count === 0 || i.target_exists === false).length;


    function sortBy(column) {
        if (sortedColumn === column) {
            ascending = !ascending;
        } else {
            sortedColumn = column;
            ascending = true;
        }
        refreshList();
    }

    const totalPages = derived([totalItems, rowsPerPage], ([$total, $perPage]) =>
        Math.ceil($total / $perPage)
    );


// Pluriel simple
function s(count) {
  return count > 1 ? 's' : '';
}

async function deleteAllBrokenSymlinks() {
  const folder = get(selectedDir);
  const isAll = folder === '';
  const isShows = folder && folder.toLowerCase().includes('show');
  const isMovies = folder && folder.toLowerCase().includes('movie');

  let urlRadarr = `${baseURL}/api/v1/symlinks/delete_broken`;
  let urlSonarr = `${baseURL}/api/v1/symlinks/delete_broken_sonarr`;

  if (folder) {
    const encoded = encodeURIComponent(folder);
    urlRadarr += `?folder=${encoded}`;
    urlSonarr += `?folder=${encoded}`;
  }

  let urlsToCall = [];

  if (isAll) {
    const confirmAll = confirm("🗑️ Supprimer TOUS les symlinks cassés (Radarr + Sonarr) ?");
    if (!confirmAll) return;
    urlsToCall = [
      { name: 'Radarr', url: urlRadarr },
      { name: 'Sonarr', url: urlSonarr }
    ];
  } else if (isMovies) {
    urlsToCall = [{ name: 'Radarr', url: urlRadarr }];
  } else if (isShows) {
    urlsToCall = [{ name: 'Sonarr', url: urlSonarr }];
  } else {
    // Sécurité : si on ne sait pas quoi faire
    alert("❓ Type de dossier inconnu : suppression annulée.");
    return;
  }

  bulkDeleting.set(true);
  bulkDeleteSuccess.set(false);

  try {
    const results = await Promise.all(
      urlsToCall.map(entry => fetch(entry.url, { method: 'POST' }))
    );

    const jsons = await Promise.all(
      results.map(r => r.ok ? r.json() : { deleted: 0 })
    );

    const messages = jsons.map((j, i) => `✅ ${j.deleted || 0} supprimé(s) via ${urlsToCall[i].name}`);
    logs.update(l => [...messages, ...l]);

    bulkDeleteSuccess.set(true);
    refreshList();
    setTimeout(() => bulkDeleteSuccess.set(false), 3000);
  } catch (e) {
    alert("❌ Échec suppression");
    console.error(e);
  } finally {
    bulkDeleting.set(false);
  }
}

async function loadConfig() {
  try {
    const res = await fetch(`${baseURL}/api/v1/symlinks/config`);
    if (res.ok) {
      const config = await res.json();
      const firstDir = Array.isArray(config.links_dirs) ? config.links_dirs[0] : '';
      if (firstDir) {
        linksDir.set(firstDir.endsWith('/') ? firstDir : firstDir + '/');
      } else {
        console.warn('⚠️ Aucun répertoire trouvé dans config.links_dirs');
      }
    }

    // 🔽 Charger les sous-dossiers pour le filtre
    const foldersRes = await fetch(`${baseURL}/api/v1/symlinks/folders`);
    if (foldersRes.ok) {
      const folders = await foldersRes.json();
      availableDirs.set(folders);
    } else {
      console.warn('⚠️ Impossible de charger les sous-dossiers de Medias');
    }

  } catch (e) {
    console.error('Erreur de chargement de config ou dossiers :', e);
  }
}

    function changePage(offset) {
        currentPage.update(n => {
            const newPage = Math.max(1, n + offset);
            refreshList();
            return newPage;
        });
    }

    function toggleSelected(item) {
        selected.update(list =>
            list.includes(item)
                ? list.filter(i => i !== item)
                : [...list, item]
        );
    }

    function viewSymlink(item) {
        alert(`Symlink: ${item.symlink}\nTarget: ${item.target}\nRef Count: ${item.ref_count}`);
    }

async function deleteSymlink(item) {
    const fullPath = item.symlink;
    let baseDir = get(linksDir);
    if (!baseDir.endsWith('/')) baseDir += '/';

    let relativePath = fullPath.startsWith(baseDir)
        ? fullPath.slice(baseDir.length)
        : fullPath;

    if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
    }

    // 🧠 Choix de la route selon item.type
    const route =
        item.type === 'sonarr'
            ? `/api/v1/symlinks/delete-sonarr/${encodeURIComponent(relativePath)}`
            : `/api/v1/symlinks/delete/${encodeURIComponent(relativePath)}`;

    deleting.update(state => ({ ...state, [item.symlink]: true }));
    deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));

    try {
        const res = await fetch(`${baseURL}${route}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const error = await res.json();
            alert(`Erreur suppression : ${error.detail || res.status}`);
            return;
        }

        logs.update(list => [`🗑️ Supprimé : ${item.symlink}`, ...list]);
        deleteSuccess.update(state => ({ ...state, [item.symlink]: true }));
        setTimeout(() => {
            deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));
        }, 2000);

        await triggerScan();
    } catch (e) {
        alert('Erreur réseau lors de la suppression');
    } finally {
        deleting.update(state => ({ ...state, [item.symlink]: false }));
    }
}

    function exportJSON() {
        exporting.set(true);
        exportSuccess.set(false);

        symlinks.subscribe(data => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'symlinks_backup.json';
            a.click();
            URL.revokeObjectURL(url);
            exporting.set(false);
            exportSuccess.set(true);
            setTimeout(() => exportSuccess.set(false), 2000);
        })();
    }

    function importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        importing.set(true);
        importSuccess.set(false);

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const imported = JSON.parse(reader.result);
                symlinks.set(imported);
                logs.update(list => [`Imported ${imported.length} symlinks`, ...list]);
                importSuccess.set(true);
                setTimeout(() => importSuccess.set(false), 2000);
            } catch (e) {
                alert('Invalid JSON');
            } finally {
                importing.set(false);
            }
        };
        reader.readAsText(file);
    }

    async function triggerScan() {
        scanning.set(true);
        scanSuccess.set(false);
        allSymlinks.set(true);

        try {
            const res = await fetch(`${baseURL}/api/v1/symlinks/scan`, { method: 'POST' });
            if (res.ok) {
                const json = await res.json();
                symlinks.set(json.data);
                logs.update(l => [`Scan réussi avec ${json.count} liens`, ...l]);
                scanSuccess.set(true);
                setTimeout(() => scanSuccess.set(false), 2000);
            } else {
                logs.update(l => [`Erreur lors du scan : ${res.status}`, ...l]);
            }
        } catch (e) {
            logs.update(l => [`Erreur réseau lors du scan : ${e.message}`, ...l]);
        } finally {
            scanning.set(false);
        }
    }

    async function refreshList() {
        console.log("📥 refreshList() déclenché");
        console.log("🔁 Appel de refreshList() depuis SSE");
        refreshing.set(true);
        refreshSuccess.set(false);

        try {
            const page = get(currentPage);
            const limit = get(rowsPerPage);
            const searchTerm = get(search);
            const orphansOnly = get(showOrphansOnly);
            const sort = sortedColumn || 'symlink';
            const order = ascending ? 'asc' : 'desc';

            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                sort,
                order
            });

            if (searchTerm.trim()) {
                params.append('search', searchTerm.trim());
            }

            if (orphansOnly) {
                params.append('orphans', 'true');
            }

            const folder = get(selectedDir);
            if (folder) {
              params.append('folder', folder);
            }

            const res = await fetch(`${baseURL}/api/v1/symlinks?${params.toString()}`);
            if (!res.ok) throw new Error(`Erreur serveur ${res.status}`);

            const json = await res.json();
            symlinks.set(json.data);
            totalItems.set(json.total);
            orphaned.set(json.orphaned || 0);
            allBrokenCount.set(json.orphaned || 0); 
            uniqueTargets.set(json.unique_targets || 0);

            logs.update(l => [`Liste rafraîchie (page ${json.page})`, ...l]);
            refreshSuccess.set(true);
            setTimeout(() => refreshSuccess.set(false), 2000);
        } catch (e) {
            logs.update(l => [`Erreur réseau : ${e.message}`, ...l]);
        } finally {
            refreshing.set(false);
        }
    }

    onMount(() => {
        mounted = true;
        loadConfig();
        refreshList();

        // 🔁 Rafraîchit la liste si on toggle les orphelins
        const unsubscribe = showOrphansOnly.subscribe(() => {
            refreshList();
        });

        // 🔌 Connexion au flux SSE
        const eventSource = new EventSource(`${baseURL}/api/v1/symlinks/events`);

        eventSource.onmessage = (event) => {
            console.log("🔄 Événement SSE reçu :", event.data);

            try {
                const parsed = JSON.parse(event.data);
                console.log("📦 Données SSE parsées :", parsed);

                if (typeof refreshList === 'function') {
                    console.log("📞 Appel automatique de refreshList()");
                    refreshList();
                } else {
                    console.warn("⚠️ refreshList() n'est pas défini");
                }
            } catch (e) {
                console.error("❌ Erreur de parsing SSE :", e);
            }
        };

        eventSource.onerror = (error) => {
            console.error("❌ Erreur SSE :", error);
            eventSource.close();
        };

        // 🔚 Nettoyage à la destruction du composant
        return () => {
            eventSource.close();
            unsubscribe(); // utile si showOrphansOnly est un store externe
        };
    });


</script>
<main class="w-full min-h-screen p-4 sm:p-6 md:p-8 space-y-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">

  <!-- ✅ Barre d'actions responsive unifiée -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">

    <!-- ☕ Menu mobile -->
    <div class="md:hidden relative">
      <details class="relative">
        <summary class="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-md shadow cursor-pointer text-sm font-medium transition hover:scale-[1.02]">
          ☰ Options
        </summary>
        <div class="absolute z-10 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md p-2 space-y-2 w-52">
          <button on:click={() => showOrphansOnly.update(v => !v)} class="btn btn-emerald-deep w-full justify-start">
            <Filter class="w-4 h-4" /> Symlinks Brisés
          </button>
{#if $allBrokenCount > 0}
  <button on:click={deleteAllBrokenSymlinks} class="btn btn-red-deep w-full justify-start" disabled={$bulkDeleting}>
    {#if $bulkDeleting}
      <Loader2 class="w-4 h-4 animate-spin text-white" />
      Suppression...
    {:else if $bulkDeleteSuccess}
      <CheckCircle2 class="w-4 h-4 text-white" />
      Supprimés !
    {:else}
      <Trash class="w-4 h-4" />
      Supprimer {$allBrokenCount} symlink{s($allBrokenCount)} cassé{s($allBrokenCount)}
    {/if}
  </button>
{/if}

          <button on:click={exportJSON} class="btn btn-indigo-deep w-full justify-start">
            {#if $exporting}
              <Loader2 class="w-4 h-4 animate-spin" />
            {:else if $exportSuccess}
              <CheckCircle2 class="w-4 h-4 text-white" /> Exported
            {:else}
              <Download class="w-4 h-4" /> Export
            {/if}
          </button>
          <label class="btn btn-cyan-deep w-full justify-start cursor-pointer">
            {#if $importing}
              <Loader2 class="w-4 h-4 animate-spin" />
            {:else if $importSuccess}
              <CheckCircle2 class="w-4 h-4 text-white" /> Imported
            {:else}
              <Upload class="w-4 h-4" /> Import
            {/if}
            <input type="file" accept="application/json" class="hidden" on:change={importJSON} />
          </label>
        </div>
      </details>
    </div>

    <!-- 👈 Boutons desktop -->
<!-- 👈 Boutons desktop -->
<div class="hidden md:flex flex-wrap gap-2">
  <button on:click={() => showOrphansOnly.update(v => !v)} class="btn btn-emerald-deep">
    <Filter class="w-4 h-4" /> Symlinks brisés
  </button>

  {#if $allBrokenCount > 0}
    <button on:click={deleteAllBrokenSymlinks} class="btn btn-red-deep" disabled={$bulkDeleting}>
      {#if $bulkDeleting}
        <Loader2 class="w-4 h-4 animate-spin text-white" />
        Suppression...
      {:else if $bulkDeleteSuccess}
        <CheckCircle2 class="w-4 h-4 text-white" />
        Supprimés !
      {:else}
        <Trash class="w-4 h-4" />
        Supprimer {$allBrokenCount} symlink{s($allBrokenCount)} cassé{s($allBrokenCount)}
      {/if}
    </button>
  {/if}

  <button on:click={exportJSON} class="btn btn-indigo-deep">
    {#if $exporting}
      <Loader2 class="w-4 h-4 animate-spin" />
    {:else if $exportSuccess}
      <CheckCircle2 class="w-4 h-4 text-white" /> Exported
    {:else}
      <Download class="w-4 h-4" /> Export
    {/if}
  </button>

  <label class="btn btn-cyan-deep cursor-pointer">
    {#if $importing}
      <Loader2 class="w-4 h-4 animate-spin" />
    {:else if $importSuccess}
      <CheckCircle2 class="w-4 h-4 text-white" /> Imported
    {:else}
      <Upload class="w-4 h-4" /> Import
    {/if}
    <input type="file" accept="application/json" class="hidden" on:change={importJSON} />
  </label>
</div>

    <!-- 👉 Boutons à droite -->
    <div class="flex flex-wrap gap-2 justify-end">
      <button on:click={refreshList} class="btn btn-blue">
        {#if $refreshing}
          <Loader2 class="w-4 h-4 animate-spin" /> Refreshing
        {:else if $refreshSuccess}
          <CheckCircle2 class="w-4 h-4 text-green-500" /> Refreshed
        {:else}
          <RefreshCw class="w-4 h-4" /> Refresh
        {/if}
      </button>
      <button on:click={triggerScan} class="btn btn-red-deep">
        {#if $scanning}
          <Loader2 class="w-4 h-4 animate-spin" />
        {:else if $scanSuccess}
          <CheckCircle2 class="w-4 h-4 text-white" /> Scanned
        {:else}
          <Scan class="w-4 h-4" /> Scan
        {/if}
      </button>
      <button on:click={() => goto('/settings/alfred/setup')} class="btn btn-gray">
        ⚙️ Configuration
      </button>
    </div>
  </div>

  <!-- Scan en cours -->
  {#if $scanStatus}
    <div class="p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 rounded shadow flex items-center gap-2">
      <Info class="w-4 h-4" /> Scan in progress...
    </div>
  {/if}

  <!-- Statistiques -->
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-sm text-gray-600 dark:text-gray-400">Total Symlinks</p>
      <h2 class="text-xl font-bold">{$totalItems}</h2>
    </div>
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-sm text-gray-600 dark:text-gray-400">Symlinks brisés</p>
      <h2 class="text-xl font-bold">{$orphaned}</h2>
    </div>
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded shadow">
      <p class="text-sm text-gray-600 dark:text-gray-400">Cible unique</p>
      <h2 class="text-xl font-bold">{$uniqueTargets}</h2>
    </div>
  </div>

<div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
  <!-- 🔍 Champ de recherche -->
  <div class="relative w-full sm:w-1/3">
    <input
      bind:value={$search}
      placeholder="Search symlinks..."
      class="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
    />
    <Search class="absolute top-2.5 left-3 text-gray-400 w-5 h-5" />
  </div>

  <!-- 📂 Filtre dossier -->
  <div class="relative w-full sm:w-1/4">
    <select
      bind:value={$selectedDir}
      on:change={() => {
        currentPage.set(1);
        refreshList();
      }}
      class="appearance-none w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out hover:scale-[1.01]"
    >
      <option value="">📁 Tous</option>
      {#each $availableDirs as dir}
        <option value={dir}>📂 {dir}</option>
      {/each}
    </select>

    <!-- Icône fixe à gauche -->
    <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
      <FolderSearch class="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
    </div>

    <!-- Flèche dropdown à droite -->
    <div class="absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-gray-500 pointer-events-none">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>

  <!-- 🔢 Pagination -->
  <div class="w-full sm:w-1/5">
    <select
      on:change={(e) => {
        const newValue = +e.target.value;
        rowsPerPage.set(newValue);
        currentPage.set(1);
        refreshList();
      }}
      class="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-lg px-3 py-2"
    >
      <option value="10">10</option>
      <option value="25">25</option>
      <option value="50">50</option>
      <option value="100">100</option>
    </select>
  </div>
</div>

<div class="space-y-4 mt-6">
  {#each $symlinks as item, index}
    <div
      class="p-4 rounded-xl shadow bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 transition hover:scale-[1.01]"
    >
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        
        <!-- Infos principales -->
        <div class="flex-1 space-y-1">
          <p class="text-sm font-semibold font-mono break-all">
            {item.symlink}
          </p>
          <p class="text-sm font-mono text-gray-500 dark:text-gray-400 break-all">
            → {item.target}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Ref Count:
            <span class="ml-1 inline-block px-2 py-0.5 rounded-full font-semibold
              {item.ref_count === 0
                ? 'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-300'
                : 'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300'}"
            >
              {item.ref_count}
            </span>
          </p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 items-center justify-end shrink-0">
          <button on:click={() => viewSymlink(item)} class="btn btn-emerald-deep">
            <Eye class="w-4 h-4" /> View
          </button>
          <button
            on:click={() => deleteSymlink(item)}
            class="btn btn-red-deep"
            disabled={$deleting[item.symlink]}
          >
            {#if $deleting[item.symlink]}
              <Loader2 class="w-4 h-4 animate-spin text-white" />
            {:else if $deleteSuccess[item.symlink]}
              <CheckCircle2 class="w-4 h-4 text-white" />
            {:else}
              <Trash class="w-4 h-4" />
            {/if}
            <span>Delete</span>
          </button>
        </div>

      </div>
    </div>
  {/each}
</div>

  <!-- Pagination -->
  <div class="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
    <button on:click={() => changePage(-1)} disabled={$currentPage === 1} class="btn btn-gray disabled:opacity-50">
      ⬅ Prev
    </button>
    <span class="text-sm">Page {$currentPage} of {$totalPages}</span>
    <button on:click={() => changePage(1)} disabled={$currentPage === $totalPages} class="btn btn-gray disabled:opacity-50">
      Next ➡
    </button>
  </div>
</main>



<style>
  .btn {
    @apply inline-flex items-center gap-2 justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none;
  }
  .btn-blue {
    @apply bg-blue-500 hover:bg-blue-600 text-white focus-visible:ring-blue-300;
  }
  .btn-gray {
    @apply bg-gray-500 hover:bg-gray-600 text-white focus-visible:ring-gray-300;
  }
  .btn-emerald-deep {
    @apply bg-emerald-700 hover:bg-emerald-800 text-white focus-visible:ring-emerald-500;
  }
  .btn-red-deep {
    @apply bg-red-700 hover:bg-red-800 text-white focus-visible:ring-red-500;
  }
  .btn-indigo-deep {
    @apply bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-400;
  }
  .btn-cyan-deep {
    @apply bg-cyan-600 hover:bg-cyan-700 text-white focus-visible:ring-cyan-400;
  }

</style>