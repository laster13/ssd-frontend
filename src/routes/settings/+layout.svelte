<script lang="ts">
    import Header from '$lib/components/header.svelte';
    import { page } from '$app/stores';
    import { Database, User, Tv, Grid, Link as LinkIcon, Save } from 'lucide-svelte';

    type SettingItem = {
        name: string;
        path: string;
        icon: typeof Database;
    };

    const settingsItems: SettingItem[] = [
        { name: 'Import de données', path: '/settings/test', icon: Database },
        { name: 'Informations personnelles', path: '/settings/seedbox', icon: User },
        { name: 'Medias Servers', path: '/settings/mediaserver', icon: Tv },
        { name: 'Applications', path: '/settings/applications', icon: Grid },
        { name: 'Symlinks', path: '/settings/symlinks', icon: LinkIcon },
        { name: 'Sauvegarde', path: '/settings/sauvegarde', icon: Save },
        { name: 'Mise à Jour', path: '/settings/update', icon: Save }
    ];
</script>

<svelte:head>
    <title>Settings</title>
</svelte:head>

<!-- Header fixe -->
<div class="fixed top-0 left-0 w-full z-50">
    <Header />
</div>

<!-- Contenu principal -->
<div class="pt-24 px-4 md:px-16 lg:px-32">

    <!-- 🖥️ Desktop pills -->
    <div class="hidden lg:flex gap-3 mb-6 text-sm font-medium">
        {#each settingsItems as item}
            <a
                href={item.path}
                class={`flex items-center gap-2 rounded-full px-5 py-2 border transition-all duration-300
                    ${item.path === $page.url.pathname
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg scale-[1.03]'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-gray-700 hover:text-emerald-700 dark:hover:text-white hover:shadow-md hover:scale-[1.02]'}`}
            >
                <svelte:component this={item.icon} class="w-4 h-4" />
                {item.name}
            </a>
        {/each}
    </div>

    <slot />
</div>
