import {db} from "../config/firebase.js";
import {
  DISCORD_NEWBIE_ROLE_ID,
  DISCORD_MID_ROLE_ID,
  DISCORD_HIGH_ROLE_ID,
} from "../config/discordRoles.js";
import {addMemberRole, removeMemberRole} from "./discordClient.js";

export async function assignDiscordRole(uid) {
  const playerSnap = await db.ref("players/" + uid).once("value");
  const player = playerSnap.val();
  if (!player?.discordId) return;

  const newbieRole = DISCORD_NEWBIE_ROLE_ID;
  const midRole = DISCORD_MID_ROLE_ID;
  const highRole = DISCORD_HIGH_ROLE_ID;

  const newRoleId = player.isHighConfirmed ? highRole :
    player.isMidConfirmed ? midRole :
      newbieRole;

  const allRoles = [newbieRole, midRole, highRole];

  await Promise.all(allRoles.map((roleId) =>
    roleId === newRoleId ?
      addMemberRole(player.discordId, roleId) :
      removeMemberRole(player.discordId, roleId),
  ));
}
