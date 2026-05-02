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