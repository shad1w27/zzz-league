export const TOURNAMENT_STATE = {
	REGISTRATION: "registration",
	REGISTRATION_CLOSED: "registration_closed",
	BRACKET_CREATED: "bracket_created",
	STARTED: "started",
	AWAITING_REVIEW: "awaiting_review",
	COMPLETE: "complete",
} as const;

export function isRegistrationOpen(state: string | undefined): boolean {
	return !state || state === TOURNAMENT_STATE.REGISTRATION;
}

export function isRegistrationClosed(state: string | undefined): boolean {
	return state === TOURNAMENT_STATE.REGISTRATION_CLOSED;
}

export function isBracketCreated(state: string | undefined): boolean {
	return state === TOURNAMENT_STATE.BRACKET_CREATED;
}

export function hasTournamentStarted(state: string | undefined): boolean {
	return (
		state === TOURNAMENT_STATE.STARTED ||
		state === TOURNAMENT_STATE.AWAITING_REVIEW ||
		state === TOURNAMENT_STATE.COMPLETE
	);
}

// True once the Challonge bracket exists (participants locked in), whether
// or not the tournament itself has been started yet. Registration/roster
// changes must be blocked from this point on.
export function isLocked(state: string | undefined): boolean {
	return isBracketCreated(state) || hasTournamentStarted(state);
}
