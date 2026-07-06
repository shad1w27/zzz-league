import {db} from "../config/firebase.js";

export async function registerMatchResult(
    p1,
    p2,
    p1Win,
    overrideEloChange,
    tournamentId,
    tournamentMatch,
    resultP1 = null,
    resultP2 = null,
    resultScreenshot = null) {
  const p1Change = overrideEloChange != -1 ?
    (p1Win ? overrideEloChange : -overrideEloChange) :
    calculateEloChange(p1, p2, p1Win);
  const p2Change = overrideEloChange != -1 ?
    (p1Win ? -overrideEloChange : overrideEloChange) :
    calculateEloChange(p2, p1, !p1Win);

  if (!tournamentId) tournamentMatch = "custom";

  const historyKey = db.ref("historyV3").push().key;

  await db.ref().update({
    [`players/${p1.uid}/tournamentPoints`]:
      (p1.tournamentPoints || 0) + p1Change,
    [`players/${p2.uid}/tournamentPoints`]:
      (p2.tournamentPoints || 0) + p2Change,
    [`historyV3/${historyKey}`]: {
      id: historyKey,
      p1: p1.uid,
      p1Change,
      p2: p2.uid,
      p2Change,
      tournamentId,
      tournamentMatch: tournamentMatch ?? null,
      resultP1,
      resultP2,
      resultScreenshot,
      timestamp: Date.now(),
    },
  });

  return historyKey;
}

function calculateEloChange(p1, p2, p1Win) {
  const k = p1.isMidConfirmed || false ? 20 : 50;
  const expected =
    1 / (1 + Math.pow(10, ((p2.elo || 1000) - (p1.elo || 1000)) / 400));
  let change = Math.round(k * (p1Win - expected));
  if (p1Win && change <= 0) change = 1;
  if (!p1Win && change >= 0) change = -1;
  return change;
}
