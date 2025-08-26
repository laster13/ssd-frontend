<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { browser } from '$app/environment';

  export let scriptName: string;
  export let label: string | null = null;
  export let showLogs: boolean;

  let backendUrl: string = "";   // défini au mount
  let statusMessage = '';
  let logs: { id: number; text: string }[] = [];
  let logId = 0;
  let logsBox: HTMLPreElement;

  const dispatch = createEventDispatcher();

  function runScript() {
    console.log(
      'Lancement du script:',
      scriptName,
      label ? `avec label: ${label}` : "sans label"
    );

    logs = [];
    logId = 0;

    dispatch('buttonStateChange', { isSubmitting: true, showSpinner: true });

    const url = label
      ? `${backendUrl}/api/v1/scripts/run/${scriptName}?label=${encodeURIComponent(label)}`
      : `${backendUrl}/api/v1/scripts/run/${scriptName}`;

    console.log('URL générée :', url);

    const eventSource = new EventSource(url);

    eventSource.onmessage = async (event) => {
      console.log("Log reçu :", event.data);
      logs = [...logs, { id: ++logId, text: event.data }].slice(-200);
      statusMessage = "En cours de traitement...";
      dispatch('statusMessageUpdate', { statusMessage });

      await tick();

      // ✅ Protection contre logsBox undefined
      if (logsBox) {
        logsBox.scrollTop = logsBox.scrollHeight;
      }
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
    if (!browser) return;

    backendUrl = window.location.protocol === "https:"
      ? import.meta.env.VITE_BACKEND_URL_HTTPS
      : import.meta.env.VITE_BACKEND_URL_HTTP;

    // ✅ handler unique pour capter l’événement déclencheur
    const handler = (event: CustomEvent) => {
      console.log('Événement startScript capté avec:', event.detail.scriptName);
      scriptName = event.detail.scriptName;
      label = event.detail.label || null;
      if (scriptName) {
        runScript();
      }
    };

    window.addEventListener('startScript', handler);

    // 🔑 nettoyage pour éviter les doublons
    return () => {
      window.removeEventListener('startScript', handler);
    };
  });
</script>

{#if showLogs}
  <div class="mt-4 rounded-xl shadow-lg overflow-hidden bg-white dark:bg-black">
    <!-- Barre d’en-tête style terminal -->
    <div class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
      <span class="w-3 h-3 rounded-full bg-red-500"></span>
      <span class="w-3 h-3 rounded-full bg-yellow-400"></span>
      <span class="w-3 h-3 rounded-full bg-green-500"></span>
      <p class="ml-3 text-sm text-gray-600 dark:text-gray-300 font-medium">
        Logs en temps réel
      </p>
    </div>

    <!-- Zone de logs -->
    <pre
      bind:this={logsBox}
      class="p-4 font-mono text-sm text-gray-700 dark:text-emerald-300 
             max-h-[50vh] overflow-y-auto space-y-1"
    >
      {#each logs as log (log.id)}
        <div class="animate-fadeIn">{log.text}</div>
      {/each}
    </pre>
  </div>
{/if}
