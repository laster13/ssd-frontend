<script lang="ts">
  import { onMount } from "svelte";
  import { writable, get, derived } from "svelte/store";
  import { fade, scale } from "svelte/transition";
  import { updateNotification } from "$lib/stores/symlinks";
  import { connectionStatus } from "$lib/updateClient";

  type UpdateTarget = "backend" | "frontend" | "saison_frontend";

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const backendVersion = writable("—");
  const frontendVersion = writable("—");
  const saisonFrontendVersion = writable("—");

  const updatingBackend = writable(false);
  const updatingFrontend = writable(false);
  const updatingSaisonFrontend = writable(false);

  const updateMessage = writable("");
  const updateData = writable<any | null>(null);
  const logs = writable<any[]>([]);
  const filter = writable("all");
  const toast = writable<{ msg: string; type: string } | null>(null);
  const journalOpen = writable(true);

  let autoCheckInterval: any = null;

  // --- Filtrage du journal
  const filteredLogs = derived([logs, filter], ([$logs, $filter]) => {
    if ($filter === "all") return $logs;
    return $logs.filter((l) => l.type === $filter);
  });

  // --- Utilitaires
  function formatDate() {
    const d = new Date();
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  }

  function showToast(msg: string, type = "info") {
    toast.set({ msg, type });
    setTimeout(() => toast.set(null), 4000);
  }

  function log(msg: string, type: "update" | "error" | "info" = "info") {
    const entry = { ts: formatDate(), type, msg };
    logs.update((arr) => [entry, ...arr.slice(0, 49)]);
    localStorage.setItem("updateLogs", JSON.stringify(get(logs)));
  }

  function getUpdateLabel(target: UpdateTarget) {
    if (target === "backend") return "BACKEND";
    if (target === "frontend") return "FRONTEND";
    return "SAISON FRONTEND";
  }

  function setUpdating(target: UpdateTarget, value: boolean) {
    if (target === "backend") updatingBackend.set(value);
    if (target === "frontend") updatingFrontend.set(value);
    if (target === "saison_frontend") updatingSaisonFrontend.set(value);
  }

  // --- Chargement des versions
  async function loadVersions() {
    try {
      const res = await fetch(`${API_BASE_URL}/update/check`);
      if (!res.ok) throw new Error("HTTP error");

      const data = await res.json();

      backendVersion.set(data.backend?.current || "—");
      frontendVersion.set(data.frontend?.current || "—");
      saisonFrontendVersion.set(data.saison_frontend?.current || "—");

      updateData.set(data);
      updateMessage.set(data.message);
      log(data.message, "info");

      // 🧩 Stoppe les auto-check si une mise à jour est disponible
      if (data.update_available) {
        console.log("⏸️ Auto-check suspendu : mise à jour détectée.");
        if (autoCheckInterval) clearInterval(autoCheckInterval);
        autoCheckInterval = null;
      }

      return data;
    } catch {
      updateMessage.set("⚠️ Erreur chargement des versions.");
      log("Erreur chargement des versions.", "error");
      return null;
    }
  }

  // --- Vérifie la notification persistante stockée en base
  async function loadPersistentNotification() {
    try {
      const res = await fetch(`${API_BASE_URL}/update/persistent`);
      if (!res.ok) return;

      const data = await res.json();

      if (data.has_update) {
        updateNotification.set({
          type: data.type,
          message: data.message,
          version: data.version || null,
        });
      } else {
        updateNotification.set(null);
      }
    } catch (err) {
      console.warn("⚠️ Erreur chargement notifications persistantes", err);
    }
  }

  // --- Lancement manuel d'une mise à jour
  async function runUpdate(target: UpdateTarget) {
    setUpdating(target, true);

    const label = getUpdateLabel(target);

    updateMessage.set(`🔧 Mise à jour ${label} en cours...`);
    log(`Mise à jour ${label} démarrée...`, "update");

    if (autoCheckInterval) clearInterval(autoCheckInterval);
    autoCheckInterval = null;

    try {
      const res = await fetch(`${API_BASE_URL}/update/run/${target}`, {
        method: "POST"
      });

      const data = await res.json();

      updateMessage.set(data.message);
      log(data.message, "update");
      showToast(`✅ ${label} mis à jour avec succès`, "success");

      updateNotification.set(null);
      await loadPersistentNotification();
      await loadVersions();
    } catch {
      updateMessage.set(`❌ Erreur pendant la mise à jour ${label}.`);
      log(`Erreur pendant la mise à jour ${label}.`, "error");
      showToast(`❌ Erreur pendant la mise à jour ${label}`, "error");
    } finally {
      setUpdating(target, false);
      startAutoCheck();
    }
  }

  // --- Effacer le journal local
  function clearLogs() {
    logs.set([]);
    localStorage.removeItem("updateLogs");
    showToast("🧹 Journal effacé", "info");
  }

  // --- Auto-check périodique (toutes les 15 min)
  function startAutoCheck() {
    if (autoCheckInterval) clearInterval(autoCheckInterval);

    autoCheckInterval = setInterval(async () => {
      const data = await loadVersions();
      await loadPersistentNotification();

      if (data?.update_available) {
        console.log("⏸️ Auto-check suspendu : mise à jour détectée.");
        clearInterval(autoCheckInterval);
        autoCheckInterval = null;
      }
    }, 15 * 60 * 1000);
  }

  // --- Initialisation au montage
  onMount(() => {
    const saved = localStorage.getItem("updateLogs");
    if (saved) logs.set(JSON.parse(saved));

    loadVersions();
    loadPersistentNotification();
    startAutoCheck();
  });
