<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { writable, derived, get } from "svelte/store";
  import { FolderSearch, ChevronDown, Search, Eye, Sparkles, FolderOpen, Trash, Clock, Folder, RefreshCw, Info, Scan, Download, Upload, Filter, Trash2, Loader2, CheckCircle2, Tv } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import Pagination from "$lib/components/Pagination.svelte";
  import PopupSymlink from "$lib/components/PopupSymlink.svelte";

    // Base URL selon dev/prod
    const baseURL = import.meta.env.DEV
      ? import.meta.env.VITE_BACKEND_URL_HTTP
      : import.meta.env.VITE_BACKEND_URL_HTTPS;

    const symlinks = writable<any[]>([]);
    const search = writable('');
    const rowsPerPage = writable(10);
    const currentPage = writable(1);
    const scanStatus = writable(false);
    const selected = writable<any[]>([]);
    const showOrphansOnly = writable(false);
    const logs = writable<string[]>([]);
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

    const deleting = writable<Record<string, boolean>>({});
    const deleteSuccess = writable<Record<string, boolean>>({});

    const selectedDir = writable('');            // 'shows' | 'movies' | '' (toutes racines)
    const availableDirs = writable<string[]>([]); // renvoyé par /symlinks/folders : ["shows","movies"]

    const bulkDeleting = writable(false);
    const bulkDeleteSuccess = writable(false);

    const repairing = writable(false);
    const repairSuccess = writable(false);

    const selectedItem = writable(null);

    let instanceId: number | null = null;
    let menu: HTMLDetailsElement;
    let sortedColumn: string | null = null;
    let ascending = true;
    let mounted = false;
    let filtersReady = false;

    export const allBrokenCount = writable(0);
    export const showDuplicatesOnly = writable(false);
    export const latestSymlinks = writable<any[]>([]);
    const showLatest = writable(false);
    const hasDuplicates = writable(false);

    const filteredSymlinks = derived(
        [symlinks, search],
        ([$symlinks, $search]) =>
            $symlinks.filter((item: any) =>
                item.symlink.toLowerCase().includes($search.toLowerCase()) ||
                item.target.toLowerCase().includes($search.toLowerCase())
            )
    );

    const duplicates = derived(symlinks, ($symlinks) => {
        const counts = new Map<string, number>();
        for (const s of $symlinks) {
            counts.set(s.target, (counts.get(s.target) || 0) + 1);
        }
        return $symlinks.filter(s => counts.get(s.target) > 1);
    });

    let searchTerm = '';

    $: searchTerm = $search.trim();

    $: if (mounted && filtersReady && $search.trim() !== "") {
        currentPage.set(1);
        refreshList();
    }

    $: if (mounted && filtersReady && $showOrphansOnly === true) {
        refreshList();
    }

    $: if (mounted && filtersReady && $showDuplicatesOnly === true) {
        refreshList();
    }

    function handleAndClose(action: () => void) {
        action();
        menu?.removeAttribute('open');
    }

    function closePopup() {
      selectedItem.set(null);
    }

    async function openPopup(item) {
        try {
            // 🎬 Cas RADARR → tout est déjà dans le store (poster, title, tmdbId)
            if (item.type === "radarr") {
                selectedItem.set({
                    ...item,
                    overview: "Film importé via Radarr",
                });
                return;
            }

            // 📺 Cas SONARR (séries)
            if (!item.show_id) {
                console.warn("⚠ Pas de show_id dans l'item", item);
                selectedItem.set({
                    ...item,
                    poster: null,
                    title: item.symlink,
                    overview: "Aucun détail trouvé",
                });
                return;
            }

            // 🔍 Appel API pour récupérer le détail de la série
            const res = await fetch(`/api/v1/shows/${item.show_id}?instance_id=${instanceId}`);
            if (!res.ok) {
                throw new Error("Impossible de charger le détail du show");
            }
            const show = await res.json();

            let posterUrl = null;
            if (show.poster) {
                posterUrl = `/api/v1/proxy-image?url=${encodeURIComponent(show.poster)}&instance_id=${instanceId}`;
            }

            // Enrichir l’item et l’envoyer dans le popup
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
            selectedItem.set({
                ...item,
                poster: null,
                overview: "Erreur lors du chargement des infos",
            });
        }
    }

    function goToPage(p: number) {
      currentPage.set(p);
      refreshList();
    }

    async function openArr(item: any) {
        console.log("🔥 [openArr] déclenché");
        console.log("   ➡️ type:", item.type, "| symlink:", item.symlink);

        const { root, relative } = relativeToRoot(item.symlink);
        console.log("   📂 relativeToRoot →", { root, relative });

        if (!relative || !root) {
            console.warn("   ❌ root/relative vide → arrêt avant fetch");
            alert("Impossible de déterminer le chemin relatif à la racine.");
            return;
        }

        try {
            let route = "";
            if (item.type.toLowerCase() === "sonarr") {
                // Série → on garde relative complet
                route = `/api/v1/symlinks/get-sonarr-url/${encodeURIComponent(relative)}`;
            } else if (item.type.toLowerCase() === "radarr") {
                // Film → on prend seulement le dossier parent
                const relativeDir = relative.split("/")[0];
                console.log("   🎬 Radarr → dossier parent utilisé:", relativeDir);
                route = `/api/v1/symlinks/get-radarr-url/${encodeURIComponent(relativeDir)}`;
            } else {
                console.warn("   ❌ type non supporté:", item.type);
                return;
            }

            console.log("   📡 Route construite:", route);
            console.log("   🌍 URL complète:", `${baseURL}${route}`);

            const res = await fetch(`${baseURL}${route}`);
            console.log("   📥 Réponse brute fetch:", res);

            if (!res.ok) {
                console.error("   ❌ Erreur HTTP:", res.status);
                throw new Error(`HTTP ${res.status}`);
            }

            const json = await res.json();
            console.log("   ✅ Réponse JSON backend:", json);

            // Redirection finale
            window.location.href = json.url;
        } catch (e: any) {
            console.error("   💥 Exception dans openArr:", e);
            alert(`Erreur ouverture ${item.type}: ${e?.message || e}`);
        }
    }

    async function loadLatestSymlinks() {
        try {
            const searchTermVal = get(search);
            const folder = get(selectedDir);  // 'shows' | 'movies' | ''
            const orphansOnly = get(showOrphansOnly);

            const params = new URLSearchParams({
                sort: "created_at",
                order: "desc",
                limit: "10"
            });

            if (searchTermVal.trim()) params.append("search", searchTermVal.trim());
            if (folder) params.append("folder", folder);
            if (orphansOnly) params.append("orphans", "true");

            const res = await fetch(`${baseURL}/api/v1/symlinks?${params.toString()}`);
            if (!res.ok) throw new Error("Erreur chargement derniers symlinks");

            const json = await res.json();
            latestSymlinks.set(json.data || []);
        } catch (e) {
            console.error("❌ loadLatestSymlinks:", e);
            latestSymlinks.set([]);
        }
    }

    // --------- util: chemin relatif à la racine ---------
    function relativeToRoot(absPath: string): { root: string | null, relative: string } {
        // On essaie de repérer le segment '/<racine>/' dans le chemin absolu, à partir de la liste des racines
        const roots = get(availableDirs); // ex: ['shows', 'movies']
        if (!absPath) return { root: null, relative: '' };

        // Normaliser séparateurs (au cas où)
        const norm = absPath.replace(/\\/g, '/');

        for (const r of roots) {
            const needle = `/${r}/`;
            const idx = norm.indexOf(needle);
            if (idx !== -1) {
                const rel = norm.substring(idx + needle.length); // tout ce qui vient après '<racine>/'
                return { root: r, relative: rel };
            }
        }

        // Si pas trouvé, on tente une autre stratégie: récupérer la dernière racine plausible
        // (sécurise un peu mais on préfère retourner vide plutôt que casser)
        return { root: null, relative: '' };
    }

    async function repairMissingSeasons() {
      if (get(repairing)) return;

      repairing.set(true);
      repairSuccess.set(false);

      try {
        const folder = get(selectedDir); // 'shows' | 'movies' | ''
        const url = `${baseURL}/api/v1/symlinks/repair-missing-seasons` + (folder ? `?folder=${encodeURIComponent(folder)}` : '');

        const res = await fetch(url, { method: 'POST' });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `HTTP ${res.status}`);
        }

        const json = await res.json().catch(() => ({}));
        logs.update(l => [
          `🛠️ Réparation effectuée${json.symlinks_deleted !== undefined ? ` — ${json.symlinks_deleted} symlink(s) supprimé(s)` : ''}`,
          ...l
        ]);

        repairSuccess.set(true);
        setTimeout(() => repairSuccess.set(false), 2500);

        await refreshList();
      } catch (e: any) {
        console.error('repairMissingSeasons:', e);
        alert(`❌ Échec de la réparation: ${e?.message || e}`);
      } finally {
        repairing.set(false);
      }
    }

    async function loadSymlinks() {
        try {
            const res = await fetch(`${baseURL}/api/v1/symlinks?page=1&limit=200`);
            if (!res.ok) throw new Error("Erreur chargement symlinks");

            const json = await res.json();
            symlinks.set(json.data);
            totalItems.set(json.total || json.data?.length || 0);

            logs.update(l => [`Liste initiale chargée (${json.total}) symlinks`, ...l]);
        } catch (e) {
            console.error("❌ loadSymlinks:", e);
        }
    }

    // Nombre de symlinks cassés
    $: brokenCount = $symlinks.filter((i: any) => i.ref_count === 0 || i.target_exists === false).length;

    function sortBy(column: string) {
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

    function s(count: number) {
        return count > 1 ? 's' : '';
    }

    async function deleteAllBrokenSymlinks() {
        if (!confirm("🗑️ Supprimer tous les symlinks cassés sélectionnés ?")) return;

        const folderRaw = get(selectedDir);
        const folder = (folderRaw ?? '').toString().trim(); // nom choisi par l’utilisateur

        // Construction des routes selon le dossier choisi
        let routes: string[] = [];
        if (folder) {
            // Si une racine est choisie → on essaie les deux APIs avec ce nom
            routes = [
                `/api/v1/symlinks/delete_broken_sonarr?folder=${encodeURIComponent(folder)}`,
                `/api/v1/symlinks/delete_broken?folder=${encodeURIComponent(folder)}`
            ];
        } else {
            // Si aucune racine sélectionnée → on lance les deux globalement
            routes = [
                '/api/v1/symlinks/delete_broken_sonarr',
                '/api/v1/symlinks/delete_broken'
            ];
        }

        // Debug : afficher ce qui part
        console.log("deleteAllBrokenSymlinks | routes=", routes);
        logs.update(l => [
            `🧭 deleteAllBrokenSymlinks | folder='${folder || '(all)'}' | routes=${routes.join(', ')}`,
            ...l
        ]);

        bulkDeleting.set(true);
        bulkDeleteSuccess.set(false);

        const tasks = routes.map(async (route) => {
            try {
                const res = await fetch(`${baseURL}${route}`, { method: 'POST' });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    logs.update(l => [`❌ ${route} — ${text || `HTTP ${res.status}`}`, ...l]);
                    return 0;
                }
                const json = await res.json().catch(() => ({} as any));
                const deleted = Number(json.deleted) || 0;
                logs.update(l => [`✅ ${deleted} supprimé(s) via ${route}`, ...l]);
                return deleted;
            } catch (e: any) {
                logs.update(l => [`❌ Réseau ${route} — ${e?.message || e}`, ...l]);
                return 0;
            }
        });

        const results = await Promise.allSettled(tasks);
        const totalDeleted = results.reduce(
            (sum, r) => sum + (r.status === 'fulfilled' ? (r.value as number) : 0),
            0
        );

        logs.update(l => [`🧹 Total supprimé : ${totalDeleted}`, ...l]);
        bulkDeleteSuccess.set(true);
        setTimeout(() => bulkDeleteSuccess.set(false), 3000);

        try {
            await refreshList();
        } finally {
            bulkDeleting.set(false);
        }
    }

    async function loadAvailableDirs() {
        try {
            const foldersRes = await fetch(`${baseURL}/api/v1/symlinks/folders`);
            if (foldersRes.ok) {
                const folders = await foldersRes.json(); // ex: ["shows","movies"]
                availableDirs.set(folders);
            }
        } catch (e) {
            console.error('Erreur chargement dossiers :', e);
        }
    }

    function changePage(offset: number) {
        currentPage.update(n => {
            const newPage = Math.max(1, n + offset);
            refreshList();
            return newPage;
        });
    }

    function toggleSelected(item: any) {
        selected.update(list =>
            list.includes(item) ? list.filter(i => i !== item) : [...list, item]
        );
    }

    function viewSymlink(item: any) {
        alert(`Symlink: ${item.symlink}\nTarget: ${item.target}\nRef Count: ${item.ref_count}`);
    }


    async function deleteSymlink(item: any) {
        if (item.type === 'sonarr') {
            // 🗑️ Suppression côté backend (comme Radarr)
            const { root, relative } = relativeToRoot(item.symlink);
            if (!relative || !root) {
                alert("Impossible de déterminer le chemin relatif à la racine.");
                return;
            }

            const route = `/api/v1/symlinks/delete-sonarr/${encodeURIComponent(relative)}?root=${encodeURIComponent(root)}`;
            deleting.update(state => ({ ...state, [item.symlink]: true }));
            deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));

            try {
                const res = await fetch(`${baseURL}${route}`, { method: 'DELETE' });
                if (!res.ok) {
                    const error = await res.json().catch(() => ({}));
                    console.warn(`Suppression Sonarr locale uniquement : ${error.detail || res.status}`);
                }
                logs.update(list => [`🗑️ Supprimé (Sonarr) : ${item.symlink}`, ...list]);
                deleteSuccess.update(state => ({ ...state, [item.symlink]: true }));
                setTimeout(() => {
                    deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));
                }, 2000);
            } catch {
                alert('Erreur réseau lors de la suppression Sonarr');
            } finally {
                deleting.update(state => ({ ...state, [item.symlink]: false }));
            }
            return;
        }

        // 🗑️ Suppression classique pour les autres types (Radarr, etc.)
        const { root, relative } = relativeToRoot(item.symlink);
        if (!relative || !root) {
            alert("Impossible de déterminer le chemin relatif à la racine.");
            return;
        }

        const route = `/api/v1/symlinks/delete/${encodeURIComponent(relative)}`;
        deleting.update(state => ({ ...state, [item.symlink]: true }));
        deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));

        try {
            const res = await fetch(`${baseURL}${route}`, { method: 'DELETE' });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                console.warn(`Suppression Radarr locale uniquement : ${error.detail || res.status}`);
            }
            logs.update(list => [`🗑️ Supprimé : ${item.symlink}`, ...list]);
            deleteSuccess.update(state => ({ ...state, [item.symlink]: true }));
            setTimeout(() => {
                deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));
            }, 2000);
        } catch {
            alert('Erreur réseau lors de la suppression');
        } finally {
            deleting.update(state => ({ ...state, [item.symlink]: false }));
        }
    }

    function exportJSON() {
        exporting.set(true);
        exportSuccess.set(false);
        symlinks.subscribe((data: any[]) => {
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

    function importJSON(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        importing.set(true);
        importSuccess.set(false);

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const imported = JSON.parse(String(reader.result));
                symlinks.set(imported);
                logs.update(list => [`Imported ${imported.length} symlinks`, ...list]);
                importSuccess.set(true);
                setTimeout(() => importSuccess.set(false), 2000);
            } catch {
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
        try {
            const res = await fetch(`${baseURL}/api/v1/symlinks/scan`, { method: 'POST' });
            if (res.ok) {
                const json = await res.json();
                symlinks.set(json.data);
                logs.update(l => [`Scan réussi avec ${json.count} liens`, ...l]);
                scanSuccess.set(true);
                setTimeout(() => scanSuccess.set(false), 2000);
            }
        } finally {
            scanning.set(false);
        }
    }

    async function refreshList() {
        refreshing.set(true);
        refreshSuccess.set(false);
        try {
            const page = get(currentPage);
            const limit = get(rowsPerPage);
            const searchTermVal = get(search);
            const orphansOnly = get(showOrphansOnly);
            const sort = sortedColumn || 'symlink';
            const order = ascending ? 'asc' : 'desc';

            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                sort,
                order
            });

            if (searchTermVal.trim()) params.append('search', searchTermVal.trim());
            if (orphansOnly) params.append('orphans', 'true');
            const folder = get(selectedDir);
            if (folder) params.append('folder', folder);

            const res = await fetch(`${baseURL}/api/v1/symlinks?${params.toString()}`);
            if (!res.ok) throw new Error(`Erreur serveur ${res.status}`);

            const json = await res.json();
            symlinks.set(json.data);
            totalItems.set(json.total);
            orphaned.set(json.orphaned || 0);
            allBrokenCount.set(json.orphaned || 0);
            uniqueTargets.set(json.unique_targets || 0);
            await loadLatestSymlinks();

            logs.update(l => [`Liste rafraîchie (page ${json.page})`, ...l]);
            refreshSuccess.set(true);
            setTimeout(() => refreshSuccess.set(false), 2000);

        } finally {
            refreshing.set(false);
        }
    }

    // --- suppression en masse des symlinks actuellement filtrés (barre de recherche) ---
    async function deleteFilteredSymlinks() {
        const folder = get(selectedDir);                // 'shows' | 'movies' | ''
        const searchTermVal = get(search).trim();

        // récupérer la liste "complète" sans pagination pour supprimer tout ce qui matche
        const params = new URLSearchParams();
        params.set('all', 'true');                      // ⚠ côté backend: renvoie tous les items filtrés
        if (folder) params.set('folder', folder);
        if (searchTermVal) params.set('search', searchTermVal);

        const res = await fetch(`${baseURL}/api/v1/symlinks?${params.toString()}`);
        if (!res.ok) {
            alert(`Erreur récupération symlinks : ${res.status}`);
            return;
        }
        const json = await res.json();
        const symlinksToDelete: any[] = json.data || [];

        bulkDeleting.set(true);
        bulkDeleteSuccess.set(false);
        const timeout = setTimeout(() => {
            bulkDeleting.set(false);
        }, 5000);

        for (const item of symlinksToDelete) {
            const { root, relative } = relativeToRoot(item.symlink);
            if (!relative || !root) {
                logs.update(l => [`❌ Impossible de dériver le chemin relatif pour ${item.symlink}`, ...l]);
                continue;
            }

            const route =
                item.type === 'sonarr'
                    ? `/api/v1/symlinks/delete-sonarr/${encodeURIComponent(relative)}?root=${encodeURIComponent(root)}`
                    : `/api/v1/symlinks/delete/${encodeURIComponent(relative)}`;

            deleting.update(state => ({ ...state, [item.symlink]: true }));
            deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));

            try {
                const delRes = await fetch(`${baseURL}${route}`, { method: 'DELETE' });
                if (!delRes.ok) {
                    const error = await delRes.json().catch(() => ({}));
                    logs.update(l => [`❌ Erreur suppression ${item.symlink} : ${error.detail || delRes.status}`, ...l]);
                    continue;
                }

                logs.update(l => [`🗑️ Supprimé : ${item.symlink}`, ...l]);
                deleteSuccess.update(state => ({ ...state, [item.symlink]: true }));
                setTimeout(() => {
                    deleteSuccess.update(state => ({ ...state, [item.symlink]: false }));
                }, 2000);
            } catch {
                logs.update(l => [`❌ Erreur réseau pour : ${item.symlink}`, ...l]);
            } finally {
                deleting.update(state => ({ ...state, [item.symlink]: false }));
            }
        }

        bulkDeleteSuccess.set(true);
        refreshList();
        setTimeout(() => bulkDeleteSuccess.set(false), 3000);
        bulkDeleting.set(false);
        clearTimeout(timeout);
    }

    onMount(async () => {
        mounted = true;
        await loadAvailableDirs();   // ➜ racines
        await refreshList();         // premier appel volontaire

        filtersReady = true;         // ✅ maintenant on autorise les $:

        connectSSE();

        const unsubscribe = showOrphansOnly.subscribe(() => {
            if (filtersReady) {
                refreshList();
            }
        });

        // Fallback seulement si liste vide
        setTimeout(() => {
            if (get(symlinks).length === 0) {
                refreshList();
            }
        }, 2000);

        return () => {
            unsubscribe();
        };
    });

