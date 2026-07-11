<script lang="ts">
	import { approveRegistration } from "$lib/firebase";
	import { isAdmin } from "$lib/store";
	import type { Player, RegisteredPlayer, Tournament } from "$lib/types";
	import { openProfilePopup } from "$lib/uiCommon";

	interface Props {
		registrations: RegisteredPlayer[];
		tournament?: Tournament;
		hideOptions: boolean;
		searchQuery: string;
		onViewRegistration?: (uid: string) => void;
	}

	let {
		registrations: registrations = [],
		hideOptions = false,
		searchQuery = "",
		tournament = undefined,
		onViewRegistration = undefined,
	}: Props = $props();

	let sortedRegs = $derived(
		[...registrations]
			.filter((p) => p.player.name)
			.sort(
				(a, b) =>
					a.registration.registrationTimestamp -
					b.registration.registrationTimestamp,
			),
	);

	let filteredRegs = $derived(
		[...sortedRegs].filter(
			(p) =>
				!searchQuery ||
				p.player.name.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	async function handleApprove(uid: string, approved: boolean) {
		approveRegistration(tournament!.id, uid, !approved);
	}

	function getTier(p: Player) {
		if (p.isHighConfirmed) return { cls: "t-high", name: "HIGH TIER" };
		if (p.isMidConfirmed) return { cls: "t-mid", name: "MID TIER" };
		return { cls: "t-newbie", name: "NEWBIE" };
	}

	function getLvl(elo: number) {
		return Math.min(10, Math.floor(((elo || 1000) - 1000) / 40) + 1);
	}

	let canViewRegistrations = $derived($isAdmin || !!tournament?.state);
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
			{#if canViewRegistrations}<th>Рега</th>{/if}
			{#if $isAdmin && !hideOptions}<th>Опции</th>{/if}
		</tr>
	</thead>
	<tbody>
		{#each filteredRegs as reg, index}
			{@const elo = reg.player.elo || 1000}
			{@const tier = getTier(reg.player)}
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
				<td><span>{reg.registration.approved ? "✅" : "❌"}</span></td>
				{#if canViewRegistrations}
					<td>
						<button
							class="icon-btn"
							onclick={() => onViewRegistration?.(reg.player.uid)}
							>Смотреть</button
						>
					</td>
				{/if}
				{#if $isAdmin && !hideOptions}
					<td class="options-cell">
						<button
							class="icon-btn"
							onclick={() =>
								handleApprove(
									reg.player.uid,
									reg.registration.approved,
								)}>⚙️</button
						>
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>
