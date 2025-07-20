<script lang="ts">
    import Header from '$lib/components/header.svelte';
    import { Separator } from '$lib/components/ui/separator';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import clsx from 'clsx';

    // Icônes
    import { Database, User, Tv, Grid, Link as LinkIcon, Save } from 'lucide-svelte';

    let mobileMenu: HTMLDetailsElement;

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
        { name: 'Sauvegarde', path: '/settings/sauvegarde', icon: Save }
    ];
</script>

<svelte:head>
    <title>Settings</title>
</svelte:head>

<!-- ⬆️ Barre de navigation fixe -->
<div class="fixed top-0 left-0 w-full z-50">
    <Header />
</div>

<!-- ⬇️ Contenu principal -->
<div class="pt-24 px-4 md:px-16 lg:px-32">

    <!-- 🖥️ Menu Desktop -->
    <div class="hidden lg:flex gap-4 flex-wrap mb-6 text-sm font-medium">
        {#each settingsItems as item}
            <a
                href={item.path}
                class={`flex items-center gap-2 rounded-full px-5 py-2 border border-gray-300 dark:border-gray-600 shadow-md transition-all duration-300
                    ${item.path === $page.url.pathname
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg scale-[1.03]'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 hover:text-emerald-900 dark:hover:text-white hover:shadow-lg hover:scale-[1.02]'}`}
            >
                <svelte:component this={item.icon} class="w-4 h-4" />
                {item.name}
            </a>
        {/each}
    </div>

    <!-- 📱 Menu Mobile -->
    <details class="lg:hidden mb-6" bind:this={mobileMenu}>
        <summary
            class="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-lg shadow-sm cursor-pointer text-sm flex justify-between items-center hover:bg-gray-100 transition-all duration-300"
        >
            ☰ Interface de gestion
            <svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </summary>

        <div class="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md p-2 space-y-2 animate-fade-in">
            {#each settingsItems as item}
                <a
                    href={item.path}
                    on:click={() => mobileMenu.removeAttribute('open')}
                    class={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all duration-300
                        ${item.path === $page.url.pathname
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md scale-[1.02]'
                            : 'text-gray-800 dark:text-gray-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 hover:text-emerald-900 dark:hover:text-white hover:shadow-md hover:scale-[1.01]'}`}
                >
                    <svelte:component this={item.icon} class="w-4 h-4 shrink-0" />
                    {item.name}
                </a>
            {/each}
        </div>
    </details>

    <Separator class="mb-4 mt-2" />

    <slot />
</div>

<style>
    summary::-webkit-details-marker {
        display: none;
    }

    summary svg {
        transition: transform 0.3s ease;
    }

    details[open] summary svg {
        transform: rotate(180deg);
    }

    @keyframes fade-in {
        from {
            opacity: 0;
            transform: translateY(-5px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .animate-fade-in {
        animation: fade-in 0.3s ease-out;
    }
</style>
