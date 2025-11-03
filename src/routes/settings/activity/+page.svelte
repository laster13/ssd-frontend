<script lang="ts">
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import { fade, scale } from "svelte/transition";
	import { activities } from "$lib/stores/symlinks";
	import { CheckCircle2, XCircle, AlertTriangle, Link2, Wifi } from "lucide-svelte";

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

	let currentFilter = "all";
	let selectedDate: string | null = null;
	let backendUrl = "";
	let loading = true;
	let connected = false;
	let reconnectTimer: number | null = null;
	let es: EventSource | null = null;

	const filters = [
		{ key: "all", label: "Tous", color: "bg-slate-600" },
		{ key: "created", label: "Créés", color: "bg-emerald-600" },
		{ key: "deleted", label: "Supprimés", color: "bg-rose-600" },
		{ key: "not_replaced", label: "Non remplacés", color: "bg-violet-600" },
		{ key: "broken", label: "Brisés", color: "bg-amber-600" },
		{ key: "orphan_deleted", label: "Orphelins supprimés", color: "bg-cyan-600" },
	];

	const formatDate = (t: string) => {
		if (!t) return "";
		const d = new Date(t);
		return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit"
		})}`;
	};

	// 🧠 Réactivité automatique des filtres
	$: filtered = $activities.filter((a) => {
		const matchesDate =
			!selectedDate || new Date(a.time).toISOString().slice(0, 10) === selectedDate;

		if (currentFilter === "not_replaced") {
			return a.action === "deleted" && a.replaced !== true && matchesDate;
		}
		const matchesType = currentFilter === "all" || a.action === currentFilter;
		return matchesType && matchesDate;
	});

	// 🔁 Résumé des compteurs (auto-réactif)
	$: summary = {
		created: $activities.filter(
			(a) =>
				a.action === "created" &&
				(!selectedDate ||
					new Date(a.time).toISOString().slice(0, 10) === selectedDate)
		).length,
		deleted: $activities.filter(
			(a) =>
				a.action === "deleted" &&
				(!selectedDate ||
					new Date(a.time).toISOString().slice(0, 10) === selectedDate)
		).length,
		broken: $activities.filter(
			(a) =>
				a.action === "broken" &&
				(!selectedDate ||
					new Date(a.time).toISOString().slice(0, 10) === selectedDate)
		).length,
		not_replaced: $activities.filter(
			(a) =>
				a.action === "deleted" &&
				a.replaced !== true &&
				(!selectedDate ||
					new Date(a.time).toISOString().slice(0, 10) === selectedDate)
		).length,
		orphan_deleted: $activities.filter(
			(a) =>
				a.action === "orphan_deleted" &&
				(!selectedDate ||
					new Date(a.time).toISOString().slice(0, 10) === selectedDate)
		).length
	};

        const statusIcon = (a: string) => {
		switch (a) {
			case "created":
				return CheckCircle2;
			case "deleted":
				return XCircle;
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
			case "broken":
			case "broken_live":
				return "text-amber-400";
			case "orphan_deleted":
				return "text-cyan-400";
			default:
				return "text-muted-foreground";
		}
	};

	// ✅ Chargement initial
	async function loadInitialActivities() {
		try {
			const url =
				window.location.protocol === "https:"
					? import.meta.env.VITE_BACKEND_URL_HTTPS
					: import.meta.env.VITE_BACKEND_URL_HTTP;

			const resp = await fetch(`${url}/api/v1/system-activities?limit=500`, {
				credentials: "include"
			});
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const data = await resp.json();

			const parsed = data
				.filter((d: any) => {
					const act = d.action?.toLowerCase() || "";
					const evt = d.event?.toLowerCase() || "";
					const path = d.path?.toLowerCase() || "";
					return !act.includes("scan") && !evt.includes("scan") && !path.includes("scan");
				})
				.map((d: any) => {
					let action = d.action?.toLowerCase();
					let path = d.path || d.message || "inconnu";

					if (
						(d.event?.includes("orphans_deleted") ||
							d.event?.includes("orphan_detected") ||
							(d.manager === "alldebrid" &&
								(d.extra?.deleted_torrents || []).length > 0))
					) {
						const torrents = d.extra?.deleted_torrents || [];
						if (!torrents || torrents.length === 0) return null;
						const listText =
							torrents.slice(0, 50).join("\n- ") +
							(torrents.length > 50
								? `\n... (+${torrents.length - 50} autres)`
								: "");
						path = `🧹 Torrents orphelins supprimés :\n- ${listText}`;
						action = "orphan_deleted";
					}

					if (
						d.event?.includes("symlink_broken") ||
						action === "broken" ||
						action === "broken_live"
					) {
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
						time: d.created_at,
						action,
						message: d.message,
						replaced: d.replaced ?? null,
						replaced_at: d.replaced_at || null
					};
				})
				.filter(Boolean)
				.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime());

			activities.set(parsed);
			localStorage.setItem("symlink_activities", JSON.stringify(parsed));
			loading = false;
		} catch (err) {
			console.error("Erreur chargement activités:", err);
			loading = false;
		}
	}

        // ✅ SSE avec logs détaillés
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

                                // 🧭 Log général de tous les événements
                                console.log(
                                        "📡 [SSE reçu]",
                                        "\n event:", data.event,
                                        "\n action:", data.action,
                                        "\n path:", data.path,
                                        "\n repaired_symlinks:", data.repaired_symlinks,
                                        "\n broken_symlinks:", data.broken_symlinks,
                                );

                                if (!data.action || data.action === "scan") return;

                                let action = data.action.toLowerCase();
                                let path = data.path || "inconnu";
                                let manager = data.manager || "inconnu";

                                // 🧹 Détection des orphelins
                                if (
                                        data.event?.includes("orphans_deleted") ||
                                        data.event?.includes("orphan_detected") ||
                                        (data.manager === "alldebrid" && (data.deleted_torrents?.length > 0))
                                ) {
                                        console.log("🧹 [SSE] Orphelins détectés !");
                                        const listText =
                                                (data.deleted_torrents || [])
                                                        .slice(0, 50)
                                                        .join("\n- ") +
                                                ((data.deleted_torrents?.length || 0) > 50
                                                        ? `\n... (+${data.deleted_torrents.length - 50} autres)`
                                                        : "");
                                        if (!listText.trim()) return;
                                        path = `🧹 Torrents orphelins supprimés :\n- ${listText}`;
                                        action = "orphan_deleted";
                                }

                                // ♻️ Gestion des symlinks réparés (live)
                                if ((action.includes("repaired") || data.event?.includes("repaired")) && Array.isArray(data.repaired_symlinks)) {
                                        console.log("♻️ [SSE] Réparations multiples détectées :", data.repaired_symlinks);
                                        activities.update((list) => {
                                                const updated = list.filter(
                                                        (a) =>
                                                                !data.repaired_symlinks.some(
                                                                        (r) =>
                                                                                a.action === "broken" && a.path.includes(r.trim())
                                                                )
                                                );
                                                console.log("✅ [SSE] Broken supprimés du store :", list.length - updated.length);
                                                return updated;
                                        });
                                        localStorage.setItem("symlink_activities", JSON.stringify(get(activities)));
                                        applyFilter();
                                        return;
                                }

                                // 🧩 Gestion des réparations simples (symlink_repaired individuel)
                                if (action.includes("repaired") || data.event?.includes("repaired")) {
                                        console.log("♻️ [SSE] Réparation simple détectée :", data.path);
                                        activities.update((list) => {
                                                const updated = list.filter(
                                                        (a) =>
                                                                !(
                                                                        a.action === "broken" &&
                                                                        a.path.includes(data.path.trim())
                                                                )
                                                );
                                                console.log("✅ [SSE] Broken supprimé du store :", list.length - updated.length);
                                                return updated;
                                        });
                                        localStorage.setItem("symlink_activities", JSON.stringify(get(activities)));
                                        applyFilter();
                                        return;
                                }

                                // ♻️ Gestion des symlinks remplacés
                                if (action === "replaced") {
                                        const oldPath = (data.old_path || data.path || "").trim();
                                        console.log("♻️ [SSE] Remplacement détecté :", oldPath);

                                        activities.update((list) => {
                                                const updated = list.map((a) => {
                                                        const sameFile =
                                                                a.action === "deleted" &&
                                                                a.path.trim().replace(/\/+$/, "") === oldPath.replace(/\/+$/, "");

                                                        if (sameFile) {
                                                                console.log("✅ [SSE] Marqué remplacé :", a.path);
                                                                return {
                                                                        ...a,
                                                                        replaced: true,
                                                                        replaced_at: data.replaced_at || new Date().toISOString(),
                                                                };
                                                        }
                                                        return a;
                                                });
                                                return updated;
                                        });

                                        localStorage.setItem("symlink_activities", JSON.stringify(get(activities)));
                                        applyFilter();
                                        return;
                                }

                                // ⚠️ Gestion des symlinks brisés
                                if (
                                        action === "broken" ||
                                        action === "broken_live" ||
                                        data.event === "broken_symlinks_light"
                                ) {
                                        const brokenList = data.broken_symlinks || [data.path];
                                        console.warn(`⚠️ [SSE] ${brokenList.length} symlink(s) brisé(s) détecté(s)`);
                                        activities.update((list) => {
                                                const newActs = brokenList.map((brokenPath) => ({
                                                        id: `${Date.now()}-${brokenPath}`,
                                                        event: data.event,
                                                        path: brokenPath,
                                                        manager,
                                                        time: new Date().toISOString(),
                                                        action: "broken",
                                                        replaced: null,
                                                        replaced_at: null,
                                                }));
                                                console.log("➕ [SSE] Broken ajoutés :", newActs.length);
                                                return [...newActs, ...list].slice(0, 1000);
                                        });
                                        localStorage.setItem("symlink_activities", JSON.stringify(get(activities)));
                                        applyFilter();
                                        return;
                                }

                                // 🔄 Autres événements normaux
                                console.log("🔄 [SSE] Événement standard reçu :", action, path);
                                const act: Activity = {
                                        id: `${Date.now()}-${action}`,
                                        event: data.event,
                                        path,
                                        manager,
                                        time: new Date().toISOString(),
                                        action,
                                        replaced: data.replaced ?? null,
                                        replaced_at: data.replaced_at ?? null,
                                };

                                activities.update((list) => [act, ...list].slice(0, 1000));
                                localStorage.setItem("symlink_activities", JSON.stringify(get(activities)));
                                applyFilter();
                        } catch (err) {
                                console.error("❌ [SSE] Erreur parsing:", err);
                        }
                });
        }

	onMount(async () => {
		if (!browser) return;
		const saved = localStorage.getItem("symlink_activities");
		if (saved) {
			const parsed = JSON.parse(saved);
			if (Array.isArray(parsed)) activities.set(parsed);
		}
		await loadInitialActivities();
		connectSSE();
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
		<!-- 🔘 Filtres -->
		<div class="flex flex-wrap items-center gap-4 mt-6 mb-6">
			{#each filters as f}
				<button
					on:click={() => (currentFilter = f.key)}
					class={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
						${currentFilter === f.key
							? f.color + " text-white shadow-lg scale-105"
							: "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
				>
					{f.label}
				</button>
			{/each}

			<!-- 📅 Sélecteur de jour -->
			<div
				class="relative flex items-center gap-3 ml-auto bg-gradient-to-r from-violet-500/10 via-cyan-500/10 to-transparent px-4 py-2 rounded-xl border border-violet-400/20 shadow-inner backdrop-blur-sm"
			>
				<div class="flex items-center gap-2">
					<div
						class="flex items-center justify-center w-8 h-8 rounded-md bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow"
					>
						📅
					</div>
					<div class="flex flex-col">
						<label
							for="audit-date"
							class="text-xs uppercase tracking-wide text-muted-foreground"
							>Sélectionner un jour</label
						>
						<input
							id="audit-date"
							type="date"
							bind:value={selectedDate}
							class="bg-transparent text-foreground text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer"
						/>
					</div>
				</div>

				{#if selectedDate}
					<button
						class="ml-4 text-xs px-2 py-1 rounded-md bg-gradient-to-r from-rose-500/10 to-violet-500/10 border border-violet-400/20 text-muted-foreground hover:text-violet-300 hover:shadow-sm transition-all duration-200"
						on:click={() => (selectedDate = null)}
					>
						✖ Réinitialiser
					</button>
				{/if}

				<div
					class="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-400/5 via-transparent to-cyan-400/5 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
				></div>
			</div>
		</div>

		<!-- 📊 Résumé compteurs -->
		{#if !loading && $activities.length > 0}
			<div in:fade={{ duration: 250 }}>
				<div
					in:scale={{ duration: 250, start: 0.95 }}
					class="relative mb-10 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/90 to-background/90 shadow-xl backdrop-blur-md transition-colors duration-300"
				>
					<div
						class="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-transparent blur-3xl"
					></div>
					<div
						class="relative px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
					>
						<div
							class="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-transparent border border-violet-400/20 shadow-inner"
						>
							<div
								class="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md text-white text-lg"
							>
								📅
							</div>
							<div class="flex flex-col leading-tight">
								<span
									class="text-sm text-muted-foreground tracking-wide uppercase"
									>Résumé du jour</span
								>
								<span
									class="text-lg font-semibold text-violet-300 drop-shadow-sm"
								>
									{#if selectedDate}
										{new Date(selectedDate).toLocaleDateString("fr-FR", {
											weekday: "long",
											year: "numeric",
											month: "long",
											day: "numeric"
										})}
									{:else}
										Aujourd’hui
									{/if}
								</span>
							</div>
						</div>

						<!-- 🟢 Cartes compteurs -->
						<div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
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
								<div class="text-xs text-muted-foreground mt-0.5">Supprimés</div>
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

		<!-- 📜 Liste des activités -->
		{#if loading}
			<div class="text-center py-20 text-muted-foreground">Chargement des activités...</div>
		{:else if filtered.length === 0}
			<div class="text-center py-20 text-muted-foreground">Aucune activité trouvée</div>
		{:else}
			<section class="space-y-5">
				{#each filtered as a (a.time + a.path)}
					{@const Icon = statusIcon(a.action)}
					<article
						class={`rounded-xl bg-card text-card-foreground p-4 md:p-5 shadow-sm border-l-4 transition-all hover:-translate-y-1 hover:ring-2 hover:ring-cyan-500
							${a.action === "created"
								? "border-emerald-500"
								: a.action === "deleted" && a.replaced !== true
								? "border-violet-500"
								: a.action === "deleted"
								? "border-rose-500"
								: a.action === "broken"
								? "border-amber-500"
								: a.action === "orphan_deleted"
								? "border-cyan-500"
								: "border-border"}`}
					>
						<div class="flex items-start gap-4">
							<div class="rounded-md bg-muted/20 p-2 text-xl">
								<Icon class={`w-6 h-6 ${statusColor(a.action)}`} />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex justify-between items-center">
									<h4
										class={`font-semibold truncate ${
											a.action === "created"
												? "text-emerald-400"
												: a.action === "deleted"
												? currentFilter === "not_replaced"
													? "text-violet-400"
													: "text-rose-400"
												: a.action === "broken"
												? "text-amber-400"
												: a.action === "orphan_deleted"
												? "text-cyan-400"
												: "text-foreground"
										}`}
									>
										{a.action === "created"
											? "🟢 Lien créé"
											: a.action === "deleted"
											? "🗑️ Suppression de symlink"
											: a.action === "broken"
											? "⚠️ Lien brisé détecté"
											: a.action === "orphan_deleted"
											? "🧹 Torrents orphelins supprimés (AllDebrid)"
											: "🔗 Autre activité"}
									</h4>
									<div class="text-sm text-muted-foreground">{formatDate(a.time)}</div>
								</div>

								<pre class="mt-1 text-sm text-foreground whitespace-pre-wrap break-all">{a.path}</pre>

								{#if a.action === "deleted"}
									{#if a.replaced === true}
										<div class="mt-2 text-sm text-purple-400">
											♻️ Remplacé le {formatDate(a.replaced_at)}
										</div>
									{:else if a.replaced === false}
										<div class="mt-2 text-sm text-rose-400">
											❌ Non remplacé après suppression
										</div>
									{:else}
										<div class={`mt-2 text-sm ${currentFilter === "not_replaced" ? "text-violet-400" : "text-muted-foreground"}`}>
											⏳ En attente de remplacement
										</div>
									{/if}
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
