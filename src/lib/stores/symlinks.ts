import { writable, derived } from "svelte/store";

// --- Stores principaux ---
export const symlinks = writable<any[]>([]);
export const search = writable('');
export const rowsPerPage = writable(10);
export const currentPage = writable(1);
export const scanStatus = writable(false);
export const selected = writable<any[]>([]);
export const logs = writable<string[]>([]);
export const totalItems = writable(0);
export const orphaned = writable(0);
export const uniqueTargets = writable(0);
export const duplicatesCount = writable(0);
export const imdbMissing = writable(0);

export const exporting = writable(false);
export const exportSuccess = writable(false);

export const importing = writable(false);
export const importSuccess = writable(false);

export const refreshing = writable(false);
export const refreshSuccess = writable(false);

export const scanning = writable(false);
export const scanSuccess = writable(false);

export const deleting = writable<Record<string, boolean>>({});
export const deleteSuccess = writable<Record<string, boolean>>({});

export const selectedDir = writable('');            
export const availableDirs = writable<string[]>([]);

export const bulkDeleting = writable(false);
export const bulkDeleteSuccess = writable(false);

export const repairing = writable(false);
export const repairSuccess = writable(false);

export const selectedItem = writable<any>(null);

export const allBrokenCount = writable(0);
export const latestSymlinks = writable<any[]>([]);
export const hasDuplicates = writable(false);
export const duplicates = writable<any[]>([]);

// --- Derived stores ---
export const filteredSymlinks = derived(
  [symlinks, search],
  ([$symlinks, $search]) =>
    $symlinks.filter((item: any) =>
      item.symlink.toLowerCase().includes($search.toLowerCase()) ||
      item.target.toLowerCase().includes($search.toLowerCase())
    )
);

export const totalPages = derived(
  [totalItems, rowsPerPage],
  ([$total, $perPage]) => Math.ceil($total / $perPage)
);

// --- Nouveau store unifié ---
export const activeFilter = writable<'none' | 'orphans' | 'duplicates' | 'latest'>('none');

// --- Nouveau visibleSymlinks qui prend tout en compte ---
export const visibleSymlinks = derived(
  [symlinks, duplicates, latestSymlinks, activeFilter],
  ([$symlinks, $duplicates, $latest, $filter]) => {
    switch ($filter) {
      case 'orphans':
        return $symlinks.filter((s) => s.isBroken); // adapte selon ta logique
      case 'duplicates':
        return $duplicates;
      case 'latest':
        return $latest;
      default:
        return $symlinks;
    }
  }
);

export const renaming = writable({
  radarr: false,
  sonarr: false,
  global: false,
});

export const renameSuccess = writable({
  radarr: false,
  sonarr: false,
  global: false,
});

// --- Historique des activités Symlinks ---
export const activities = writable<any[]>([]);

// --- 🔔 Notification globale pour les mises à jour (persistante) ---
let initial = null;

// 🔹 Restaure depuis localStorage s'il existe
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("updateNotification");
  if (saved) {
    try {
      initial = JSON.parse(saved);
    } catch {
      console.warn("Erreur parsing updateNotification");
    }
  }
}

export const updateNotification = writable(initial);

// 🔹 Sauvegarde automatique dès que la valeur change
if (typeof window !== "undefined") {
  updateNotification.subscribe((val) => {
    if (val && (val.type || val.message)) {
      localStorage.setItem("updateNotification", JSON.stringify(val));
    } else {
      localStorage.removeItem("updateNotification");
    }
  });
}

// --- 🔄 Connexion SSE ---
if (typeof window !== "undefined") {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const sse = new EventSource(`${API_BASE_URL}/symlinks/events`);

  ["update_available_backend", "update_available_frontend"].forEach((evt) => {
    sse.addEventListener(evt, (event) => {
      const data = JSON.parse(event.data);
      const notif = {
        type: evt.includes("backend") ? "backend" : "frontend",
        message: data.message,
        version: data.version || null,
      };
      updateNotification.set(notif);
    });
  });

  sse.addEventListener("update_error", (event) => {
    const data = JSON.parse(event.data);
    updateNotification.set({
      type: "error",
      message: data.message,
      version: null,
    });
  });
}



