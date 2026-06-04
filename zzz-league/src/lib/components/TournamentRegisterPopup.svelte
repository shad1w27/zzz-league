<script lang="ts">
	import { applyForTournament } from "$lib/firebase";
	import {
		bustCache,
		dateDisplayOptions,
		openImagePopup,
	} from "$lib/uiCommon";

	let {
		open = $bindable(false),
		tournament = $bindable(),
		reg = $bindable(),
		editable = $bindable(false),
	} = $props();

	let zzzUid = $state(reg?.zzzUid ?? "");
	let darteNickname = $state(reg?.darteNickname ?? "");
	let darteAccount = $state(reg?.darteAccount ?? "");
	let dartePreset = $state(reg?.dartePreset ?? "");
	let regScreenshot = $state(reg?.rosterScreenshot ?? "");
	let rosterScreenshot = $state<FileList | null>(null);
	let awareness = $state(false);
	let status = $state();

	let isRegistering = false;
	async function handleRegister() {
		if (isRegistering) return;

		if (!awareness) {
			status = "Ты не ОСОЗНАЛ.";
			return;
		}

		if (
			!zzzUid ||
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

		isRegistering = true;
		try {
			await applyForTournament(
				tournament.id,
				zzzUid,
				darteNickname,
				darteAccount,
				dartePreset,
				screenshotFile,
			);
			status = "";
			open = false;
		} catch (error: any) {
			status = error.message;
		} finally {
			isRegistering = false;
		}
	}
</script>

{#if open}
	<div class="popup">
		<div class="card">
			<h2>Регистрация</h2>
			<input
				type="text"
				class={editable ? "" : "input-disabled"}
				bind:value={zzzUid}
				placeholder="Игровой UID"
				disabled={!editable}
			/>
			<input
				class={editable ? "" : "input-disabled"}
				type="text"
				bind:value={darteNickname}
				placeholder="Ник на Darte"
				disabled={!editable}
			/>
			<input
				class={editable ? "" : "input-disabled"}
				type="text"
				bind:value={darteAccount}
				placeholder="Название аккаунта на Darte"
				disabled={!editable}
			/>
			<input
				class={editable ? "" : "input-disabled"}
				type="text"
				bind:value={dartePreset}
				placeholder="Название пресета"
				disabled={!editable}
			/>
			<hr style="width: 100%" />
			<span>Скриншот ростера</span>
			{#if regScreenshot}
				<button
					class="img-btn"
					onclick={() => openImagePopup(regScreenshot)}
				>
					<img src={bustCache(regScreenshot)} alt="" />
				</button>
			{/if}
			{#if editable}
				<input type="file" accept="image/*" bind:files={rosterScreenshot} />
				<hr style="width: 100%" />
			{/if}
			{#if editable}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="awareness" onclick={() => (awareness = !awareness)}>
					<input
						type="checkbox"
						bind:checked={awareness}
						onclick={(e) => e.stopPropagation()}
					/>
					<span
						>{`Я осознаю, что турнир проходит с ${new Date(
							tournament.tournamentStartDate,
						).toLocaleString("ru", dateDisplayOptions)} по ${new Date(
							tournament.tournamentEndDate,
						).toLocaleString(
							"ru",
							dateDisplayOptions,
						)} по моему локальному времени.`}</span
					>
				</div>
			{/if}

			{#if status}<p class="status error">{status}</p>{/if}
			<div class="btn-row">
				{#if editable}
					<button class="btn-common btn-play" onclick={handleRegister}
						>Зарегистрироваться</button
					>
				{/if}
				<button class="btn-common" onclick={() => (open = false)}
					>Закрыть</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
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

	.awareness {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
	}

	.awareness input[type="checkbox"] {
		width: 16px;
		height: 16px;
		min-width: 16px;
		cursor: pointer;
		accent-color: var(--gold);
	}

	.awareness span {
		color: #aaa;
	}
</style>
