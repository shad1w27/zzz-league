import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {DISCORD_BOT_TOKEN, DISCORD_GUILD_ID} from "../config/secrets.js";
import {
  DISCORD_NEWBIE_ROLE_ID,
  DISCORD_MID_ROLE_ID,
  DISCORD_HIGH_ROLE_ID,
} from "../config/discordRoles.js";
import {removeMemberRole} from "./discordClient.js";
import {defaultOptions} from "../config/options.js";

export const unlinkDiscord = onCall({
  ...defaultOptions,
  secrets: [DISCORD_BOT_TOKEN, DISCORD_GUILD_ID],
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const playerSnap = await db.ref("players/" + callerUid).once("value");
  const player = playerSnap.val();
  if (!player) throw new HttpsError("not-found", "Player not found");

  if (player.discordId) {
    const allRoles = [
      DISCORD_NEWBIE_ROLE_ID,
      DISCORD_MID_ROLE_ID,
      DISCORD_HIGH_ROLE_ID,
    ];

    await Promise.all(
        allRoles.map((roleId) => removeMemberRole(player.discordId, roleId)),
    );
  }

  await db.ref("players/" + callerUid).update({
    discordId: null,
    discord: null,
  });

  return {success: true};
});
