const admin = require("firebase-admin");

const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

setGlobalOptions({maxInstances: 10});

admin.initializeApp();

const db = admin.database();
const auth = admin.auth();

exports.register = onCall({cors: true}, async (request) => {
  let userRecord = null;
  try {
    const {username, email, password, discord} = request.data;

    if (!username || !email || !password || !discord) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    const usernameSnap = await db.ref("usernames/" + username).once("value");
    if (usernameSnap.exists()) {
      throw new HttpsError("already-exists", "Username is already taken");
    }

    userRecord = await auth.createUser({email, password});
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
    return {success: true, token};
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

exports.deletePlayer = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {uid} = request.data;

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

  return {success: true};
});

exports.updatePlayerElo = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {uid, elo} = request.data;

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

  return {success: true};
});

exports.addHistoryEntry = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {playerName1, playerName2, change} = request.data;

  await db.ref("history").push({
    p1: playerName1,
    p2: playerName2,
    change,
  });

  return {success: true};
});

exports.clearHistory = onCall({cors: true}, async (request) => {
  await validateRequest(request);
  await db.ref("history").remove();

  return {success: true};
});

exports.updateMatchData = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {uid, change, isWin} = request.data;

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const player = snapshot.val();

  let streak = player.promoStreak || 0;
  let confirmed = player.isMidConfirmed || false;

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

exports.setTimer = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {timer} = request.data;
  await db.ref("timer").set(timer);
  return {success: true};
});

exports.resetSeason = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {seasonName} = request.data;
  if (!seasonName) {
    throw new HttpsError("invalid-argument", "seasonName is required");
  }

  const snap = await db.ref("players").once("value");
  const playersObj = snap.val();
  if (!playersObj) {
    throw new HttpsError("not-found", "No players found");
  }

  const players = Object.values(playersObj);

  const updates = {};

  updates["archives/" + seasonName] = players.map((player) => ({
    name: player.name,
    elo: player.elo || 1000,
    isMidConfirmed: player.isMidConfirmed || false,
    isHighConfirmed: player.isHighConfirmed || false,
  }));

  players.forEach((player) => {
    const start = player.isHighConfirmed ?
      1400 : player.isMidConfirmed ? 1200 : 1000;
    updates["players/" + player.uid + "/elo"] = start;
    updates["players/" + player.uid + "/tournamentPoints"] = 0;
    updates["players/" + player.uid + "/promoStreak"] = 0;
  });

  updates["history"] = null;

  await db.ref().update(updates);

  return {success: true};
});

exports.finalizeTournament = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const snap = await db.ref("players").once("value");
  const playersObj = snap.val();
  if (!playersObj) {
    throw new HttpsError("not-found", "No players found");
  }

  const updates = {};

  Object.values(playersObj).forEach((p) => {
    const next = (p.elo || 1000) + (p.tournamentPoints || 0);
    let mid = p.isMidConfirmed;
    let high = p.isHighConfirmed;
    if (mid && next < 1150) mid = false;
    if (high && next < 1350) high = false;
    if (next >= 1400) high = true;

    updates["players/" + p.uid + "/elo"] = next;
    updates["players/" + p.uid + "/tournamentPoints"] = 0;
    updates["players/" + p.uid + "/isMidConfirmed"] = mid;
    updates["players/" + p.uid + "/isHighConfirmed"] = high;
  });

  await db.ref().update(updates);

  return {success: true};
});

exports.deleteArchive = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {key} = request.data;
  await db.ref("archives/" + key).remove();

  return {success: true};
});

exports.addPlayer = onCall({cors: true}, async (request) => {
  await validateRequest(request);

  const {name} = request.data;
  const trimmedName = name.trim();

  if (!name || trimmedName.length < 2) {
    throw new HttpsError("invalid-argument", "Name is required");
  }

  const existing = await db.ref("players")
      .orderByChild("name").equalTo(trimmedName).once("value");
  if (existing.exists()) {
    throw new HttpsError("already-exists", "Player already exists");
  }

  const player = {
    uid: trimmedName,
    name: trimmedName,
    elo: 1000,
    tournamentPoints: 0,
    promoStreak: 0,
    isMidConfirmed: false,
    isHighConfirmed: false,
    discord: "",
  };

  await db.ref("players/" + trimmedName).set(player);

  return {success: true};
});
