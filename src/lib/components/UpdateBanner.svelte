<script lang="ts">
    import { updateNotification } from '$lib/stores/symlinks';
    import { fade, fly } from 'svelte/transition';
    import { goto } from '$app/navigation';

    const BASE_URL = '';

    function openUpdatePage() {
        goto(`${BASE_URL}/settings/update`);
    }

    function getUpdateTitle(type: string) {
        if (type === 'backend') {
            return 'Mise à jour BACKEND disponible';
        }

        if (type === 'frontend') {
            return 'Mise à jour FRONTEND disponible';
        }

        if (type === 'saison_frontend') {
            return 'Mise à jour SAISON FRONTEND disponible';
        }

        if (type === 'error') {
            return 'Erreur de mise à jour';
        }

        return 'Mise à jour disponible';
    }
</script>

{#if $updateNotification?.type}
    <div
        role="button"
        tabindex="0"
        on:click={openUpdatePage}
        on:keypress={(e) => e.key === 'Enter' && openUpdatePage()}
        in:fly={{ y: 30, duration: 400 }}
        out:fade={{ duration: 300 }}
        class="fixed bottom-6 right-6 z-[1000] flex items-center gap-3 px-4 py-3
               rounded-xl shadow-lg backdrop-blur-xl border cursor-pointer
               bg-white/80 border-amber-200 text-amber-700
               dark:bg-neutral-900/90 dark:border-amber-600/30 dark:text-amber-300
               transition-all duration-300 hover:shadow-amber-300/20 hover:-translate-y-0.5
               focus:outline-none focus:ring-2 focus:ring-amber-400
               max-w-xs sm:max-w-sm"
        title="Aller à la page de mise à jour"
    >
        <div
            class="flex items-center justify-center w-8 h-8 rounded-lg
                   bg-gradient-to-br from-amber-400 to-orange-500
                   text-white shadow-sm dark:shadow-amber-800/20"
        >
            🔔
        </div>

        <div class="flex flex-col">
            <span class="text-xs font-semibold tracking-wide leading-tight">
                {getUpdateTitle($updateNotification.type)}
            </span>

            <span class="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 leading-snug">
                {$updateNotification.message}
            </span>

            {#if $updateNotification.version}
                <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                    Version : {$updateNotification.version}
                </span>
            {/if}
        </div>
    </div>
{/if}