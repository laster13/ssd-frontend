<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import Pagination from "$lib/components/Pagination.svelte";
  import PopupSymlink from "$lib/components/PopupSymlink.svelte";
  import SymlinkCard from "$lib/components/SymlinkCard.svelte";
  import ActionButton from "$lib/components/ActionButton.svelte";
  import ToggleLatest from "$lib/components/ToggleLatest.svelte";

  import {
    FolderSearch, ChevronDown, Search, Sparkles, FolderOpen, Trash,
    RefreshCw, Info, Scan, Filter, Lightbulb, Trash2, Loader2, Edit3, CheckCircle2, Tv
  } from "lucide-svelte";


  import {
    symlinks, search, rowsPerPage, currentPage, scanStatus, selected,
    logs, totalItems, orphaned, uniqueTargets,
    exporting, exportSuccess, importing, importSuccess,
    refreshing, refreshSuccess, scanning, scanSuccess,
    deleting, deleteSuccess, selectedDir, availableDirs,
    bulkDeleting, bulkDeleteSuccess, repairing, repairSuccess,
    selectedItem, allBrokenCount, imdbMissing, renaming, renameSuccess,
    duplicates, hasDuplicates, duplicatesCount, latestSymlinks, activeFilter
  } from "$lib/stores/symlinks";

  import {
    fetchSymlinks, fetchFolders, fetchShow, fetchLatestSymlinks,
    triggerScanAPI, repairMissingSeasonsAPI, deleteBrokenAPI, deleteSymlinkAPI,
    fetchSonarrUrl, fetchRadarrUrl, exportSymlinksToFile, importSymlinksFromFile
  } from "$lib/api/symlinks";

  let open = ""; // stocke la carte ouverte

  function toggle(card: string) {
    open = open === card ? "" : card;
  }

  // --- Variables locales ---
  const baseURL = import.meta.env.DEV
    ? import.meta.env.VITE_BACKEND_URL_HTTP
    : import.meta.env.VITE_BACKEND_URL_HTTPS;

  let instanceId: number | null = null;
  let menu: HTMLDetailsElement;
  let sortedColumn: string | null = null;
  let ascending = true;
  let mounted = false;
  let filtersReady = false;
  let showRenamePopup = false;

  let searchTerm = '';
  $: searchTerm = $search.trim();

  // --- réactions auto ---
  $: if (mounted && filtersReady && $search.trim() !== "") {
    currentPage.set(1);
    refreshList();
  }

  // --- UI utils ---
  function handleAndClose(action: () => void) {
    action();
    menu?.removeAttribute('open');
  }
  function closePopup() {
    selectedItem.set(null);
  }
  function s(count: number) {
    return count > 1 ? 's' : '';
  }

