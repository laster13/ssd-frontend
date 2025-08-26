<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { Cpu, MemoryStick, Hash, Globe, Loader2, Play, Square, RotateCcw } from "lucide-svelte";
  import { browser } from '$app/environment';

  let containers: any[] = [];
  let loading = true;
  let error = '';
  let loadingId: string | null = null;
  let currentAction: 'start' | 'stop' | 'restart' | null = null;
  let intervalId: any;
  let domainMap: Record<string, string> = {};

  // 🔹 Stats système
  let systemCpu = 0;
  let systemMem = 0;

  // 🔹 Capteurs
  let cpuTemp: number | null = null;
  let nvmeTemp: number | null = null;
  let fanRpm: number | null = null;
  let systemDisk = { percent: 0, used: 0, total: 0 };
  let systemUptime = "";
  let systemLoad = { "1m": 0, "5m": 0, "15m": 0 };
  let systemNetwork = { sent_mb: 0, recv_mb: 0 };
  let systemDiskIO = { read_mb: 0, write_mb: 0 };
  let statsDisk = { percent: 0, used: 0, total: 0 };
  let prevNetwork = { sent_mb: 0, recv_mb: 0 };
  let prevDiskIO = { read_mb: 0, write_mb: 0 };
  let systemNetworkRate = { up: 0, down: 0 };
  let systemDiskIORate = { read: 0, write: 0 };

  // ⚡ Intervalle de rafraîchissement
  const intervalSeconds = 2;
  const networkMax = 100; // MB/s -> barre pleine si 100 MB/s
  const ioMax = 50;       // MB/s -> barre pleine si 50 MB/s

  async function loadContainers() {
    try {
      // Domaines
      const resDomains = await fetch('/api/v1/scripts/domains');
      if (!resDomains.ok) throw new Error('Erreur chargement domaines');
      domainMap = await resDomains.json();

      // Conteneurs
      const res = await fetch('/api/v1/docker/containers');
      if (!res.ok) throw new Error('Erreur réseau');
      const data = await res.json();

      containers = [];
      for (const c of data) {
        const matchedDomain = domainMap[c.name] || null;
        containers = [...containers, { ...c, domain: matchedDomain }];
        await tick();
      }

      // Stats système
      const resStats = await fetch('/api/v1/docker/stats');
      if (resStats.ok) {
        const stats = await resStats.json();
        systemCpu = stats.cpu;
        systemMem = stats.memory.percent;
        systemDisk = stats.disk;
        systemUptime = stats.uptime;
        systemLoad = stats.load;
        systemNetwork = stats.network;
        systemDiskIO = stats.disk_io;

        // Réseau → vitesse (MB/s)
        if (stats.network) {
          systemNetworkRate = {
            up: (stats.network.sent_mb - prevNetwork.sent_mb) / intervalSeconds,
            down: (stats.network.recv_mb - prevNetwork.recv_mb) / intervalSeconds
          };
          prevNetwork = stats.network;
        }

        // Disk I/O → vitesse (MB/s)
        if (stats.disk_io) {
          systemDiskIORate = {
            read: (stats.disk_io.read_mb - prevDiskIO.read_mb) / intervalSeconds,
            write: (stats.disk_io.write_mb - prevDiskIO.write_mb) / intervalSeconds
          };
          prevDiskIO = stats.disk_io;
        }
      }

      // Capteurs
      const resSensors = await fetch('/api/v1/docker/sensors');
      if (resSensors.ok) {
        const sensors = await resSensors.json();

        const cpuEntry = sensors.temperatures?.find((t: any) =>
          t.chip === "coretemp" && t.label.includes("Package")
        );
        cpuTemp = cpuEntry ? cpuEntry.temp : null;

        const nvmeEntry = sensors.temperatures?.find((t: any) =>
          t.chip === "nvme" && t.label.includes("Composite")
        );
        nvmeTemp = nvmeEntry ? nvmeEntry.temp : null;

        const fanEntry = sensors.fans?.find((f: any) =>
          f.chip === "thinkpad" && f.label === "fan"
        );
        fanRpm = fanEntry ? fanEntry.rpm : null;
      }

      error = '';
    } catch (e) {
      error = 'Impossible de charger les conteneurs.';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function sendAction(id: string, action: 'start' | 'stop' | 'restart') {
    loadingId = id;
    currentAction = action;
    try {
      const res = await fetch('/api/v1/docker/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      if (!res.ok) throw new Error('Erreur action');
    } catch (e) {
      console.error(e);
      alert(`Erreur lors de ${action} ${id}`);
    } finally {
      loadingId = null;
      currentAction = null;
      await loadContainers();
    }
  }

  // Formatage tailles disque
  function formatSize(mb: number): string {
    if (!mb) return "0 Mo";
    const gb = mb / 1024;
    const tb = gb / 1024;
    if (tb >= 1) return `${tb.toFixed(2)} To`;
    return `${gb.toFixed(2)} Go`;
  }

  // Formatage vitesse (réseau / I/O)
  function formatRate(value: number): string {
    if (value < 1) return `${(value * 1024).toFixed(1)} KB/s`;
    if (value < 1024) return `${value.toFixed(2)} MB/s`;
    return `${(value / 1024).toFixed(2)} GB/s`;
  }

  // Couleur barre
  function percentColor(value: number): string {
    if (value < 50) return "from-green-400 to-emerald-500";
    if (value < 80) return "from-yellow-400 to-amber-500";
    return "from-red-500 to-pink-600";
  }

  onMount(() => {
    if (!browser) return;
    loadContainers();
    intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadContainers();
      }
    }, intervalSeconds * 1000);
  });

  onDestroy(() => {
    if (!browser) return;
    clearInterval(intervalId);
  });
