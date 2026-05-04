export interface Player {
	uid: string
	name: string
	discord: string
	elo: number
	tournamentPoints: number
	promoStreak: number
	isMidConfirmed: boolean
	isHighConfirmed: boolean
}

export interface MatchRecord {
	p1: string
	p2: string
	change: number
}

export type Archives = Record<string, Player[]>