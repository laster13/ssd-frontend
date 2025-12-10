import { writable } from "svelte/store";

const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";

/* -----------------------------
   LABELS CATÉGORIES (SÉRIES)
------------------------------ */
export const statLabels = {
    total: {
        label: "Total analysés",
        desc: "Nombre total de dossiers de séries scannés.",
        icon: "📊",
        color: "text-gray-800",
        bgGradient: "from-slate-400/10 via-slate-200/5 to-transparent",
        border: "border-slate-400/30"
    },
    deja_conforme: {
        label: "Déjà conformes",
        desc: "Dossiers déjà conformes au format Plex.",
        icon: "✅",
        color: "text-emerald-400",
        bgGradient: "from-emerald-400/10 via-green-300/10 to-transparent",
        border: "border-emerald-500/40"
    },
    non_conforme_plex: {
        label: "Non conformes Plex",
        desc: "Structure incorrecte pour Plex.",
        icon: "🎞️",
        color: "text-blue-400",
        bgGradient: "from-blue-500/10 via-sky-400/10 to-transparent",
        border: "border-blue-500/40"
    },
    imdb_manquant_ou_invalide: {
        label: "IMDb manquant ou invalide",
        desc: "Aucun identifiant IMDb valide trouvé.",
        icon: "🎬",
        color: "text-yellow-500",
        bgGradient: "from-yellow-500/10 via-amber-400/10 to-transparent",
        border: "border-yellow-500/40"
    },
    inconnu_dans_sonarr: {
        label: "Inconnus Sonarr",
        desc: "Série impossible à mapper → à vérifier",
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
   WRAPPER API POST
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
   SCAN ONLY (ANALYSE SANS RENOMMER)
------------------------------ */
export async function runScanOnly() {
    loadingScanOnly.set(true);

    try {
        const r = await fetch(`${API_BASE}/series/scan`, { method: "POST" });
        const data = await r.json();

        stats.set(data.statistiques ?? {});
        details.set(data.details ?? {});
        elapsed.set(data.elapsed ?? 0);

        page.set(1);
        selectedCategory.set(null);

    } catch (err) {
        console.error("Erreur scan séries :", err);
    } finally {
        loadingScanOnly.set(false);
    }
}

/* -----------------------------
   SCAN COMPLET (RENOMMAGE GLOBAL)
------------------------------ */
export async function runScanFull(dryRun = false) {
    // dryRun = false  → apply = true
    const apply = !dryRun;

    loadingScanFull.set(true);

    try {
        const r = await fetch(
            `${API_BASE}/series/rename-series?apply=${apply ? "true" : "false"}`,
            { method: "POST" }
        );
        const data = await r.json();

        if (!r.ok) {
            throw new Error(data.detail || "Erreur API /series/rename-series");
        }

        // Tu peux logger ou plus tard mettre à jour les stats si tu veux
        console.log("Résultat rename-series :", data);

        return data;
    } catch (err) {
        console.error("Erreur runScanFull séries :", err);
        throw err;
    } finally {
        loadingScanFull.set(false);
    }
}

/* -----------------------------
   SÉLECTION / PAGINATION
------------------------------ */
export function setCategory(cat: string) {
    selectedCategory.set(cat);
    page.set(1);
}

export function loadMore() {
    page.update((p) => p + 1);
}

/* -----------------------------
   RENAME SERIES (ÉDITION UNE PAR UNE)
------------------------------ */
export async function renameSeries(
    oldPath: string,
    newFolder: string,
    dryRun = false
) {
    try {
        const res = await fetch(`${API_BASE}/series/edit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                old_path: oldPath,
                new_folder: newFolder,
                dry_run: dryRun
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Erreur API series/edit");
        }

        // Mettre à jour l'UI
        details.update((current) => {
            const copy: Record<string, any[]> = { ...current };

            for (const key of Object.keys(copy)) {
                copy[key] = copy[key].map((it: any) => {
                    const orig = it.original || it.folder || it.path;
                    if (orig === oldPath) {
                        const parts = String(data.nouveau ?? newFolder).split("/");
                        const newFolderName =
                            parts.at(-1) || data.nouveau || newFolder;

                        return {
                            ...it,
                            original: newFolderName,
                            folder: newFolderName,
                            raison: data.message || it.raison
                        };
                    }
                    return it;
                });
            }

            return copy;
        });

        return data;
    } catch (err) {
        console.error("Erreur renameSeries :", err);
        throw err;
    }
}

/* -----------------------------
   FIX IMDb POUR UNE SÉRIE
------------------------------ */
export async function fixSeriesIMDB(path: string, dryRun = false) {
    try {
        const res = await fetch(`${API_BASE}/series/imdb-one`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, dry_run: dryRun })
        });

        const text = await res.text();
        let data: any = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch (e) {
            console.error("Réponse NON-JSON de /series/imdb-one :", text);
            throw new Error(
                `Réponse non JSON de l'API (status ${res.status})`
            );
        }

        if (!res.ok) {
            throw new Error(
                data?.detail || `Erreur API series/imdb-one (${res.status})`
            );
        }

        // Mettre à jour l'UI
        details.update((current) => {
            const copy: Record<string, any[]> = { ...current };

            for (const key of Object.keys(copy)) {
                copy[key] = copy[key].map((it: any) => {
                    const orig = it.original || it.folder || it.path;
                    if (orig === path) {
                        const updated: any = { ...it };

                        if (data?.message) {
                            updated.raison = data.message;
                        }

                        if (!dryRun && data?.nouveau) {
                            const parts = String(data.nouveau).split("/");
                            const newFolderName =
                                parts.at(-1) || data.nouveau;
                            updated.original = newFolderName;
                            updated.folder = newFolderName;
                        }

                        return updated;
                    }
                    return it;
                });
            }

            return copy;
        });

        return data;
    } catch (err) {
        console.error("Erreur fixSeriesIMDB :", err);
        throw err;
    }
}

/* -----------------------------
   SUPPRESSION DANS SONARR
------------------------------ */
export async function deleteFromSonarr(path: string, dryRun = false) {
    try {
        const res = await fetch(`${API_BASE}/series/sync_sonarr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, dry_run: dryRun })
        });

        const text = await res.text();
        let data: any = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch (e) {
            console.error("Réponse NON-JSON de /series/sync_sonarr :", text);
            throw new Error(
                `Réponse non JSON de l'API Sonarr (status ${res.status})`
            );
        }

        if (!res.ok) {
            throw new Error(
                data?.detail ||
                    `Erreur API /series/sync_sonarr (${res.status})`
            );
        }

        if (data?.message) {
            details.update((current) => {
                const copy: Record<string, any[]> = { ...current };

                for (const key of Object.keys(copy)) {
                    copy[key] = copy[key].map((it: any) => {
                        const orig = it.original || it.folder || it.path;
                        if (orig === path) {
                            return {
                                ...it,
                                raison: data.message
                            };
                        }
                        return it;
                    });
                }

                return copy;
            });
        }

        return data;
    } catch (err) {
        console.error("Erreur deleteFromSonarr :", err);
        throw err;
    }
}

/* -----------------------------
   RÉIMPORT DANS SONARR
------------------------------ */
export async function reimportSonarr(path: string, dryRun = false) {
    try {
        const res = await fetch(`${API_BASE}/series/reimport_sonarr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, dry_run: dryRun })
        });

        const text = await res.text();
        let data: any = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch (e) {
            console.error(
                "Réponse NON-JSON de /series/reimport_sonarr :",
                text
            );
            throw new Error(
                `Réponse non JSON de l'API reimport Sonarr (status ${res.status})`
            );
        }

        if (!res.ok) {
            throw new Error(
                data?.detail ||
                    `Erreur API /series/reimport_sonarr (${res.status})`
            );
        }

        if (data?.message) {
            details.update((current) => {
                const copy: Record<string, any[]> = { ...current };

                for (const key of Object.keys(copy)) {
                    copy[key] = copy[key].map((it: any) => {
                        const orig = it.original || it.folder || it.path;
                        if (orig === path) {
                            return {
                                ...it,
                                raison: data.message
                            };
                        }
                        return it;
                    });
                }

                return copy;
            });
        }

        return data;
    } catch (err) {
        console.error("Erreur reimportSonarr :", err);
        throw err;
    }
}
