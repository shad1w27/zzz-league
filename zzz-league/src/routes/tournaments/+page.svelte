<script lang="ts">
	import { onMount } from "svelte";
	import { db } from "$lib/firebase";
	import { ref, onValue } from "firebase/database";
	import type { Tournament } from "$lib/types";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import TournamentCard from "$lib/components/TournamentCard.svelte";

	let allTournaments = $state<Tournament[]>([]);
	let now = $state(Date.now());

	let sortedTournaments = $derived(
		[...allTournaments].sort(
			(a, b) => b.tournamentStartDate - a.tournamentStartDate,
		),
	);

	onMount(() => {
		const unsubTournaments = onValue(ref(db, "tournaments"), (snap) => {
			const val = snap.val();
			allTournaments = val ? (Object.values(val) as Tournament[]) : [];
		});

		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			unsubTournaments();
			clearInterval(interval);
		};
	});
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		<h2>Архив турниров</h2>
		{#if sortedTournaments.length > 0}
			<div class="tournament-container">
				{#each sortedTournaments as tournament}
					<TournamentCard {tournament} {now} />
				{/each}
			</div>
		{:else}
			<p class="empty-label">Турниров пока нет</p>
		{/if}
	</div>
</div>

<style>
	.empty-label {
		color: #888;
	}
</style>
