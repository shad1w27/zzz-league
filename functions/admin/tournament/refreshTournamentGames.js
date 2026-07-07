import {onCall, HttpsError} from "firebase-functions/https";
import {CHALLONGE_API_KEY} from "../../config/secrets.js";
import {updateTournamentGames} from "../../utils/updateTournamentGames.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";

export const refreshTournamentGames = onCall({
  ...defaultOptions,
  secrets: [CHALLONGE_API_KEY],
}, async (request) => {
  await validateAdminRequest(request);

  const {tournamentId, challongeTournamentId} = request.data;
  if (!tournamentId || !challongeTournamentId) {
    throw new HttpsError("invalid-argument",
        "tournamentId, challongeTournamentId are required");
  }

  await updateTournamentGames(tournamentId, challongeTournamentId);

  return {success: true};
});
