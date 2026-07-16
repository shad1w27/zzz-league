<script lang="ts">
	import { splitTournament } from "$lib/firebase";

	let {
		open = $bindable(false),
		tournament = $bindable(),
		approvedCount = 0,
	} = $props();

	let divisionCount = $state(2);
	let divisionSizes = $state<number[]>([0, 0]);
	let status = $state("");

	$effect(() => {
		const n = Math.max(2, divisionCount || 0);
		if (divisionSizes.length < n) {
			divisionSizes = [
				...divisionSizes,
				...Array(n - divisionSizes.length).fill(0),
			];
		} else if (divisionSizes.length > n) {
			divisionSizes = divisionSizes.slice(0, n);
		}
	});

	let totalAssigned = $derived(
		divisionSizes.reduce((sum, n) => sum + (n || 0), 0),
	);
	let isValid = $derived(
		divisionCount >= 2 &&
			divisionSizes.every((n) => n >= 2) &&
			totalAssigned === approvedCount,
	);

	let isSplitting = $state(false);
	async function handleSplit() {
		if (isSplitting || !isValid) return;
		if (!confirm(`Разделить турнир на ${divisionCount} сетки?`))
			return;

		isSplitting = true;
		try {
			await splitTournament(tournament.id, divisionSizes);
			status = "";
			open = false;
		} catch (error: any) {
			status = error.message;
		} finally {
			isSplitting = false;
		}
	}
</script>

{#if open}
	<div class="popup">
		<div class="card">
			<h2>Разделить на сетки</h2>
			<div class="form-row">
				<label for="division-count">Количество сеток</label>
				<input
					id="division-count"
					type="number"
					min="2"
					bind:value={divisionCount}
				/>
			</div>
			<hr style="width: 100%" />
			{#each divisionSizes as _, i}
				<div class="form-row">
					<label for="division-size-{i}">Игроков в сетке {i + 1}</label>
					<input
						id="division-size-{i}"
						type="number"
						min="2"
						bind:value={divisionSizes[i]}
					/>
				</div>
			{/each}
			<p>Распределено: {totalAssigned} / {approvedCount}</p>
			<p class="hint">Минимум 2 игрока в сетке</p>

			{#if status}<p class="status error">{status}</p>{/if}
			<div class="btn-row">
				<button
					class="btn-common btn-play"
					class:btn-loading={isSplitting}
					disabled={!isValid}
					onclick={handleSplit}>Разделить</button
				>
				<button class="btn-common" onclick={() => (open = false)}
					>Закрыть</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.hint {
		color: #888;
		font-size: 13px;
		margin: 0;
	}
</style>
