<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let page = 1;
  export let totalItems = 0;
  export let pageSize = 50;

  export let siblingCount: number | undefined = undefined;
  export let boundaryCount: number | undefined = undefined;
  export let showFirstLast = true;
  export let showQuickJumps = true;
  export let showJumpInput = true;

  const dispatch = createEventDispatcher();

  $: pages = Math.max(1, Math.ceil(totalItems / pageSize));

  $: windowCfg = chooseWindow(pages, siblingCount, boundaryCount);
  $: effSiblingCount = windowCfg.siblingCount;
  $: effBoundaryCount = windowCfg.boundaryCount;

  $: quickStep = Math.min(200, Math.max(10, Math.round(pages * 0.01)));

  $: hideNumbers = pages > 5000;

  $: segments = buildSegments(page, pages, effSiblingCount, effBoundaryCount);

  function chooseWindow(total: number, sib?: number, bnd?: number) {
    if (typeof sib === 'number' && typeof bnd === 'number') {
      return { siblingCount: clampInt(sib, 0, 5), boundaryCount: clampInt(bnd, 0, 5) };
    }
    if (total > 2000) return { siblingCount: 0, boundaryCount: 1 };
    if (total > 500)  return { siblingCount: 1, boundaryCount: 1 };
    if (total > 120)  return { siblingCount: 1, boundaryCount: 2 };
    return { siblingCount: 2, boundaryCount: 2 };
  }

  function clampInt(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function go(p: number) {
    if (p < 1 || p > pages || p === page) return;
    dispatch('changePage', p);
  }

  function buildSegments(
    current: number,
    total: number,
    siblings: number,
    boundaries: number
  ): Array<number | '…'> {
    if (total <= 1) return [1];

    const start = range(1, Math.min(boundaries, total));
    const end = range(Math.max(total - boundaries + 1, 1), total);

    const left = Math.max(current - siblings, boundaries + 1);
    const right = Math.min(current + siblings, total - boundaries);

    const middle = left <= right ? range(left, right) : [];

    const showLeftDots = left > boundaries + 1;
    const showRightDots = right < total - boundaries;

    const out: Array<number | '…'> = [...start];
    if (showLeftDots) out.push('…');
    out.push(...middle);
    if (showRightDots) out.push('…');
    for (const p of end) if (!out.includes(p)) out.push(p);
    return out;
  }

  function range(a: number, b: number): number[] {
    const r: number[] = [];
    for (let i = a; i <= b; i++) r.push(i);
    return r;
  }

  let jumpVal = '';
  function onJump(e: Event) {
    e.preventDefault();
    const n = parseInt(jumpVal, 10);
    if (!Number.isFinite(n)) return;
    go(Math.min(pages, Math.max(1, n)));
    jumpVal = '';
  }
</script>

<nav class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between select-none" aria-label="Pagination">
  <div class="sm:hidden text-sm opacity-80">
    Page {page} / {pages}
  </div>

  <div class="flex items-center gap-1">
    {#if showFirstLast}
      <button
        class="btn-page"
        on:click={() => go(1)}
        disabled={page === 1}
        aria-label="Première"
        title="Première"
      >
        «
      </button>
    {/if}

    <button
      class="btn-page"
      on:click={() => go(page - 1)}
      disabled={page === 1}
      aria-label="Page précédente"
      title="Page précédente"
    >
      ‹
    </button>

    {#if !hideNumbers}
      <div class="hidden sm:flex items-center gap-1">
        {#each segments as item}
          {#if item === '…'}
            <span class="px-2 text-sm opacity-70">…</span>
          {:else}
            <button
              class={item === page ? 'btn-page-active' : 'btn-page'}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Aller à la page ${item}`}
              title={`Aller à la page ${item}`}
              on:click={() => go(item)}
            >
              {item}
            </button>
          {/if}
        {/each}
      </div>
    {/if}

    <button
      class="btn-page"
      on:click={() => go(page + 1)}
      disabled={page === pages}
      aria-label="Page suivante"
      title="Page suivante"
    >
      ›
    </button>

    {#if showFirstLast}
      <button
        class="btn-page"
        on:click={() => go(pages)}
        disabled={page === pages}
        aria-label="Dernière"
        title="Dernière"
      >
        »
      </button>
    {/if}

    {#if showQuickJumps}
      <div class="ml-2 hidden md:flex items-center gap-1">
        <button
          class="btn-quick"
          on:click={() => go(Math.max(1, page - quickStep))}
          aria-label={`Reculer de ${quickStep} pages`}
        >
          -{quickStep}
        </button>
        <button
          class="btn-quick"
          on:click={() => go(Math.min(pages, page + quickStep))}
          aria-label={`Avancer de ${quickStep} pages`}
        >
          +{quickStep}
        </button>
      </div>
    {/if}
  </div>

  {#if showJumpInput}
    <form class="flex items-center gap-2" on:submit|preventDefault={onJump}>
      <label for="jumpToPage" class="sr-only">Aller à</label>
      <input
        id="jumpToPage"
        name="jumpToPage"
        inputmode="numeric"
        pattern="[0-9]*"
        class="input-jump"
        bind:value={jumpVal}
        placeholder="n°"
        autocomplete="off"
      />
      <button
        class="btn-page"
        type="submit"
      >
        OK
      </button>
    </form>
  {/if}
</nav>

<style>
  .btn-page {
    @apply px-3 py-1.5 text-sm rounded border
           bg-white border-gray-300 text-gray-800 hover:bg-gray-100
           dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700
           disabled:opacity-50;
  }
  .btn-page-active {
    @apply px-3 py-1.5 text-sm rounded border
           bg-blue-500 border-blue-500 text-white hover:bg-blue-600
           dark:bg-teal-600 dark:border-teal-600 dark:text-white dark:hover:bg-teal-700;
  }
  .btn-quick {
    @apply px-2 py-1 text-xs rounded border
           bg-white border-gray-300 text-gray-800 hover:bg-gray-100
           dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700;
  }
  .input-jump {
    @apply w-20 px-2 py-1 text-sm rounded border
           bg-white border-gray-300 text-gray-800 placeholder-gray-400
           dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-500;
  }
</style>
