import {DISCORD_BOT_TOKEN, DISCORD_GUILD_ID} from "../config/secrets.js";

const BASE_URL = "https://discord.com/api";

async function botFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bot ${DISCORD_BOT_TOKEN.value()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord API error ${res.status}: ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function addMemberRole(discordUserId, roleId) {
  const guildId = DISCORD_GUILD_ID.value();
  await botFetch(
      `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      {method: "PUT"},
  );
}

export async function removeMemberRole(discordUserId, roleId) {
  const guildId = DISCORD_GUILD_ID.value();
  await botFetch(
      `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      {method: "DELETE"},
  );
}

export async function createGuildRole(name) {
  const guildId = DISCORD_GUILD_ID.value();
  return botFetch(`/guilds/${guildId}/roles`, {
    method: "POST",
    body: JSON.stringify({name, mentionable: true}),
  });
}

export async function createGuildChannel(name, options = {}) {
  const {parentId, position} = options;
  const guildId = DISCORD_GUILD_ID.value();
  return botFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name,
      type: 0,
      ...(parentId != null && {parent_id: parentId}),
      ...(position != null && {position}),
    }),
  });
}
