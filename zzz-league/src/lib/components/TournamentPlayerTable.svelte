<script lang="ts">
	import { isAdmin, profileUser } from "$lib/store";
	import type { Player, RegisteredPlayer } from "$lib/types";
    import { openProfilePopup } from "$lib/uiCommon";

	interface Props {
		registrations?: RegisteredPlayer[];
		hideOptions?: boolean;
		searchQuery?: string;
	}

	let {
		registrations: registrations = [],
		hideOptions = false,
		searchQuery = "",
	}: Props = $props();

	let sortedRegs = $derived(
		[...registrations]
			.filter((p) => p.player.name)
			.sort((a, b) => (b.player.elo || 1000) - (a.player.elo || 1000)),
	);

	let filteredRegs = $derived(
		[...sortedRegs].filter(
			(p) =>
				!searchQuery ||
				p.player.name.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	async function handleRemoveFromTournament(uid: string) {}

	async function handleApprove(uid: string) {}

	function getTier(p: Player) {
		if (p.isHighConfirmed) return { cls: "t-high", name: "HIGH TIER" };
		if (p.isMidConfirmed) return { cls: "t-mid", name: "MID TIER" };
		return { cls: "t-newbie", name: "NEWBIE" };
	}

	function getLadderPos(p: RegisteredPlayer) {
		return sortedRegs.indexOf(p);
	}

	function getLvl(elo: number) {
		return Math.min(10, Math.floor(((elo || 1000) - 1000) / 40) + 1);
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
			<th>Подтвержден</th>
			<th>Ростер</th>
			{#if isAdmin && !hideOptions}<th>Опции</th>{/if}
		</tr>
	</thead>
	<tbody>
		{#each filteredRegs as reg, index}
			{@const elo = reg.player.elo || 1000}
			{@const tier = getTier(reg.player)}
			{@const ladderPos = getLadderPos(reg)}

			<tr>
				<td>{index + 1}</td>
				<td><span class="tier-badge {tier.cls}">{tier.name}</span></td>
				<td class="player-name">
					<button onclick={() => openProfilePopup(reg.player)}
						>{reg.player.name}</button
					>
				</td>
				<td>
					<b>{elo}</b>
					{#if reg.player.tournamentPoints}
						<small
							class={reg.player.tournamentPoints > 0 ? "gain" : "loss"}
						>
							({reg.player.tournamentPoints > 0 ? "+" : ""}{reg.player
								.tournamentPoints})
						</small>
					{/if}
				</td>
				<td><span class="lvl-badge">L{getLvl(elo)}</span></td>
				<td><span>{reg.registration.approved ? "+" : "-"}</span></td>
				<td><span>TBD</span></td>
				{#if isAdmin && !hideOptions}
					<td class="options-cell">
						<button
							class="icon-btn"
							onclick={() => handleApprove(reg.player.uid)}>⚙️</button
						>
						<button
							class="icon-btn danger"
							onclick={() => handleRemoveFromTournament(reg.player.uid)}
							>✕</button
						>
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>
