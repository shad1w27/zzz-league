<script lang="ts">
	import {
		addPlayer,
		clearHistory,
		setTimer,
		updateMatchData,
	} from "$lib/firebase";
	import type { Player } from "$lib/types";

	interface Props {
		players?: Player[];
		isAdmin?: boolean;
	}

	let { players = [], isAdmin = false }: Props = $props();

	let addingPlayerName = $state("");

	let searchQueryP1 = $state("");
	let selectedPlayer1: Player | null = $state(null);
	let filteredPlayers1 = $derived(
		players.filter((p: Player) =>
			p.name.toLowerCase().includes(searchQueryP1.toLowerCase()),
		),
	);

	let searchQueryP2 = $state("");
	let selectedPlayer2: Player | null = $state(null);
	let filteredPlayers2 = $derived(
		players.filter((p: Player) =>
			p.name.toLowerCase().includes(searchQueryP2.toLowerCase()),
		),
	);

	function handleSetTimer() {
		const hours = prompt("Через сколько часов закончить?");
		if (hours) setTimer(new Date().getTime() + parseFloat(hours) * 3600000);
	}

	function handleAddPlayer() {
		const playerName = addingPlayerName.trim();
		if (playerName.length < 2) alert("Мала букв");
		try {
			addPlayer(playerName);
		} catch (error) {
			alert(error);
		}
	}

	function calculateEloChange(pA: Player, pB: Player, outcome: number) {
		const k = (pA.elo || 1000) >= 1200 ? 20 : 50;
		const expected =
			1 / (1 + Math.pow(10, ((pB.elo || 1000) - (pA.elo || 1000)) / 400));
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
		)
			return alert("Выберите разных");

		const w1 = calculateEloChange(selectedPlayer1, selectedPlayer2, 1);
		const l1 = calculateEloChange(selectedPlayer1, selectedPlayer2, 0);
		const w2 = calculateEloChange(selectedPlayer2, selectedPlayer1, 1);
		const l2 = calculateEloChange(selectedPlayer2, selectedPlayer1, 0);

		const fBox = document.getElementById("forecast");
		fBox.style.display = "block";
		fBox.innerHTML = `<div>${selectedPlayer1.name}: <span class="gain">+${w1}</span> / <span class="loss">${l1}</span></div><div>${selectedPlayer2.name}: <span class="gain">+${w2}</span> / <span class="loss">${l2}</span></div>`;
	}

	function playMatch() {
		const result = parseFloat(document.getElementById("matchResult").value);

		if (
			!selectedPlayer1 ||
			!selectedPlayer2 ||
			selectedPlayer1.name === selectedPlayer2.name
		)
			return;

		const change1 = calculateEloChange(
			selectedPlayer1,
			selectedPlayer2,
			result,
		);
		const change2 = calculateEloChange(
			selectedPlayer2,
			selectedPlayer1,
			result === 1 ? 0 : 1,
		);
		handleUpdateMatchData(selectedPlayer1, change1, result === 1);
		handleUpdateMatchData(selectedPlayer2, change2, result === 0);
		db.ref("history").push({
			p1: selectedPlayer1.name,
			p2: selectedPlayer2.name,
			change: change1,
		});

		document.getElementById("forecast").style.display = "none";
	}

	function resetSeason() {
		const name = prompt("Название сезона для архива:");
		if (!name) return;
		db.ref("archives/" + name).set(
			players.map((p) => ({
				name: p.name,
				elo: p.elo || 1000,
				isMidConfirmed: p.isMidConfirmed || false,
				isHighConfirmed: p.isHighConfirmed || false,
			})),
		);
		players.forEach((p) => {
			let start = p.isHighConfirmed ? 1400 : p.isMidConfirmed ? 1200 : 1000;
			db.ref("players/" + p.uid).update({
				elo: start,
				tournamentPoints: 0,
				promoStreak: 0,
			});
		});
		db.ref("history").remove();
	}

	function handleUpdateMatchData(
		player: Player,
		change: number,
		isWin: boolean,
	) {
		try {
			updateMatchData(player.uid, change, isWin);
		} catch (error) {
			alert(error);
		}
	}

	function finalizeTournament() {
		if (!confirm("Применить очки?")) return;
		players.forEach((p) => {
			const next = (p.elo || 1000) + (p.tournamentPoints || 0);
			let m = p.isMidConfirmed,
				h = p.isHighConfirmed;
			if (m && next < 1150) m = false;
			if (h && next < 1350) h = false;
			if (next >= 1400) h = true;
			db.ref("players/" + p.uid).update({
				elo: next,
				tournamentPoints: 0,
				isMidConfirmed: m,
				isHighConfirmed: h,
			});
		});
	}
</script>

{#if isAdmin}
	<div class="card admin-only">
		<h2>Control Panel</h2>
		<button onclick={() => handleSetTimer()}>⏳ Установить таймер</button>
		<input
			type="text"
			id="playerName"
			placeholder="Имя игрока"
			bind:value={addingPlayerName}
		/>
		<button onclick={() => handleAddPlayer()}>Добавить игрока (Admin)</button>
		<hr />

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

		<button class="btn-forecast" onclick={() => showForecast()}
			>📈 Прогноз ELO</button
		>
		<div class="forecast-box" id="forecast"></div>

		<select id="matchResult">
			<option value="1">Победа Игрока 1</option>
			<option value="0">Победа Игрока 2</option>
		</select>
		<button class="btn-play" onclick={() => playMatch()}
			>⚔️ Записать матч</button
		>
		<button onclick={() => finalizeTournament()}>✅ Применить итоги</button>
		<button onclick={() => resetSeason()}>📦 Сброс сезона</button>
	</div>
{/if}
