<script lang="ts">
	import { bustCache, closeImagePopup } from "$lib/uiCommon";

	let { src = "", alt = "" } = $props();
	let loaded = $state(false);

	function close() {
		loaded = false;
		closeImagePopup();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="popup" onclick={close}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="card image-popup-card"
		onclick={(e) => e.stopPropagation()}
	>
		<button class="close-btn" onclick={close}>✕</button>

		{#if !loaded}
			<div class="loader">
				<div class="spinner"></div>
			</div>
		{/if}

		<img
			src={bustCache(src)}
			{alt}
			class:hidden={!loaded}
			onload={() => (loaded = true)}
		/>
	</div>
</div>

<style>
	.image-popup-card {
		position: relative;
		width: unset;
		max-width: 70vw;
		max-height: 70vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	img {
		max-width: 100%;
		max-height: 70vh;
		object-fit: contain;
		border-radius: 8px;
	}

	img.hidden {
		display: none;
	}

	.loader {
		width: 200px;
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #333;
		border-top-color: var(--gold);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.close-btn {
		position: absolute;
		top: -40px;
		right: 0;
		background: none;
		border: none;
		color: #fff;
		cursor: pointer;
		width: auto;
		padding: 5px;
	}
</style>
