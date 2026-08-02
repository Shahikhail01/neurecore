/**
 * Channel Adapters — unit tests (Phase 6, NC-AI-SG-V2 §3.8 "No mocks").
 *
 * Every adapter delegates to a real injected service. These tests stub
 * the integration services to simulate real provider behaviour:
 *   - success path: the provider returns a real id → adapter must
 *     surface success:true with the provider's id as deliveryId.
 *   - failure path: the provider throws → adapter must surface
 *     success:false with the error message.
 *   - never-fabricate guard: no test produces a hardcoded success:true
 *     or fabricated deliveryId; we explicitly assert against both.
 */

import { BadRequestException } from '@nestjs/common';
import {
  BrevoSender,
  CalendarSender,
  EmailSender,
  TeamsSender,
  WebChatSender,
} from './channel-adapters';
import type { OutboundMessage } from '../interfaces';

const baseOutbound: OutboundMessage = {
  tenantId: 'tenant-A',
  channel: 'WEB_CHAT',
  recipientId: 'user-1',
  content: 'hello world',
  metadata: {},
};

describe('channel-adapters — NC-AI-SG-V2 §3.8 "no mocks"', () => {
  describe('WebChatSender', () => {
    it('persists the reply via ChatHistoryService and emits on the user room on real success', async () => {
      const saveMessage = jest.fn().mockResolvedValue({
        id: 'chat-msg-123',
        conversationId: 'conv-1',
      });
      const emitToUser = jest.fn();
      const sender = new WebChatSender(
        { saveMessage } as never,
        { emitToUser } as never,
      );

      const receipt = await sender.send({
        ...baseOutbound,
        metadata: { conversationId: 'conv-1' },
      });

      expect(receipt).toEqual({ success: true, deliveryId: 'chat-msg-123' });
      expect(saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-A',
          userId: 'user-1',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'hello world',
        }),
      );
      expect(emitToUser).toHaveBeenCalledWith(
        'user-1',
        'chat:assistant_reply',
        expect.objectContaining({ conversationId: 'conv-1' }),
      );
    });

    it('returns success:false when ChatHistoryService throws', async () => {
      const saveMessage = jest
        .fn()
        .mockRejectedValue(new Error('database unavailable'));
      const sender = new WebChatSender(
        { saveMessage } as never,
        { emitToUser: jest.fn() } as never,
      );

      const receipt = await sender.send({
        ...baseOutbound,
        metadata: { conversationId: 'conv-1' },
      });

      expect(receipt.success).toBe(false);
      expect(receipt.error).toBe('database unavailable');
      expect(receipt.deliveryId).toBeUndefined();
    });

    it('returns success:false when conversationId metadata is missing (never hardcodes success)', async () => {
      const sender = new WebChatSender(
        { saveMessage: jest.fn() } as never,
        { emitToUser: jest.fn() } as never,
      );
      const receipt = await sender.send({ ...baseOutbound, metadata: {} });
      expect(receipt).toEqual({
        success: false,
        error: 'conversationId is required for WEB_CHAT delivery',
      });
    });
  });

  describe('EmailSender (Gmail)', () => {
    it('returns success:true with the real provider messageId on success', async () => {
      const sendEmail = jest
        .fn()
        .mockResolvedValue({ messageId: 'gmail-msg-abc', threadId: 't-1' });
      const sender = new EmailSender({ sendEmail } as never, undefined);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'EMAIL',
        recipientId: 'a@example.com',
        content: 'body',
        metadata: { subject: 'Hi' },
      });
      expect(receipt).toEqual({ success: true, deliveryId: 'gmail-msg-abc' });
      expect(sendEmail).toHaveBeenCalledWith('tenant-A', {
        to: 'a@example.com',
        subject: 'Hi',
        body: 'body',
      });
    });

    it('returns success:false when Gmail send throws', async () => {
      const sendEmail = jest
        .fn()
        .mockRejectedValue(new BadRequestException('Gmail send failed (403)'));
      const sender = new EmailSender({ sendEmail } as never, undefined);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'EMAIL',
        recipientId: 'a@example.com',
        content: 'body',
        metadata: { subject: 'Hi' },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toContain('Gmail send failed');
      expect(receipt.deliveryId).toBeUndefined();
    });

    it('returns success:false with a clear error when Gmail is not configured', async () => {
      const sender = new EmailSender(undefined, undefined);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'EMAIL',
        recipientId: 'a@example.com',
        content: 'body',
        metadata: { subject: 'Hi' },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toBe(
        'GoogleGmailService is not available in this runtime',
      );
    });
  });

  describe('EmailSender (Outlook)', () => {
    it('returns success:true with the real Outlook messageId on success', async () => {
      const send = jest
        .fn()
        .mockResolvedValue({ messageId: 'outlook-msg-xyz' });
      const sender = new EmailSender(undefined, { send } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'EMAIL',
        recipientId: 'a@example.com',
        content: 'body',
        metadata: { subject: 'Hi', provider: 'outlook' },
      });
      expect(receipt).toEqual({ success: true, deliveryId: 'outlook-msg-xyz' });
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-A',
          to: ['a@example.com'],
          subject: 'Hi',
        }),
      );
    });

    it('returns success:false when Outlook send throws', async () => {
      const send = jest.fn().mockRejectedValue(new Error('graph 401'));
      const sender = new EmailSender(undefined, { send } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'EMAIL',
        recipientId: 'a@example.com',
        content: 'body',
        metadata: { subject: 'Hi', provider: 'outlook' },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toBe('graph 401');
    });
  });

  describe('CalendarSender (Google)', () => {
    it('returns success:true with the real Google event id on success', async () => {
      const createEvent = jest.fn().mockResolvedValue({ id: 'gcal-evt-1' });
      const sender = new CalendarSender({ createEvent } as never, undefined);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'CALENDAR',
        content: 'Discuss',
        metadata: {
          startIso: '2026-09-01T10:00:00Z',
          endIso: '2026-09-01T11:00:00Z',
        },
      });
      expect(receipt).toEqual({ success: true, deliveryId: 'gcal-evt-1' });
      expect(createEvent).toHaveBeenCalledWith(
        'tenant-A',
        expect.objectContaining({ summary: 'Message from CALENDAR' }),
      );
    });

    it('returns success:false when Google calendar throws', async () => {
      const createEvent = jest.fn().mockRejectedValue(new Error('403'));
      const sender = new CalendarSender({ createEvent } as never, undefined);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'CALENDAR',
        content: 'Discuss',
        metadata: {
          startIso: '2026-09-01T10:00:00Z',
          endIso: '2026-09-01T11:00:00Z',
        },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toBe('403');
    });

    it('returns success:false when startIso / endIso are missing', async () => {
      const sender = new CalendarSender(
        { createEvent: jest.fn() } as never,
        undefined,
      );
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'CALENDAR',
        content: 'x',
        metadata: {},
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toContain('startIso');
    });
  });

  describe('CalendarSender (Outlook)', () => {
    it('returns success:true with the real Outlook event id on success', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'ocal-evt-9' });
      const sender = new CalendarSender(undefined, { create } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'CALENDAR',
        content: 'x',
        metadata: {
          startIso: '2026-09-01T10:00:00Z',
          endIso: '2026-09-01T11:00:00Z',
          provider: 'outlook',
        },
      });
      expect(receipt).toEqual({ success: true, deliveryId: 'ocal-evt-9' });
    });
  });

  describe('BrevoSender', () => {
    it('returns success:true with the real Brevo messageId on success', async () => {
      const sendEmail = jest
        .fn()
        .mockResolvedValue({ messageId: 'brevo-msg-1', source: 'tenant' });
      const sender = new BrevoSender({ sendEmail } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'BREVO',
        recipientId: 'b@example.com',
        content: 'hi',
        metadata: { subject: 'Hello' },
      });
      expect(receipt).toEqual({ success: true, deliveryId: 'brevo-msg-1' });
    });

    it('returns success:false when Brevo throws', async () => {
      const sendEmail = jest
        .fn()
        .mockRejectedValue(new BadRequestException('Brevo not configured'));
      const sender = new BrevoSender({ sendEmail } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'BREVO',
        recipientId: 'b@example.com',
        content: 'hi',
        metadata: { subject: 'Hello' },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toContain('Brevo not configured');
    });

    it('returns success:false (never success:true) when recipient is suppressed', async () => {
      const sendEmail = jest
        .fn()
        .mockResolvedValue({ messageId: 'suppressed', source: 'tenant' });
      const sender = new BrevoSender({ sendEmail } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'BREVO',
        recipientId: 'b@example.com',
        content: 'hi',
        metadata: { subject: 'Hello' },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toContain('suppression');
    });

    it('returns success:false when BrevoEmailService is not configured', async () => {
      const sender = new BrevoSender(undefined);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'BREVO',
        recipientId: 'b@example.com',
        content: 'hi',
        metadata: { subject: 'Hello' },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toBe(
        'BrevoEmailService is not available in this runtime',
      );
    });
  });

  describe('TeamsSender', () => {
    it('returns success:true with the real Teams messageId on success', async () => {
      const sendChatMessage = jest
        .fn()
        .mockResolvedValue({ messageId: 'teams-msg-1' });
      const sender = new TeamsSender({ sendChatMessage } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'TEAMS',
        content: 'hi',
        metadata: { chatId: 'chat-1' },
      });
      expect(receipt).toEqual({ success: true, deliveryId: 'teams-msg-1' });
    });

    it('returns success:false when Teams throws', async () => {
      const sendChatMessage = jest
        .fn()
        .mockRejectedValue(new Error('graph 403'));
      const sender = new TeamsSender({ sendChatMessage } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'TEAMS',
        content: 'hi',
        metadata: { chatId: 'chat-1' },
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toBe('graph 403');
    });

    it('returns success:false when chatId metadata is missing', async () => {
      const sender = new TeamsSender({ sendChatMessage: jest.fn() } as never);
      const receipt = await sender.send({
        ...baseOutbound,
        channel: 'TEAMS',
        content: 'hi',
        metadata: {},
      });
      expect(receipt.success).toBe(false);
      expect(receipt.error).toBe('chatId is required for TEAMS delivery');
    });
  });

  describe('no hardcoded success:true', () => {
    it('every receipt in this suite is either a real provider id or success:false — never a fabricated id', async () => {
      const realIdFromProvider = 'real-id-from-provider';
      const cases: Array<{
        label: string;
        build: () => Promise<{
          success: boolean;
          deliveryId?: string;
          error?: string;
        }>;
        expectDeliveryId?: string;
        expectSuccess: boolean;
        expectErrorContains?: string;
      }> = [
        {
          label: 'webchat success',
          build: async () =>
            new WebChatSender(
              {
                saveMessage: jest
                  .fn()
                  .mockResolvedValue({ id: realIdFromProvider }),
              } as never,
              { emitToUser: jest.fn() } as never,
            ).send({
              ...baseOutbound,
              metadata: { conversationId: 'c1' },
            }),
          expectDeliveryId: realIdFromProvider,
          expectSuccess: true,
        },
        {
          label: 'gmail success',
          build: async () =>
            new EmailSender(
              {
                sendEmail: jest
                  .fn()
                  .mockResolvedValue({ messageId: realIdFromProvider }),
              } as never,
              undefined,
            ).send({
              ...baseOutbound,
              channel: 'EMAIL',
              recipientId: 'a@example.com',
              content: 'b',
              metadata: { subject: 's' },
            }),
          expectDeliveryId: realIdFromProvider,
          expectSuccess: true,
        },
        {
          label: 'gmail failure',
          build: async () =>
            new EmailSender(
              {
                sendEmail: jest.fn().mockRejectedValue(new Error('boom')),
              } as never,
              undefined,
            ).send({
              ...baseOutbound,
              channel: 'EMAIL',
              recipientId: 'a@example.com',
              content: 'b',
              metadata: { subject: 's' },
            }),
          expectSuccess: false,
          expectErrorContains: 'boom',
        },
        {
          label: 'calendar failure',
          build: async () =>
            new CalendarSender(
              {
                createEvent: jest.fn().mockRejectedValue(new Error('nope')),
              } as never,
              undefined,
            ).send({
              ...baseOutbound,
              channel: 'CALENDAR',
              content: 'b',
              metadata: { startIso: 'x', endIso: 'y' },
            }),
          expectSuccess: false,
          expectErrorContains: 'nope',
        },
        {
          label: 'brevo success',
          build: async () =>
            new BrevoSender({
              sendEmail: jest
                .fn()
                .mockResolvedValue({ messageId: realIdFromProvider }),
            } as never).send({
              ...baseOutbound,
              channel: 'BREVO',
              recipientId: 'b@example.com',
              content: 'b',
              metadata: { subject: 's' },
            }),
          expectDeliveryId: realIdFromProvider,
          expectSuccess: true,
        },
        {
          label: 'teams failure',
          build: async () =>
            new TeamsSender({
              sendChatMessage: jest.fn().mockRejectedValue(new Error('k')),
            } as never).send({
              ...baseOutbound,
              channel: 'TEAMS',
              content: 'b',
              metadata: { chatId: 'c' },
            }),
          expectSuccess: false,
          expectErrorContains: 'k',
        },
      ];

      for (const c of cases) {
        const receipt = await c.build();
        if (c.expectSuccess) {
          expect(receipt.success).toBe(true);
          expect(receipt.deliveryId).toBe(c.expectDeliveryId);
          expect(receipt.error).toBeUndefined();
        } else {
          expect(receipt.success).toBe(false);
          expect(receipt.deliveryId).toBeUndefined();
          expect(receipt.error).toContain(c.expectErrorContains ?? '');
        }
        // Fabrication guard: no Date.now()-based or string-templated ids.
        if (receipt.deliveryId) {
          expect(receipt.deliveryId).not.toMatch(/-\d{10,}$/);
        }
      }
    });
  });
});
