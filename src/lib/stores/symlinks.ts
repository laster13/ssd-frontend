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

