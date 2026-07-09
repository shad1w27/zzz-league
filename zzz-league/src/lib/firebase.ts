import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFunctions } from 'firebase/functions'
import { httpsCallable } from 'firebase/functions'
import type { Tournament } from './types'

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
): Promise<void> {
	const fn = httpsCallable(functions, 'register');
	const result = await fn({ username, email, password }) as any;
	await signInWithCustomToken(auth, result.data.token);
}

export async function clearHistory(): Promise<void> {
	await httpsCallable(functions, 'clearHistory')();
}

export async function registerMatch(p1: string, p2: string, p1Win: boolean, overrideEloChange: number, techLoss: boolean = false): Promise<void> {
	await httpsCallable(functions, "registerMatch")({ p1, p2, p1Win, overrideEloChange, techLoss });
}

export async function setTimer(timer: number): Promise<void> {
	await httpsCallable(functions, "setTimer")({ timer });
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

export async function updateProfile(username: string | null): Promise<void> {
	await httpsCallable(functions, 'updateProfile')({ username });
}

export async function linkDiscord(code: string, redirectUri: string): Promise<void> {
	await httpsCallable(functions, 'linkDiscord')({ code, redirectUri });
}

export async function unlinkDiscord(): Promise<void> {
	await httpsCallable(functions, 'unlinkDiscord')();
}

export async function deleteHistoryEntry(key: string): Promise<void> {
	await httpsCallable(functions, 'deleteHistoryEntry')({ key });
}

export async function createTournament(data: Tournament): Promise<string> {
	const fn = httpsCallable(functions, 'createTournament');
	const result = await fn(data) as any;
	return result.data.id;
}

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export async function applyForTournament(tournamentId: string, zzzUid: string, darteNickname: string,
	darteAccount: string, dartePreset: string, rosterScreenshot: File): Promise<void> {

	await httpsCallable(functions, 'applyForTournament')({
		tournamentId,
		zzzUid,
		darteNickname,
		darteAccount,
		dartePreset,
		rosterScreenshot: await fileToBase64(rosterScreenshot),
	});
}

export async function approveRegistration(tournamentId: string, uid: string, approved: boolean): Promise<void> {
	await httpsCallable(functions, 'approveRegistration')({
		tournamentId,
		uid,
		approved
	});
}

export async function startChallongeTournament(tournamentId: string): Promise<void> {
	await httpsCallable(functions, 'startChallongeTournament')({
		tournamentId,
	});
}

export async function splitTournament(tournamentId: string, divisionSizes: number[]): Promise<string[]> {
	const fn = httpsCallable(functions, 'splitTournament');
	const result = await fn({ tournamentId, divisionSizes }) as any;
	return result.data.divisionTournamentIds;
}

export async function adminAddTournamentRegistration(tournamentId: string, uid: string): Promise<void> {
	await httpsCallable(functions, 'adminAddTournamentRegistration')({ tournamentId, uid });
}

export async function deleteTournament(tournamentId: string): Promise<void> {
	await httpsCallable(functions, 'deleteTournament')({ tournamentId });
}

export async function approveResult(tournamentId: string, matchId: string,
	resultP1: number, resultP2: number, resultScreenshot: File | null = null): Promise<void> {
	let body: any = {
		tournamentId,
		matchId,
		resultP1,
		resultP2,
	};

	if (resultScreenshot) {
		body.resultScreenshot = await fileToBase64(resultScreenshot);
	}

	await httpsCallable(functions, 'approveResult')(body);
}

export async function updateTournamentGames(tournamentId: string, challongeTournamentId: string): Promise<void> {
	await httpsCallable(functions, 'refreshTournamentGames')({
		tournamentId,
		challongeTournamentId
	});
}

export async function finishTournament(tournamentId: string, challongeTournamentId: string): Promise<void> {
	await httpsCallable(functions, 'finishTournament')({
		tournamentId,
		challongeTournamentId
	});
}

export async function adminSetMatchResult(tournamentId: string, matchId: string,
	resultP1: string | null, resultP2: string | null, resultScreenshot: File | null = null,
	techLossUid: string | null = null): Promise<void> {
	let body: any = {
		tournamentId,
		matchId,
		resultP1,
		resultP2,
		techLossUid,
	};

	if (resultScreenshot) {
		body.resultScreenshot = await fileToBase64(resultScreenshot);
	}

	await httpsCallable(functions, 'adminSetMatchResult')(body);
}