// --- Renommage global ---
  async function handleRename(type: string) {
    // ⚡ Ici tu choisis quel endpoint taper selon le type
    if (type === "radarr") {
      console.log("🔥 Appel API Radarr rename");
    } else if (type === "sonarr") {
      console.log("🔥 Appel API Sonarr rename");
    } else {
      await onRename(); // ton endpoint global déjà en place
    }
  }

  // --- Open popup (Radarr / Sonarr show details) ---
  async function openPopup(item: any) {
    try {
      if (item.type === "radarr") {
        selectedItem.set({ ...item, overview: "Film importé via Radarr" });
        return;
      }
      if (!item.show_id) {
        selectedItem.set({
          ...item,
          poster: null,
          title: item.symlink,
          overview: "Aucun détail trouvé",
        });
        return;
      }
      const show = await fetchShow(item.show_id, instanceId);
      let posterUrl = show.poster
        ? `/api/v1/proxy-image?url=${encodeURIComponent(show.poster)}&instance_id=${instanceId}`
        : null;
      selectedItem.set({
        ...item,
        title: show.title,
        overview: show.overview,
        status: show.status,
        year: show.year,
        poster: posterUrl,
      });
    } catch (err) {
      console.error("❌ Erreur openPopup:", err);
      selectedItem.set({ ...item, poster: null, overview: "Erreur lors du chargement des infos" });
    }
  }

  function goToPage(p: number) {
    currentPage.set(p);
    refreshList();
  }

  async function loadLibraries() {
    try {
      const res = await fetch(`${baseURL}/api/v1/symlinks/libraries`);
      if (!res.ok) throw new Error("Erreur API libraries");
      const data = await res.json();
      const totalMissing = (data.movies?.imdb_missing || 0) + (data.shows?.imdb_missing || 0);
      imdbMissing.set(totalMissing);
    } catch (err) {
      console.error("❌ Erreur loadLibraries:", err);
      imdbMissing.set(0);
    }
  }

  // --- Open in Arr (Sonarr / Radarr) ---
  async function openArr(item: any) {
    const { root, relative } = relativeToRoot(item.symlink);
    if (!relative || !root) {
      alert("Impossible de déterminer le chemin relatif à la racine.");
      return;
    }
    try {
      let json;
      if (item.type.toLowerCase() === "sonarr") {
        json = await fetchSonarrUrl(relative);
      } else if (item.type.toLowerCase() === "radarr") {
        json = await fetchRadarrUrl(relative.split("/")[0]);
      } else return;
      window.location.href = json.url;
    } catch (e: any) {
      alert(`Erreur ouverture ${item.type}: ${e?.message || e}`);
    }
  }

  // --- Charger derniers symlinks ---
  async function loadLatestSymlinks() {
    try {
      const params = new URLSearchParams({ sort: "created_at", order: "desc", limit: "100" });
      if (searchTerm.trim()) params.append("search", searchTerm);
      if (get(selectedDir)) params.append("folder", get(selectedDir));
      if (get(activeFilter) === 'orphans') params.append("orphans", "true");
      const json = await fetchLatestSymlinks(params);
      latestSymlinks.set(json.data || []);
    } catch {
      latestSymlinks.set([]);
    }
  }

  // --- Chemin relatif à la racine ---
  function relativeToRoot(absPath: string): { root: string | null, relative: string } {
    const roots = get(availableDirs);
    if (!absPath) return { root: null, relative: '' };
    const norm = absPath.replace(/\\/g, '/');
    for (const r of roots) {
      const needle = `/${r}/`;
      const idx = norm.indexOf(needle);
      if (idx !== -1) {
        return { root: r, relative: norm.substring(idx + needle.length) };
      }
    }
    return { root: null, relative: '' };
  }

  // --- Réparer saisons manquantes ---
  async function repairMissingSeasons() {
    if (get(repairing)) return;
    repairing.set(true);
    repairSuccess.set(false);
    try {
      const folder = get(selectedDir) || undefined;
      const json = await repairMissingSeasonsAPI(folder);
      logs.update(l => [
        `🛠️ Réparation effectuée${json.symlinks_deleted !== undefined ? ` — ${json.symlinks_deleted} supprimé(s)` : ''}`,
        ...l,
      ]);
      repairSuccess.set(true);
      setTimeout(() => repairSuccess.set(false), 2500);
      await refreshList();
    } catch (e: any) {
      alert(`❌ Échec de la réparation: ${e?.message || e}`);
    } finally {
      repairing.set(false);
    }
  }

  // --- Supprimer tous les symlinks cassés ---
  async function deleteAllBrokenSymlinks() {
    if (!confirm("🗑️ Supprimer tous les symlinks cassés sélectionnés ?")) return;
    const folder = (get(selectedDir) ?? '').trim();
    const routes = folder
      ? [
          `/api/v1/symlinks/delete_broken_sonarr?folder=${encodeURIComponent(folder)}`,
          `/api/v1/symlinks/delete_broken?folder=${encodeURIComponent(folder)}`
        ]
      : ['/api/v1/symlinks/delete_broken_sonarr', '/api/v1/symlinks/delete_broken'];

    bulkDeleting.set(true);
    bulkDeleteSuccess.set(false);

    const results = await Promise.allSettled(
      routes.map(r =>
        deleteBrokenAPI(r).catch(e => {
          logs.update(l => [`❌ ${r} — ${e.message}`, ...l]);
          return { deleted: 0 };
        })
      )
    );

    const totalDeleted = results.reduce(
      (sum, r) =>
        sum + (r.status === 'fulfilled' ? Number((r.value as any).deleted) || 0 : 0),
      0
    );

    logs.update(l => [`🧹 Total supprimé : ${totalDeleted}`, ...l]);

    // ✅ Met à jour la liste et les compteurs depuis le backend
    await refreshList();

    bulkDeleteSuccess.set(true);
    setTimeout(() => bulkDeleteSuccess.set(false), 3000);
    bulkDeleting.set(false);
  }

  // --- Supprimer un symlink ---
  async function deleteSymlink(item: any) {
    const { root, relative } = relativeToRoot(item.symlink);
    if (!relative || !root) {
      alert("Impossible de déterminer le chemin relatif à la racine.");
      return;
    }

    // 👉 Si doublon, on passe par le endpoint local
    let route;
    if (item.ref_count > 1) {
      route = `/api/v1/symlinks/delete_local/${encodeURIComponent(relative)}?root=${encodeURIComponent(root)}`;
    } else {
      route =
        item.type === "sonarr"
          ? `/api/v1/symlinks/delete-sonarr/${encodeURIComponent(relative)}?root=${encodeURIComponent(root)}`
          : `/api/v1/symlinks/delete/${encodeURIComponent(relative)}`;
    }

    deleting.update(s => ({ ...s, [item.symlink]: true }));
    deleteSuccess.update(s => ({ ...s, [item.symlink]: false }));
    try {
      await deleteSymlinkAPI(route);
      logs.update(l => [`🗑️ Supprimé : ${item.symlink}`, ...l]);
      deleteSuccess.update(s => ({ ...s, [item.symlink]: true }));
      setTimeout(() => deleteSuccess.update(s => ({ ...s, [item.symlink]: false })), 2000);
    } catch (e: any) {
      logs.update(l => [`❌ Erreur suppression ${item.symlink} : ${e.message}`, ...l]);
    } finally {
      deleting.update(s => ({ ...s, [item.symlink]: false }));
    }
  }

  // --- Export JSON ---
  function exportJSON() {
    exporting.set(true);
    exportSuccess.set(false);
    symlinks.subscribe((data: any[]) => {
      exportSymlinksToFile(data);
      exporting.set(false);
      exportSuccess.set(true);
      setTimeout(() => exportSuccess.set(false), 2000);
    })();
  }

  // --- Import JSON ---
  async function importJSON(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    importing.set(true);
    importSuccess.set(false);
    try {
      const imported = await importSymlinksFromFile(file);
      symlinks.set(imported);
      logs.update(l => [`Imported ${imported.length} symlinks`, ...l]);
      importSuccess.set(true);
      setTimeout(() => importSuccess.set(false), 2000);
    } catch {
      alert("Invalid JSON");
    } finally {
      importing.set(false);
    }
  }

  // --- Scan ---
  async function triggerScan() {
    scanning.set(true);
    scanSuccess.set(false);
    try {
      // 🔎 Lance le scan côté backend
      const json = await triggerScanAPI();

      // 📝 Log du succès avec le nombre de symlinks trouvés
      logs.update(l => [`Scan réussi avec ${json.count} liens`, ...l]);

      // ✅ Met à jour toute la liste et les compteurs depuis le backend
      await refreshList();

      scanSuccess.set(true);
      setTimeout(() => scanSuccess.set(false), 2000);
    } finally {
      scanning.set(false);
    }
  }

