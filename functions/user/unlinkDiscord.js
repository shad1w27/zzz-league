import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_NEWBIE_ROLE,
  DISCORD_MID_ROLE,
  DISCORD_HIGH_ROLE,
} from "../config/secrets.js";
import {defaultOptions} from "../config/options.js";

export const unlinkDiscord = onCall({
  ...defaultOptions,
  secrets: [DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE,
    DISCORD_MID_ROLE,
    DISCORD_HIGH_ROLE],
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const playerSnap = await db.ref("players/" + callerUid).once("value");
  const player = playerSnap.val();
  if (!player) throw new HttpsError("not-found", "Player not found");

  if (player.discordId) {
    const guildId = DISCORD_GUILD_ID.value();
    const token = DISCORD_BOT_TOKEN.value();
    const allRoles = [
      DISCORD_NEWBIE_ROLE.value(),
      DISCORD_MID_ROLE.value(),
      DISCORD_HIGH_ROLE.value(),
    ];

    await Promise.all(allRoles.map((roleId) => fetch(`https://discord.com/api/guilds/${guildId}/members/${player.discordId}/roles/${roleId}`, {
      method: "DELETE",
      headers: {Authorization: `Bot ${token}`},
    }),
    ));
  }

  await db.ref("players/" + callerUid).update({
    discordId: null,
    discord: null,
  });

  return {success: true};
});
