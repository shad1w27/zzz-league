<script lang="ts">
	import { auth } from "$lib/firebase";
	import {
		sendPasswordResetEmail,
		signInWithEmailAndPassword,
	} from "firebase/auth";

	let { open = $bindable(false) } = $props();

	let email = $state("");
	let password = $state("");
	let status = $state("");
	let resettingPassword = $state(false);

	async function handleLogin() {
		status = "";
		try {
			await signInWithEmailAndPassword(auth, email, password);
			email = "";
			password = "";
			open = false;
		} catch (error: any) {
			status = error.message;
		}
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

{#if open}
	<div class="popup">
		<div class="card">
			{#if resettingPassword}
				<h2>Сброс пароля</h2>
				<input type="text" bind:value={email} placeholder="Email" />

				{#if status}<p class="status error">{status}</p>{/if}
				<div class="btn-row">
					<button
						class="btn-common btn-play"
						onclick={() => handleResetPassword()}>Отправить код</button
					>
					<button
						class="btn-common"
						onclick={() => backFromReset()}>Закрыть</button
					>
				</div>
			{:else}
				<h2>Вход</h2>
				<input type="text" bind:value={email} placeholder="Email" />
				<input
					type="password"
					bind:value={password}
					placeholder="Пароль"
					onkeydown={(e) => e.key === "Enter" && handleLogin()}
				/>
				{#if status}<p class="status error">{status}</p>{/if}
				<div class="btn-row">
					<button class="btn-common btn-play" onclick={handleLogin}
						>Войти</button
					>
					<button class="btn-common" onclick={() => (open = false)}
						>Закрыть</button
					>
				</div>
				<button
					class="btn-reset-password"
					onclick={() => resetPassword()}>Забыли пароль?</button
				>
			{/if}
		</div>
	</div>
{/if}
