<script lang="ts">
	import { db } from "$lib/firebase";
	import { ref, get } from "firebase/database";
	import type { Player } from "$lib/types";

	interface Stats {
		wins: number;
		losses: number;
		total: number;
		winRate: number;
	}

	let { open = $bindable(false), player = $bindable<Player | null>(null) } =
		$props();

	let stats = $state<Stats>({ wins: 0, losses: 0, total: 0, winRate: 0 });
	let loading = $state(false);

	$effect(() => {
		if (open && player) loadStats(player.uid);
	});

	async function loadStats(uid: string) {
		loading = true;

		const historySnap = await get(ref(db, "history"));
		const matches = historySnap.val()
			? (Object.values(historySnap.val()) as any[])
			: [];

		let wins = 0,
			losses = 0;
		matches.forEach((m: any) => {
			if (m.p1 === uid) {
				if (m.change > 0) wins++;
				else losses++;
			} else if (m.p2 === uid) {
				if (m.change < 0) wins++;
				else losses++;
			}
		});

		const total = wins + losses;
		stats = {
			wins,
			losses,
			total,
			winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
		};
		loading = false;
	}

	function getTier(p: Player) {
		if (p.isHighConfirmed) return { name: "HIGH TIER", cls: "t-high" };
		if (p.isMidConfirmed) return { name: "MID TIER", cls: "t-mid" };
		return { name: "NEWBIE", cls: "t-newbie" };
	}
</script>

{#if open}
	<div class="popup">
		<div class="card profile-card">
			{#if loading}
				<h1>Загрузка...</h1>
			{:else if !player}
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

				<button class="btn-common back-btn" onclick={() => (open = false)}
					>← Закрыть</button
				>
			{/if}
		</div>
	</div>
{/if}
