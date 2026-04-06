import { Controller, Post, Body } from '@nestjs/common';
import { TelegramService } from './services/telegram.service';

@Controller({ path: 'integrations/telegram', version: '1' })
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('send-test')
  async sendTest(@Body() body: { botToken?: string; chatId: string; text?: string }) {
    const bot = body.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
    if (!bot) throw new Error('Missing bot token');
    const text = body.text ?? 'NeureCore test message';
    const res = await this.telegramService.sendMessage(bot, body.chatId, text);
    return { ok: !!res };
  }
}
