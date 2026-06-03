import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_NEWBIE_ROLE,
  DISCORD_MID_ROLE,
  DISCORD_HIGH_ROLE,
} from "../config/secrets.js";
import {assignDiscordRole} from "../utils/assignDiscordRole.js";
import {validateAdminRequest} from "./utils.js";
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

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const oldElo = snapshot.val().elo;

  await db.ref("players/" + uid).update({
    elo,
    isMidConfirmed: elo >= 1200,
    isHighConfirmed: elo >= 1400,
  });

  await db.ref("historyV2/" + uid).push({
    change: elo - oldElo,
    timestamp: Date.now(),
  });

  assignDiscordRole(uid);

  return {success: true};
});
