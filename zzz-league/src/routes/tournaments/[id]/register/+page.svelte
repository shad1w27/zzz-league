<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import SidePanel from "$lib/components/SidePanel.svelte";
	import { applyForTournament, db } from "$lib/firebase";
	import { currentUser, isAdmin } from "$lib/store";
	import type { Tournament, TournamentRegistration } from "$lib/types";
	import {
		bustCache,
		dateDisplayOptions,
		isImageTooLarge,
		MAX_IMAGE_SIZE_MB,
		openImagePopup,
	} from "$lib/uiCommon";
	import { onValue, ref } from "firebase/database";
	import { onMount } from "svelte";

	const id = $derived(page.params.id);

	let now = $state(Date.now());
	let tournament = $state<Tournament>();
	let myRegistration = $state<TournamentRegistration | null>(null);
	let regLoaded = $state(false);

	let zzzUid = $state("");
	let prizeUid = $state("");
	let darteNickname = $state("");
	let darteAccount = $state("");
	let dartePreset = $state("");
	let regScreenshot = $state("");
	let rosterScreenshot = $state<FileList | null>(null);
	let regHoyolabScreenshot = $state("");
	let hoyolabScreenshot = $state<FileList | null>(null);
	let awareness = $state(false);
	let status = $state("");

	let fieldsInitialized = false;
	function applyRegistrationData(reg: TournamentRegistration | null) {
		regLoaded = true;
		if (!reg || fieldsInitialized) return;
		fieldsInitialized = true;
		zzzUid = reg.zzzUid ?? "";
		prizeUid = reg.prizeUid ?? "";
		darteNickname = reg.darteNickname ?? "";
		darteAccount = reg.darteAccount ?? "";
		dartePreset = reg.dartePreset ?? "";
		regScreenshot = reg.rosterScreenshot ?? "";
		regHoyolabScreenshot = reg.hoyolabScreenshot ?? "";
	}

	let currentUserTier = $derived(
		$currentUser?.isHighConfirmed
			? 1000
			: $currentUser?.isMidConfirmed
				? 100
				: 0,
	);
	let tierEligible = $derived(
		!!tournament &&
			currentUserTier >= tournament.minTier &&
			currentUserTier <= tournament.maxTier,
	);
	let registrationWindowOpen = $derived(
		!!tournament &&
			now > tournament.registrationStartDate &&
			now < tournament.registrationEndDate,
	);

	let isRegistering = $state(false);
	async function handleRegister() {
		if (isRegistering || !tournament) return;

		if (!awareness) {
			status = "Ты не ОСОЗНАЛ.";
			return;
		}

		const hasRosterScreenshot =
			(rosterScreenshot && rosterScreenshot.length > 0) || regScreenshot;
		const hasHoyolabScreenshot =
			(hoyolabScreenshot && hoyolabScreenshot.length > 0) ||
			regHoyolabScreenshot;

		if (
			!zzzUid ||
			!prizeUid ||
			!darteNickname ||
			!darteAccount ||
			!dartePreset ||
			!hasRosterScreenshot ||
			!hasHoyolabScreenshot
		) {
			status = "Заполните все поля";
			return;
		}

		const screenshotFile = rosterScreenshot?.[0] ?? null;
		const hoyolabScreenshotFile = hoyolabScreenshot?.[0] ?? null;

		if (
			(screenshotFile && isImageTooLarge(screenshotFile)) ||
			(hoyolabScreenshotFile && isImageTooLarge(hoyolabScreenshotFile))
		) {
			status = `Файл слишком большой, максимум ${MAX_IMAGE_SIZE_MB}МБ`;
			return;
		}

		isRegistering = true;
		try {
			await applyForTournament(
				tournament.id,
				zzzUid,
				prizeUid,
				darteNickname,
				darteAccount,
				dartePreset,
				screenshotFile,
				hoyolabScreenshotFile,
			);
			await goto(resolve(`/tournaments/${tournament.id}`));
		} catch (error: any) {
			status = error.message;
		} finally {
			isRegistering = false;
		}
	}

	onMount(() => {
		const unsubTournament = onValue(ref(db, "tournaments/" + id), (snap) => {
			const data = snap.val();
			if (!data) return;
			tournament = { ...data, matches: [] };
		});

		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			unsubTournament();
			clearInterval(interval);
		};
	});

	$effect(() => {
		if (!$currentUser || !id) {
			myRegistration = null;
			return;
		}
		return onValue(
			ref(db, `tournaments/${id}/registrations/${$currentUser.uid}`),
			(snap) => {
				const data = (snap.val() as TournamentRegistration | null) ?? null;
				myRegistration = data;
				applyRegistrationData(data);
			},
		);
	});
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		{#if tournament}
			<h2>Регистрация: {tournament.name}</h2>

			{#if tournament.visible === false && !$isAdmin}
				<p class="notice">Недостаточно прав для просмотра этой страницы.</p>
			{:else if !$currentUser}
				<p class="notice">Войдите, чтобы зарегистрироваться на турнир.</p>
			{:else if !tierEligible}
				<p class="notice">Ваш тир не подходит для этого турнира.</p>
			{:else if tournament.state || tournament.challongeTournamentId}
				<p class="notice">Турнир уже начался, регистрация закрыта.</p>
			{:else if !registrationWindowOpen}
				<p class="notice">Регистрация на турнир закрыта.</p>
			{:else if regLoaded}
				<div class="form-row-wide">
					<label for="reg-zzz-uid">Игровой UID</label>
					<input
						id="reg-zzz-uid"
						type="text"
						bind:value={zzzUid}
						placeholder="Игровой UID"
					/>
				</div>
				<div class="form-row-wide">
					<label for="reg-prize-uid">UID для призовых</label>
					<input
						id="reg-prize-uid"
						type="text"
						bind:value={prizeUid}
						placeholder="UID для призовых"
					/>
				</div>
				<div class="form-row-wide">
					<label for="reg-darte-nickname">Ник на Darte</label>
					<input
						id="reg-darte-nickname"
						type="text"
						bind:value={darteNickname}
						placeholder="Ник на Darte"
					/>
				</div>
				<div class="form-row-wide">
					<label for="reg-darte-account">Название пресета на Darte</label>
					<input
						id="reg-darte-account"
						type="text"
						bind:value={darteAccount}
						placeholder="Название пресета на Darte"
					/>
				</div>
				<div class="form-row-wide">
					<label for="reg-darte-preset">Название ростера</label>
					<input
						id="reg-darte-preset"
						type="text"
						bind:value={dartePreset}
						placeholder="Название ростера"
					/>
				</div>

				<hr style="width: 100%" />

				<div class="form-row-wide">
					<label for="reg-roster-screenshot">Скриншот ростера</label>
					<input
						id="reg-roster-screenshot"
						type="file"
						accept="image/*"
						bind:files={rosterScreenshot}
					/>
				</div>
				{#if regScreenshot}
					<button
						class="img-btn"
						onclick={() => openImagePopup(regScreenshot)}
					>
						<img src={bustCache(regScreenshot)} alt="" />
					</button>
					<p class="notice">Оставьте пустым, чтобы не менять скриншот</p>
				{/if}

				<hr style="width: 100%" />

				<div class="form-row-wide">
					<label for="reg-hoyolab-screenshot"
						>Скриншот персонажа Hoyolab</label
					>
					<input
						id="reg-hoyolab-screenshot"
						type="file"
						accept="image/*"
						bind:files={hoyolabScreenshot}
					/>
				</div>
				{#if regHoyolabScreenshot}
					<button
						class="img-btn"
						onclick={() => openImagePopup(regHoyolabScreenshot)}
					>
						<img src={bustCache(regHoyolabScreenshot)} alt="" />
					</button>
					<p class="notice">Оставьте пустым, чтобы не менять скриншот</p>
				{/if}

				<hr style="width: 100%" />

				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="awareness" onclick={() => (awareness = !awareness)}>
					<input
						type="checkbox"
						bind:checked={awareness}
						onclick={(e) => e.stopPropagation()}
					/>
					<span
						>Конечно, я полностью прочитал регламент, и осознаю, что турнир
						проходит с <span class="value-highlight"
							>{new Date(tournament.tournamentStartDate).toLocaleString(
								"ru",
								dateDisplayOptions,
							)}</span
						>
						по
						<span class="value-highlight"
							>{new Date(tournament.tournamentEndDate).toLocaleString(
								"ru",
								dateDisplayOptions,
							)}</span
						>
					</span>
				</div>

				{#if status}<p class="status error">{status}</p>{/if}
				<div class="btn-col">
					<button
						class="btn-common btn-play"
						class:btn-loading={isRegistering}
						onclick={handleRegister}
						>{#if myRegistration}Обновить регистрацию{:else}Зарегистрироваться{/if}</button
					>
					<a class="btn-common" href={resolve(`/tournaments/${tournament.id}`)}
						>Отмена</a
					>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
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
