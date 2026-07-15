<script lang="ts">
	import { auth } from "$lib/firebase";
	import { closeLoginPopup } from "$lib/uiCommon";
	import {
		sendPasswordResetEmail,
		signInWithEmailAndPassword,
	} from "firebase/auth";

	let email = $state("");
	let password = $state("");
	let status = $state("");
	let resettingPassword = $state(false);
	let loggingIn = $state(false);

	async function handleLogin() {
		if (loggingIn) return;
		status = "";
		try {
			loggingIn = true;
			await signInWithEmailAndPassword(auth, email, password);
			close();
		} catch (error: any) {
			status = error.message;
		} finally {
			loggingIn = false;
		}
	}

	function close() {
		email = "";
		password = "";
		closeLoginPopup();
	}

	async function handleResetPassword() {
		try {
			await sendPasswordResetEmail(auth, email);
			status = "Проверьте почту (спам в том числе)";
		} catch (error: any) {
			status = error.message;
		}
	}

	function resetPassword() {
		resettingPassword = true;
		status = "";
	}

	function backFromReset() {
		resettingPassword = false;
		status = "";
	}
</script>

<div class="popup">
	<div class="card">
		{#if resettingPassword}
			<h2>Сброс пароля</h2>
			<div class="form-row">
				<label for="login-reset-email">Email</label>
				<input
					id="login-reset-email"
					type="text"
					bind:value={email}
					placeholder="Email"
				/>
			</div>

			{#if status}<p class="status error">{status}</p>{/if}
			<div class="btn-row">
				<button
					class="btn-common btn-play"
					onclick={() => handleResetPassword()}>Отправить код</button
				>
				<button class="btn-common" onclick={() => backFromReset()}
					>Закрыть</button
				>
			</div>
		{:else}
			<h2>Вход</h2>
			<div class="form-row">
				<label for="login-email">Email</label>
				<input
					id="login-email"
					type="text"
					bind:value={email}
					placeholder="Email"
				/>
			</div>
			<div class="form-row">
				<label for="login-password">Пароль</label>
				<input
					id="login-password"
					type="password"
					bind:value={password}
					placeholder="Пароль"
					onkeydown={(e) => e.key === "Enter" && handleLogin()}
				/>
			</div>
			{#if status}<p class="status error">{status}</p>{/if}
			<div class="btn-row">
				<button
					class="btn-common btn-play"
					class:btn-loading={loggingIn}
					onclick={handleLogin}
					>Войти</button
				>
				<button class="btn-common" onclick={close}>Закрыть</button>
			</div>
			<button class="btn-reset-password" onclick={resetPassword}
				>Забыли пароль?</button
			>
		{/if}
	</div>
</div>
