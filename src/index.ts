import 'dotenv/config';
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import { CommandRouter } from './commands/router.js';
import { MusicService } from './services/music.js';
import { Store } from './services/store.js';

type BotConfig = { id: string; token: string };

const configuredBots: BotConfig[] = [process.env.BOT_1_TOKEN, process.env.BOT_2_TOKEN, process.env.BOT_3_TOKEN]
  .filter((token): token is string => Boolean(token))
  .map((token, index) => ({ id: `bot-${index + 1}`, token }));

if (!configuredBots.length) throw new Error('أضف توكن بوت واحد على الأقل (BOT_1_TOKEN).');

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

await Promise.all(configuredBots.map(startBot));
