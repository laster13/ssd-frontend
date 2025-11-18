import { writable } from "svelte/store";

const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";

/* -----------------------------
   LABELS CATÉGORIES
------------------------------ */
export const statLabels = {
    total: {
        label: "Total analysés",
        desc: "Nombre total de fichiers vidéo scannés.",
        icon: "📊",
        color: "text-gray-800",
        bgGradient: "from-slate-400/10 via-slate-200/5 to-transparent",
        border: "border-slate-400/30"
    },
    deja_conforme: {
        label: "Déjà conformes",
        desc: "Films déjà conformes au format Plex.",
        icon: "✅",
        color: "text-emerald-400",
        bgGradient: "from-emerald-400/10 via-green-300/10 to-transparent",
        border: "border-emerald-500/40"
    },
    non_conforme_plex: {
        label: "Non conformes Plex",
        desc: "Structure ou date incorrecte pour Plex.",
        icon: "🎞️",
        color: "text-blue-400",
        bgGradient: "from-blue-500/10 via-sky-400/10 to-transparent",
        border: "border-blue-500/40"
    },
    imdb_manquant_ou_invalide: {
        label: "IMDb manquant ou invalide",
        desc: "Aucun identifiant IMDb/TMDb valide trouvé.",
        icon: "🎬",
        color: "text-yellow-500",
        bgGradient: "from-yellow-500/10 via-amber-400/10 to-transparent",
        border: "border-yellow-500/40"
    },
    inconnu_dans_radarr: {
        label: "Inconnus dans Radarr",
        desc: "ID trouvé mais absent dans Radarr.",
        icon: "❌",
        color: "text-rose-400",
        bgGradient: "from-rose-500/10 via-pink-400/10 to-transparent",
        border: "border-rose-500/40"
    }
};

/* -----------------------------
   STORES PRINCIPAUX
------------------------------ */
export const loadingScanOnly = writable(false);
export const loadingScanFull = writable(false);

export const stats = writable<any>(null);
export const details = writable<Record<string, any[]>>({});
export const elapsed = writable(0);

export const selectedCategory = writable<string | null>(null);
export const page = writable(1);
export const perPage = 100;

export const itemAction = writable<Record<string, string>>({});

/* -----------------------------
   POST WRAPPER
------------------------------ */
async function post(url: string, body: any = {}) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Erreur API POST");
    return data;
}

/* -----------------------------
   UPDATE LOCAL (après action manuelle)
------------------------------ */
function updateLocalRename(oldPath: string, apiReturn: any) {
    const newFullPath =
        apiReturn?.fichier_nouveau ||
        apiReturn?.path_final ||
        apiReturn?.nouveau ||
        oldPath;

    const message = apiReturn?.message || "Modifié localement";

    details.update((d) => {
        for (const cat in d) {
            const idx = d[cat]?.findIndex((i) => i.original === oldPath);
            if (idx !== -1) {
                d[cat][idx].original = newFullPath;
                d[cat][idx].status = "deja_conforme";
                d[cat][idx].raison = message;
            }
        }
        return d;
    });

    stats.update((s) => {
        if (!s) return s;
        s.deja_conforme++;
        return s;
    });
}

/* -----------------------------
   API : SCAN FULL
------------------------------ */
export async function runScan(dryRun = false) {
    loadingScanFull.set(true);

    try {
        const r = await fetch(
            `${API_BASE}/rename/scan?dry_run=${dryRun}`,
            { method: "POST" }
        );

        const data = await r.json();

        stats.set(data.statistiques ?? {});
        details.set(data.details ?? {});
        elapsed.set(data.elapsed ?? 0);

        page.set(1);
        selectedCategory.set(null);

        // 👇 Ajout : lancer un rescan-only automatiquement
        await runScanOnly();

    } catch (err) {
        console.error("Erreur scan :", err);
    } finally {
        loadingScanFull.set(false);
    }
}

/* -----------------------------
   API : SCAN ONLY
------------------------------ */
export async function runScanOnly() {
    loadingScanOnly.set(true);

    try {
        const r = await fetch(`${API_BASE}/rename/scan_only`, {
            method: "POST"
        });

        const data = await r.json();

        stats.set(data.statistiques ?? {});
        details.set(data.details ?? {});
        elapsed.set(data.elapsed ?? 0);

        page.set(1);
        selectedCategory.set(null);

    } finally {
        loadingScanOnly.set(false);
    }
}

/* -----------------------------
   ACTIONS MANUELLES
------------------------------ */
export async function renameItem(oldPath: string, newFolder: string, newFile: string, dryRun = false) {
    itemAction.update((a) => ({ ...a, [oldPath]: "rename" }));
    try {
        const data = await post(`${API_BASE}/rename/edit`, {
            old_path: oldPath,
            new_folder: newFolder,
            new_file: newFile,
            dry_run: dryRun
        });
        updateLocalRename(oldPath, data);
    } finally {
        itemAction.update((a) => ({ ...a, [oldPath]: null }));
    }
}

export async function fixIMDB(path: string, dryRun = false) {
    itemAction.update((a) => ({ ...a, [path]: "imdb" }));
    try {
        const data = await post(`${API_BASE}/rename/fix/imdb_one`, {
            path,
            dry_run: dryRun
        });
        updateLocalRename(path, data);
    } finally {
        itemAction.update((a) => ({ ...a, [path]: null }));
    }
}

export async function deleteFromRadarr(path: string, dryRun = false) {
    itemAction.update((a) => ({ ...a, [path]: "delete" }));
    try {
        const data = await post(`${API_BASE}/rename/sync_radarr`, {
            path,
            dry_run: dryRun
        });

        const message = data?.message || "Retiré de Radarr";

        details.update((d) => {
            for (const cat in d) {
                const idx = d[cat]?.findIndex((i) => i.original === path);
                if (idx !== -1) {
                    d[cat][idx].status = "hors_radarr";
                    d[cat][idx].raison = message;
                }
            }
            return d;
        });

    } finally {
        itemAction.update((a) => ({ ...a, [path]: null }));
    }
}

export async function reimportRadarr(path: string, dryRun = false) {
    itemAction.update((a) => ({ ...a, [path]: "import" }));
    try {
        const data = await post(`${API_BASE}/rename/reimport_radarr`, {
            path,
            dry_run: dryRun
        });

        const message = data?.message || "Réimport effectué";

        const wrapper = {
            message,
            fichier_nouveau: data?.path_final,
            path_final: data?.path_final,
            nouveau: data?.path_final
        };

        updateLocalRename(path, wrapper);

    } finally {
        itemAction.update((a) => ({ ...a, [path]: null }));
    }
}

/* -----------------------------
   CATÉGORIE & PAGINATION
------------------------------ */
export function setCategory(cat: string) {
    selectedCategory.set(cat);
    page.set(1);
}

export function loadMore() {
    page.update((p) => p + 1);
}
