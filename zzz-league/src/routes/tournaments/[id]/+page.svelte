<script lang="ts">
	import { page } from "$app/state";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import TournamentGamePopup from "$lib/components/TournamentMatchPopup.svelte";
	import TournamentPlayerTable from "$lib/components/TournamentPlayerTable.svelte";
	import TournamentRegisterPopup from "$lib/components/TournamentRegisterPopup.svelte";
	import { db, startChallongeTournament } from "$lib/firebase";
	import { currentUser, isAdmin } from "$lib/store";
	import type {
		Player,
		RegisteredPlayer,
		Tournament,
		TournamentMatch,
		TournamentRegistration,
	} from "$lib/types";
	import { dateDisplayOptions } from "$lib/uiCommon";
	import { get, onValue, ref } from "firebase/database";
	import { onMount } from "svelte";

	const id = $derived(page.params.id);

	let now = $state(Date.now());
	let tournament = $state<Tournament>();
	let userRegistration = $state<TournamentRegistration | null>();
	let myRegistration = $state<TournamentRegistration | null>();
	let registeredPlayers = $state<RegisteredPlayer[]>([]);
	let searchQuery = $state("");
	let registrationOpen = $state(false);
	let matchOpen = $state(false);
	let currentMatchId = $state();
	let currentMatch = $derived(
		tournament?.matches.find((m: TournamentMatch) => m.id === currentMatchId),
	);

	let filteredMatches = $derived(
		tournament?.matches.filter(
			(m: TournamentMatch) => !(m.p1 === "TBD" || m.p2 === "TBD"),
		),
	);

	let unsubRegistration: (() => void) | null = null;

	$effect(() => {
		if ($currentUser) {
			unsubRegistration?.();
			unsubRegistration = onValue(
				ref(db, `tournamentRegistrations/${id}/${$currentUser.uid}`),
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

	function getPlayerName(uid: string) {
		return registeredPlayers.find((p) => p.player.uid === uid)?.player.name;
	}

	function getPlayerClass(player: string, winnerId: string) {
		if (!winnerId) return "";

		return player === winnerId ? "match-winner" : "match-loser";
	}

	function openRegistration(uid: string) {
		userRegistration = registeredPlayers.find(
			(p) => p.player.uid === uid,
		)?.registration;
		if (userRegistration) registrationOpen = true;
	}

	function openMatch(match: TournamentMatch) {
		currentMatchId = match.id;
		matchOpen = true;
	}

	function openMyRegistration() {
		userRegistration = myRegistration;
		registrationOpen = true;
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
			ref(db, "tournamentRegistrations/" + id),
			async (snap) => {
				const data = snap.val();

				if (!data) return;

				const registrations = Object.values(
					data,
				) as TournamentRegistration[];

				const result = await Promise.all(
					registrations.map(async (registration) => {
						const playerSnap = await get(
							ref(db, "players/" + registration.uid),
						);

						if (!playerSnap.exists()) return null;

						return {
							player: playerSnap.val() as Player,
							registration,
						};
					}),
				);

				registeredPlayers = result.filter(Boolean) as RegisteredPlayer[];
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
		{#if tournament}
			<h2>{tournament.name}</h2>
			<div class="description-container">
				<p>{tournament.description}</p>
				<p>Рамки коста {tournament.minCost}-{tournament.maxCost}</p>
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
					Ранги с {@render tierBadge(tournament.minTier)} по {@render tierBadge(
						tournament.maxTier,
					)}
				</p>
				<p>
					Регистрация на турнир с
					{new Date(tournament.registrationStartDate).toLocaleString(
						"ru",
						dateDisplayOptions,
					)}
					по {new Date(tournament.registrationEndDate).toLocaleString(
						"ru",
						dateDisplayOptions,
					)}
				</p>
				<p>
					Турнир проходит с
					{new Date(tournament.tournamentStartDate).toLocaleString(
						"ru",
						dateDisplayOptions,
					)}
					по {new Date(tournament.tournamentEndDate).toLocaleString(
						"ru",
						dateDisplayOptions,
					)}
				</p>

				{#if now > tournament.registrationEndDate && now < tournament.tournamentStartDate}
					<p>Регистрация закрыта</p>
				{/if}
				{#if now > tournament.registrationStartDate && now < tournament.registrationEndDate}
					<p>Идёт регистрация</p>
				{/if}
				{#if tournament.state === "started" || (now > tournament.tournamentStartDate && now < tournament.tournamentEndDate)}
					<p>Турнир идёт</p>
				{/if}
				{#if tournament.state !== "finished" || now > tournament.tournamentEndDate}
					<p>Турнир окончен</p>
				{/if}

				{#if tournament.state !== "started" && now > tournament.registrationStartDate && now < tournament.registrationEndDate}
					<button class="btn-common btn-play" onclick={openMyRegistration}
						>{#if userRegistration}Обновить регистрацию{:else}Зарегистрироваться{/if}</button
					>
				{/if}
				{#if $isAdmin && !tournament.challongeTournamentId}
					<button
						class="btn-common btn-play"
						onclick={handleStartTournament}>Начать турнир</button
					>
				{/if}
			</div>

			{#if tournament.challongeTournamentUrl}
				<iframe
					title="challonge iframe"
					src="{tournament.challongeTournamentUrl}/module"
					width="100%"
					height="500"
					frameborder="0"
					scrolling="auto"
					allowtransparency={true}
				></iframe>
			{/if}

			{#if tournament.matches}
				<h2>Игры</h2>
				<div class="match-list">
					{#each filteredMatches as match}
						<div class="match-item">
							<div class="match-players">
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="match-player-name match-player-left {getPlayerClass(
										match.p1,
										match.winnerId,
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
									)}"
									onclick={() => openRegistration(match.p2)}
									>{getPlayerName(match.p2)}</span
								>
							</div>

							<button
								onclick={() => openMatch(match)}
								class="btn-common btn-match">Игра</button
							>
						</div>
					{/each}
				</div>
			{/if}
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
			/>
		</div>
	</div>
</div>

{#if registrationOpen}
	<TournamentRegisterPopup
		bind:open={registrationOpen}
		{tournament}
		reg={userRegistration}
		editable={userRegistration?.uid === myRegistration?.uid &&
			now < tournament!.registrationEndDate}
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

<style>
	.match-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.match-item {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 0 auto;
	}

	.match-players {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		width: 400px;
	}

	.match-player-name {
		cursor: pointer;
		font-weight: bold;
		color: white;
		font-size: 22px;
	}

	.match-player-left {
		text-align: right;
	}

	.match-player-right {
		text-align: left;
	}

	.match-vs {
		text-align: center;
		color: #666;
		white-space: nowrap;
	}

	.match-winner {
		color: var(--green);
	}

	.match-loser {
		color: var(--loss);
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

	.description-container button {
		width: auto;
		position: absolute;
		bottom: 16px;
		right: 0;
	}

	.description-container p {
		margin: 0;
	}
</style>
