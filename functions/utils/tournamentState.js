export const TOURNAMENT_STATE = {
  REGISTRATION: "registration",
  REGISTRATION_CLOSED: "registration_closed",
  BRACKET_CREATED: "bracket_created",
  STARTED: "started",
  AWAITING_REVIEW: "awaiting_review",
  COMPLETE: "complete",
};

export function isRegistrationOpen(state) {
  return !state || state === TOURNAMENT_STATE.REGISTRATION;
}

export function isBracketCreated(state) {
  return state === TOURNAMENT_STATE.BRACKET_CREATED;
}

export function hasTournamentStarted(state) {
  return state === TOURNAMENT_STATE.STARTED ||
    state === TOURNAMENT_STATE.AWAITING_REVIEW ||
    state === TOURNAMENT_STATE.COMPLETE;
}

// True once the Challonge bracket exists (participants locked in), whether
// or not the tournament itself has been started yet. Registration/roster
// changes must be blocked from this point on.
export function isLocked(state) {
  return isBracketCreated(state) || hasTournamentStarted(state);
}
