import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const splitTournament = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {tournamentId, divisionSizes} = request.data;

  if (!tournamentId || !Array.isArray(divisionSizes) ||
    divisionSizes.length < 2 ||
    !divisionSizes.every((n) => Number.isInteger(n) && n >= 2)) {
    throw new HttpsError("invalid-argument",
        "tournamentId and divisionSizes " +
        "(array of >=2 integers, each >=2) are required");
  }

  const tournamentSnap =
    await db.ref("tournaments/" + tournamentId).once("value");
  const tournament = tournamentSnap.val();
  if (!tournament) {
    throw new HttpsError("not-found", "Tournament not found");
  }

  if (tournament.state || tournament.challongeTournamentId) {
    throw new HttpsError("failed-precondition",
        "Tournament has already started");
  }

  if (tournament.divisionGroupId) {
    throw new HttpsError("failed-precondition",
        "Tournament has already been split into divisions");
  }

  const regSnap =
    await db.ref(`tournaments/${tournamentId}/registrations`).once("value");
  const registrations = regSnap.val() ?? {};

  const approved = Object.values(registrations).filter((r) => r.approved);

  const totalRequested = divisionSizes.reduce((a, b) => a + b, 0);
  if (totalRequested !== approved.length) {
    throw new HttpsError("failed-precondition",
        `divisionSizes sum to ${totalRequested}, ` +
        `but there are ${approved.length} approved registrations`);
  }

  const shuffled = shuffle(approved);

  const groups = [];
  let offset = 0;
  for (const size of divisionSizes) {
    groups.push(shuffled.slice(offset, offset + size));
    offset += size;
  }

  const updates = {};

  const closedRegistrationEndDate =
    Math.min(tournament.registrationEndDate, Date.now());

  const division1Group = groups[0];
  const division1Uids = new Set(division1Group.map((r) => r.uid));
  updates[`tournaments/${tournamentId}/name`] =
    `${tournament.name} A`;
  updates[`tournaments/${tournamentId}/divisionGroupId`] = tournamentId;
  updates[`tournaments/${tournamentId}/divisionIndex`] = 1;
  updates[`tournaments/${tournamentId}/registrationEndDate`] =
    closedRegistrationEndDate;
  for (const r of approved) {
    if (!division1Uids.has(r.uid)) {
      updates[`tournaments/${tournamentId}/registrations/${r.uid}`] = null;
    }
  }

  const {
    description,
    registrationStartDate,
    tournamentStartDate,
    tournamentEndDate,
    minCost,
    maxCost,
    minCharacters,
    minTier,
    maxTier,
    type,
    overrideEloChange,
    consolationMatchesTargetRank,
  } = tournament;

  const divisionTournamentIds = [tournamentId];

  for (let i = 1; i < groups.length; i++) {
    const divisionIndex = i + 1;
    const newRef = db.ref("tournaments").push();
    const newId = newRef.key;
    divisionTournamentIds.push(newId);

    updates[`tournaments/${newId}`] = {
      id: newId,
      name: `${tournament.name} ${String.fromCharCode(64 + divisionIndex)}`,
      description: description ?? "",
      registrationStartDate,
      registrationEndDate: closedRegistrationEndDate,
      tournamentStartDate,
      tournamentEndDate,
      minCost,
      maxCost,
      minCharacters,
      minTier,
      maxTier,
      type,
      overrideEloChange,
      consolationMatchesTargetRank: consolationMatchesTargetRank ?? null,
      state: "",
      divisionGroupId: tournamentId,
      divisionIndex,
      registrations: Object.fromEntries(
          groups[i].map((r) => [r.uid, r]),
      ),
    };
  }

  await db.ref().update(updates);

  return {success: true, divisionTournamentIds};
});