</script>

<!-- ===== PAGE ===== -->
<div
  class="max-w-6xl mx-auto my-10 px-4 py-8 rounded-2xl shadow-lg transition bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 space-y-8"
>
  <!-- TOAST -->
  {#if $toast}
    <div
      class={`fixed top-6 right-6 px-4 py-2 rounded-lg text-sm shadow-lg z-50 transition-transform
        ${$toast.type === 'error' ? 'bg-red-600 text-white' :
          $toast.type === 'success' ? 'bg-emerald-600 text-white' :
          'bg-blue-600 text-white'}`}
      transition:scale
    >
      {$toast.msg}
    </div>
  {/if}

  <!-- HEADER -->
  <header class="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-emerald-500 dark:text-emerald-400 flex items-center gap-2">
        🔄 Gestion des mises à jour
      </h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        Suivez, mettez à jour et consultez l’historique du système.
      </p>
    </div>

    <span
      class={`text-sm font-semibold ${
        $connectionStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
      }`}
    >
      {$connectionStatus === 'connected' ? '🟢 Connecté' : '🕓 Reconnexion...'}
    </span>
  </header>

  <!-- ÉTAT GLOBAL -->
  <div
    class={`p-4 rounded-xl text-center transition-all duration-300 ${
      $updateData?.update_available
        ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-400 dark:border-amber-700 animate-pulse'
        : 'bg-emerald-50 dark:bg-green-900/20 border border-green-400 dark:border-green-700'
    }`}
  >
    <p class="text-lg font-medium">
      {$updateData?.update_available
        ? `🚀 Des mises à jour sont disponibles !`
        : `✅ Toutes les versions sont à jour.`}
    </p>
  </div>

  <!-- CARTES -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div
      class="p-6 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:shadow-lg transition"
    >
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">📦 Backend</h2>

      <p class="text-2xl font-mono">{$backendVersion}</p>

      {#if $updateData?.backend?.has_update}
        <p class="text-amber-600 dark:text-amber-400 text-sm mt-2">
          Nouvelle version : {$updateData.backend.remote}
        </p>

        <button
          class="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg w-full font-semibold flex justify-center items-center gap-2 transition disabled:opacity-60"
          on:click={() => runUpdate("backend")}
          disabled={$updatingBackend}
        >
          {#if $updatingBackend}
            <span class="loader w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"></span>
          {/if}
          🚀 Mettre à jour le backend
        </button>
      {:else}
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-2">À jour ✅</p>
      {/if}
    </div>

    <div
      class="p-6 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:shadow-lg transition"
    >
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">💅 Frontend</h2>

      <p class="text-2xl font-mono">{$frontendVersion}</p>

      {#if $updateData?.frontend?.has_update}
        <p class="text-amber-600 dark:text-amber-400 text-sm mt-2">
          Nouvelle version : {$updateData.frontend.remote}
        </p>

        <button
          class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full font-semibold flex justify-center items-center gap-2 transition disabled:opacity-60"
          on:click={() => runUpdate("frontend")}
          disabled={$updatingFrontend}
        >
          {#if $updatingFrontend}
            <span class="loader w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"></span>
          {/if}
          🎨 Mettre à jour le frontend
        </button>
      {:else}
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-2">À jour ✅</p>
      {/if}
    </div>

    <div
      class="p-6 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:shadow-lg transition"
    >
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">🎬 Saison Frontend</h2>

      <p class="text-2xl font-mono">{$saisonFrontendVersion}</p>

      {#if $updateData?.saison_frontend?.has_update}
        <p class="text-amber-600 dark:text-amber-400 text-sm mt-2">
          Nouvelle version : {$updateData.saison_frontend.remote}
        </p>

        <button
          class="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg w-full font-semibold flex justify-center items-center gap-2 transition disabled:opacity-60"
          on:click={() => runUpdate("saison_frontend")}
          disabled={$updatingSaisonFrontend}
        >
          {#if $updatingSaisonFrontend}
            <span class="loader w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"></span>
          {/if}
          🎬 Mettre à jour Saison Frontend
        </button>
      {:else}
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-2">À jour ✅</p>
      {/if}
    </div>
  </div>

  <!-- MESSAGE -->
  {#if $updateMessage}
    <div transition:fade class="text-center text-sm text-gray-600 dark:text-gray-300 min-h-[1.5rem]">
      {$updateMessage}
    </div>
  {/if}

  <!-- JOURNAL -->
  <div
    class="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
  >
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-2 bg-neutral-200 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-700"
    >
      <h2 class="pl-2 text-lg font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
        🗒️ Journal des mises à jour
      </h2>

      <!-- Barre de boutons responsive -->
      <div
        class="flex flex-wrap sm:flex-nowrap gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 scrollbar-hide"
      >
        <button
          class={`px-2 py-1 text-sm rounded ${
            $filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-neutral-300 dark:bg-neutral-700'
          }`}
          on:click={() => filter.set("all")}
        >
          Tous
        </button>

        <button
          class={`px-2 py-1 text-sm rounded ${
            $filter === 'update' ? 'bg-emerald-600 text-white' : 'bg-neutral-300 dark:bg-neutral-700'
          }`}
          on:click={() => filter.set("update")}
        >
          Mises à jour
        </button>

        <button
          class={`px-2 py-1 text-sm rounded ${
            $filter === 'error' ? 'bg-emerald-600 text-white' : 'bg-neutral-300 dark:bg-neutral-700'
          }`}
          on:click={() => filter.set("error")}
        >
          Erreurs
        </button>

        <button
          class="px-2 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
          on:click={clearLogs}
        >
          🧹 Effacer
        </button>

        <button
          class="px-2 py-1 text-sm rounded bg-neutral-400 dark:bg-neutral-700 hover:bg-neutral-500"
          on:click={() => journalOpen.update((v) => !v)}
        >
          {$journalOpen ? "🔽 Réduire" : "▶️ Ouvrir"}
        </button>
      </div>
    </div>

    <!-- Contenu du journal -->
    {#if $journalOpen}
      <div
        class="p-4 max-h-72 overflow-auto divide-y divide-neutral-300 dark:divide-neutral-700"
      >
        {#each $filteredLogs as log (log.ts)}
          <div
            class="py-2 sm:py-1 flex flex-col sm:flex-row sm:items-center sm:space-x-3
                   hover:bg-neutral-200/50 dark:hover:bg-neutral-700/30 rounded-lg px-2 transition"
          >
            <!-- Date + Type -->
            <div
              class="flex justify-between sm:w-60 shrink-0 text-xs sm:text-sm text-gray-500 dark:text-gray-400"
            >
              <span class="font-mono">{log.ts}</span>
              <span
                class={`font-semibold ${
                  log.type === 'error'
                    ? 'text-red-500 dark:text-red-400'
                    : log.type === 'update'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                [{log.type.toUpperCase()}]
              </span>
            </div>

            <!-- Message -->
            <div
              class="mt-1 sm:mt-0 text-sm text-neutral-800 dark:text-neutral-200 font-mono break-words leading-snug"
            >
              {log.msg}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>