function connectSSE() {
    const eventSource = new EventSource(`${baseURL}/api/v1/symlinks/events`);

    // On écoute spécifiquement les événements de type "symlink_update"
    eventSource.addEventListener("symlink_update", async (event: MessageEvent) => {
        try {
            const payload = JSON.parse(event.data);
            console.log('Événement SSE reçu:', payload); // Log l'événement reçu

            switch (payload.event) {
                case "symlink_added":
                    console.log('Symlink ajouté:', payload.item);  // Log de l'ajout du symlink
                    symlinks.update(list => {
                        if (!list.some(i => i.symlink === payload.item.symlink)) {
                            return [payload.item, ...list];
                        }
                        return list;
                    });
                    totalItems.update(n => n + 1);
                    break;

                case "symlink_removed":
                    console.log('Symlink supprimé:', payload.path); // Log de la suppression du symlink
                    symlinks.update(list =>
                        list.filter(i => i.symlink !== payload.path)
                    );
                    totalItems.update(n => Math.max(0, n - 1));
                    break;

                case "scan_completed":
                    console.log('Scan terminé, rafraîchissement de la liste'); // Log de la fin du scan
                    await refreshList();
                    break;
            }

            // 🔄 garder la liste "latest" en cohérence
            await loadLatestSymlinks();

        } catch (err) {
            console.error("❌ SSE parse error:", err);
        }
    });

    eventSource.onerror = () => {
        console.error("❌ Erreur SSE, tentative de reconnexion...");
        eventSource.close();
        setTimeout(() => connectSSE(), 2000); // reconnexion auto
    };
}

