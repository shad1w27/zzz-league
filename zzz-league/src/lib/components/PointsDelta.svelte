<script lang="ts">
	let {
		points,
		tag = "small",
		class: className = "",
	}: { points: number; tag?: string; class?: string } = $props();
</script>

{#if points}
	<svelte:element
		this={tag}
		class="{className} {points > 0 ? 'gain' : 'loss'}"
	>
		({points > 0 ? "+" : ""}{points})
	</svelte:element>
{/if}
