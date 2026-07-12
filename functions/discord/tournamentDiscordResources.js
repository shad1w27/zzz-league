import {db} from "../config/firebase.js";
import {DISCORD_TOURNAMENT_CATEGORY_ID} from "../config/secrets.js";
import {
  addMemberRole,
  removeMemberRole,
  createGuildRole,
  createGuildChannel,
} from "./discordClient.js";

const TOURNAMENT_CHANNEL_POSITION = 6;

async function getApprovedDiscordPlayers(tournamentId) {
  const regSnap = await db
      .ref(`tournaments/${tournamentId}/registrations`)
      .once("value");
  const registrations = regSnap.val() ?? {};
  const approved = Object.values(registrations).filter((r) => r.approved);

  const playerSnaps = await Promise.all(
      approved.map((r) => db.ref("players/" + r.uid).once("value")),
  );

  return playerSnaps
      .map((snap) => snap.val())
      .filter((player) => player?.discordId);
}

export async function createTournamentDiscordResources(tournamentId) {
  const tournamentSnap =
    await db.ref("tournaments/" + tournamentId).once("value");
  const tournament = tournamentSnap.val();
  if (!tournament) return;
  if (!tournament.discordRoleName && !tournament.discordChannelName) return;

  const updates = {};
  let roleId = tournament.discordRoleId;

  if (tournament.discordRoleName && !roleId) {
    const role = await createGuildRole(tournament.discordRoleName);
    roleId = role.id;
    updates.discordRoleId = roleId;
  }

  if (tournament.discordChannelName && !tournament.discordChannelId) {
    const channel = await createGuildChannel(tournament.discordChannelName, {
      parentId: DISCORD_TOURNAMENT_CATEGORY_ID.value(),
      position: TOURNAMENT_CHANNEL_POSITION,
    });
    updates.discordChannelId = channel.id;
  }

  if (Object.keys(updates).length > 0) {
    await db.ref(`tournaments/${tournamentId}`).update(updates);
  }

  if (roleId) {
    const players = await getApprovedDiscordPlayers(tournamentId);
    await Promise.all(
        players.map((player) => addMemberRole(player.discordId, roleId)),
    );
  }
}

export async function revokeTournamentDiscordRoles(tournamentId) {
  const tournamentSnap =
    await db.ref("tournaments/" + tournamentId).once("value");
  const tournament = tournamentSnap.val();
  if (!tournament?.discordRoleId) return;

  const players = await getApprovedDiscordPlayers(tournamentId);
  await Promise.all(
      players.map((player) =>
        removeMemberRole(player.discordId, tournament.discordRoleId),
      ),
  );
}
