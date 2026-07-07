import {onCall} from "firebase-functions/https";
import {db} from "../config/firebase.js";
import {validateAdminRequest} from "../utils/validateAdminRequest.js";
import {defaultOptions} from "../config/options.js";

export const setTimer = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {timer} = request.data;
  await db.ref("timer").set(timer);
  return {success: true};
});
