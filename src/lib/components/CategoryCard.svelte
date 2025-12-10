<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let cat: string;
    export let labels: any;
    export let stats: any;

    const dispatch = createEventDispatcher();

    // Nombre d'items dans cette catégorie
    $: count = stats?.[cat] ?? 0;
</script>

<button
    class={`p-4 rounded-lg border border-border hover:scale-105 hover:shadow-lg transition w-full text-left
            bg-gradient-to-br ${labels[cat].bgGradient}`}
    on:click={() => dispatch("select", cat)}
>
    <div class={`text-xl font-semibold ${labels[cat].color}`}>
        {count}
    </div>

    <div class="text-sm mt-1 flex items-center gap-1 text-muted-foreground">
        <span>{labels[cat].icon}</span>
        <span>{labels[cat].label}</span>
    </div>

    <p class="text-xs mt-1 text-muted-foreground italic">
        {labels[cat].desc}
    </p>
</button>
