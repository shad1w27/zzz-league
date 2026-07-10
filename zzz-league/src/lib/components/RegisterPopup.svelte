<script lang="ts">
	import { registerUser } from "$lib/firebase";
	import { closeRegistrationPopup } from "$lib/uiCommon";

	let username = $state("");
	let email = $state("");
	let password = $state("");
	let confirmPass = $state("");
	let status = $state("");

	let isLoading = false;

	async function handleRegister() {
		if (isLoading) return;

		status = "";
		if (username.length < 3 || username.length > 32) {
			status = "Username от 3 до 32 символов";
			return;
		}

		if (password !== confirmPass) {
			status = "Пароли не совпадают";
			return;
		}

		isLoading = true;

		try {
			await registerUser(username, email, password);
			close();
		} catch (e: any) {
			status = e.message;
		} finally {
			isLoading = false;
		}
	}

	function close() {
		status = "";
		username = "";
		password = "";
		confirmPass = "";
		closeRegistrationPopup();
	}
</script>

<div class="popup">
	<div class="card">
		<h2>Регистрация</h2>
		<div class="form-row">
			<label for="register-username">Ник</label>
			<input
				id="register-username"
				type="text"
				bind:value={username}
				placeholder="Ник"
			/>
		</div>
		<div class="form-row">
			<label for="register-email">Email</label>
			<input
				id="register-email"
				type="email"
				bind:value={email}
				placeholder="Email"
			/>
		</div>
		<div class="form-row">
			<label for="register-password">Пароль</label>
			<input
				id="register-password"
				type="password"
				bind:value={password}
				placeholder="Пароль"
			/>
		</div>
		<div class="form-row">
			<label for="register-confirm-password">Подтвердите пароль</label>
			<input
				id="register-confirm-password"
				type="password"
				bind:value={confirmPass}
				placeholder="Подтвердите пароль"
				onkeydown={(e) => e.key === "Enter" && handleRegister()}
			/>
		</div>
		{#if status}<p class="status error">{status}</p>{/if}
		<div class="btn-row">
			<button class="btn-common btn-play" onclick={handleRegister}
				>Зарегистрироваться</button
			>
			<button class="btn-common" onclick={close}>Закрыть</button>
		</div>
	</div>
</div>
