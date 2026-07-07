<script lang="ts">
	import {
		addPlayer,
		finalizeTournament,
		registerMatch,
		resetSeason,
		setTimer,
	} from "$lib/firebase";
	import { players } from "$lib/store";
	import type { Player } from "$lib/types";
	import { openCreateTournamentPopup } from "$lib/uiCommon";

	let searchQueryP1 = $state("");
	let selectedPlayer1: Player | null = $state(null);
	let filteredPlayers1 = $derived(
		$players.filter((p: Player) =>
			p.name.toLowerCase().includes(searchQueryP1.toLowerCase()),
		),
	);

	let searchQueryP2 = $state("");
	let selectedPlayer2: Player | null = $state(null);
	let filteredPlayers2 = $derived(
		$players.filter((p: Player) =>
			p.name.toLowerCase().includes(searchQueryP2.toLowerCase()),
		),
	);

	$effect(() => {
		if (filteredPlayers1.length > 0) {
			selectedPlayer1 = filteredPlayers1[0];
		}
		if (filteredPlayers2.length > 0) {
			selectedPlayer2 = filteredPlayers2[0];
		}
	});

	type Forecast = {
		p1: { player: Player; w: number; l: number };
		p2: { player: Player; w: number; l: number };
	};

	let showingForecast = $state(false);
	let forecast = $state<Forecast | null>(null);

	let winningPlayer = $state("1");

	async function handleSetTimer() {
		const hours = prompt("Через сколько часов закончить?");
		if (hours) {
			try {
				await setTimer(new Date().getTime() + parseFloat(hours) * 3600000);
			} catch (error) {
				alert(error);
			}
		}
	}

	async function handleAddPlayer() {
		const playerName = prompt("Введите ник для игрока:");
		if (!playerName) return;
		if (playerName.length < 2) alert("Мала букв");
		try {
			await addPlayer(playerName);
		} catch (error) {
			alert(error);
		}
	}

	function calculateEloChange(p1: Player, p2: Player, outcome: number) {
		const k = p1.isMidConfirmed || false ? 20 : 50;
		const expected =
			1 / (1 + Math.pow(10, ((p2.elo || 1000) - (p1.elo || 1000)) / 400));
		let change = Math.round(k * (outcome - expected));
		if (outcome === 1 && change <= 0) change = 1;
		if (outcome === 0 && change >= 0) change = -1;
		return change;
	}

	function showForecast() {
		if (
			!selectedPlayer1 ||
			!selectedPlayer2 ||
			selectedPlayer1.name === selectedPlayer2.name
		) {
			return alert("Выберите разных");
		}

		forecast = {
			p1: {
				player: selectedPlayer1,
				w: calculateEloChange(selectedPlayer1, selectedPlayer2, 1),
				l: calculateEloChange(selectedPlayer1, selectedPlayer2, 0),
			},
			p2: {
				player: selectedPlayer2,
				w: calculateEloChange(selectedPlayer2, selectedPlayer1, 1),
				l: calculateEloChange(selectedPlayer2, selectedPlayer1, 0),
			},
		};

		showingForecast = true;
	}

	let registeringMatch = false;
	async function handleRegisterMatch() {
		if (registeringMatch) return;
		if (
			!selectedPlayer1 ||
			!selectedPlayer2 ||
			selectedPlayer1.name === selectedPlayer2.name
		) {
			alert("Выберите разных игроков");
			return;
		}

		registeringMatch = true;
		try {
			const winner = parseInt(winningPlayer);

			await registerMatch(
				selectedPlayer1.uid,
				selectedPlayer2.uid,
				winner === 1,
				-1,
			);

			showingForecast = false;
		} catch (error) {
			alert(error);
		} finally {
			registeringMatch = false;
		}
	}

	let registeringTechLoss = false;
	async function handleRegisterTechLoss() {
		if (registeringTechLoss) return;
		if (
			!selectedPlayer1 ||
			!selectedPlayer2 ||
			selectedPlayer1.name === selectedPlayer2.name
		) {
			alert("Выберите разных игроков");
			return;
		}

		const winner = parseInt(winningPlayer);
		const loserName =
			winner === 1 ? selectedPlayer2.name : selectedPlayer1.name;
		if (
			!confirm(
				`${loserName} получает техлуз и теряет ELO, оппонент не получает ELO. Продолжить?`,
			)
		) {
			return;
		}

		registeringTechLoss = true;
		try {
			await registerMatch(
				selectedPlayer1.uid,
				selectedPlayer2.uid,
				winner === 1,
				-1,
				true,
			);

			showingForecast = false;
		} catch (error) {
			alert(error);
		} finally {
			registeringTechLoss = false;
		}
	}

	async function handleResetSeason() {
		const name = prompt("Название сезона для архива:");
		if (!name) return;
		try {
			await resetSeason(name);
		} catch (error) {
			alert(error);
		}
	}

	function handleFinalizeTournament() {
		if (!confirm("Применить очки?")) return;

		try {
			finalizeTournament();
		} catch (error) {
			alert(error);
		}
	}

	function createTournament() {
		openCreateTournamentPopup();
	}
