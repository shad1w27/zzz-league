import {defineSecret} from "firebase-functions/params";

export const DISCORD_BOT_TOKEN = defineSecret("DISCORD_BOT_TOKEN");
export const DISCORD_GUILD_ID = defineSecret("DISCORD_GUILD_ID");
export const DISCORD_NEWBIE_ROLE = defineSecret("DISCORD_NEWBIE_ROLE");
export const DISCORD_MID_ROLE = defineSecret("DISCORD_MID_ROLE");
export const DISCORD_HIGH_ROLE = defineSecret("DISCORD_HIGH_ROLE");
export const DISCORD_CLIENT_ID = defineSecret("DISCORD_CLIENT_ID");
export const DISCORD_CLIENT_SECRET = defineSecret("DISCORD_CLIENT_SECRET");
export const DISCORD_TOURNAMENT_CATEGORY_ID =
  defineSecret("DISCORD_TOURNAMENT_CATEGORY_ID");
export const CHALLONGE_API_KEY = defineSecret("CHALLONGE_API_KEY");
