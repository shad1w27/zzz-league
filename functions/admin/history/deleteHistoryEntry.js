import {onCall} from "firebase-functions/https";
import {validateAdminRequest} from "../utils.js";
import {db} from "../../config/firebase.js";
import {defaultOptions} from "../../config/options.js";

export const deleteHistoryEntry = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {key} = request.data;
  await db.ref("history/" + key).remove();

  return {success: true};
});
