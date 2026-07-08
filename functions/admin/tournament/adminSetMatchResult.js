import {onCall, HttpsError} from "firebase-functions/https";
import admin from "firebase-admin";
import {db, storage} from "../../config/firebase.js";
import {CHALLONGE_API_KEY} from "../../config/secrets.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";
import {updateTournamentGames} from "../../utils/updateTournamentGames.js";
import {registerMatchResult} from "../../utils/registerMatchResult.js";

export const adminSetMatchResult = onCall({
  ...defaultOptions,
  secrets: [CHALLONGE_API_KEY],
}, async (request) => {
  await validateAdminRequest(request);

  const {
    tournamentId,
    matchId,
    resultP1,
    resultP2,
    resultScreenshot,
    techLossUid,
  } = request.data;

  if (!tournamentId || !matchId) {
    throw new HttpsError("invalid-argument",
        "tournamentId and matchId are required");
  }

  const matchRef = db.ref(`tournaments/${tournamentId}/matches/${matchId}`);
  const matchSnap = await matchRef.once("value");
  const match = matchSnap.val();
  if (!match) {
    throw new HttpsError("not-found", "Match not found");
  }

  const tournamentSnap =
    await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  if (!tournament) {
    throw new HttpsError("not-found", "Tournament not found");
  }

  const techLoss = !!techLossUid;
  let p1Win;
  let finalResultP1 = match.resultP1 ?? null;
  let finalResultP2 = match.resultP2 ?? null;

  if (techLoss) {
    if (techLossUid !== match.p1 && techLossUid !== match.p2) {
      throw new HttpsError("invalid-argument",
          "techLossUid must be a participant of this match");
    }
    p1Win = techLossUid === match.p2;
  } else {
    if (resultP1 == null || resultP2 == null) {
      throw new HttpsError("invalid-argument",
          "resultP1 and resultP2 are required");
    }
    finalResultP1 = String(resultP1).trim();
    finalResultP2 = String(resultP2).trim();

    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };
    p1Win = toMinutes(finalResultP1) < toMinutes(finalResultP2);
  }

  let resultScreenshotUrl = match.resultScreenshot ?? null;
  if (resultScreenshot) {
    const base64Data =
      resultScreenshot.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > 1 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "File too large, max 1MB");
    }

    const extMatch = resultScreenshot.match(/^data:(image\/\w+);base64,/);
    const contentType = extMatch ? extMatch[1] : "image/jpeg";
    const ext = contentType.split("/")[1];

    const filePath = `tournaments/${tournamentId}/matches/${matchId}.${ext}`;
    const file = storage.bucket().file(filePath);

    await file.save(buffer, {
      metadata: {contentType},
    });

    await file.makePublic();
    resultScreenshotUrl =
      `https://storage.googleapis.com/${storage.bucket().name}/${filePath}`;
  }

  if (match.historyKey) {
    const oldEntrySnap =
      await db.ref("historyV3/" + match.historyKey).once("value");
    if (oldEntrySnap.exists()) {
      const oldEntry = oldEntrySnap.val();
      const decrement = admin.database.ServerValue.increment(-1);
      const oldP1Won = oldEntry.p1Change > oldEntry.p2Change;

      await db.ref().update({
        [`historyV3/${match.historyKey}`]: null,
        [`players/${oldEntry.p1}/tournamentPoints`]:
          admin.database.ServerValue.increment(-oldEntry.p1Change),
        [`players/${oldEntry.p2}/tournamentPoints`]:
          admin.database.ServerValue.increment(-oldEntry.p2Change),
        [`players/${oldEntry.p1}/${oldP1Won ? "wins" : "losses"}`]: decrement,
        [`players/${oldEntry.p2}/${oldP1Won ? "losses" : "wins"}`]: decrement,
      });
    }
  }

  const p1Snap = await db.ref("players/" + match.p1).once("value");
  if (!p1Snap.exists()) {
    throw new HttpsError("not-found", `Player ${match.p1} not found`);
  }
  const p2Snap = await db.ref("players/" + match.p2).once("value");
  if (!p2Snap.exists()) {
    throw new HttpsError("not-found", `Player ${match.p2} not found`);
  }

  const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization-Type": "v1",
    "Authorization": CHALLONGE_API_KEY.value(),
  };

  const challongeParticipants = tournament.challongeParticipants;
  const p1ChallongeId = Object.keys(challongeParticipants).find(
      (key) => challongeParticipants[key] === match.p1,
  );
  const p2ChallongeId = Object.keys(challongeParticipants).find(
      (key) => challongeParticipants[key] === match.p2,
  );

  const loserScore = techLoss ? "999" : "0";

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
                  participant_id: p1ChallongeId,
                  score_set: p1Win ? "1" : loserScore,
                  rank: p1Win ? 1 : 2,
                  advancing: p1Win,
                },
                {
                  participant_id: p2ChallongeId,
                  score_set: p1Win ? loserScore : "1",
                  rank: p1Win ? 2 : 1,
                  advancing: !p1Win,
                },
              ],
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

  await updateTournamentGames(tournamentId, tournament.challongeTournamentId);

  const historyKey = await registerMatchResult(p1Snap.val(), p2Snap.val(),
      p1Win, tournament.overrideEloChange, tournament.id, match.id,
      finalResultP1, finalResultP2, resultScreenshotUrl, techLoss);

  await matchRef.update({
    resultP1: finalResultP1,
    resultP2: finalResultP2,
    resultScreenshot: resultScreenshotUrl,
    p1ApprovedResult: true,
    p2ApprovedResult: true,
    state: "complete",
    winnerId: p1Win ? match.p1 : match.p2,
    techLossUid: techLoss ? techLossUid : null,
    historyKey,
  });

  return {success: true};
});
