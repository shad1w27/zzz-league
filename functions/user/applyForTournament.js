import {onCall, HttpsError} from "firebase-functions/https";
import {db, storage} from "../config/firebase.js";
import {defaultOptions} from "../config/options.js";

export const applyForTournament = onCall(defaultOptions, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const snap = await db.ref("players/" + callerUid).once("value");
  const player = snap.val();
  if (!player) throw new HttpsError("not-found", "Player not found");
  if (!player.discordId) {
    // @ts-ignore
    throw new HttpsError("discord-error", "Please link discord first");
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

  const base64Data = rosterScreenshot.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.length > 1 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "File too large, max 5MB");
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

  await db.ref(`tournamentRegistrations/${tournamentId}/${callerUid}`).set({
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
