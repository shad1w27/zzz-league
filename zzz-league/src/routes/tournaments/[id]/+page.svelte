<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import TournamentGamePopup from "$lib/components/TournamentMatchPopup.svelte";
	import TournamentPlayerTable from "$lib/components/TournamentPlayerTable.svelte";
	import TournamentRegisterPopup from "$lib/components/TournamentRegistrationPopup.svelte";
	import TournamentSplitPopup from "$lib/components/TournamentSplitPopup.svelte";
	import TournamentAddPlayerPopup from "$lib/components/TournamentAddPlayerPopup.svelte";
	import {
		db,
		deleteTournament,
		finishTournament,
		startChallongeTournament,
		updateTournamentGames,
	} from "$lib/firebase";
	import { currentUser, isAdmin, playersByUid } from "$lib/store";
	import type {
		Player,
		RegisteredPlayer,
		Tournament,
		TournamentMatch,
		TournamentRegistration,
	} from "$lib/types";
	import { dateDisplayOptions, renderMarkdown } from "$lib/uiCommon";
	import { onValue, ref } from "firebase/database";
	import { onMount } from "svelte";

	const id = $derived(page.params.id);

	let now = $state(Date.now());
	let tournament = $state<Tournament>();
	let userRegistration = $state<TournamentRegistration | null>();
	let userPlayer = $state<Player | null>();
	let myRegistration = $state<TournamentRegistration | null>();
	let registrations = $state<TournamentRegistration[]>([]);
	let registeredPlayers = $derived(
		registrations
			.map((registration) => {
				const player = $playersByUid.get(registration.uid);
				return player ? { player, registration } : null;
			})
			.filter(Boolean) as RegisteredPlayer[],
	);
	let searchQuery = $state("");
	let registrationOpen = $state(false);
	let matchOpen = $state(false);
	let splitPopupOpen = $state(false);
	let addPlayerPopupOpen = $state(false);
	let currentMatchId = $state();
	let currentMatch = $derived(
		tournament?.matches.find((m: TournamentMatch) => m.id === currentMatchId),
	);

	let filteredMatches = $derived(
		tournament?.matches.filter(
			(m: TournamentMatch) => !(m.p1 === "TBD" || m.p2 === "TBD"),
		),
	);

	let canView = $derived(tournament?.visible !== false || $isAdmin);

	let currentUserTier = $derived(
		$currentUser?.isHighConfirmed
			? 1000
			: $currentUser?.isMidConfirmed
				? 100
				: 0,
	);
	let tierEligible = $derived(
		!!tournament &&
			currentUserTier >= tournament.minTier &&
			currentUserTier <= tournament.maxTier,
	);
	let approvedCount = $derived(
		registeredPlayers.filter((p) => p.registration.approved).length,
	);

	let unsubRegistration: (() => void) | null = null;

	$effect(() => {
		if ($currentUser) {
			unsubRegistration?.();
			unsubRegistration = onValue(
				ref(db, `tournaments/${id}/registrations/${$currentUser.uid}`),
				(snap) => {
					const data = snap.val();
					if (!data) return;
					myRegistration = data as TournamentRegistration;
				},
			);
		} else {
			unsubRegistration?.();
			unsubRegistration = null;
			myRegistration = null;
		}
	});

	let startingTournament = false;
	async function handleStartTournament() {
		if (startingTournament) return;
		startingTournament = true;
		try {
			await startChallongeTournament(tournament!.id);
		} catch (error) {
			alert(error);
		} finally {
			startingTournament = false;
		}
	}

	let updatingGames = false;
	async function handleUpdateTournamentGames() {
		if (updatingGames) return;
		updatingGames = true;
		try {
			if (tournament) {
				await updateTournamentGames(
					tournament.id,
					tournament.challongeTournamentId,
				);
			}
		} catch (error) {
			alert(error);
		} finally {
			updatingGames = false;
		}
	}

	let finishingTournament = false;
	async function handleFinishTournament() {
		if (finishingTournament) return;
		if (!confirm("Закончить турнир?")) return;
		finishingTournament = true;
		try {
			if (tournament) {
				await finishTournament(
					tournament.id,
					tournament.challongeTournamentUrl,
				);
			}
		} catch (error) {
			alert(error);
		} finally {
			finishingTournament = false;
		}
	}

	let deletingTournament = false;
	async function handleDeleteTournament() {
		if (deletingTournament || !tournament) return;
		if (
			!confirm(
				`Удалить турнир "${tournament.name}"? Это действие необратимо.`,
			)
		)
			return;
		deletingTournament = true;
		try {
			await deleteTournament(tournament.id);
			await goto(resolve("/tournaments"));
		} catch (error) {
			alert(error);
			deletingTournament = false;
		}
	}

	function getPlayerName(uid: string) {
		return registeredPlayers.find((p) => p.player.uid === uid)?.player.name;
	}

	function getPlayerClass(
		player: string,
		winnerId: string,
		techLossUid?: string | null,
	) {
		if (player === techLossUid) return "match-techloss";
		if (!winnerId) return "";

		return player === winnerId ? "match-winner" : "match-loser";
	}

	function openRegistration(uid: string) {
		const found = registeredPlayers.find((p) => p.player.uid === uid);
		userRegistration = found?.registration;
		userPlayer = found?.player;
		if (userRegistration) registrationOpen = true;
	}

	function openMatch(match: TournamentMatch) {
		currentMatchId = match.id;
		matchOpen = true;
	}

	onMount(() => {
		const unsubTournament = onValue(ref(db, "tournaments/" + id), (snap) => {
			const data = snap.val();
			if (!data) return;

			const matches = data.matches ?? {};
			tournament = {
				...data,
				matches: Object.entries(matches).map(
					([, match]: [string, any]) => ({
						...match,
					}),
				),
			};
		});

		const unsubRegistrations = onValue(
			ref(db, `tournaments/${id}/registrations/`),
			(snap) => {
				const data = snap.val();
				registrations = data
					? (Object.values(data) as TournamentRegistration[])
					: [];
			},
		);

		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			unsubTournament();
			unsubRegistrations();
			clearInterval(interval);
		};
	});
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		{#if tournament && !canView}
			<p class="notice">Недостаточно прав для просмотра этой страницы.</p>
		{:else if tournament}
			<h2>{tournament.name}</h2>
			<div class="description-container">
				{#if tournament.divisionIndex}
					<p>Сетка {tournament.divisionIndex}</p>
				{/if}
				<div class="description-text">{@html renderMarkdown(tournament.description)}</div>
				<p>
					Рамки коста
					<span class="value-highlight"
						>{tournament.minCost}-{tournament.maxCost}</span
					>
				</p>
				<p>
					Мин. персонажей
					<span class="value-highlight"
						>{tournament.minCharacters}</span
					>
				</p>
				{#snippet tierBadge(tier: number)}
					{#if tier === 0}
						<span class="tier-badge t-newbie">NEWBIE</span>
					{:else if tier === 100}
						<span class="tier-badge t-mid">MID TIER</span>
					{:else if tier === 1000}
						<span class="tier-badge t-high">HIGH TIER</span>
					{/if}
				{/snippet}
				<p>
					Турнир по системе <span class="value-highlight"
						>{tournament.type}</span
					>
				</p>
				{#if tournament.overrideEloChange == -1}
					<p>Стандартная система начислений эло</p>
				{:else}
					<p>
						За победу поражение начисляется фиксированное эло
						<span class="value-highlight"
							>{tournament.overrideEloChange}</span
						>
					</p>
				{/if}
				<p>
					Ранги с {@render tierBadge(tournament.minTier)} по {@render tierBadge(
						tournament.maxTier,
					)}
				</p>
				<p>
					Регистрация на турнир с
					<span class="value-highlight"
						>{new Date(tournament.registrationStartDate).toLocaleString(
							"ru",
							dateDisplayOptions,
						)}</span
					>
					по
					<span class="value-highlight"
						>{new Date(tournament.registrationEndDate).toLocaleString(
							"ru",
							dateDisplayOptions,
						)}</span
					>
				</p>
				<p>
					Турнир проходит с
					<span class="value-highlight"
						>{new Date(tournament.tournamentStartDate).toLocaleString(
							"ru",
							dateDisplayOptions,
						)}</span
					>
					по
					<span class="value-highlight"
						>{new Date(tournament.tournamentEndDate).toLocaleString(
							"ru",
							dateDisplayOptions,
						)}</span
					>
				</p>

				{#if now > tournament.registrationEndDate && now < tournament.tournamentStartDate}
					<p>Регистрация закрыта</p>
				{/if}
				{#if !tournament.state && now > tournament.registrationStartDate && now < tournament.registrationEndDate}
					<p>Идёт регистрация</p>
				{/if}
				{#if tournament.state === "started"}
					<p>Турнир идёт</p>
				{/if}
				{#if tournament.state === "complete"}
					<p>Турнир окончен</p>
				{/if}

				<div class="tournament-button-container">
					{#if $isAdmin}
						<button
							class="btn-common danger"
							onclick={handleDeleteTournament}>Удалить турнир</button
						>
						{#if !tournament.state && !tournament.challongeTournamentId}
							<button
								class="btn-common"
								onclick={() => (addPlayerPopupOpen = true)}
								>Добавить игрока</button
							>
							{#if !tournament.divisionGroupId}
								<button
									class="btn-common"
									onclick={() => (splitPopupOpen = true)}
									>Разделить на сетки</button
								>
							{/if}
							<button
								class="btn-common btn-play"
								onclick={handleStartTournament}>Начать турнир</button
							>
						{/if}
						{#if tournament.state === "started"}
							<button
								class="btn-common btn-play"
								onclick={handleUpdateTournamentGames}
								>Принудительно обновить игры</button
							>
						{/if}
						{#if tournament.state === "awaiting_review"}
							<button
								class="btn-common btn-play"
								onclick={handleFinishTournament}
								>Закончить турнир</button
							>
						{/if}
					{/if}
					{#if $currentUser && tierEligible && !tournament.state && now > tournament.registrationStartDate && now < tournament.registrationEndDate}
						<a
							class="btn-common btn-play"
							href={resolve(`/tournaments/${tournament.id}/register`)}
							>{#if myRegistration}Обновить регистрацию{:else}Зарегистрироваться{/if}</a
						>
					{/if}
				</div>
			</div>

			{#if tournament.winnerId}
				<h2 class="winner-label">
					Победил {getPlayerName(tournament.winnerId)!}
				</h2>
			{/if}

			{#if tournament.challongeTournamentUrl}
				<iframe
					title="challonge iframe"
					src="{tournament.challongeTournamentUrl}/module"
					width="100%"
					height="600"
					frameborder="0"
					scrolling="auto"
					allowtransparency={true}
				></iframe>
			{/if}

			{#if tournament.matches && tournament.matches.length > 0}
				<h2>Игры</h2>
				<div class="match-list">
					{#each filteredMatches as match}
						<div class="match-item">
							<div class="match-item-content">
								<div class="match-players">
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span
										class="match-player-name match-player-left {getPlayerClass(
											match.p1,
											match.winnerId,
											match.techLossUid,
										)}"
										onclick={() => openRegistration(match.p1)}
										>{getPlayerName(match.p1)}</span
									>
									<span class="match-vs">vs</span>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span
										class="match-player-name match-player-right {getPlayerClass(
											match.p2,
											match.winnerId,
											match.techLossUid,
										)}"
										onclick={() => openRegistration(match.p2)}
										>{getPlayerName(match.p2)}</span
									>
								</div>
							</div>

							<button
								onclick={() => openMatch(match)}
								class="btn-common btn-match">Игра</button
							>
						</div>
					{/each}
				</div>
			{/if}

		<div class="search-container">
			<h2>Участники</h2>
			<input
				class="search-input"
				placeholder="Поиск..."
				bind:value={searchQuery}
			/>
		</div>
		<div class="table-wrapper">
			<TournamentPlayerTable
				{tournament}
				{searchQuery}
				registrations={registeredPlayers}
				hideOptions={false}
				onViewRegistration={openRegistration}
			/>
		</div>
		{/if}
	</div>
</div>

{#if registrationOpen}
	<TournamentRegisterPopup
		bind:open={registrationOpen}
		{tournament}
		player={userPlayer}
		reg={userRegistration}
	></TournamentRegisterPopup>
{/if}
{#if matchOpen}
	<TournamentGamePopup
		bind:open={matchOpen}
		{tournament}
		match={currentMatch}
		{registeredPlayers}
	></TournamentGamePopup>
{/if}
{#if splitPopupOpen}
	<TournamentSplitPopup bind:open={splitPopupOpen} {tournament} {approvedCount}
	></TournamentSplitPopup>
{/if}
{#if addPlayerPopupOpen}
	<TournamentAddPlayerPopup
		bind:open={addPlayerPopupOpen}
		{tournament}
		registeredUids={registeredPlayers.map((p) => p.player.uid)}
	></TournamentAddPlayerPopup>
{/if}

<style>
	.match-item {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 0 auto;
	}

	.match-players {
		width: 440px;
	}

	.match-player-name {
		cursor: pointer;
	}

	.match-item-content {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.btn-match {
		width: 72px;
		height: 28px;
		padding: 0;
	}

	.tbd {
		color: #888;
	}

	.description-container {
		display: flex;
		flex-direction: column;
		position: relative;
		border-bottom: 1px solid #333;
		padding-right: 210px;
		padding-bottom: 16px;
	}

	.tournament-button-container {
		width: auto;
		position: absolute;
		bottom: 16px;
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tournament-button-container .btn-common {
		text-align: center;
		padding: 8px 14px;
	}

	.description-container p {
		margin: 0;
		line-height: 21px;
	}

	.description-text :global(a) {
		color: var(--gold);
		text-decoration: underline;
	}

	.description-text :global(p) {
		margin: 0;
		line-height: 21px;
	}

	.winner-label {
		width: 100%;
		font-size: 32px;
		text-align: center;
		display: block;
	}
</style>
