<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { ExternalLink, Wrench, Tv, X, Play, Loader2 } from "lucide-svelte";

  const baseURL = import.meta.env.DEV
    ? import.meta.env.VITE_BACKEND_URL_HTTP
    : import.meta.env.VITE_BACKEND_URL_HTTPS;

  export let item: any;

  const dispatch = createEventDispatcher();

  let posterUrl: string | null = item?.poster || null;
  let backdropUrl: string | null = null;
  let logoUrl: string | null = null;
  let sonarrData: any = null;
  let tmdbData: any = null;
  let showFullOverview = false;
  let showTrailer = false;

  let loadingTitle = false;
  let loadingOpen = false;
  let loadingRepair = false;
  let loadingSeasonarr = false;
  let loadingTrailer = false;

  const isBroken = item.ref_count === 0 || item.target_exists === false;

  let isFrenchTrailer = false;

  function close() {
    dispatch("close");
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  function openArr() {
    loadingOpen = true;
    dispatch("openArr", { item });
    setTimeout(() => (loadingOpen = false), 1000);
  }

  function repair() {
    loadingRepair = true;
    dispatch("delete", { item });
    setTimeout(() => (loadingRepair = false), 1200);
  }

  async function openSeasonarr() {
    if (item.type.toLowerCase() !== "sonarr") return;
    loadingSeasonarr = true;
    try {
      const res = await fetch(
        `${baseURL}/api/v1/symlinks/get-sonarr-id/${encodeURIComponent(item.symlink)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.id) {
          window.location.href = `${import.meta.env.VITE_BACKEND_URL_HTTPS}/season/shows/${json.id}`;
        }
      }
    } finally {
      loadingSeasonarr = false;
    }
  }

  function fadeAndScale(node, { delay = 0, duration = 400 }) {
    const fadeTrans = fade(node, { duration });
    const scaleTrans = scale(node, { start: 0.9, duration, easing: cubicOut });
    return { delay, duration, css: (t, u) => `${fadeTrans.css(t, u)} ${scaleTrans.css(t, u)}` };
  }

  function flyAndScale(node, { delay = 0, duration = 250 }) {
    const flyTrans = fly(node, { y: 20, duration, easing: cubicOut });
    const scaleTrans = scale(node, { start: 0.96, duration, easing: cubicOut });
    return { delay, duration, css: (t, u) => `${flyTrans.css(t, u)};${scaleTrans.css(t, u)}` };
  }

  // --- YouTube: chercher une bande-annonce VF en priorité ---
  async function fetchYouTubeTrailer(title: string, year?: number) {
    const query = `${title} bande annonce VF ${year || ""}`.trim();
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&q=${encodeURIComponent(
      query
    )}&key=${import.meta.env.VITE_YOUTUBE_API_KEY}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const json = await res.json();
      if (json.items?.length) {
        const video = json.items[0];
        const videoId = video.id.videoId;
        const title = video.snippet.title.toLowerCase();

        isFrenchTrailer = title.includes("vf") || title.includes("français");

        // ✅ Correction : URL d’intégration complète (avec ton domaine)
        const origin = import.meta.env.VITE_BACKEND_URL_HTTPS;
        const trailerUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&modestbranding=1&playsinline=1&rel=0&origin=${encodeURIComponent(
          origin
        )}&widget_referrer=${encodeURIComponent(origin)}`;

        return trailerUrl;
      }
    } catch (e) {
      console.error("YouTube trailer fetch failed:", e);
    }

    return null;
  }

  // --- TMDB : FR prioritaire, fallback EN si trailer manquant ---
  async function fetchTmdbData(type: string, id: number) {
    async function fetchLang(lang: string) {
      const res = await fetch(`${baseURL}/api/v1/symlinks/tmdb/${type}/${id}?lang=${lang}`);
      if (!res.ok) return null;
      return await res.json();
    }

    const frData = await fetchLang("fr-FR");
    let data = frData;

    if (!frData?.trailer) {
      const enData = await fetchLang("en-US");
      if (enData) {
        data = {
          ...frData,
          trailer: enData.trailer || frData?.trailer,
          cast: frData?.cast?.length ? frData.cast : enData.cast
        };

        if (!frData?.poster && enData.poster) data.poster = enData.poster;
        if (!frData?.backdrop && enData.backdrop) data.backdrop = enData.backdrop;
        if (!frData?.logo && enData.logo) data.logo = enData.logo;
      }
    }

    return data;
  }

  onMount(async () => {
    window.addEventListener("keydown", handleKey);
    document.body.classList.add("overflow-hidden");

    if (item.type === "sonarr") {
      loadingTitle = true;
      try {
        const res = await fetch(
          `${baseURL}/api/v1/symlinks/get-sonarr-id/${encodeURIComponent(item.symlink)}`
        );
        if (res.ok) {
          sonarrData = await res.json();
          if (sonarrData.poster) posterUrl = sonarrData.poster;
          if (sonarrData.tmdbId) item.tmdbId = sonarrData.tmdbId;
        }
      } finally {
        loadingTitle = false;
      }
    }

    if (item.tmdbId) {
      const type = item.type.toLowerCase() === "radarr" ? "movie" : "tv";
      try {
        tmdbData = await fetchTmdbData(type, item.tmdbId);

        const title = tmdbData?.title || sonarrData?.title || item.title;
        const trailer = await fetchYouTubeTrailer(title, item.year || tmdbData?.year);

        if (trailer) {
          tmdbData.trailer = trailer;
        }

        if (tmdbData?.poster && !posterUrl) posterUrl = tmdbData.poster;
        if (tmdbData?.backdrop) backdropUrl = tmdbData.backdrop;
        if (tmdbData?.logo) logoUrl = tmdbData.logo;
      } catch (err) {
        console.error("TMDB error:", err);
      }
    }
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKey);
    document.body.classList.remove("overflow-hidden");
  });
