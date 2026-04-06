import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  async sendMessage(botToken: string, chatId: string, text: string) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        this.logger.error(`Telegram API error: ${resp.status} ${body}`);
        throw new Error(`Telegram API error ${resp.status}`);
      }
      this.logger.log(`Telegram message sent to ${chatId}`);
      return true;
    } catch (err) {
      this.logger.error('Failed to send telegram message', err as any);
      throw err;
    }
  }
}
