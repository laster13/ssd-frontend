<script lang="ts">
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import { fade, scale } from "svelte/transition";
	import { activities } from "$lib/stores/symlinks";
	import {
		CheckCircle2,
		XCircle,
		AlertTriangle,
		Link2,
		Wifi,
		RefreshCw,
		Wrench,
		CalendarDays
	} from "lucide-svelte";

	interface Activity {
		id?: number | string;
		event: string;
		path: string;
		manager?: string;
		time: string;
		action: string;
		message?: string;
		extra?: any;
		replaced?: boolean | null;
		replaced_at?: string | null;
	}

	type DateMode = "all" | "today" | "yesterday" | "this_week" | "7d" | "30d" | "range";

	let currentFilter = "all";
	let dateMode: DateMode = "all";
	let startDate: string | null = null;
	let endDate: string | null = null;
	let currentPeriodLabel = "Toutes les dates";
	let backendUrl = "";
	let loading = true;
	let connected = false;
	let reconnectTimer: number | null = null;
	let es: EventSource | null = null;
	let resolvedPaths: string[] = [];

	const dateKeyFromDate = (d: Date) => {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");

		return `${year}-${month}-${day}`;
	};

	const todayKey = () => dateKeyFromDate(new Date());

	const shiftDateKey = (days: number) => {
		const d = new Date();
		d.setDate(d.getDate() + days);
		return dateKeyFromDate(d);
	};

	const startOfThisWeekKey = () => {
		const d = new Date();
		const day = d.getDay();
		const mondayOffset = day === 0 ? -6 : 1 - day;
		d.setDate(d.getDate() + mondayOffset);
		return dateKeyFromDate(d);
	};

	const dateKeyFromActivityTime = (t?: string | null) => {
		if (!t) return "";

		const raw = String(t).trim();

		const sqliteMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T]/);
		if (sqliteMatch) {
			return `${sqliteMatch[1]}-${sqliteMatch[2]}-${sqliteMatch[3]}`;
		}

		if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
			return raw;
		}

		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) return "";

		return dateKeyFromDate(d);
	};

	const parseActivityTime = (t?: string | null) => {
		if (!t) return 0;

		const raw = String(t).trim();

		const sqliteMatch = raw.match(
			/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?/
		);

		if (sqliteMatch) {
			const [, year, month, day, hour, minute, second = "00", fraction = "0"] = sqliteMatch;
			const ms = Number(fraction.padEnd(3, "0").slice(0, 3));

			return new Date(
				Number(year),
				Number(month) - 1,
				Number(day),
				Number(hour),
				Number(minute),
				Number(second),
				ms
			).getTime();
		}

		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) return 0;

		return d.getTime();
	};

	const formatDateKey = (key?: string | null) => {
		if (!key || typeof key !== "string") return "";

		const clean = key.trim();

		if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
			return "";
		}

		const d = new Date(`${clean}T12:00:00`);

		if (Number.isNaN(d.getTime())) {
			return "";
		}

		return d.toLocaleDateString("fr-FR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric"
		});
	};

	const activityMatchesDateModeValue = (
		t: string | null | undefined,
		mode: DateMode,
		rangeStart: string | null = startDate,
		rangeEnd: string | null = endDate
	) => {
		if (mode === "all") return true;

		const activityKey = dateKeyFromActivityTime(t);
		if (!activityKey) return false;

		if (mode === "today") {
			return activityKey === todayKey();
		}

		if (mode === "yesterday") {
			return activityKey === shiftDateKey(-1);
		}

		if (mode === "this_week") {
			return activityKey >= startOfThisWeekKey() && activityKey <= todayKey();
		}

		if (mode === "range") {
			if (rangeStart && activityKey < rangeStart) return false;
			if (rangeEnd && activityKey > rangeEnd) return false;
			return true;
		}

		const activityTime = parseActivityTime(t);
		if (!activityTime) return false;

		const now = Date.now();
		const days = mode === "7d" ? 7 : 30;
		const minTime = now - days * 24 * 60 * 60 * 1000;

		return activityTime >= minTime;
	};

	const activityMatchesDateMode = (t?: string | null) => {
		return activityMatchesDateModeValue(t, dateMode, startDate, endDate);
	};

	function handleStartDateInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		startDate = input.value || null;
	}

	function handleEndDateInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		endDate = input.value || null;
	}

	$: {
		const safeStartDate = typeof startDate === "string" ? startDate : "";
		const safeEndDate = typeof endDate === "string" ? endDate : "";

		const formattedStart = formatDateKey(safeStartDate);
		const formattedEnd = formatDateKey(safeEndDate);

		if (dateMode === "all") {
			currentPeriodLabel = "Toutes les dates";
		} else if (dateMode === "today") {
			currentPeriodLabel = "Aujourd’hui";
		} else if (dateMode === "yesterday") {
			currentPeriodLabel = "Hier";
		} else if (dateMode === "this_week") {
			currentPeriodLabel = "Cette semaine";
		} else if (dateMode === "7d") {
			currentPeriodLabel = "7 derniers jours";
		} else if (dateMode === "30d") {
			currentPeriodLabel = "30 derniers jours";
		} else if (formattedStart && formattedEnd) {
			currentPeriodLabel = `Du ${formattedStart} au ${formattedEnd}`;
		} else if (formattedStart) {
			currentPeriodLabel = `Depuis le ${formattedStart}`;
		} else if (formattedEnd) {
			currentPeriodLabel = `Jusqu’au ${formattedEnd}`;
		} else {
			currentPeriodLabel = "Plage personnalisée";
		}
	}

	const formatDate = (t?: string | null) => {
		if (!t) return "";

		const raw = String(t).trim();

		const sqliteMatch = raw.match(
			/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
		);

		if (sqliteMatch) {
			const [, year, month, day, hour, minute, second = "00"] = sqliteMatch;
			const d = new Date(
				Number(year),
				Number(month) - 1,
				Number(day),
				Number(hour),
				Number(minute),
				Number(second)
			);

			if (Number.isNaN(d.getTime())) return raw;

			return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit"
			})}`;
		}

		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) return raw;

		return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit"
		})}`;
	};

	const normalizePath = (p?: string | null) =>
		String(p || "")
			.trim()
			.replace(/\/+$/, "");

	const isSameOrIncludedPath = (a?: string | null, b?: string | null) => {
		const pa = normalizePath(a);
		const pb = normalizePath(b);

		if (!pa || !pb) return false;

		return pa === pb || pa.includes(pb) || pb.includes(pa);
	};

	const isDeletedResolved = (activity: Activity) => {
		if (activity.action !== "deleted") return false;

		return (
			activity.replaced === true ||
			resolvedPaths.some((path) => isSameOrIncludedPath(activity.path, path))
		);
	};

	function saveActivities(list: Activity[]) {
		if (!browser) return;
		localStorage.setItem("symlink_activities", JSON.stringify(list));
	}

	function persistUpdate(updater: (list: Activity[]) => Activity[]) {
		activities.update((list) => {
			const updated = updater(list);
			saveActivities(updated);
			return updated;
		});
	}

	function isDuplicate(list: Activity[], candidate: Activity) {
		const candidatePath = normalizePath(candidate.path);

		return list.some((a) => {
			if (candidate.id && a.id === candidate.id) return true;

			const samePath = normalizePath(a.path) === candidatePath;

			// Toutes les suppressions du même path = une seule card.
			// Cela évite les doublons visuels entre symlink_removed et symlink_removed_manual.
			if (a.action === "deleted" && candidate.action === "deleted" && samePath) {
				return true;
			}

			return a.action === candidate.action && samePath;
		});
	}

	function addActivity(candidate: Activity) {
		persistUpdate((list) => {
			if (isDuplicate(list, candidate)) return list;
			return [candidate, ...list].slice(0, 2500);
		});
	}

	function normalizeBackendActivity(d: any): Activity | null {
		let action = String(d.action || "").toLowerCase();
		const event = String(d.event || "");
		let path = d.path || d.message || "inconnu";

		const act = action.toLowerCase();
		const evt = event.toLowerCase();
		const pathLower = String(path || "").toLowerCase();

		if (act.includes("scan") || evt.includes("scan") || pathLower.includes("scan")) {
			return null;
		}

		if (
			evt.includes("orphans_deleted") ||
			(d.manager === "alldebrid" && (d.extra?.deleted_torrents || []).length > 0)
		) {
			const torrents = d.extra?.deleted_torrents || [];
			if (!torrents || torrents.length === 0) return null;

			const listText =
				torrents.slice(0, 50).join("\n- ") +
				(torrents.length > 50 ? `\n... (+${torrents.length - 50} autres)` : "");

			path = `🧹 Torrents orphelins supprimés :\n- ${listText}`;
			action = "orphan_deleted";
		}

		if (evt.includes("symlink_replacement") || action === "replaced") {
			action = "replaced";

			const oldPath = d.extra?.old_path;
			const newPath = d.extra?.new_path || d.path;

			if (oldPath && newPath) {
				path = `♻️ Symlink remplacé :\nAncien : ${oldPath}\nNouveau : ${newPath}`;
			}
		}

		if (evt.includes("repaired") || action === "repaired") {
			action = "repaired";
		}

		if (evt.includes("symlink_broken") || action === "broken" || action === "broken_live") {
			action = "broken";

			if (d.extra?.target) {
				path = `⚠️ Symlink brisé : ${d.path}\n→ Cible manquante : ${d.extra.target}`;
			}
		}

		return {
			id: d.id,
			event: d.event,
			path,
			manager: d.manager || "système",
			time: d.created_at || d.updated_at || new Date().toISOString(),
			action,
			message: d.message,
			extra: d.extra ?? null,
			replaced: d.replaced ?? null,
			replaced_at: d.replaced_at || null
		};
	}

	$: resolvedPaths = $activities
		.filter((a) => a.action === "repaired" || a.action === "replaced")
		.flatMap((a) => {
			const paths = [
				a.path,
				a.extra?.old_path,
				a.extra?.new_path,
				a.extra?.repaired_path,
				a.extra?.symlink,
			];

			return paths.map(normalizePath).filter(Boolean);
		});

	$: filtered = $activities.filter((a) => {
		const matchesDate = activityMatchesDateModeValue(a.time, dateMode, startDate, endDate);

		if (currentFilter === "not_replaced") {
			return a.action === "deleted" && !isDeletedResolved(a) && matchesDate;
		}

		if (currentFilter === "deleted") {
			return a.action === "deleted" && isDeletedResolved(a) && matchesDate;
		}

		const matchesType = currentFilter === "all" || a.action === currentFilter;
		return matchesType && matchesDate;
	});

	$: periodCounts = {
		all: $activities.length,
		today: $activities.filter((a) => activityMatchesDateModeValue(a.time, "today")).length,
		yesterday: $activities.filter((a) => activityMatchesDateModeValue(a.time, "yesterday")).length,
		this_week: $activities.filter((a) => activityMatchesDateModeValue(a.time, "this_week")).length,
		"7d": $activities.filter((a) => activityMatchesDateModeValue(a.time, "7d")).length,
		"30d": $activities.filter((a) => activityMatchesDateModeValue(a.time, "30d")).length
	};

	$: summary = {
		created: $activities.filter(
			(a) =>
				a.action === "created" &&
				activityMatchesDateModeValue(a.time, dateMode, startDate, endDate)
		).length,

		deleted: $activities.filter(
			(a) =>
				a.action === "deleted" &&
				isDeletedResolved(a) &&
				activityMatchesDateModeValue(a.time, dateMode, startDate, endDate)
		).length,

		not_replaced: $activities.filter(
			(a) =>
				a.action === "deleted" &&
				!isDeletedResolved(a) &&
				activityMatchesDateModeValue(a.time, dateMode, startDate, endDate)
		).length,

		replaced: $activities.filter(
			(a) =>
				a.action === "replaced" &&
				activityMatchesDateModeValue(a.time, dateMode, startDate, endDate)
		).length,

		repaired: $activities.filter(
			(a) =>
				a.action === "repaired" &&
				activityMatchesDateModeValue(a.time, dateMode, startDate, endDate)
		).length,

		broken: $activities.filter(
			(a) =>
				a.action === "broken" &&
				activityMatchesDateModeValue(a.time, dateMode, startDate, endDate)
		).length,

		orphan_deleted: $activities.filter(
			(a) =>
				a.action === "orphan_deleted" &&
				activityMatchesDateModeValue(a.time, dateMode, startDate, endDate)
		).length
	};

	const statusIcon = (a: string) => {
		switch (a) {
			case "created":
				return CheckCircle2;
			case "deleted":
				return XCircle;
			case "replaced":
				return RefreshCw;
			case "repaired":
				return Wrench;
			case "broken":
			case "broken_live":
				return AlertTriangle;
			case "orphan_deleted":
				return AlertTriangle;
			default:
				return Link2;
		}
	};

	const statusColor = (a: string) => {
		switch (a) {
			case "created":
				return "text-emerald-400";
			case "deleted":
				return "text-rose-400";
			case "replaced":
				return "text-purple-400";
			case "repaired":
				return "text-sky-400";
			case "broken":
			case "broken_live":
				return "text-amber-400";
			case "orphan_deleted":
				return "text-cyan-400";
			default:
				return "text-muted-foreground";
		}
	};

	const borderColor = (a: Activity) => {
		if (a.action === "created") return "border-emerald-500";
		if (a.action === "deleted" && a.replaced !== true) return "border-violet-500";
		if (a.action === "deleted") return "border-rose-500";
		if (a.action === "replaced") return "border-purple-500";
		if (a.action === "repaired") return "border-sky-500";
		if (a.action === "broken") return "border-amber-500";
		if (a.action === "orphan_deleted") return "border-cyan-500";
		return "border-border";
	};

	const titleColor = (a: Activity) => {
		if (a.action === "created") return "text-emerald-400";
		if (a.action === "deleted") return a.replaced !== true ? "text-violet-400" : "text-rose-400";
		if (a.action === "replaced") return "text-purple-400";
		if (a.action === "repaired") return "text-sky-400";
		if (a.action === "broken") return "text-amber-400";
		if (a.action === "orphan_deleted") return "text-cyan-400";
		return "text-foreground";
	};

	const titleLabel = (a: Activity) => {
		if (a.action === "created") return "🟢 Lien créé";
		if (a.action === "deleted") return "🗑️ Suppression de symlink";
		if (a.action === "replaced") return "♻️ Symlink remplacé";
		if (a.action === "repaired") return "🛠️ Symlink réparé";
		if (a.action === "broken") return "⚠️ Lien brisé détecté";
		if (a.action === "orphan_deleted") return "🧹 Torrents orphelins supprimés (AllDebrid)";
		return "🔗 Autre activité";
	};

	function replacementPath(data: any) {
		const oldPath = data.old_path || data.extra?.old_path;
		const newPath = data.new_path || data.extra?.new_path || data.path;

		if (oldPath && newPath) {
			return `♻️ Symlink remplacé :\nAncien : ${oldPath}\nNouveau : ${newPath}`;
		}

		return data.message || data.path || "Symlink remplacé";
	}

	function repairedPath(data: any, repairedPathValue?: string) {
		const p = repairedPathValue || data.path || "inconnu";
		return data.message || `🛠️ Symlink réparé : ${p}`;
	}

	function brokenPath(data: any, brokenPathValue?: string) {
		const p = brokenPathValue || data.path || "inconnu";
		if (data.target) return `⚠️ Symlink brisé : ${p}\n→ Cible manquante : ${data.target}`;
		return p;
	}

	async function loadInitialActivities() {
		try {
			const url =
				window.location.protocol === "https:"
					? import.meta.env.VITE_BACKEND_URL_HTTPS
					: import.meta.env.VITE_BACKEND_URL_HTTP;

			const resp = await fetch(`${url}/api/v1/system-activities?limit=2000`, {
				credentials: "include"
			});

			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

			const data = await resp.json();

			const unreplacedResp = await fetch(
				`${url}/api/v1/system-activities/unreplaced?limit=5000`,
				{
					credentials: "include"
				}
			);

			let unreplacedData: any[] = [];

			if (unreplacedResp.ok) {
				unreplacedData = await unreplacedResp.json();
			} else {
				console.warn(
					"⚠️ Impossible de charger les symlinks non remplacés:",
					unreplacedResp.status
				);
			}

			const parsed = data
				.map(normalizeBackendActivity)
				.filter(Boolean);

			const parsedUnreplaced = unreplacedData
				.map(normalizeBackendActivity)
				.filter(Boolean);

			const mergedMap = new Map<string, Activity>();

			for (const item of [...parsed, ...parsedUnreplaced]) {
				const key =
					item.action === "deleted"
						? `deleted:${normalizePath(item.path)}`
						: item.id
							? `id:${item.id}`
							: `${item.action}|${normalizePath(item.path)}`;

				mergedMap.set(key, item);
			}

			const merged = Array.from(mergedMap.values()).sort(
				(a, b) => parseActivityTime(b.time) - parseActivityTime(a.time)
			);

			activities.set(merged);
			saveActivities(merged);
			loading = false;
		} catch (err) {
			console.error("Erreur chargement activités:", err);
			loading = false;
		}
	}

	async function deleteOne(id: number | string | undefined) {
		if (!id) return;

		try {
			const url =
				window.location.protocol === "https:"
					? import.meta.env.VITE_BACKEND_URL_HTTPS
					: import.meta.env.VITE_BACKEND_URL_HTTP;

			const resp = await fetch(`${url}/api/v1/system-activities/${id}`, {
				method: "DELETE",
				credentials: "include",
			});

			if (!resp.ok) throw new Error("Erreur API delete");

			persistUpdate((list) => list.filter((a) => a.id !== id));
		} catch (e) {
			console.error("❌ Erreur suppression activité:", e);
			alert("Erreur lors de la suppression");
		}
	}

	function connectSSE() {
		if (!browser) return;

		backendUrl =
			window.location.protocol === "https:"
				? import.meta.env.VITE_BACKEND_URL_HTTPS
				: import.meta.env.VITE_BACKEND_URL_HTTP;

		const eventUrl = `${backendUrl}/api/v1/symlinks/events`;

		if (es) es.close();
		es = new EventSource(eventUrl);

		es.onopen = () => {
			connected = true;
			console.log("✅ [SSE] Connecté au backend :", eventUrl);
		};

		es.onerror = (err) => {
			console.warn("⚠️ [SSE] Erreur ou déconnexion :", err);
			connected = false;

			if (es) es.close();

			if (!reconnectTimer) {
				reconnectTimer = window.setTimeout(() => {
					reconnectTimer = null;
					console.log("🔄 [SSE] Tentative de reconnexion...");
					connectSSE();
				}, 3000);
			}
		};

		es.addEventListener("symlink_update", (e: MessageEvent) => {
			try {
				if (!e.data) return;

				const data = JSON.parse(e.data);

				if (!data.action || data.action === "scan") return;

				let action = String(data.action || "").toLowerCase();
				let path = data.path || "inconnu";
				let manager = data.manager || "inconnu";

				if (
					data.event?.includes("orphans_deleted") ||
					(data.manager === "alldebrid" && data.deleted_torrents?.length > 0)
				) {
					const torrents = data.deleted_torrents || [];
					const listText =
						torrents.slice(0, 50).join("\n- ") +
						(torrents.length > 50 ? `\n... (+${torrents.length - 50} autres)` : "");

					if (!listText.trim()) return;

					path = `🧹 Torrents orphelins supprimés :\n- ${listText}`;
					action = "orphan_deleted";
				}

				if (action === "replaced" || data.event?.includes("symlink_replacement")) {
					const oldPath = normalizePath(data.old_path || data.extra?.old_path || "");
					const newPath = normalizePath(data.new_path || data.extra?.new_path || data.path || "");

					persistUpdate((list) => {
						const marked = list.map((a) => {
							const sameOldPath =
								a.action === "deleted" &&
								normalizePath(a.path) === oldPath;

							if (sameOldPath) {
								return {
									...a,
									replaced: true,
									replaced_at: data.replaced_at || new Date().toISOString(),
								};
							}

							return a;
						});

						const act: Activity = {
							id: data.id || `${Date.now()}-replaced-${newPath}`,
							event: data.event || "symlink_replacement",
							path: replacementPath(data),
							manager,
							time: data.replaced_at || new Date().toISOString(),
							action: "replaced",
							message: data.message,
							extra: {
								...(data.extra || {}),
								old_path: data.old_path || data.extra?.old_path,
								new_path: data.new_path || data.extra?.new_path || data.path,
								match_reason: data.match_reason || data.extra?.match_reason,
							},
							replaced: true,
							replaced_at: data.replaced_at || new Date().toISOString(),
						};

						if (isDuplicate(marked, act)) return marked;
						return [act, ...marked].slice(0, 2500);
					});

					return;
				}

				if (
					(action.includes("repaired") || data.event?.includes("repaired")) &&
					Array.isArray(data.repaired_symlinks)
				) {
					const now = new Date().toISOString();

					persistUpdate((list) => {
						const repairedSet = new Set(
							data.repaired_symlinks.map((p: string) => normalizePath(p))
						);

						let updated = list.filter((a) => {
							if (a.action !== "broken") return true;

							const activityPath = normalizePath(a.path);
							return !Array.from(repairedSet).some(
								(p) => activityPath.includes(p) || p.includes(activityPath)
							);
						});

						updated = updated.map((a) => {
							if (a.action !== "deleted" || a.replaced === true) return a;

							const deletedPath = normalizePath(a.path);
							const wasRepaired = Array.from(repairedSet).some(
								(p) => deletedPath.includes(p) || p.includes(deletedPath)
							);

							if (!wasRepaired) return a;

							return {
								...a,
								replaced: true,
								replaced_at: now,
							};
						});

						for (const p of repairedSet) {
							const act: Activity = {
								id: `${Date.now()}-repaired-${p}`,
								event: data.event || "symlink_repaired_light",
								path: repairedPath(data, p),
								manager,
								time: now,
								action: "repaired",
								message: data.message,
								extra: {
									...(data.extra || {}),
									repaired_path: p,
									target: data.target || data.extra?.target,
								},
								replaced: null,
								replaced_at: null,
							};

							if (!isDuplicate(updated, act)) {
								updated = [act, ...updated];
							}
						}

						return updated.slice(0, 2500);
					});

					return;
				}

				if (action.includes("repaired") || data.event?.includes("repaired")) {
					const repaired = normalizePath(data.path);

					persistUpdate((list) => {
						let updated = list.filter((a) => {
							if (a.action !== "broken") return true;

							const activityPath = normalizePath(a.path);
							return !(activityPath.includes(repaired) || repaired.includes(activityPath));
						});

						const repairedAt = new Date().toISOString();

						updated = updated.map((a) => {
							if (a.action !== "deleted" || a.replaced === true) return a;

							const deletedPath = normalizePath(a.path);

							if (!(deletedPath.includes(repaired) || repaired.includes(deletedPath))) return a;

							return {
								...a,
								replaced: true,
								replaced_at: repairedAt,
							};
						});

						const act: Activity = {
							id: data.id || `${Date.now()}-repaired-${repaired}`,
							event: data.event || "symlink_repaired",
							path: repairedPath(data),
							manager,
							time: repairedAt,
							action: "repaired",
							message: data.message,
							extra: {
								...(data.extra || {}),
								repaired_path: repaired,
								target: data.target || data.extra?.target,
							},
							replaced: null,
							replaced_at: null,
						};

						if (isDuplicate(updated, act)) return updated;
						return [act, ...updated].slice(0, 2500);
					});

					return;
				}

				if (
					action === "broken" ||
					action === "broken_live" ||
					data.event === "broken_symlinks_light"
				) {
					const brokenList = data.broken_symlinks || [data.path];

					persistUpdate((list) => {
						const newActs: Activity[] = [];

						for (const broken of brokenList) {
							const act: Activity = {
								id: `${Date.now()}-broken-${broken}`,
								event: data.event || "symlink_broken",
								path: brokenPath(data, broken),
								manager,
								time: new Date().toISOString(),
								action: "broken",
								message: data.message,
								extra: data.extra ?? null,
								replaced: null,
								replaced_at: null,
							};

							if (!isDuplicate(list, act) && !isDuplicate(newActs, act)) {
								newActs.push(act);
							}
						}

						return [...newActs, ...list].slice(0, 2500);
					});

					return;
				}

				const act: Activity = {
					id: data.id || `${Date.now()}-${action}`,
					event: data.event,
					path,
					manager,
					time: new Date().toISOString(),
					action,
					message: data.message,
					extra: data.extra ?? null,
					replaced: data.replaced ?? null,
					replaced_at: data.replaced_at ?? null,
				};

				addActivity(act);
			} catch (err) {
				console.error("❌ [SSE] Erreur parsing:", err);
			}
		});
	}

	onMount(() => {
		if (!browser) return;

		const saved = localStorage.getItem("symlink_activities");

		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed)) activities.set(parsed);
			} catch {
				localStorage.removeItem("symlink_activities");
			}
		}

		loadInitialActivities();
		connectSSE();

		return () => {
			if (es) es.close();

			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
		};
	});
