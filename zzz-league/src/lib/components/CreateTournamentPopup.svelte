<script lang="ts">
	import { createTournament } from "$lib/firebase";
	import type { Tournament } from "$lib/types";
	import { closeCreateTournamentPopup } from "$lib/uiCommon";

	let { open = $bindable(false) } = $props();

	let name = $state("");
	let description = $state("");

	const now = new Date();
	let registrationStartDate = $state(toDateTimeLocal(now));
	let registrationEndDate = $state(toDateTimeLocal(now));
	let tournamentStartDate = $state(toDateTimeLocal(now));
	let tournamentEndDate = $state(toDateTimeLocal(now));
	let minCost = $state(2100);
	let maxCost = $state(2200);
	let minCharacters = $state(14);
	let minTier = $state("0");
	let maxTier = $state("1000");

	let status = $state("");

	function toDateTimeLocal(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function close() {
		name = "";
		description = "";
		const now = new Date();
		registrationStartDate = toDateTimeLocal(now);
		registrationEndDate = toDateTimeLocal(now);
		tournamentStartDate = toDateTimeLocal(now);
		tournamentEndDate = toDateTimeLocal(now);
		status = "";
		closeCreateTournamentPopup();
	}

	async function handleCreateTournament() {
		if (
			!name ||
			!registrationStartDate ||
			!registrationEndDate ||
			!tournamentStartDate ||
			!tournamentEndDate
		) {
			status = "Заполните все поля";
			return;
		}

		const regStart = new Date(registrationStartDate).getTime();
		const regEnd = new Date(registrationEndDate).getTime();
		const tourStart = new Date(tournamentStartDate).getTime();
		const tourEnd = new Date(tournamentEndDate).getTime();

		if (regEnd <= regStart) {
			status = "Конец регистрации должен быть позже начала";
			return;
		}
		if (tourStart <= regEnd) {
			status = "Турнир должен начаться после регистрации";
			return;
		}
		if (tourEnd <= tourStart) {
			status = "Конец турнира должен быть позже начала";
			return;
		}

		try {
			let tournament: Tournament = {
				id: "",
				name,
				description,
				registrationStartDate: regStart,
				registrationEndDate: regEnd,
				tournamentStartDate: tourStart,
				tournamentEndDate: tourEnd,
				minCost,
				maxCost,
				minCharacters,
				minTier: parseInt(minTier),
				maxTier: parseInt(maxTier),
			};
			await createTournament(tournament);
			close();
		} catch (e: any) {
			status = e.message;
		}
	}
</script>

<div class="popup">
	<div class="card">
		<h2>Создать турнир</h2>

		<input type="text" bind:value={name} placeholder="Название" />
		<input type="text" bind:value={description} placeholder="Описание" />
		<p>Мин. тир игроков</p>
		<select bind:value={minTier}>
			<option value="0">NEWBIE</option>
			<option value="100">MID TIER</option>
			<option value="1000">HIGH TIER</option>
		</select>

		<p>Макс. тир игроков</p>
		<select bind:value={maxTier}>
			<option value="0">NEWBIE</option>
			<option value="100">MID TIER</option>
			<option value="1000">HIGH TIER</option>
		</select>
		<input type="number" bind:value={minCost} placeholder="Мин. кост" />
		<input type="number" bind:value={maxCost} placeholder="Макс. кост" />
		<input
			type="number"
			bind:value={minCharacters}
			placeholder="Мин. персонажей"
		/>

		<hr style="width: 100%" />

		<p>Начало регистрации</p>
		<input type="datetime-local" bind:value={registrationStartDate} />

		<p>Конец регистрации</p>
		<input type="datetime-local" bind:value={registrationEndDate} />

		<hr style="width: 100%" />

		<p>Начало турнира</p>
		<input type="datetime-local" bind:value={tournamentStartDate} />

		<p>Конец турнира</p>
		<input type="datetime-local" bind:value={tournamentEndDate} />

		{#if status}<p class="status error">{status}</p>{/if}

		<div class="btn-row">
			<button class="btn-common btn-play" onclick={handleCreateTournament}
				>Создать</button
			>
			<button class="btn-common" onclick={close}>Закрыть</button>
		</div>
	</div>
</div>

<style>
	p {
		font-size: 0.75em;
		color: #888;
		letter-spacing: 1px;
		text-transform: uppercase;
		margin: 0 2px;
		display: block;
	}
</style>
