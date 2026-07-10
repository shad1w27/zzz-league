import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {defaultOptions} from "../config/options.js";
import {uploadImage} from "../utils/uploadImage.js";

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
    hoyolabScreenshot,
    zzzUid,
  } = request.data;

  if (!tournamentId || !darteNickname || !darteAccount ||
    !dartePreset || !zzzUid) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const existingRegSnap = await db
      .ref(`tournaments/${tournamentId}/registrations/${callerUid}`)
      .once("value");
  const existingReg = existingRegSnap.val();

  if (!rosterScreenshot && !existingReg?.rosterScreenshot) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }
  if (!hoyolabScreenshot && !existingReg?.hoyolabScreenshot) {
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

  if (Date.now() > tournament.registrationEndDate) {
    throw new HttpsError("permission-denied",
        "Registration is closed");
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

  const rosterScreenshotUrl = rosterScreenshot ? await uploadImage(
      rosterScreenshot, `tournaments/${tournamentId}/${callerUid}-roster`,
  ) : existingReg.rosterScreenshot;

  const hoyolabScreenshotUrl = hoyolabScreenshot ? await uploadImage(
      hoyolabScreenshot, `tournaments/${tournamentId}/${callerUid}-hoyolab`,
  ) : existingReg.hoyolabScreenshot;

  await db.ref(`tournaments/${tournamentId}/registrations/${callerUid}`).set({
    uid: callerUid,
    zzzUid,
    darteNickname,
    darteAccount,
    dartePreset,
    rosterScreenshot: rosterScreenshotUrl,
    hoyolabScreenshot: hoyolabScreenshotUrl,
    registrationTimestamp: existingReg?.registrationTimestamp ?? Date.now(),
    approved: false,
  });

  return {success: true};
});
