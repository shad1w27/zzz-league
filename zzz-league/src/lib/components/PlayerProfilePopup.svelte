<script lang="ts">
	import { resolve } from "$app/paths";
	import type { Player } from "$lib/types";
	import { closeProfilePopup } from "$lib/uiCommon";

	let { player = $bindable<Player | null>(null) } = $props();

	let stats = $derived.by(() => {
		const wins = player?.wins ?? 0;
		const losses = player?.losses ?? 0;
		const total = wins + losses;
		return {
			wins,
			losses,
			total,
			winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
		};
	});

	function getTier(p: Player) {
		if (p.isHighConfirmed) return { name: "HIGH TIER", cls: "t-high" };
		if (p.isMidConfirmed) return { name: "MID TIER", cls: "t-mid" };
		return { name: "NEWBIE", cls: "t-newbie" };
	}
</script>

<div class="popup">
	<div class="card profile-card">
		{#if !player}
			<h1>Игрок не найден</h1>
		{:else}
			{@const tier = getTier(player)}

			<h1 id="profName">{player.name}</h1>
			<div id="profTier">
				<span class="tier-badge {tier.cls}">{tier.name}</span>
			</div>
			<div id="discordTag">Discord: {player.discord ?? "-"}</div>

			<div class="stat-grid">
				<div class="stat-item">
					<div class="stat-label">Всего игр</div>
					<div id="totalGames" class="stat-value">{stats.total}</div>
				</div>
				<div class="stat-item">
					<div class="stat-label">Винрейт</div>
					<div id="winRate" class="stat-value winrate">
						{stats.winRate}%
					</div>
				</div>
				<div class="stat-item">
					<div class="stat-label">Победы</div>
					<div id="wins" class="stat-value gain">{stats.wins}</div>
				</div>
				<div class="stat-item">
					<div class="stat-label">Поражения</div>
					<div id="losses" class="stat-value loss">{stats.losses}</div>
				</div>
			</div>

			<a
				class="btn-common btn-history"
				href={resolve(`/history/${player.uid}`)}
				onclick={closeProfilePopup}
			>
				История матчей
			</a>

			<button class="btn-common back-btn" onclick={closeProfilePopup}
				>← Закрыть</button
			>
		{/if}
	</div>
</div>

<style>
	.profile-card {
		text-align: center;
	}

	.btn-history {
		margin-top: 14px;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 15px;
		margin-top: 25px;
	}

	.stat-item {
		background: #222;
		padding: 20px;
		border-radius: 12px;
		border: 1px solid #333;
	}

	.stat-label {
		font-size: 0.8em;
		color: #888;
		text-transform: uppercase;
		margin-bottom: 5px;
	}

	.stat-value {
		font-size: 1.5em;
		font-weight: bold;
	}

	.winrate {
		color: #2eb82e;
	}
</style>
