<script lang="ts">
    import { ModeWatcher } from 'mode-watcher';
    import { Toaster } from '$lib/components/ui/sonner';
    import '../app.css';
    import { afterNavigate, beforeNavigate } from '$app/navigation';
    import NProgress from 'nprogress';
    import { setContext } from 'svelte';
    import { dev } from '$app/environment';
    import { writable, type Writable } from 'svelte/store';
    import UpdateBanner from '$lib/components/UpdateBanner.svelte'; // 🔔 bannière globale

    // ✅ NOUVEAU : onMount pour lancer le client d'update
    import { onMount } from 'svelte';
    // ✅ NOUVEAU : notre client global créé dans src/lib/updateClient.ts
    import { initUpdateClient } from '$lib/updateClient';

    const showMenu: Writable<boolean> = writable(false);

    setContext('formDebug', dev);
    setContext('showMenu', showMenu);

    beforeNavigate(() => {
        NProgress.start();
    });

    afterNavigate(() => {
        NProgress.done();
    });

    NProgress.configure({
        showSpinner: false
    });

    // ✅ NOUVEAU : on démarre l'écoute des mises à jour (SSE + /update/persistent)
    onMount(() => {
        // Protection au cas où côté SSR (optionnel, mais safe)
        if (typeof window !== 'undefined') {
            initUpdateClient();
        }
    });
</script>

<ModeWatcher track={true}></ModeWatcher>
<Toaster richColors closeButton />

<!-- 🔔 Bannière globale de mise à jour -->
<UpdateBanner />

<div class="bg-background font-primary font-medium">
    <slot />
</div>
