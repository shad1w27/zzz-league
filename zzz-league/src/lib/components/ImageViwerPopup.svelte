<script lang="ts">
	import { bustCache, closeImagePopup } from "$lib/uiCommon";

	let { src = "", alt = "" } = $props();
	let loaded = $state(false);

	function close() {
		loaded = false;
		closeImagePopup();
	}
</script>

<div class="popup">
	<div class="card image-popup-card">
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
		max-width: 90vw;
		max-height: 90vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	img {
		max-width: 100%;
		max-height: 90vh;
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
		font-size: 1.2em;
		cursor: pointer;
		width: auto;
		padding: 5px;
	}
</style>
