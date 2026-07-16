<script lang="ts">
	import { adminSetMatchResult, approveResult } from "$lib/firebase";
	import { currentUser, isAdmin } from "$lib/store";
	import {
		bustCache,
		filesFromImageFile,
		imageFileFromPasteEvent,
		isImageTooLarge,
		MAX_IMAGE_SIZE_MB,
		openImagePopup,
		pasteImageFromClipboard,
	} from "$lib/uiCommon";

	let {
		open = $bindable(false),
		tournament = $bindable(),
		match = $bindable(),
		registeredPlayers = $bindable([]),
	} = $props();

	let myGame = $derived(
		$currentUser?.uid == match.p1 || $currentUser?.uid == match.p2,
	);
	let canApproveOwnResult = $derived(match.state !== "complete" && myGame);
	let canAdminSetResult = $derived(
		$isAdmin && tournament.state !== "complete",
	);

	let inputScreenshot = $state<FileList | null>(null);
	let adminInputScreenshot = $state<FileList | null>(null);
	let matchResultP1 = $state(match.resultP1 ?? "00:00");
	let matchResultP2 = $state(match.resultP2 ?? "00:00");

	$effect(() => {
		match;
		matchResultP1 = match.resultP1 ?? "00:00";
		matchResultP2 = match.resultP2 ?? "00:00";
		inputScreenshot = null;
	});

	function useObjectUrlPreview(getFile: () => File | undefined) {
		let url = $state<string | null>(null);
		$effect(() => {
			const file = getFile();
			if (!file) {
				url = null;
				return;
			}
			const objectUrl = URL.createObjectURL(file);
			url = objectUrl;
			return () => URL.revokeObjectURL(objectUrl);
		});
		return {
			get url() {
				return url;
			},
		};
	}

	let inputScreenshotPreview = useObjectUrlPreview(() => inputScreenshot?.[0]);
	let adminScreenshotPreview = useObjectUrlPreview(
		() => adminInputScreenshot?.[0],
	);

	function isValidTime(time: string) {
		const [h, m] = time.split(":").map(Number);
		return h * 60 + m > 0;
	}

	let hasUnsavedInput = $derived(
		matchResultP1 !== (match.resultP1 ?? "00:00") ||
			matchResultP2 !== (match.resultP2 ?? "00:00") ||
			!!inputScreenshot?.length ||
			!!adminInputScreenshot?.length,
	);

	function handleClose() {
		if (
			hasUnsavedInput &&
			!confirm("Введённые данные будут потеряны. Закрыть окно?")
		) {
			return;
		}
		open = false;
	}

	async function handlePasteScreenshot(target: "own" | "admin") {
		try {
			const files = await pasteImageFromClipboard();
			if (!files) {
				alert("В буфере обмена нет изображения");
				return;
			}
			if (target === "own") {
				inputScreenshot = files;
			} else {
				adminInputScreenshot = files;
			}
		} catch (error) {}
	}

	$effect(() => {
		function onPaste(e: ClipboardEvent) {
			const file = imageFileFromPasteEvent(e);
			if (!file) return;

			const files = filesFromImageFile(file);
			if (canApproveOwnResult) {
				inputScreenshot = files;
			} else if (canAdminSetResult) {
				adminInputScreenshot = files;
			} else {
				return;
			}
			e.preventDefault();
		}

		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	});

	function getPlayerName(uid: string) {
		return registeredPlayers.find((p) => p.player.uid === uid)?.player.name;
	}

	function getPlayerClass(
		player: string,
		winnerId: string,
		techLossUid?: string | null,
	) {
		if (player === techLossUid) return "match-techloss";
		if (!winnerId) return "";

		return player === winnerId ? "match-winner" : "match-loser";
	}

	let isApproving = $state(false);
	async function handleApproveResult() {
		if (isApproving) return;
		if (!isValidTime(matchResultP1) || !isValidTime(matchResultP2)) {
			alert("Введите время больше 00:00");
			return;
		}
		const resultScreenshot = inputScreenshot?.[0];
		if (!resultScreenshot && !match.resultScreenshot) {
			alert("Необходимо загрузить скриншот результата");
			return;
		}
		if (resultScreenshot && isImageTooLarge(resultScreenshot)) {
			alert(`Файл слишком большой, максимум ${MAX_IMAGE_SIZE_MB}МБ`);
			return;
		}
		try {
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

	let adminAction = $state<"result" | "techloss-p1" | "techloss-p2" | null>(
		null,
	);

	async function handleAdminSetResult() {
		if (adminAction) return;
		if (!isValidTime(matchResultP1) || !isValidTime(matchResultP2)) {
			alert("Введите время больше 00:00");
			return;
		}
		const adminScreenshot = adminInputScreenshot?.[0] ?? null;
		if (adminScreenshot && isImageTooLarge(adminScreenshot)) {
			alert(`Файл слишком большой, максимум ${MAX_IMAGE_SIZE_MB}МБ`);
			return;
		}
		if (!confirm("Записать результат от имени администратора?")) return;
		try {
			adminAction = "result";
			await adminSetMatchResult(
				tournament.id,
				match.id,
				matchResultP1,
				matchResultP2,
				adminScreenshot,
			);
		} catch (error) {
			alert(error);
		} finally {
			adminAction = null;
		}
	}

	async function handleAdminTechLoss(uid: string) {
		if (adminAction) return;
		const loserName = getPlayerName(uid);
		if (
			!confirm(
				`${loserName} получает техлуз, оппонент побеждает без ELO. Продолжить?`,
			)
		)
			return;
		try {
			adminAction = uid === match.p1 ? "techloss-p1" : "techloss-p2";
			await adminSetMatchResult(
				tournament.id,
				match.id,
				null,
				null,
				null,
				uid,
			);
		} catch (error) {
			alert(error);
		} finally {
			adminAction = null;
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
					match.techLossUid,
				)}">{getPlayerName(match.p1)}</span
			>
			<span class="match-vs">vs</span>
			<span
				class="match-player-name match-player-right {getPlayerClass(
					match.p2,
					match.winnerId,
					match.techLossUid,
				)}">{getPlayerName(match.p2)}</span
			>
			{#if match.resultP1 && match.resultP2}
				<span class="match-player-left">{match.resultP1}</span>
				<span> </span>
				<span class="match-player-right">{match.resultP2}</span>
			{/if}
		</div>
		{#if match.techLossUid}
			<span class="techloss-label"
				>{getPlayerName(match.techLossUid)} тех. луз</span
			>
		{/if}
		{#if canApproveOwnResult}
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
		{#if canApproveOwnResult}
			<span>Загрузить скриншот результатов</span>
			<div class="input-row">
				<input
					class="input-screenshot"
					type="file"
					accept="image/*"
					bind:files={inputScreenshot}
				/>
				<button
					type="button"
					class="btn-common paste-btn"
					onclick={() => handlePasteScreenshot("own")}
					>Вставить(Ctrl+V)</button
				>
			</div>
			{#if inputScreenshotPreview.url}
				<button
					class="img-btn"
					onclick={() => openImagePopup(inputScreenshotPreview.url!)}
				>
					<img src={inputScreenshotPreview.url} alt="" />
				</button>
			{/if}
			<button
				class="btn-common"
				class:btn-loading={isApproving}
				onclick={handleApproveResult}
				>Подтвердить результат {match.p1ApprovedResult ? "✅" : "❌"}
				{match.p2ApprovedResult ? "✅" : "❌"}</button
			>
		{/if}

		{#if canAdminSetResult}
			<hr style="width: 100%" />
			<span class="admin-label">Админ: изменить результат</span>
			<div class="match-players">
				<span class="match-player-left">{getPlayerName(match.p1)}</span>
				<span> </span>
				<span class="match-player-right">{getPlayerName(match.p2)}</span>
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
			<div class="input-row">
				<input
					class="input-screenshot"
					type="file"
					accept="image/*"
					bind:files={adminInputScreenshot}
				/>
				<button
					type="button"
					class="btn-common paste-btn"
					onclick={() => handlePasteScreenshot("admin")}
					>Вставить из буфера</button
				>
			</div>
			{#if adminScreenshotPreview.url}
				<button
					class="img-btn"
					onclick={() => openImagePopup(adminScreenshotPreview.url!)}
				>
					<img src={adminScreenshotPreview.url} alt="" />
				</button>
			{/if}
			<button
				class="btn-common"
				class:btn-loading={adminAction === "result"}
				onclick={handleAdminSetResult}
			>
				Записать результат
			</button>
			<div class="admin-techloss-row">
				<button
					class="btn-common danger"
					class:btn-loading={adminAction === "techloss-p1"}
					onclick={() => handleAdminTechLoss(match.p1)}
				>
					Техлуз {getPlayerName(match.p1)}
				</button>
				<button
					class="btn-common danger"
					class:btn-loading={adminAction === "techloss-p2"}
					onclick={() => handleAdminTechLoss(match.p2)}
				>
					Техлуз {getPlayerName(match.p2)}
				</button>
			</div>
		{/if}

		<button class="btn-common back-btn" onclick={handleClose}
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

	.match-player-left {
		align-items: flex-end;
	}

	.back-btn {
		margin-top: 0px;
	}

	.admin-label {
		color: #888;
		text-transform: uppercase;
	}

	.admin-techloss-row {
		display: flex;
		gap: 8px;
		width: 100%;
	}

	.admin-techloss-row .btn-common {
		flex: 1;
	}

	.card .btn-common {
		padding: 14px;
	}
</style>
