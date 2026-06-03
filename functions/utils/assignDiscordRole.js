import {db} from "../config/firebase.js";
import {
  DISCORD_GUILD_ID,
  DISCORD_BOT_TOKEN,
  DISCORD_NEWBIE_ROLE,
  DISCORD_MID_ROLE,
  DISCORD_HIGH_ROLE,
} from "../config/secrets.js";


export async function assignDiscordRole(uid) {
  const snap = await db.ref("players/" + uid).once("value");
  const player = snap.val();
  if (!player?.discordId) return;

  const elo = player.elo || 1000;
  const guildId = DISCORD_GUILD_ID.value();
  const token = DISCORD_BOT_TOKEN.value();

  const newbieRole = DISCORD_NEWBIE_ROLE.value();
  const midRole = DISCORD_MID_ROLE.value();
  const highRole = DISCORD_HIGH_ROLE.value();

  const newRoleId = elo >= 1400 ? highRole :
    elo >= 1200 ? midRole :
      newbieRole;

  const allRoles = [newbieRole, midRole, highRole];

  await Promise.all(allRoles.map((roleId) => fetch(`https://discord.com/api/guilds/${guildId}/members/${player.discordId}/roles/${roleId}`, {
    method: roleId === newRoleId ? "PUT" : "DELETE",
    headers: {Authorization: `Bot ${token}`},
  }),
  ));
}
