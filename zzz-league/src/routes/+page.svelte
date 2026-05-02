<script lang="ts">
	import { onMount } from "svelte";
	import { auth, clearHistory, db, deleteArchive } from "$lib/firebase";
	import { onAuthStateChanged, signOut } from "firebase/auth";
	import { ref, onValue } from "firebase/database";
	import type { Player } from "$lib/types";
	import Leaderboard from "$lib/components/Leaderboard.svelte";
	import LoginPopup from "$lib/components/LoginPopup.svelte";
	import RegisterPopup from "$lib/components/RegisterPopup.svelte";
	import AdminPanel from "$lib/components/AdminPanel.svelte";

	let currentUser = $state<{ name: string } | null>(null);
	let isAdmin = $state(false);
	let players = $state<Player[]>([]);
	let archives = $state<Record<string, Player[]>>({});
	let matchHistory = $state<{ p1: string; p2: string; change: number }[]>([]);
	let timerText = $state("0д 00:00:00");
	let searchQuery = $state("");
	let isViewingArchive = $state(false);
	let archiveKey = $state("");
	let loginOpen = $state(false);
	let registerOpen = $state(false);

	let timerInterval: ReturnType<typeof setInterval> | null = null;

	let displayPlayers = $derived(
		isViewingArchive ? (archives[archiveKey] ?? []) : players,
	);

	onMount(() => {
		const unsubAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				const snap = await new Promise<any>((res) =>
					onValue(ref(db, "players/" + user.uid), res, { onlyOnce: true }),
				);
				if (snap.exists()) {
					const d = snap.val();
					currentUser = { name: d.name };
					isAdmin = !!d.isAdmin;
				}
			} else {
				currentUser = null;
				isAdmin = false;
			}
		});

		const unsubPlayers = onValue(ref(db, "players"), (snap) => {
			const val = snap.val();
			players = val
				? (Object.values(val).filter((p: any) => p?.name) as Player[])
				: [];
		});

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
			matchHistory = val ? (Object.values(val).reverse() as any[]) : [];
		});

		return () => {
			unsubAuth();
			unsubPlayers();
			unsubTimer();
			unsubArchives();
			unsubHistory();
			if (timerInterval) clearInterval(timerInterval);
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

	async function handleDeleteArcive(key: string) {
		try {
			await deleteArchive(key);
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

<div class="layout" class:no-admin={!isAdmin}>
	<div class="side-panel">
		{#if !currentUser}
			<div class="card">
				<div class="btn-row">
					<button
						class="btn-common btn-play"
						onclick={() => (loginOpen = true)}>Вход</button
					>
					<button class="btn-common" onclick={() => (registerOpen = true)}
						>Регистрация</button
					>
				</div>
			</div>
		{:else}
			<div class="card">
				<h2>{currentUser.name}</h2>
				<button class="btn-common" onclick={() => signOut(auth)}
					>Выход</button
				>
			</div>
		{/if}

		{#if !isAdmin}
			<div class="card">
				<h2>🏆 Кодекс Лиги</h2>
				<ul class="rules-list">
					<li>
						<b>Ранги:</b> <span class="tier-badge t-newbie">NEWBIE</span>
						<b>1000+</b>, <span class="tier-badge t-mid">MID</span>
						<b>1200+</b>, <span class="tier-badge t-high">HIGH</span>
						<b>1400+</b>.
					</li>
					<li>
						<b>Квалификация:</b> Для входа в
						<span class="tier-badge t-mid">MID TIER</span>
						нужно
						<b>1200</b> ELO и <b>3</b> победы подряд. Для
						<span class="tier-badge t-high">HIGH TIER</span>
						достаточно достичь отметки <b>1400</b> ELO.
					</li>
					<li>
						<b>Уровни (LVL):</b> Каждые <b>40</b> единиц ELO повышают ваш
						уровень. Максимальный уровень —
						<b>L10</b> (начинается с <b>1360</b> ELO).
					</li>
					<li>
						<b>Турнирный бонус:</b> За победу на <b>любом</b> турнире
						игрок получает фиксированную награду
						<b>+40 ELO</b>.
					</li>
					<li>
						<b>Финальный турнир:</b> На последней неделе сезона проводится
						масштабный турнир для
						<b>ТОП-16</b> игроков рейтинга.
					</li>
					<li>
						<b>Сброс лиги:</b> По завершении таймера прогресс уходит в архив.
						ELO сбрасывается до стартового значения текущего подтвержденного
						тира.
					</li>
					<li>
						<b>Сезоны:</b> Новый сезон — это возможность занять топы с чистого
						листа.
					</li>
					<li>
						<b>Вылет:</b> При падении ELO на <b>50</b> пунктов ниже границы
						тира, вы переходите в предыдущую лигу.
					</li>
					<li>
						<b>ELO-очки:</b> Начисляются сразу, но фиксируются в основном балансе
						игрока только после завершения турнирного дня.
					</li>
					<li>
						<b>Техлузы:</b> Неявка — штраф ELO виновнику, сопернику
						<b>0</b>. Выход во время матча — штраф виновнику, сопернику
						<b>+ELO</b>.
					</li>
				</ul>
			</div>
		{/if}

		{#if isAdmin}
			<AdminPanel {players} />
		{/if}
	</div>

	<div class="card main-content">
		<div class="main-timer">
			<div class="timer-label">ДО КОНЦА ЛИГИ:</div>
			<div class="timer-value">{timerText}</div>
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
				{isAdmin}
				{searchQuery}
				hideOptions={isViewingArchive}
			/>
		</div>

		{#if archives}
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
									onclick={() => handleDeleteArcive(key)}>✕</button
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
						onclick={() => handleClearHistory()}
						>ОЧИСТИТЬ</button
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
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<LoginPopup bind:open={loginOpen} />
<RegisterPopup bind:open={registerOpen} />
