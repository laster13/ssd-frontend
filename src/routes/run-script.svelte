<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	export let scriptName: string;
	export let label: string | null = null;
	export let showLogs: boolean;

	let statusMessage = '';
	let logs: string[] = [];
	let backendUrl: string = import.meta.env.VITE_BACKEND_URL; // Valeur par défaut pour SSR

	const dispatch = createEventDispatcher();

	function runScript() {
		console.log('Lancement du script:', scriptName, label ? `avec label: ${label}` : "sans label");
		logs = [];

		dispatch('buttonStateChange', { isSubmitting: true, showSpinner: true });

		const url = label
			? `${backendUrl}/api/v1/scripts/run/${scriptName}?label=${encodeURIComponent(label)}`
			: `${backendUrl}/api/v1/scripts/run/${scriptName}`;

		console.log('URL générée :', url);

		const eventSource = new EventSource(url);

		eventSource.onmessage = (event) => {
			console.log("Log reçu : ", event.data);
			logs = [event.data, ...logs].slice(0, 20);
			statusMessage = "En cours de traitement......";
			dispatch('statusMessageUpdate', { statusMessage });
		};

		eventSource.onerror = (error) => {
			console.error("Erreur de connexion à EventSource :", error);
			toast.error("Erreur lors de l'exécution du script.");
			statusMessage = "Erreur lors de l'exécution du script.";
			dispatch('statusMessageUpdate', { statusMessage });
			eventSource.close();
			dispatch('buttonStateChange', { isSubmitting: false, showSpinner: false });
		};

		eventSource.addEventListener("end", () => {
			toast.success("Opération terminée avec succès");
			statusMessage = '';
			dispatch('buttonStateChange', { isSubmitting: false, showSpinner: false });
			dispatch('statusMessageUpdate', { statusMessage });
			dispatch('scriptCompleted');
			eventSource.close();
		});
	}

	onMount(() => {
		// ✅ Détection du protocole uniquement côté client
		if (typeof window !== 'undefined') {
			backendUrl = window.location.protocol === 'https:'
				? import.meta.env.VITE_BACKEND_URL_HTTPS
				: import.meta.env.VITE_BACKEND_URL_HTTP;

			window.addEventListener('startScript', (event: CustomEvent) => {
				console.log('Événement startScript capté avec:', event.detail.scriptName);
				scriptName = event.detail.scriptName;
				label = event.detail.label || null;
				console.log('Valeur de selectedItem.label captée dans RunScript:', label);
				if (scriptName) {
					runScript();
				}
			});
		}
	});
</script>

{#if showLogs}
<pre class="text-xs">{logs.join("\n")}</pre>
{/if}