// --- Refresh ---
  async function refreshList() {
    refreshing.set(true);
    refreshSuccess.set(false);

    try {
      const page = get(currentPage);
      const limit = get(rowsPerPage);
      const sort = sortedColumn || "symlink";
      const order = ascending ? "asc" : "desc";

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort,
        order,
      });

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      if (get(selectedDir)) {
        params.append("folder", get(selectedDir));
      }

      let json: any;

      // ✅ Gestion des filtres côté backend
      switch (get(activeFilter)) {
        case "orphans":
          params.append("orphans", "true");
          json = await fetchSymlinks(params);
          symlinks.set(json.data || []);
          break;

        case "duplicates": {
          const dupRes = await fetch(`${baseURL}/api/v1/symlinks/duplicates?${params}`);
          if (dupRes.ok) {
            const dupJson = await dupRes.json();
            symlinks.set(dupJson.data || []);
            json = { total: dupJson.total || dupJson.data?.length || 0 };
          } else {
            symlinks.set([]);
            json = { total: 0 };
          }
          break;
        }

        case "latest":
          params.set("sort", "created_at");
          params.set("order", "desc");
          params.set("limit", "100");
          json = await fetchLatestSymlinks(params);
          symlinks.set(json.data || []);
          break;

        case "rename":
          params.append("rename", "true");
          json = await fetchSymlinks(params);
          symlinks.set(json.data || []);
          break;

        default: // 'none'
          json = await fetchSymlinks(params);
          symlinks.set(json.data || []);
          break;
      }

      // ✅ Mise à jour des compteurs globaux
      totalItems.set(json.total || 0);
      orphaned.set(json.orphaned || 0);
      allBrokenCount.set(json.all_broken || 0);
      uniqueTargets.set(json.unique_targets || 0);
      imdbMissing.set(json.imdb_missing || 0); // 👈 compteur à renommer

      // ✅ Appel séparé pour doublons (compteur bouton)
      try {
        const dupParams = new URLSearchParams();
        if (get(selectedDir)) {
          dupParams.append("folder", get(selectedDir));
        }

        const dupRes = await fetch(`${baseURL}/api/v1/symlinks/duplicates?${dupParams}`);
        if (dupRes.ok) {
          const dupJson = await dupRes.json();
          duplicates.set(dupJson.data || []);
          duplicatesCount.set(dupJson.total || (dupJson.data?.length || 0));
        } else {
          duplicates.set([]);
          duplicatesCount.set(0);
        }
      } catch (err) {
        console.error("❌ Erreur récupération doublons :", err);
        duplicates.set([]);
        duplicatesCount.set(0);
      }

      logs.update((l) => [`Liste rafraîchie (page ${page})`, ...l]);
      refreshSuccess.set(true);
      setTimeout(() => refreshSuccess.set(false), 2000);
    } finally {
      refreshing.set(false);
    }
  }

  // --- Delete filtrés ---
  async function deleteFilteredSymlinks() {
    const folder = get(selectedDir);
    const searchTermVal = get(search).trim();
    const params = new URLSearchParams({ all: 'true' });
    if (folder) params.set('folder', folder);
    if (searchTermVal) params.set('search', searchTermVal);

    const json = await fetchSymlinks(params);
    const symlinksToDelete: any[] = json.data || [];

    bulkDeleting.set(true);
    bulkDeleteSuccess.set(false);

    for (const item of symlinksToDelete) {
      await deleteSymlink(item);
    }

    // ✅ Met à jour la liste et les compteurs depuis le backend
    await refreshList();

    bulkDeleteSuccess.set(true);
    setTimeout(() => bulkDeleteSuccess.set(false), 3000);
    bulkDeleting.set(false);
  }

  // --- Load available dirs ---
  async function loadAvailableDirs() {
    try {
      const folders = await fetchFolders();
      availableDirs.set(folders);
    } catch (e) {
      console.error("Erreur chargement dossiers :", e);
    }
  }

  // --- Autres helpers UI ---
  function changePage(offset: number) {
    currentPage.update(n => {
      const newPage = Math.max(1, n + offset);
      refreshList();
      return newPage;
    });
  }
  function toggleSelected(item: any) {
    selected.update(list => list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  }
  function viewSymlink(item: any) {
    alert(`Symlink: ${item.symlink}\nTarget: ${item.target}\nRef Count: ${item.ref_count}`);
  }
  function sortBy(column: string) {
    if (sortedColumn === column) ascending = !ascending;
    else { sortedColumn = column; ascending = true; }
    refreshList();
  }

  // --- On mount ---
  onMount(async () => {
    mounted = true;
    await loadAvailableDirs();
    await refreshList();
    filtersReady = true;
    connectSSE();
  });

  // 🔁 Dès que la config est prête => auto /libraries
  $: if (mounted && get(availableDirs).length > 0) {
    console.log("⚡ Config.json détectée, chargement des libraries...");
    loadLibraries();
  }

  // --- SSE ---
  function connectSSE() {
    const eventSource = new EventSource(`${baseURL}/api/v1/symlinks/events`);

    eventSource.addEventListener("symlink_update", async (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const evt = payload.event;

        console.log("📡 SSE reçu:", evt, payload);

        let refreshNeeded = false;

        switch (evt) {
          // --- Création d’un symlink ---
          case "symlink_added":
            symlinks.update(list =>
              list.some(i => i.symlink === payload.item.symlink)
                ? list
                : [payload.item, ...list]
            );
            refreshNeeded = true;
            break;

          // --- Suppression d’un symlink ---
          case "symlink_removed":
            symlinks.update(list => list.filter(i => i.symlink !== payload.path));
            refreshNeeded = true;
            break;

          // --- Màj des doublons ---
          case "duplicates_updated":
            duplicatesCount.set(payload.total || 0);
            break;

          // --- Scan terminé ---
          case "scan_completed":
            refreshNeeded = true;
            break;

          // --- ⚠️ Symlinks brisés (monitor léger, live, périodique, etc.) ---
          case "broken_symlinks_light":
          case "symlink_broken_live":
          case "broken_symlinks_periodic":
          case "broken_symlinks_detected":
            console.warn(`⚠️ ${payload.count || 0} symlink(s) brisé(s) détecté(s) (${evt})`);

            // ✅ Récupération de la bonne liste de symlinks brisés
            const brokenList =
              Array.isArray(payload) ? payload :
              Array.isArray(payload.data) ? payload.data : [];

            if (brokenList.length > 0) {
              symlinks.update(list => {
                const updatedList = [...list];
                for (const brokenItem of brokenList) {
                  const index = updatedList.findIndex(i => i.symlink === brokenItem.symlink);
                  if (index !== -1) {
                    // ✅ Met à jour ref_count = 0 et target_exists = false
                    updatedList[index] = {
                      ...updatedList[index],
                      ...brokenItem,
                      ref_count: 0,
                      target_exists: false
                    };
                  } else {
                    // 🆕 Si l’item n’existe pas, on l’ajoute
                    updatedList.push({
                      ...brokenItem,
                      ref_count: 0,
                      target_exists: false
                    });
                  }
                }
                return updatedList;
              });
            } else {
              console.warn("⚠️ Aucun item 'broken' trouvé dans le payload SSE");
            }

            allBrokenCount.set(payload.count || brokenList.length || 0);
            refreshNeeded = true;
            logs.update(l => [
              `⚠️ ${brokenList.length || payload.count || 0} symlink(s) brisé(s) détecté(s) (${evt})`,
              ...l
            ]);
            break;

          // --- 🔁 Symlink remplacé ---
          case "symlink_replacement":
            logs.update(l => [
              `♻️ Symlink remplacé : ${payload.old_path} → ${payload.new_path}`,
              ...l
            ]);
            refreshNeeded = true;
            break;

          // --- Suppression d’orphelins ---
          case "orphans_deleted":
            logs.update(l => [
              `🧹 ${payload.count || 0} orphelin(s) supprimé(s)`,
              ...l
            ]);
            refreshNeeded = true;
            break;

          // --- Scan initial ---
          case "initial_scan":
            logs.update(l => [
              `🔍 Scan initial terminé — ${payload.count || 0} symlinks`,
              ...l
            ]);
            refreshNeeded = true;
            break;

          default:
            console.debug("ℹ️ Événement SSE non géré :", evt);
        }

        // --- Synchronisation globale ---
        if (refreshNeeded) {
          await refreshList();      // ⚙️ recharge symlinks + compteurs
          await loadLatestSymlinks();
          await loadLibraries();    // recharge imdbMissing
        }

      } catch (err) {
        console.error("❌ Erreur lors du traitement SSE :", err);
      }
    });

    eventSource.onerror = () => {
      console.error("❌ Erreur SSE, tentative de reconnexion...");
      eventSource.close();
      setTimeout(() => connectSSE(), 2000);
    };
  }

