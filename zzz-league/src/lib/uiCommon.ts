import { loginOpen, profileUser, registerOpen, settingsOpen } from "./store";
import type { Player } from "./types";

export function openProfilePopup(player: Player) {
	profileUser.set(player);
}

export function closeProfilePopup() {
	profileUser.set(null);
}

export function openLoginPopup() {
	loginOpen.set(true);
}

export function closeLoginPopup() {
	loginOpen.set(false);
}

export function openRegistrationPopup() {
	registerOpen.set(true);
}

export function closeRegistrationPopup() {
	registerOpen.set(false);
}

export function openSettingsPopup() {
	settingsOpen.set(true);
}

export function closeSettingsPopup() {
	settingsOpen.set(false);
}