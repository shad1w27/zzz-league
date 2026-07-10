<script lang="ts">
	import { onMount } from "svelte";
	import { db, deleteArchive, deleteHistoryEntry } from "$lib/firebase";
	import { ref, onValue } from "firebase/database";
	import type { Archives, Tournament } from "$lib/types";
	import Leaderboard from "$lib/components/Leaderboard.svelte";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import TournamentCard from "$lib/components/TournamentCard.svelte";
	import { isAdmin, players } from "$lib/store";

	let allTournaments = $state<Tournament[]>([]);
	let filteredTournaments = $derived(
		allTournaments.filter((t) => {
			const expiration = 3 * 24 * 60 * 60 * 1000;
			return Date.now() - t.tournamentEndDate < expiration;
		}),
	);

	let archives = $state<Archives>({});

	let searchQuery = $state("");

	let isViewingArchive = $state(false);
	let archiveKey = $state("");
	let timerText = $state("0D 00:00:00");
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
				timerText = `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
			};
			timerInterval = setInterval(tick, 1000);
			tick();
		});

		const unsubArchives = onValue(ref(db, "archives"), (snap) => {
			archives = snap.val() ?? {};
		});

		const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

		const unsubTournaments = onValue(ref(db, "tournaments"), (snap) => {
			const val = snap.val();
			allTournaments = val ? (Object.values(val) as Tournament[]) : [];
		});

		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			unsubTimer();
			unsubArchives();
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
</script>

<div class="layout">
	<SidePanel></SidePanel>
	<div class="card main-content">
		<div class="main-timer">
			<div class="timer-label">ДО КОНЦА ЛИГИ:</div>
			<div class="timer-value">{timerText}</div>
		</div>

		{#if filteredTournaments && filteredTournaments.length > 0}
			<div>
				<h2>Турниры:</h2>
				<div class="tournament-container">
					{#each filteredTournaments as tournament}
						<TournamentCard {tournament} {now} />
					{/each}
				</div>
			</div>
		{/if}

		<div class="search-container">
			<h2>
				{isViewingArchive
					? `Архив: ${archiveKey}`
					: "Турнирная Таблица ZZZ"}
			</h2>
			<div style="display:flex; align-items:center; gap:10px;">
				{#if isViewingArchive}
					<button class="btn-common back-btn" onclick={loadLive}
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
	</div>
</div>

<style>
	.main-timer {
		background: #222;
		border: 1px solid #444;
		border-radius: 8px;
		padding: 15px;
		margin-bottom: 20px;
		font-size: 16px;
		text-align: center;
	}

	.timer-label {
		color: #888;
	}

	.timer-value {
		color: var(--gold);
		font-size: 18px;
		font-weight: bold;
		text-shadow: 0 0 10px rgba(255, 204, 0, 0.3);
		margin-top: 4px;
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
	}

	.archive-btn {
		background: transparent;
		border: 1px solid #333;
		color: #fff;
		width: 44px;
		height: 44px;
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
		margin: 0;
		border-radius: 6px;
	}

	.archive-del:hover {
		background: #662222;
	}
</style>
