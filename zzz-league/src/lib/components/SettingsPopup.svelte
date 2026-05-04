<script lang="ts">
	import { auth } from "$lib/firebase";
	import type { Player } from "$lib/types";

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

	async function handleSaveSettings() {
		open = false;
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
			<input type="text" bind:value={discord} placeholder="Discord" />
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
				<button class="btn-common" onclick={() => (open = false)}
					>Закрыть</button
				>
			</div>
		</div>
	</div>
{/if}
