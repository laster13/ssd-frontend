// src/lib/api/symlinks.ts
const baseURL = import.meta.env.DEV
  ? import.meta.env.VITE_BACKEND_URL_HTTP
  : import.meta.env.VITE_BACKEND_URL_HTTPS;

// --- utils génériques ---
async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

// --- GET ---
export async function fetchSymlinks(params: URLSearchParams) {
  const res = await fetch(`${baseURL}/api/v1/symlinks?${params.toString()}`, {
    credentials: "include",
  });
  return handleResponse(res);
}

export async function fetchFolders() {
  const res = await fetch(`${baseURL}/api/v1/symlinks/folders`, {
    credentials: "include",
  });
  return handleResponse(res);
}

export async function fetchShow(showId: string, instanceId: number | null) {
  const res = await fetch(
    `/api/v1/shows/${showId}?instance_id=${instanceId}`,
    { credentials: "include" }
  );
  return handleResponse(res);
}

export async function fetchLatestSymlinks(params: URLSearchParams) {
  params.set("sort", "created_at");
  params.set("order", "desc");
  if (!params.has("limit")) params.set("limit", "100");

  const res = await fetch(`${baseURL}/api/v1/symlinks?${params.toString()}`, {
    credentials: "include",
  });
  return handleResponse(res);
}

export async function fetchDuplicates(params?: URLSearchParams) {
  const url = params
    ? `${baseURL}/api/v1/symlinks/duplicates?${params.toString()}`
    : `${baseURL}/api/v1/symlinks/duplicates`;

  const res = await fetch(url, { credentials: "include" });
  return handleResponse(res);
}

// --- POST ---
export async function triggerScanAPI() {
  const res = await fetch(`${baseURL}/api/v1/symlinks/scan`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
}

export async function repairMissingSeasonsAPI(folder?: string) {
  const url =
    `${baseURL}/api/v1/symlinks/repair-missing-seasons` +
    (folder ? `?folder=${encodeURIComponent(folder)}` : "");
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
}

export async function deleteBrokenAPI(route: string) {
  const res = await fetch(`${baseURL}${route}`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
}

// --- DELETE ---
export async function deleteSymlinkAPI(route: string) {
  const res = await fetch(`${baseURL}${route}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(res);
}

// --- ARR URLs ---
export async function fetchSonarrUrl(relative: string) {
  const res = await fetch(
    `${baseURL}/api/v1/symlinks/get-sonarr-url/${encodeURIComponent(relative)}`,
    { credentials: "include" }
  );
  return handleResponse(res);
}

export async function fetchRadarrUrl(relativeDir: string) {
  const res = await fetch(
    `${baseURL}/api/v1/symlinks/get-radarr-url/${encodeURIComponent(relativeDir)}`,
    { credentials: "include" }
  );
  return handleResponse(res);
}

// --- Export/Import JSON ---
export function exportSymlinksToFile(data: any[]) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "symlinks_backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function importSymlinksFromFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        resolve(imported);
      } catch {
        reject(new Error("Invalid JSON"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// --- Renommage (Radarr / Sonarr / Global) ---
export async function scanMoviesAPI(dryRun: boolean = true) {
  const res = await fetch(
    `${baseURL}/api/v1/rename/scan?dry_run=${dryRun}`,
    {
      method: "POST",
      credentials: "include",
    }
  );
  return handleResponse(res);
}

export async function scanSeriesAPI(dryRun: boolean = true) {
  const res = await fetch(
    `${baseURL}/api/v1/symlinks/series/scan?dry_run=${dryRun}`,
    {
      method: "POST",
      credentials: "include",
    }
  );
  return handleResponse(res);
}

export async function scanLibrariesAPI() {
  const res = await fetch(`${baseURL}/api/v1/symlinks/libraries`, {
    credentials: "include",
  });
  return handleResponse(res);
}
