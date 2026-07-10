<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { createTournament } from "$lib/firebase";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import { isAdmin } from "$lib/store";
	import type { Tournament } from "$lib/types";

	let name = $state("");
	let description = $state("");

	const now = new Date();
	let registrationStartDate = $state(toDateTimeLocal(now));
	let registrationEndDate = $state(toDateTimeLocal(now));
	let tournamentStartDate = $state(toDateTimeLocal(now));
	let tournamentEndDate = $state(toDateTimeLocal(now));
	let tournamentType = $state("double elimination");
	let breakTiesEnabled = $state(false);
	let breakTiesPlace = $state(3);
	let overrideEloChange = $state(-1);
	let minCost = $state(2100);
	let maxCost = $state(2200);
	let minCharacters = $state(14);
	let minTier = $state("0");
	let maxTier = $state("1000");

	let status = $state("");
	let creatingTournament = false;

	function toDateTimeLocal(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	async function handleCreateTournament() {
		if (
			!name ||
			!registrationStartDate ||
			!registrationEndDate ||
			!tournamentStartDate ||
			!tournamentEndDate ||
			!tournamentType
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
			if (creatingTournament) return;
			creatingTournament = true;
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
				challongeTournamentId: "",
				challongeTournamentUrl: "",
				matches: [],
				state: "",
				winnerId: undefined,
				overrideEloChange: overrideEloChange,
				type: tournamentType,
				consolationMatchesTargetRank: breakTiesEnabled
					? breakTiesPlace
					: null,
			};
			const id = await createTournament(tournament);
			await goto(resolve(`/tournaments/${id}`));
		} catch (e: any) {
			status = e.message;
		} finally {
			creatingTournament = false;
		}
	}
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		{#if $isAdmin}
			<h2>Создать турнир</h2>

			<div class="form-row-wide">
				<label for="f-name">Название</label>
				<input id="f-name" type="text" bind:value={name} />
			</div>
			<div class="form-row-wide">
				<label for="f-description">Описание</label>
				<textarea id="f-description" rows="4" bind:value={description}
				></textarea>
			</div>
			<div class="form-row-wide">
				<label for="f-type">Тип турнира</label>
				<select id="f-type" bind:value={tournamentType}>
					<option value="single elimination">Single elimination</option>
					<option value="double elimination">Double elimination</option>
				</select>
			</div>
			<div class="form-row-wide">
				<label for="f-break-ties"> Break ties with placement matches </label>
				<input
					id="f-break-ties"
					type="checkbox"
					bind:checked={breakTiesEnabled}
				/>
			</div>
			{#if breakTiesEnabled}
				<div class="form-row-wide">
					<label for="f-break-ties-place">Break ties through this place</label>
					<input
						id="f-break-ties-place"
						type="number"
						min="1"
						bind:value={breakTiesPlace}
					/>
				</div>
			{/if}
			<div class="form-row-wide">
				<label for="f-elo"
					>Фикс эло для турнира (-1 для стандартной системы)</label
				>
				<input id="f-elo" type="number" bind:value={overrideEloChange} />
			</div>
			<div class="form-row-wide">
				<label for="f-min-tier">Мин. тир игроков</label>
				<select id="f-min-tier" bind:value={minTier}>
					<option value="0">NEWBIE</option>
					<option value="100">MID TIER</option>
					<option value="1000">HIGH TIER</option>
				</select>
			</div>
			<div class="form-row-wide">
				<label for="f-max-tier">Макс. тир игроков</label>
				<select id="f-max-tier" bind:value={maxTier}>
					<option value="0">NEWBIE</option>
					<option value="100">MID TIER</option>
					<option value="1000">HIGH TIER</option>
				</select>
			</div>
			<div class="form-row-wide">
				<label for="f-min-cost">Мин. кост</label>
				<input id="f-min-cost" type="number" bind:value={minCost} />
			</div>
			<div class="form-row-wide">
				<label for="f-max-cost">Макс. кост</label>
				<input id="f-max-cost" type="number" bind:value={maxCost} />
			</div>
			<div class="form-row-wide">
				<label for="f-min-characters">Мин. персонажей</label>
				<input
					id="f-min-characters"
					type="number"
					bind:value={minCharacters}
				/>
			</div>

			<hr style="width: 100%" />

			<div class="form-row-wide">
				<label for="f-reg-start">Начало регистрации</label>
				<input
					id="f-reg-start"
					type="datetime-local"
					bind:value={registrationStartDate}
				/>
			</div>
			<div class="form-row-wide">
				<label for="f-reg-end">Конец регистрации</label>
				<input
					id="f-reg-end"
					type="datetime-local"
					bind:value={registrationEndDate}
				/>
			</div>

			<hr style="width: 100%" />

			<div class="form-row-wide">
				<label for="f-tour-start">Начало турнира</label>
				<input
					id="f-tour-start"
					type="datetime-local"
					bind:value={tournamentStartDate}
				/>
			</div>
			<div class="form-row-wide">
				<label for="f-tour-end">Конец турнира</label>
				<input
					id="f-tour-end"
					type="datetime-local"
					bind:value={tournamentEndDate}
				/>
			</div>

			{#if status}<p class="status error">{status}</p>{/if}

			<div class="btn-col">
				<button class="btn-common btn-play" onclick={handleCreateTournament}
					>Создать</button
				>
			</div>
		{:else}
			<p class="notice">Недостаточно прав для просмотра этой страницы.</p>
		{/if}
	</div>
</div>