</script>

<div class="card admin-card">
	<h2>Control Panel</h2>
	<button class="btn-common" onclick={handleSetTimer}
		>⏳ Установить таймер</button
	>
	<button class="btn-common" onclick={handleAddPlayer}
		>Добавить игрока
	</button>

	<hr style="width: 100%" />

	<input
		type="text"
		class="select-filter"
		placeholder="Поиск Игрока 1..."
		bind:value={searchQueryP1}
	/>
	<select bind:value={selectedPlayer1}>
		{#each filteredPlayers1 as player}
			<option value={player}>{player.name}</option>
		{/each}
	</select>

	<input
		type="text"
		class="select-filter"
		placeholder="Поиск Игрока 2..."
		bind:value={searchQueryP2}
	/>
	<select bind:value={selectedPlayer2}>
		{#each filteredPlayers2 as player}
			<option value={player}>{player.name}</option>
		{/each}
	</select>

	<button class="btn-common btn-forecast" onclick={showForecast}
		>📈 Прогноз ELO</button
	>
	{#if showingForecast}
		{@const f = forecast!}
		<div class="forecast-box">
			<div>
				{f.p1.player.name}:
				<span class="gain">{f.p1.w}</span> /
				<span class="loss">{f.p1.l}</span>
			</div>

			<div>
				{f.p2.player.name}:
				<span class="gain">{f.p2.w}</span> /
				<span class="loss">{f.p2.l}</span>
			</div>
		</div>
	{/if}

	<select bind:value={winningPlayer}>
		<option value="1">Победа Игрока 1</option>
		<option value="0">Победа Игрока 2</option>
	</select>
	<button
		type="button"
		class="btn-common btn-play"
		onclick={handleRegisterMatch}>⚔️ Записать матч</button
	>
	<button type="button" class="btn-common" onclick={handleRegisterTechLoss}
		>🚫 Техлуз</button
	>
	<hr style="width: 100%;" />
	<button type="button" class="btn-common" onclick={handleFinalizeTournament}
		>✅ Применить итоги</button
	>
	<button type="button" class="btn-common" onclick={handleResetSeason}
		>📦 Сброс сезона</button
	>
	<hr style="width: 100%;" />
	<button type="button" class="btn-common" onclick={createTournament}
		>Создать турнир</button
	>
</div>

<style>
	.admin-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.forecast-box {
		background: #000;
		padding: 15px;
		border-radius: 8px;
		border: 1px dashed #444;
		margin: 15px 0;
		line-height: 1.6;
	}

	.btn-forecast {
		background: var(--gold);
		color: #000;
		border: none;
		padding: 14px;
		border-radius: 8px;
		font-weight: bold;
		cursor: pointer;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: 0.2s;
		box-shadow: 0 4px 15px rgba(255, 204, 0, 0.2);
	}

	.btn-forecast:hover {
		background: #ffdb4d;
	}

	.select-filter {
		padding: 6px 10px;
		font-size: 0.8em;
		border-color: #444;
	}
</style>
