import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
} from "../config/secrets.js";
import {assignDiscordRole} from "./assignDiscordRole.js";
import {getDiscordUser} from "./discordClient.js";
import {defaultOptions} from "../config/options.js";

export const linkDiscord = onCall({
  ...defaultOptions,
  secrets: [
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID,
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
  if (!tokenData.access_token) {
    throw new HttpsError("internal",
        `Discord error: ${JSON.stringify(tokenData)}`);
  }

  let discordUser;
  try {
    discordUser = await getDiscordUser(tokenData.access_token);
  } catch (error) {
    throw new HttpsError("internal", `Discord error: ${error.message}`);
  }

  await db.ref("players/" + callerUid).update({
    discordId: discordUser.id,
    discord: discordUser.username,
  });

  await assignDiscordRole(callerUid);

  return {success: true, username: discordUser.username};
});
