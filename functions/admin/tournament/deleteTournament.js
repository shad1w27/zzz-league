import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";

export const deleteTournament = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {tournamentId} = request.data;
  if (!tournamentId) {
    throw new HttpsError("invalid-argument", "tournamentId is required");
  }

  const tournamentSnap =
    await db.ref("tournaments/" + tournamentId).once("value");
  if (!tournamentSnap.exists()) {
    throw new HttpsError("not-found", "Tournament not found");
  }

  await db.ref("tournaments/" + tournamentId).remove();

  return {success: true};
});
