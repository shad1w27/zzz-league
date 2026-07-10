<script lang="ts">
	import { currentUser, isAdmin } from "$lib/store";
	import { bustCache, openImagePopup } from "$lib/uiCommon";

	let {
		open = $bindable(false),
		player = undefined,
		tournament = undefined,
		reg = undefined,
	} = $props();

	let canViewHoyolab = $derived(
		($isAdmin || $currentUser?.uid === player?.uid) && !tournament?.state,
	);
</script>

{#if open}
	<div class="popup">
		<div class="card">
			<h2>Регистрация</h2>
			<p>Discord: {player?.discord ?? "-"}</p>
			<div class="form-row">
				<label for="reg-zzz-uid">Игровой UID</label>
				<input
					id="reg-zzz-uid"
					type="text"
					class="input-disabled"
					value={reg?.zzzUid ?? ""}
					placeholder="Игровой UID"
					disabled
				/>
			</div>
			<div class="form-row">
				<label for="reg-darte-nickname">Ник на Darte</label>
				<input
					id="reg-darte-nickname"
					class="input-disabled"
					type="text"
					value={reg?.darteNickname ?? ""}
					placeholder="Ник на Darte"
					disabled
				/>
			</div>
			<div class="form-row">
				<label for="reg-darte-account">Название аккаунта на Darte</label>
				<input
					id="reg-darte-account"
					class="input-disabled"
					type="text"
					value={reg?.darteAccount ?? ""}
					placeholder="Название аккаунта на Darte"
					disabled
				/>
			</div>
			<div class="form-row">
				<label for="reg-darte-preset">Название пресета</label>
				<input
					id="reg-darte-preset"
					class="input-disabled"
					type="text"
					value={reg?.dartePreset ?? ""}
					placeholder="Название пресета"
					disabled
				/>
			</div>
			<hr style="width: 100%" />
			<span>Скриншот ростера</span>
			{#if reg?.rosterScreenshot}
				<button
					class="img-btn"
					onclick={() => openImagePopup(reg.rosterScreenshot)}
				>
					<img src={bustCache(reg.rosterScreenshot)} alt="" />
				</button>
			{/if}
			{#if canViewHoyolab}
				<hr style="width: 100%" />
				<span>Скриншот персонажа Hoyolab</span>
				{#if reg?.hoyolabScreenshot}
					<button
						class="img-btn"
						onclick={() => openImagePopup(reg.hoyolabScreenshot)}
					>
						<img src={bustCache(reg.hoyolabScreenshot)} alt="" />
					</button>
				{/if}
			{/if}

			<div class="btn-row">
				<button class="btn-common" onclick={() => (open = false)}
					>Закрыть</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.form-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.form-row label {
		flex: 0 0 120px;
		color: #fff;
		font-size: 13px;
		line-height: 1.3;
	}

	.form-row input {
		flex: 1;
		min-width: 0;
		width: auto;
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
		max-height: 240px;
	}
</style>
