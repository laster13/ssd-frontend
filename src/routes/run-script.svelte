<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';

	export let scriptName: string;
	export let label: string | null = null;
	export let showLogs: boolean;

	let statusMessage = '';
	let logs: { id: number; text: string }[] = [];
	let logId = 0;
	let logsBox: HTMLPreElement;
	let backendUrl: string = import.meta.env.VITE_BACKEND_URL;

	const dispatch = createEventDispatcher();

	function runScript() {
		console.log('Lancement du script:', scriptName, label ? `avec label: ${label}` : "sans label");
		logs = [];
		logId = 0;

		dispatch('buttonStateChange', { isSubmitting: true, showSpinner: true });

		const url = label
			? `${backendUrl}/api/v1/scripts/run/${scriptName}?label=${encodeURIComponent(label)}`
			: `${backendUrl}/api/v1/scripts/run/${scriptName}`;

		console.log('URL générée :', url);

		const eventSource = new EventSource(url);

		eventSource.onmessage = async (event) => {
			console.log("Log reçu : ", event.data);
			logs = [...logs, { id: ++logId, text: event.data }].slice(-200);
			statusMessage = "En cours de traitement......";
			dispatch('statusMessageUpdate', { statusMessage });

			await tick();
			logsBox.scrollTop = logsBox.scrollHeight;
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
		if (typeof window !== 'undefined') {
			backendUrl = window.location.protocol === 'https:'
				? import.meta.env.VITE_BACKEND_URL_HTTPS
				: import.meta.env.VITE_BACKEND_URL_HTTP;

			window.addEventListener('startScript', (event: CustomEvent) => {
				console.log('Événement startScript capté avec:', event.detail.scriptName);
				scriptName = event.detail.scriptName;
				label = event.detail.label || null;
				if (scriptName) {
					runScript();
				}
			});
		}
	});
</script>

{#if showLogs}
<pre class="logs-terminal" bind:this={logsBox}>
	{#each logs as log (log.id)}
		<div class="log-line">{log.text}</div>
	{/each}
</pre>
{/if}

<style>
	.logs-terminal {
		background: transparent;
		padding: 1rem;
		max-height: 50vh;
		overflow-y: auto;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		color: #00d3ff;
		text-shadow: 0 0 3px #00d3ff;
		line-height: 1.4;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		width: 100%;
		box-sizing: border-box;
	}

	@media (prefers-color-scheme: light) {
		.logs-terminal {
			color: #009fc9;
			text-shadow: none;
		}
	}

	.log-line {
		opacity: 0;
		animation: slideIn 0.45s ease forwards;
		white-space: pre-wrap;
		word-break: break-word;
		font-weight: normal;
	}

	@keyframes slideIn {
		0% {
			opacity: 0;
			transform: translateY(15px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
