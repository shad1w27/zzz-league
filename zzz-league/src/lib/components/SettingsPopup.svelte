<script lang="ts">
	import { openDiscordOAuth } from "$lib/discord";
	import {
		auth,
		linkDiscord,
		unlinkDiscord,
		updateProfile,
	} from "$lib/firebase";
	import type { Player } from "$lib/types";
	import {
		EmailAuthProvider,
		reauthenticateWithCredential,
		updatePassword,
	} from "firebase/auth";

	let { open = $bindable(false), user = $bindable<Player>() } = $props();

	let username = $state("");
	let email = $state("");
	let currentPassword = $state("");
	let newPassword = $state("");
	let confirmPass = $state("");
	let discord = $state("");
	let status = $state("");

	$effect(() => {
		if (!user) return;

		username = user.name;
		email = auth.currentUser?.email ?? "";

		discord = user.discord ?? "";
	});

	function close() {
		currentPassword = "";
		newPassword = "";
		confirmPass = "";
		status = "";
		open = false;
	}

	async function handleLinkDiscord() {
		try {
			openDiscordOAuth();
		} catch (error: any) {
			status = error.message;
		}
	}

	async function handleUnlinkDiscord() {
		try {
			await unlinkDiscord();
		} catch (error: any) {
			status = error.message;
		}
	}

	async function handleSaveSettings() {
		let successPw = false;

		if (newPassword.length > 0) {
			if (newPassword !== confirmPass) {
				status = "Пароли не совпадают";
				return;
			}

			try {
				const credential = EmailAuthProvider.credential(
					auth.currentUser!.email!,
					currentPassword,
				);

				await reauthenticateWithCredential(auth.currentUser!, credential);
				await updatePassword(auth.currentUser!, newPassword);
				successPw = true;
			} catch (error: any) {
				status = error.message;
			}
		} else {
			successPw = true;
		}

		let successData = false;

		const newUsername = username !== user.name ? username : null;

		if (newUsername) {
			try {
				await updateProfile(newUsername);
				successData = true;
			} catch (error: any) {
				status = error.message;
			}
		} else {
			successData = true;
		}

		if (successPw && successData) {
			close();
		}
	}
</script>

{#if open}
	<div class="popup">
		<div class="card">
			<h2>Настройки аккаунта</h2>
			<input
				class="input-disabled"
				type="email"
				bind:value={email}
				placeholder="Email"
				disabled
			/>
			<input type="text" bind:value={username} placeholder="Ник" />
			<input
				type="text"
				class="input-disabled"
				bind:value={discord}
				placeholder="Discord"
				disabled
			/>
			{#if user.discordId}
				<button class="btn-common" onclick={() => handleUnlinkDiscord()}
					>Отвязать Discord</button
				>
			{:else}
				<button class="btn-common" onclick={() => handleLinkDiscord()}
					>Привязать Discord</button
				>
			{/if}
			<br />
			<input
				type="password"
				bind:value={currentPassword}
				placeholder="Текущий пароль"
			/>
			<input
				type="password"
				bind:value={newPassword}
				placeholder="Новый пароль"
			/>
			<input
				type="password"
				bind:value={confirmPass}
				placeholder="Подтвердите пароль"
			/>
			<br />
			{#if status}<p class="status error">{status}</p>{/if}
			<div class="btn-row">
				<button
					class="btn-common btn-play"
					onclick={() => handleSaveSettings()}>Сохранить</button
				>
				<button class="btn-common" onclick={() => close()}>Закрыть</button>
			</div>
		</div>
	</div>
{/if}
