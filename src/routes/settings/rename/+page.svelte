<script lang="ts">
    import {
        renameItem,
        fixIMDB,
        deleteFromRadarr,
        reimportRadarr,
        runScanOnly as runScanMovies,
        runScan as runScanMoviesFull,
        stats as movieStats,
        details as movieDetails,
        selectedCategory as movieCategory,
        page as moviePage,
        statLabels as movieLabels,
        loadingScanOnly as movieLoadingOnly,
        loadingScanFull as movieLoadingFull
    } from "$lib/stores/movies";

    /* ------------------------------------------
       COMPOSANTS
    ------------------------------------------ */
    import ScanHeader from "$lib/components/ScanHeader.svelte";
    import CategoryCard from "$lib/components/CategoryCard.svelte";
    import CardItem from "$lib/components/CardItem.svelte";

    /* ------------------------------------------
       STORES SÉRIES
    ------------------------------------------ */
    import {
        runScanOnly as runScanSeries,
        runScanFull as runScanSeriesFull,
        stats as seriesStats,
        details as seriesDetails,
        selectedCategory as seriesCategory,
        page as seriesPage,
        statLabels as seriesLabels,
        loadingScanOnly as seriesLoadingOnly,
        loadingScanFull as seriesLoadingFull,
        renameSeries,
        fixSeriesIMDB,
        deleteFromSonarr,
        reimportSonarr
    } from "$lib/stores/series";

    /* ------------------------------------------
       ÉTAT LOCAL
    ------------------------------------------ */
    let mode: "movies" | "series" = "movies";
    let dryRun = false;
    let sentinel: HTMLElement;

    /* ------------------------------------------
       RÉACTIVITÉ STORES PARTAGÉS
    ------------------------------------------ */

    $: activeStats =
        mode === "movies" ? $movieStats : $seriesStats;

    $: activeDetails =
        mode === "movies" ? $movieDetails : $seriesDetails;

    $: activeSelected =
        mode === "movies" ? $movieCategory : $seriesCategory;

    $: activePage =
        mode === "movies" ? $moviePage : $seriesPage;

    $: activeLabels =
        mode === "movies" ? movieLabels : seriesLabels;

    $: activeLoadingOnly =
        mode === "movies" ? $movieLoadingOnly : $seriesLoadingOnly;

    $: activeLoadingFull =
        mode === "movies" ? $movieLoadingFull : $seriesLoadingFull;

    /* ------------------------------------------
       LISTE PAGINÉE
    ------------------------------------------ */
    $: visible =
        activeSelected && activeDetails[activeSelected]
            ? activeDetails[activeSelected].slice(0, activePage * 100)
            : [];

    /* ------------------------------------------
       SWITCH FILMS / SÉRIES
    ------------------------------------------ */
    function switchMode(newMode: "movies" | "series") {
        if (mode === newMode) return;

        mode = newMode;

        if (mode === "movies") {
            movieCategory.set(null);
            moviePage.set(1);
            runScanMovies();
        } else {
            seriesCategory.set(null);
            seriesPage.set(1);
            runScanSeries();
        }
    }

    /* ------------------------------------------
       CALLBACKS POUR ScanHeader
    ------------------------------------------ */
    function handleScanOnly() {
        if (mode === "movies") {
            runScanMovies();
        } else {
            runScanSeries();
        }
    }

    function handleScanFull(dry: boolean) {
        if (mode === "movies") {
            runScanMoviesFull(dry);
        } else {
            runScanSeriesFull(dry);
        }
    }
</script>

<!-- HEADER -->
<ScanHeader
    {dryRun}
    {mode}
    loadingOnly={activeLoadingOnly}
    loadingFull={activeLoadingFull}
    onScanOnly={handleScanOnly}
    onScanFull={handleScanFull}
/>

