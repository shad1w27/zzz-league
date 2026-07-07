import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {defaultOptions} from "../config/options.js";
import {validateAdminRequest} from "../utils/validateAdminRequest.js";

export const updateMatchData = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {uid, change, isWin} = request.data;

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const player = snapshot.val();

  let confirmed = player.isMidConfirmed || false;

  if ((player.elo || 1000) >= 1200 && !confirmed) {
    if (isWin) {
      confirmed = true;
    }
  }
  await db.ref("players/" + player.uid).update({
    tournamentPoints: (player.tournamentPoints || 0) + change,
    isMidConfirmed: confirmed,
  });
});
