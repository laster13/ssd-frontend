<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import axios from 'axios';
  import { fly, fade, slide } from 'svelte/transition';
  import { Loader2, CheckCircle2, CalendarCheck2, Clock8, Dot } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import * as Form from '$lib/components/ui/form';

  const activeTab = writable<'medias' | 'docker'>('medias');

  // MÉDIAS
  const folders = writable<string[]>([]);
  const schedules = writable<Record<string, { day: string; hour: number }>>({});
  const editedSchedules = writable<Record<string, { day: string; hour: number }>>({});
  const loadingBackup = writable<Record<string, boolean>>({});
  const loadingSave = writable<Record<string, boolean>>({});
  const savedSuccess = writable<Record<string, boolean>>({});
  const collapsed = writable<Record<string, boolean>>({});
  const progress = writable<Record<string, number>>({});

  // DOCKER
  const containers = writable<string[]>([]);
  const selected = writable<string | null>(null);
  const dockerSchedules = writable<Record<string, { day: string; hour: number }>>({});
  const edited = writable<{ day: string; hour: number }>({ day: 'mon', hour: 0 });
  const saving = writable(false);
  const dockerProgress = writable<Record<string, number>>({});
  $: dockerProgressMap = $dockerProgress;
  const dockerSavedSuccess = writable<Record<string, boolean>>({});
  const dockerLoadingSave = writable<Record<string, boolean>>({});
  const dockerLoadingBackup = writable<Record<string, boolean>>({}); // ✅ ajouté


  const days = [
    { code: "mon", label: "Lundi" },
    { code: "tue", label: "Mardi" },
    { code: "wed", label: "Mercredi" },
    { code: "thu", label: "Jeudi" },
    { code: "fri", label: "Vendredi" },
    { code: "sat", label: "Samedi" },
    { code: "sun", label: "Dimanche" }
  ];

  // Reactive mappings
  $: allFolders = $folders;
  $: allSchedules = $schedules;
  $: allEdited = $editedSchedules;
  $: loadingBackupMap = $loadingBackup;
  $: loadingSaveMap = $loadingSave;
  $: savedMap = $savedSuccess;
  $: collapsedMap = $collapsed;
  $: progressMap = $progress;
  $: current = $selected;
  $: config = current ? $dockerSchedules[current] : null;
  $: dockerSavedMap = $dockerSavedSuccess;
  $: dockerLoadingSaveMap = $dockerLoadingSave;
  $: dockerLoadingMap = $dockerLoadingBackup; // ✅ mapping correct

axios.interceptors.request.use((config) => {
  console.log("[AXIOS]", config.method?.toUpperCase(), config.url);
  return config;
});

  // MÉDIAS functions
  function updateEditedDay(folder: string, day: string) {
    editedSchedules.update((edits) => ({ ...edits, [folder]: { ...edits[folder], day } }));
  }

  function updateEditedHour(folder: string, hour: number) {
    editedSchedules.update((edits) => ({ ...edits, [folder]: { ...edits[folder], hour } }));
  }

  function toggleCollapse(folder: string) {
    collapsed.update(c => ({ ...c, [folder]: !c[folder] }));
  }

  function hasSchedule(folder: string): boolean {
    return !!allSchedules[folder];
  }

  // DOCKER functions
  function updateDockerDay(name: string, day: string) {
    dockerSchedules.update(s => ({ ...s, [name]: { ...s[name], day } }));
  }

  function updateDockerHour(name: string, hour: number) {
    dockerSchedules.update(s => ({ ...s, [name]: { ...s[name], hour } }));
  }

  function handleSelect(name: string) {
    selected.set(name);
    const s = $dockerSchedules[name] || { day: 'mon', hour: 0 };
    edited.set(s);
  }

  async function fetchMediaData() {
    try {
      const foldersRes = await axios.get('/api/v1/media-backups/scan/');
      folders.set(foldersRes.data);
      const schedulesRes = await axios.get('/api/v1/media-backups/');
      schedules.set(schedulesRes.data);
      editedSchedules.set(JSON.parse(JSON.stringify(schedulesRes.data)));
    } catch (err) {
      toast.error("Erreur de chargement des données médias.");
    }
  }

  async function fetchDockerData() {
    try {
      const res = await axios.get('/api/v1/docker/scan/');
      containers.set(res.data);
      const sched = await axios.get('/api/v1/docker/');
      dockerSchedules.set(sched.data);
    } catch (err) {
      toast.error("Erreur de chargement des données Docker.");
    }
  }

  async function saveSchedule(name: string) {
    const config = allEdited[name];
    if (!config) return;
    try {
      loadingSave.update(l => ({ ...l, [name]: true }));
      await axios.post('/api/v1/media-backups/schedule/', {
        name,
        day: config.day,
        hour: config.hour
      });
      toast.success(`✅ Planification enregistrée pour ${name}`);
      savedSuccess.update(s => ({ ...s, [name]: true }));
      setTimeout(() => savedSuccess.update(s => ({ ...s, [name]: false })), 2500);
      fetchMediaData();
    } catch (err) {
      toast.error(`❌ Erreur lors de la planification de ${name}`);
    } finally {
      loadingSave.update(l => ({ ...l, [name]: false }));
    }
  }

  async function runBackup(name: string) {
    try {
      loadingBackup.update(l => ({ ...l, [name]: true }));
      progress.update(p => ({ ...p, [name]: 0 }));
      const interval = setInterval(() => {
        progress.update(p => ({ ...p, [name]: Math.min(100, (p[name] || 0) + 10) }));
      }, 300);
      await axios.post('/api/v1/media-backups/run/', { name });
      toast.success(`✅ Sauvegarde lancée pour ${name}`);
      clearInterval(interval);
      progress.update(p => ({ ...p, [name]: 100 }));
      setTimeout(() => progress.update(p => ({ ...p, [name]: 0 })), 2000);
    } catch (err) {
      toast.error(`❌ Erreur lors de la sauvegarde de ${name}`);
    } finally {
      loadingBackup.update(l => ({ ...l, [name]: false }));
    }
  }

