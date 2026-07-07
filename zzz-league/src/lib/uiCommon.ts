import { createTournamentOpen, loginOpen, profileUser, registerOpen, settingsOpen, viewingImage } from "./store";
import type { Player } from "./types";

export const dateDisplayOptions: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
};

export const bustCache = (url: string) => `${url}?t=${Date.now()}`;

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

export function openCreateTournamentPopup() {
	createTournamentOpen.set(true);
}

export function closeCreateTournamentPopup() {
	createTournamentOpen.set(false);
}

export function openImagePopup(src: string) {
	viewingImage.set(src);
}

export function closeImagePopup() {
	viewingImage.set("");
}