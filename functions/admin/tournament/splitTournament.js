import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";
import {TOURNAMENT_STATE, isLocked}
  from "../../utils/tournamentState.js";

export const splitTournament = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {tournamentId, divisionGroups} = request.data;

  if (!tournamentId || !Array.isArray(divisionGroups) ||
    divisionGroups.length < 2 ||
    !divisionGroups.every((g) => Array.isArray(g) && g.length >= 2 &&
      g.every((uid) => typeof uid === "string"))) {
    throw new HttpsError("invalid-argument",
        "tournamentId and divisionGroups " +
        "(array of >=2 arrays of player uids, each with >=2 players) " +
        "are required");
  }

  const tournamentSnap =
    await db.ref("tournaments/" + tournamentId).once("value");
  const tournament = tournamentSnap.val();
  if (!tournament) {
    throw new HttpsError("not-found", "Tournament not found");
  }

  if (isLocked(tournament.state) || tournament.challongeTournamentId) {
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
  const approvedUids = new Set(approved.map((r) => r.uid));

  const groupedUids = divisionGroups.flat();
  const groupedUidsSet = new Set(groupedUids);
  if (groupedUids.length !== groupedUidsSet.size ||
    groupedUids.length !== approved.length ||
    !groupedUids.every((uid) => approvedUids.has(uid))) {
    throw new HttpsError("failed-precondition",
        "divisionGroups must contain every approved registration " +
        "exactly once");
  }

  const registrationsByUid = Object.fromEntries(
      approved.map((r) => [r.uid, r]),
  );
  const groups = divisionGroups.map(
      (g) => g.map((uid) => registrationsByUid[uid]),
  );

  const updates = {};

  const closedRegistrationEndDate =
    Math.min(tournament.registrationEndDate, Date.now());

  const division1Group = groups[0];
  const division1Uids = new Set(division1Group.map((r) => r.uid));
  updates[`tournaments/${tournamentId}/name`] =
    `${tournament.name} A`;
  if (tournament.discordChannelName) {
    updates[`tournaments/${tournamentId}/discordChannelName`] =
      `${tournament.discordChannelName}-A`;
  }
  updates[`tournaments/${tournamentId}/divisionGroupId`] = tournamentId;
  updates[`tournaments/${tournamentId}/divisionIndex`] = 1;
  updates[`tournaments/${tournamentId}/registrationEndDate`] =
    closedRegistrationEndDate;
  updates[`tournaments/${tournamentId}/state`] =
    TOURNAMENT_STATE.REGISTRATION_CLOSED;
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
    visible,
    discordRoleName,
    discordChannelName,
  } = tournament;

  const divisionTournamentIds = [tournamentId];

  for (let i = 1; i < groups.length; i++) {
    const divisionIndex = i + 1;
    const divisionLetter = String.fromCharCode(64 + divisionIndex);
    const newRef = db.ref("tournaments").push();
    const newId = newRef.key;
    divisionTournamentIds.push(newId);

    updates[`tournaments/${newId}`] = {
      id: newId,
      name: `${tournament.name} ${divisionLetter}`,
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
      visible: visible ?? true,
      discordRoleName: discordRoleName ?? "",
      discordChannelName: discordChannelName ?
        `${discordChannelName}-${divisionLetter}` : "",
      state: TOURNAMENT_STATE.REGISTRATION_CLOSED,
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
