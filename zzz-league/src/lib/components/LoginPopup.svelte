<script lang="ts">
	import { auth } from "$lib/firebase";
	import { signInWithEmailAndPassword } from "firebase/auth";

	let { open = $bindable(false) } = $props();

	let email = $state("");
	let password = $state("");
	let status = $state("");

	async function handleLogin() {
		status = "";
		try {
			await signInWithEmailAndPassword(auth, email, password);
			email = "";
			password = "";
			open = false;
		} catch (e: any) {
			status = e.message;
		}
	}
</script>

{#if open}
	<div class="popup">
		<div class="card">
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
		</div>
	</div>
{/if}
