<script lang="ts">
	import { registerUser } from "$lib/firebase";

	let { open = $bindable(false) } = $props();

	let username = $state("");
	let email = $state("");
	let password = $state("");
	let discord = $state("");
	let confirmPass = $state("");
	let status = $state("");

	async function handleRegister() {
		status = "";
		if (username.length < 3 || username.length > 32) {
			status = "Username от 3 до 32 символов";
			return;
		}
		if (discord.length < 2 || discord.length > 32) {
			status = "Не похоже на Discord";
			return;
		}
		if (password !== confirmPass) {
			status = "Пароли не совпадают";
			return;
		}

		try {
			await registerUser(username, email, password, discord);
			open = false;
		} catch (e: any) {
			status = e.message;
		}
	}
</script>

{#if open}
	<div class="popup">
		<div class="card">
			<h2>Регистрация</h2>
			<input type="text" bind:value={username} placeholder="Ник" />
			<input type="text" bind:value={discord} placeholder="Discord" />
			<input type="email" bind:value={email} placeholder="Email" />
			<input type="password" bind:value={password} placeholder="Пароль" />
			<input
				type="password"
				bind:value={confirmPass}
				placeholder="Подтвердите пароль"
				onkeydown={(e) => e.key === "Enter" && handleRegister()}
			/>
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
