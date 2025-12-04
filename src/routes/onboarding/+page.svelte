<script lang="ts">
	import { animate, stagger } from 'motion';
	import { onMount } from 'svelte';

	let rootElement: HTMLElement;

	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					// Animation Motion One
					animate(
						'.slide-up',
						{ opacity: [0, 1], y: [40, 0] },
						{ duration: 0.5, delay: stagger(0.1) }
					);

					observer.unobserve(rootElement);
				}
			}
		});

		observer.observe(rootElement);
	});
</script>

<!-- Le style global Tailwind se configure dans tailwind.config.js ou app.html -->

<div
	bind:this={rootElement}
	class="min-h-screen w-full flex items-center justify-center 
	bg-gradient-to-br from-gray-50 to-gray-200 text-gray-900
	dark:from-gray-950 dark:to-gray-900 dark:text-gray-100"
>

	<!-- Card centrale -->
	<div
		class="max-w-md w-full p-10 rounded-2xl shadow-xl bg-white/80 
		dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 
		dark:border-gray-700 flex flex-col items-center text-center"
	>

		<!-- Logo animé -->
		<div class="mb-6 animate-spin-slow slide-up">
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

		<!-- titre -->
		<h1
			class="text-4xl font-extrabold tracking-tight mb-6 
			bg-gradient-to-r from-red-500 via-orange-500 to-green-500 
			bg-clip-text text-transparent slide-up"
		>
			Bienvenue sur SSDv2
		</h1>

		<!-- Texte -->
		<p class="text-lg text-gray-700 dark:text-gray-300 mb-10 slide-up">
			La puissance du réseau au service de votre seedbox.<br />
			Moderne. Sécurisée. Ultra performante.
		</p>

		<!-- CTA -->
		<a
			href="/onboarding/1"
			class="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl 
			bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 
			hover:from-green-600 hover:via-emerald-600 hover:to-teal-700 
			text-white font-semibold shadow-lg shadow-emerald-500/30 transition slide-up"
		>
			🚀 Lancer l’installation
		</a>
	</div>
</div>

<style>
	/* Animation slow spin (équivalent de ton tailwind.config.js inline) */
	@keyframes spin-slow {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
	.animate-spin-slow {
		animation: spin-slow 12s linear infinite;
	}
</style>
