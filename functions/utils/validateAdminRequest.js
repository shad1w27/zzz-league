import {HttpsError} from "firebase-functions/https";
import {db} from "../config/firebase.js";

export async function validateAdminRequest(request) {
  const callerUid = request.auth?.uid;

  if (!callerUid) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const callerSnapshot = await db.ref("players/" + callerUid).once("value");
  if (!callerSnapshot.exists() || callerSnapshot.val().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Permission denied");
  }
}