</script>

<main class="w-full min-h-screen p-4 sm:p-6 md:p-8 space-y-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">
<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
  <!-- ☕ Menu mobile -->
  <div class="md:hidden relative">
    <details class="relative w-full">
      <summary
        class="flex items-center justify-between px-5 py-3 
               bg-gradient-to-r from-emerald-600 to-teal-500 
               text-white rounded-lg shadow-md cursor-pointer 
               text-sm font-semibold tracking-wide 
               transition-transform duration-150 
               hover:scale-[1.03] focus:outline-none 
               focus:ring-2 focus:ring-emerald-400 w-full"
      >
        🌐 Tableau de bord
        <ChevronDown class="w-4 h-4 opacity-80 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div
        class="absolute z-10 mt-1 bg-white dark:bg-gray-800 
               border border-gray-300 dark:border-gray-600 
               rounded-lg shadow-md p-2 space-y-2 w-full"
      >

        <!-- ✅ Bouton Seasonarr -->
        <button
          type="button"
          class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-purple-200 dark:border-purple-700 
                 bg-purple-50 dark:bg-purple-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer"
          on:click={() => window.location.href = `${baseURL}/season/dashboard`}
        >
          <div class="w-6 h-6 flex items-center justify-center text-purple-600 dark:text-purple-300">
            <Tv size={20} />
          </div>
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-purple-600 to-fuchsia-600 
                       dark:from-purple-400 dark:to-fuchsia-400
                       bg-clip-text text-transparent">
            Seasonarr (Packs Saisons)
          </span>
        </button>

        <!-- ✅ Toggle Symlinks brisés -->
        {#if $allBrokenCount > 0}
          <button
            type="button"
            class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                   border-emerald-200 dark:border-emerald-700 
                   bg-emerald-50 dark:bg-emerald-900/40 shadow-sm
                   hover:shadow-md transition-all duration-300
                   cursor-pointer"
            on:click={() => {
              activeFilter.set($activeFilter === 'orphans' ? 'none' : 'orphans');
              refreshList();
            }}
          >
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input type="checkbox" checked={$activeFilter === 'orphans'} class="sr-only peer" />
              <div class="w-12 h-6 rounded-full transition-all duration-500
                          bg-gradient-to-r from-gray-200 to-gray-400 
                          dark:from-gray-700 dark:to-gray-900
                          peer-checked:from-emerald-500 peer-checked:to-green-600
                          shadow-inner peer-checked:shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <div class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                          bg-white dark:bg-gray-100 flex items-center justify-center
                          transition-all duration-500 ease-in-out
                          peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                          shadow-md group-hover:scale-110">
                {#if $activeFilter === 'orphans'} ⚠️ {:else} 🟢 {/if}
              </div>
            </label>
            <span class="text-sm font-medium tracking-wide 
                         bg-gradient-to-r from-emerald-600 to-green-600 
                         dark:from-emerald-400 dark:to-green-400
                         bg-clip-text text-transparent">
              {$activeFilter === 'orphans' 
                ? `Symlinks brisés uniquement (${$allBrokenCount})` 
                : `Symlinks brisés (${$allBrokenCount})`}
            </span>
          </button>
        {/if}

        <!-- ✅ Toggle Doublons -->
        {#if $duplicatesCount > 0}
          <button
            type="button"
            class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                   border-yellow-200 dark:border-yellow-700 
                   bg-yellow-50 dark:bg-yellow-900/40 shadow-sm
                   hover:shadow-md transition-all duration-300
                   cursor-pointer"
            on:click={() => {
              activeFilter.set($activeFilter === 'duplicates' ? 'none' : 'duplicates');
              refreshList();
            }}
          >
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input type="checkbox" checked={$activeFilter === 'duplicates'} class="sr-only peer" />
              <div class="w-12 h-6 rounded-full transition-all duration-500
                          bg-gradient-to-r from-gray-200 to-gray-400 
                          dark:from-gray-700 dark:to-gray-900
                          peer-checked:from-yellow-400 peer-checked:to-yellow-600
                          shadow-inner peer-checked:shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
              <div class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                          bg-white dark:bg-gray-100 flex items-center justify-center
                          transition-all duration-500 ease-in-out
                          peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                          shadow-md group-hover:scale-110">
                {#if $activeFilter === 'duplicates'} 🔁 {:else} 🟡 {/if}
              </div>
            </label>
            <span class="text-sm font-medium tracking-wide 
                         bg-gradient-to-r from-yellow-600 to-yellow-500 
                         dark:from-yellow-400 dark:to-yellow-300
                         bg-clip-text text-transparent">
              {$activeFilter === 'duplicates'
                ? `Doublons uniquement (${$duplicatesCount})`
                : `Voir doublons (${$duplicatesCount})`}
            </span>
          </button>
        {/if}

        <!-- ✅ Toggle Derniers symlinks -->
        <button
          type="button"
          class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-indigo-200 dark:border-indigo-700 
                 bg-indigo-50 dark:bg-indigo-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer"
          on:click={() => {
            activeFilter.set($activeFilter === 'latest' ? 'none' : 'latest');
            refreshList();
          }}
        >
          <label class="relative inline-flex items-center cursor-pointer select-none">
            <input type="checkbox" checked={$activeFilter === 'latest'} class="sr-only peer" />
            <div class="w-12 h-6 rounded-full transition-all duration-500
                        bg-gradient-to-r from-gray-200 to-gray-400 
                        dark:from-gray-700 dark:to-gray-900
                        peer-checked:from-pink-500 peer-checked:via-purple-500 peer-checked:to-indigo-500
                        shadow-inner peer-checked:shadow-[0_0_8px_rgba(236,72,153,0.5)]"></div>
            <div class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                        bg-white dark:bg-gray-100 flex items-center justify-center
                        transition-all duration-500 ease-in-out
                        peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                        shadow-md group-hover:scale-110">
              {#if $activeFilter === 'latest'}
                <Sparkles class="w-3.5 h-3.5 text-indigo-600 animate-pulse-slow" />
              {:else}
                <FolderOpen class="w-3.5 h-3.5 text-gray-500" />
              {/if}
            </div>
          </label>
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 
                       dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400
                       bg-clip-text text-transparent">
            Derniers symlinks ajoutés
          </span>
        </button>

        <button
          type="button"
          class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-emerald-200 dark:border-emerald-700 
                 bg-emerald-50 dark:bg-emerald-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer"
          on:click={() => window.location.href = `${baseURL}/settings/activity`}
        >
          <div class="w-6 h-6 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
            <Tv size={20} />
          </div>
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-emerald-500 to-teal-500 
                       dark:from-emerald-300 dark:to-teal-400
                       bg-clip-text text-transparent">
            Rapport Activité
          </span>
        </button>

        <button
          type="button"
          class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-amber-300 dark:border-amber-700 
                 bg-amber-50 dark:bg-amber-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer"
          on:click={() => window.location.href = `${baseURL}/settings/rename`}
        >
          <div class="w-6 h-6 flex items-center justify-center text-amber-600 dark:text-amber-300">
            <Edit3 size={20} />
          </div>

          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-amber-500 to-yellow-500
                       dark:from-amber-300 dark:to-yellow-400
                       bg-clip-text text-transparent">
            Renommage
          </span>
        </button>

        <!-- ✅ Refresh -->
        <button
          type="button"
          class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-blue-200 dark:border-blue-700 
                 bg-blue-50 dark:bg-blue-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer disabled:opacity-50"
          on:click={refreshList}
          disabled={$refreshing}
        >
          {#if $refreshing}
            <Loader2 class="w-5 h-5 animate-spin text-blue-600 dark:text-blue-300" />
          {:else if $refreshSuccess}
            <CheckCircle2 class="w-5 h-5 text-green-600 dark:text-green-400" />
          {:else}
            <RefreshCw class="w-5 h-5 text-blue-600 dark:text-blue-300" />
          {/if}
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-blue-600 to-sky-600 
                       dark:from-blue-400 dark:to-sky-400
                       bg-clip-text text-transparent">
            Refresh
          </span>
        </button>

        <!-- ✅ Scan -->
        <button
          type="button"
          class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-red-200 dark:border-red-700 
                 bg-red-50 dark:bg-red-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer disabled:opacity-50"
          on:click={triggerScan}
          disabled={$scanning}
        >
          {#if $scanning}
            <Loader2 class="w-5 h-5 animate-spin text-red-600 dark:text-red-300" />
          {:else if $scanSuccess}
            <CheckCircle2 class="w-5 h-5 text-green-600 dark:text-green-400" />
          {:else}
            <Scan class="w-5 h-5 text-red-600 dark:text-red-300" />
          {/if}
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-red-600 to-rose-600 
                       dark:from-red-400 dark:to-rose-400
                       bg-clip-text text-transparent">
            Scan
          </span>
        </button>

        <!-- ✅ Config -->
        <button
          type="button"
          class="w-full inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-gray-200 dark:border-gray-700 
                 bg-gray-50 dark:bg-gray-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer"
          on:click={() => goto('/settings/symlinks/setup')}
        >
          <div class="w-5 h-5 flex items-center justify-center text-gray-600 dark:text-gray-300">
            ⚙️
          </div>
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-gray-600 to-slate-600 
                       dark:from-gray-400 dark:to-slate-400
                       bg-clip-text text-transparent">
            Configuration
          </span>
        </button>
      </div>
    </details>
  </div>

  <!-- 👈 Boutons desktop gauche -->
  <div class="hidden md:flex flex-wrap gap-2 items-center">

<!-- ✅ Bouton Seasonarr -->
      <button
        type="button"
        class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
               border-purple-200 dark:border-purple-700 
               bg-purple-50 dark:bg-purple-900/40 shadow-sm
               hover:shadow-md transition-all duration-300
               cursor-pointer"
        on:click={() => window.location.href = `${baseURL}/season/dashboard`}
      >
        <!-- Icône -->
        <div class="w-6 h-6 flex items-center justify-center text-purple-600 dark:text-purple-300">
          <Tv size={20} />
        </div>

        <!-- Label -->
        <span class="text-sm font-medium tracking-wide 
                     bg-gradient-to-r from-purple-600 to-fuchsia-600 
                     dark:from-purple-400 dark:to-fuchsia-400
                     bg-clip-text text-transparent">
          Seasonarr (Packs Saisons)
        </span>
      </button>

    {#if $allBrokenCount > 0}
      <!-- ✅ Toggle Symlinks brisés -->
      <button
        type="button"
        class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
               border-emerald-200 dark:border-emerald-700 
               bg-emerald-50 dark:bg-emerald-900/40 shadow-sm
               hover:shadow-md transition-all duration-300
               cursor-pointer"
        on:click={() => {
          activeFilter.set($activeFilter === 'orphans' ? 'none' : 'orphans');
          refreshList();
        }}
      >
        <label class="relative inline-flex items-center cursor-pointer select-none">
          <input type="checkbox" checked={$activeFilter === 'orphans'} class="sr-only peer" />
          <div class="w-12 h-6 rounded-full transition-all duration-500
                      bg-gradient-to-r from-gray-200 to-gray-400 
                      dark:from-gray-700 dark:to-gray-900
                      peer-checked:from-emerald-500 peer-checked:via-teal-500 peer-checked:to-green-500
                      shadow-inner peer-checked:shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          <div class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                      bg-white dark:bg-gray-100 flex items-center justify-center
                      transition-all duration-500 ease-in-out
                      peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                      shadow-md group-hover:scale-110">
            {#if $activeFilter === 'orphans'} ⚠️ {:else} ✔️ {/if}
          </div>
        </label>
        <span class="text-sm font-medium tracking-wide 
                     bg-gradient-to-r from-emerald-600 to-green-600 
                     dark:from-emerald-400 dark:to-green-400
                     bg-clip-text text-transparent">
          {$activeFilter === 'orphans' 
            ? `Symlinks brisés uniquement (${$allBrokenCount})` 
            : `Symlinks brisés (${$allBrokenCount})`}
        </span>
      </button>
    {/if}

    <!-- ✅ Toggle Doublons -->
    {#if $duplicatesCount > 0}
      <button
        type="button"
        class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
               border-yellow-200 dark:border-yellow-700 
               bg-yellow-50 dark:bg-yellow-900/40 shadow-sm
               hover:shadow-md transition-all duration-300
               cursor-pointer"
        on:click={() => {
          activeFilter.set($activeFilter === 'duplicates' ? 'none' : 'duplicates');
          refreshList();
        }}
      >
        <label class="relative inline-flex items-center cursor-pointer select-none">
          <input type="checkbox" checked={$activeFilter === 'duplicates'} class="sr-only peer" />
          <div class="w-12 h-6 rounded-full transition-all duration-500
                      bg-gradient-to-r from-gray-200 to-gray-400 
                      dark:from-gray-700 dark:to-gray-900
                      peer-checked:from-yellow-400 peer-checked:to-yellow-600
                      shadow-inner peer-checked:shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
          <div class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                      bg-white dark:bg-gray-100 flex items-center justify-center
                      transition-all duration-500 ease-in-out
                      peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                      shadow-md group-hover:scale-110">
            {#if $activeFilter === 'duplicates'} 🔁 {:else} 🟡 {/if}
          </div>
        </label>
            <span class="text-sm font-medium tracking-wide 
                         bg-gradient-to-r from-yellow-600 to-yellow-500 
                         dark:from-yellow-400 dark:to-yellow-300
                         bg-clip-text text-transparent">
              {$activeFilter === 'duplicates'
                ? `Doublons uniquement (${$duplicatesCount})`
                : `Voir doublons (${$duplicatesCount})`}
            </span>
      </button>
    {/if}

    <!-- ✅ Toggle Derniers symlinks -->
    <button
      type="button"
      class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
             border-indigo-200 dark:border-indigo-700 
             bg-indigo-50 dark:bg-indigo-900/40 shadow-sm
             hover:shadow-md transition-all duration-300
             cursor-pointer"
      on:click={() => {
        activeFilter.set($activeFilter === 'latest' ? 'none' : 'latest');
        refreshList();
      }}
    >
      <label class="relative inline-flex items-center cursor-pointer select-none">
        <input type="checkbox" checked={$activeFilter === 'latest'} class="sr-only peer" />
        <div class="w-12 h-6 rounded-full transition-all duration-500
                    bg-gradient-to-r from-gray-200 to-gray-400 
                    dark:from-gray-700 dark:to-gray-900
                    peer-checked:from-pink-500 peer-checked:via-purple-500 peer-checked:to-indigo-500
                    shadow-inner peer-checked:shadow-[0_0_8px_rgba(236,72,153,0.5)]"></div>
        <div class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                    bg-white dark:bg-gray-100 flex items-center justify-center
                    transition-all duration-500 ease-in-out
                    peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                    shadow-md group-hover:scale-110">
          {#if $activeFilter === 'latest'}
            <Sparkles class="w-3.5 h-3.5 text-indigo-600 animate-pulse-slow" />
          {:else}
            <FolderOpen class="w-3.5 h-3.5 text-gray-500" />
          {/if}
        </div>
      </label>
      <span class="text-sm font-medium tracking-wide 
                   bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 
                   dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400
                   bg-clip-text text-transparent">
        Derniers symlinks ajoutés
      </span>
    </button>

      <button
        type="button"
        class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
               border-emerald-200 dark:border-emerald-700 
               bg-emerald-50 dark:bg-emerald-900/40 shadow-sm
               hover:shadow-md transition-all duration-300
               cursor-pointer"
        on:click={() => window.location.href = `${baseURL}/settings/activity`}
      >
        <!-- Icône -->
        <div class="w-6 h-6 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
          <Tv size={20} />
        </div>

        <!-- Label -->
        <span class="text-sm font-medium tracking-wide 
                     bg-gradient-to-r from-emerald-500 to-teal-500 
                     dark:from-emerald-300 dark:to-teal-400
                     bg-clip-text text-transparent">
          Rapport Activité
        </span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
               border-amber-300 dark:border-amber-700 
               bg-amber-50 dark:bg-amber-900/30 shadow-sm
               hover:shadow-md transition-all duration-300
               cursor-pointer"
        on:click={() => window.location.href = `${baseURL}/settings/rename`}
      >
        <!-- Icône -->
        <div class="w-6 h-6 flex items-center justify-center text-amber-600 dark:text-amber-300">
          <Edit3 size={20} />
        </div>

        <!-- Label -->
        <span class="text-sm font-medium tracking-wide 
                     bg-gradient-to-r from-amber-600 to-amber-500 
                     dark:from-amber-300 dark:to-amber-400
                     bg-clip-text text-transparent">
          Renommage
        </span>
      </button>

  </div>

  <!-- 🔺 Boutons desktop à droite -->
  <div class="hidden md:flex flex-wrap gap-2 justify-end">
        <!-- ✅ Bouton Refresh -->
        <button
          type="button"
          class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-blue-200 dark:border-blue-700 
                 bg-blue-50 dark:bg-blue-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer disabled:opacity-50"
          on:click={refreshList}
          disabled={$refreshing}
        >
          <!-- Icône dynamique -->
          {#if $refreshing}
            <Loader2 class="w-5 h-5 animate-spin text-blue-600 dark:text-blue-300" />
          {:else if $refreshSuccess}
            <CheckCircle2 class="w-5 h-5 text-green-600 dark:text-green-400" />
          {:else}
            <RefreshCw class="w-5 h-5 text-blue-600 dark:text-blue-300" />
          {/if}

          <!-- Label -->
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-blue-600 to-sky-600 
                       dark:from-blue-400 dark:to-sky-400
                       bg-clip-text text-transparent">
            Refresh
          </span>
        </button>

        <!-- ✅ Bouton Scan -->
        <button
          type="button"
          class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-red-200 dark:border-red-700 
                 bg-red-50 dark:bg-red-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer disabled:opacity-50"
          on:click={triggerScan}
          disabled={$scanning}
        >
          <!-- Icône dynamique -->
          {#if $scanning}
            <Loader2 class="w-5 h-5 animate-spin text-red-600 dark:text-red-300" />
          {:else if $scanSuccess}
            <CheckCircle2 class="w-5 h-5 text-green-600 dark:text-green-400" />
          {:else}
            <Scan class="w-5 h-5 text-red-600 dark:text-red-300" />
          {/if}

          <!-- Label -->
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-red-600 to-rose-600 
                       dark:from-red-400 dark:to-rose-400
                       bg-clip-text text-transparent">
            Scan
          </span>
        </button>

        <!-- ✅ Bouton Configuration -->
        <button
          type="button"
          class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-gray-200 dark:border-gray-700 
                 bg-gray-50 dark:bg-gray-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer"
          on:click={() => goto('/settings/symlinks/setup')}
        >
          <!-- Icône -->
          <div class="w-5 h-5 flex items-center justify-center text-gray-600 dark:text-gray-300">
            ⚙️
          </div>

          <!-- Label -->
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-gray-600 to-slate-600 
                       dark:from-gray-400 dark:to-slate-400
                       bg-clip-text text-transparent">
            Configuration
          </span>
        </button>
  </div>
</div>

  <!-- Scan en cours -->
  {#if $scanStatus}
    <div class="p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 rounded shadow flex items-center gap-2">
      <Info class="w-4 h-4" /> Scan in progress...
    </div>
  {/if}

  <!--  Statistiques -->
  <div class="pl-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow transition transform hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
      <p class="text-sm text-gray-600 dark:text-gray-400">Total Symlinks</p>
      <h2 class="text-xl font-bold">{$totalItems}</h2>
    </div>
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow transition transform hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
      <p class="text-sm text-gray-600 dark:text-gray-400">Symlinks brisés</p>
      <h2 class="text-xl font-bold">{$orphaned}</h2>
    </div>
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow transition transform hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg">
      <p class="text-sm text-gray-600 dark:text-gray-400">Cibles uniques</p>
      <h2 class="text-xl font-bold">{$uniqueTargets}</h2>
    </div>
  </div>

  <!-- 🔍 Champ de recherche + bouton suppression -->
  <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
    <div class="flex items-center w-full sm:w-2/3 gap-2 relative">
      <div class="relative flex-grow">
        <input
          bind:value={$search}
          placeholder="Search symlinks..."
          class="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
        />
        <Search class="absolute top-2.5 left-3 text-gray-400 w-5 h-5" />
      </div>

      {#if searchTerm.length > 0 && $totalItems > 0}
        <button
          on:click={deleteFilteredSymlinks}
          class="btn btn-red-deep whitespace-nowrap"
          disabled={$bulkDeleting}
        >
          {#if $bulkDeleting}
            <Loader2 class="w-4 h-4 animate-spin text-white" /> Suppression...
          {:else if $bulkDeleteSuccess}
            <CheckCircle2 class="w-4 h-4 text-white" /> Supprimés !
          {:else}
            <Trash class="w-4 h-4" /> Supprimer {$totalItems} symlink{s($totalItems)} filtré{s($totalItems)}
          {/if}
        </button>
      {/if}
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

      <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <FolderSearch class="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
      </div>

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

  {#if $activeFilter === 'orphans'}
    <div class="flex items-center gap-6 mt-8">
      <!-- 🚀 Bouton premium pour tout réparer -->
      <button
        type="button"
        class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
               border-emerald-200 dark:border-emerald-700 
               bg-emerald-50 dark:bg-emerald-900/40 shadow-sm
               hover:shadow-md transition-all duration-300
               cursor-pointer disabled:opacity-50"
        on:click={deleteAllBrokenSymlinks}
        disabled={$bulkDeleting}
      >
        {#if $bulkDeleting}
          <Loader2 class="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-300" />
          <span class="text-sm font-medium text-emerald-600 dark:text-emerald-300">
            Réparation en cours...
          </span>
        {:else if $bulkDeleteSuccess}
          <CheckCircle2 class="w-5 h-5 text-green-600 dark:text-green-400" />
          <span class="text-sm font-medium text-green-600 dark:text-green-400">
            Réparé !
          </span>
        {:else}
          <span class="text-lg">🛠️</span>
          <span class="text-sm font-medium tracking-wide 
                       bg-gradient-to-r from-emerald-600 to-green-600 
                       dark:from-emerald-400 dark:to-green-400
                       bg-clip-text text-transparent">
            Tout réparer
          </span>
        {/if}
      </button>
    </div>
  {/if}

<!-- Liste des symlinks -->
{#if $activeFilter === 'latest'}
  <!-- Derniers symlinks uniquement (pas de pagination) -->
  <div class="mt-10">
    <div class="relative mb-4 flex items-center">
      <span
        class="mr-2 flex items-center justify-center w-6 h-6 rounded-full 
               bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500
               text-white shadow-md animate-pulse-slow"
      >
        <Sparkles class="w-4 h-4 animate-spin-slow" />
      </span>
      <span class="text-sm md:text-base lg:text-lg 
                   bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 
                   bg-clip-text text-transparent">
        100 Derniers symlinks ajoutés
      </span>
    </div>

    <div class="space-y-4">
        {#each $symlinks as item}
            <SymlinkCard
                {item}
                onOpenPopup={openPopup}
                onOpenArr={openArr}
                onDelete={deleteSymlink}
            />
        {/each}
    </div>
  </div>
{:else}
  <!-- Tableau principal avec pagination -->
  <Pagination
    page={$currentPage}
    totalItems={$totalItems}
    pageSize={$rowsPerPage}
    on:changePage={(e) => goToPage(e.detail)}
  />

  <div class="space-y-4 mt-6">
    {#each $symlinks as item}
      <SymlinkCard
        {item}
        onOpenPopup={openPopup}
        onOpenArr={openArr}
        onDelete={deleteSymlink}
      />
    {/each}
  </div>

  <Pagination
    page={$currentPage}
    totalItems={$totalItems}
    pageSize={$rowsPerPage}
    on:changePage={(e) => goToPage(e.detail)}
  />
{/if}

</main>

{#if $selectedItem}
  <PopupSymlink
    item={$selectedItem}
    on:delete={(e) => deleteSymlink(e.detail.item)}
    on:repair={(e) => console.log("repair", e.detail.item)}
    on:openArr={(e) => openArr(e.detail.item)}
    on:close={closePopup}
  />
{/if}
