import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateSsoConfigDto } from '../dto/sso.dto';

@Injectable()
export class SsoConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(tenantId: string) {
    return this.prisma.ssoConfig.findUnique({ where: { tenantId } });
  }

  async upsertConfig(tenantId: string, dto: CreateSsoConfigDto) {
    return this.prisma.ssoConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: dto.provider as any,
        entryPoint: dto.entryPoint,
        issuer: dto.issuer,
        cert: dto.cert ?? null,
        clientId: dto.clientId ?? null,
        isEnabled: dto.isEnabled ?? false,
      },
      update: {
        provider: dto.provider as any,
        entryPoint: dto.entryPoint,
        issuer: dto.issuer,
        cert: dto.cert ?? null,
        clientId: dto.clientId ?? null,
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      },
    });
  }

  async toggleEnabled(tenantId: string, enable: boolean) {
    const existing = await this.prisma.ssoConfig.findUnique({
      where: { tenantId },
    });
    if (!existing) {
      throw new NotFoundException('SSO config not found for tenant');
    }
    return this.prisma.ssoConfig.update({
      where: { tenantId },
      data: { isEnabled: enable },
    });
  }

  /** Returns a minimal SAML Service Provider metadata stub */
  getSamlMetadataXml(tenantId: string): string {
    return `<?xml version="1.0"?>
<EntityDescriptor
  xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="neurecore:sp:${tenantId}">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="https://api.neurecore.com/v1/auth/sso/callback"
      index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }
}
