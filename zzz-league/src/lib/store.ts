import { writable } from 'svelte/store'
import type { Player } from './types';

export const currentUser = writable<Player | null>(null);
export const isAdmin = writable(false);

export const players = writable<Player[]>([]);

export const loginOpen = writable(false);
export const registerOpen = writable(false);
export const settingsOpen = writable(false);
export const profileUser = writable<Player | null>(null);