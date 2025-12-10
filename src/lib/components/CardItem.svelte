<script lang="ts">
    import {
        Info,
        FolderOpen,
        Edit3,
        Save,
        X,
        Trash2,
        RefreshCw,
        Search,
        Loader2
    } from "lucide-svelte";

    // Animation fade + slide
    function fadeSlide(node, { duration = 250 } = {}) {
        return {
            duration,
            css: t => `
                opacity: ${t};
                transform: translateY(${(1 - t) * 12}px);
            `
        };
    }

    export let item: any;
    export let category: string;
    export let labels: any;
    export let mode: "movies" | "series";
    export let actions: any;

    let editing = false;
    let expanded = false;

    let editedFolder = "";
    let editedFile = "";
    let previewPath = "";

    let loadingContent = false;
    let seriesContent: any = null;

    // saisons ouvertes : clé = numéro de saison
    let openSeasons: Record<number, boolean> = {};

    // loading des boutons d'action (droite)
    let loadingFix = false;
    let loadingDelete = false;
    let loadingReimport = false;

    const API_BASE =
        import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";

    // Valeur d'origine (folder / path)
    const originalSafe =
        item?.original || item?.folder || item?.path || "unknown";
    item.original = originalSafe;

    // Extraction réactive dossier/fichier
    $: split = (item.original || "").split("/");
    $: folderName = split.at(-2) || item.original || "";
    $: fileName = split.at(-1) || "";

    function startEdit() {
        editing = true;

        editedFolder = folderName;

        if (mode === "movies") {
            editedFile = fileName.replace(/\.[^.]+$/, "");
        }

        updatePreview();
    }

    function updatePreview() {
        const base = split.slice(0, -2).join("/");

        previewPath =
            mode === "movies"
                ? `${base}/${editedFolder}/${editedFile}.mkv`
                : `${base}/${editedFolder}`;
    }

    async function save() {
        try {
            if (mode === "movies") {
                // films → renameItem(old_path, new_folder, new_file)
                const res = await actions.rename(
                    item.original,
                    editedFolder,
                    editedFile
                );

                if (res?.nouveau) {
                    item.original = res.nouveau;
                } else {
                    const base = split.slice(0, -2).join("/");
                    item.original = `${base}/${editedFolder}/${editedFile}.mkv`;
                }
            } else {
                // séries → renameSeries(old_path, new_folder, dryRun = false)
                const res = await actions.rename(
                    item.original,
                    editedFolder,
                    false
                );

                if (res?.nouveau) {
                    const parts = String(res.nouveau).split("/");
                    const newFolderName = parts.at(-1) || editedFolder;

                    item.original = newFolderName;
                    item.folder = newFolderName;
                } else {
                    item.original = editedFolder;
                    item.folder = editedFolder;
                }
            }
        } catch (e) {
            console.error("Erreur save :", e);
        } finally {
            editing = false;
        }
    }

    async function loadSeriesContent() {
        if (seriesContent || loadingContent) return;

        loadingContent = true;

        try {
            const res = await fetch(
                `${API_BASE}/series/content?path=${encodeURIComponent(folderName)}`
            );

            if (!res.ok) throw new Error("Erreur API");

            seriesContent = await res.json();
            openSeasons = {}; // reset des saisons ouvertes
        } catch (e) {
            console.error("Erreur contenu série :", e);
        } finally {
            loadingContent = false;
        }
    }

    async function toggleExpand() {
        if (mode !== "series") return;

        expanded = !expanded;

        if (expanded) await loadSeriesContent();
    }

    function toggleSeason(seasonNumber: number) {
        openSeasons = {
            ...openSeasons,
            [seasonNumber]: !openSeasons[seasonNumber]
        };
    }

    // ----------- HANDLERS AVEC SPINNERS -------------

    async function handleFixClick() {
        if (!actions?.fix) return;
        loadingFix = true;
        try {
            await actions.fix(item.original);
        } catch (e) {
            console.error("Erreur fix IMDb :", e);
        } finally {
            loadingFix = false;
        }
    }

    async function handleDeleteClick() {
        if (!actions?.delete) return;
        loadingDelete = true;
        try {
            await actions.delete(item.original);
        } catch (e) {
            console.error("Erreur delete :", e);
        } finally {
            loadingDelete = false;
        }
    }

    async function handleReimportClick() {
        if (!actions?.reimport) return;
        loadingReimport = true;
        try {
            await actions.reimport(item.original);
        } catch (e) {
            console.error("Erreur reimport :", e);
        } finally {
            loadingReimport = false;
        }
    }
