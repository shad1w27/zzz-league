<script lang="ts">
	import "../app.css";

	import {
		profileUser,
		settingsOpen,
		loginOpen,
		registerOpen,
		currentUser,
		isAdmin,
		players,
		viewingImage,
		createTournamentOpen,
	} from "$lib/store";

	import LoginPopup from "$lib/components/LoginPopup.svelte";
	import PlayerProfilePopup from "$lib/components/PlayerProfilePopup.svelte";
	import RegisterPopup from "$lib/components/RegisterPopup.svelte";
	import SettingsPopup from "$lib/components/SettingsPopup.svelte";
	import { onMount } from "svelte";
	import { onAuthStateChanged } from "firebase/auth";
	import { onValue, ref } from "firebase/database";
	import { auth, db } from "$lib/firebase";
	import type { Player } from "$lib/types";
	import ImageViwerPopup from "$lib/components/ImageViwerPopup.svelte";
	import CreateTournamentPopup from "$lib/components/CreateTournamentPopup.svelte";
	import SiteHeader from "$lib/components/Header.svelte";

	let { children } = $props();

	let profileOpen = $state(false);
	let imageViewerOpen = $state(false);

	$effect(() => {
		profileOpen = $profileUser !== null;
		imageViewerOpen = !!$viewingImage;
	});

	onMount(() => {
		let unsubUser: (() => void) | null = null;

		const unsubAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				unsubUser = onValue(ref(db, "players/" + user.uid), (snap) => {
					if (snap.exists()) {
						const player = snap.val();
						$currentUser = {
							uid: player.uid,
							name: player.name,
							discord: player.discord,
							discordId: player.discordId,
							elo: player.elo,
							tournamentPoints: player.tournamentPoints,
							isMidConfirmed: player.isMidConfirmed,
							isHighConfirmed: player.isHighConfirmed,
							wins: player.wins ?? 0,
							losses: player.losses ?? 0,
						};
						$isAdmin = !!player.isAdmin;
					}
				});
			} else {
				$currentUser = null;
				$isAdmin = false;
			}
		});

		const unsubPlayers = onValue(ref(db, "players"), (snap) => {
			const val = snap.val();
			$players = val
				? (Object.values(val).filter((p: any) => p?.name) as Player[])
				: [];
		});

		return () => {
			unsubAuth();
			if (unsubUser) unsubUser();
			unsubPlayers();
		};
	});
</script>

<SiteHeader />

{@render children()}

{#if $loginOpen}<LoginPopup />{/if}
{#if $registerOpen}<RegisterPopup />{/if}
{#if $settingsOpen}<SettingsPopup />{/if}
{#if $createTournamentOpen}
	<CreateTournamentPopup />
{/if}
{#if profileOpen}<PlayerProfilePopup player={$profileUser} />{/if}
{#if imageViewerOpen}<ImageViwerPopup src={$viewingImage} />{/if}
