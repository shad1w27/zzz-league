import {onCall, HttpsError} from "firebase-functions/https";
import {auth, db} from "../config/firebase.js";
import {defaultOptions} from "../config/options.js";

export const register = onCall(defaultOptions, async (request) => {
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
        wins: prevUserData.wins ?? 0,
        losses: prevUserData.losses ?? 0,
      };
    } else {
      playerData = {
        uid,
        name: username,
        elo: 1000,
        tournamentPoints: 0,
        isMidConfirmed: false,
        isHighConfirmed: false,
        wins: 0,
        losses: 0,
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
    if (userRecord) await auth.deleteUser(userRecord.uid);
    throw new HttpsError("internal", error.message ?? "Internal server error");
  }
});
