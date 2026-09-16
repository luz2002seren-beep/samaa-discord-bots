import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseShape, GuildSettings, UserProfile } from '../types.js';

const EMPTY: DatabaseShape = { guilds: {}, users: {} };

export class Store {
  private data: DatabaseShape = structuredClone(EMPTY);
  private readonly dbPath: string;

  constructor(instanceId = 'default') {
    const safeId = instanceId.replace(/[^a-z0-9_-]/gi, '-');
    this.dbPath = fileURLToPath(new URL(`../../data/state-${safeId}.json`, import.meta.url));
  }

  async load(): Promise<void> {
    try {
      this.data = JSON.parse(await readFile(this.dbPath, 'utf8')) as DatabaseShape;
    } catch {
      this.data = structuredClone(EMPTY);
      await this.flush();
    }
  }

  getGuild(id: string): GuildSettings {
    return this.data.guilds[id] ?? {};
  }

  async setCommandChannel(guildId: string, channelId: string): Promise<void> {
    this.data.guilds[guildId] = { ...this.getGuild(guildId), commandChannelId: channelId };
    await this.flush();
  }

  async setPinnedVoiceChannel(guildId: string, channelId: string): Promise<void> {
    this.data.guilds[guildId] = { ...this.getGuild(guildId), pinnedVoiceChannelId: channelId };
    await this.flush();
  }

  async clearPinnedVoiceChannel(guildId: string): Promise<void> {
    const settings = { ...this.getGuild(guildId) };
    delete settings.pinnedVoiceChannelId;
    this.data.guilds[guildId] = settings;
    await this.flush();
  }

  pinnedVoiceChannels(): Array<[string, string]> {
    return Object.entries(this.data.guilds)
      .flatMap(([guildId, settings]) => settings.pinnedVoiceChannelId ? [[guildId, settings.pinnedVoiceChannelId] as [string, string]] : []);
  }

  getUser(id: string): UserProfile {
    return this.data.users[id] ?? { playlists: [] };
  }

  async updateUser(id: string, update: (user: UserProfile) => void): Promise<UserProfile> {
    const user = this.getUser(id);
    update(user);
    this.data.users[id] = user;
    await this.flush();
    return user;
  }

  private async flush(): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    await writeFile(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
