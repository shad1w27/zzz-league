import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {validateAdminRequest} from "../utils/validateAdminRequest.js";
import {defaultOptions} from "../config/options.js";
import {registerMatchResult} from "../utils/registerMatchResult.js";

export const registerMatch = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {p1, p2, p1Win, overrideEloChange, techLoss} = request.data;

  const p1Snap = await db.ref("players/" + p1).once("value");
  if (!p1Snap.exists()) {
    throw new HttpsError("not-found", `Player ${p1} not found`);
  }

  const p2Snap = await db.ref("players/" + p2).once("value");
  if (!p2Snap.exists()) {
    throw new HttpsError("not-found", `Player ${p2} not found`);
  }

  await registerMatchResult(p1Snap.val(), p2Snap.val(),
      p1Win, overrideEloChange, null, null,
      null, null, null, !!techLoss);

  return {success: true};
});
