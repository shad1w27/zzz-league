const admin = require("firebase-admin");

const { defineSecret } = require("firebase-functions/params");

const DISCORD_BOT_TOKEN = defineSecret("DISCORD_BOT_TOKEN");
const DISCORD_GUILD_ID = defineSecret("DISCORD_GUILD_ID");
const DISCORD_NEWBIE_ROLE = defineSecret("DISCORD_NEWBIE_ROLE");
const DISCORD_MID_ROLE = defineSecret("DISCORD_MID_ROLE");
const DISCORD_HIGH_ROLE = defineSecret("DISCORD_HIGH_ROLE");
const DISCORD_CLIENT_ID = defineSecret("DISCORD_CLIENT_ID");
const DISCORD_CLIENT_SECRET = defineSecret("DISCORD_CLIENT_SECRET");
const CHALLONGE_API_KEY = defineSecret("CHALLONGE_API_KEY");

const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const { getStorage } = require("firebase-admin/storage");

setGlobalOptions({
  maxInstances: 10,
  region: "europe-west1",
});

admin.initializeApp();

const db = admin.database();
const auth = admin.auth();
const storage = getStorage();

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

exports.register = onCall({ cors: true }, async (request) => {
  let userRecord = null;
  try {
    const { username, email, password } = request.data;

    if (!username || !email || !password) {
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
    return { success: true, token };
  } catch (error) {
    logger.error(error);
    if (userRecord) await auth.deleteUser(userRecord.uid);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message ?? "Internal server error");
  }
});

exports.updateProfile = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { username } = request.data;

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

  return { success: true };
});

exports.deletePlayer = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

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

exports.updatePlayerElo = onCall({
  cors: true,
  secrets: [DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    DISCORD_NEWBIE_ROLE, DISCORD_MID_ROLE, DISCORD_HIGH_ROLE],
}, async (request) => {
  await validateAdminRequest(request);

  const { uid, elo } = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  const snapshot = await db.ref("players/" + uid).once("value");

  if (!snapshot.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const oldElo = snapshot.val().elo;

  await db.ref("players/" + uid).update({
    elo,
    isMidConfirmed: elo >= 1200,
    isHighConfirmed: elo >= 1400,
  });

  await db.ref("historyV2/" + uid).push({
    change: elo - oldElo,
    timestamp: Date.now(),
  });

  assignDiscordRole(uid);

  return { success: true };
});

exports.addHistoryEntry = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { playerName1, playerName2, change } = request.data;

  await db.ref("history").push({
    p1: playerName1,
    p2: playerName2,
    change,
    timestamp: Date.now(),
  });

  return { success: true };
});

exports.deleteHistoryEntry = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { key } = request.data;
  await db.ref("history/" + key).remove();

  return { success: true };
});

exports.clearHistory = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);
  await db.ref("history").remove();

  return { success: true };
});

exports.updateMatchData = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { uid, change, isWin } = request.data;

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

exports.setTimer = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { timer } = request.data;
  await db.ref("timer").set(timer);
  return { success: true };
});

exports.resetSeason = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { seasonName } = request.data;
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

  return { success: true };
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

  return { success: true };
});

exports.deleteArchive = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { key } = request.data;
  await db.ref("archives/" + key).remove();

  return { success: true };
});

exports.addPlayer = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { name } = request.data;
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

  return { success: true };
});

exports.linkDiscord = onCall({
  cors: true,
  secrets: [DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID, DISCORD_NEWBIE_ROLE, DISCORD_MID_ROLE, DISCORD_HIGH_ROLE],
}, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const { code, redirectUri } = request.data;

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
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

  return { success: true, username: discordUser.username };
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
      headers: { Authorization: `Bot ${token}` },
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
        headers: { Authorization: `Bot ${token}` },
      }),
    ));
  }

  await db.ref("players/" + callerUid).update({
    discordId: null,
    discord: null,
  });

  return { success: true };
});

exports.createTournament = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const { name, description, registrationStartDate, registrationEndDate,
    tournamentStartDate, tournamentEndDate, minCost, maxCost,
    minCharacters, minTier, maxTier } = request.data;

  if (!name || !registrationStartDate || !registrationEndDate ||
    !tournamentStartDate || !tournamentEndDate || minCost == null ||
    !maxCost == null || !minCharacters == null || minTier == null ||
    maxTier == null) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const newRef = db.ref("tournaments").push();
  const id = newRef.key;

  await newRef.set({
    id,
    name,
    description: description ?? "",
    registrationStartDate,
    registrationEndDate,
    tournamentStartDate,
    tournamentEndDate,
    minCost,
    maxCost,
    minCharacters,
    minTier,
    maxTier,
  });

  return { success: true, id };
});