</script>

<main class="w-full min-h-screen p-4 sm:p-6 md:p-8 space-y-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">
  <!-- ✅ Barre d'actions responsive unifiée -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">

    <!-- ☕ Menu mobile -->
    <div class="md:hidden relative">
        <details bind:this={menu} class="relative">
            <summary
                class="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-lg shadow-md cursor-pointer text-sm font-semibold tracking-wide transition-transform duration-150 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
                🌐 Tableau de bord
                <ChevronDown class="w-4 h-4 opacity-80 transition-transform duration-200 group-open:rotate-180" />
            </summary>

            <div
                class="absolute z-10 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md p-2 space-y-2 w-full max-w-xs"
            >
                <button
                    on:click={() => handleAndClose(() => showOrphansOnly.update(v => !v))}
                    class="btn btn-emerald-deep w-full justify-start truncate"
                >
                    <Filter class="w-4 h-4" /> Symlinks Brisés
                </button>

                <button
                  on:click={() => window.location.href = `${import.meta.env.VITE_BACKEND_URL_HTTPS}/season/dashboard`}
                  class="btn bg-purple-600 hover:bg-purple-700 text-white w-full justify-start truncate"
                >
                  <Tv class="w-4 h-4 text-white" /> Seasonarr ( Packs Saisons )
                </button>

                {#if $allBrokenCount > 0}
                    <button
                        on:click={() => handleAndClose(deleteAllBrokenSymlinks)}
                        class="btn btn-red-deep animate-pulse-strong w-full justify-start truncate"
                        disabled={$bulkDeleting}
                    >
                        {#if $bulkDeleting}
                            <Loader2 class="w-4 h-4 animate-spin text-white" /> Suppression...
                        {:else if $bulkDeleteSuccess}
                            <CheckCircle2 class="w-4 h-4 text-white" /> Supprimés !
                        {:else}
                            <Trash class="w-4 h-4" /> Réparer {$allBrokenCount} symlink{s($allBrokenCount)} cassé{s($allBrokenCount)}
                        {/if}
                    </button>
                {/if}

                {#if $duplicates.length > 0}
                    <button
                        on:click={() => handleAndClose(() => showDuplicatesOnly.update(v => !v))}
                        class="btn btn-yellow-deep animate-pulse-strong w-full justify-start truncate"
                    >
                        🧠 { $showDuplicatesOnly ? 'Afficher tout' : 'Voir les doublons' }
                    </button>
                {/if}

                <button
                    on:click={() => handleAndClose(refreshList)}
                    class="btn btn-blue w-full justify-start truncate"
                >
                    {#if $refreshing}
                        <Loader2 class="w-4 h-4 animate-spin" /> Refreshing
                    {:else if $refreshSuccess}
                        <CheckCircle2 class="w-4 h-4 text-green-500" /> Refreshed
                    {:else}
                        <RefreshCw class="w-4 h-4" /> Refresh
                    {/if}
                </button>

                <button
                    on:click={() => handleAndClose(triggerScan)}
                    class="btn btn-red-deep w-full justify-start truncate"
                >
                    {#if $scanning}
                        <Loader2 class="w-4 h-4 animate-spin" />
                    {:else if $scanSuccess}
                        <CheckCircle2 class="w-4 h-4 text-white" /> Scanned
                    {:else}
                        <Scan class="w-4 h-4" /> Scan
                    {/if}
                </button>

                <!-- ✅ Toggle Derniers symlinks -->
                <button
                    type="button"
                    class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                           border-indigo-200 dark:border-indigo-700 
                           bg-indigo-50 dark:bg-indigo-900/40 shadow-sm
                           hover:shadow-md transition-all duration-300
                           cursor-pointer w-full"
                    on:click={() => $showLatest = !$showLatest}
                >
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" bind:checked={$showLatest} class="sr-only peer" />
                        <div
                            class="w-12 h-6 rounded-full transition-all duration-500
                                   bg-gradient-to-r from-gray-200 to-gray-400 
                                   dark:from-gray-700 dark:to-gray-900
                                   peer-checked:from-pink-500 peer-checked:via-purple-500 peer-checked:to-indigo-500
                                   shadow-inner peer-checked:shadow-[0_0_8px_rgba(236,72,153,0.5)]"
                        ></div>
                        <div
                            class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                                   bg-white dark:bg-gray-100 flex items-center justify-center
                                   transition-all duration-500 ease-in-out
                                   peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                                   shadow-md group-hover:scale-110"
                        >
                            {#if $showLatest}
                                <Sparkles class="w-3.5 h-3.5 text-indigo-600 animate-pulse-slow" />
                            {:else}
                                <FolderOpen class="w-3.5 h-3.5 text-gray-500" />
                            {/if}
                        </div>
                    </label>
                    <span
                        class="text-sm font-medium tracking-wide 
                               bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 
                               dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400
                               bg-clip-text text-transparent"
                    >
                        Derniers symlinks
                    </span>
                </button>
                <!-- ✅ Fin Toggle -->

                <button
                    on:click={() => handleAndClose(() => goto('/settings/symlinks/setup'))}
                    class="btn btn-gray w-full justify-start truncate"
                >
                    ⚙️ Configuration
                </button>
            </div>
        </details>
    </div>

    <!-- 👈 Boutons desktop -->
    <div class="hidden md:flex flex-wrap gap-2">
        <button on:click={() => showOrphansOnly.update(v => !v)} class="btn btn-emerald-deep">
            <Filter class="w-4 h-4" /> Symlinks brisés
        </button>

        <button
          on:click={() => window.location.href = `${baseURL}/season/dashboard`}
          class="btn bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Tv class="w-4 h-4 text-white" /> Seasonarr ( Packs Saisons )
        </button>

        <!-- Toggle Derniers symlinks -->
        <button
          type="button"
          class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
                 border-indigo-200 dark:border-indigo-700 
                 bg-indigo-50 dark:bg-indigo-900/40 shadow-sm
                 hover:shadow-md transition-all duration-300
                 cursor-pointer"
          on:click={() => $showLatest = !$showLatest}
        >
          <!-- Switch -->
          <label class="relative inline-flex items-center cursor-pointer select-none">
            <input type="checkbox" bind:checked={$showLatest} class="sr-only peer" />

            <!-- Track -->
            <div
              class="w-12 h-6 rounded-full transition-all duration-500
                     bg-gradient-to-r from-gray-200 to-gray-400 
                     dark:from-gray-700 dark:to-gray-900
                     peer-checked:from-pink-500 peer-checked:via-purple-500 peer-checked:to-indigo-500
                     shadow-inner peer-checked:shadow-[0_0_8px_rgba(236,72,153,0.5)]"
            ></div>

            <!-- Thumb -->
            <div
              class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
                     bg-white dark:bg-gray-100 flex items-center justify-center
                     transition-all duration-500 ease-in-out
                     peer-checked:translate-x-6 peer-checked:rotate-[360deg]
                     shadow-md group-hover:scale-110"
            >
              {#if $showLatest}
                <Sparkles class="w-3.5 h-3.5 text-indigo-600 animate-pulse-slow" />
              {:else}
                <FolderOpen class="w-3.5 h-3.5 text-gray-500" />
              {/if}
            </div>
          </label>

          <!-- Texte -->
          <span
            class="text-sm font-medium tracking-wide 
                   bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 
                   dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400
                   bg-clip-text text-transparent"
          >
            Derniers symlinks
          </span>
        </button>

        {#if $duplicates.length > 0}
            <button
                on:click={() => showDuplicatesOnly.update(v => !v)}
                class="btn btn-yellow-deep animate-pulse-strong"
            >
                🧠 { $showDuplicatesOnly ? 'Afficher tout' : 'Voir les doublons' }
            </button>
        {/if}

        {#if $allBrokenCount > 0}
            <button
                on:click={deleteAllBrokenSymlinks}
                class="btn btn-red-deep animate-pulse-strong"
                disabled={$bulkDeleting}
            >
                {#if $bulkDeleting}
                    <Loader2 class="w-4 h-4 animate-spin text-white" /> Suppression...
                {:else if $bulkDeleteSuccess}
                    <CheckCircle2 class="w-4 h-4 text-white" /> Supprimés !
                {:else}
                    <Trash class="w-4 h-4" /> Réparer {$allBrokenCount} symlink{s($allBrokenCount)} cassé{s($allBrokenCount)}
                {/if}
            </button>
        {/if}
    </div>

    <!-- 🔺 Boutons à droite -->
    <div class="hidden md:flex flex-wrap gap-2 justify-end">
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
        <button on:click={() => goto('/settings/symlinks/setup')} class="btn btn-gray">
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

{#if $showLatest}
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
        10 Derniers symlinks ajoutés
      </span>
    </div>

    <div class="space-y-4">
      {#each $latestSymlinks as item}
        <div
          role="button"
          tabindex="0"
          class="cursor-pointer relative p-5 rounded-2xl bg-white dark:bg-gray-800 
                 border border-gray-200 dark:border-gray-700
                 shadow-md hover:shadow-lg transition-transform duration-200 hover:-translate-y-0.5"
          on:click={() => openPopup(item)}
          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openPopup(item)}
        >
          <!-- Header -->
          <p class="text-sm font-bold font-mono text-gray-900 dark:text-gray-50 break-all">
            {item.symlink}
          </p>
          <p class="mt-1 text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
            ↳ {item.target}
          </p>

          <!-- Footer -->
          <div class="mt-3 flex flex-wrap gap-3 items-center justify-between">
            <div class="flex flex-wrap gap-3 items-center">
              <span
                class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-xs
                       {item.ref_count === 0
                         ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300 border border-red-300 dark:border-red-600'
                         : 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300 border border-green-300 dark:border-green-600'}"
              >
                {item.ref_count === 0 ? '⚠' : '✔'} Ref Count: {item.ref_count}
              </span>

              {#if item.type && ['radarr', 'sonarr'].includes(item.type.toLowerCase())}
                <button
                  on:click|stopPropagation={() => openArr(item)}
                  class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-xs
                         bg-emerald-100 text-emerald-700 
                         dark:bg-emerald-800 dark:text-emerald-300 
                         border border-emerald-300 dark:border-emerald-600
                         hover:scale-105 transition-transform"
                >
                  📦 {item.type.toLowerCase()}
                </button>
              {/if}
            </div>

            {#if item.ref_count === 0 || item.target_exists === false}
           <!-- Réparer -->
            <button
              on:click|stopPropagation={() => deleteSymlink(item)}
              class="flex items-center gap-2 px-3 py-1.5 rounded-xl shadow 
                     bg-gradient-to-r from-slate-500 via-indigo-500 to-gray-600 
                     text-white font-semibold text-sm tracking-wide
                     hover:scale-105 hover:shadow-lg transition-all duration-300"
              disabled={$deleting[item.symlink]}
              aria-label="Réparer"
              title="Réparer"
            >
              {#if $deleting[item.symlink]}
                <Loader2 class="w-4 h-4 animate-spin text-white" />
                <span>Réparation...</span>
              {:else if $deleteSuccess[item.symlink]}
                <CheckCircle2 class="w-4 h-4 text-white" />
                <span>Réparé !</span>
              {:else}
                <span>🛠️</span>
                <span>Réparer</span>
              {/if}
            </button>
          {:else}
            <!-- Supprimer -->
            <button
              on:click|stopPropagation={() => deleteSymlink(item)}
              class="p-1.5 rounded-full border border-red-400 text-red-500
                     hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              disabled={$deleting[item.symlink]}
              aria-label="Supprimer"
              title="Supprimer"
            >
              {#if $deleting[item.symlink]}
                <Loader2 class="w-4 h-4 animate-spin" />
              {:else if $deleteSuccess[item.symlink]}
                <CheckCircle2 class="w-4 h-4 text-green-500" />
              {:else}
                <Trash2 class="w-4 h-4" />
              {/if}
            </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <!-- Tableau principal avec pagination -->
  <!-- Pagination TOP -->
  <Pagination
    page={$currentPage}
    totalItems={$totalItems}
    pageSize={$rowsPerPage}
    on:changePage={(e) => goToPage(e.detail)}
  />

  <div class="space-y-4 mt-6">
    {#each $symlinks as item}
      <div
        role="button"
        tabindex="0"
        class="cursor-pointer relative p-5 rounded-2xl bg-white dark:bg-gray-800 
               border border-gray-200 dark:border-gray-700
               shadow-md hover:shadow-lg transition-transform duration-200 hover:-translate-y-0.5"
        on:click={() => openPopup(item)}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openPopup(item)}
      >
        <!-- Header -->
        <p class="text-sm font-bold font-mono text-gray-900 dark:text-gray-50 break-all">
          {item.symlink}
        </p>
        <p class="mt-1 text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
          ↳ {item.target}
        </p>

        <!-- Footer -->
        <div class="mt-3 flex flex-wrap gap-3 items-center justify-between">
          <div class="flex flex-wrap gap-3 items-center">
            <span
              class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-xs
                     {item.ref_count === 0
                       ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300 border border-red-300 dark:border-red-600'
                       : 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300 border border-green-300 dark:border-green-600'}"
            >
              {item.ref_count === 0 ? '⚠' : '✔'} Ref Count: {item.ref_count}
            </span>

            {#if item.type && ['radarr', 'sonarr'].includes(item.type.toLowerCase())}
              <button
                on:click|stopPropagation={() => openArr(item)}
                class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-xs
                       bg-emerald-100 text-emerald-700 
                       dark:bg-emerald-800 dark:text-emerald-300 
                       border border-emerald-300 dark:border-emerald-600
                       hover:scale-105 transition-transform"
              >
                📦 {item.type.toLowerCase()}
              </button>
            {/if}
          </div>

          {#if item.ref_count === 0 || item.target_exists === false}
            <!-- Réparer -->
            <button
              on:click|stopPropagation={() => deleteSymlink(item)}
              class="flex items-center gap-2 px-3 py-1.5 rounded-xl shadow 
                     bg-gradient-to-r from-slate-500 via-indigo-500 to-gray-600 
                     text-white font-semibold text-sm tracking-wide
                     hover:scale-105 hover:shadow-lg transition-all duration-300"
              disabled={$deleting[item.symlink]}
              aria-label="Réparer"
              title="Réparer"
            >
              {#if $deleting[item.symlink]}
                <Loader2 class="w-4 h-4 animate-spin text-white" />
                <span>Réparation...</span>
              {:else if $deleteSuccess[item.symlink]}
                <CheckCircle2 class="w-4 h-4 text-white" />
                <span>Réparé !</span>
              {:else}
                <span>🛠️</span>
                <span>Réparer</span>
              {/if}
            </button>
          {:else}
            <!-- Supprimer -->
            <button
              on:click|stopPropagation={() => deleteSymlink(item)}
              class="p-1.5 rounded-full border border-red-400 text-red-500
                     hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              disabled={$deleting[item.symlink]}
              aria-label="Supprimer"
              title="Supprimer"
            >
              {#if $deleting[item.symlink]}
                <Loader2 class="w-4 h-4 animate-spin" />
              {:else if $deleteSuccess[item.symlink]}
                <CheckCircle2 class="w-4 h-4 text-green-500" />
              {:else}
                <Trash2 class="w-4 h-4" />
              {/if}
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Pagination BOTTOM -->
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

    .btn-yellow-deep {
        @apply bg-yellow-500 hover:bg-yellow-600 text-white focus-visible:ring-yellow-300;
    }

    .animate-pulse-strong {
        animation: pulseStrong 1.5s infinite;
    }

    @keyframes pulseStrong {
        0%, 100% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.05);
            opacity: 0.85;
        }
    }
</style>
