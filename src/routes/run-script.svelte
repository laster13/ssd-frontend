<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { browser } from '$app/environment';

  export let scriptName: string;
  export let label: string | null = null;
  export let showLogs: boolean;

  let statusMessage = '';
  let logs: { id: number; text: string }[] = [];
  let logId = 0;
  let logsBox: HTMLPreElement;
  let eventSource: EventSource | null = null;

  const dispatch = createEventDispatcher();

  function buildScriptUrl(script: string, appLabel: string | null) {
    const params = new URLSearchParams();

    if (appLabel) {
      params.set('label', appLabel);
    }

    const query = params.toString();

    return `/api/v1/scripts/run/${encodeURIComponent(script)}${query ? `?${query}` : ''}`;
  }

  function closeEventSource() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function finishScript(success: boolean, message: string) {
    if (success) {
      toast.success(message);
    } else {
      toast.error(message);
    }

    statusMessage = success ? '' : message;

    dispatch('buttonStateChange', {
      isSubmitting: false,
      showSpinner: false
    });

    dispatch('statusMessageUpdate', { statusMessage });

    if (success) {
      dispatch('scriptCompleted');
    }

    closeEventSource();
  }

  function runScript() {
    if (!scriptName) {
      toast.error('Aucun script à exécuter.');
      return;
    }

    closeEventSource();

    console.log(
      'Lancement du script:',
      scriptName,
      label ? `avec label: ${label}` : 'sans label'
    );

    logs = [];
    logId = 0;
    statusMessage = 'Démarrage du script...';

    dispatch('buttonStateChange', {
      isSubmitting: true,
      showSpinner: true
    });

    dispatch('statusMessageUpdate', { statusMessage });

    const url = buildScriptUrl(scriptName, label);

    console.log('URL générée :', url);

    eventSource = new EventSource(url);

    eventSource.onmessage = async (event) => {
      console.log('Log reçu :', event.data);

      logs = [...logs, { id: ++logId, text: event.data }].slice(-200);
      statusMessage = 'En cours de traitement...';

      dispatch('statusMessageUpdate', { statusMessage });

      await tick();

      if (logsBox) {
        logsBox.scrollTop = logsBox.scrollHeight;
      }
    };

    eventSource.onerror = (error) => {
      console.error('Erreur de connexion à EventSource :', error);

      finishScript(false, "Erreur lors de l'exécution du script.");
    };

    eventSource.addEventListener('end', () => {
      finishScript(true, 'Opération terminée avec succès');
    });
  }

  onMount(() => {
    if (!browser) return;

    const handler = (event: CustomEvent) => {
      console.log('Événement startScript capté avec:', event.detail.scriptName);

      scriptName = event.detail.scriptName;
      label = event.detail.label || null;

      runScript();
    };

    window.addEventListener('startScript', handler as EventListener);

    return () => {
      window.removeEventListener('startScript', handler as EventListener);
      closeEventSource();
    };
  });
</script>

{#if showLogs}
  <div class="mt-4 rounded-xl shadow-lg overflow-hidden bg-white dark:bg-black">
    <div class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
      <span class="w-3 h-3 rounded-full bg-red-500"></span>
      <span class="w-3 h-3 rounded-full bg-yellow-400"></span>
      <span class="w-3 h-3 rounded-full bg-green-500"></span>
      <p class="ml-3 text-sm text-gray-600 dark:text-gray-300 font-medium">
        Logs en temps réel
      </p>
    </div>

    <pre
      bind:this={logsBox}
      class="p-4 font-mono text-sm text-gray-700 dark:text-emerald-300 max-h-[50vh] overflow-y-auto space-y-1"
    >
      {#each logs as log (log.id)}
        <div class="animate-fadeIn">{log.text}</div>
      {/each}
    </pre>
  </div>
{/if}