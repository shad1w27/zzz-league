export interface Player {
	uid: string,
	name: string,
	discordId: string,
	discord: string,
	elo: number,
	tournamentPoints: number,
	isMidConfirmed: boolean,
	isHighConfirmed: boolean,
	wins: number,
	losses: number
}

export interface MatchRecord {
	key: string,
	p1: string,
	p2: string,
	change: number
}

export type Archives = Record<string, Player[]>

export interface TournamentMatch {
	id: number,
	p1: string,
	p2: string,
	state: string,
	winnerId: string,
	resultScreenshot: string,
	resultP1: number,
	resultP2: number,
	p1ApprovedResult: boolean,
	p2ApprovedResult: boolean,
	techLossUid: string | null
}

export interface Tournament {
	id: string,
	name: string,
	description: string,
	registrationStartDate: number,
	registrationEndDate: number,
	tournamentStartDate: number,
	tournamentEndDate: number,
	minCost: number,
	maxCost: number,
	minCharacters: number,
	minTier: number,
	maxTier: number,
	challongeTournamentId: string,
	challongeTournamentUrl: string,
	matches: TournamentMatch[],
	state: string,
	winnerId: any,
	type: string,
	overrideEloChange: number,
	consolationMatchesTargetRank: number | null,
	divisionGroupId?: string,
	divisionIndex?: number,
}

export interface TournamentRegistration {
	uid: string,
	zzzUid: string,
	darteNickname: string,
	darteAccount: string,
	dartePreset: string,
	rosterScreenshot: string,
	hoyolabScreenshot: string,
	approved: boolean,
	registrationTimestamp: number
}

export interface RegisteredPlayer {
	player: Player,
	registration: TournamentRegistration
}