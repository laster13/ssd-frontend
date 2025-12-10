<script lang="ts">
    import { Film, RefreshCcw, ZoomIn } from "lucide-svelte";

    // props
    export let dryRun = false;
    export let mode: "movies" | "series" = "movies";

    // états de chargement passés depuis la page
    export let loadingOnly = false;
    export let loadingFull = false;

    // callbacks passés depuis la page
    export let onScanOnly: () => void;
    export let onScanFull: (dryRun: boolean) => void;
</script>

<header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
    <div
        class="mx-auto max-w-7xl px-4 py-3 sm:py-4
               flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >

        <!-- TITLE LEFT -->
        <div class="flex items-center gap-3">
            <div
                class="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center
                       rounded-md bg-gradient-to-br from-pink-500 to-rose-500 shadow"
            >
                <Film class="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div class="text-xl sm:text-2xl font-semibold leading-tight">
                <span class="text-foreground block sm:inline">Conformité</span>
                <span class="text-pink-400 block sm:inline sm:ml-1">
                    {mode === "movies" ? " Plex + Radarr" : " Plex + Sonarr"}
                </span>
            </div>
        </div>

        <!-- BUTTONS -->
        <div
            class="flex flex-col sm:flex-row gap-2 sm:gap-3
                   items-stretch sm:items-center w-full sm:w-auto"
        >
            <!-- SCAN-ONLY -->
            <button
                type="button"
                class="group relative flex items-center justify-center gap-2
                       px-4 sm:px-5 py-2.5 rounded-2xl w-full sm:w-auto
                       bg-gradient-to-r from-purple-600 via-violet-500 to-fuchsia-500
                       text-white text-sm sm:text-[0.9rem] font-semibold shadow-xl
                       disabled:opacity-60 disabled:cursor-not-allowed"
                on:click={onScanOnly}
                disabled={loadingOnly || loadingFull}
            >
                {#if loadingOnly}
                    <RefreshCcw class="w-4 h-4 animate-spin" />
                    <span>Scan-only...</span>
                {:else}
                    <ZoomIn class="w-4 h-4" />
                    <span>Scan-only</span>
                {/if}
            </button>

            <!-- SCAN COMPLET -->
            <button
                type="button"
                class="group relative flex items-center justify-center gap-2
                       px-4 sm:px-5 py-2.5 rounded-2xl w-full sm:w-auto
                       bg-gradient-to-r from-pink-600 via-rose-500 to-red-500
                       text-white text-sm sm:text-[0.9rem] font-semibold shadow-xl
                       disabled:opacity-60 disabled:cursor-not-allowed"
                on:click={() => onScanFull(dryRun)}
                disabled={loadingOnly || loadingFull}
            >
                {#if loadingFull}
                    <RefreshCcw class="w-4 h-4 animate-spin" />
                    <span>Analyse en cours...</span>
                {:else}
                    <RefreshCcw class="w-4 h-4" />
                    <span>Correction complète</span>
                {/if}
            </button>
        </div>

    </div>
</header>
