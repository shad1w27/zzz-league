<script lang="ts">
	import { onMount } from "svelte";
	import {
		auth,
		clearHistory,
		db,
		deleteArchive,
		deleteHistoryEntry,
	} from "$lib/firebase";
	import { ref, onValue } from "firebase/database";
	import type { Archives, MatchRecord, Player, Tournament } from "$lib/types";
	import Leaderboard from "$lib/components/Leaderboard.svelte";
	import { resolve } from "$app/paths";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import { isAdmin, players } from "$lib/store";
	import { dateDisplayOptions } from "$lib/uiCommon";

	let tournaments = $state<Tournament[]>([]);
	let archives = $state<Archives>({});
	let matchHistory = $state<MatchRecord[]>([]);

	let searchQuery = $state("");

	let isViewingArchive = $state(false);
	let archiveKey = $state("");
	let timerText = $state("0д 00:00:00");
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	let displayPlayers = $derived(
		isViewingArchive ? (archives[archiveKey] ?? []) : $players,
	);

	let now = $state(Date.now());

	onMount(() => {
		const unsubTimer = onValue(ref(db, "timer"), (snap) => {
			const endTime = snap.val();
			if (!endTime) return;
			if (timerInterval) clearInterval(timerInterval);
			const tick = () => {
				const diff = endTime - Date.now();
				if (diff <= 0) {
					timerText = "СЕЗОН ОКОНЧЕН";
					clearInterval(timerInterval!);
					return;
				}
				const d = Math.floor(diff / 86400000);
				const h = Math.floor((diff % 86400000) / 3600000);
				const m = Math.floor((diff % 3600000) / 60000);
				const s = Math.floor((diff % 60000) / 1000);
				timerText = `${d}д ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
			};
			timerInterval = setInterval(tick, 1000);
			tick();
		});

		const unsubArchives = onValue(ref(db, "archives"), (snap) => {
			archives = snap.val() ?? {};
		});

		const unsubHistory = onValue(ref(db, "history"), (snap) => {
			const val = snap.val();
			if (!val) {
				matchHistory = [];
				return;
			}
			matchHistory = Object.entries(val)
				.map(([key, m]: [string, any]) => ({ key, ...m }))
				.reverse();
		});

		const unsubTournaments = onValue(ref(db, "tournaments"), (snap) => {
			const val = snap.val();
			tournaments = val ? (Object.values(val) as Tournament[]) : [];
		});

		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			unsubTimer();
			unsubArchives();
			unsubHistory();
			unsubTournaments();
			if (timerInterval) clearInterval(timerInterval);
			clearInterval(interval);
		};
	});

	function loadArchive(key: string) {
		isViewingArchive = true;
		archiveKey = key;
	}

	function loadLive() {
		isViewingArchive = false;
		archiveKey = "";
	}

	async function handleDeleteArchive(key: string) {
		try {
			await deleteArchive(key);
		} catch (error) {
			alert(error);
		}
	}

	async function handleDeleteHistoryEntry(key: string) {
		if (!confirm("Удалить запись?")) return;

		try {
			await deleteHistoryEntry(key);
		} catch (error) {
			alert(error);
		}
	}

	async function handleClearHistory() {
		if (!confirm("УАДЛИТЬ ИСТОРИЮ?")) return;

		try {
			await clearHistory();
		} catch (error) {
			alert(error);
		}
	}
</script>

<div class="layout">
	<SidePanel></SidePanel>
	<div class="card main-content">
		<div class="main-timer">
			<div class="timer-label">ДО КОНЦА ЛИГИ:</div>
			<div class="timer-value">{timerText}</div>
		</div>

		<div>
			<h2>Турниры:</h2>
			<div class="tournament-container">
				{#each tournaments as tournament}
					{@const status =
						now > tournament.tournamentEndDate
							? "ended"
							: now > tournament.tournamentStartDate
								? "ongoing"
								: now > tournament.registrationStartDate &&
									  now < tournament.registrationEndDate
									? "registration"
									: "upcoming"}
					<a
						class="btn-common tournament status-{status}"
						href={resolve(`/tournaments/${tournament.id}`)}
					>
						<p>{tournament.name}</p>
						<p>
							{new Date(tournament.tournamentStartDate).toLocaleString(
								"ru",
								dateDisplayOptions,
							)}
							- {new Date(tournament.tournamentEndDate).toLocaleString(
								"ru",
								dateDisplayOptions,
							)}
						</p>
						{#if now > tournament.registrationStartDate && now < tournament.registrationEndDate}
							<p>
								Регистрация до {new Date(
									tournament.registrationEndDate,
								).toLocaleString("ru", dateDisplayOptions)}
							</p>
						{/if}
						{#if now > tournament.tournamentStartDate && now < tournament.tournamentEndDate}
							<p>Турнир идёт</p>
						{/if}
						{#if now > tournament.tournamentEndDate}
							<p>Турнир окончен</p>
						{/if}
					</a>
				{/each}
			</div>
		</div>

		<div class="search-container">
			<h2>
				{isViewingArchive
					? `Архив: ${archiveKey}`
					: "Турнирная Таблица ZZZ"}
			</h2>
			<div style="display:flex; align-items:center; gap:10px;">
				{#if isViewingArchive}
					<button class="btn-common btn-back" onclick={loadLive}
						>← ТЕКУЩАЯ ЛИГА</button
					>
				{/if}
				<input
					class="search-input"
					placeholder="Поиск..."
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<div class="table-wrapper">
			<Leaderboard
				players={displayPlayers}
				{searchQuery}
				hideOptions={isViewingArchive}
			/>
		</div>

		{#if Object.keys(archives).length > 0}
			<div class="archive-section">
				<div class="section-label">АРХИВ СЕЗОНОВ:</div>
				<div class="archive-buttons">
					{#each Object.keys(archives).reverse() as key}
						<div class="archive-item">
							<button
								class="btn-common archive-btn"
								onclick={() => loadArchive(key)}>{key}</button
							>
							{#if isAdmin}
								<button
									class="btn-common archive-del"
									onclick={() => handleDeleteArchive(key)}>✕</button
								>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if matchHistory.length > 0}
			<div class="history-header">
				<h3 class="section-label">ИСТОРИЯ МАТЧЕЙ</h3>
				{#if isAdmin}
					<button
						class="btn-common btn-clear-history"
						onclick={() => handleClearHistory()}>ОЧИСТИТЬ</button
					>
				{/if}
			</div>
			<div class="log-items">
				{#each matchHistory as m}
					<div class="log-item">
						<b>{m.p1}</b> vs <b>{m.p2}</b>:
						<span class={m.change >= 0 ? "gain" : "loss"}>
							{m.change >= 0 ? "+" : ""}{m.change} ELO
						</span>
						{#if isAdmin}
							<button
								class="icon-btn danger"
								onclick={() => handleDeleteHistoryEntry(m.key)}
								>✕</button
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.tournament-container {
		display: flex;
		flex-direction: row;
		gap: 8px;
		flex-wrap: wrap;
	}

	.tournament {
		font-size: 14px;
		flex-direction: column;
		width: fit-content;
	}

	.tournament p {
		margin: 0;
	}

	.tournament.status-upcoming {
		background-color: #444;
	}

	.tournament.status-registration {
		background-color: #4a9eff;
	}

	.tournament.status-ongoing {
		background-color: var(--gain);
	}

	.tournament.status-ended {
		background-color: #555;
		opacity: 0.6;
	}

	.history-header {
		border-top: 1px solid #333;
		padding-top: 25px;
		margin-top: 30px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 10px;
		border-bottom: 1px solid #333;
	}

	.main-timer {
		background: #222;
		border: 1px solid #444;
		border-radius: 8px;
		padding: 15px;
		margin-bottom: 20px;
		text-align: center;
	}

	.timer-label {
		font-size: 0.7em;
		color: #888;
		letter-spacing: 1px;
		margin-bottom: 5px;
	}

	.timer-value {
		color: var(--gold);
		font-weight: bold;
		font-family: monospace;
		font-size: 1.6em;
		text-shadow: 0 0 10px rgba(255, 204, 0, 0.3);
	}

	.archive-section {
		margin-top: 25px;
		border-top: 1px solid #333;
		padding-top: 20px;
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.archive-buttons {
		display: flex;
		flex-direction: row;
		gap: 8px;
	}

	.archive-item {
		display: flex;
		align-items: center;
		background: #222;
		box-sizing: border-box;
		border-radius: 6px;
		outline: 1px solid #333;
		gap: 10px;
		overflow: hidden;
	}

	.section-label {
		width: 100%;
		color: #555;
		font-size: 0.8em;
	}

	.archive-btn {
		background: transparent;
		border: 1px solid #333;
		color: #fff;
		width: 44px;
		height: 44px;
		font-size: 0.8em;
		transition: 0.2s;
		margin: 0;
		border-radius: 6px;
	}

	.archive-btn:hover {
		background: #333;
	}

	.archive-del {
		background: #441111;
		color: #ff4444;
		border: 1px solid #333;
		width: 44px;
		height: 44px;
		font-size: 0.8em;
		margin: 0;
		border-radius: 6px;
	}

	.archive-del:hover {
		background: #662222;
	}
</style>
