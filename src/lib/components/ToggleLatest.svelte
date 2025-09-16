<script lang="ts">
  import { Sparkles, FolderOpen } from "lucide-svelte";
  import { activeFilter } from "$lib/stores/symlinks";

  export let label: string = "Derniers symlinks";
</script>

<button
  type="button"
  class="inline-flex items-center gap-3 px-4 py-2 rounded-lg border
         border-indigo-200 dark:border-indigo-700 
         bg-indigo-50 dark:bg-indigo-900/40 shadow-sm
         hover:shadow-md transition-all duration-300
         cursor-pointer w-full"
  on:click={() => activeFilter.set($activeFilter === 'latest' ? 'none' : 'latest')}
>
  <!-- Switch -->
  <label class="relative inline-flex items-center cursor-pointer select-none">
    <input type="checkbox" checked={$activeFilter === 'latest'} class="sr-only peer" />

    <!-- Track -->
    <div
      class="w-12 h-6 rounded-full transition-all duration-500
             bg-gradient-to-r from-gray-200 to-gray-400 
             dark:from-gray-700 dark:to-gray-900
             peer-checked:from-pink-500 peer-checked:via-purple-500 peer-checked:to-indigo-500
             shadow-inner peer-checked:shadow-[0_0_8px_rgba(236,72,153,0.5)]"
    ></div>

    <!-- Thumb -->
    <div
      class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full 
             bg-white dark:bg-gray-100 flex items-center justify-center
             transition-all duration-500 ease-in-out
             peer-checked:translate-x-6 peer-checked:rotate-[360deg]
             shadow-md group-hover:scale-110"
    >
      {#if $activeFilter === 'latest'}
        <Sparkles class="w-3.5 h-3.5 text-indigo-600 animate-pulse-slow" />
      {:else}
        <FolderOpen class="w-3.5 h-3.5 text-gray-500" />
      {/if}
    </div>
  </label>

  <!-- Texte -->
  <span
    class="text-sm font-medium tracking-wide 
           bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 
           dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400
           bg-clip-text text-transparent"
  >
    {label}
  </span>
</button>
