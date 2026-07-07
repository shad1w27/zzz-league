import {onCall, HttpsError} from "firebase-functions/https";
import {db, storage} from "../config/firebase.js";
import {defaultOptions} from "../config/options.js";

export const applyForTournament = onCall(defaultOptions, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const playerSnap = await db.ref("players/" + callerUid).once("value");
  const player = playerSnap.val();
  if (!player) throw new HttpsError("not-found", "Player not found");
  if (!player.discordId) {
    throw new HttpsError("permission-denied", "Please link discord first");
  }

  const {
    tournamentId,
    darteNickname,
    darteAccount,
    dartePreset,
    rosterScreenshot,
    zzzUid,
  } = request.data;

  if (!tournamentId || !darteNickname || !darteAccount ||
    !dartePreset || !rosterScreenshot || !zzzUid) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const tournamentSnap =
  await db.ref(`tournaments/${tournamentId}`).once("value");
  if (!tournamentSnap.exists()) {
    throw new HttpsError("not-found", "Tournament not found");
  }

  const tournament = tournamentSnap.val();

  if (tournament.state) {
    throw new HttpsError("permission-denied",
        "Tournament has already been started");
  }

  let playerTier = 0;
  if (player.isHighConfirmed) {
    playerTier = 1000;
  } else if (player.isMidConfirmed) {
    playerTier = 100;
  }

  if (playerTier < tournament.minTier || playerTier > tournament.maxTier) {
    throw new HttpsError("permission-denied", "Player is out of tier group");
  }

  const base64Data = rosterScreenshot.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.length > 1 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "File too large, max 1MB");
  }

  const match = rosterScreenshot.match(/^data:(image\/\w+);base64,/);
  const contentType = match ? match[1] : "image/jpeg";
  const ext = contentType.split("/")[1];

  const filePath = `tournaments/${tournamentId}/${callerUid}-roster.${ext}`;
  const file = storage.bucket().file(filePath);

  await file.save(buffer, {
    metadata: {contentType},
  });

  await file.makePublic();
  const rosterScreenshotUrl = `https://storage.googleapis.com/${storage.bucket().name}/${filePath}`;

  await db.ref(`tournaments/${tournamentId}/registrations/${callerUid}`).set({
    uid: callerUid,
    zzzUid,
    darteNickname,
    darteAccount,
    dartePreset,
    rosterScreenshot: rosterScreenshotUrl,
    registrationTimestamp: Date.now(),
    approved: false,
  });

  return {success: true};
});
