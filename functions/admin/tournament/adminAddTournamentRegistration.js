import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";

export const adminAddTournamentRegistration = onCall(
    defaultOptions,
    async (request) => {
      await validateAdminRequest(request);

      const {tournamentId, uid} = request.data;

      if (!tournamentId || !uid) {
        throw new HttpsError("invalid-argument",
            "tournamentId and uid are required");
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

      const playerSnap = await db.ref("players/" + uid).once("value");
      const player = playerSnap.val();
      if (!player) {
        throw new HttpsError("not-found", "Player not found");
      }

      const regRef = db.ref(`tournaments/${tournamentId}/registrations/${uid}`);
      const regSnap = await regRef.once("value");
      if (regSnap.exists()) {
        throw new HttpsError("already-exists",
            "Player is already registered");
      }

      await regRef.set({
        uid,
        zzzUid: "",
        darteNickname: player.name,
        darteAccount: "",
        dartePreset: "",
        rosterScreenshot: "",
        registrationTimestamp: Date.now(),
        approved: true,
      });

      return {success: true};
    },
);
