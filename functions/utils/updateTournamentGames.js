import {db} from "../config/firebase.js";
import {CHALLONGE_API_KEY} from "../config/secrets.js";
import {HttpsError} from "firebase-functions/v2/https";

export async function updateTournamentGames(tournamentId,
    challongeTournamentId) {
  const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization-Type": "v1",
    "Authorization": CHALLONGE_API_KEY.value(),
  };

  const snap = await db.ref(`tournaments/${tournamentId}/challongeParticipants`)
      .once("value");
  const challongeParticipants = snap.val();
  if (!challongeParticipants) {
    throw new HttpsError("not-found", "No participants data found");
  }

  const matchesRes = await fetch(`https://api.challonge.com/v2.1/tournaments/${challongeTournamentId}/matches.json`, {
    method: "GET",
    headers,
  });

  const matchesData = await matchesRes.json();
  if (!matchesRes.ok) {
    throw new HttpsError("internal",
        `Challonge matches fetch error: ${JSON.stringify(matchesData)}`);
  }

  let allMatchesPlayed = true;
  const updates = {};
  matchesData.data.forEach((m) => {
    const pp = m.attributes.points_by_participant ?? [];
    const p1Id = pp[0]?.participant_id;
    const p2Id = pp[1]?.participant_id;
    const winnerId = challongeParticipants[m.attributes.winner_id];

    updates[`matches/${m.id}/id`] = m.id;
    updates[`matches/${m.id}/state`] = m.attributes.state;
    updates[`matches/${m.id}/winnerId`] = winnerId ?? null;
    updates[`matches/${m.id}/p1`] =
      challongeParticipants[p1Id] ?? "TBD";
    updates[`matches/${m.id}/p2`] =
      challongeParticipants[p2Id] ?? "TBD";

    if (!winnerId) {
      allMatchesPlayed = false;
    }
  });

  if (allMatchesPlayed) {
    updates["state"] = "awaiting_review";
  }

  await db.ref(`tournaments/${tournamentId}`).update(updates);
}
