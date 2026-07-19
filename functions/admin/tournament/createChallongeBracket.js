import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {CHALLONGE_API_KEY} from "../../config/secrets.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";
import {TOURNAMENT_STATE, isLocked} from "../../utils/tournamentState.js";

export const createChallongeBracket = onCall({
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

  if (isLocked(tournament.state)) {
    throw new HttpsError("failed-precondition",
        "Challonge bracket has already been created");
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

  const tournamentType = tournament.type ?? "single elimination";

  const createRes = await fetch("https://api.challonge.com/v2.1/tournaments.json", {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        type: "tournament",
        attributes: {
          name: tournament.name,
          tournament_type: tournamentType,
          description: tournament.description ?? "",
          private: false,
          starts_at: new Date(tournament.tournamentStartDate).toISOString(),
          ...(tournamentType === "double elimination" &&
            {double_elimination_options: {
              grand_finals_modifier: "single match",
            }}),
          ...(tournament.consolationMatchesTargetRank != null &&
            {match_options: {
              consolation_matches_target_rank:
                tournament.consolationMatchesTargetRank,
            }}),
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

  const playerSnaps = await Promise.all(
      approved.map((r) => db.ref("players/" + r.uid).once("value")),
  );

  const participants = playerSnaps.map((snap, i) => {
    const player = snap.val();
    if (!player) {
      throw new HttpsError("not-found", `Player ${approved[i].uid} not found`);
    }
    return {
      name: player.name,
      misc: player.uid,
    };
  });

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

  const challongeParticipants = Object.fromEntries(
      randomizeData.data.map((m) => [m.id, m.attributes.misc]),
  );

  const challongeTournamentUrl = createData.data.attributes.full_challonge_url;

  await db.ref("tournaments/" + tournamentId).update({
    challongeParticipants,
    state: TOURNAMENT_STATE.BRACKET_CREATED,
    challongeTournamentId,
    challongeTournamentUrl,
  });

  return {success: true, challongeTournamentId};
});
