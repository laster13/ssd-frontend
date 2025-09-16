<script lang="ts">
  import type { ComponentType } from "svelte";

  export let label: string;
  export let icon: ComponentType | null = null;
  export let color:
    | "blue"
    | "red"
    | "gray"
    | "emerald"
    | "yellow"
    | "purple" = "gray";

  export let fullWidth: boolean = false;
  export let truncate: boolean = false;

  // États
  export let loading: boolean = false;
  export let success: boolean = false;
  export let disabled: boolean = false;

  // Icônes optionnelles
  export let loadingIcon: ComponentType | null = null;
  export let successIcon: ComponentType | null = null;

  // Event
  export let onClick: (() => void) | null = null;

  // Mapping vers tes anciennes classes utilitaires
  const colorClasses = {
    blue: "btn btn-blue",
    red: "btn btn-red-deep",
    gray: "btn btn-gray",
    emerald: "btn btn-emerald-deep",
    yellow: "btn btn-yellow-deep",
    purple: "btn bg-purple-600 hover:bg-purple-700 text-white"
  };
</script>

<button
  class={`${colorClasses[color]} 
          ${fullWidth ? "w-full" : ""} 
          ${truncate ? "truncate" : ""}`}
  on:click={() => onClick && onClick()}
  disabled={disabled || loading}
>
  {#if loading && loadingIcon}
    <svelte:component this={loadingIcon} class="w-4 h-4 animate-spin" />
    <span>Chargement...</span>
  {:else if success && successIcon}
    <svelte:component this={successIcon} class="w-4 h-4" />
    <span>Succès !</span>
  {:else}
    {#if icon}
      <svelte:component this={icon} class="w-4 h-4" />
    {/if}
    <span>{label}</span>
    <slot />
  {/if}
</button>

<style>
  .btn {
    @apply inline-flex items-center gap-2 justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none;
  }

  .btn-blue {
    @apply bg-blue-500 hover:bg-blue-600 text-white focus-visible:ring-blue-300;
  }

  .btn-gray {
    @apply bg-gray-500 hover:bg-gray-600 text-white focus-visible:ring-gray-300;
  }

  .btn-emerald-deep {
    @apply bg-emerald-700 hover:bg-emerald-800 text-white focus-visible:ring-emerald-500;
  }

  .btn-red-deep {
    @apply bg-red-700 hover:bg-red-800 text-white focus-visible:ring-red-500;
  }

  .btn-yellow-deep {
    @apply bg-yellow-500 hover:bg-yellow-600 text-white focus-visible:ring-yellow-300;
  }

  .animate-pulse-strong {
    animation: pulseStrong 1.5s infinite;
  }

  @keyframes pulseStrong {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.85;
    }
  }
</style>
