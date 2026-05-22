<script lang="ts">
	import { page } from "$app/state";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import TournamentPlayerTable from "$lib/components/TournamentPlayerTable.svelte";
	import TournamentRegisterPopup from "$lib/components/TournamentRegisterPopup.svelte";
	import { db } from "$lib/firebase";
	import { currentUser } from "$lib/store";
	import type {
		Player,
		RegisteredPlayer,
		Tournament,
		TournamentRegistration,
	} from "$lib/types";
	import { dateDisplayOptions } from "$lib/uiCommon";
	import { get, onValue, ref } from "firebase/database";
	import { onMount } from "svelte";

	const id = $derived(page.params.id);

	let now = $state(Date.now());
	let tournament = $state<Tournament>();
	let userRegistration = $state<TournamentRegistration | null>();
	let registeredPlayers = $state<RegisteredPlayer[]>([]);
	let searchQuery = $state("");
	let registrationOpen = $state(false);

	let unsubRegistration: (() => void) | null = null;

	$effect(() => {
		if ($currentUser) {
			unsubRegistration?.();
			unsubRegistration = onValue(
				ref(db, `tournamentRegistrations/${id}/${$currentUser.uid}`),
				(snap) => {
					const data = snap.val();
					if (!data) return;
					userRegistration = data as TournamentRegistration;
				},
			);
		} else {
			unsubRegistration?.();
			unsubRegistration = null;
			userRegistration = null;
		}
	});

	onMount(() => {
		const unsubTournament = onValue(ref(db, "tournaments/" + id), (snap) => {
			tournament = snap.val() ?? {};
		});

		const unsubRegistrations = onValue(
			ref(db, "tournamentRegistrations/" + id),
			async (snap) => {
				const data = snap.val();

				if (!data) {
					return;
				}

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
				{#if now > tournament.tournamentStartDate && now < tournament.tournamentEndDate}
					<p>Турнир идёт</p>
				{/if}
				{#if now > tournament.tournamentEndDate}
					<p>Турнир окончен</p>
				{/if}

				{#if now > tournament.registrationStartDate && now < tournament.registrationEndDate}
					<button
						class="btn-common btn-play"
						onclick={() => (registrationOpen = true)}
						>{#if userRegistration}Обновить регистрацию{:else}Зарегистрироваться{/if}</button
					>
				{/if}
			</div>
		{/if}
		<div class="search-container">
			<div></div>
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
	></TournamentRegisterPopup>
{/if}

<style>
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
