import DOMPurify from "dompurify";
import { marked } from "marked";
import { loginOpen, profileUser, registerOpen, settingsOpen, viewingImage } from "./store";
import type { Player } from "./types";

marked.setOptions({ breaks: true });

export const dateDisplayOptions: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
};

export const bustCache = (url: string) => `${url}?t=${Date.now()}`;

export const MAX_IMAGE_SIZE_MB = 3;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export function isImageTooLarge(file: File): boolean {
	return file.size > MAX_IMAGE_SIZE_BYTES;
}

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

export function openImagePopup(src: string) {
	viewingImage.set(src);
}

export function closeImagePopup() {
	viewingImage.set("");
}

export function renderMarkdown(text: string): string {
	// CommonMark treats __text__ as bold, same as **text**. Convert it to real
	// underline first so __text__ reads as underline (matches Discord's convention).
	const withUnderline = (text ?? "").replace(/__(.+?)__/g, "<u>$1</u>");
	const html = marked.parse(withUnderline, { async: false }) as string;
	return DOMPurify.sanitize(html);
}