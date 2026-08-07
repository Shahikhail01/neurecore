import {
  SlackAdapterService,
  SlackOutOfScopeError,
  isSlackInScope,
} from './slack-adapter.service';

describe('Phase 20 — SlackAdapterService (CR-AI-1105)', () => {
  let svc: SlackAdapterService;

  beforeEach(() => {
    svc = new SlackAdapterService();
    SlackAdapterService.markOutOfScope();
  });

  it('isSlackInScope reports OUT_OF_SCOPE by default', () => {
    expect(isSlackInScope()).toBe(false);
  });

  it('listChannels refuses wildcard tenantId', async () => {
    await expect(svc.listChannels('*')).rejects.toBeInstanceOf(SlackOutOfScopeError);
  });

  it('listChannels throws SlackOutOfScopeError when OUT_OF_SCOPE', async () => {
    await expect(svc.listChannels('tenant-A')).rejects.toBeInstanceOf(SlackOutOfScopeError);
  });

  it('sendMessage throws SlackOutOfScopeError when OUT_OF_SCOPE', async () => {
    await expect(
      svc.sendMessage({
        tenantId: 'tenant-A',
        channel: {
          teamId: 'T1',
          channelId: 'C1',
          channelName: 'general',
          isPrivate: false,
        },
        author: {
          userId: 'U1',
          teamId: 'T1',
          displayName: 'Alice',
        },
        text: 'hi',
        idempotencyKey: 'k-1',
      }),
    ).rejects.toBeInstanceOf(SlackOutOfScopeError);
  });

  it('sendMessage refuses wildcard tenantId even when IN_SCOPE', async () => {
    SlackAdapterService.markInScope();
    await expect(
      svc.sendMessage({
        tenantId: '*',
        channel: {
          teamId: 'T1',
          channelId: 'C1',
          channelName: 'general',
          isPrivate: false,
        },
        author: {
          userId: 'U1',
          teamId: 'T1',
          displayName: 'Alice',
        },
        text: 'hi',
        idempotencyKey: 'k-1',
      }),
    ).rejects.toBeInstanceOf(SlackOutOfScopeError);
  });

  it('sendMessage returns a stub messageId when IN_SCOPE', async () => {
    SlackAdapterService.markInScope();
    const out = await svc.sendMessage({
      tenantId: 'tenant-A',
      channel: {
        teamId: 'T1',
        channelId: 'C1',
        channelName: 'general',
        isPrivate: false,
      },
      author: {
        userId: 'U1',
        teamId: 'T1',
        displayName: 'Alice',
      },
      text: 'hi',
      idempotencyKey: 'k-1',
    });
    expect(out.messageId).toBe('slack-stub');
  });
});
