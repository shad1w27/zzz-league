import {onCall} from "firebase-functions/https";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {db} from "../../config/firebase.js";
import {defaultOptions} from "../../config/options.js";

export const deleteArchive = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {key} = request.data;
  await db.ref("archives/" + key).remove();

  return {success: true};
});
