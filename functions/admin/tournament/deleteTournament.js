import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {
  CHALLONGE_API_KEY,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
} from "../../config/secrets.js";
import {
  deleteTournamentDiscordChannel,
  deleteTournamentDiscordRole,
} from "../../discord/tournamentDiscordResources.js";
import {defaultOptions} from "../../config/options.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";

export const deleteTournament = onCall({
  ...defaultOptions,
  secrets: [CHALLONGE_API_KEY, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID],
}, async (request) => {
  await validateAdminRequest(request);

  const {tournamentId} = request.data;
  if (!tournamentId) {
    throw new HttpsError("invalid-argument", "tournamentId is required");
  }

  const tournamentSnap =
    await db.ref("tournaments/" + tournamentId).once("value");
  const tournament = tournamentSnap.val();
  if (!tournament) {
    throw new HttpsError("not-found", "Tournament not found");
  }

  const cleanupErrors = [];

  if (tournament.challongeTournamentId) {
    try {
      const res = await fetch(
          `https://api.challonge.com/v2.1/tournaments/${tournament.challongeTournamentId}.json`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/vnd.api+json",
              "Accept": "application/json",
              "Authorization-Type": "v1",
              "Authorization": CHALLONGE_API_KEY.value(),
            },
          },
      );

      if (!res.ok && res.status !== 404) {
        const data = await res.json();
        cleanupErrors.push(`Challonge: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      cleanupErrors.push(`Challonge: ${error.message}`);
    }
  }

  try {
    await deleteTournamentDiscordRole(tournamentId);
  } catch (error) {
    cleanupErrors.push(`Discord role: ${error.message}`);
  }

  try {
    await deleteTournamentDiscordChannel(tournamentId);
  } catch (error) {
    cleanupErrors.push(`Discord channel: ${error.message}`);
  }

  await db.ref("tournaments/" + tournamentId).remove();

  if (cleanupErrors.length > 0) {
    throw new HttpsError("internal",
        `Tournament deleted, but cleanup failed: ${cleanupErrors.join("; ")}`);
  }

  return {success: true};
});
