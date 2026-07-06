<script lang="ts">
	import { resolve } from "$app/paths";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import { db, deleteHistoryEntry } from "$lib/firebase";
	import { isAdmin, playersByUid } from "$lib/store";
	import {
		bustCache,
		dateDisplayOptions,
		openImagePopup,
		openProfilePopup,
	} from "$lib/uiCommon";
	import { onValue, orderByChild, query, ref } from "firebase/database";

	type HistoryEntry = {
		id: string;
		p1: string;
		p1Change: number;
		p2: string | null;
		p2Change: number | null;
		tournamentId: string | null;
		tournamentMatch: string;
		resultP1: string | null;
		resultP2: string | null;
		resultScreenshot: string | null;
		timestamp: number;
	};

	let entries = $state<HistoryEntry[]>([]);

	const legacyCutoffTimestamp = $derived(
		entries
			.filter(
				(e) =>
					e.tournamentMatch === "legacy" || e.tournamentMatch === "adjustment",
			)
			.reduce((max, e) => Math.max(max, e.timestamp), 0),
	);

	function getPlayerName(uid: string) {
		return $playersByUid.get(uid)?.name ?? uid;
	}

	function openPlayer(uid: string) {
		const player = $playersByUid.get(uid);
		if (player) openProfilePopup(player);
	}

	function formatDate(timestamp: number) {
		return new Date(timestamp).toLocaleString("ru-RU", dateDisplayOptions);
	}

	function changeClass(change: number) {
		if (change > 0) return "gain";
		if (change < 0) return "loss";
		return "neutral";
	}

	async function handleDelete(id: string) {
		if (!confirm("Удалить запись? ELO/очки и победы/поражения будут отменены."))
			return;
		try {
			await deleteHistoryEntry(id);
		} catch (error) {
			alert(error);
		}
	}

	$effect(() => {
		const historyRef = query(ref(db, "historyV3"), orderByChild("timestamp"));

		const unsubscribe = onValue(historyRef, (snapshot) => {
			const result: HistoryEntry[] = [];
			snapshot.forEach((child) => {
				result.push(child.val() as HistoryEntry);
			});
			entries = result.reverse();
		});

		return () => unsubscribe();
	});
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		<h2>Вся история</h2>
		<div class="match-list">
			{#each entries as entry (entry.id)}
				{#if entry.timestamp === legacyCutoffTimestamp}
					<div class="legacy-divider">Легаси история (возможны ошибки)</div>
				{/if}

				<div class="match-item">
					<div class="match-row">
						<div class="match-players">
							<span class={changeClass(entry.p1Change)}>
								({entry.p1Change > 0 ? "+" : ""}{entry.p1Change})
							</span>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span
								class="match-player-name match-opponent"
								onclick={() => openPlayer(entry.p1)}
							>
								{getPlayerName(entry.p1)}
							</span>
							{#if entry.p2}
								<span class="match-player-name">vs</span>
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="match-player-name match-opponent"
									onclick={() => openPlayer(entry.p2!)}
								>
									{getPlayerName(entry.p2)}
								</span>
								<span class={changeClass(entry.p2Change!)}>
									({entry.p2Change! > 0 ? "+" : ""}{entry.p2Change})
								</span>
							{:else}
								<span class="match-player-name match-adjustment"
									>Корректировка ELO</span
								>
							{/if}
						</div>
						<div class="match-meta">
							<span>{formatDate(entry.timestamp)}</span>
							{#if entry.tournamentId}
								<a
									class="match-tournament-link"
									href={resolve(`/tournaments/${entry.tournamentId}`)}
								>
									Турнир
								</a>
							{/if}
							{#if entry.tournamentMatch === "techloss"}
								<span class="match-techloss">Техлуз</span>
							{/if}
							{#if $isAdmin}
								<button
									class="icon-btn danger"
									onclick={() => handleDelete(entry.id)}
								>
									✕
								</button>
							{/if}
						</div>
					</div>

					{#if entry.resultP1 && entry.resultP2}
						<div class="match-result">
							<span>{entry.resultP1}</span>
							<span class="match-vs">—</span>
							<span>{entry.resultP2}</span>
							{#if entry.resultScreenshot}
								<button
									class="img-btn"
									onclick={() => openImagePopup(entry.resultScreenshot!)}
								>
									<img src={bustCache(entry.resultScreenshot)} alt="" />
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<span>Игр пока нет</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.match-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.match-item {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 8px;
		border-left: 8px solid transparent;
		border-color: #555;
		background: rgba(255, 255, 255, 0.03);
	}

	.match-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.match-players {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.match-player-name {
		font-weight: bold;
	}

	.match-opponent {
		cursor: pointer;
	}

	.match-opponent:hover {
		text-decoration: underline;
	}

	.match-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		color: #888;
	}

	.gain {
		color: var(--green);
	}

	.loss {
		color: var(--loss);
	}

	.neutral {
		color: #888;
	}

	.match-techloss {
		color: var(--loss);
	}

	.match-tournament-link {
		color: var(--gold);
	}

	.match-adjustment {
		color: #888;
		font-weight: normal;
	}

	.legacy-divider {
		text-align: center;
		color: #888;
		padding: 8px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
	}

	.match-result {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #ccc;
	}

	.match-vs {
		color: #666;
	}

	.img-btn {
		background: none;
		border: none;
		padding: 0;
		margin-left: auto;
	}

	.img-btn img {
		width: 48px;
		height: 48px;
		object-fit: cover;
		border-radius: 6px;
		cursor: pointer;
	}
</style>
