import {onCall, HttpsError} from "firebase-functions/https";
import admin from "firebase-admin";
import {validateAdminRequest} from "../../utils/validateAdminRequest.js";
import {db} from "../../config/firebase.js";
import {defaultOptions} from "../../config/options.js";

export const deleteHistoryEntry = onCall(defaultOptions, async (request) => {
  await validateAdminRequest(request);

  const {key} = request.data;
  if (!key) {
    throw new HttpsError("invalid-argument", "key is required");
  }

  const entrySnap = await db.ref("historyV3/" + key).once("value");
  if (!entrySnap.exists()) {
    throw new HttpsError("not-found", "History entry not found");
  }
  const entry = entrySnap.val();

  const updates = {
    [`historyV3/${key}`]: null,
  };

  if (entry.p2) {
    updates[`players/${entry.p1}/tournamentPoints`] =
      admin.database.ServerValue.increment(-entry.p1Change);
    updates[`players/${entry.p2}/tournamentPoints`] =
      admin.database.ServerValue.increment(-entry.p2Change);

    const decrement = admin.database.ServerValue.increment(-1);
    const p1Won = entry.p1Change > entry.p2Change;
    updates[`players/${entry.p1}/${p1Won ? "wins" : "losses"}`] = decrement;
    updates[`players/${entry.p2}/${p1Won ? "losses" : "wins"}`] = decrement;
  } else {
    const playerSnap = await db.ref("players/" + entry.p1).once("value");
    if (playerSnap.exists()) {
      const player = playerSnap.val();
      const revertedElo = (player.elo || 1000) - entry.p1Change;
      updates[`players/${entry.p1}/elo`] = revertedElo;
      updates[`players/${entry.p1}/isMidConfirmed`] = revertedElo >= 1200;
      updates[`players/${entry.p1}/isHighConfirmed`] = revertedElo >= 1400;
    }

    if (entry.p1Change > 0) {
      updates[`players/${entry.p1}/wins`] =
        admin.database.ServerValue.increment(-1);
    } else if (entry.p1Change < 0) {
      updates[`players/${entry.p1}/losses`] =
        admin.database.ServerValue.increment(-1);
    }
  }

  await db.ref().update(updates);

  return {success: true};
});
