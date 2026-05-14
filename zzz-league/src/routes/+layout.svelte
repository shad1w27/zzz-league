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
	} from "$lib/store";

	import LoginPopup from "$lib/components/LoginPopup.svelte";
	import PlayerProfile from "$lib/components/PlayerProfile.svelte";
	import RegisterPopup from "$lib/components/RegisterPopup.svelte";
	import SettingsPopup from "$lib/components/SettingsPopup.svelte";
	import { onMount } from "svelte";
	import { onAuthStateChanged } from "firebase/auth";
	import { onValue, ref } from "firebase/database";
	import { auth, db } from "$lib/firebase";
	import type { Player } from "$lib/types";

	let { children } = $props();

	let profileOpen = $state(false);

	$effect(() => {
		profileOpen = $profileUser !== null;
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

{#if $loginOpen}<LoginPopup />{/if}
{#if $registerOpen}<RegisterPopup />{/if}
{#if $settingsOpen}<SettingsPopup />{/if}
{#if profileOpen}<PlayerProfile player={$profileUser} />{/if}

{@render children()}
