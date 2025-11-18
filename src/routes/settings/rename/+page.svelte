<script lang="ts">
	import { onMount } from "svelte";
	import ScanHeader from "$lib/components/ScanHeader.svelte";
	import CategoryCard from "$lib/components/CategoryCard.svelte";
	import CardItem from "$lib/components/CardItem.svelte";

	import {
		runScanOnly,
		stats,
		details,
		selectedCategory,
		page,
		statLabels,
		loadingScanOnly,
		loadingScanFull
	} from "$lib/stores/movies";

	let dryRun = false;
	let sentinel: HTMLElement;

	onMount(() => {
		runScanOnly();
	});

	/* -------------------------------------
	   CALCUL LOCAL → FINI LE BUG SSR
	-------------------------------------- */
	$: visible =
		$selectedCategory && $details[$selectedCategory]
			? $details[$selectedCategory].slice(0, $page * 100)
			: [];
</script>

<ScanHeader {dryRun} />

<main class="mx-auto max-w-7xl px-4 pb-16">

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
					supprimer d'abord le fichier de Radarr, effectuer l’édition locale,
					puis lancer le réimport à l’aide des boutons d’action situés à droite.
					<br />
					Cela garantit une synchronisation propre et évite toute incohérence
					dans vos bibliothèques.
                                        <br />
                                        En cas de renommage massif de vos médias, il est recommandé de supprimer entièrement la bibliothèque dans Radarr, puis d’effectuer une réimportation complète.
				</p>
			</div>
		</div>

	</div>

	<!-- Résumé categories -->
	{#if $stats}
		<div class="mt-6 mb-10 p-6 rounded-2xl border shadow-xl">
			<div
				class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
			>
				{#each Object.keys(statLabels).filter((k) => k !== "total") as cat}
					<CategoryCard {cat} />
				{/each}
			</div>
		</div>
	{/if}

	<!-- Liste détaillée -->
	{#if $selectedCategory && $details[$selectedCategory]}
		<h3 class="text-lg font-semibold mb-4">
			{statLabels[$selectedCategory].label}
			<small>({$details[$selectedCategory].length})</small>
		</h3>

		<div class="space-y-4">
			{#each visible as item (item.original)}
				<CardItem {item} category={$selectedCategory} />
			{/each}
		</div>

		<div bind:this={sentinel} class="h-10"></div>
	{/if}

	<!-- LOADING -->
	{#if $loadingScanOnly || $loadingScanFull}
		<div class="text-center py-16 text-muted-foreground animate-pulse">
			Analyse en cours...
		</div>
	{/if}

</main>
