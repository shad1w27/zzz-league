import { onCall, HttpsError } from "firebase-functions/https";
import { db } from "../../config/firebase.js";
import { validateAdminRequest } from "../utils.js";
import { defaultOptions } from "../../config/options.js";

export const createTournament = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {
    name,
    description,
    registrationStartDate,
    registrationEndDate,
    tournamentStartDate,
    tournamentEndDate,
    minCost,
    maxCost,
    minCharacters,
    minTier,
    maxTier
  } = request.data;

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
