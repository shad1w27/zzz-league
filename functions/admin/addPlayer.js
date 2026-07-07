import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {validateAdminRequest} from "../utils/validateAdminRequest.js";
import {defaultOptions} from "../config/options.js";

export const addPlayer = onCall(defaultOptions, async (request) => {
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
    wins: 0,
    losses: 0,
  };

  await db.ref("players/" + trimmedName).set(player);

  return {success: true};
});
