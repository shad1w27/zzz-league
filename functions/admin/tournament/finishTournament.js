import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {CHALLONGE_API_KEY} from "../../config/secrets.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";

export const finishTournament = onCall({
  ...defaultOptions,
  secrets: [CHALLONGE_API_KEY],
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

  const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization-Type": "v1",
    "Authorization": CHALLONGE_API_KEY.value(),
  };

  const finalizeRes = await fetch(`https://api.challonge.com/v2.1/tournaments/${tournament.challongeTournamentId}/change_state.json`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      data: {
        type: "TournamentState",
        attributes: {
          state: "finalize",
        },
      },
    }),
  });

  const finalizeData = await finalizeRes.json();
  if (!finalizeRes.ok && finalizeRes.status !== 422) {
    throw new HttpsError("internal",
        `Challonge error: ${JSON.stringify(finalizeData)}`);
  }

  const participantsRes = await fetch(
      `https://api.challonge.com/v2.1/tournaments/${tournament.challongeTournamentId}/participants.json`, {
        method: "GET",
        headers,
      },
  );
  const participantsData = await participantsRes.json();

  const winner = participantsData.data.find(
      (item) => item.attributes.final_rank === 1,
  );

  const challongeWinnerId = winner.id;
  const winnerId = tournament.challongeParticipants[challongeWinnerId];

  await db.ref("tournaments/" + tournamentId).update({
    state: "complete",
    challongeWinnerId,
    winnerId,
  });

  return {success: true};
});
