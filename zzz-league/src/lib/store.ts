import { writable } from 'svelte/store'
import type { Player } from './types'

export const profilePlayer = writable<Player | null>(null)