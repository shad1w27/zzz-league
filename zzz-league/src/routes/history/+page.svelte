<script lang="ts">
	import HistoryList from "$lib/components/HistoryList.svelte";
	import SidePanel from "$lib/components/SidePanel.svelte";
</script>

<div class="layout">
	<SidePanel></SidePanel>

	<div class="card main-content">
		<h2>Вся история</h2>
		<HistoryList />
	</div>
</div>
