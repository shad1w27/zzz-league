import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v10";
import {DISCORD_BOT_TOKEN, DISCORD_GUILD_ID} from "../config/secrets.js";

export const PERMISSION_VIEW_CHANNEL = 0x400;
export const PERMISSION_SEND_MESSAGES = 0x800;
export const PERMISSION_ADD_REACTIONS = 0x40;

let restClient;

function getRest() {
  if (!restClient) {
    restClient = new REST({version: "10"});
  }
  restClient.setToken(DISCORD_BOT_TOKEN.value());
  return restClient;
}

export async function addMemberRole(discordUserId, roleId) {
  const guildId = DISCORD_GUILD_ID.value();
  await getRest().put(Routes.guildMemberRole(guildId, discordUserId, roleId));
}

export async function removeMemberRole(discordUserId, roleId) {
  const guildId = DISCORD_GUILD_ID.value();
  await getRest().delete(
      Routes.guildMemberRole(guildId, discordUserId, roleId),
  );
}

/**
 * @param {string} name
 * @return {Promise<any>}
 */
export async function createGuildRole(name) {
  const guildId = DISCORD_GUILD_ID.value();
  return getRest().post(Routes.guildRoles(guildId), {
    body: {name, mentionable: true},
  });
}

export async function deleteGuildRole(roleId) {
  const guildId = DISCORD_GUILD_ID.value();
  await getRest().delete(Routes.guildRole(guildId, roleId));
}

/**
 * @param {string} name
 * @param {object} [options]
 * @return {Promise<any>}
 */
export async function createGuildChannel(name, options = {}) {
  const {parentId, position, permissionOverwrites} = options;
  const guildId = DISCORD_GUILD_ID.value();
  return getRest().post(Routes.guildChannels(guildId), {
    body: {
      name,
      type: 0,
      ...(parentId != null && {parent_id: parentId}),
      ...(position != null && {position}),
      ...(permissionOverwrites != null &&
        {permission_overwrites: permissionOverwrites}),
    },
  });
}

export async function deleteGuildChannel(channelId) {
  await getRest().delete(Routes.channel(channelId));
}

/**
 * @param {string} accessToken
 * @return {Promise<any>}
 */
export async function getDiscordUser(accessToken) {
  const userRest = new REST({version: "10", authPrefix: "Bearer"})
      .setToken(accessToken);
  return userRest.get(Routes.user());
}
