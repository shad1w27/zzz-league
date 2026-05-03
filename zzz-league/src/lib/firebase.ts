import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFunctions } from 'firebase/functions'
import { httpsCallable } from 'firebase/functions'

const firebaseConfig = {
	apiKey: "AIzaSyAlcnUiLJ1cq7ekCQFi_NOPAQ6UiG92ZqM",
	databaseURL: "https://zzz-league-default-rtdb.firebaseio.com",
	projectId: "zzz-league"
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const functions = getFunctions(app, "europe-west1");

export async function addPlayer(name: string): Promise<void> {
	if (!name.trim()) return;

	await httpsCallable(functions, 'addPlayer')({ name });
}

export async function deletePlayer(uid: string): Promise<void> {
	await httpsCallable(functions, 'deletePlayer')({ uid });
}

export async function updatePlayerElo(uid: string, elo: number): Promise<void> {
	await httpsCallable(functions, 'updatePlayerElo')({ uid, elo });
}

export async function registerUser(
	username: string,
	email: string,
	password: string,
	discord: string
): Promise<void> {
	const fn = httpsCallable(functions, 'register');
	const result = await fn({ username, email, password, discord }) as any;
	await signInWithCustomToken(auth, result.data.token);
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

export async function deleteArchive(key: string): Promise<void> {
	await httpsCallable(functions, "deleteArchive")({ key });
}