exports.applyForTournament = onCall({ cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Not logged in");

  const snap = await db.ref("players/" + callerUid).once("value");
  const player = snap.val();
  if (!player) throw new HttpsError("not-found", "Player not found");
  if (!player.discordId) {
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
    metadata: { contentType },
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

  return { success: true };
});

exports.approveRegistration = onCall({ cors: true }, async (request) => {
  await validateAdminRequest(request);

  const {
    tournamentId,
    uid,
    approved,
  } = request.data;

  if (!tournamentId || !uid || approved == null) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  await db.ref(`tournamentRegistrations/${tournamentId}/${uid}`).update({
    approved: approved,
  });
});

exports.startChallongeTournament = onCall({
  cors: true,
  secrets: [CHALLONGE_API_KEY],
}, async (request) => {
  await validateAdminRequest(request);

  const { tournamentId } = request.data;
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
    await db.ref("tournamentRegistrations/" + tournamentId).once("value");
  const registrations = regSnap.val();
  if (!registrations) {
    throw new HttpsError("not-found", "No registrations found");
  }

  /* const approved = Object.values(registrations).filter((r) => r.approved);
  if (approved.length < 2) {
    throw new HttpsError("failed-precondition",
      "Need at least 2 approved players");
  } */

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
          tournament_type: tournament.torunamentType ?? "single elimination",
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

  const approved = [
    { uid: "mbev2I0iWhfJ1DDOIWlGDoYtyd33" },
    { uid: "Ui7oyEUwuZS5ydAXJnF21wz2nzc2" },
    { uid: "AirAN2QtX6SCRlVZ54aSXzI2za62" },
    { uid: "W8zGIX9SfZcE1NVJMNPTmfoepii2" },
    { uid: "4bVGeJSfk5Vey9NRzvr4Qv8lsPy1" },
  ];

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
        attributes: { participants },
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
        attributes: { participants },
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
  });

  await updateTournamentGames(tournamentId, challongeTournamentId);

  await db.ref("tournaments/" + tournamentId).update({
    challongeTournamentId,
    challongeTournamentUrl,
  });

  return { success: true, challongeTournamentId };
});

async function updateTournamentGames(tournamentId, challongeTournamentId) {
  const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization-Type": "v1",
    "Authorization": CHALLONGE_API_KEY.value(),
  };

  const snap = await
    db.ref(`tournaments/${tournamentId}/challongeParticipants`)
      .once("value");
  const challongeParticipants = snap.val();
  if (!challongeParticipants) {
    throw new HttpsError("not-found", "No participants data found");
  }

  const matchesRes = await
    fetch(`https://api.challonge.com/v2.1/tournaments/${challongeTournamentId}/matches.json`, {
      method: "GET",
      headers,
    });

  const matchesData = await matchesRes.json();
  if (!matchesRes.ok) {
    throw new HttpsError("internal",
      `Challonge matches fetch error: ${JSON.stringify(matchesData)}`);
  }

  const matches = Object.fromEntries(
    matchesData.data.map((m) => {
      const pp = m.attributes.points_by_participant ?? [];
      const p1Id = pp[0]?.participant_id;
      const p2Id = pp[1]?.participant_id;
      return [
        m.id,
        {
          id: m.id,
          state: m.attributes.state,
          winnerId: m.attributes.winner_id,
          p1: challongeParticipants[p1Id] ?? "TBD",
          p2: challongeParticipants[p2Id] ?? "TBD",
        },
      ];
    }),
  );

  await db.ref(`tournaments/${tournamentId}/matches`).set(matches);
}

exports.approveResult = onCall({ cors: true }, async (request) => {
  const {
    tournamentId,
    matchId,
    uid,
    resultP1,
    resultP2
  } = request.data;

  if (!tournamentId || !uid) {
    throw new HttpsError("invalid-argument", "tournamentId is required");
  }

  const matchRef = db.ref(`tournaments/${tournamentId}/${matchId}`);
  let matchSnap =
    await matchRef.once("value");
  const match = matchSnap.val();
  if (!match) {
    throw new HttpsError("not-found", "Match not found");
  }

  const updates = [];

  if (resultP1.trim() !== match.resultP1 || resultP2.trim() !== match.resultP2) {
    updates.p1ApporvedResult = false;
    updates.p2ApporvedResult = false;
  }

  switch (uid) {
    case match.p1:
      updates["p1ApporvedResult"] = !match.p1ApporvedResult;
      break;
    case match.p2:
      updates["p2ApporvedResult"] = !match.p1ApporvedResult;
      break;
    default:
      throw new HttpsError("not-found", "Match player not found");
  }

  matchSnap = await match.once("value");

  if (matchSnap.p1ApporvedResult && matchSnap.p2ApporvedResult) {

  }

  return { success: true };
}); 