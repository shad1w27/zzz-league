<script lang="ts">
	import { page } from "$app/state";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import { db } from "$lib/firebase";
	import { onValue, ref } from "firebase/database";

	const id = $derived(page.params.id);

	let matches = $state([]);

	function getPlayerName(uid: string) {
		// return registeredPlayers.find((p) => p.player.uid === uid)?.player.name;
	}

	function getPlayerClass(player: string, winnerId: string) {
		if (!winnerId) return "";

		return player === winnerId ? "match-winner" : "match-loser";
	}

	$effect(() => {
		const historyRef = ref(db, `historyV3/tournaments`);

		const unsubscribe = onValue(historyRef, (snapshot) => {
			const data = snapshot.val();
			if (!data) return;

			/* matches = Object.values(data)
				.flatMap((tournament) => Object.values(tournament))
				.filter((match) => match.p1 === id || match.p2 === id); */
		});

		return () => unsubscribe();
	});
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		<h2>Игры</h2>
		<div class="match-list">
			{#each matches as match}
				<div class="match-item">
					<div class="match-players">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span
							class="match-player-name match-player-left {getPlayerClass(
								match.p1,
								match.winnerId,
							)}">{getPlayerName(match.p1)}</span
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
	</div>
</div>
