import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {defaultOptions} from "../config/options.js";

export const updateProfile = onCall(defaultOptions, async (request) => {
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
