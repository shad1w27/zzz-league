import {onCall, HttpsError} from "firebase-functions/https";
import {db} from "../../config/firebase.js";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {defaultOptions} from "../../config/options.js";

export const approveRegistration = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {
    tournamentId, uid, approved,
  } = request.data;

  if (!tournamentId || !uid || approved == null) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  await db.ref(`tournaments/${tournamentId}/registrations/${uid}`).update({
    approved: approved,
  });
});