async function runDockerBackup(name: string) {
  dockerLoadingBackup.update(l => ({ ...l, [name]: true }));
  dockerProgress.update(p => ({ ...p, [name]: 0 }));

  const interval = setInterval(() => {
    dockerProgress.update(p => ({
      ...p,
      [name]: Math.min(100, (p[name] || 0) + 10)
    }));
  }, 250);

  try {
    await axios.post('/api/v1/docker/run/', { name });
    toast.success(`✅ Sauvegarde lancée pour ${name}`);
  } catch {
    toast.error("Erreur lors de la sauvegarde docker");
  } finally {
    clearInterval(interval);
    dockerProgress.update(p => ({ ...p, [name]: 100 }));
    setTimeout(() => {
      dockerProgress.update(p => ({ ...p, [name]: 0 }));
    }, 1500);
    dockerLoadingBackup.update(l => ({ ...l, [name]: false }));
  }
}

  async function saveDockerSchedule() {
    if (!current) return;
    saving.set(true);
    try {
      await axios.post('/api/v1/docker/schedule/', {
        name: current,
        day: $edited.day,
        hour: $edited.hour
      });
      toast.success(`✅ Planification enregistrée pour ${current}`);
      dockerSchedules.update(s => ({ ...s, [current]: { ...$edited } }));
      dockerSavedSuccess.update(s => ({ ...s, [current]: true }));
      setTimeout(() => dockerSavedSuccess.update(s => ({ ...s, [current]: false })), 2500);
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement docker");
    } finally {
      saving.set(false);
    }
  }

  async function saveExistingDockerSchedule(name: string) {
    dockerLoadingSave.update(s => ({ ...s, [name]: true }));
    try {
      const sched = $dockerSchedules[name];
      if (!sched || typeof sched.day === 'undefined' || typeof sched.hour === 'undefined') {
        toast.error("Configuration de planification invalide.");
        return;
      }

      await axios.post('/api/v1/docker/schedule/', {
        name,
        day: sched.day,
        hour: sched.hour
      });

      toast.success(`✅ Planification enregistrée pour ${name}`);
      dockerSavedSuccess.update(s => ({ ...s, [name]: true }));
      setTimeout(() => dockerSavedSuccess.update(s => ({ ...s, [name]: false })), 2500);
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement docker");
    } finally {
      dockerLoadingSave.update(s => ({ ...s, [name]: false }));
    }
  }

  async function deleteDockerSchedule(name: string) {
    try {
      await axios.delete(`/api/v1/docker/schedule/${encodeURIComponent(name)}/`);
      dockerSchedules.update(s => {
        const copy = { ...s };
        delete copy[name];
        return copy;
      });
      toast.success(`✅ Planification supprimée pour ${name}`);
    } catch (err) {
      toast.error(`Erreur lors de la suppression de la planification pour ${name}`);
    }
  }

  onMount(() => {
    fetchMediaData();
    fetchDockerData();
  });
</script>

