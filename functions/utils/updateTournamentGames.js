import {db} from "../config/firebase.js";
import {CHALLONGE_API_KEY} from "../config/secrets.js";
import {HttpsError} from "firebase-functions/v2/https";
import {TOURNAMENT_STATE} from "./tournamentState.js";

export async function updateTournamentGames(tournamentId,
    challongeTournamentId) {
  const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization-Type": "v1",
    "Authorization": CHALLONGE_API_KEY.value(),
  };

  const snap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = snap.val();
  const challongeParticipants = tournament?.challongeParticipants;
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
  let resetMatchId = null;
  if (tournament.type === "double elimination") {
    const rounds = matchesData.data.map((m) => m.attributes.round);
    const maxRound = Math.max(...rounds);
    const finalRoundMatches = matchesData.data
        .filter((m) => m.attributes.round === maxRound)
        .sort((a, b) => a.attributes.suggested_play_order -
          b.attributes.suggested_play_order);
    if (finalRoundMatches.length > 1) {
      resetMatchId = finalRoundMatches[finalRoundMatches.length - 1].id;
    }
  }

  let allMatchesPlayed = true;
  const updates = {};
  matchesData.data.forEach((m) => {
    if (m.id === resetMatchId) {
      updates[`matches/${m.id}`] = null;
      return;
    }

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
    updates["state"] = TOURNAMENT_STATE.AWAITING_REVIEW;
  }

  await db.ref(`tournaments/${tournamentId}`).update(updates);
}
