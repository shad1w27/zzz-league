<script lang="ts">
	import { applyForTournament } from "$lib/firebase";

	let { open = $bindable(false), tournament = $bindable() } = $props();

	let darteNickname = $state("");
	let darteAccount = $state("");
	let dartePreset = $state("");
	let rosterScreenshot = $state<FileList | null>(null);
	let awareness = $state(false);
	let status = $state();

	async function handleRegister() {
		if (!awareness) {
			status = "Ты не ОСОЗНАЛ.";
			return;
		}

		if (
			!darteNickname ||
			!darteAccount ||
			!dartePreset ||
			!rosterScreenshot ||
			rosterScreenshot.length === 0
		) {
			status = "Заполните все поля";
			return;
		}

		const screenshotFile = rosterScreenshot[0];

		try {
			await applyForTournament(
				tournament.id,
				darteNickname,
				darteAccount,
				dartePreset,
				screenshotFile,
			);
			status = "";
			open = false;
		} catch (error: any) {
			status = error.message;
		}
	}
</script>

{#if open}
	<div class="popup">
		<div class="card">
			<h2>Регистрация</h2>
			<input
				type="text"
				bind:value={darteNickname}
				placeholder="Ник на Darte"
			/>
			<input
				type="text"
				bind:value={darteAccount}
				placeholder="Название аккаунта на Darte"
			/>
			<input
				type="text"
				bind:value={dartePreset}
				placeholder="Название пресета"
			/>
			<hr style="width: 100%" />
			<span>Скриншот ростера</span>
			<input type="file" accept="image/*" bind:files={rosterScreenshot} />
			<hr style="width: 100%" />
			<div>
				<input type="checkbox" bind:checked={awareness} />
				<span
					>{`Я осознаю, что турнир проходит с ${new Date(tournament.tournamentStartDate).toLocaleString()}
					по ${new Date(tournament.tournamentEndDate).toLocaleString()} по моему локальному времени.`}</span
				>
			</div>

			{#if status}<p class="status error">{status}</p>{/if}
			<div class="btn-row">
				<button class="btn-common btn-play" onclick={handleRegister}
					>Зарегистрироваться</button
				>
				<button class="btn-common" onclick={() => (open = false)}
					>Закрыть</button
				>
			</div>
		</div>
	</div>
{/if}