</script>

<!-- ================= POPUP ================= -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
  role="button"
  tabindex="0"
  aria-label="Fermer la popup"
  on:click={close}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && close()}
  in:fade={{ duration: 250 }}
  out:fade={{ duration: 200 }}
>
  <section
    role="presentation"
    class="relative w-full max-w-6xl h-[95vh] mx-auto
           bg-black rounded-3xl shadow-2xl overflow-hidden"
    on:click|stopPropagation
    transition:flyAndScale={{ duration: 250 }}
  >
    <!-- Bouton de fermeture -->
    <button
      type="button"
      class="absolute top-4 right-4 z-50 text-white hover:text-gray-300 hover:scale-110 transition"
      on:click={close}
      aria-label="Fermer"
    >
      <X class="w-6 h-6" />
    </button>

    <!-- Backdrop -->
    <div class="absolute inset-0 w-full h-full">
      {#if backdropUrl}
        <img
          src={backdropUrl}
          alt="Backdrop"
          class="absolute inset-0 w-full h-full object-cover"
        />
      {/if}
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
    </div>

    <!-- Overlay content -->
    <div class="relative z-20 flex flex-col gap-6 sm:gap-10 p-6 sm:p-12 text-white h-full overflow-y-auto">
      <div class="flex flex-col sm:flex-row gap-6 sm:gap-10 items-center sm:items-start">
        {#if posterUrl}
          <div class="w-32 sm:w-48 flex-shrink-0">
            <img
              src={posterUrl}
              alt="Poster"
              class="w-full aspect-[2/3] object-cover rounded-2xl shadow-2xl"
            />
          </div>
        {/if}

        <div class="flex flex-col gap-4 sm:gap-6 text-center sm:text-left max-w-2xl">
          {#if logoUrl}
            <img
              src={logoUrl}
              alt="Logo"
              class="h-12 sm:h-20 object-contain mx-auto sm:mx-0"
            />
          {:else}
            {#if loadingTitle}
              <div class="h-8 sm:h-12 w-48 sm:w-72 rounded-md 
                          bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 
                          animate-pulse mx-auto sm:mx-0"></div>
            {:else}
              {#if tmdbData?.title || sonarrData?.title}
                <h2
                  transition:fadeAndScale={{ duration: 400 }}
                  class="text-2xl sm:text-4xl font-extrabold drop-shadow-lg"
                >
                  {tmdbData?.title || sonarrData?.title}
                </h2>
              {:else}
                <div class="h-8 sm:h-12 w-48 sm:w-72 rounded-md 
                            bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 
                            animate-pulse mx-auto sm:mx-0"></div>
              {/if}
            {/if}
          {/if}

          <div class="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3 text-xs sm:text-sm">
            {#if item.year || tmdbData?.year}
              <span class="px-2 sm:px-3 py-1 rounded-full bg-white/20">
                📅 {item.year || tmdbData.year}
              </span>
            {/if}
            {#if item.rating || tmdbData?.rating}
              <span class="px-2 sm:px-3 py-1 rounded-full bg-yellow-500/80">
                ⭐ {(item.rating || tmdbData.rating).toFixed(1)}/10
              </span>
            {/if}
            {#if item.genres?.length || tmdbData?.genres?.length}
              <span class="px-2 sm:px-3 py-1 rounded-full bg-indigo-500/60">
                🎭 {(item.genres || tmdbData.genres).join(", ")}
              </span>
            {/if}
            {#if tmdbData?.runtime}
              <span class="px-2 sm:px-3 py-1 rounded-full bg-pink-500/60">
                ⏱ {tmdbData.runtime} min
              </span>
            {/if}
          </div>

          {#if tmdbData?.overview}
            <p class="text-sm sm:text-base text-gray-200 leading-relaxed">
              {#if showFullOverview}
                {tmdbData.overview}
                <button
                  type="button"
                  class="ml-2 text-indigo-300 underline"
                  on:click={() => showFullOverview = false}
                >
                  moins
                </button>
              {:else}
                {tmdbData.overview.slice(0, 200)}...
                <button
                  type="button"
                  class="ml-2 text-indigo-300 underline"
                  on:click={() => showFullOverview = true}
                >
                  plus
                </button>
              {/if}
            </p>
          {/if}

          {#if tmdbData?.trailer}
            <button
              type="button"
              class="inline-flex items-center gap-2 bg-red-600 text-white font-bold 
                     px-3 py-1.5 rounded-md hover:bg-red-700 transition mt-2 text-sm 
                     w-fit mx-auto sm:mx-0 disabled:opacity-50"
              on:click={() => { loadingTrailer = true; showTrailer = true; setTimeout(() => loadingTrailer = false, 800); }}
              disabled={loadingTrailer}
            >
              {#if loadingTrailer}
                <Loader2 class="w-4 h-4 animate-spin" />
                Chargement...
              {:else}
                <Play class="w-4 h-4" /> Bande-annonce
              {/if}
            </button>
          {/if}
        </div>
      </div>

      {#if tmdbData?.cast?.length}
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Casting principal
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-xs sm:text-sm">
            {#each tmdbData.cast.slice(0, 8) as actor}
              <div>
                <p class="text-gray-200">{actor.name}</p>
                {#if actor.character}
                  <p class="text-[11px] text-gray-400 italic">{actor.character}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Action buttons -->
      <div class="flex flex-wrap justify-center sm:justify-end gap-3 mt-6">
        <!-- Open Arr -->
        <button
          type="button"
          class="flex items-center gap-2 bg-white text-black font-bold 
                 px-6 py-2 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          on:click={openArr}
          disabled={loadingOpen}
        >
          {#if loadingOpen}
            <Loader2 class="w-5 h-5 animate-spin" /> Ouverture...
          {:else}
            <ExternalLink class="w-5 h-5" /> Ouvrir {item.type === "radarr" ? "Radarr" : "Sonarr"}
          {/if}
        </button>

        <!-- Repair -->
        <button
          type="button"
          class="flex items-center gap-2 bg-emerald-600 text-white font-bold 
                 px-6 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
          on:click={repair}
          disabled={!isBroken || loadingRepair}
        >
          {#if loadingRepair}
            <Loader2 class="w-5 h-5 animate-spin" /> Réparation...
          {:else}
            <Wrench class="w-5 h-5" /> Réparer
          {/if}
        </button>

        <!-- Seasonarr -->
        {#if item.type.toLowerCase() === "sonarr"}
          <button
            type="button"
            class="flex items-center gap-2 bg-purple-600 text-white font-bold 
                   px-6 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            on:click={openSeasonarr}
            disabled={loadingSeasonarr}
          >
            {#if loadingSeasonarr}
              <Loader2 class="w-5 h-5 animate-spin" /> Ouverture...
            {:else}
              <Tv class="w-5 h-5" /> Seasonarr
            {/if}
          </button>
        {/if}
      </div>
    </div>

{#if showTrailer}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
    role="dialog"
    aria-modal="true"
  >
    <div class="relative w-full max-w-4xl aspect-video">
      <iframe
        src={tmdbData.trailer}
        referrerpolicy="origin"
        class="w-full h-full rounded-xl"
        allow="autoplay; fullscreen"
        allowfullscreen
        title="Bande-annonce"
      ></iframe>
      <button
        type="button"
        class="absolute top-2 right-2 text-white text-2xl"
        on:click={() => showTrailer = false}
        aria-label="Fermer la bande-annonce"
      >
        ✖
      </button>
    </div>
  </div>
{/if}
  </section>
</div>