<script lang="ts">
  import { onMount } from "svelte";
  import { CheckCircle2, Film, Tv, Sparkles, X, Terminal } from "lucide-svelte";
  import { renaming, renameSuccess } from "$lib/stores/symlinks";
  import {
    scanMoviesAPI,
    scanSeriesAPI,
    scanLibrariesAPI
  } from "$lib/api/symlinks";

  export let onClose: () => void;

  // Toggle dry run
  let dryRun = true;

  // --- État global (bibliothèques) ---
  let movies = 0;
  let moviesMissing = 0;
  let shows = 0;
  let showsMissing = 0;

  // --- Dernier run ---
  let stats: any = null;
  let elapsed = 0;
  let runType: string | null = null;

  // Logs techniques
  let rawLogs: string[] = [];
  let showLogs = false;

  onMount(refreshLibraries);

  async function refreshLibraries() {
    try {
      const data = await scanLibrariesAPI();

      // ✅ Correction : s'appuyer sur stats renvoyées par le backend
      movies = data.movies?.ok ?? 0;
      moviesMissing = data.movies?.imdb_missing ?? 0;
      shows = data.shows?.ok ?? 0;
      showsMissing = data.shows?.imdb_missing ?? 0;
    } catch (err) {
      console.error("Erreur chargement libraries:", err);
    }
  }

  async function onRename(type: string) {
    stats = null;
    elapsed = 0;
    rawLogs = [];
    runType = type;

    if (type === "radarr") {
      renaming.update(v => ({ ...v, radarr: true }));
      try {
        const res = await scanMoviesAPI(dryRun);
        stats = res.stats ?? null;
        elapsed = res.elapsed ?? 0;
        rawLogs = res.logs ?? [];
        renameSuccess.update(v => ({ ...v, radarr: true }));
        await refreshLibraries();
      } catch (err) {
        console.error("Erreur Radarr:", err);
      } finally {
        renaming.update(v => ({ ...v, radarr: false }));
      }
    }

    if (type === "sonarr") {
      renaming.update(v => ({ ...v, sonarr: true }));
      try {
        const res = await scanSeriesAPI(dryRun);
        stats = res.stats ?? null;
        elapsed = res.elapsed ?? 0;
        rawLogs = res.logs ?? [];
        renameSuccess.update(v => ({ ...v, sonarr: true }));
        await refreshLibraries();
      } catch (err) {
        console.error("Erreur Sonarr:", err);
      } finally {
        renaming.update(v => ({ ...v, sonarr: false }));
      }
    }

    if (type === "all") {
      renaming.update(v => ({ ...v, global: true }));
      try {
        const resMovies = await scanMoviesAPI(dryRun);
        const resSeries = await scanSeriesAPI(dryRun);
        // Fusion stats
        stats = {
          total: (resMovies.stats?.total ?? 0) + (resSeries.stats?.total ?? 0),
          renamed: (resMovies.stats?.renamed ?? 0) + (resSeries.stats?.renamed ?? 0),
          already_conform: (resMovies.stats?.already_conform ?? 0) + (resSeries.stats?.already_conform ?? 0),
          not_found: (resMovies.stats?.not_found ?? 0) + (resSeries.stats?.not_found ?? 0),
          errors: (resMovies.stats?.errors ?? 0) + (resSeries.stats?.errors ?? 0),
        };
        elapsed = (resMovies.elapsed ?? 0) + (resSeries.elapsed ?? 0);
        rawLogs = [...(resMovies.logs ?? []), ...(resSeries.logs ?? [])];
        renameSuccess.update(v => ({ ...v, global: true }));
        await refreshLibraries();
      } catch (err) {
        console.error("Erreur Global:", err);
      } finally {
        renaming.update(v => ({ ...v, global: false }));
      }
    }
  }
</script>

