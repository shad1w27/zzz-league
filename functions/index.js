const admin = require("firebase-admin");

const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

const db = admin.database();
const auth = admin.auth();

exports.register = onCall({ cors: true }, async (request) => {
  let userRecord = null;
  try {
    const { username, email, password, discord } = request.data;

    if (!username || !email || !password || !discord) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    const usernameSnap = await db.ref("usernames/" + username).once("value");
    if (usernameSnap.exists()) {
      throw new HttpsError("already-exists", "Username is already taken");
    }

    userRecord = await auth.createUser({ email, password });
    const uid = userRecord.uid;

    const prevSnapshot = await db.ref("players/" + username).once("value");

    let playerData = null;

    if (prevSnapshot.exists()) {
      const prevUserData = prevSnapshot.val();
      playerData = {
        uid,
        name: username,
        elo: prevUserData.elo ?? 1000,
        tournamentPoints: prevUserData.tournamentPoints ?? 0,
        promoStreak: prevUserData.promoStreak ?? 0,
        isMidConfirmed: prevUserData.isMidConfirmed ?? false,
        isHighConfirmed: prevUserData.isHighConfirmed ?? false,
        discord,
      };
    } else {
      playerData = {
        uid,
        name: username,
        elo: 1000,
        tournamentPoints: 0,
        promoStreak: 0,
        isMidConfirmed: false,
        isHighConfirmed: false,
        discord,
      };
    }

    await db.ref().update({
      ["players/" + uid]: playerData,
      ["usernames/" + username]: true,
      ["players/" + username]: null,
    });

    const token = await auth.createCustomToken(uid);
    return { success: true, token };
  } catch (error) {
    logger.error(error);
    if (userRecord) await auth.deleteUser(userRecord.uid);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message ?? "Internal server error");
  }
});

async function validateRequest(request) {
  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const callerSnapshot = await db.ref("players/" + callerUid).once("value");
  if (!callerSnapshot.exists() || callerSnapshot.val().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Permission denied");
  }
}

exports.deletePlayer = onCall({ cors: true }, async (request) => {
  await validateRequest(request);

  const { uid } = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const username = snapshot.val().name;

  await db.ref().update({
    ["players/" + uid]: null,
    ["usernames/" + username]: null,
  });

  await auth.deleteUser(uid);

  return { success: true };
});

exports.updatePlayerElo = onCall({ cors: true }, async (request) => {
  await validateRequest(request);

  const { uid, elo } = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  await db.ref("players/" + uid).update({
    elo,
    isMidConfirmed: elo >= 1200,
    isHighConfirmed: elo >= 1400,
  });

  return { success: true };
});

exports.clearHistory = onCall({ cors: true }, async (request) => {
  await validateRequest(request);
  await db.ref("history").remove();

  return { success: true };
});

exports.updateMatchData = onCall({ cors: true }, async (request) => {
  await validateRequest(request);

  const { uid, change, isWin } = request.data;

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const player = snapshot.val();

  let streak = player.promoStreak || 0,
    confirmed = player.isMidConfirmed || false;

  if ((player.elo || 1000) >= 1200 && !confirmed) {
    if (isWin) {
      streak++;
      if (streak >= 3) {
        confirmed = true;
        streak = 0;
      }
    } else streak = 0;
  }
  await db.ref("players/" + player.uid).update({
    tournamentPoints: (player.tournamentPoints || 0) + change,
    promoStreak: streak,
    isMidConfirmed: confirmed,
  });
});

exports.setTimer = onCall({ cors: true }, async (request) => {
  await validateRequest(request);

  const { date } = request.data;

  db.ref("timer").set(date);
});

