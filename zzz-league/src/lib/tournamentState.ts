export const TOURNAMENT_STATE = {
	REGISTRATION: "registration",
	REGISTRATION_CLOSED: "registration_closed",
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

export function hasTournamentStarted(state: string | undefined): boolean {
	return (
		state === TOURNAMENT_STATE.STARTED ||
		state === TOURNAMENT_STATE.AWAITING_REVIEW ||
		state === TOURNAMENT_STATE.COMPLETE
	);
}
