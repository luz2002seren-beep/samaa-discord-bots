import { ActivityType, Client, EmbedBuilder, PermissionFlagsBits, type Message } from 'discord.js';
import type { MusicService } from '../services/music.js';
import type { Store } from '../services/store.js';

const color = 0x8b5cf6;
const respond = (message: Message, title: string, description: string) =>
  message.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()] });

export class CommandRouter {
  constructor(private readonly client: Client, private readonly store: Store, private readonly music: MusicService) {}

  async restorePinnedVoiceChannels(): Promise<void> {
    for (const [guildId, channelId] of this.store.pinnedVoiceChannels()) {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) continue;
      try {
        await this.music.restorePinnedChannel(guild.id, channelId, guild.shardId);
        console.log(`Restored 24/7 voice connection for guild ${guild.id}.`);
      } catch (error) {
        console.error(`Could not restore 24/7 voice connection for guild ${guildId}:`, error);
      }
    }
  }

  async handle(message: Message): Promise<void> {
    if (!message.guild || message.author.bot || !message.member) return;
    const raw = message.content.trim();
    if (!raw) return;
    const [command, ...rest] = raw.split(/\s+/u);
    const args = rest.join(' ').trim();

    if (command === 'تثبيت' && message.mentions.users.has(this.client.user!.id)) return this.pinRoom(message);
    if (command === 'افتار' && message.mentions.users.has(this.client.user!.id)) return this.changeAvatar(message, this.withoutOwnMention(message, args));
    if (command === 'بنر' && message.mentions.users.has(this.client.user!.id)) return this.changeBanner(message, this.withoutOwnMention(message, args));
    if (command === 'اسم' && message.mentions.users.has(this.client.user!.id)) return this.changeName(message, this.withoutOwnMention(message, args));
    if (command === 'قناة' && message.mentions.users.has(this.client.user!.id)) return this.commandChannel(message, this.withoutOwnMention(message, args));
    if (command.toLowerCase() === 'afk') return this.afk(message, args);

    const configured = this.store.getGuild(message.guild.id).commandChannelId;
    if (configured && message.channel.id !== configured) return;

    if (command === 'ش') return this.play(message, args);
    if (command === 'س') return this.skip(message);
    if (command === 'و') return this.stop(message);
    if (command === 'صوت') return this.volume(message, args);
    if (command === 'ستريمنغ') return this.streaming(message, args);
    if (command === 'وضعية' || command === 'حالة') return this.status(message);
    if (command === 'قائمتي') return this.playlists(message, args);
  }

  private withoutOwnMention(message: Message, input: string): string {
    const id = this.client.user!.id;
    return input.replace(new RegExp(`<@!?${id}>`, 'g'), '').trim();
  }

  private canManageBot(message: Message): boolean {
    return message.member!.permissions.has(PermissionFlagsBits.ManageGuild);
  }

  private async downloadImage(url: string): Promise<Buffer> {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('ضع رابط صورة صحيحًا يبدأ بـ https:// أو http://.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('استخدم رابط صورة عبر http أو https فقط.');
    const response = await fetch(parsed);
    if (!response.ok) throw new Error('تعذر تنزيل الصورة من هذا الرابط.');
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error('الرابط يجب أن يشير إلى صورة مباشرة.');
    const image = Buffer.from(await response.arrayBuffer());
    if (image.length > 8 * 1024 * 1024) throw new Error('حجم الصورة كبير؛ استخدم صورة أقل من 8MB.');
    return image;
  }

  private async changeAvatar(message: Message, url: string): Promise<void> {
    if (!this.canManageBot(message)) return void respond(message, 'صلاحيات غير كافية', 'تحتاج صلاحية **Manage Server** لتغيير افتار البوت.');
    const imageUrl = url || message.attachments.first()?.url;
    if (!imageUrl) return void respond(message, 'افتار', 'ارفق صورة مع الرسالة ثم اكتب: `افتار @البوت`');
    try {
      await this.client.user!.setAvatar(await this.downloadImage(imageUrl));
      await respond(message, 'تم تغيير الافتار', 'تم تحديث صورة هذا البوت.');
    } catch (error) { await respond(message, 'تعذر تغيير الافتار', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'); }
  }

  private async changeBanner(message: Message, url: string): Promise<void> {
    if (!this.canManageBot(message)) return void respond(message, 'صلاحيات غير كافية', 'تحتاج صلاحية **Manage Server** لتغيير بنر البوت.');
    const imageUrl = url || message.attachments.first()?.url;
    if (!imageUrl) return void respond(message, 'بنر', 'ارفق صورة مع الرسالة ثم اكتب: `بنر @البوت`');
    try {
      await this.client.user!.setBanner(await this.downloadImage(imageUrl));
      await respond(message, 'تم تغيير البنر', 'تم تحديث بنر هذا البوت.');
    } catch (error) { await respond(message, 'تعذر تغيير البنر', error instanceof Error ? error.message : 'قد لا تكون ميزة البنر متاحة لهذا البوت، أو أن الصورة غير مقبولة.'); }
  }

  private async changeName(message: Message, name: string): Promise<void> {
    if (!this.canManageBot(message)) return void respond(message, 'صلاحيات غير كافية', 'تحتاج صلاحية **Manage Server** لتغيير اسم البوت.');
    if (!name || name.length > 32) return void respond(message, 'اسم', 'الاستخدام: `اسم @البوت <اسم جديد>`، وبحد أقصى 32 حرفًا.');
    try {
      await this.client.user!.setUsername(name);
      await respond(message, 'تم تغيير الاسم', `الاسم الجديد: **${name}**`);
    } catch (error) { await respond(message, 'تعذر تغيير الاسم', error instanceof Error ? error.message : 'Discord رفض تغيير الاسم حاليًا؛ جرب لاحقًا.'); }
  }

  private async commandChannel(message: Message, args: string): Promise<void> {
    if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return void respond(message, 'صلاحيات غير كافية', 'تحتاج صلاحية **Manage Server** لتحديد روم الأوامر.');
    }
    const sub = args.trim();
    if (sub === 'الغاء' || sub === 'إلغاء') {
      await this.store.clearCommandChannel(message.guild!.id);
      return void respond(message, 'تم الإلغاء', 'أوامر البوت أصبحت تعمل في كل الرومات من جديد.');
    }
    await this.store.setCommandChannel(message.guild!.id, message.channel.id);
    await respond(message, 'تم التثبيت', `أوامر البوت ستعمل الآن فقط في <#${message.channel.id}>.\nلإلغاء ذلك: \`قناة @البوت الغاء\``);
  }

  private async pinRoom(message: Message): Promise<void> {
    if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return void respond(message, 'صلاحيات غير كافية', 'تحتاج صلاحية **Manage Server** لتثبيت روم الأوامر.');
    }
    try {
      const channelName = await this.music.pin(message.member!);
      await this.store.setPinnedVoiceChannel(message.guild!.id, message.member!.voice.channel!.id);
      await respond(message, 'تم التثبيت 24/7', `سأبقى في روم **${channelName}** حتى تستخدم أمر الإيقاف.`);
    } catch (error) {
      await respond(message, 'تعذر التثبيت', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    }
  }

  private async play(message: Message, input: string): Promise<void> {
    if (!input) return void respond(message, 'تشغيل', 'الاستخدام: `ش <اسم الأغنية أو الرابط>`');
    try {
      const result = await this.music.enqueue(message.member!, input);
      const suffix = result.added > 1 ? ` وتمت إضافة **${result.added}** مسارات.` : '';
      await respond(message, '♪ أُضيف للطابور', `**${result.first.info.title}**${suffix}`);
    } catch (error) {
      await respond(message, 'تعذر التشغيل', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    }
  }

  private async skip(message: Message): Promise<void> {
    const skipped = await this.music.skip(message.guild!.id);
    await respond(message, skipped ? '⏭ تم التخطي' : 'الطابور فارغ', skipped ? 'انتقلت إلى المسار التالي.' : 'لا توجد أغنية تعمل الآن.');
  }

  private async stop(message: Message): Promise<void> {
    const stopped = await this.music.stop(message.guild!.id);
    await this.store.clearPinnedVoiceChannel(message.guild!.id);
    await respond(message, stopped ? '⏹ تم الإيقاف' : 'لا يوجد تشغيل', stopped ? 'مسحت الطابور وغادرت الروم الصوتي.' : 'البوت غير متصل بروم صوتي.');
  }

  private async status(message: Message): Promise<void> {
    const status = this.music.status(message.guild!.id);
    if (!status.connected) return void respond(message, 'وضعية سماع', 'لست متصلًا بروم صوتي الآن. اكتب `ش <اسم أغنية>` للبدء.');
    const current = status.current?.info.title ?? 'بانتظار المسار التالي';
    await respond(message, 'وضعية سماع', `الآن: **${current}**\nفي الطابور: **${status.queued}** مسار.`);
  }

  private async volume(message: Message, input: string): Promise<void> {
    const level = Number(input);
    if (!Number.isInteger(level) || level < 0 || level > 200) {
      return void respond(message, 'الصوت', 'الاستخدام: `صوت <0-200>`، مثال: `صوت 80`');
    }
    const updated = await this.music.setVolume(message.guild!.id, level);
    await respond(message, updated ? '🔊 تم تغيير الصوت' : 'لا يوجد تشغيل', updated ? `مستوى الصوت الآن: **${level}%**` : 'شغّل أغنية أولًا.');
  }

  private async streaming(message: Message, text: string): Promise<void> {
    if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return void respond(message, 'صلاحيات غير كافية', 'تحتاج صلاحية **Manage Server** لتغيير حالة البوت.');
    }
    const activity = text || 'ش اسم أغنية | موسيقى 24/7';
    this.client.user?.setActivity(activity, { type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' });
    await respond(message, '📡 تم تحديث Streaming', `الحالة الحالية: **${activity}**`);
  }

  private async afk(message: Message, reason: string): Promise<void> {
    const user = this.store.getUser(message.author.id);
    if (user.afk) {
      await this.store.updateUser(message.author.id, profile => { delete profile.afk; });
      return void respond(message, 'مرحبًا بعودتك', 'تم إلغاء حالة AFK.');
    }
    await this.store.updateUser(message.author.id, profile => { profile.afk = { reason: reason || 'غير متاح حاليًا', since: Date.now() }; });
    await respond(message, 'AFK مفعّل', `السبب: ${reason || 'غير متاح حاليًا'}`);
  }

  private async playlists(message: Message, input: string): Promise<void> {
    const [action, ...parts] = input.trim().split(/\s+/u);
    const remainder = parts.join(' ').trim();
    const user = this.store.getUser(message.author.id);
    if (!action || action === 'عرض') {
      if (!remainder) {
        const list = user.playlists.map(p => `• **${p.name}** — ${p.entries.length} عنصر`).join('\n') || 'لا توجد قوائم بعد.';
        return void respond(message, 'قوائمي الخاصة', list);
      }
      const playlist = user.playlists.find(p => p.name === remainder);
      return void respond(message, `قائمة: ${remainder}`, playlist ? (playlist.entries.map((e, i) => `${i + 1}. ${e}`).join('\n') || 'فارغة.') : 'لم أجد هذه القائمة.');
    }
    if (action === 'إنشاء') {
      if (!remainder) return void respond(message, 'قائمتي', 'الاستخدام: `قائمتي إنشاء <اسم القائمة>`');
      if (user.playlists.some(p => p.name === remainder)) return void respond(message, 'موجودة مسبقًا', 'اختر اسمًا مختلفًا للقائمة.');
      await this.store.updateUser(message.author.id, profile => { profile.playlists.push({ name: remainder, entries: [] }); });
      return void respond(message, 'تم الإنشاء', `قائمة **${remainder}** أصبحت جاهزة.`);
    }
    if (action === 'إضافة') {
      const separator = remainder.indexOf('|');
      if (separator < 1) return void respond(message, 'أضف عنصرًا', 'الاستخدام: `قائمتي إضافة <اسم القائمة> | <رابط أو بحث>`');
      const name = remainder.slice(0, separator).trim();
      const entry = remainder.slice(separator + 1).trim();
      const playlist = user.playlists.find(p => p.name === name);
      if (!playlist) return void respond(message, 'غير موجودة', `أنشئها أولًا: \`قائمتي إنشاء ${name}\``);
      if (!entry) return void respond(message, 'أضف عنصرًا', 'اكتب رابطًا أو عبارة بحث بعد علامة `|`.');
      await this.store.updateUser(message.author.id, profile => { profile.playlists.find(p => p.name === name)!.entries.push(entry); });
      return void respond(message, 'تمت الإضافة', `أضفت عنصرًا إلى **${name}**.`);
    }
    if (action === 'تشغيل') {
      const name = remainder;
      if (!name) return void respond(message, 'قائمتي', 'الاستخدام: `قائمتي تشغيل <اسم القائمة>`');
      const playlist = user.playlists.find(p => p.name === name);
      if (!playlist) return void respond(message, 'غير موجودة', `أنشئها أولًا: \`قائمتي إنشاء ${name}\``);
      if (!playlist.entries.length) return void respond(message, 'القائمة فارغة', 'أضف إليها عناصر أولًا.');
      try {
        let count = 0;
        for (const entry of playlist.entries) count += (await this.music.enqueue(message.member!, entry)).added;
        return void respond(message, '♪ بدأت قائمتك', `أضفت **${count}** مسارات من **${name}**.`);
      } catch (error) {
        return void respond(message, 'تعذر التشغيل', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
      }
    }
    return void respond(message, 'قائمتي', 'الأوامر: إنشاء، إضافة، تشغيل، عرض.\nللإضافة: `قائمتي إضافة <اسم القائمة> | <رابط أو بحث>`');
  }
                          }