</script>


<div class="min-h-screen bg-background text-foreground transition-colors duration-300">
	<header class="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
		<div class="mx-auto max-w-7xl px-4 py-4 flex justify-between items-center">
			<div class="flex items-center gap-3">
				<div class="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-cyan-400 to-emerald-400 shadow">
					<Link2 class="h-5 w-5 text-white" />
				</div>
				<div class="text-2xl font-semibold">
					<span class="text-foreground">Historique</span><span class="text-cyan-400">Symlinks</span>
				</div>
			</div>

			<div class="hidden md:flex items-center gap-2 text-sm">
				<Wifi class={`h-4 w-4 ${connected ? "text-emerald-400 animate-pulse" : "text-rose-400 animate-pulse"}`} />
				<span class={`${connected ? "text-emerald-400" : "text-rose-400"}`}>
					{connected ? "Connecté" : "Déconnecté"}
				</span>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 pb-12">

		<div
			class="mb-6 rounded-2xl border border-violet-400/20 bg-card/70 p-4 shadow-lg backdrop-blur"
			in:fade={{ duration: 180 }}
		>
			<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
				<div class="flex items-center gap-3">
					<div class="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow">
						<CalendarDays class="h-5 w-5" />
					</div>

					<div>
						<div class="text-xs uppercase tracking-wide text-muted-foreground">
							Période
						</div>
						<div class="text-base font-semibold text-violet-300">
							{currentPeriodLabel}
						</div>
						<div class="text-xs text-muted-foreground">
							{filtered.length} activité{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
						</div>
					</div>
				</div>

				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class={`rounded-xl px-3 py-2 text-xs font-medium transition ${
							dateMode === "all"
								? "bg-violet-600 text-white shadow shadow-violet-500/20"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
						}`}
						on:click={() => {
							dateMode = "all";
							startDate = null;
							endDate = null;
						}}
					>
						Tout · {periodCounts.all}
					</button>

					<button
						type="button"
						class={`rounded-xl px-3 py-2 text-xs font-medium transition ${
							dateMode === "today"
								? "bg-violet-600 text-white shadow shadow-violet-500/20"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
						}`}
						on:click={() => {
							dateMode = "today";
							startDate = null;
							endDate = null;
						}}
					>
						Aujourd’hui · {periodCounts.today}
					</button>

					<button
						type="button"
						class={`rounded-xl px-3 py-2 text-xs font-medium transition ${
							dateMode === "yesterday"
								? "bg-violet-600 text-white shadow shadow-violet-500/20"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
						}`}
						on:click={() => {
							dateMode = "yesterday";
							startDate = null;
							endDate = null;
						}}
					>
						Hier · {periodCounts.yesterday}
					</button>

					<button
						type="button"
						class={`rounded-xl px-3 py-2 text-xs font-medium transition ${
							dateMode === "this_week"
								? "bg-violet-600 text-white shadow shadow-violet-500/20"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
						}`}
						on:click={() => {
							dateMode = "this_week";
							startDate = null;
							endDate = null;
						}}
					>
						Semaine · {periodCounts.this_week}
					</button>

					<button
						type="button"
						class={`rounded-xl px-3 py-2 text-xs font-medium transition ${
							dateMode === "7d"
								? "bg-violet-600 text-white shadow shadow-violet-500/20"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
						}`}
						on:click={() => {
							dateMode = "7d";
							startDate = null;
							endDate = null;
						}}
					>
						7j · {periodCounts["7d"]}
					</button>

					<button
						type="button"
						class={`rounded-xl px-3 py-2 text-xs font-medium transition ${
							dateMode === "30d"
								? "bg-violet-600 text-white shadow shadow-violet-500/20"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
						}`}
						on:click={() => {
							dateMode = "30d";
							startDate = null;
							endDate = null;
						}}
					>
						30j · {periodCounts["30d"]}
					</button>

					<button
						type="button"
						class={`rounded-xl px-3 py-2 text-xs font-medium transition ${
							dateMode === "range"
								? "bg-violet-600 text-white shadow shadow-violet-500/20"
								: "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
						}`}
						on:click={() => {
							const today = todayKey();

							dateMode = "range";
							startDate = startDate || today;
							endDate = endDate || today;
						}}
					>
						Personnalisé
					</button>

					{#if dateMode !== "all"}
						<button
							type="button"
							class="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-rose-300"
							on:click={() => {
								dateMode = "all";
								startDate = null;
								endDate = null;
							}}
						>
							Réinitialiser
						</button>
					{/if}
				</div>
			</div>

			{#if dateMode === "range"}
				<div
					class="mt-4 grid grid-cols-1 gap-3 border-t border-border/50 pt-4 sm:grid-cols-2"
					in:fade={{ duration: 180 }}
				>
					<label class="flex flex-col gap-1 text-xs text-muted-foreground">
						Du
						<input
							type="date"
							value={startDate || ""}
							on:input={handleStartDateInput}
							class="rounded-lg border border-violet-400/20 bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
						/>
					</label>

					<label class="flex flex-col gap-1 text-xs text-muted-foreground">
						Au
						<input
							type="date"
							value={endDate || ""}
							on:input={handleEndDateInput}
							class="rounded-lg border border-violet-400/20 bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
						/>
					</label>
				</div>
			{/if}
		</div>

		{#if !loading && $activities.length > 0}
			<div in:fade={{ duration: 250 }}>
				<div
					in:scale={{ duration: 250, start: 0.95 }}
					class="relative mb-10 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/90 to-background/90 shadow-xl backdrop-blur-md transition-colors duration-300"
				>
					<div
						class="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-transparent blur-3xl"
					></div>

					<div class="relative px-6 py-5">
						<div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
							<button
								type="button"
								class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition w-full focus:outline-none focus:ring-2 focus:ring-emerald-400"
								on:click={() => (currentFilter = 'created')}
							>
								<div class="text-emerald-400 text-xl font-semibold">{summary.created}</div>
								<div class="text-xs text-muted-foreground mt-0.5">Créés</div>
							</button>

							<button
								type="button"
								class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition w-full focus:outline-none focus:ring-2 focus:ring-rose-400"
								on:click={() => (currentFilter = 'deleted')}
							>
								<div class="text-rose-400 text-xl font-semibold">{summary.deleted}</div>
								<div class="text-xs text-muted-foreground mt-0.5">Suppressions</div>
							</button>

							<button
								type="button"
								class="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition w-full focus:outline-none focus:ring-2 focus:ring-violet-400"
								on:click={() => (currentFilter = 'not_replaced')}
							>
								<div class="text-violet-400 text-xl font-semibold">{summary.not_replaced}</div>
								<div class="text-xs text-muted-foreground mt-0.5">Non remplacés</div>
							</button>

							<button
								type="button"
								class="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition w-full focus:outline-none focus:ring-2 focus:ring-purple-400"
								on:click={() => (currentFilter = 'replaced')}
							>
								<div class="text-purple-400 text-xl font-semibold">{summary.replaced}</div>
								<div class="text-xs text-muted-foreground mt-0.5">Remplacés</div>
							</button>

							<button
								type="button"
								class="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition w-full focus:outline-none focus:ring-2 focus:ring-sky-400"
								on:click={() => (currentFilter = 'repaired')}
							>
								<div class="text-sky-400 text-xl font-semibold">{summary.repaired}</div>
								<div class="text-xs text-muted-foreground mt-0.5">Réparés</div>
							</button>

							<button
								type="button"
								class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
								on:click={() => (currentFilter = 'broken')}
							>
								<div class="text-amber-400 text-xl font-semibold">{summary.broken}</div>
								<div class="text-xs text-muted-foreground mt-0.5">Brisés</div>
							</button>

							<button
								type="button"
								class="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition w-full focus:outline-none focus:ring-2 focus:ring-cyan-400"
								on:click={() => (currentFilter = 'orphan_deleted')}
							>
								<div class="text-cyan-400 text-xl font-semibold">{summary.orphan_deleted}</div>
								<div class="text-xs text-muted-foreground mt-0.5">Orphelins</div>
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if loading}
			<div class="text-center py-20 text-muted-foreground">Chargement des activités...</div>
		{:else if filtered.length === 0}
			<div class="text-center py-20 text-muted-foreground">Aucune activité trouvée</div>
		{:else}
			<section class="space-y-5">
				{#each filtered as a (String(a.id || "") + a.time + a.path)}
					{@const Icon = statusIcon(a.action)}

					<article
						class={`rounded-xl bg-card text-card-foreground p-4 md:p-5 shadow-sm border-l-4 transition-all hover:-translate-y-1 hover:ring-2 hover:ring-cyan-500 ${borderColor(a)}`}
					>
						<div class="flex items-start gap-4">
							<div class="rounded-md bg-muted/20 p-2 text-xl">
								<Icon class={`w-6 h-6 ${statusColor(a.action)}`} />
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex justify-between items-center gap-4">
									<h4 class={`font-semibold truncate ${titleColor(a)}`}>
										{titleLabel(a)}
									</h4>

									<div class="text-sm text-muted-foreground shrink-0">
										{formatDate(a.time)}
									</div>
								</div>

								<pre class="mt-1 text-sm text-foreground whitespace-pre-wrap break-all">{a.path}</pre>

								{#if a.action === "deleted"}
									{#if a.replaced === true}
										<div class="mt-2 text-sm text-purple-400">
											♻️ Remplacé le {formatDate(a.replaced_at)}
										</div>
									{:else if a.replaced === false}
										<div class="mt-2 flex items-center justify-between text-sm text-rose-400">
											<span>❌ Non remplacé après suppression</span>

											<button
												on:click={() => deleteOne(a.id)}
												class="px-2 py-1 text-xs rounded-md bg-rose-700/20 hover:bg-rose-700/40 border border-rose-700/40 text-rose-300 transition"
											>
												🗑️
											</button>
										</div>
									{:else}
										<div class="mt-2 flex items-center justify-between text-sm text-violet-400">
											<span>⏳ En attente de remplacement</span>

											<button
												on:click={() => deleteOne(a.id)}
												class="px-2 py-1 text-xs rounded-md bg-violet-700/20 hover:bg-violet-700/40 border border-violet-700/40 text-violet-300 transition"
											>
												🗑️
											</button>
										</div>
									{/if}
								{/if}

								{#if a.action === "replaced" && a.extra?.match_reason}
									<div class="mt-2 text-sm text-purple-400">
										🔎 Match : {a.extra.match_reason}
									</div>
								{/if}

								{#if a.action === "repaired"}
									<div class="mt-2 text-sm text-sky-400">
										🛠️ Réparation enregistrée
									</div>
								{/if}

								<div class="mt-2 text-xs text-muted-foreground">
									{a.manager ? `Géré par : ${a.manager}` : ""}
								</div>
							</div>
						</div>
					</article>
				{/each}
			</section>
		{/if}
	</main>
</div>