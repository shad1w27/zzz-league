export const TOURNAMENT_STATE = {
  REGISTRATION: "registration",
  REGISTRATION_CLOSED: "registration_closed",
  STARTED: "started",
  AWAITING_REVIEW: "awaiting_review",
  COMPLETE: "complete",
};

export function isRegistrationOpen(state) {
  return !state || state === TOURNAMENT_STATE.REGISTRATION;
}

export function hasTournamentStarted(state) {
  return state === TOURNAMENT_STATE.STARTED ||
    state === TOURNAMENT_STATE.AWAITING_REVIEW ||
    state === TOURNAMENT_STATE.COMPLETE;
}
