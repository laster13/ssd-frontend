const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";

/* -------------------------------------------
   FONCTIONS API GÉNÉRIQUES
------------------------------------------- */

async function get(url: string) {
	const res = await fetch(url);
	const data = await res.json();
	if (!res.ok) throw new Error(data.detail || "Erreur API (GET)");
	return data;
}

async function post(url: string, body: any = {}) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.detail || "Erreur API (POST)");
	return data;
}

/* -------------------------------------------
   API PUBLICS
------------------------------------------- */

export function apiScanMovies(dryRun = false) {
	return get(`${API_BASE}/symlinks/movies?dry_run=${dryRun}`);
}

export function apiRename(oldPath: string, newFolder: string, newFile: string, dryRun = false) {
	return post(`${API_BASE}/rename/edit`, {
		old_path: oldPath,
		new_folder: newFolder,
		new_file: newFile,
		dry_run: dryRun
	});
}

export function apiFixIMDB(path: string, dryRun = false) {
	return post(`${API_BASE}/rename/fix/imdb_one`, { path, dry_run: dryRun });
}

export function apiDeleteFromRadarr(path: string, dryRun = false) {
	return post(`${API_BASE}/rename/sync_radarr`, { path, dry_run: dryRun });
}

export function apiReimportRadarr(path: string, dryRun = false) {
	return post(`${API_BASE}/rename/reimport_radarr`, { path, dry_run: dryRun });
}

export function apiFixPlexGlobal(dryRun = false) {
	return post(`${API_BASE}/rename/fix/plex?dry_run=${dryRun}`);
}
