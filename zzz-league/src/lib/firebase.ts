import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFunctions } from 'firebase/functions'
import { ref, set } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'

import type { Player } from './types'

const firebaseConfig = {
	apiKey: "AIzaSyCCACnq23Ozr0KGUW2MNAti2rltAoBR3EA",
	databaseURL: "https://zzz-shad1w-default-rtdb.firebaseio.com",
	projectId: "zzz-shad1w"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getDatabase(app)
export const functions = getFunctions(app)

export async function addPlayer(name: string): Promise<void> {
	if (!name.trim()) return;

	const player: Player = {
		uid: name,
		name,
		elo: 1000,
		tournamentPoints: 0,
		promoStreak: 0,
		isMidConfirmed: false,
		isHighConfirmed: false,
		discord: ""
	}
	await set(ref(db, 'players/' + name), player)
}

export async function deletePlayer(uid: string): Promise<void> {
	if (!confirm('Удалить игрока?')) return
	await httpsCallable(functions, 'deletePlayer')({ uid })
}

export async function updatePlayerElo(uid: string, elo: number): Promise<void> {
	await httpsCallable(functions, 'updatePlayerElo')({ uid, elo })
}

export async function registerUser(
	username: string,
	email: string,
	password: string,
	discord: string
): Promise<void> {
	const fn = httpsCallable(functions, 'register')
	const result = await fn({ username, email, password, discord }) as any
	await signInWithCustomToken(auth, result.data.token)
}

export async function addHistoryEntry(playerName1: string, playerName2: string, change: number): Promise<void> {
	await httpsCallable(functions, 'addHistoryEntry')({ playerName1, playerName2, change });
}

export async function clearHistory(): Promise<void> {
	await httpsCallable(functions, 'clearHistory')();
}

export async function updateMatchData(uid: string, change: number, isWin: boolean): Promise<void> {
	await httpsCallable(functions, "updateMatchData")({ uid, change, isWin });
}

export async function setTimer(timer: number): Promise<void> {
	await httpsCallable(functions, "updateMatchData")({ timer });
}

export async function resetSeason(name: string): Promise<void> {
	await httpsCallable(functions, "resetSeason")({ seasonName: name });
}

export async function finalizeTournament(): Promise<void> {
	await httpsCallable(functions, "finalizeTournament")();
}
