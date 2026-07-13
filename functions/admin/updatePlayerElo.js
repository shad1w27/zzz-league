import {onCall, HttpsError} from "firebase-functions/https";
import admin from "firebase-admin";
import {db} from "../config/firebase.js";
import {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_NEWBIE_ROLE,
  DISCORD_MID_ROLE,
  DISCORD_HIGH_ROLE,
} from "../config/secrets.js";
import {assignDiscordRole} from "../discord/assignDiscordRole.js";
import {validateAdminRequest} from "../utils/validateAdminRequest.js";
import {defaultOptions} from "../config/options.js";

export const updatePlayerElo = onCall({
  ...defaultOptions,
  secrets: [
    DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE,
    DISCORD_MID_ROLE,
    DISCORD_HIGH_ROLE,
  ],
}, async (request) => {
  await validateAdminRequest(request);

  const {uid, elo} = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  const playerSnap = await db.ref("players/" + uid).once("value");
  if (!playerSnap.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const player = playerSnap.val();
  const oldElo = player.elo;
  const change = elo - oldElo;

  let isMidConfirmed = player.isMidConfirmed || false;
  let isHighConfirmed = player.isHighConfirmed || false;

  if (isMidConfirmed && elo < 1150) isMidConfirmed = false;
  if (!isMidConfirmed && elo >= 1200) isMidConfirmed = true;
  if (isHighConfirmed && elo < 1350) isHighConfirmed = false;
  if (!isHighConfirmed && elo >= 1400) isHighConfirmed = true;

  const historyKey = db.ref("historyV3").push().key;

  const updates = {
    [`players/${uid}/elo`]: elo,
    [`players/${uid}/isMidConfirmed`]: isMidConfirmed,
    [`players/${uid}/isHighConfirmed`]: isHighConfirmed,
    [`historyV3/${historyKey}`]: {
      id: historyKey,
      p1: uid,
      p1Change: change,
      p2: null,
      p2Change: null,
      tournamentId: null,
      tournamentMatch: "adjustment",
      resultP1: null,
      resultP2: null,
      resultScreenshot: null,
      timestamp: Date.now(),
    },
  };

  if (change > 0) {
    updates[`players/${uid}/wins`] = admin.database.ServerValue.increment(1);
  } else if (change < 0) {
    updates[`players/${uid}/losses`] = admin.database.ServerValue.increment(1);
  }

  await db.ref().update(updates);

  assignDiscordRole(uid);

  return {success: true};
});
