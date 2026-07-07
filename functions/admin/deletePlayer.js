import {onCall, HttpsError} from "firebase-functions/https";
import {auth, db} from "../config/firebase.js";
import {validateAdminRequest} from "../utils/validateAdminRequest.js";
import {defaultOptions} from "../config/options.js";

export const deletePlayer = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {uid} = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  const playerSnap = await db.ref("players/" + uid).once("value");
  if (!playerSnap.exists()) {
    throw new HttpsError("not-found", "Player not found");
  }

  const username = playerSnap.val().name;

  await db.ref().update({
    ["players/" + uid]: null,
    ["usernames/" + username]: null,
  });

  await auth.deleteUser(uid);

  return {success: true};
});
