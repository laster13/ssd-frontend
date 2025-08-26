<script lang="ts">
  import { auth } from "$lib/api";
  import { goto } from "$app/navigation";

  let username = "";
  let password = "";
  let confirmPassword = "";
  let error: string | null = null;
  let loading = false;

async function handleRegister() {
  error = null;
  loading = true;

  if (password !== confirmPassword) {
    error = "Les mots de passe ne correspondent pas";
    loading = false;
    return;
  }
  if (password.length < 4) {
    error = "Le mot de passe doit contenir au moins 4 caractères";
    loading = false;
    return;
  }

  try {
    await auth.registerFirstUser(username, password); // ✅ FIX

    goto("/login"); // redirige vers login après inscription
  } catch (e: any) {
    error = e?.response?.data?.detail || "Échec de l'inscription";
    console.error("❌ Register error:", e);
  } finally {
    loading = false;
  }
}

</script>

<!-- Fond -->
<div 
  class="relative flex flex-col items-center justify-center min-h-screen 
         bg-gradient-to-br from-gray-900 via-black to-gray-950 text-foreground 
         overflow-hidden px-4 animate-gradient"
>
  <!-- Blobs -->
  <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-2xl opacity-0 animate-blob1 bg-gradient-to-r from-orange-500/70 to-pink-500/70"></div>
  <div class="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full blur-2xl opacity-0 animate-blob2 bg-gradient-to-r from-green-500/70 to-teal-500/70"></div>
  <div class="absolute z-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-50 animate-pulse-slow bg-gradient-to-r from-orange-500 via-pink-500 to-green-600"></div>

  <!-- Titre -->
  <h1 class="relative z-20 mb-12 text-4xl sm:text-5xl font-extrabold text-center 
             bg-gradient-to-r from-orange-500 via-red-500 to-green-600 
             bg-clip-text text-transparent drop-shadow-xl animate-shimmer bg-[length:200%_auto]">
    Création de vos identifiants
  </h1>

  <!-- Carte -->
  <div class="w-full max-w-xl mx-auto relative z-10 animate-fadeUp">
    <div class="p-[2px] rounded-3xl bg-gradient-to-r from-orange-500/40 via-red-500/40 to-green-600/40 shadow-[0_8px_60px_-10px_rgba(251,191,36,0.3)]">
      <form
        on:submit|preventDefault={handleRegister}
        class="flex flex-col gap-8 p-6 sm:p-10 rounded-3xl 
               bg-white/80 dark:bg-gray-800/80 
               backdrop-blur-2xl border border-white/10 shadow-2xl"
      >
        <!-- Erreur -->
        {#if error}
          <div class="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm text-center font-medium shadow-inner animate-fadeIn">
            {error}
          </div>
        {/if}

        <!-- Inputs -->
        <div class="flex flex-col gap-5 animate-fadeIn delay-200">
          <!-- Username -->
          <div>
            <label for="username" class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
              Nom d’utilisateur
            </label>
            <input
              id="username"
              type="text"
              bind:value={username}
              required
              class="w-full px-4 py-3 rounded-2xl border border-gray-300/30 
                     bg-white/60 dark:bg-gray-700/60 
                     text-gray-800 dark:text-gray-100 placeholder-gray-400 
                     focus:ring-2 focus:ring-orange-500 focus:border-transparent 
                     outline-none backdrop-blur-sm"
              placeholder="Entrez un identifiant"
            />
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              bind:value={password}
              required
              class="w-full px-4 py-3 rounded-2xl border border-gray-300/30 
                     bg-white/60 dark:bg-gray-700/60 
                     text-gray-800 dark:text-gray-100 placeholder-gray-400 
                     focus:ring-2 focus:ring-orange-500 focus:border-transparent 
                     outline-none backdrop-blur-sm"
              placeholder="••••••••"
            />
          </div>

          <!-- Confirm Password -->
          <div>
            <label for="confirmPassword" class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              required
              class="w-full px-4 py-3 rounded-2xl border border-gray-300/30 
                     bg-white/60 dark:bg-gray-700/60 
                     text-gray-800 dark:text-gray-100 placeholder-gray-400 
                     focus:ring-2 focus:ring-orange-500 focus:border-transparent 
                     outline-none backdrop-blur-sm"
              placeholder="••••••••"
            />
          </div>
        </div>

        <!-- Bouton -->
        <div class="flex justify-center animate-fadeIn delay-400">
          <button
            type="submit"
            disabled={loading}
            class="relative inline-flex items-center justify-center w-full sm:w-auto px-10 py-4 
                   rounded-2xl text-sm sm:text-base font-bold text-white tracking-wide uppercase
                   bg-[length:300%_300%] bg-gradient-to-r from-orange-500 via-red-500 to-green-600
                   animate-gradientShift
                   hover:scale-105 hover:shadow-[0_0_35px_rgba(255,150,0,0.7)]
                   border border-white/20 shadow-[0_10px_40px_-5px_rgba(251,191,36,0.6)]
                   transition disabled:opacity-60 overflow-hidden group"
          >
            <span
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent 
                         translate-x-[-200%] group-hover:translate-x-[200%] 
                         transition-transform duration-1000 ease-in-out"
            ></span>
            {loading ? "Création..." : "CRÉER LE COMPTE"}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-slow {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.1); }
  }
  @keyframes shimmer {
    0% { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes gradientMove {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animate-pulse-slow { animation: pulse-slow 6s ease-in-out infinite; }
  .animate-shimmer { animation: shimmer 3s linear infinite; }
  .animate-fadeUp { animation: fadeInUp 1s ease forwards; }
  .animate-fadeIn { animation: fadeIn 0.8s ease forwards; }
  .delay-200 { animation-delay: 0.2s; }
  .delay-400 { animation-delay: 0.4s; }
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradientMove 20s ease infinite;
  }
  .animate-gradientShift {
    animation: gradientShift 6s ease infinite;
  }
  @keyframes blobFade1 {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 0.8; transform: scale(1); }
  }
  @keyframes blobFade2 {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 0.7; transform: scale(1); }
  }
  .animate-blob1 { animation: blobFade1 2s ease forwards; }
  .animate-blob2 { animation: blobFade2 2.5s ease forwards; }
</style>
