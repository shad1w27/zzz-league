<script lang="ts">
	import { page } from "$app/state";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import TournamentPlayerTable from "$lib/components/TournamentPlayerTable.svelte";
	import TournamentRegisterPopup from "$lib/components/TournamentRegisterPopup.svelte";
	import { db } from "$lib/firebase";
	import type {
		Player,
		RegisteredPlayer,
		Tournament,
		TournamentRegistration,
	} from "$lib/types";
	import { get, onValue, ref } from "firebase/database";
	import { onMount } from "svelte";

	const id = $derived(page.params.id);

	let tournament = $state<Tournament>();
	let registeredPlayers = $state<RegisteredPlayer[]>([]);
	let searchQuery = $state("");
	let registrationOpen = $state(false);

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

		return () => {
			unsubTournament();
			unsubRegistrations();
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

				<button class="btn-common btn-play" onclick={() => (registrationOpen = true)}
					>Зарегистрироваться</button
				>
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
				registrations={registeredPlayers}
				{searchQuery}
			/>
		</div>
	</div>
</div>

<TournamentRegisterPopup bind:open={registrationOpen} {tournament}
></TournamentRegisterPopup>
