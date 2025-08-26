<script>
  import SauvegardeForm from '$lib/forms/sauvegarde-form.svelte';
</script>

<main class="p-6 space-y-6">

  <!-- Titre -->
  <h1 class="text-3xl font-normal text-center mb-8">
    📡 <span class="text-transparent bg-clip-text 
                 bg-gradient-to-r from-red-600 via-orange-500 via-yellow-400 to-green-500">
      Console Sauvegarde
    </span>
  </h1>

  <SauvegardeForm />
</main>
