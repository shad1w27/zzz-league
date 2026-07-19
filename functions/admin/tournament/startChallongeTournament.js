import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {
  CHALLONGE_API_KEY,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_TOURNAMENT_CATEGORY_ID,
} from "../../config/secrets.js";
import {createTournamentDiscordResources}
  from "../../discord/tournamentDiscordResources.js";
import {updateTournamentGames} from "../../utils/updateTournamentGames.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";
import {TOURNAMENT_STATE, isBracketCreated, hasTournamentStarted}
  from "../../utils/tournamentState.js";

export const startChallongeTournament = onCall({
  ...defaultOptions,
  secrets: [
    CHALLONGE_API_KEY,
    DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID,
    DISCORD_TOURNAMENT_CATEGORY_ID,
  ],
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

  if (hasTournamentStarted(tournament.state)) {
    throw new HttpsError("failed-precondition",
        "Tournament has already started");
  }

  if (!isBracketCreated(tournament.state) ||
    !tournament.challongeTournamentId) {
    throw new HttpsError("failed-precondition",
        "Challonge bracket has not been created yet");
  }

  const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization-Type": "v1",
    "Authorization": CHALLONGE_API_KEY.value(),
  };

  const res = await fetch(
      `https://api.challonge.com/v2.1/tournaments/${tournament.challongeTournamentId}/change_state.json`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          data: {
            type: "TournamentState",
            attributes: {
              state: "start",
            },
          },
        }),
      },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new HttpsError("internal",
        `Failed to start tournament: ${JSON.stringify(data)}`);
  }

  await db.ref("tournaments/" + tournamentId).update({
    state: TOURNAMENT_STATE.STARTED,
  });

  await updateTournamentGames(tournamentId, tournament.challongeTournamentId);
  await createTournamentDiscordResources(tournamentId);

  return {success: true};
});
