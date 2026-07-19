<script lang="ts">
	import { resolve } from "$app/paths";
	import type { Tournament } from "$lib/types";
	import {
		TOURNAMENT_STATE,
		isRegistrationClosed,
		isRegistrationOpen,
	} from "$lib/tournamentState";
	import { dateDisplayOptions } from "$lib/uiCommon";

	let { tournament, now }: { tournament: Tournament; now: number } = $props();

	let status = $derived(
		tournament.state === TOURNAMENT_STATE.COMPLETE
			? "ended"
			: tournament.state === TOURNAMENT_STATE.AWAITING_REVIEW ||
				  tournament.state === TOURNAMENT_STATE.STARTED
				? "ongoing"
				: isRegistrationOpen(tournament.state) &&
					  now > tournament.registrationStartDate
					? "registration"
					: "upcoming",
	);
</script>

<a
	class="tournament status-{status}"
	href={resolve(`/tournaments/${tournament.id}`)}
>
	<p class="tournament-name">{tournament.name}</p>
	<p class="tournament-dates">
		{new Date(tournament.tournamentStartDate).toLocaleString(
			"ru",
			dateDisplayOptions,
		)}
		- {new Date(tournament.tournamentEndDate).toLocaleString(
			"ru",
			dateDisplayOptions,
		)}
	</p>
	{#if isRegistrationOpen(tournament.state) && now > tournament.registrationStartDate}
		<p class="tournament-status">
			Регистрация до {new Date(
				tournament.registrationEndDate,
			).toLocaleString("ru", dateDisplayOptions)}
		</p>
	{/if}
	{#if isRegistrationClosed(tournament.state)}
		<p class="tournament-status">
			Начало {new Date(tournament.tournamentStartDate).toLocaleString(
				"ru",
				dateDisplayOptions,
			)}
		</p>
	{/if}
	{#if tournament.state === TOURNAMENT_STATE.STARTED || tournament.state === TOURNAMENT_STATE.AWAITING_REVIEW}
		<p class="tournament-status">Турнир идёт</p>
	{/if}
	{#if tournament.state === TOURNAMENT_STATE.COMPLETE}
		<p class="tournament-status">Турнир окончен</p>
	{/if}
</a>

<style>
	.tournament {
		--accent: #555;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		min-width: 220px;
		font-size: 13px;
		text-align: left;
		padding: 14px 16px;
		background: #202020;
		border-radius: 10px;
		border-left: 12px solid var(--accent);
		transition: all 0.15s;
	}

	.tournament:hover {
		transform: translateY(-2px);
	}

	.tournament-name {
		font-size: 15px;
		font-weight: bold;
		color: #fff;
	}

	.tournament-dates {
		color: #888;
	}

	.tournament-status {
		align-self: flex-start;
		margin-top: 2px;
		padding: 3px 10px;
		border-radius: 20px;
		font-size: 11px;
		font-weight: bold;
		text-transform: uppercase;
	}

	.tournament.status-upcoming {
		--accent: #5e8ee0;
	}

	.tournament.status-upcoming .tournament-status {
		background: rgba(94, 142, 224, 0.15);
		color: #5e8ee0;
	}

	.tournament.status-registration {
		--accent: var(--green);
	}

	.tournament.status-registration .tournament-status {
		background: rgba(46, 163, 75, 0.15);
		color: var(--green);
	}

	.tournament.status-ongoing {
		--accent: var(--gold);
	}

	.tournament.status-ongoing .tournament-status {
		background: rgba(255, 204, 0, 0.15);
		color: var(--gold);
	}

	.tournament.status-ended {
		--accent: #555;
		opacity: 0.55;
	}

	.tournament.status-ended .tournament-status {
		background: rgba(255, 255, 255, 0.06);
		color: #888;
	}
</style>
