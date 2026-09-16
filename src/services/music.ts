import type { Client, GuildMember, VoiceBasedChannel } from 'discord.js';
import { Connectors, Shoukaku } from 'shoukaku';

type NodeLinkPlayer = {
  queue: unknown[];
  track?: unknown;
  playTrack(options: { track: { encoded: string } }): Promise<void>;
  stopTrack(): Promise<void>;
  setGlobalVolume(volume: number): Promise<void>;
  destroy(): Promise<void>;
  on(event: 'end', listener: () => void): unknown;
};

type SearchTrack = { encoded: string; info: { title: string; author?: string; uri?: string; length?: number } };
type SearchResult = { data?: SearchTrack | SearchTrack[]; tracks?: SearchTrack[] };

export class MusicService {
  private readonly shoukaku: Shoukaku;
  private readonly queues = new Map<string, SearchTrack[]>();
  private readonly current = new Map<string, SearchTrack>();

  constructor(client: Client) {
    this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [
      {
        name: 'main',
        url: `${process.env.NODELINK_HOST ?? '127.0.0.1'}:${process.env.NODELINK_PORT ?? '2333'}`,
        auth: process.env.NODELINK_PASSWORD || 'samaa-local-change-me',
        secure: false
      }
    ]);
    // Shoukaku emits `error` when NodeLink reconnects. Registering a listener
    // prevents Node.js from terminating the Discord bot during that recovery.
    this.shoukaku.on('error', (name, error) => {
      console.error(`NodeLink node ${name} error:`, error.message);
    });
  }

  async enqueue(member: GuildMember, query: string): Promise<{ added: number; first: SearchTrack }> {
    const channel = member.voice.channel as VoiceBasedChannel | null;
    if (!channel) throw new Error('ادخل رومًا صوتيًا أولًا ثم اطلب التشغيل.');
    const guildId = member.guild.id;
    const player = await this.getOrCreatePlayer(guildId, channel.id, member.guild.shardId);
    const results = await this.search(query);
    if (!results.length) throw new Error('لم أجد أي نتيجة قابلة للتشغيل من هذا الرابط أو البحث.');
    const queue = this.queues.get(guildId) ?? [];
    queue.push(...results);
    this.queues.set(guildId, queue);
    if (!this.current.has(guildId)) await this.playNext(guildId, player);
    return { added: results.length, first: results[0] };
  }

  async pin(member: GuildMember): Promise<string> {
    const channel = member.voice.channel as VoiceBasedChannel | null;
    if (!channel) throw new Error('ادخل رومًا صوتيًا أولًا ثم اكتب `تثبيت`.');
    await this.getOrCreatePlayer(member.guild.id, channel.id, member.guild.shardId);
    return channel.name;
  }

  async restorePinnedChannel(guildId: string, channelId: string, shardId: number): Promise<void> {
    await this.getOrCreatePlayer(guildId, channelId, shardId);
  }

  async skip(guildId: string): Promise<boolean> {
    const player = this.shoukaku.players.get(guildId) as NodeLinkPlayer | undefined;
    if (!player || !this.current.has(guildId)) return false;
    this.current.delete(guildId);
    await player.stopTrack();

    const hasNext = (this.queues.get(guildId)?.length ?? 0) > 0;
    if (hasNext) {
      // There's something queued after this one — advance to it (only
      // happens here, on an explicit skip, never automatically).
      await this.playNext(guildId, player);
    } else {
      // Nothing queued after this one — stop completely instead of staying
      // connected and idle. Same real disconnect as stop() uses.
      this.queues.delete(guildId);
      await this.shoukaku.leaveVoiceChannel(guildId);
    }
    return true;
  }

  async stop(guildId: string): Promise<boolean> {
    const player = this.shoukaku.players.get(guildId) as NodeLinkPlayer | undefined;
    this.queues.delete(guildId);
    this.current.delete(guildId);
    if (!player) return false;
    await player.stopTrack();

    // FIX: destroy() only removes the player on NodeLink's side, it does NOT
    // tell Discord's gateway that the bot left the voice channel. Discord
    // keeps thinking the bot is still connected, so the next joinVoiceChannel()
    // call for the same guild never triggers a fresh VOICE_SERVER_UPDATE.
    // NodeLink then creates a new player that waits forever for voice
    // credentials that will never arrive ("No voice state ... enqueued").
    //
    // leaveVoiceChannel() performs a real disconnect (sends the voice state
    // update to Discord AND removes the player), so the next join is clean.
    await this.shoukaku.leaveVoiceChannel(guildId);

    return true;
  }

  private async getOrCreatePlayer(guildId: string, channelId: string, shardId: number): Promise<NodeLinkPlayer> {
    const existing = this.shoukaku.players.get(guildId) as NodeLinkPlayer | undefined;
    if (existing) return existing;
    const player = await this.shoukaku.joinVoiceChannel({ guildId, channelId, shardId, deaf: true }) as unknown as NodeLinkPlayer;
    // Previously this called playNext() here, which auto-continued to the
    // next queued track as soon as one song finished. Now a natural end
    // just stops playback — the bot stays connected and waits for a new
    // "ش" command instead of playing anything on its own. Moving forward
    // through the queue only happens explicitly, via skip().
    player.on('end', () => {
      this.current.delete(guildId);
    });
    return player;
  }

  private async search(input: string): Promise<SearchTrack[]> {
    const node = this.shoukaku.nodes.get('main');
    if (!node) throw new Error('محرك الموسيقى غير متصل حاليًا. تحقق من NodeLink.');
    const identifier = /^https?:\/\//i.test(input) ? input : `ytsearch:${input}`;
    const result = await node.rest.resolve(identifier) as SearchResult;
    const data = result.data ?? result.tracks ?? [];
    return Array.isArray(data) ? data : [data];
  }

  private async playNext(guildId: string, player: NodeLinkPlayer): Promise<void> {
    const next = this.queues.get(guildId)?.shift();
    if (!next) {
      this.current.delete(guildId);
      return;
    }
    this.current.set(guildId, next);
    // NodeLink v3 follows the Lavalink v4 object form for player updates.
    await player.playTrack({ track: { encoded: next.encoded } });
  }

  status(guildId: string): { current?: SearchTrack; queued: number; connected: boolean } {
    return {
      current: this.current.get(guildId),
      queued: this.queues.get(guildId)?.length ?? 0,
      connected: this.shoukaku.players.has(guildId)
    };
  }

  async setVolume(guildId: string, volume: number): Promise<boolean> {
    const player = this.shoukaku.players.get(guildId) as NodeLinkPlayer | undefined;
    if (!player) return false;
    await player.setGlobalVolume(volume);
    return true;
  }
}
