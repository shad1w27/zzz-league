import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {CHALLONGE_API_KEY} from "../../config/secrets.js";
import {updateTournamentGames} from "../../utils/updateTournamentGames.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";

export const startChallongeTournament = onCall({
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

  const regSnap =
    await db.ref(`tournaments/${tournamentId}/registrations`).once("value");
  const registrations = regSnap.val();
  if (!registrations) {
    throw new HttpsError("not-found", "No registrations found");
  }

  const approved = Object.values(registrations).filter((r) => r.approved);
  if (approved.length < 2) {
    throw new HttpsError("failed-precondition",
        "Need at least 2 approved players");
  }

  const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization-Type": "v1",
    "Authorization": CHALLONGE_API_KEY.value(),
  };

  const createRes = await fetch("https://api.challonge.com/v2.1/tournaments.json", {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        type: "tournament",
        attributes: {
          name: tournament.name,
          tournament_type: tournament.type ?? "single elimination",
          description: tournament.description ?? "",
          private: false,
          starts_at: new Date(tournament.tournamentStartDate).toISOString(),
        },
      },
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new HttpsError("internal",
        `Challonge error: ${JSON.stringify(createData)}`);
  }

  const challongeTournamentId = createData.data.id;

  // TODO: Fix
  const participants = await Promise.all(
      approved.map(async (r) => {
        const snap = await db.ref("players/" + r.uid).once("value");
        const player = snap.val();
        return {
          name: player.name,
          misc: player.uid,
        };
      }),
  );

  const addRes = await fetch(`https://api.challonge.com/v2.1/tournaments/${challongeTournamentId}/participants/bulk_add.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        type: "Participant",
        attributes: {participants},
      },
    }),
  });

  const addData = await addRes.json();
  if (!addRes.ok) {
    throw new HttpsError("internal",
        `Challonge participants error: ${JSON.stringify(addData)}`);
  }

  const randomizeRes = await fetch(`https://api.challonge.com/v2.1/tournaments/${challongeTournamentId}/participants/randomize.json`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      data: {
        type: "Participant",
        attributes: {participants},
      },
    }),
  });

  const randomizeData = await randomizeRes.json();
  if (!randomizeRes.ok) {
    throw new HttpsError("internal",
        `Challonge randomize error: ${JSON.stringify(addData)}`);
  }

  const res = await fetch(
      `https://api.challonge.com/v2.1/tournaments/${challongeTournamentId}/change_state.json`,
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

  const challongeParticipants = Object.fromEntries(
      randomizeData.data.map((m) => [m.id, m.attributes.misc]),
  );

  const challongeTournamentUrl = createData.data.attributes.full_challonge_url;

  await db.ref("tournaments/" + tournamentId).update({
    challongeParticipants,
    state: "started",
    challongeTournamentId,
    challongeTournamentUrl,
  });

  await updateTournamentGames(tournamentId, challongeTournamentId);

  return {success: true, challongeTournamentId};
});
