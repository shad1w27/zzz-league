<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import { db, splitTournament } from "$lib/firebase";
	import { isAdmin, playersByUid } from "$lib/store";
	import type { Tournament, TournamentRegistration } from "$lib/types";
	import { hasTournamentStarted } from "$lib/tournamentState";
	import { get, ref } from "firebase/database";
	import { onMount, untrack } from "svelte";

	const id = $derived(page.params.id!);

	type PoolPlayer = { uid: string; name: string };

	let loaded = $state(false);
	let loadError = $state("");
	let tournament = $state<Tournament>();

	let approvedPlayers = $state<PoolPlayer[]>([]);
	let divisionCount = $state(2);
	let divisionSizes = $state<number[]>([2, 2]);
	let groups = $state<string[][]>([[], []]);

	let assignedUids = $derived(new Set(groups.flat()));
	let pool = $derived(approvedPlayers.filter((p) => !assignedUids.has(p.uid)));

	let maxDivisionCount = $derived(
		Math.max(2, Math.floor(approvedPlayers.length / 2)),
	);
	let canSplit = $derived(loaded && approvedPlayers.length >= 4);

	$effect(() => {
		const n = Math.max(2, divisionCount || 0);
		if (divisionSizes.length < n) {
			divisionSizes = [
				...divisionSizes,
				...Array(n - divisionSizes.length).fill(2),
			];
			groups = [
				...groups,
				...Array.from({ length: n - groups.length }, () => []),
			];
		} else if (divisionSizes.length > n) {
			divisionSizes = divisionSizes.slice(0, n);
			groups = groups.slice(0, n);
		}
	});

	$effect(() => {
		const max = maxDivisionCount;
		untrack(() => {
			if (divisionCount > max) {
				divisionCount = max;
			}
		});
	});

	function clampDivisionCount() {
		if (!Number.isFinite(divisionCount) || divisionCount < 2) {
			divisionCount = 2;
		} else if (divisionCount > maxDivisionCount) {
			divisionCount = maxDivisionCount;
		}
	}

	function clampDivisionSize(i: number) {
		if (!Number.isFinite(divisionSizes[i]) || divisionSizes[i] < 2) {
			divisionSizes[i] = 2;
		}
	}

	let validationError = $derived.by(() => {
		if (!canSplit) {
			return `Недостаточно одобренных игроков для разделения (нужно минимум 4, сейчас ${approvedPlayers.length})`;
		}
		if (!Number.isFinite(divisionCount) || divisionCount < 2) {
			return "Должно быть минимум 2 сетки";
		}
		if (divisionCount > maxDivisionCount) {
			return `Слишком много сеток: максимум ${maxDivisionCount} при ${approvedPlayers.length} игроках`;
		}
		const smallIndex = divisionSizes.findIndex(
			(n) => !Number.isFinite(n) || n < 2,
		);
		if (smallIndex !== -1) {
			return `В сетке ${smallIndex + 1} должно быть минимум 2 игрока`;
		}
		if (pool.length > 0) {
			return `Не все игроки распределены (осталось ${pool.length})`;
		}
		const mismatchIndex = groups.findIndex(
			(g, i) => g.length !== divisionSizes[i],
		);
		if (mismatchIndex !== -1) {
			return `В сетке ${mismatchIndex + 1} распределено ${groups[mismatchIndex].length} игроков, а задано ${divisionSizes[mismatchIndex]}`;
		}
		return null;
	});

	function shufflePlayers() {
		const shuffled = [...approvedPlayers];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		const next: string[][] = [];
		let offset = 0;
		for (const size of divisionSizes) {
			next.push(shuffled.slice(offset, offset + size).map((p) => p.uid));
			offset += size;
		}
		groups = next;
	}

	let draggedUid = $state<string | null>(null);

	function handleDragStart(uid: string) {
		draggedUid = uid;
	}

	function handleDragEnd() {
		draggedUid = null;
	}

	function removeFromGroups(uid: string) {
		return groups.map((g) => g.filter((u) => u !== uid));
	}

	function isDivisionFull(index: number) {
		return groups[index].length >= divisionSizes[index];
	}

	function canDropOnDivision(index: number) {
		if (!draggedUid) return false;
		if (groups[index].includes(draggedUid)) return true;
		return !isDivisionFull(index);
	}

	function moveToDivision(index: number) {
		if (!canDropOnDivision(index)) return;
		const uid = draggedUid!;
		const next = removeFromGroups(uid);
		next[index] = [...next[index], uid];
		groups = next;
		draggedUid = null;
	}

	function moveToPool() {
		if (!draggedUid) return;
		groups = removeFromGroups(draggedUid);
		draggedUid = null;
	}

	onMount(async () => {
		try {
			const snap = await get(ref(db, "tournaments/" + id));
			const data = snap.val() as Tournament | null;
			if (!data) {
				loadError = "Турнир не найден.";
				return;
			}
			if (hasTournamentStarted(data.state) || data.challongeTournamentId) {
				loadError = "Турнир уже начался, разделение недоступно.";
				return;
			}
			if (data.divisionGroupId) {
				loadError = "Турнир уже разделён на сетки.";
				return;
			}
			tournament = data;

			const regSnap = await get(ref(db, `tournaments/${id}/registrations`));
			const regData = regSnap.val();
			const registrations: TournamentRegistration[] = regData
				? Object.values(regData)
				: [];

			approvedPlayers = registrations
				.filter((r) => r.approved)
				.map((r) => ({
					uid: r.uid,
					name: $playersByUid.get(r.uid)?.name ?? r.uid,
				}));
		} catch (e: any) {
			loadError = e.message;
		} finally {
			loaded = true;
		}
	});

	let status = $state("");
	let isSplitting = $state(false);
	async function handleSplit() {
		if (isSplitting) return;
		if (validationError) {
			status = validationError;
			return;
		}
		if (!confirm(`Разделить турнир на ${divisionCount} сетки?`)) return;

		isSplitting = true;
		try {
			await splitTournament(id, groups);
			await goto(resolve(`/tournaments/${id}`));
		} catch (e: any) {
			status = e.message;
		} finally {
			isSplitting = false;
		}
	}
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		{#if !$isAdmin}
			<p class="notice">Недостаточно прав для просмотра этой страницы.</p>
		{:else if !loaded}
			<h2>Разделить на сетки</h2>
			<p class="notice">Загрузка...</p>
		{:else if loadError}
			<h2>Разделить на сетки</h2>
			<p class="notice">{loadError}</p>
		{:else}
			<h2>Разделить турнир "{tournament?.name}" на сетки? Отменить нельзя.)</h2>

			{#if !canSplit}
				<p class="notice">
					Недостаточно одобренных игроков для разделения (нужно минимум 4,
					сейчас {approvedPlayers.length}).
				</p>
				<div class="btn-row">
					<a class="btn-common" href={resolve(`/tournaments/${id}`)}>Назад</a
					>
				</div>
			{:else}
				<div class="form-row">
					<label for="division-count">Количество сеток</label>
					<input
						id="division-count"
						type="number"
						min="2"
						max={maxDivisionCount}
						bind:value={divisionCount}
						onblur={clampDivisionCount}
					/>
				</div>
				<p class="hint">Максимум сеток: {maxDivisionCount}</p>
				<p class="hint">
					Всего распределено: {approvedPlayers.length - pool.length} / {approvedPlayers.length}
				</p>

				<div class="split-toolbar">
					<button class="btn-common" onclick={shufflePlayers}>
						Перемешать
					</button>
				</div>

				<div class="split-columns">
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="split-column pool-column"
						ondragover={(e) => e.preventDefault()}
						ondrop={moveToPool}
					>
						<h3>Не распределены ({pool.length})</h3>
						<div class="player-list">
							{#each pool as player (player.uid)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="player-card"
									draggable="true"
									ondragstart={() => handleDragStart(player.uid)}
									ondragend={handleDragEnd}
								>
									{player.name}
								</div>
							{/each}
						</div>
					</div>

					{#each groups as group, i}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="split-column"
							ondragover={(e) => {
								if (canDropOnDivision(i)) e.preventDefault();
							}}
							ondrop={() => moveToDivision(i)}
						>
							<h3 class:division-full={isDivisionFull(i)}>Сетка {i + 1}</h3>
							<div class="form-row">
								<label for="division-size-{i}">Игроков</label>
								<input
									id="division-size-{i}"
									type="number"
									min="2"
									bind:value={divisionSizes[i]}
									onblur={() => clampDivisionSize(i)}
								/>
							</div>
							<p class="hint" class:division-full={isDivisionFull(i)}>
								Распределено: {group.length} / {divisionSizes[i]}
							</p>
							<div class="player-list">
								{#each group as uid (uid)}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="player-card"
										draggable="true"
										ondragstart={() => handleDragStart(uid)}
										ondragend={handleDragEnd}
									>
										{approvedPlayers.find((p) => p.uid === uid)?.name ?? uid}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<p class="hint">Перетащите игроков между колонками для распределения.</p>

				{#if status}<p class="status error">{status}</p>{/if}
				<div class="btn-row">
					<button
						class="btn-common btn-play"
						class:btn-loading={isSplitting}
						onclick={handleSplit}>Разделить</button
					>
					<a class="btn-common" href={resolve(`/tournaments/${id}`)}>Отмена</a
					>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.split-toolbar {
		display: flex;
		gap: 8px;
	}

	.split-columns {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		width: 100%;
	}

	.split-column {
		flex: 1 1 200px;
		min-width: 180px;
		border: 1px solid #333;
		border-radius: 8px;
		padding: 10px;
	}

	.split-column h3 {
		margin: 0 0 8px 0;
	}

	.division-full {
		color: var(--green);
	}

	.pool-column {
		border-style: dashed;
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 40px;
	}

	.player-card {
		padding: 6px 10px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		cursor: grab;
	}

	.player-card:active {
		cursor: grabbing;
	}

	.hint {
		color: #888;
		font-size: 13px;
		margin: 0;
	}
</style>
