const admin = require("firebase-admin");

const {defineSecret} = require("firebase-functions/params");

const DISCORD_BOT_TOKEN = defineSecret("DISCORD_BOT_TOKEN");
const DISCORD_GUILD_ID = defineSecret("DISCORD_GUILD_ID");
const DISCORD_NEWBIE_ROLE = defineSecret("DISCORD_NEWBIE_ROLE");
const DISCORD_MID_ROLE = defineSecret("DISCORD_MID_ROLE");
const DISCORD_HIGH_ROLE = defineSecret("DISCORD_HIGH_ROLE");
const DISCORD_CLIENT_ID = defineSecret("DISCORD_CLIENT_ID");
const DISCORD_CLIENT_SECRET = defineSecret("DISCORD_CLIENT_SECRET");

const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

setGlobalOptions({
  maxInstances: 10,
  region: "europe-west1",
});

admin.initializeApp();

const db = admin.database();
const auth = admin.auth();

async function validateAdminRequest(request) {
  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const callerSnapshot = await db.ref("players/" + callerUid).once("value");
  if (!callerSnapshot.exists() || callerSnapshot.val().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Permission denied");
  }
}

exports.register = onCall({cors: true}, async (request) => {
  let userRecord = null;
  try {
    const {username, email, password} = request.data;

    if (!username || !email || !password) {
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
        isMidConfirmed: prevUserData.isMidConfirmed ?? false,
        isHighConfirmed: prevUserData.isHighConfirmed ?? false,
      };
    } else {
      playerData = {
        uid,
        name: username,
        elo: 1000,
        tournamentPoints: 0,
        isMidConfirmed: false,
        isHighConfirmed: false,
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

exports.updateProfile = onCall({cors: true}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const {username} = request.data;

  if (!username) {
    throw new HttpsError("invalid-argument", "Nothing to update");
  }

  const callerSnapshot = await db.ref("players/" + callerUid).once("value");
  if (!callerSnapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const updates = {};

  if (username) {
    const oldUsername = callerSnapshot.val().name;

    if (username === oldUsername) {
      throw new HttpsError("invalid-argument", "Username haven't changed");
    }

    const usernameSnap = await db.ref("usernames/" + username).once("value");
    if (usernameSnap.exists()) {
      throw new HttpsError("already-exists", "Username is already taken");
    }

    updates["usernames/" + oldUsername] = null;
    updates["usernames/" + username] = true;
    updates["players/" + callerUid + "/name"] = username;
  }

  await db.ref().update(updates);

  return {success: true};
});

exports.deletePlayer = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

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

exports.updatePlayerElo = onCall({
  cors: true,
  secrets: [DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE, DISCORD_MID_ROLE, DISCORD_HIGH_ROLE],
}, async (request) => {
  await validateAdminRequest(request);

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

  assignDiscordRole(uid);

  return {success: true};
});

exports.addHistoryEntry = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

  const {playerName1, playerName2, change} = request.data;

  await db.ref("history").push({
    p1: playerName1,
    p2: playerName2,
    change,
    timestamp: Date.now(),
  });

  return {success: true};
});

exports.deleteHistoryEntry = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

  const {key} = request.data;
  await db.ref("history/" + key).remove();

  return {success: true};
});

exports.clearHistory = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);
  await db.ref("history").remove();

  return {success: true};
});

exports.updateMatchData = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

  const {uid, change, isWin} = request.data;

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const player = snapshot.val();

  let confirmed = player.isMidConfirmed || false;

  if ((player.elo || 1000) >= 1200 && !confirmed) {
    if (isWin) {
      confirmed = true;
    }
  }
  await db.ref("players/" + player.uid).update({
    tournamentPoints: (player.tournamentPoints || 0) + change,
    isMidConfirmed: confirmed,
  });
});

exports.setTimer = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

  const {timer} = request.data;
  await db.ref("timer").set(timer);
  return {success: true};
});

exports.resetSeason = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

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
  });

  updates["history"] = null;

  await db.ref().update(updates);

  return {success: true};
});

