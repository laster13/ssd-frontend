<script lang="ts">
    import { updateNotification } from '$lib/stores/symlinks';
    import { fade, fly } from 'svelte/transition';
</script>

{#if $updateNotification?.type}
    <div
        in:fly={{ y: 30, duration: 400 }}
        out:fade={{ duration: 300 }}
        class="fixed bottom-6 right-6 z-[1000] flex items-center gap-3 px-4 py-3
               rounded-xl shadow-lg backdrop-blur-xl border
               bg-white/80 border-amber-200 text-amber-700
               dark:bg-neutral-900/90 dark:border-amber-600/30 dark:text-amber-300
               transition-all duration-300 hover:shadow-amber-300/20 hover:-translate-y-0.5
               max-w-xs sm:max-w-sm"
    >
        <!-- Icône -->
        <div
            class="flex items-center justify-center w-8 h-8 rounded-lg
                   bg-gradient-to-br from-amber-400 to-orange-500
                   text-white shadow-sm dark:shadow-amber-800/20"
        >
            🔔
        </div>

        <!-- Texte -->
        <div class="flex flex-col">
            <span class="text-xs font-semibold tracking-wide leading-tight">
                {$updateNotification.type === 'backend'
                    ? 'Mise à jour BACKEND disponible'
                    : 'Mise à jour FRONTEND disponible'}
            </span>
            <span class="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 leading-snug">
                {$updateNotification.message}
            </span>
        </div>
    </div>
{/if}
