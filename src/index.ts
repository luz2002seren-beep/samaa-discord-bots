import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import { CommandRouter } from './commands/router.js';
import { MusicService } from './services/music.js';
import { Store } from './services/store.js';

type BotConfig = { id: string; token: string };

// dotenv keeps only the last duplicate environment key. Read repeated
// DISCORD_TOKEN lines ourselves so a simple .env can run several bots.
const envText = await readFile(new URL('../.env', import.meta.url), 'utf8').catch(() => '');
const legacyTokens = envText
  .split(/\r?\n/u)
  .map(line => line.match(/^\s*DISCORD_TOKEN\s*=\s*(\S+)\s*$/u)?.[1])
  .filter((token): token is string => Boolean(token));
const namedTokens = [process.env.BOT_1_TOKEN, process.env.BOT_2_TOKEN, process.env.BOT_3_TOKEN]
  .filter((token): token is string => Boolean(token));
const tokens = [...new Set(legacyTokens.length ? legacyTokens : namedTokens)];
const configuredBots: BotConfig[] = tokens.map((token, index) => ({ id: `bot-${index + 1}`, token }));

if (!configuredBots.length) throw new Error('أضف توكن بوت واحد على الأقل في ملف .env.');
const selectedBot = process.argv.find(argument => argument.startsWith('--bot='))?.slice('--bot='.length);
const botsToStart = selectedBot
  ? [configuredBots[Number(selectedBot) - 1]].filter((bot): bot is BotConfig => Boolean(bot))
  : configuredBots;
if (!botsToStart.length) throw new Error('رقم البوت المطلوب غير موجود في ملف .env.');

async function startBot({ id, token }: BotConfig): Promise<void> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
  });
  const store = new Store(id);
  await store.load();
  const router = new CommandRouter(client, store, new MusicService(client));

  client.once(Events.ClientReady, ready => {
    ready.user.setActivity('ش اسم أغنية | موسيقى 24/7', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' });
    void router.restorePinnedVoiceChannels();
    console.log(`♪ ${id} جاهز باسم ${ready.user.tag}`);
  });
  client.on(Events.MessageCreate, message => void router.handle(message));
  await client.login(token);
}

await Promise.all(botsToStart.map(startBot));
