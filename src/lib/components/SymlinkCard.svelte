<script lang="ts">
  import { Loader2, CheckCircle2, Trash2 } from "lucide-svelte";
  import { deleting, deleteSuccess } from "$lib/stores/symlinks";

  export let item: any;
  export let onOpenPopup: (item: any) => void;
  export let onOpenArr: (item: any) => void;
  export let onDelete: (item: any) => void;

  // 🕒 Formatage safe d'une datetime ISO Python (avec microsecondes)
  function formatDateTime(iso: string | null | undefined): string {
    if (!iso || typeof iso !== "string") return "";

    // On vire la partie microsecondes si présente (".123456")
    const [datePart, rest] = iso.split("T");
    if (!rest) return iso;

    const timePart = rest.split(".")[0]; // "09:29:09.175265" -> "09:29:09"

    const [year, month, day] = datePart.split("-");
    if (!year || !month || !day) return iso;

    return `${day}/${month}/${year} ${timePart}`;
  }
</script>

<div
  role="button"
  tabindex="0"
  class="cursor-pointer relative p-5 rounded-2xl bg-white dark:bg-gray-800 
         border border-gray-200 dark:border-gray-700
         shadow-md hover:shadow-lg transition-transform duration-200 hover:-translate-y-0.5"
  on:click={() => onOpenPopup(item)}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenPopup(item)}
>
  <!-- Header -->
  <p class="text-sm font-bold font-mono text-gray-900 dark:text-gray-50 break-all">
    {item.symlink}
  </p>
  <p class="mt-1 text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
    ↳ {item.target}
  </p>

  {#if item.created_at}
    <p class="mt-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
      📅 Ajouté le {formatDateTime(item.created_at)}
    </p>
  {/if}

  <!-- Footer -->
  <div class="mt-3 flex flex-wrap gap-3 items-center justify-between">
    <div class="flex flex-wrap gap-3 items-center">
      <span
        class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-xs
               {item.ref_count === 0
                 ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300 border border-red-300 dark:border-red-600'
                 : 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300 border border-green-300 dark:border-green-600'}"
      >
        {item.ref_count === 0 ? '⚠' : '✔'} Ref Count: {item.ref_count}
      </span>

      {#if item.type && ['radarr', 'sonarr'].includes(item.type.toLowerCase())}
        <button
          on:click|stopPropagation={() => onOpenArr(item)}
          class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-xs
                 bg-emerald-100 text-emerald-700 
                 dark:bg-emerald-800 dark:text-emerald-300 
                 border border-emerald-300 dark:border-emerald-600
                 hover:scale-105 transition-transform"
        >
          📦 {item.type.toLowerCase()}
        </button>
      {/if}
    </div>

    {#if item.ref_count === 0 || item.target_exists === false}
      <!-- Réparer -->
      <button
        on:click|stopPropagation={() => onDelete(item)}
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl shadow 
               bg-gradient-to-r from-slate-500 via-indigo-500 to-gray-600 
               text-white font-semibold text-sm tracking-wide
               hover:scale-105 hover:shadow-lg transition-all duration-300"
        disabled={$deleting[item.symlink]}
        aria-label="Réparer"
        title="Réparer"
      >
        {#if $deleting[item.symlink]}
          <Loader2 class="w-4 h-4 animate-spin text-white" />
          <span>Réparation...</span>
        {:else if $deleteSuccess[item.symlink]}
          <CheckCircle2 class="w-4 h-4 text-white" />
          <span>Réparé !</span>
        {:else}
          <span>🛠️</span>
          <span>Réparer</span>
        {/if}
      </button>
    {:else}
      <!-- Supprimer -->
      <button
        on:click|stopPropagation={() => onDelete(item)}
        class="p-1.5 rounded-full border border-red-400 text-red-500
               hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        disabled={$deleting[item.symlink]}
        aria-label="Supprimer"
        title="Supprimer"
      >
        {#if $deleting[item.symlink]}
          <Loader2 class="w-4 h-4 animate-spin" />
        {:else if $deleteSuccess[item.symlink]}
          <CheckCircle2 class="w-4 h-4 text-green-500" />
        {:else}
          <Trash2 class="w-4 h-4" />
        {/if}
      </button>
    {/if}
  </div>
</div>
