<script lang="ts">
	import { Film, RefreshCcw, ZoomIn } from "lucide-svelte";

	import {
		loadingScanOnly,
		loadingScanFull,
		runScan,
		runScanOnly
	} from "$lib/stores/movies";

	export let dryRun = false;
</script>

<header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
	<div class="mx-auto max-w-7xl px-4 py-4 flex justify-between items-center">

		<!-- TITLE LEFT -->
        <div class="flex items-center gap-3">
            <div class="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-pink-500 to-rose-500 shadow">
                <Film class="h-5 w-5 text-white" />
            </div>
            <div class="text-2xl font-semibold">
                <span class="text-foreground">Conformité</span>
                <span class="text-pink-400"> Plex + Radarr</span>
            </div>
        </div>

		<!-- BUTTONS -->
		<div class="flex gap-3 items-center">

			<!-- SCAN-ONLY -->
			<button
				class="group relative flex items-center gap-2 px-5 py-2.5 rounded-2xl
				bg-gradient-to-r from-purple-600 via-violet-500 to-fuchsia-500 text-white text-sm font-semibold shadow-xl"
				on:click={runScanOnly}
				disabled={$loadingScanOnly || $loadingScanFull}
			>
				{#if $loadingScanOnly}
					<RefreshCcw class="w-4 h-4 animate-spin" />
					<span>Scan-only...</span>
				{:else}
					<ZoomIn class="w-4 h-4" />
					<span>Scan-only</span>
				{/if}
			</button>

			<!-- SCAN COMPLET -->
			<button
				class="group relative flex items-center gap-2 px-5 py-2.5 rounded-2xl
				bg-gradient-to-r from-pink-600 via-rose-500 to-red-500 text-white text-sm font-semibold shadow-xl"
				on:click={() => runScan(dryRun)}
				disabled={$loadingScanOnly || $loadingScanFull}
			>
				{#if $loadingScanFull}
					<RefreshCcw class="w-4 h-4 animate-spin" />
					<span>Analyse en cours...</span>
				{:else}
					<RefreshCcw class="w-4 h-4" />
					<span>Correction complete</span>
				{/if}
			</button>

		</div>

	</div>
</header>
