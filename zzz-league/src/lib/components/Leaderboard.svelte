<script lang="ts">
	import { deletePlayer, updatePlayerElo } from "$lib/firebase";
	import { isAdmin } from "$lib/store";
	import type { Player } from "$lib/types";
	import { getLvl, getTier, openProfilePopup } from "$lib/uiCommon";
	import PointsDelta from "$lib/components/PointsDelta.svelte";

	interface Props {
		players?: Player[];
		hideOptions?: boolean;
		searchQuery?: string;
	}

	let {
		players = [],
		hideOptions = false,
		searchQuery = "",
	}: Props = $props();

	let sortedPlayers = $derived(
		[...players]
			.filter((p) => p?.name)
			.sort((a, b) => (b.elo || 1000) - (a.elo || 1000)),
	);

	let filteredPlayers = $derived(
		[...sortedPlayers].filter(
			(p) =>
				!searchQuery ||
				p.name.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	async function handleUpdatePlayerElo(uid: string, currentElo: number) {
		const val = prompt("Новое ELO:", String(currentElo));
		if (!val) return;
		const elo = parseInt(val);
		if (isNaN(elo)) return;
		try {
			await updatePlayerElo(uid, elo);
		} catch (e: any) {
			alert(e.message);
		}
	}

	async function handleDelete(uid: string) {
		if (!confirm("Удалить игрока?")) return;
		try {
			await deletePlayer(uid);
		} catch (e: any) {
			alert(e.message);
		}
	}

	function getLadderPos(p: Player) {
		return sortedPlayers.indexOf(p);
	}
</script>

<table>
	<thead>
		<tr>
			<th>№</th>
			<th>Тир</th>
			<th>Игрок</th>
			<th>ELO</th>
			<th>LVL</th>
			{#if $isAdmin && !hideOptions}<th>Опции</th>{/if}
		</tr>
	</thead>
	<tbody>
		{#each filteredPlayers as player, index}
			{@const elo = player.elo || 1000}
			{@const tier = getTier(player)}
			{@const ladderPos = getLadderPos(player)}

			<tr class={ladderPos < 3 ? `top-${ladderPos + 1}` : ""}>
				<td>{index + 1}</td>
				<td><span class="tier-badge {tier.cls}">{tier.name}</span></td>
				<td class="player-name">
					<button
						class="hover-emphasis"
						onclick={() => openProfilePopup(player)}>{player.name}</button
					>
				</td>
				<td>
					<b>{elo}</b>
					<PointsDelta points={player.tournamentPoints} />
				</td>
				<td><span class="lvl-badge">L{getLvl(elo)}</span></td>
				{#if $isAdmin && !hideOptions}
					<td class="options-cell">
						<button
							class="icon-btn"
							onclick={() => handleUpdatePlayerElo(player.uid, elo)}
							>⚙️</button
						>
						<button
							class="icon-btn danger"
							onclick={() => handleDelete(player.uid)}>✕</button
						>
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>
