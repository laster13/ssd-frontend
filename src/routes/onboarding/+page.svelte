<script lang="ts">
	// import type { PageData } from './$types';
	import { animate, stagger } from 'motion';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Plane, Rocket } from 'lucide-svelte';

	// export let data: PageData;

	let rootElement: HTMLElement;
	let inView = false;

	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					inView = true;
					animate(
						'.slide-up',
						{ opacity: [0, 1], y: [40, 0] },
						{ duration: 0.5, delay: stagger(0.1) }
					);
					// animate(Array.from(animateOpacity), { opacity: [0, 1] }, { duration: 0.5, delay: stagger(0.1) });
					// const sequence: any = [
					// 	['.slide-up', { opacity: [0, 1], y: [40, 0] }, { duration: 0.4, delay: stagger(0.1) }],
					// 	['.animate-opacity', { opacity: [0, 1] }, { duration: 0.4, delay: stagger(0.1) }]
					// ];
					// timeline(sequence, {});
					observer.unobserve(rootElement);
				}
			});
		});

		observer.observe(rootElement);

		return () => {
			observer.unobserve(rootElement);
		};
	});
</script>
<!DOCTYPE html>
<html lang="fr" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <title>SSDv2 Setup</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            animation: {
              "spin-slow": "spin 12s linear infinite",
            },
          },
        },
      };
    </script>
  </head>

  <body
    class="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 text-gray-900 dark:from-gray-950 dark:to-gray-900 dark:text-gray-100 transition-colors duration-500"
  >
    <!-- Card -->
    <div
      class="max-w-md w-full p-10 rounded-2xl shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center"
    >
      <!-- Logo moderne Network Graph -->
      <div class="mb-6 animate-spin-slow">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-20 h-20 text-gray-800 dark:text-gray-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle cx="12" cy="12" r="3" />
          <circle cx="4" cy="4" r="2" />
          <circle cx="20" cy="4" r="2" />
          <circle cx="4" cy="20" r="2" />
          <circle cx="20" cy="20" r="2" />
          <line x1="6" y1="4" x2="10" y2="10" />
          <line x1="18" y1="4" x2="14" y2="10" />
          <line x1="6" y1="20" x2="10" y2="14" />
          <line x1="18" y1="20" x2="14" y2="14" />
          <line x1="12" y1="9" x2="12" y2="15" />
        </svg>
      </div>

      <!-- Titre -->
      <h1
        class="text-4xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-red-500 via-orange-500 to-green-500 bg-clip-text text-transparent"
      >
        Bienvenue sur SSDv2
      </h1>

      <!-- Texte cool -->
      <p class="text-lg text-gray-700 dark:text-gray-300 mb-10">
        La puissance du réseau au service de votre seedbox.<br />
        Moderne. Sécurisée. Ultra performante.
      </p>

      <!-- CTA -->
      <a
        href="/onboarding/1"
        class="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 hover:from-green-600 hover:via-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition"
      >
        🚀 Lancer l’installation
      </a>
    </div>
  </body>
</html>