exports.finalizeTournament = onCall({
  cors: true,
  secrets: [DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE, DISCORD_MID_ROLE, DISCORD_HIGH_ROLE],
}, async (request) => {
  await validateAdminRequest(request);

  const snap = await db.ref("players").once("value");
  const playersObj = snap.val();
  if (!playersObj) {
    throw new HttpsError("not-found", "No players found");
  }

  const updates = {};
  const uidsToUpdate = [];

  Object.values(playersObj).forEach((p) => {
    const next = (p.elo || 1000) + (p.tournamentPoints || 0);
    let mid = p.isMidConfirmed;
    let high = p.isHighConfirmed;
    if (mid && next < 1150) mid = false;
    if (!mid && next >= 1200) mid = true;
    if (high && next < 1350) high = false;
    if (!high && next >= 1400) high = true;

    updates["players/" + p.uid + "/elo"] = next;
    updates["players/" + p.uid + "/tournamentPoints"] = 0;
    updates["players/" + p.uid + "/isMidConfirmed"] = mid;
    updates["players/" + p.uid + "/isHighConfirmed"] = high;
    updates["players/" + p.uid + "/lastEloUpdateTimestamp"] = Date.now();

    if (p.discordId && mid != p.isMidConfirmed || high != p.isHighConfirmed) {
      uidsToUpdate.push(p.uid);
    }
  });

  await db.ref().update(updates);
  await Promise.all(uidsToUpdate.map((uid) => assignDiscordRole(uid)));

  return {success: true};
});

exports.deleteArchive = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

  const {key} = request.data;
  await db.ref("archives/" + key).remove();

  return {success: true};
});

exports.addPlayer = onCall({cors: true}, async (request) => {
  await validateAdminRequest(request);

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
    isMidConfirmed: false,
    isHighConfirmed: false,
    discord: "",
  };

  await db.ref("players/" + trimmedName).set(player);

  return {success: true};
});

exports.linkDiscord = onCall({
  cors: true,
  secrets: [DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID, DISCORD_NEWBIE_ROLE, DISCORD_MID_ROLE, DISCORD_HIGH_ROLE],
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const {code, redirectUri} = request.data;

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID.value(),
      client_secret: DISCORD_CLIENT_SECRET.value(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: {Authorization: `Bearer ${tokenData.access_token}`},
  });
  const discordUser = await userRes.json();

  if (!discordUser.id) {
    throw new HttpsError("internal",
        `Discord error: ${JSON.stringify(discordUser)}`);
  }

  await db.ref("players/" + callerUid).update({
    discordId: discordUser.id,
    discord: discordUser.username,
  });

  await assignDiscordRole(callerUid);

  return {success: true, username: discordUser.username};
});

async function assignDiscordRole(uid) {
  const snap = await db.ref("players/" + uid).once("value");
  const player = snap.val();
  if (!player?.discordId) return;

  const elo = player.elo || 1000;
  const guildId = DISCORD_GUILD_ID.value();
  const token = DISCORD_BOT_TOKEN.value();

  const newbieRole = DISCORD_NEWBIE_ROLE.value();
  const midRole = DISCORD_MID_ROLE.value();
  const highRole = DISCORD_HIGH_ROLE.value();

  const newRoleId = elo >= 1400 ? highRole :
    elo >= 1200 ? midRole :
      newbieRole;

  const allRoles = [newbieRole, midRole, highRole];

  await Promise.all(allRoles.map((roleId) =>
    fetch(`https://discord.com/api/guilds/${guildId}/members/${player.discordId}/roles/${roleId}`, {
      method: roleId === newRoleId ? "PUT" : "DELETE",
      headers: {Authorization: `Bot ${token}`},
    }),
  ));
}

exports.unlinkDiscord = onCall({
  cors: true,
  secrets: [DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE, DISCORD_MID_ROLE, DISCORD_HIGH_ROLE],
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const snap = await db.ref("players/" + callerUid).once("value");
  const player = snap.val();
  if (!player) throw new HttpsError("not-found", "Player not found");

  if (player.discordId) {
    const guildId = DISCORD_GUILD_ID.value();
    const token = DISCORD_BOT_TOKEN.value();
    const allRoles = [
      DISCORD_NEWBIE_ROLE.value(),
      DISCORD_MID_ROLE.value(),
      DISCORD_HIGH_ROLE.value()];

    await Promise.all(allRoles.map((roleId) =>
      fetch(`https://discord.com/api/guilds/${guildId}/members/${player.discordId}/roles/${roleId}`, {
        method: "DELETE",
        headers: {Authorization: `Bot ${token}`},
      }),
    ));
  }

  await db.ref("players/" + callerUid).update({
    discordId: null,
    discord: null,
  });

  return {success: true};
});
