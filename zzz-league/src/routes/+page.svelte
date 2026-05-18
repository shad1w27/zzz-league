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
