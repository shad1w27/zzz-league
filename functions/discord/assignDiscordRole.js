import {db} from "../config/firebase.js";
import {
  DISCORD_NEWBIE_ROLE,
  DISCORD_MID_ROLE,
  DISCORD_HIGH_ROLE,
} from "../config/secrets.js";
import {addMemberRole, removeMemberRole} from "./discordClient.js";

export async function assignDiscordRole(uid) {
  const playerSnap = await db.ref("players/" + uid).once("value");
  const player = playerSnap.val();
  if (!player?.discordId) return;

  const newbieRole = DISCORD_NEWBIE_ROLE.value();
  const midRole = DISCORD_MID_ROLE.value();
  const highRole = DISCORD_HIGH_ROLE.value();

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
