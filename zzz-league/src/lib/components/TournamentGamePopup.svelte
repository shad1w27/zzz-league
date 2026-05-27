<script lang="ts">
	import { currentUser } from "$lib/store";
	import { bustCache, openImagePopup } from "$lib/uiCommon";

	let {
		open = $bindable(false),
		tournament = $bindable(),
		match = $bindable(),
		registeredPlayers = $bindable([]),
	} = $props();

	let myGame = $derived(
		$currentUser?.uid == match.p1 || $currentUser?.uid == match.p2,
	);

	function getPlayerName(uid: string) {
		return registeredPlayers.find((p) => p.player.uid === uid)?.player.name;
	}

	function getPlayerClass(player: string, winnerId: string) {
		if (!winnerId) return "";

		return player === winnerId ? "match-winner" : "match-loser";
	}
</script>

<div class="popup">
	<div class="card">
		<div class="match-players">
			<span
				class="match-player-name match-player-left {getPlayerClass(
					match.p1,
					match.winnerId,
				)}">{getPlayerName(match.p1)}</span
			>
			<span class="match-vs">vs</span>
			<span
				class="match-player-name match-player-right {getPlayerClass(
					match.p2,
					match.winnerId,
				)}">{getPlayerName(match.p2)}</span
			>
			{#if match.resultP1 && match.resultP2}
				<span class="match-player-left">match.resultP1</span>
				<span> </span>
				<span class="match-player-right">match.resultP2</span>
			{/if}
		</div>

		{#if match.resultScreenshot}
			<button
				class="img-btn"
				onclick={() => openImagePopup(match.resultScreenshot)}
			>
				<img src={bustCache(match.resultScreenshot)} alt="" />
			</button>
		{/if}

		{#if match.winnerId}
			<span>Результат</span>
			{#if match.resultScreenshot}
				<button
					class="img-btn"
					onclick={() => openImagePopup(match.resultScreenshot)}
				>
					<img src={bustCache(match.resultScreenshot)} alt="" />
				</button>
			{/if}
		{:else if myGame}
			<button class="btn-common back-btn" onclick={() => (open = false)}
				>Подтвердить результат</button
			>
		{/if}

		<button class="btn-common back-btn" onclick={() => (open = false)}
			>← Закрыть</button
		>
	</div>
</div>

<style>
	.match-players {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
	}

	.match-player-name {
		font-weight: bold;
		color: white;
		font-size: 22px;
	}

	.match-player-left {
		text-align: right;
	}

	.match-player-right {
		text-align: left;
	}

	.match-vs {
		text-align: center;
		color: #666;
		white-space: nowrap;
	}

	.match-winner {
		color: var(--green);
	}

	.match-loser {
		color: var(--loss);
	}

	.back-btn {
		margin-top: 10px;
	}

	.img-btn {
		background: none;
		border: none;
		padding: 0;
		width: 100%;
	}

	.img-btn img {
		width: 100%;
		height: auto;
		object-fit: contain;
		border-radius: 8px;
		cursor: pointer;
	}
</style>
