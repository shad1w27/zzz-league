import { onCall, HttpsError } from "firebase-functions/https";
import { db, storage } from "../config/firebase.js";
import { CHALLONGE_API_KEY } from "../config/secrets.js";
import { updateTournamentGames } from "../utils/updateTournamentGames.js";
import { defaultOptions } from "../config/options.js";

export const approveResult = onCall({
  ...defaultOptions,
  secrets: [CHALLONGE_API_KEY],
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Not logged in");

  const {
    tournamentId,
    matchId,
    resultP1,
    resultP2,
    resultScreenshot,
  } = request.data;

  if (!tournamentId || !matchId || !uid ||
    resultP1 == null || resultP2 == null) {
    throw new HttpsError("invalid-argument",
      "tournamentId, matchId, resultP1, resultP2, are required");
  }

  const matchRef = db.ref(`tournaments/${tournamentId}/matches/${matchId}`);
  const matchSnap = await matchRef.once("value");
  const match = matchSnap.val();
  if (!match) {
    throw new HttpsError("not-found", "Match not found");
  }
  
  if (match.p1 !== uid && match.p2 !== uid)
    throw new HttpsError("unauthenticated", "Not a participant");

  const updates = {};

  const resetResult = String(resultP1).trim() !== String(match.resultP1) ||
    String(resultP2).trim() !== String(match.resultP2) ||
    (match.resultScreenshot != null && resultScreenshot != null);

  if (resetResult) {
    updates.p1ApprovedResult = false;
    updates.p2ApprovedResult = false;
    updates.resultP1 = String(resultP1).trim();
    updates.resultP2 = String(resultP2).trim();
  }

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
      metadata: { contentType },
    });

    await file.makePublic();
    const resultScreenshotUrl = `https://storage.googleapis.com/${storage.bucket().name}/${filePath}`;
    updates.resultScreenshot = resultScreenshotUrl;
  }

  switch (uid) {
    case match.p1:
      updates.p1ApprovedResult = resetResult ? true : !match.p1ApprovedResult;
      break;
    case match.p2:
      updates.p2ApprovedResult = resetResult ? true : !match.p2ApprovedResult;
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

    const toSeconds = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const time1 = toSeconds(updatedMatch.resultP1);
    const time2 = toSeconds(updatedMatch.resultP2);
    const winnerId = time1 < time2 ? match.p1 : match.p2;

    const headers = {
      "Content-Type": "application/vnd.api+json",
      "Accept": "application/json",
      "Authorization-Type": "v1",
      "Authorization": CHALLONGE_API_KEY.value(),
    };

    const snap =
      await db.ref(`tournaments/${tournamentId}/challongeParticipants`)
        .once("value");
    const challongeParticipants = snap.val();

    const p1ChallongeId = Object.keys(challongeParticipants).find(
      (key) => challongeParticipants[key] === match.p1,
    );
    const p2ChallongeId = Object.keys(challongeParticipants).find(
      (key) => challongeParticipants[key] === match.p2,
    );

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
                  score_set: time1 < time2 ? "1" : "0",
                  rank: time1 < time2 ? 1 : 2,
                  advancing: time1 < time2,
                },
                {
                  participant_id: p2ChallongeId,
                  score_set: time2 < time1 ? "1" : "0",
                  rank: time2 < time1 ? 1 : 2,
                  advancing: time2 < time1,
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

    await matchRef.update({
      state: "complete",
      winnerId,
    });
  }

  return { success: true };
});
