<script lang="ts">
	import { Info, FolderOpen, Edit3, Save, X, Trash2, RefreshCw, Search } from "lucide-svelte";

	import {
		renameItem,
		fixIMDB,
		deleteFromRadarr,
		reimportRadarr,
		itemAction
	} from "$lib/stores/movies";

	import { statLabels } from "$lib/stores/movies";

	export let item: any;
	export let category: string;

	let editing = false;
	let editedFolder = "";
	let editedFile = "";
	let previewPath = "";

	/* 🔥🔥 FIX CRITIQUE : sécurité totale contre undefined 🔥🔥 */
	const originalSafe = item?.original || item?.old || item?.new || "unknown";
	const safeId = originalSafe.replace(/[^a-zA-Z0-9]/g, "-");
	item.original = originalSafe;

	function startEdit() {
		editing = true;
		const parts = item.original.split("/");
		editedFolder = parts.at(-2);
		editedFile = parts.at(-1).replace(/\.[^.]+$/, "");
		updatePreview();
	}

	function updatePreview() {
		const base = item.original.split("/").slice(0, -2).join("/");
		previewPath = editedFolder && editedFile
			? `${base}/${editedFolder}/${editedFile}.mkv`
			: "";
	}

	async function save() {
		await renameItem(item.original, editedFolder, editedFile);
		editing = false;
	}
</script>

<div
	class={`relative rounded-xl border-l-4 ${statLabels[category].border} bg-gradient-to-r ${statLabels[category].bgGradient} shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all p-5`}
>
	<div class="flex items-start justify-between gap-3 relative z-10">

		<!-- LEFT CONTENT -->
		<div class="flex flex-col gap-2 w-full">
			
			<div class="flex items-center gap-2">
				<FolderOpen class="w-5 h-5 text-muted-foreground" />

				{#if editing}

					<div class="flex flex-col sm:flex-row gap-2 w-full">

						<!-- Dossier -->
						<div class="flex flex-col flex-1">
							<label for={`folder-${safeId}`} class="text-xs mb-1">📁 Dossier</label>
							<input
								id={`folder-${safeId}`}
								bind:value={editedFolder}
								on:input={updatePreview}
								class="px-2 py-1 text-sm border rounded-md"
							/>
						</div>

						<!-- Fichier -->
						<div class="flex flex-col flex-1">
							<label for={`file-${safeId}`} class="text-xs mb-1">🎞️ Fichier</label>
							<input
								id={`file-${safeId}`}
								bind:value={editedFile}
								on:input={updatePreview}
								class="px-2 py-1 text-sm border rounded-md"
							/>
						</div>

					</div>

					{#if previewPath}
						<div class="text-xs text-muted-foreground mt-1 italic">
							➡️ Nouveau chemin :
							<span class="font-mono text-foreground">{previewPath}</span>
						</div>
					{/if}

				{:else}

					<h4 class="font-semibold text-sm sm:text-base">
						{item.original.split("/").slice(-2).join("/")}
					</h4>

				{/if}
			</div>

			<!-- FULL PATH -->
			<div class="text-xs text-muted-foreground font-mono break-all mt-1">
				{item.original}
			</div>

			<!-- REASON -->
			{#if item.raison}
				<div class="flex items-center gap-1 text-xs italic text-muted-foreground mt-1">
					<Info class="w-3 h-3" /> {item.raison}
				</div>
			{/if}
		</div>

		<!-- ACTION BUTTONS -->
		<div class="flex gap-2 items-center">

			{#if editing}

				<button class="text-emerald-400 hover:text-emerald-600" on:click={save}>
					<Save class="w-4 h-4" />
				</button>

				<button class="text-gray-400 hover:text-gray-600" on:click={() => (editing = false)}>
					<X class="w-4 h-4" />
				</button>

			{:else}

				<button
					class="text-yellow-500 hover:text-yellow-600 disabled:opacity-50"
					on:click={() => fixIMDB(item.original)}
					disabled={$itemAction[item.original] === "imdb"}
					title="Rechercher IMDb ID"
				>
					{#if $itemAction[item.original] === "imdb"}
						<Search class="w-4 h-4 animate-spin" />
					{:else}
						<Search class="w-4 h-4" />
					{/if}
				</button>

				<button class="text-pink-400 hover:text-pink-600" on:click={startEdit} title="Éditer">
					<Edit3 class="w-4 h-4" />
				</button>

				<button
					class="text-rose-400 hover:text-rose-600 disabled:opacity-50"
					on:click={() => deleteFromRadarr(item.original)}
					disabled={$itemAction[item.original] === "delete"}
					title="Supprimer de Radarr"
				>
					{#if $itemAction[item.original] === "delete"}
						<Trash2 class="w-4 h-4 animate-spin" />
					{:else}
						<Trash2 class="w-4 h-4" />
					{/if}
				</button>

				<button
					class="text-blue-400 hover:text-blue-600 disabled:opacity-50"
					on:click={() => reimportRadarr(item.original)}
					disabled={$itemAction[item.original] === "import"}
					title="Réimporter dans Radarr"
				>
					{#if $itemAction[item.original] === "import"}
						<RefreshCw class="w-4 h-4 animate-spin" />
					{:else}
						<RefreshCw class="w-4 h-4" />
					{/if}
				</button>

			{/if}
		</div>
	</div>
</div>
