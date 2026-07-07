import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {validateAdminRequest} from "../utils/validateAdminRequest.js";
import {defaultOptions} from "../config/options.js";

export const resetSeason = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {seasonName} = request.data;
  if (!seasonName) {
    throw new HttpsError("invalid-argument", "seasonName is required");
  }

  const playersSnap = await db.ref("players").once("value");
  const playersObj = playersSnap.val();
  if (!playersObj) {
    throw new HttpsError("not-found", "No players found");
  }

  const players = Object.values(playersObj);

  const updates = {};

  updates["archives/" + seasonName] = players.map((player) => ({
    name: player.name,
    elo: player.elo || 1000,
    isMidConfirmed: player.isMidConfirmed || false,
    isHighConfirmed: player.isHighConfirmed || false,
  }));

  players.forEach((player) => {
    const start = player.isHighConfirmed ?
      1400 : player.isMidConfirmed ? 1200 : 1000;
    updates["players/" + player.uid + "/elo"] = start;
    updates["players/" + player.uid + "/tournamentPoints"] = 0;
  });

  updates["history"] = null;

  await db.ref().update(updates);

  return {success: true};
});
