export interface GuildSettings {
  commandChannelId?: string;
  pinnedVoiceChannelId?: string;
}

export interface PersonalPlaylist {
  name: string;
  entries: string[];
}

export interface UserProfile {
  afk?: { reason: string; since: number };
  playlists: PersonalPlaylist[];
}

export interface DatabaseShape {
  guilds: Record<string, GuildSettings>;
  users: Record<string, UserProfile>;
}
