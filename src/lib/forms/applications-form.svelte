<script lang="ts">
  import { slide } from 'svelte/transition';
  import { page } from '$app/stores';
  import { getContext, onMount, onDestroy } from 'svelte';
  import SuperDebug from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
  import * as Form from '$lib/components/ui/form';
  import { applicationsSettingsSchema, type ApplicationsSettingsSchema } from '$lib/forms/helpers';
  import { toast } from 'svelte-sonner';
  import { Toaster } from '$lib/components/ui/sonner';
  import TextField from '$lib/forms/components/text-field.svelte';
  import CheckboxField from './components/checkbox-field.svelte';
  import GroupCheckboxField from './components/group-checkbox-field.svelte';
  import ArrayField from '$lib/forms/components/array-field.svelte';
  import { Loader2, Trash2, Plus, RefreshCw } from 'lucide-svelte';
  import { Separator } from '$lib/components/ui/separator';
  import * as Combobox from "/src/plugins";
  import { Input } from '$lib/components/ui/input';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import RunScript from '../../routes/run-script.svelte'; 
  import { browser } from '$app/environment';
  import Portal from 'svelte-portal';
  import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';

  // ---------------------------
  // Props
  // ---------------------------
  export let data: SuperValidated<Infer<ApplicationsSettingsSchema>>;
  export let actionUrl: string = '?/default';
  export let scriptName: string = 'appli';

  // ---------------------------
  // State variables
  // ---------------------------
  let applications = [];
  let domaine = {};
  type Item = { id: number; label: string };

  let selectedItem: Item | null = null;
  let selectedApplication = '';

  let isSubmitting = false;
  let showSpinner = false;
  let statusMessage = '';
  let showLogs = false;

  // ---------------------------
  // SSR / Client guards
  // ---------------------------
  let isClient = false;
  let screenWidth = 1024; // valeur par défaut safe pour SSR

  let triggerEl: HTMLElement;
  let listEl: HTMLElement;
  let cleanup: (() => void) | null = null;

  // ---------------------------
  // Authentification (segmented control)
  // ---------------------------
  // Options disponibles
  const options = [
    { value: "basique", label: "Basique" },
    { value: "oauth", label: "OAuth" },
    { value: "authelia", label: "Authelia" },
    { value: "aucune", label: "Aucune" }
  ];

  let activeIndex = 0;

  function selectOption(opt, idx) {
    activeIndex = idx;
    formData.update(data => {
      data.authentification = { authappli: opt.value };
      return data;
    });
  }

  onMount(() => {
    isClient = true;

    const currentApp = selectedItem?.label || "traefik";
    const current = $formData.authentification?.[currentApp]?.toLowerCase?.();

    const idx = options.findIndex(o => o.value === current);
    activeIndex = idx >= 0 ? idx : 0;

    formData.update(data => {
      if (!data.authentification) data.authentification = {};
      if (!data.authentification[currentApp]) {
        data.authentification[currentApp] = options[activeIndex].value;
      }
      return data;
    });

    fetchServices();
    fetchApplications();
  });

  function initFloating() {
    if (!triggerEl || !listEl) return;

    cleanup?.();
    cleanup = autoUpdate(triggerEl, listEl, () => {
      computePosition(triggerEl, listEl, {
        middleware: [offset(8), flip(), shift({ padding: 8 })],
        placement: 'bottom-start'
      }).then(({ x, y }) => {
        Object.assign(listEl.style, {
          left: `${x}px`,
          top: `${y}px`
        });
      });
    });
  }

  onDestroy(() => cleanup?.());

  $: if (isClient && state?.isOpened && listEl) {
    initFloating();
  }

  // ---------------------------
  // Form
  // ---------------------------
  const formDebug: boolean = getContext('formDebug');

  const form = superForm(data, {
    validators: zodClient(applicationsSettingsSchema),
    dataType: "json",
    taintedMessage: false 
  });

  const { form: formData, enhance, message, delayed } = form;
  let fruits: Item[] = [];
  let input: HTMLInputElement | null = null;
  let items: { [itemId: string]: HTMLElement } = {};

  formData.domaine = typeof formData.domaine === 'object' && !Array.isArray(formData.domaine) ? formData.domaine : {};

  // ---------------------------
  // Fetch & Combobox
  // ---------------------------
  async function fetchServices() {
    try {
      const response = await fetch(`/settings/services.json?nocache=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to load');
      const jsonData = await response.json();
      fruits = jsonData.items || [{ id: 0, label: 'No items available' }];
      initializeCombobox();
    } catch {
      fruits = [{ id: 0, label: 'No items available' }];
      initializeCombobox();
    }
  }

  async function fetchApplications() {
    try {
      const response = await fetch(`/settings.json?nocache=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to load');
      const jsonData = await response.json();
      applications = jsonData.applications || [];
      if (applications.length > 0) {
        selectedApplication = applications[0].id;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des applications:', error);
    }
  }

  const config = Combobox.initConfig<Item>({
    toItemId: (item) => item.id,
    toItemInputValue: (item) => item.label,
  });

  let model = Combobox.init(config, {
    allItems: fruits,
    inputMode: { type: "search-mode", inputValue: "" },
    selectMode: { type: "single-select" },
  });

  function initializeCombobox() {
    model = Combobox.init(config, {
      allItems: fruits,
      inputMode: { type: "search-mode", inputValue: "" },
      selectMode: { type: "single-select" },
    });
  }

  $: state = Combobox.toState(config, model);

  const dispatch = (msg: Combobox.Msg<Item> | null) => {
    if (!msg) return;
    const output = Combobox.update(config, { msg, model }, []);
    model = output.model;

    Combobox.handleEffects(output, {
      focusInput: () => input?.focus(),
      scrollItemIntoView: (item) => items[item.id]?.scrollIntoView({ block: "nearest" }),
    });

    Combobox.handleEvents(output, {
      onSelectedItemsChanged() {
        selectedItem = model.selectedItems[0] || null;
      },
    });
  };

  const onKeydown = (event: KeyboardEvent) => {
    const msg = Combobox.keyToMsg<Item>(event.key);
    if (msg.shouldPreventDefault) event.preventDefault();
    dispatch(msg);
  };

  function resetCombobox() {
    selectedItem = null;
    selectedApplication = '';
    initializeCombobox();
  }

  function resetForm() {
    formData.update((data) => ({
      ...data,
      dossiers_on_item_type: [],
      // 👉 on garde la valeur existante, pas de forçage en "basique"
      authentification: { authappli: data.authentification?.authappli ?? "basique" },
      domaine: {},
    }));
    resetCombobox();
  }


  function handleSubmit(event: Event) {
    event.preventDefault();

    formData.update((data) => {
      if (typeof data.domaine === 'string') {
        try {
          data.domaine = JSON.parse(data.domaine);
        } catch {
          data.domaine = {};
        }
      }

      handleFormSuccess();

      return {
        ...data,
        dossiers_on_item_type: [],
        // 👉 on respecte la valeur choisie (aucune, basique, oauth, authelia)
        authentification: { authappli: data.authentification?.authappli ?? "basique" },
        domaine: {}
      };
    });
  }

  function handleFormSuccess() {
    const label = selectedItem?.label;
    if (!label) {
      toast.error("Aucune application sélectionnée. Veuillez sélectionner une application.");
      return;
    }

    // ⏱ tempo seulement pour l’event script
    setTimeout(() => {
      if (browser) {
        const scriptEvent = new CustomEvent("startScript", {
          detail: { scriptName, label }
        });
        window.dispatchEvent(scriptEvent);
      }
    }, 1000); // ajuste entre 100–500ms pour test
  }

  function updateButtonState(event: CustomEvent) {
    const { isSubmitting: submitting, showSpinner: spinner } = event.detail;
    isSubmitting = submitting;
    showSpinner = spinner;
  }

  function updateStatusMessage(event: CustomEvent) {
    statusMessage = event.detail.statusMessage;
  }

  function handleCheckboxChange(event: Event) {
    showLogs = (event.target as HTMLInputElement).checked;
  }
</script>

<!-- Formulaire pour la combobox -->
<form method="POST" action={actionUrl} use:enhance class="my-8 flex flex-col gap-2" on:submit={handleSubmit}>

<!-- Bloc Logs -->
<div
  class="card stack cursor-pointer select-none
         bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
         border border-gray-200 dark:border-gray-700 
         shadow-sm rounded-2xl p-5 mb-6
         transition hover:shadow-md"
  role="button"
  tabindex="0"
  aria-pressed={showLogs}
  on:click={() => showLogs = !showLogs}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showLogs = !showLogs)}
