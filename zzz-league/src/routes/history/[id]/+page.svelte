<script lang="ts">
	import { page } from "$app/state";
	import HistoryList from "$lib/components/HistoryList.svelte";
	import SidePanel from "$lib/components/SidePanel.svelte";

	const id = $derived(page.params.id);
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		<h2>Игры</h2>
		<HistoryList viewerId={id} />
	</div>
</div>