</script>

<!-- =================== HEADER =================== -->
<div class="px-6 pt-28 pb-12">
  <h1 class="text-3xl font-normal text-center mb-8">
    📡 <span class="text-transparent bg-clip-text 
                 bg-gradient-to-r from-red-600 via-orange-500 via-yellow-400 to-green-500">
      Dashboard
    </span>
  </h1>

  <!-- =================== ANNEAUX =================== -->
  <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-8 mb-12">

    <!-- Conteneurs -->
    <!-- % Actifs -->
    <div class="flex flex-col items-center justify-center">
      <div class="relative w-24 h-24">
        <svg class="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" stroke-width="10%" 
                  class="text-zinc-200 dark:text-zinc-700" fill="transparent" />
          <circle cx="50%" cy="50%" r="40%" stroke-width="10%" stroke="url(#grad2)" stroke-linecap="round"
                  stroke-dasharray="251"
                  stroke-dashoffset={251 - (251 * (containers.filter(c => c.status && c.status.includes('Up')).length * 100 / (containers.length || 1)) / 100)} 
                  fill="transparent" class="transition-all duration-700" />
          <defs>
            <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#22c55e" />
              <stop offset="100%" stop-color="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs font-bold">
            {Math.round(containers.filter(c => c.status && c.status.includes('Up')).length * 100 / (containers.length || 1))}%
          </span>
        </div>
      </div>
      <p class="mt-2 text-sm font-medium">Actifs</p>
    </div>

    <!-- CPU système -->
    <div class="flex flex-col items-center justify-center">
      <div class="relative w-24 h-24">
        <svg class="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" stroke-width="10%"
                  class="text-zinc-200 dark:text-zinc-700" fill="transparent" />
          <circle cx="50%" cy="50%" r="40%" stroke-width="10%" stroke="url(#grad3)" stroke-linecap="round"
                  stroke-dasharray="251" stroke-dashoffset={251 - (251 * systemCpu / 100)} 
                  fill="transparent" class="transition-all duration-700" />
          <defs>
            <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#f97316" />
              <stop offset="100%" stop-color="#facc15" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs font-bold">{systemCpu}%</span>
        </div>
      </div>
      <p class="mt-2 text-sm font-medium">Utilisation CPU</p>
    </div>

    <!-- Mémoire système -->
    <div class="flex flex-col items-center justify-center">
      <div class="relative w-24 h-24">
        <svg class="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" stroke-width="10%"
                  class="text-zinc-200 dark:text-zinc-700" fill="transparent" />
          <circle cx="50%" cy="50%" r="40%" stroke-width="10%" stroke="url(#grad4)" stroke-linecap="round"
                  stroke-dasharray="251" stroke-dashoffset={251 - (251 * systemMem / 100)} 
                  fill="transparent" class="transition-all duration-700" />
          <defs>
            <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ec4899" />
              <stop offset="100%" stop-color="#f43f5e" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs font-bold">{systemMem}%</span>
        </div>
      </div>
      <p class="mt-2 text-sm font-medium">Utilisation RAM</p>
    </div>

    <!-- Temp CPU -->
    <div class="flex flex-col items-center justify-center">
      <div class="relative w-24 h-24">
        <svg class="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" stroke-width="10%"
                  class="text-zinc-200 dark:text-zinc-700" fill="transparent" />
          <circle cx="50%" cy="50%" r="40%" stroke-width="10%" stroke="url(#grad5)" stroke-linecap="round"
                  stroke-dasharray="251" stroke-dashoffset={251 - (251 * (cpuTemp || 0) / 100)} 
                  fill="transparent" class="transition-all duration-700" />
          <defs>
            <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ef4444" />
              <stop offset="100%" stop-color="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs font-bold">{cpuTemp ? `${cpuTemp}°C` : 'N/A'}</span>
        </div>
      </div>
      <p class="mt-2 text-sm font-medium">CPU Temp</p>
    </div>

    <!-- Temp NVMe -->
    <div class="flex flex-col items-center justify-center">
      <div class="relative w-24 h-24">
        <svg class="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" stroke-width="10%"
                  class="text-zinc-200 dark:text-zinc-700" fill="transparent" />
          <circle cx="50%" cy="50%" r="40%" stroke-width="10%" stroke="url(#grad6)" stroke-linecap="round"
                  stroke-dasharray="251" stroke-dashoffset={251 - (251 * (nvmeTemp || 0) / 100)} 
                  fill="transparent" class="transition-all duration-700" />
          <defs>
            <linearGradient id="grad6" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs font-bold">{nvmeTemp ? `${nvmeTemp}°C` : 'N/A'}</span>
        </div>
      </div>
      <p class="mt-2 text-sm font-medium">NVMe Temp</p>
    </div>

    <!-- Ventilateur -->
    <div class="flex flex-col items-center justify-center">
      <div class="relative w-24 h-24">
        <svg class="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r="40%" stroke="currentColor" stroke-width="10%"
                  class="text-zinc-200 dark:text-zinc-700" fill="transparent" />
          <circle cx="50%" cy="50%" r="40%" stroke-width="10%" stroke="url(#grad7)" stroke-linecap="round"
                  stroke-dasharray="251" stroke-dashoffset={fanRpm ? 251 - (251 * Math.min(fanRpm / 6000, 1)) : 251} 
                  fill="transparent" class="transition-all duration-700" />
          <defs>
            <linearGradient id="grad7" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#22c55e" />
              <stop offset="100%" stop-color="#84cc16" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xs font-bold">{fanRpm ? `${fanRpm} RPM` : 'N/A'}</span>
        </div>
      </div>
      <p class="mt-2 text-sm font-medium">Ventilateur</p>
    </div>
  </div>


  <!-- =================== CARD ULTRA PREMIUM SYSTÈME =================== -->
  <div class="max-w-xl mx-auto">
    <div
      class="rounded-3xl bg-gradient-to-br from-zinc-50 via-white to-zinc-100 
             dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 
             p-6 sm:p-8 shadow-xl border border-zinc-200/60 dark:border-zinc-700/60 
             transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl 
             text-[0.65rem] sm:text-[0.75rem]">

      <!-- Titre stylisé -->
      <h1 class="text-2xl font-normal text-center mb-6">
        ⚙️ <span class="text-transparent bg-clip-text 
                     bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500">
          Système
        </span>
      </h1>

      <div class="flex flex-col gap-5 text-zinc-800 dark:text-zinc-200">

        <!-- Disque -->
        {#if systemDisk}
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-6 h-6 flex items-center justify-center rounded-full 
                          bg-emerald-100 dark:bg-emerald-900/40 
                          text-emerald-600 dark:text-emerald-400">
                💽
              </div>
              <div>
                <p class="uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Disque</p>
                <p class="font-semibold">
                  {systemDisk.percent}% — {systemDisk.used} Go / {systemDisk.total} Go
                </p>
              </div>
            </div>
            <!-- Barre premium -->
            <div class="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                class={`h-2 rounded-full bg-gradient-to-r ${percentColor(systemDisk.percent)} transition-all duration-700`}
                style="width: {systemDisk.percent}%">
              </div>
            </div>
          </div>
        {/if}

        <!-- Charge système -->
        {#if systemLoad}
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-6 h-6 flex items-center justify-center rounded-full 
                          bg-sky-100 dark:bg-sky-900/40 
                          text-sky-600 dark:text-sky-400">
                📈
              </div>
              <div>
                <p class="uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Charge</p>
                <p class="font-semibold">
                  1m: {systemLoad["1m"]} | 5m: {systemLoad["5m"]} | 15m: {systemLoad["15m"]}
                </p>
              </div>
            </div>
            <!-- Barre premium -->
            <div class="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                class="h-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-700"
                style="width: {Math.min(systemLoad["1m"] * 25,100)}%">
              </div>
            </div>
          </div>
        {/if}

        <!-- Réseau -->
        {#if systemNetworkRate}
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-6 h-6 flex items-center justify-center rounded-full 
                          bg-yellow-100 dark:bg-yellow-900/40 
                          text-yellow-600 dark:text-yellow-400">
                🌐
              </div>
              <div>
                <p class="uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Réseau</p>
                <p class="font-semibold">
                  ⬆ {formatRate(systemNetworkRate.up)} | ⬇ {formatRate(systemNetworkRate.down)}
                </p>
              </div>
            </div>
            <!-- Barre premium -->
            <div class="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                class="h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-700"
                style="width: {Math.min((systemNetworkRate.up / networkMax) * 100, 100)}%">
              </div>
            </div>
          </div>
        {/if}

        <!-- Disk I/O -->
        {#if systemDiskIORate}
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-6 h-6 flex items-center justify-center rounded-full 
                          bg-purple-100 dark:bg-purple-900/40 
                          text-purple-600 dark:text-purple-400">
                📀
              </div>
              <div>
                <p class="uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Disk I/O</p>
                <p class="font-semibold">
                  Lecture {formatRate(systemDiskIORate.read)} | Écriture {formatRate(systemDiskIORate.write)}
                </p>
              </div>
            </div>
            <!-- Barre premium -->
            <div class="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                class="h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 transition-all duration-700"
                style="width: {Math.min((systemDiskIORate.write / ioMax) * 100, 100)}%">
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- =================== CARDS =================== -->
<div class="px-6 pb-12">
  {#if loading}
    <p class="text-zinc-700 dark:text-white animate-pulse">Chargement…</p>
  {:else if error}
    <p class="text-red-500">{error}</p>
  {:else if containers.length === 0}
    <p class="text-zinc-700 dark:text-white">Aucun conteneur trouvé.</p>
  {:else}
    <div class="grid gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
      {#each containers as c}
        {@const isRunning = c.status && c.status.includes('Up')}
        <div class="rounded-2xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md 
                    p-5 shadow-md hover:shadow-xl border border-zinc-200/40 
                    dark:border-zinc-700/50 transition-all duration-300 
                    hover:scale-[1.02] flex flex-col justify-between">

          <!-- Header -->
          <div>
            <h3 class="text-base font-semibold mb-2 
                       bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-200 
                       bg-clip-text text-transparent truncate">
              {#if c.domain}
                <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" 
                   class="hover:underline">{c.name}</a>
              {:else}
                {c.name}
              {/if}
            </h3>

            <div class="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              <p class="flex items-center gap-2"><Hash class="w-4 h-4 text-zinc-500" /> ID: {c.id}</p>
              <p class="flex items-center gap-2"><Cpu class="w-4 h-4 text-orange-500" /> CPU: {c.cpu}</p>
              <p class="flex items-center gap-2"><MemoryStick class="w-4 h-4 text-amber-500" /> RAM: {c.mem}</p>
              {#if c.domain}
                <p class="flex items-center gap-2 mt-1"><Globe class="w-4 h-4 text-yellow-500" /> {c.domain}</p>
              {/if}
            </div>

            <p class="flex items-center gap-2 mt-4">
              <span class={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 shadow-green-400 shadow-md animate-pulse' : 'bg-red-500 shadow-red-400 shadow-md'}`}></span>
              <span class="text-sm font-medium">{c.status}</span>
            </p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 flex-wrap mt-6">
            <!-- Restart -->
            <button 
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium 
                     bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md 
                     hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50"
              disabled={loadingId === c.id} 
              on:click={() => sendAction(c.id, 'restart')}>
              {#if loadingId === c.id && currentAction === 'restart'}
                <Loader2 class="w-4 h-4 animate-spin" /> Redémarrage…
              {:else}
                <RotateCcw class="w-4 h-4" /> Redémarrer
              {/if}
            </button>

            <!-- Start -->
            {#if !isRunning}
              <button 
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium 
                       bg-gradient-to-r from-green-500 to-emerald-400 text-white shadow-md 
                       hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50"
                disabled={loadingId === c.id} 
                on:click={() => sendAction(c.id, 'start')}>
                {#if loadingId === c.id && currentAction === 'start'}
                  <Loader2 class="w-4 h-4 animate-spin" /> Démarrage…
                {:else}
                  <Play class="w-4 h-4" /> Démarrer
                {/if}
              </button>
            {/if}

            <!-- Stop -->
            {#if isRunning}
              <button 
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium 
                       bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md 
                       hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50"
                disabled={loadingId === c.id} 
                on:click={() => sendAction(c.id, 'stop')}>
                {#if loadingId === c.id && currentAction === 'stop'}
                  <Loader2 class="w-4 h-4 animate-spin" /> Arrêt…
                {:else}
                  <Square class="w-4 h-4" /> Arrêter
                {/if}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