>
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
    <!-- Icône + Label + Description -->
    <div class="flex items-start gap-3">
      <div
        class="flex items-center justify-center w-9 h-9 rounded-xl 
               bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
      >
        📝
      </div>
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
          Afficher les logs
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Logs en temps réel
        </p>
      </div>
    </div>

    <!-- ✅ Toggle indépendant -->
    <div class="relative inline-flex items-center">
      <input
        type="checkbox"
        id="showLogs"
        bind:checked={showLogs}
        class="sr-only peer"
      />
      <div
        class="w-11 h-6 
               bg-amber-100 dark:bg-amber-900/30
               rounded-full peer 
               peer-focus:outline-none peer-focus:ring-2 
               peer-focus:ring-amber-400 dark:peer-focus:ring-amber-500 
               peer-checked:bg-amber-500 
               transition-colors duration-300"
      ></div>
      <span
        class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full 
               transition-transform duration-300 peer-checked:translate-x-5 shadow"
      ></span>
    </div>
  </div>
</div>

{#if !showLogs}

<!-- Bloc Authentification -->
<div
  class="card stack 
         bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
         border border-gray-200 dark:border-gray-700 
         shadow-md hover:shadow-lg transition-shadow
         rounded-2xl p-6 mb-6"
>
  <div class="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
    
    <!-- Icône + Label -->
    <div class="left w-full sm:w-48 shrink-0 flex items-start gap-3">
      <div
        class="flex items-center justify-center w-9 h-9 rounded-xl 
               bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
      >
        🔐
      </div>
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
          Authentification
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 sm:hidden">
          Choisissez la stratégie appliquée lors de l’installation.
        </p>
      </div>
    </div>

    <!-- Segmented control -->
    <div class="right flex-1 relative">
      <!-- ⚠️ Champ caché qui sera envoyé au serveur -->
      <input type="hidden" name="authappli" value={options[activeIndex].value} />

      <div class="relative flex flex-wrap sm:inline-flex bg-gray-100 dark:bg-gray-700 rounded-2xl p-1 w-full max-w-md gap-1 sm:gap-0">
        <!-- Slider animé -->
        <span class="hidden sm:block absolute h-8 rounded-xl bg-amber-500 transition-all duration-300 ease-out"
              style="width: calc(100% / {options.length}); transform: translateX({activeIndex * 100}%);"></span>

        {#each options as opt, idx}
          <button
            type="button"
            class="relative z-10 flex-1 text-sm px-3 py-1.5 rounded-xl transition-colors duration-200
                   {activeIndex === idx 
                     ? 'bg-amber-500 text-white font-semibold shadow-md sm:bg-transparent sm:text-white' 
                     : 'text-gray-700 dark:text-gray-300'}"
            on:click={() => selectOption(opt, idx)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
      <p class="hidden sm:block text-sm text-gray-500 dark:text-gray-400 mt-2">
        Choisissez la stratégie appliquée lors de l’installation.
      </p>
    </div>
  </div>
</div>

<!-- Bloc Applications -->
<div
  class="card stack 
         bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
         border border-gray-200 dark:border-gray-700 
         shadow-md hover:shadow-lg transition-shadow
         rounded-2xl p-6 mb-6"
>
  <div class="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
    
    <!-- Icône + Label -->
    <div class="left w-full sm:w-48 shrink-0 flex items-start gap-3">
      <div
        class="flex items-center justify-center w-9 h-9 rounded-xl 
               bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
      >
        📦
      </div>
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
          Applications
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 sm:hidden">
          Sélectionnez une application à installer.
        </p>
      </div>
    </div>

    <!-- Champ + dropdown -->
    <div class="right relative flex-1 max-w-sm">
      <input
        {...state?.aria.input}
        bind:this={input}
        value={state?.inputValue || ""}
        placeholder="Choisir Application"
        on:input={(e) => dispatch({ type: "inputted-value", inputValue: e.currentTarget.value })}
        on:focus={() => dispatch({ type: "focused-input" })}
        on:blur={() => dispatch({ type: "blurred-input" })}
        on:mousedown={() => dispatch({ type: "pressed-input" })}
        on:keydown={onKeydown}
        class="w-full h-11 px-4 rounded-xl border border-gray-300 bg-white text-gray-900 
               focus:border-teal-400 focus:ring-2 focus:ring-teal-300 focus:outline-none
               dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 
               dark:focus:border-teal-400 dark:focus:ring-teal-500"
      />
      {#if state?.isOpened}
        <ul
          {...state?.aria.itemList}
          class="absolute mt-2 w-full max-h-48 overflow-y-auto rounded-xl shadow-lg z-50 
                 bg-white text-gray-900 border border-gray-200 
                 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
        >
          {#if state?.renderItems.length === 0}
            <li class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Aucun résultat</li>
          {/if}

          {#each state?.renderItems as item, index}
            <li
              {...item.aria}
              role="option"
              aria-selected={item.status === "selected"}
              on:mousemove={() => dispatch({ type: "hovered-over-item", index })}
              on:mousedown|preventDefault={() => dispatch({ type: "pressed-item", item: item.item })}
              class="px-4 py-2 cursor-pointer text-sm rounded-lg flex items-center gap-2
                     hover:bg-teal-50 dark:hover:bg-teal-600
                     {item.status === 'highlighted'
                       ? 'bg-teal-100 dark:bg-teal-600'
                       : ''}
                     {item.status === 'selected'
                       ? 'bg-teal-200 dark:bg-teal-500 font-medium'
                       : ''}"
            >
              📌 {item.inputValue}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>

<!-- Bloc principal Applications installées -->
<div
  class="card stack cursor-pointer select-none
         bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
         border border-gray-200 dark:border-gray-700 
         shadow-sm rounded-2xl p-5 mb-6
         transition hover:shadow-md"
  role="button"
  tabindex="0"
  aria-pressed={$formData.dossiers_enabled}
  on:click={() => $formData.dossiers_enabled = !$formData.dossiers_enabled}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && ($formData.dossiers_enabled = !$formData.dossiers_enabled)}
>
  <div class="flex items-center justify-between">
    <!-- Icône + Texte -->
    <div class="flex items-start gap-3">
      <div
        class="flex items-center justify-center w-9 h-9 rounded-xl 
               bg-amber-100 text-amber-600 
               dark:bg-amber-500/20 dark:text-amber-400"
      >
        📦
      </div>
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">
          Applications installées
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Gérez vos applications déjà présentes
        </p>
      </div>
    </div>

    <!-- ✅ Toggle indépendant -->
    <div class="relative inline-flex items-center">
      <input
        id="dossiers_enabled"
        type="checkbox"
        bind:checked={$formData.dossiers_enabled}
        class="sr-only peer"
      />
      <div
        class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 
               peer-focus:ring-amber-400 dark:peer-focus:ring-amber-500 
               rounded-full peer dark:bg-gray-700 
               peer-checked:bg-amber-500 transition-colors duration-300"
      ></div>
      <span
        class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full 
               transition-transform duration-300 peer-checked:translate-x-5 shadow"
      ></span>
    </div>
  </div>
</div>

{#if $formData.dossiers_enabled}
  <div transition:slide>
    <ArrayField {form} name="" {formData}>
      {#each $formData.dossiers_on_item_type as _, i}
        <Form.ElementField {form} name="dossiers_on_item_type[{i}]">
          <Form.Control let:attrs>
            
            <!-- Card par application -->
            <div
              class="card stack flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
                     bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
                     border border-gray-200 dark:border-gray-700 
                     shadow-md hover:shadow-lg transition-shadow
                     rounded-2xl p-5 mb-4"
            >
              <!-- Icône + Champ -->
              <div class="flex items-center gap-3 flex-1 w-full">
                <div
                  class="flex items-center justify-center w-9 h-9 rounded-xl 
                         bg-amber-100 text-amber-600 
                         dark:bg-amber-500/20 dark:text-amber-400 shrink-0"
                >
                  📦
                </div>

                <Input 
                  type="text" 
                  spellcheck="false" 
                  autocomplete="false" 
                  {...attrs} 
                  bind:value={$formData.dossiers_on_item_type[i].label}
                  class="flex-1 h-11 px-3 rounded-xl border border-gray-300 bg-white text-gray-900 
                         focus:border-amber-400 focus:ring-2 focus:ring-amber-300 focus:outline-none
                         dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 
                         dark:focus:border-amber-400 dark:focus:ring-amber-500"
                />
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2">
                <!-- Supprimer -->
                <Form.Button 
                  type="button" 
                  size="sm" 
                  variant="destructive" 
                  on:click={async () => {
                    const item = $formData.dossiers_on_item_type[i];
                    const label = item?.label;

                    if (label && confirm(`Supprimer "${label}" ?`)) {
                      try {
                        const response = await fetch(`/settings/delete?setting_id=${encodeURIComponent(label)}`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const data = await response.json();

                        if (data.message === 'Settings deleted successfully.') {
                          // Mise à jour des données
                          $formData = {
                            ...$formData,
                            dossiers_on_item_type: $formData.dossiers_on_item_type.filter((_, index) => index !== i)
                          };
                          const updatedAuth = { ...$formData.authentification };
                          delete updatedAuth[label];
                          $formData = { ...$formData, authentification: updatedAuth };

                          const updatedDom = { ...$formData.domaine };
                          delete updatedDom[label];
                          $formData = { ...$formData, domaine: updatedDom };

                          // ✅ Ouvrir les logs
                          showLogs = true;

                          // Lancer le script suppression
                          const scriptEvent = new CustomEvent('startScript', { detail: { scriptName: 'suppression', label } });
                          window.dispatchEvent(scriptEvent);
                        }
                      } catch (err) {
                        console.error("Erreur suppression:", err);
                      }
                    }
                  }}
                  class="rounded-lg p-2 hover:bg-red-50 dark:hover:bg-red-900/40 transition"
                >
                  <Trash2 class="h-4 w-4 text-red-600 dark:text-red-400" />
                </Form.Button>

                <!-- Réinitialiser -->
                <Form.Button 
                  type="button" 
                  title="Réinitialiser l'application" 
                  size="sm" 
                  variant="reinitialiser" 
                  on:click={() => {
                    const item = $formData.dossiers_on_item_type[i];
                    const label = item?.label;
                    if (label) {
                      // ✅ Ouvrir les logs
                      showLogs = true;

                      const scriptEvent = new CustomEvent('startScript', { detail: { scriptName: 'reinitialiser', label } });
                      window.dispatchEvent(scriptEvent);
                    }
                  }}
                  class="rounded-lg p-2 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition"
                >
                  <RefreshCw class="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </Form.Button>
              </div>
            </div>
          </Form.Control>
        </Form.ElementField>
      {/each}
    </ArrayField>
  </div>
{/if}

<!-- Bloc Domaine -->
{#if selectedItem?.label}
  <div
    class="card stack 
           bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
           border border-gray-200 dark:border-gray-700 
           shadow-sm rounded-2xl p-5 mb-6
           transition hover:shadow-md"
  >
    <div class="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
      
      <!-- Icône + Label -->
      <div class="left w-full sm:w-48 shrink-0 flex items-start gap-3">
        <div
          class="flex items-center justify-center w-9 h-9 rounded-xl 
                 bg-amber-100 text-amber-600 
                 dark:bg-amber-500/20 dark:text-amber-400"
        >
          🌐
        </div>
        <div>
          <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
            Sous-domaine
          </h3>
        </div>
      </div>

      <!-- Champ -->
      <div class="right flex-1 max-w-sm">
        <input
          type="text"
          name="domaine[{selectedItem.label}]"
          id="domaine"
          placeholder="Sous domaine par défaut {selectedItem.label}"
          class="w-full h-11 px-4 rounded-xl border border-gray-300 bg-white text-gray-900 
                 focus:border-amber-400 focus:ring-2 focus:ring-amber-300 focus:outline-none
                 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 
                 dark:focus:border-amber-400 dark:focus:ring-amber-500"
          bind:value={$formData.domaine[selectedItem.label]}
        />
        <!-- Texte sous le champ -->
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Personnalisé pour <strong>{selectedItem.label}</strong>
        </p>
      </div>
    </div>
  </div>
{/if}
{/if}

    <input type="hidden" name="domaine" value={JSON.stringify(formData.domaine)} />
    <input type="hidden" name="selectedItemId" value={selectedItem?.id} />
    <input type="hidden" name="selectedItemLabel" value={selectedItem?.label} />

    <div class="flex w-full justify-between items-center">
        {#if statusMessage}
            <p class="text-orange-500 text-sm blinking-message">{statusMessage}</p>
        {/if}

        <div class="ml-auto">
            <Form.Button disabled={isSubmitting} type="submit" size="sm" class="w-full lg:max-w-max mb-10">
                {#if showSpinner}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    <p class="text-sm text-gray-500">Soumission en cours...</p>
                {:else}
                    Installer
                    <span class="ml-1" class:hidden={$page.url.pathname === '/settings/applications'}>
                        et continuer
                    </span>
                {/if}
            </Form.Button>
        </div>
    </div>
</form>

<!-- Composant RunScript pour exécuter le script et gérer son état -->
<RunScript scriptName={scriptName} label={selectedItem?.label} {showLogs} on:buttonStateChange={updateButtonState} on:statusMessageUpdate={updateStatusMessage} />


{#if formDebug}
	<SuperDebug data={$formData} />
{/if}