<!-- Overlay -->
<div class="fixed inset-0 z-50 flex items-center justify-center">
  <!-- Overlay noir cliquable (corrigé en <button> accessible) -->
  <button
    type="button"
    on:click={onClose}
    aria-label="Fermer la fenêtre"
    class="absolute inset-0 bg-black/60 cursor-pointer"
  ></button>

  <!-- Popup -->
  <div
    role="dialog"
    aria-modal="true"
    class="relative bg-white dark:bg-gray-900 rounded-3xl shadow-xl w-[95%] max-w-2xl p-6 sm:p-8 space-y-6"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
        <Sparkles class="w-6 h-6 text-yellow-500 animate-pulse" />
        <span class="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
          Centre de renommage
        </span>
      </h2>
      <button
        type="button"
        on:click={onClose}
        aria-label="Fermer la fenêtre"
        class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <X class="w-5 h-5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" />
      </button>
    </div>

    <!-- Message utilisateur premium -->
    <div
      class="relative overflow-hidden rounded-2xl border border-yellow-300 dark:border-yellow-700 bg-gradient-to-r from-amber-50 to-yellow-100 dark:from-yellow-900 dark:to-yellow-800 p-4 shadow-sm"
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 mt-0.5">
          <Sparkles class="w-6 h-6 text-yellow-500 animate-pulse" />
        </div>
        <div class="flex-1">
          <p class="text-sm sm:text-base text-yellow-900 dark:text-yellow-100 leading-relaxed">
            Après le <span class="font-semibold">renommage</span>, 
            assurez-vous de <span class="underline decoration-yellow-400 decoration-dashed">forcer une nouvelle importation</span> 
            dans <span class="font-bold">Radarr</span> et <span class="font-bold">Sonarr</span>, 
            puis de <span class="font-semibold">relancer un scan Plex</span> 
            afin que vos bibliothèques soient parfaitement <span class="italic">synchronisées et à jour</span>.
          </p>
        </div>
      </div>
      <div class="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500"></div>
    </div>

    <!-- Bloc 1 : État global -->
    <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 grid grid-cols-2 gap-4 text-center">
      <div>
        <p class="text-2xl font-bold text-pink-600 dark:text-pink-400">{movies}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">Films</p>
        {#if moviesMissing > 0}
          <p class="text-xs text-yellow-600 dark:text-yellow-400">⚠️ {moviesMissing} sans IMDb</p>
        {/if}
      </div>
      <div>
        <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{shows}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">Séries</p>
        {#if showsMissing > 0}
          <p class="text-xs text-yellow-600 dark:text-yellow-400">⚠️ {showsMissing} sans IMDb</p>
        {/if}
      </div>
    </div>

    <!-- Toggle dry run -->
    <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {dryRun ? "Mode simulation (dry run)" : "Mode réel"}
      </span>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" bind:checked={dryRun} class="sr-only peer" />
        <div
          class="w-11 h-6 bg-gray-200 peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-rose-500 rounded-full transition-colors"
        ></div>
        <div
          class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full border border-gray-300 transition-transform duration-300 peer-checked:translate-x-5"
        ></div>
      </label>
    </div>

    <!-- Actions -->
    <div class="flex flex-col gap-4">
      <!-- Radarr -->
      <button
        type="button"
        on:click={() => onRename("radarr")}
        class="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform"
        disabled={$renaming.radarr}
      >
        {#if $renaming.radarr}
          <span class="loader w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Radarr en cours...</span>
        {:else if $renameSuccess.radarr}
          <CheckCircle2 class="w-5 h-5 text-green-300" />
          <span>Radarr terminé</span>
        {:else}
          <Film class="w-5 h-5" />
          <span>Renommer avec Radarr</span>
        {/if}
      </button>

      <!-- Sonarr -->
      <button
        type="button"
        on:click={() => onRename("sonarr")}
        class="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform"
        disabled={$renaming.sonarr}
      >
        {#if $renaming.sonarr}
          <span class="loader w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Sonarr en cours...</span>
        {:else if $renameSuccess.sonarr}
          <CheckCircle2 class="w-5 h-5 text-green-300" />
          <span>Sonarr terminé</span>
        {:else}
          <Tv class="w-5 h-5" />
          <span>Renommer avec Sonarr</span>
        {/if}
      </button>

      <!-- Global -->
      <button
        type="button"
        on:click={() => onRename("all")}
        class="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-slate-600 via-indigo-500 to-gray-700 text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform"
        disabled={$renaming.global}
      >
        {#if $renaming.global}
          <span class="loader w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Renommage global...</span>
        {:else if $renameSuccess.global}
          <CheckCircle2 class="w-5 h-5 text-green-300" />
          <span>Tout terminé !</span>
        {:else}
          <Sparkles class="w-5 h-5 text-yellow-300" />
          <span>Tout renommer</span>
        {/if}
      </button>
    </div>

    <!-- Bloc 2 : Résumé du dernier run -->
    {#if stats}
      <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200">
          Résumé du dernier run {#if runType}({runType}){/if}
        </h3>
        <p class="text-gray-800 dark:text-gray-200">📊 Total : {stats.total}</p>
        <p class="text-green-600">🔄 {stats.renamed} renommés</p>
        <p class="text-blue-500">⏭ {stats.already_conform} déjà conformes</p>
        <p class="text-yellow-600">❌ {stats.not_found} introuvables</p>
        <p class="text-red-600">⚠️ {stats.errors} erreurs</p>
        {#if elapsed > 0}
          <p class="text-gray-500 text-xs">⏱ Terminé en {elapsed}s</p>
        {/if}
      </div>
    {/if}

    <!-- Bloc 3 : Logs techniques -->
    {#if rawLogs.length > 0}
      <button
        type="button"
        on:click={() => (showLogs = !showLogs)}
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-pink-600 transition"
      >
        <Terminal class="w-4 h-4" /> {showLogs ? "Masquer détails" : "Voir détails techniques"}
      </button>

      {#if showLogs}
        <div class="bg-black text-green-400 font-mono text-xs p-3 rounded-lg max-h-40 overflow-y-auto">
          {#each rawLogs as log}
            <p>{log}</p>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .loader {
    display: inline-block;
  }
</style>
