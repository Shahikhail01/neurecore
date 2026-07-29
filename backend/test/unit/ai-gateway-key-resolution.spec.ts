/**
 * Phase 2.8 — unit tests for the DB-prefer / env-fallback API key
 * resolution logic and the capability-heuristic.
 *
 * The key resolver is implemented inside `CapabilityResolver` and
 * `AiGatewayService.resolveApiKey`. We test both directly via the
 * dependency surface that callers use (PrismaService + CryptoService
 * doubles) so the test exercises the real precedence rule:
 *   1. decrypted DB key, if present
 *   2. env var, otherwise
 */

import { CryptoService } from '../../src/modules/connectors/services/crypto.service';
import { CapabilityResolver } from '../../src/modules/ai-gateway/selection/capability-resolver';
import { guessCapabilities } from '../../src/modules/ai-gateway/selection/capability-heuristic';

describe('AI Gateway key resolution (Phase 2.8)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('CryptoService round-trip', () => {
    it('encrypts and decrypts a DeepSeek-style API key', () => {
      const crypto = new CryptoService();
      const plain = 'sk-dpAbc1234567890XyZ9';
      const cipher = crypto.encrypt(plain);
      expect(cipher).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
      expect(crypto.decrypt(cipher)).toBe(plain);
    });

    it('produces a different ciphertext each call (random IV)', () => {
      const crypto = new CryptoService();
      const plain = 'sk-same-key';
      expect(crypto.encrypt(plain)).not.toBe(crypto.encrypt(plain));
    });

    it('throws on a malformed ciphertext', () => {
      const crypto = new CryptoService();
      expect(() => crypto.decrypt('not-a-valid-ciphertext')).toThrow();
    });
  });

  describe('CapabilityResolver DB-prefer precedence', () => {
    it('uses the decrypted DB key when present, ignoring env', async () => {
      const crypto = new CryptoService();
      const dbKey = 'sk-from-db-key';
      const encryptedDbKey = crypto.encrypt(dbKey);
      process.env['SOME_PROVIDER_API_KEY'] = 'sk-from-env-key';

      const prisma: any = {
        modelProvider: {
          findUnique: jest.fn().mockResolvedValue({ encryptedKey: encryptedDbKey }),
        },
      };
      const modelRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'm1',
          modelId: 'test-model',
          displayName: 'Test',
          contextWindow: 32000,
          costPer1kInput: 0,
          costPer1kOutput: 0,
        }),
      };
      const chainBuilder: any = {
        build: jest.fn().mockResolvedValue([
          {
            providerId: 'p1',
            providerSlug: 'some-provider',
            providerName: 'Some Provider',
            apiBaseUrl: 'https://example.com',
            apiKeyEnv: 'SOME_PROVIDER_API_KEY',
            aiModelId: 'm1',
            modelId: 'test-model',
            priorityHint: 10,
            reason: 'catalog',
          },
        ]),
      };
      const secrets: any = {
        resolve: jest.fn((ref: string) => ({
          value: ref === 'env:SOME_PROVIDER_API_KEY' ? 'sk-from-env-key' : '',
        })),
      };

      const resolver = new CapabilityResolver(
        chainBuilder,
        secrets,
        modelRepo,
        prisma,
        crypto,
      );

      const resolved = await resolver.resolve(null, 'conversation');
      expect(resolved.apiKey).toBe(dbKey);
      expect(prisma.modelProvider.findUnique).toHaveBeenCalledWith({
        where: { slug: 'some-provider' },
        select: { encryptedKey: true },
      });
    });

    it('falls back to env when DB has no encryptedKey', async () => {
      const crypto = new CryptoService();
      process.env['SOME_PROVIDER_API_KEY'] = 'sk-from-env-only';

      const prisma: any = {
        modelProvider: {
          findUnique: jest.fn().mockResolvedValue({ encryptedKey: null }),
        },
      };
      const modelRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'm1',
          modelId: 'test-model',
          displayName: 'Test',
          contextWindow: 32000,
          costPer1kInput: 0,
          costPer1kOutput: 0,
        }),
      };
      const chainBuilder: any = {
        build: jest.fn().mockResolvedValue([
          {
            providerId: 'p1',
            providerSlug: 'some-provider',
            providerName: 'Some Provider',
            apiBaseUrl: 'https://example.com',
            apiKeyEnv: 'SOME_PROVIDER_API_KEY',
            aiModelId: 'm1',
            modelId: 'test-model',
            priorityHint: 10,
            reason: 'catalog',
          },
        ]),
      };
      const secrets: any = {
        resolve: jest.fn((ref: string) => ({
          value: ref === 'env:SOME_PROVIDER_API_KEY' ? 'sk-from-env-only' : '',
        })),
      };

      const resolver = new CapabilityResolver(
        chainBuilder,
        secrets,
        modelRepo,
        prisma,
        crypto,
      );

      const resolved = await resolver.resolve(null, 'conversation');
      expect(resolved.apiKey).toBe('sk-from-env-only');
    });

    it('falls back to env when DB decryption fails (bad key/version)', async () => {
      const crypto = new CryptoService();
      process.env['SOME_PROVIDER_API_KEY'] = 'sk-from-env';

      const prisma: any = {
        modelProvider: {
          // Simulate a row whose encryptedKey is from a different key
          // version and therefore can't decrypt.
          findUnique: jest.fn().mockResolvedValue({
            encryptedKey: 'deadbeef:deadbeef:deadbeef',
          }),
        },
      };
      const modelRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'm1',
          modelId: 'test-model',
          displayName: 'Test',
          contextWindow: 32000,
          costPer1kInput: 0,
          costPer1kOutput: 0,
        }),
      };
      const chainBuilder: any = {
        build: jest.fn().mockResolvedValue([
          {
            providerId: 'p1',
            providerSlug: 'some-provider',
            providerName: 'Some Provider',
            apiBaseUrl: 'https://example.com',
            apiKeyEnv: 'SOME_PROVIDER_API_KEY',
            aiModelId: 'm1',
            modelId: 'test-model',
            priorityHint: 10,
            reason: 'catalog',
          },
        ]),
      };
      const secrets: any = {
        resolve: jest.fn((ref: string) => ({
          value: ref === 'env:SOME_PROVIDER_API_KEY' ? 'sk-from-env' : '',
        })),
      };

      const resolver = new CapabilityResolver(
        chainBuilder,
        secrets,
        modelRepo,
        prisma,
        crypto,
      );

      const resolved = await resolver.resolve(null, 'conversation');
      expect(resolved.apiKey).toBe('sk-from-env');
    });
  });

  describe('guessCapabilities heuristic', () => {
    it.each([
      ['text-embedding-3-small', ['embedding']],
      ['deepseek-chat', ['conversation', 'planning', 'execution', 'evaluation', 'tools']],
      ['deepseek-reasoner', ['reasoning', 'planning', 'evaluation']],
      ['deepseek-coder', ['coding', 'tools']],
      ['gpt-4o', ['conversation', 'planning', 'execution', 'evaluation', 'tools']],
      ['o1-preview', ['reasoning', 'planning', 'evaluation']],
    ])('%s → %p', (modelId, expected) => {
      expect(guessCapabilities(modelId)).toEqual(expected);
    });
  });
});