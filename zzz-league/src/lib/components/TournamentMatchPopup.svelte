<script lang="ts">
	import { approveResult } from "$lib/firebase";
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

	let inputScreenshot = $state<FileList | null>(null);
	let matchResultP1 = $state(match.resultP1 ?? "00:00");
	let matchResultP2 = $state(match.resultP2 ?? "00:00");

	function getPlayerName(uid: string) {
		return registeredPlayers.find((p) => p.player.uid === uid)?.player.name;
	}

	function getPlayerClass(player: string, winnerId: string) {
		if (!winnerId) return "";

		return player === winnerId ? "match-winner" : "match-loser";
	}

	let isApproving = false;
	async function handleApproveResult() {
		if (isApproving) return;
		if (!matchResultP1 || !matchResultP2) return;
		try {
			const resultScreenshot = inputScreenshot?.[0];
			isApproving = true;
			await approveResult(
				tournament.id,
				match.id,
				matchResultP1,
				matchResultP2,
				resultScreenshot,
			);
		} catch (error) {
			alert(error);
		} finally {
			isApproving = false;
		}
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
				<span class="match-player-left">{match.resultP1}</span>
				<span> </span>
				<span class="match-player-right">{match.resultP2}</span>
			{/if}
		</div>
		{#if match.state !== "complete" && myGame}
			<hr style="width: 100%" />
			<div class="match-players">
				<span class="match-player-left"
					>Введите время {getPlayerName(match.p1)}</span
				>
				<span> </span>
				<span class="match-player-right"
					>Введите время {getPlayerName(match.p2)}</span
				>
				<input
					class="time-input match-player-left"
					type="time"
					step="60"
					lang="en-GB"
					bind:value={matchResultP1}
				/>
				<span> </span>
				<input
					class="time-input match-player-right"
					type="time"
					step="60"
					lang="en-GB"
					bind:value={matchResultP2}
				/>
			</div>
		{/if}

		{#if match.resultScreenshot}
			<span>Результат</span>
			<button
				class="img-btn"
				onclick={() => openImagePopup(match.resultScreenshot)}
			>
				<img src={bustCache(match.resultScreenshot)} alt="" />
			</button>
		{/if}
		{#if match.state !== "complete" && myGame}
			<span>Загрузить скриншот результатов</span>
			<input
				class="input-screenshot"
				type="file"
				accept="image/*"
				bind:files={inputScreenshot}
			/>
			<button class="btn-common" onclick={handleApproveResult}
				>Подтвердить результат {match.p1ApprovedResult ? "✅" : "❌"}
				{match.p2ApprovedResult ? "✅" : "❌"}</button
			>
		{/if}

		<button class="btn-common back-btn" onclick={() => (open = false)}
			>← Закрыть</button
		>
	</div>
</div>

<style>
	.card {
		width: 420px;
		justify-content: center;
		align-items: center;
		gap: 16px;
	}

	.input-screenshot {
		width: 240px;
	}

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
		align-items: flex-end;
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
		margin-top: 0px;
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
