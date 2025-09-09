<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { ExternalLink, Wrench, ShieldCheck, Tv } from "lucide-svelte";

  // base URL API backend
  const baseURL = import.meta.env.DEV
    ? import.meta.env.VITE_BACKEND_URL_HTTP
    : import.meta.env.VITE_BACKEND_URL_HTTPS;

  export let item: {
    symlink: string;
    target: string;
    ref_count: number;
    type: string;
    status?: string;
    poster?: string;
    id?: number;
    title?: string;
    year?: number;
    rating?: number;
    genres?: string[];
    certification?: string;
    runtime?: number;
    language?: string;
    target_exists?: boolean;
  };

  console.log("📦 item reçu dans popup:", item);

  const dispatch = createEventDispatcher();

  let posterUrl: string | null = item?.poster || null;
  let sonarrData: any = null;
  let loadingTitle: boolean = false;

  let loadingOpen = false;
  let loadingRepair = false;
  let loadingDelete = false;
  let loadingSeasonarr = false;

  // --------- utils ---------
  function relativeToRoot(absPath: string): { root: string | null; relative: string } {
    if (!absPath) return { root: null, relative: "" };

    const norm = absPath.replace(/\\/g, "/");
    const needle = "/Medias/";
    const idx = norm.indexOf(needle);

    if (idx === -1) {
      return { root: null, relative: "" }; // pas trouvé
    }

    // après "Medias/"
    const afterMedias = norm.substring(idx + needle.length);

    // root = premier dossier après "Medias/"
    const parts = afterMedias.split("/");
    const root = parts[0] || null;

    // relative = tout ce qui suit root
    const relative = parts.slice(1).join("/");

    return { root, relative };
  }

  // --------- actions ---------
  function openArr() {
    loadingOpen = true;
    dispatch("openArr", { item });
    setTimeout(() => (loadingOpen = false), 1200);
  }
  function repair() {
    loadingRepair = true;
    dispatch("delete", { item }); // ta logique de réparation
    setTimeout(() => (loadingRepair = false), 1500);
  }
  function deleteSymlink() {
    loadingDelete = true;
    dispatch("delete", { item });
    setTimeout(() => (loadingDelete = false), 1000);
  }
  async function openSeasonarr() {
    if (item.type.toLowerCase() !== "sonarr") return;
    loadingSeasonarr = true;

    const { root, relative } = relativeToRoot(item.symlink);
    if (!relative || !root) {
      alert("Impossible de déterminer le chemin relatif à la racine.");
      loadingSeasonarr = false;
      return;
    }

    const route = `/api/v1/symlinks/get-sonarr-id/${encodeURIComponent(relative)}?root=${encodeURIComponent(root)}`;
    try {
      const res = await fetch(`${baseURL}${route}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.id) throw new Error("Pas d'ID série retourné");
      window.location.href = `${import.meta.env.VITE_BACKEND_URL_HTTPS}/season/shows/${json.id}`;
    } catch (e) {
      alert(`Erreur récupération ID Sonarr : ${e}`);
    } finally {
      loadingSeasonarr = false;
    }
  }
  function close() {
    dispatch("close");
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  // --------- lifecycle ---------
  onMount(async () => {
    window.addEventListener("keydown", handleKey);
    document.body.classList.add("overflow-hidden");

    if (item.type === "sonarr") {
      loadingTitle = true;
      try {
        const res = await fetch(
          `/api/v1/symlinks/get-sonarr-id/${encodeURIComponent(item.symlink)}`,
          { headers: { accept: "application/json" } }
        );
        if (res.ok) {
          sonarrData = await res.json();
          if (sonarrData.poster) {
            item.poster = sonarrData.poster;
            posterUrl = sonarrData.poster;
          }
        }
      } catch (err) {
        console.error("💥 Erreur API get-sonarr-id:", err);
      } finally {
        loadingTitle = false;
      }
    }

    if (!posterUrl) {
      posterUrl = item?.poster || null;
    }
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKey);
    document.body.classList.remove("overflow-hidden");
  });

  // --------- animations ---------
  function flyAndScale(node, { delay = 0, duration = 250 }) {
    const flyTrans = fly(node, { y: 20, duration, easing: cubicOut });
    const scaleTrans = scale(node, { start: 0.96, duration, easing: cubicOut });
    return {
      delay,
      duration,
      css: (t, u) => `${flyTrans.css(t, u)};${scaleTrans.css(t, u)}`
    };
  }

  // --------- styles boutons ---------
  const isBroken = item.ref_count === 0 || item.target_exists === false;
  function buttonClasses(state: "open" | "repair-active" | "repair-disabled" | "seasonarr") {
    const colors = {
      open: "from-blue-500/80 to-indigo-500/80 hover:from-blue-600 hover:to-indigo-600 focus:ring-indigo-300",
      "repair-active": "from-emerald-500/80 to-rose-500/80 hover:from-emerald-600 hover:to-rose-600 focus:ring-emerald-300",
      "repair-disabled": "from-indigo-300/70 to-purple-300/70 cursor-not-allowed opacity-70",
      seasonarr: "from-pink-400/80 to-purple-500/80 hover:from-pink-500 hover:to-purple-600 focus:ring-pink-300"
    };
    return colors[state];
  }
</script>

<!-- Overlay -->
<div
  class="fixed inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/90
         flex items-center justify-center z-50"
  on:click={close}
  role="presentation"
  aria-hidden="true"
  in:fade={{ duration: 250 }}
  out:fade={{ duration: 200 }}
>
  <!-- Modal -->
  <section
    class="relative bg-white/90 dark:bg-gray-900/90 md:bg-white/80 md:dark:bg-gray-900/80 md:backdrop-blur-md
           rounded-2xl border border-white/20
           shadow-[0_8px_40px_rgba(99,102,241,0.25)]
           w-full max-w-2xl max-h-[90vh] overflow-y-auto
           mx-auto p-6 space-y-6"
    role="dialog"
    aria-modal="true"
    transition:flyAndScale={{ duration: 250 }}
  >
    <div on:click|stopPropagation role="presentation" aria-hidden="true">
      <!-- Bouton fermer -->
      <button
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
               transition transform hover:scale-110"
        on:click={close}
        aria-label="Fermer"
      >
        ✖
      </button>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {#if posterUrl}
          <img
            src={posterUrl}
            alt="Poster"
            class="w-28 h-40 sm:w-36 sm:h-52 rounded-xl object-cover shadow-lg ring-1 ring-white/30"
          />
        {/if}
        <div class="flex flex-col gap-2 text-center sm:text-left w-full">
          <h2 class="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            {#if loadingTitle}
              Chargement…
            {:else if sonarrData}
              {sonarrData.title}
            {:else if item.title}
              {item.title}
            {:else}
              {item.symlink}
            {/if}
          </h2>

          <!-- Infos principales -->
          <div class="flex flex-wrap gap-2 text-sm text-gray-700 dark:text-gray-300">
            {#if item.type === "radarr"}
              {#if item.year}
                <span class="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700">📅 {item.year}</span>
              {/if}
              {#if item.rating}
                <span class="px-2 py-0.5 rounded bg-yellow-200 dark:bg-yellow-700">⭐ {item.rating.toFixed(1)}/10</span>
              {/if}
              {#if item.genres && item.genres.length > 0}
                <span class="px-2 py-0.5 rounded bg-indigo-200 dark:bg-gray-700">🎭 {item.genres.join(", ")}</span>
              {/if}
              {#if item.certification}
                <span class="px-2 py-0.5 rounded bg-green-200 dark:bg-green-700">🔖 {item.certification}</span>
              {/if}
              {#if item.runtime}
                <span class="px-2 py-0.5 rounded bg-pink-200 dark:bg-pink-700">⏱️ {item.runtime} min</span>
              {/if}
              {#if item.language}
                <span class="px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-700">🌐 {item.language}</span>
              {/if}
            {:else if sonarrData}
              {#if sonarrData.year}
                <span class="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700">📅 {sonarrData.year}</span>
              {/if}
              {#if sonarrData.status}
                <span class="px-2 py-0.5 rounded bg-red-200 dark:bg-red-700">📌 {sonarrData.status}</span>
              {/if}
              {#if sonarrData.network}
                <span class="px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-700">📺 {sonarrData.network}</span>
              {/if}
              {#if sonarrData.genres && sonarrData.genres.length > 0}
                <span class="px-2 py-0.5 rounded bg-indigo-200 dark:bg-indigo-700">🎭 {sonarrData.genres.join(", ")}</span>
              {/if}
            {/if}
          </div>

          <!-- 🔥 Bloc statut -->
          <div class="mt-3">
            {#if item.ref_count === 0}
              <span class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                           bg-gradient-to-r from-red-500/80 to-orange-500/80 text-white shadow-lg">
                ⚠ Symlink orphelin
              </span>
            {:else if item.target_exists === false}
              <span class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                           bg-gradient-to-r from-gray-400/70 to-gray-600/70 text-white shadow-lg">
                ❌ Cible introuvable
              </span>
            {:else}
              <span class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                           bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white shadow-lg">
                ✔ Symlink valide
              </span>
            {/if}
          </div>

          <!-- Bloc épisode (si Sonarr + S/E détecté) -->
          {#if sonarrData && sonarrData.season && sonarrData.episode}
            <div class="mt-3 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 shadow-inner">
              <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">
                🎞️ Épisode : S{String(sonarrData.season).padStart(2, "0")}E{String(sonarrData.episode).padStart(2, "0")}
              </p>
              {#if sonarrData.episodeTitle}
                <p class="text-sm text-gray-700 dark:text-gray-300">📖 {sonarrData.episodeTitle}</p>
              {/if}
              {#if sonarrData.downloaded !== null}
                <p class="text-sm">
                  📂 Téléchargé :
                  {sonarrData.downloaded ? "✅ Oui" : "❌ Non"}
                </p>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <!-- Bouton ouvrir -->
        <button
          class={`relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm 
                  bg-gradient-to-r ${buttonClasses("open")} text-white
                  hover:scale-105 focus:ring-2`}
          on:click={openArr}
          disabled={loadingOpen}
        >
          {#if loadingOpen}
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Ouverture...
          {:else}
            <ExternalLink class="w-4 h-4" /> Ouvrir {item.type}
          {/if}
        </button>

        <!-- Bouton réparer -->
        <button
          class={`relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm 
                  bg-gradient-to-r ${buttonClasses(isBroken ? "repair-active" : "repair-disabled")} text-white
                  hover:scale-105 focus:ring-2`}
          on:click={repair}
          disabled={!isBroken || loadingRepair}
        >
          {#if loadingRepair}
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Réparation...
          {:else if isBroken}
            <Wrench class="w-4 h-4" /> Réparer
          {:else}
            <ShieldCheck class="w-4 h-4" /> Réparer
          {/if}
        </button>

        <!-- Bouton Seasonarr -->
        {#if item.type.toLowerCase() === "sonarr"}
          <button
            class={`relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm 
                    bg-gradient-to-r ${buttonClasses("seasonarr")} text-white
                    hover:scale-105 focus:ring-2`}
            on:click={openSeasonarr}
            disabled={loadingSeasonarr}
          >
            {#if loadingSeasonarr}
              <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Seasonarr...
            {:else}
              <Tv class="w-4 h-4" /> Seasonarr
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </section>
</div>
