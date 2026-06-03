import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_NEWBIE_ROLE,
  DISCORD_MID_ROLE,
  DISCORD_HIGH_ROLE} from "../config/secrets.js";
import {assignDiscordRole} from "../utils/assignDiscordRole.js";
import {defaultOptions} from "../config/options.js";

export const linkDiscord = onCall({
  ...defaultOptions,
  secrets: [
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE,
    DISCORD_MID_ROLE,
    DISCORD_HIGH_ROLE,
  ],
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const {code, redirectUri} = request.data;

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID.value(),
      client_secret: DISCORD_CLIENT_SECRET.value(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: {Authorization: `Bearer ${tokenData.access_token}`},
  });
  const discordUser = await userRes.json();

  if (!discordUser.id) {
    throw new HttpsError("internal",
        `Discord error: ${JSON.stringify(discordUser)}`);
  }

  await db.ref("players/" + callerUid).update({
    discordId: discordUser.id,
    discord: discordUser.username,
  });

  await assignDiscordRole(callerUid);

  return {success: true, username: discordUser.username};
});
