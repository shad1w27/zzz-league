<script lang="ts">
	import { currentUser, isAdmin } from "$lib/store";
	import { hasTournamentStarted } from "$lib/tournamentState";
	import { bustCache, openImagePopup } from "$lib/uiCommon";

	let {
		open = $bindable(false),
		player = undefined,
		tournament = undefined,
		reg = undefined,
	} = $props();

	let canViewHoyolab = $derived(
		($isAdmin || $currentUser?.uid === player?.uid) &&
			!hasTournamentStarted(tournament?.state),
	);
</script>

{#if open}
	<div class="popup">
		<div class="card">
			<h2>Регистрация</h2>
			<p>Discord: {player?.discord ?? "-"}</p>
			{#if $isAdmin}
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
					<label for="reg-prize-uid">UID для призовых</label>
					<input
						id="reg-prize-uid"
						type="text"
						class="input-disabled"
						value={reg?.prizeUid ?? ""}
						placeholder="UID для призовых"
						disabled
					/>
				</div>
			{/if}
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