<main class="mx-auto max-w-7xl px-4 pb-16">

    <!-- SWITCH -->
    <div class="flex justify-center gap-4 mt-4 mb-8">
        <button
            class="px-4 py-2 rounded-lg shadow text-sm font-semibold
                {mode === 'movies'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700'}"
            on:click={() => switchMode("movies")}
        >
            🎬 Radarr
        </button>

        <button
            class="px-4 py-2 rounded-lg shadow text-sm font-semibold
                {mode === 'series'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700'}"
            on:click={() => switchMode("series")}
        >
            📺 Sonarr
        </button>
    </div>

    <!-- INFO FORMAT -->

	<div
		class="
			w-full p-6 my-6 rounded-xl shadow-lg 
			bg-yellow-50 text-gray-800 text-sm leading-relaxed
			dark:bg-[#3a372e] dark:text-gray-200
		"
	>
		<!-- Deux colonnes -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			
			<!-- COLONNE 1 : Formats Plex -->
			<div>
				<p class="mb-3 font-semibold text-gray-900 dark:text-gray-100 text-base">
					📂 Format attendu par Plex :
				</p>

				<p class="mb-2 flex items-start gap-2">
					🎬
					<span>
						<strong>Films</strong> →
						<code
							class="font-mono px-1 py-0.5 rounded bg-yellow-100/70 dark:bg-yellow-800/50 text-gray-800 dark:text-yellow-100"
						>
							Titre (Année)/Titre (Année).mkv
						</code>
					</span>
				</p>

				<p class="mb-4 flex items-start gap-2">
					📺
					<span>
						<strong>Séries</strong> →
						<code
							class="font-mono px-1 py-0.5 rounded bg-yellow-100/70 dark:bg-yellow-800/50 text-gray-800 dark:text-yellow-100"
						>
							Nom (Année)/Season 01/Nom (Année) - S01E01.mkv
						</code>
					</span>
				</p>
			</div>

			<!-- COLONNE 2 : Symlinks IMDb -->
			<div>
				<p class="mb-3 font-semibold text-gray-900 dark:text-gray-100 text-base">
					🔗 Symlinks & identification :
				</p>

				<p class="flex items-start gap-2">
					👉
					<span>
						Pour les symlinks, ajouter un suffixe IMDb comme
						<code
							class="font-mono px-1 py-0.5 rounded bg-yellow-100/70 dark:bg-yellow-800/50 text-gray-800 dark:text-yellow-100"
						>
							{`{imdb-tt1234567}`}
						</code>
						<br />

						<span
							class="font-semibold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent"
						>
							améliore la reconnaissance
						</span>
						dans Plex, Radarr, Sonarr et toutes les APIs.
					</span>
				</p>
			</div>

		</div>

		<!-- LIGNE SÉPARATRICE -->
		<hr class="my-6 border-yellow-300/40 dark:border-yellow-700/40" />

		<!-- Bloc "Procédure recommandée" -->
		<div
			class="
				mt-6 p-4 rounded-lg border border-amber-300/40 
				bg-amber-50/70 text-gray-800 dark:bg-[#4a3f2a]/60 dark:border-amber-700/40 dark:text-gray-200
				shadow-sm
			"
		>
			<div class="flex items-start gap-3">
				
				<!-- Icône -->
			                <div
					class="
						mt-0.5 h-6 w-6 flex items-center justify-center rounded-full 
						bg-gradient-to-br from-amber-400 to-yellow-500 shadow text-white text-sm
					"
				>
				⚠️
				</div>

				<!-- Texte -->
				<p class="text-sm leading-relaxed">
					<strong
						class="bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent font-semibold"
					>
						Procédure recommandée :
					</strong>
					supprimer d'abord le fichier dans Sonarr & Radarr, effectuer l’édition locale,
					puis lancer le réimport à l’aide des boutons d’action situés à droite.
					<br />
					Cela garantit une synchronisation propre et évite toute incohérence
					dans vos bibliothèques.
                                        <br />
                                        En cas de renommage massif de vos médias, il est recommandé de supprimer entièrement la bibliothèque dans Sonarr & Radarr, puis d’effectuer une réimportation complète.
				</p>
			</div>
		</div>

	</div>

    <!-- CATEGORY CARDS -->
    {#if activeStats}
        <div class="mt-6 mb-10 p-6 rounded-2xl border shadow-xl">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {#each Object.keys(activeLabels).filter((k) => k !== "total") as cat}
                    <CategoryCard
                        {cat}
                        labels={activeLabels}
                        stats={activeStats}
                        on:select={(e) => {
                            const c = e.detail;
                            if (mode === "movies") {
                                movieCategory.set(c);
                                moviePage.set(1);
                            } else {
                                seriesCategory.set(c);
                                seriesPage.set(1);
                            }
                        }}
                    />
                {/each}
            </div>
        </div>
    {/if}

    <!-- LISTE DÉTAILLÉE -->
    {#if activeSelected && activeDetails[activeSelected]}
        <h3 class="text-lg font-semibold mb-4">
            {activeLabels[activeSelected].label}
            <small>({activeDetails[activeSelected].length})</small>
        </h3>

        <div class="space-y-4">
            {#each visible as item (item.original ?? item.folder)}
                <CardItem
                    {item}
                    category={activeSelected}
                    labels={activeLabels}
                    mode={mode}
                    actions={{
                        rename: mode === "movies" ? renameItem : renameSeries,
                        fix: mode === "movies" ? fixIMDB : fixSeriesIMDB,
                        delete: mode === "movies" ? deleteFromRadarr : deleteFromSonarr,
                        reimport: mode === "movies" ? reimportRadarr : reimportSonarr
                    }}
                />
            {/each}
        </div>

        <div bind:this={sentinel} class="h-10"></div>
    {/if}

    <!-- LOADING -->
    {#if
        $movieLoadingOnly || $movieLoadingFull ||
        $seriesLoadingOnly || $seriesLoadingFull
    }
        <div class="text-center py-16 animate-pulse">
            Analyse en cours...
        </div>
    {/if}
</main>
