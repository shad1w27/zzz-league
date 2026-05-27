export interface Player {
	uid: string,
	name: string,
	discordId: string,
	discord: string,
	elo: number,
	tournamentPoints: number,
	isMidConfirmed: boolean,
	isHighConfirmed: boolean
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
	resultP2: number
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
	matches: TournamentMatch[]
}

export interface TournamentRegistration {
	uid: string,
	darteAccount: string,
	dartePreset: string,
	rosterScreenshot: string,
	approved: boolean,
	registrationTimestamp: number
}

export interface RegisteredPlayer {
	player: Player,
	registration: TournamentRegistration
}