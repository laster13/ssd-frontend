<script>
  import { onMount } from 'svelte';
  import { Folder, Check } from 'lucide-svelte';

  export let startPath = '/home/maman/Medias';
  export let onSelect = () => {};

  let folders = [];
  let selected = new Set();
  let loading = false;

  async function load() {
    loading = true;
    try {
      const res = await fetch('/api/v1/symlinks/fs');
      const data = res.ok ? await res.json() : {};
      folders = data.folders || [];
    } catch (err) {
      folders = [];
    } finally {
      loading = false;
    }
  }

  function toggleSelect(folderName) {
    const absPath = `${startPath}/${folderName}`.replace(/\/+/g, '/');
    selected.has(absPath) ? selected.delete(absPath) : selected.add(absPath);
    selected = new Set(selected);
  }

  function confirmSelection() {
    if (selected.size > 0) onSelect(Array.from(selected));
  }

  onMount(load);
</script>

<div class="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl space-y-6 max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-700 transition-colors">

  <div class="flex items-center justify-between">
    <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">📂 Sélectionnez un ou plusieurs dossiers</h2>
    <button type="button"
      class="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-3 py-2 rounded-md font-semibold shadow hover:scale-95 transition disabled:opacity-50"
      on:click={confirmSelection}
      disabled={selected.size === 0}>
      <Check class="w-4 h-4" /> Ajouter ({selected.size})
    </button>
  </div>

  {#if loading}
    <div class="text-center text-gray-500 py-6">Chargement...</div>
  {:else if folders.length === 0}
    <div class="text-center text-gray-400">Aucun dossier trouvé dans {startPath}</div>
  {:else}
    <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
      {#each folders as folder}
        <button
          type="button"
          class="flex items-center gap-3 p-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-100
                 bg-gray-50 dark:bg-gray-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition
                 {selected.has(`${startPath}/${folder.name}`) ? 'bg-violet-600 text-white border-violet-600' : ''}"
          on:click={() => toggleSelect(folder.name)}
        >
          <Folder class="w-5 h-5"/>
          <span class="truncate flex-1">{folder.name}</span>
          {#if selected.has(`${startPath}/${folder.name}`)} <Check class="w-4 h-4"/> {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
