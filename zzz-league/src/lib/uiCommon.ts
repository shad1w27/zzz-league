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

export const bustCache = (url: string) =>
	url.startsWith("blob:") ? url : `${url}?t=${Date.now()}`;

export const MAX_IMAGE_SIZE_MB = 3;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export function isImageTooLarge(file: File): boolean {
	return file.size > MAX_IMAGE_SIZE_BYTES;
}

export async function pasteImageFromClipboard(): Promise<FileList | null> {
	const clipboardItems = await navigator.clipboard.read();
	for (const item of clipboardItems) {
		const imageType = item.types.find((t) => t.startsWith("image/"));
		if (!imageType) continue;
		const blob = await item.getType(imageType);
		const file = new File([blob], "pasted-image.png", { type: blob.type });
		return filesFromImageFile(file);
	}
	return null;
}

export function filesFromImageFile(file: File): FileList {
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	return dataTransfer.files;
}

export function imageFileFromPasteEvent(e: ClipboardEvent): File | null {
	const items = e.clipboardData?.items;
	if (!items) return null;
	for (const item of items) {
		if (item.type.startsWith("image/")) {
			return item.getAsFile();
		}
	}
	return null;
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