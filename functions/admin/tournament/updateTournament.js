import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";
import {hasTournamentStarted} from "../../utils/tournamentState.js";

export const updateTournament = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {
    tournamentId,
    name,
    description,
    registrationStartDate,
    registrationEndDate,
    tournamentStartDate,
    tournamentEndDate,
    minCost,
    maxCost,
    minCharacters,
    minTier,
    maxTier,
    overrideEloChange,
    type,
    consolationMatchesTargetRank,
    visible,
    discordRoleName,
    discordChannelName,
  } = request.data;

  if (!tournamentId || !name || !registrationStartDate ||
    !registrationEndDate || !tournamentStartDate || !tournamentEndDate ||
    minCost == null || maxCost == null || minCharacters == null ||
    minTier == null || maxTier == null || type == null ||
    overrideEloChange == null) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const tournamentRef = db.ref("tournaments/" + tournamentId);
  const tournamentSnap = await tournamentRef.once("value");
  const tournament = tournamentSnap.val();
  if (!tournament) {
    throw new HttpsError("not-found", "Tournament not found");
  }
  if (hasTournamentStarted(tournament.state)) {
    throw new HttpsError("failed-precondition",
        "Tournament has already started");
  }

  await tournamentRef.update({
    name,
    description: description ?? "",
    registrationStartDate,
    registrationEndDate,
    tournamentStartDate,
    tournamentEndDate,
    minCost,
    maxCost,
    minCharacters,
    minTier,
    maxTier,
    overrideEloChange,
    type,
    consolationMatchesTargetRank: consolationMatchesTargetRank ?? null,
    visible: visible ?? true,
    discordRoleName: discordRoleName ?? "",
    discordChannelName: discordChannelName ?? "",
  });

  return {success: true};
});
