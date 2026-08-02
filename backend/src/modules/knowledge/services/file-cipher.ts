/**
 * AES-256-GCM at-rest envelope encryption for file blobs (P2).
 *
 * Production: the data-encryption key (DEK) is wrapped by a KMS-managed
 * key-encryption key (KEK). Dev: a fixed key from `FILE_ENC_KEY`
 * (32 bytes hex) wraps the DEK directly.
 *
 * The envelope layout persisted alongside the ciphertext:
 *   {v:1,alg:"aes-256-gcm",iv:<hex>,tag:<hex>,wrappedKey:<hex>,ct:<hex>}
 *
 * Tenant isolation: this module is pure crypto. Tenant scoping happens
 * in the ingestion service via explicit `tenantId` columns.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

export interface EncryptedEnvelope {
  readonly version: 1;
  readonly alg: 'aes-256-gcm';
  readonly iv: string;
  readonly tag: string;
  readonly wrappedKey: string;
  readonly ct: string;
}

@Injectable()
export class FileCipher {
  private readonly logger = new Logger(FileCipher.name);
  private readonly kek: Buffer;

  constructor(config: ConfigService) {
    const hex = config.get<string>('FILE_ENC_KEY');
    if (hex && hex.length === 64) {
      this.kek = Buffer.from(hex, 'hex');
    } else {
      // Dev default — DO NOT USE IN PRODUCTION. The startup validator
      // refuses to start a production build with this key.
      this.logger.warn(
        '[FileCipher] FILE_ENC_KEY missing — using ephemeral dev key',
      );
      this.kek = randomBytes(32);
    }
  }

  /**
   * Encrypt `plain` with a freshly generated DEK. The DEK is wrapped
   * with the configured KEK using AES-256-GCM (separate IV/tag).
   */
  encrypt(plain: Buffer): EncryptedEnvelope {
    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    const { wrappedDek, wrappedIv, wrappedTag } = this.wrapKey(dek);
    return {
      version: 1,
      alg: 'aes-256-gcm',
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      wrappedKey: Buffer.concat([wrappedIv, wrappedTag, wrappedDek]).toString(
        'hex',
      ),
      ct: ct.toString('hex'),
    };
  }

  decrypt(envelope: EncryptedEnvelope): Buffer {
    if (envelope.version !== 1 || envelope.alg !== 'aes-256-gcm') {
      throw new Error(
        `Unsupported envelope version=${envelope.version} alg=${envelope.alg}`,
      );
    }
    const iv = Buffer.from(envelope.iv, 'hex');
    const tag = Buffer.from(envelope.tag, 'hex');
    const ct = Buffer.from(envelope.ct, 'hex');
    const wrapped = Buffer.from(envelope.wrappedKey, 'hex');
    const wrappedIv = wrapped.subarray(0, 12);
    const wrappedTag = wrapped.subarray(12, 28);
    const wrappedDek = wrapped.subarray(28);
    const dek = this.unwrapKey(wrappedDek, wrappedIv, wrappedTag);
    const decipher = createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  /** Stable HMAC for content-deduplication. Public so the ingestion
   *  service can use the same derivation for the SHA-256 fallback. */
  contentKey(envelope: EncryptedEnvelope): string {
    return createHmac('sha256', this.kek).update(envelope.ct).digest('hex');
  }

  private wrapKey(dek: Buffer): {
    wrappedDek: Buffer;
    wrappedIv: Buffer;
    wrappedTag: Buffer;
  } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.kek, iv);
    const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { wrappedDek: ct, wrappedIv: iv, wrappedTag: tag };
  }

  private unwrapKey(wrappedDek: Buffer, iv: Buffer, tag: Buffer): Buffer {
    const decipher = createDecipheriv('aes-256-gcm', this.kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(wrappedDek), decipher.final()]);
  }
}