</script>

<div
    role="button"
    tabindex="0"
    on:click={toggleExpand}
    on:keydown={(event) => {
        // Ne déclenche que quand le focus est sur le conteneur
        if (event.target !== event.currentTarget) return;

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleExpand();
        }
    }}
    class={`relative rounded-xl border-l-4 ${labels[category].border}
        bg-gradient-to-r ${labels[category].bgGradient}
        shadow-md p-5 cursor-pointer`}
>
    <!-- Layout global : texte + boutons -->
    <div
        class="flex flex-col gap-3
               sm:flex-row sm:items-start sm:justify-between sm:gap-4"
    >
        <!-- LEFT SIDE -->
        <div class="flex flex-col gap-2 w-full">
            <!-- Ligne icône + titre / édition (desktop) -->
            <div class="flex items-start gap-2">
                <FolderOpen class="w-5 h-5 text-muted-foreground mt-0.5" />

                <div class="flex-1">
                    {#if editing}
                        <!-- Bloc édition DESKTOP uniquement -->
                        <div class="hidden sm:flex flex-col sm:flex-row gap-2 w-full">
                            <div class="flex flex-col flex-1">
                                <label class="text-xs mb-1" for="folder-input-desktop">
                                    📁 Dossier
                                </label>
                                <input
                                    id="folder-input-desktop"
                                    class="px-2 py-1 text-sm border rounded-md"
                                    bind:value={editedFolder}
                                    on:input={updatePreview}
                                />
                            </div>

                            {#if mode === "movies"}
                                <div class="flex flex-col flex-1">
                                    <label class="text-xs mb-1" for="file-input-desktop">
                                        🎞️ Fichier
                                    </label>
                                    <input
                                        id="file-input-desktop"
                                        class="px-2 py-1 text-sm border rounded-md"
                                        bind:value={editedFile}
                                        on:input={updatePreview}
                                    />
                                </div>
                            {/if}
                        </div>

                        <!-- Sur desktop, on n'affiche pas le titre pendant l'édition -->
                        <h4 class="font-semibold text-sm sm:text-base sm:hidden">
                            {mode === "series"
                                ? folderName
                                : `${folderName}/${fileName}`}
                        </h4>
                    {:else}
                        <!-- MODE NORMAL -->
                        <h4 class="font-semibold text-sm sm:text-base">
                            {mode === "series"
                                ? folderName
                                : `${folderName}/${fileName}`}
                        </h4>
                    {/if}
                </div>
            </div>

            <!-- FULL PATH -->
            <div class="text-xs text-muted-foreground font-mono break-all">
                {item.original}
            </div>

            <!-- REASON -->
            {#if item.raison}
                <div class="flex items-center gap-1 text-xs italic text-muted-foreground">
                    <Info class="w-3 h-3" /> {item.raison}
                </div>
            {/if}

            <!-- Bloc édition MOBILE uniquement (sous le texte, au-dessus des boutons) -->
            {#if editing}
                <div class="mt-1 flex flex-col gap-2 w-full sm:hidden">
                    <div class="flex flex-col">
                        <label class="text-xs mb-1" for="folder-input-mobile">
                            📁 Dossier
                        </label>
                        <input
                            id="folder-input-mobile"
                            class="px-2 py-1 text-sm border rounded-md"
                            bind:value={editedFolder}
                            on:input={updatePreview}
                        />
                    </div>

                    {#if mode === "movies"}
                        <div class="flex flex-col">
                            <label class="text-xs mb-1" for="file-input-mobile">
                                🎞️ Fichier
                            </label>
                            <input
                                id="file-input-mobile"
                                class="px-2 py-1 text-sm border rounded-md"
                                bind:value={editedFile}
                                on:input={updatePreview}
                            />
                        </div>
                    {/if}

                    {#if previewPath}
                        <div class="text-xs text-muted-foreground italic mt-1">
                            ➡️ Nouveau chemin : {previewPath}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- ACTION BUTTONS (en dessous sur mobile, à droite en desktop) -->
        <div
            class="flex gap-2 items-start
                   w-full sm:w-auto
                   sm:justify-end"
        >
            {#if editing}
                <button
                    class="text-emerald-400 hover:text-emerald-600"
                    on:click|stopPropagation={save}
                    type="button"
                >
                    <Save class="w-4 h-4" />
                </button>

                <button
                    class="text-gray-400 hover:text-gray-600"
                    on:click|stopPropagation={() => (editing = false)}
                    type="button"
                >
                    <X class="w-4 h-4" />
                </button>
            {:else}
                <!-- FIX IMDb -->
                <button
                    class="text-yellow-500 hover:text-yellow-600 disabled:opacity-60"
                    on:click|stopPropagation={handleFixClick}
                    disabled={loadingFix}
                    type="button"
                >
                    {#if loadingFix}
                        <Loader2 class="w-4 h-4 animate-spin" />
                    {:else}
                        <Search class="w-4 h-4" />
                    {/if}
                </button>

                <!-- EDIT -->
                <button
                    class="text-pink-400 hover:text-pink-600"
                    on:click|stopPropagation={startEdit}
                    type="button"
                >
                    <Edit3 class="w-4 h-4" />
                </button>

                {#if mode === "movies"}
                    <!-- DELETE -->
                    <button
                        class="text-rose-400 hover:text-rose-600 disabled:opacity-60"
                        on:click|stopPropagation={handleDeleteClick}
                        disabled={loadingDelete}
                        type="button"
                    >
                        {#if loadingDelete}
                            <Loader2 class="w-4 h-4 animate-spin" />
                        {:else}
                            <Trash2 class="w-4 h-4" />
                        {/if}
                    </button>

                    <!-- REIMPORT -->
                    <button
                        class="text-blue-400 hover:text-blue-600 disabled:opacity-60"
                        on:click|stopPropagation={handleReimportClick}
                        disabled={loadingReimport}
                        type="button"
                    >
                        {#if loadingReimport}
                            <Loader2 class="w-4 h-4 animate-spin" />
                        {:else}
                            <RefreshCw class="w-4 h-4" />
                        {/if}
                    </button>
                {:else}
                    <!-- Séries : mêmes boutons / UX -->
                    <button
                        class="text-rose-400/60 hover:text-rose-600 disabled:opacity-60"
                        on:click|stopPropagation={handleDeleteClick}
                        disabled={loadingDelete}
                        type="button"
                    >
                        {#if loadingDelete}
                            <Loader2 class="w-4 h-4 animate-spin" />
                        {:else}
                            <Trash2 class="w-4 h-4" />
                        {/if}
                    </button>

                    <button
                        class="text-blue-400/60 hover:text-blue-600 disabled:opacity-60"
                        on:click|stopPropagation={handleReimportClick}
                        disabled={loadingReimport}
                        type="button"
                    >
                        {#if loadingReimport}
                            <Loader2 class="w-4 h-4 animate-spin" />
                        {:else}
                            <RefreshCw class="w-4 h-4" />
                        {/if}
                    </button>
                {/if}
            {/if}
        </div>
    </div>

    <!-- SERIES EXPANDED CONTENT ULTRA PREMIUM -->
    {#if mode === "series" && expanded}
        <div
            transition:fadeSlide
            class="mt-4 rounded-3xl border border-white/10
                bg-gradient-to-br from-white/10 via-white/0 to-white/5
                dark:from-white/5 dark:via-black/40 dark:to-black/70
                backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)]
                p-5 md:p-6"
        >
            {#if loadingContent}
                <p class="text-sm italic text-gray-500">Chargement…</p>
            {:else if seriesContent}
                <div class="flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 md:gap-7">
                    <!-- COLONNE GAUCHE : MÉTA SÉRIE -->
                    <div class="flex flex-col gap-4">
                        <div class="flex items-start gap-3">
                            {#if item.poster}
                                <img
                                    src={item.poster}
                                    alt={seriesContent.clean_name}
                                    class="h-16 w-12 md:h-20 md:w-16 rounded-2xl
                                           border border-white/15 shadow-inner object-cover flex-shrink-0"
                                    loading="lazy"
                                />
                            {/if}

                            <div class="space-y-1">
                                <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    📂 {seriesContent.clean_name}
                                </h3>

                                <div class="flex flex-wrap gap-1.5 text-[11px]">
                                    <span
                                        class="px-2 py-0.5 rounded-full
                                            bg-white/10 dark:bg-white/5
                                            border border-white/20
                                            text-[11px] tracking-tight"
                                    >
                                        {seriesContent.seasons.length}
                                        saison{seriesContent.seasons.length > 1 ? "s" : ""}
                                    </span>

                                    <span
                                        class="px-2 py-0.5 rounded-full
                                            bg-white/10 dark:bg-white/5
                                            border border-white/20
                                            text-[11px]"
                                    >
                                        {seriesContent.seasons.reduce(
                                            (acc, s) => acc + (s.episodes?.length || 0),
                                            0
                                        )} épisodes
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p class="hidden md:block text-xs text-muted-foreground/80 leading-relaxed">
                            Organisation détaillée des saisons et épisodes détectés sur le disque.
                        </p>
                    </div>

                    <!-- COLONNE DROITE : SAISONS + ÉPISODES -->
                    <div class="space-y-3.5">
                        {#each seriesContent.seasons as season}
                            <div
                                class="rounded-2xl border border-white/10
                                    bg-white/5 dark:bg-black/40
                                    shadow-inner overflow-hidden
                                    hover:border-white/30 hover:-translate-y-[1px]
                                    transition-all duration-200"
                            >
                                <!-- HEADER SAISON -->
                                <button
                                    type="button"
                                    class="w-full flex items-center justify-between
                                        px-3.5 py-2.5 md:px-4 md:py-3 text-left
                                        hover:bg-white/5 focus:outline-none
                                        focus:ring-1 focus:ring-white/30"
                                    on:click|stopPropagation={() => toggleSeason(season.season)}
                                >
                                    <div class="flex flex-col gap-0.5">
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="text-[11px] font-mono px-1.5 py-0.5 rounded-full
                                                    border border-white/20 bg-black/10
                                                    text-gray-100"
                                            >
                                                S{String(season.season).padStart(2, "0")}
                                            </span>

                                            <span class="text-sm font-semibold">
                                                Saison {season.season}
                                            </span>
                                        </div>

                                        <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <span>
                                                {season.episodes.length}
                                                épisode{season.episodes.length > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>

                                    <div class="flex flex-col items-end gap-1">
                                        <span class="text-[11px] text-muted-foreground">
                                            {openSeasons[season.season]
                                                ? "Masquer les épisodes"
                                                : "Afficher les épisodes"}
                                        </span>

                                        <span
                                            class={`inline-flex h-5 w-5 items-center justify-center
                                                rounded-full border border-white/25 text-[10px]
                                                transition-transform duration-200
                                                ${openSeasons[season.season] ? "rotate-90" : ""}`}
                                        >
                                            ▶
                                        </span>
                                    </div>
                                </button>

                                <!-- EPISODES -->
                                {#if openSeasons[season.season]}
                                    <div
                                        transition:fadeSlide
                                        class="border-t border-white/10
                                            px-3.5 py-2.5 md:px-4 md:py-3
                                            bg-white/5/50 dark:bg-black/40/60
                                            space-y-1.5"
                                    >
                                        <ul class="space-y-1">
                                            {#each season.episodes as ep, idx}
                                                <li
                                                    class="flex items-center justify-between
                                                        rounded-xl px-2 py-1
                                                        text-xs
                                                        hover:bg-white/10
                                                        transition-colors"
                                                >
                                                    <div class="flex items-center gap-2 min-w-0">
                                                        <span
                                                            class="font-mono text-[11px] opacity-70
                                                                px-1 py-0.5 rounded-md
                                                                bg-black/20"
                                                        >
                                                            E{String(idx + 1).padStart(2, "0")}
                                                        </span>

                                                        <span class="truncate">
                                                            {ep.name}
                                                        </span>
                                                    </div>

                                                    <span class="ml-3 whitespace-nowrap opacity-60">
                                                        {Math.round(ep.size / 1024 / 1024)} MB
                                                    </span>
                                                </li>
                                            {/each}
                                        </ul>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <p class="text-sm italic text-gray-400">Aucun contenu trouvé.</p>
            {/if}
        </div>
    {/if}
</div>
