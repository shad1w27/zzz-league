import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {CHALLONGE_API_KEY} from "../config/secrets.js";
import {updateTournamentGames} from "../utils/updateTournamentGames.js";
import {defaultOptions} from "../config/options.js";

export const approveResult = onCall({
  ...defaultOptions,
  secrets: [CHALLONGE_API_KEY]}, async (request) => {
  const {tournamentId, matchId, uid, resultP1, resultP2} = request.data;

  if (!tournamentId || !matchId || !uid) {
    throw new HttpsError("invalid-argument",
        "tournamentId, matchId, uid are required");
  }

  const matchRef = db.ref(`tournaments/${tournamentId}/matches/${matchId}`);
  const matchSnap = await matchRef.once("value");
  const match = matchSnap.val();
  if (!match) {
    throw new HttpsError("not-found", "Match not found");
  }

  const updates = {};

  if (String(resultP1).trim() !== String(match.resultP1) ||
    String(resultP2).trim() !== String(match.resultP2)) {
    updates.p1ApprovedResult = false;
    updates.p2ApprovedResult = false;
    updates.resultP1 = String(resultP1).trim();
    updates.resultP2 = String(resultP2).trim();
  }

  switch (uid) {
    case match.p1:
      updates.p1ApprovedResult = !match.p1ApprovedResult;
      break;
    case match.p2:
      updates.p2ApprovedResult = !match.p2ApprovedResult;
      break;
    default:
      throw new HttpsError("permission-denied",
          "User is not a participant of this match");
  }

  await matchRef.update(updates);

  const updatedSnap = await matchRef.once("value");
  const updatedMatch = updatedSnap.val();

  if (updatedMatch.p1ApprovedResult &&
    updatedMatch.p2ApprovedResult) {
    const tournamentSnap =
    await db.ref(`tournaments/${tournamentId}`).once("value");
    const tournament = tournamentSnap.val();

    const score1 = parseInt(updatedMatch.resultP1);
    const score2 = parseInt(updatedMatch.resultP2);
    const winnerId =
    score1 > score2 ? match.p1ChallongeId : match.p2ChallongeId;

    const headers = {
      "Content-Type": "application/vnd.api+json",
      "Accept": "application/json",
      "Authorization-Type": "v1",
      "Authorization": CHALLONGE_API_KEY.value(),
    };

    const res = await fetch(
        `https://api.challonge.com/v2.1/tournaments/${tournament.challongeTournamentId}/matches/${matchId}.json`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            data: {
              type: "Match",
              attributes: {
                match: [
                  {
                    participant_id: match.p1ChallongeId,
                    score_set: String(score1),
                    rank: score1 > score2 ? 1 : 2,
                    advancing: score1 > score2,
                  },
                  {
                    participant_id: match.p2ChallongeId,
                    score_set: String(score2),
                    rank: score2 > score1 ? 1 : 2,
                    advancing: score2 > score1,
                  },
                ],
                tie: score1 === score2,
              },
            },
          }),
        },
    );

    const data = await res.json();
    if (!res.ok) {
      throw new HttpsError("internal",
          `Challonge update match error: ${JSON.stringify(data)}`);
    }

    await matchRef.update({
      state: "complete",
      winnerId,
    });

    await updateTournamentGames(tournamentId, tournament.challongeTournamentId);
  }

  return {success: true};
});