<div class="p-6 space-y-6">
  <div class="flex flex-col sm:flex-row border-b border-gray-300 dark:border-zinc-700 gap-2 sm:gap-0">
    <button
      class="px-4 py-2 font-semibold text-indigo-600 dark:text-indigo-400 text-sm rounded-t sm:rounded-t-none sm:rounded-l hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors w-full sm:w-auto"
      class:font-bold={$activeTab === 'medias'}
      on:click={() => activeTab.set('medias')}
    >📁 Liens Symboliques</button>
    <button
      class="px-4 py-2 font-semibold text-indigo-600 dark:text-indigo-400 text-sm rounded-t sm:rounded-t-none sm:rounded-l hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors w-full sm:w-auto"
      class:font-bold={$activeTab === 'docker'}
      on:click={() => activeTab.set('docker')}
    >🐳 Applications Docker</button>
  </div>

  {#if $activeTab === 'medias'}
    <div class="p-6 space-y-6" transition:fade>
      <h2 class="text-xl font-semibold text-sky-600 dark:text-sky-400 mb-4">Planification des Sauvegardes de Liens Symboliques </h2>
      {#each allFolders as folder (folder)}
        <div class="border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4" in:fly={{ y: 20, duration: 300 }} out:fade>
          <div
            class="text-lg font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 cursor-pointer"
            role="button"
            tabindex="0"
            on:click={() => toggleCollapse(folder)}
            on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCollapse(folder)}
          >
            {folder}
            <Dot class={hasSchedule(folder) ? 'text-green-500' : 'text-red-500'} />
          </div>
          {#if !collapsedMap[folder]}
            <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between" transition:slide>
              <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <label for="day-{folder}">Jour :</label>
                <select id="day-{folder}" on:change={(e) => updateEditedDay(folder, e.target.value)} class="border rounded px-2 py-1 transition-all duration-200 hover:scale-[1.02]">
                  {#each days as dayObj}
                    <option value={dayObj.code} selected={dayObj.code === allEdited[folder]?.day}>{dayObj.label}</option>
                  {/each}
                </select>
                <label for="hour-{folder}">Heure :</label>
                <input id="hour-{folder}" type="number" min="0" max="23" value={allEdited[folder]?.hour} on:input={(e) => updateEditedHour(folder, parseInt(e.target.value))} class="border rounded px-2 py-1 w-20 transition-all duration-200 hover:scale-[1.02]" />
                <Form.Button on:click={() => saveSchedule(folder)} disabled={loadingSaveMap[folder]} size="sm" class="w-full sm:w-auto flex items-center gap-2 justify-center transition-all duration-200 hover:scale-[1.02]">
                  {#if loadingSaveMap[folder]}
                    <Loader2 class="h-4 w-4 animate-spin" />
                    <span class="text-sm">Enregistrement...</span>
                  {:else if savedMap[folder]}
                    <CheckCircle2 class="h-4 w-4 text-green-600" />
                    <span class="text-sm">Enregistré</span>
                  {:else}
                    💾 Enregistrer
                  {/if}
                </Form.Button>
              </div>
              <div class="flex flex-col gap-1 items-start">
                <Form.Button on:click={() => runBackup(folder)} disabled={loadingBackupMap[folder]} size="sm" class="w-full sm:w-auto flex items-center gap-2 justify-center transition-all duration-200 hover:scale-[1.02]">
                  {#if loadingBackupMap[folder]}
                    <Loader2 class="h-4 w-4 animate-spin" />
                    <span class="text-sm">Sauvegarde...</span>
                  {:else}
                    Sauvegarde manuelle
                  {/if}
                </Form.Button>
                {#if progressMap[folder] > 0 && progressMap[folder] < 100}
                  <div class="w-40 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 transition-all duration-300" style="width: {progressMap[folder]}%"></div>
                  </div>
                {/if}
              </div>
            </div>
            {#if allSchedules[folder]}
              <div class="text-sm text-gray-500 mt-2 flex items-center gap-2">
                <Clock8 class="w-4 h-4 text-gray-400" />
                Prochaine exécution : {days.find(d => d.code === allSchedules[folder].day)?.label || allSchedules[folder].day} à {allSchedules[folder].hour}h
                <CalendarCheck2 class="w-4 h-4 text-green-500" />
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {:else if $activeTab === 'docker'}
    <div class="p-6 space-y-6" transition:fade>
      <h2 class="text-xl font-semibold text-sky-600 dark:text-sky-400 mb-4">Planification des Sauvegardes Docker</h2>

      <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <label for="container-select" class="font-semibold text-emerald-600 dark:text-emerald-400">Conteneur :</label>
        <select
          id="container-select"
          on:change={(e) => handleSelect(e.target.value)}
          class="rounded-xl border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-700 dark:text-gray-100"
        >
          <option disabled selected value="">🐳 Sélectionner un conteneur</option>
          {#each $containers as name}
            <option value={name}>🐳 {name}</option>
          {/each}
        </select>
      </div>

      {#if current && !$dockerSchedules[current]}
        <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label for="edited-day">Jour :</label>
            <select id="edited-day" bind:value={$edited.day}>
              {#each days as d}
                <option value={d.code}>{d.label}</option>
              {/each}
            </select>
            <label for="edited-hour">Heure :</label>
            <input
              id="edited-hour"
              type="number"
              min="0"
              max="23"
              bind:value={$edited.hour}
              class="border rounded px-2 py-1 w-20 transition-all duration-200 hover:scale-[1.02]"
            />
            <Form.Button on:click={saveDockerSchedule} disabled={$saving} size="sm" class="w-full sm:w-auto flex items-center gap-2 justify-center transition-all duration-200 hover:scale-[1.02]">
              {#if $saving}
                <Loader2 class="h-4 w-4 animate-spin" />
                <span class="text-sm">Enregistrement...</span>
              {:else if dockerSavedSuccess[current]}
                <CheckCircle2 class="h-4 w-4 text-green-600" />
                <span class="text-sm">Enregistré</span>
              {:else}
                💾 Enregistrer
              {/if}
            </Form.Button>
          </div>
        </div>
      {/if}

      <h2 class="text-xl font-semibold text-sky-600 dark:text-sky-400">Conteneurs déjà planifiés</h2>
      {#each Object.keys($dockerSchedules) as name (name)}
        {#if $dockerSchedules[name]}
          <div class="border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4" in:fly={{ y: 20, duration: 300 }} out:fade>
            <div class="text-lg font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 cursor-pointer">
              {name}
              <Dot class="text-green-500" />
            </div>

            <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between" transition:slide>
              <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <label for="day-{name}">Jour :</label>
                <select
                  id="day-{name}"
                  bind:value={$dockerSchedules[name].day}
                  on:change={(e) => updateDockerDay(name, e.target.value)}
                  class="border rounded px-2 py-1"
                >
                  {#each days as d}
                    <option value={d.code}>{d.label}</option>
                  {/each}
                </select>

                <label for="hour-{name}">Heure :</label>
                <input
                  id="hour-{name}"
                  type="number"
                  min="0"
                  max="23"
                  bind:value={$dockerSchedules[name].hour}
                  on:input={(e) => updateDockerHour(name, parseInt(e.target.value))}
                  class="border rounded px-2 py-1 w-20"
                />

                <Form.Button
                  on:click={() => saveExistingDockerSchedule(name)}
                  disabled={dockerLoadingSaveMap[name]}
                  size="sm"
                  class="w-full sm:w-auto flex items-center gap-2"
                >
                  {#if dockerLoadingSaveMap[name]}
                    <Loader2 class="h-4 w-4 animate-spin" />
                    <span class="text-sm">Enregistrement...</span>
                  {:else if dockerSavedSuccess[name]}
                    <CheckCircle2 class="h-4 w-4 text-green-600" />
                    <span class="text-sm">Enregistré</span>
                  {:else}
                    📂 Sauvegarder
                  {/if}
                </Form.Button>

                <Form.Button
                  on:click={() => deleteDockerSchedule(name)}
                  variant="destructive"
                  size="sm"
                  class="w-full sm:w-auto flex items-center gap-2"
                >
                  🗑️ Supprimer
                </Form.Button>
              </div>

              <div class="flex flex-col gap-1 items-start">
                <Form.Button
                  on:click={() => runDockerBackup(name)}
                  disabled={dockerLoadingMap[name]}
                  size="sm"
                  class="w-full sm:w-auto flex items-center gap-2"
                >
                  {#if dockerLoadingMap[name]}
                    <Loader2 class="h-4 w-4 animate-spin" />
                    <span class="text-sm">Sauvegarde...</span>
                  {:else}
                    Sauvegarde manuelle
                  {/if}
                </Form.Button>

                {#if dockerProgressMap[name] > 0 && dockerProgressMap[name] < 100}
                  <div class="w-40 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-green-500 transition-all duration-300"
                      style="width: {dockerProgressMap[name]}%"
                    ></div>
                  </div>
                {/if}
              </div>
            </div>

            <div class="text-sm text-gray-500 mt-2 flex items-center gap-2">
              <Clock8 class="w-4 h-4 text-gray-400" />
              Prochaine exécution : {days.find(d => d.code === $dockerSchedules[name].day)?.label} à {$dockerSchedules[name].hour}h
              <CalendarCheck2 class="w-4 h-4 text-green-500" />
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  select, input {
    padding: 4px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
</style>
