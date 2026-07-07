import {onCall} from "firebase-functions/https";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {db} from "../../config/firebase.js";
import {defaultOptions} from "../../config/options.js";

export const clearHistory = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);
  await db.ref("history").remove();

  return {success: true};
});
