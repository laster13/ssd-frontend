<script lang="ts">
	import { statLabels } from "$lib/stores/movies";
	import { setCategory, details } from "$lib/stores/movies";

	export let cat: string;

	$: count = $details[cat]?.length ?? 0;
</script>

<button
	class={`p-4 rounded-lg border border-border hover:scale-105 hover:shadow-lg transition w-full text-left bg-gradient-to-br ${statLabels[cat].bgGradient}`}
	on:click={() => setCategory(cat)}
>
	<div class={`text-xl font-semibold ${statLabels[cat].color}`}>{count}</div>

	<div class="text-sm mt-1 flex items-center gap-1 text-muted-foreground">
		<span>{statLabels[cat].icon}</span>
		<span>{statLabels[cat].label}</span>
	</div>

	<p class="text-xs mt-1 text-muted-foreground italic">{statLabels[cat].desc}</p>
</button>
