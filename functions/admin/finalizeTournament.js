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

export const finalizeTournament = onCall({
  ...defaultOptions,
  secrets: [DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE, DISCORD_MID_ROLE, DISCORD_HIGH_ROLE],
}, async (request) => {
  await validateAdminRequest(request);

  const snap = await db.ref("players").once("value");
  const playersObj = snap.val();
  if (!playersObj) {
    throw new HttpsError("not-found", "No players found");
  }

  const updates = {};
  const uidsToUpdate = [];

  Object.values(playersObj).forEach((p) => {
    const next = (p.elo || 1000) + (p.tournamentPoints || 0);
    let mid = p.isMidConfirmed;
    let high = p.isHighConfirmed;
    if (mid && next < 1150) mid = false;
    if (!mid && next >= 1200) mid = true;
    if (high && next < 1350) high = false;
    if (!high && next >= 1400) high = true;

    updates["players/" + p.uid + "/elo"] = next;
    updates["players/" + p.uid + "/tournamentPoints"] = 0;
    updates["players/" + p.uid + "/isMidConfirmed"] = mid;
    updates["players/" + p.uid + "/isHighConfirmed"] = high;
    updates["players/" + p.uid + "/lastEloUpdateTimestamp"] = Date.now();

    if (p.discordId && mid != p.isMidConfirmed || high != p.isHighConfirmed) {
      uidsToUpdate.push(p.uid);
    }
  });

  await db.ref().update(updates);
  await Promise.all(uidsToUpdate.map((uid) => assignDiscordRole(uid)));

  return {success: true};
});
