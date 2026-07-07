import {onCall} from "firebase-functions/https";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {db} from "../../config/firebase.js";
import {defaultOptions} from "../../config/options.js";

export const addHistoryEntry = onCall(defaultOptions, async (request) => {
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
