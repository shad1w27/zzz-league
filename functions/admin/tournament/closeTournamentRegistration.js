import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";
import {TOURNAMENT_STATE, isRegistrationOpen}
  from "../../utils/tournamentState.js";

export const closeTournamentRegistration = onCall(
    defaultOptions,
    async (request) => {
      await validateAdminRequest(request);

      const {tournamentId} = request.data;
      if (!tournamentId) {
        throw new HttpsError("invalid-argument", "tournamentId is required");
      }

      const tournamentRef = db.ref("tournaments/" + tournamentId);
      const tournamentSnap = await tournamentRef.once("value");
      const tournament = tournamentSnap.val();
      if (!tournament) {
        throw new HttpsError("not-found", "Tournament not found");
      }

      if (!isRegistrationOpen(tournament.state)) {
        throw new HttpsError("failed-precondition",
            "Tournament is not currently accepting registrations");
      }

      await tournamentRef.update({
        state: TOURNAMENT_STATE.REGISTRATION_CLOSED,
      });

      return {success: true};
    },
);
