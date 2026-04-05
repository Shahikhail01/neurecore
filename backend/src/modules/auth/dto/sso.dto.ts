import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
} from 'class-validator';

export enum SsoProviderDto {
  SAML = 'SAML',
  OIDC = 'OIDC',
}

export class CreateSsoConfigDto {
  @IsEnum(SsoProviderDto)
  provider!: SsoProviderDto;

  /** SAML — Identity Provider SSO URL / OIDC — authorization endpoint */
  @IsUrl()
  entryPoint!: string;

  /** SAML — Issuer / OIDC — client ID */
  @IsString()
  issuer!: string;

  /** SAML — IdP X.509 certificate (PEM) / OIDC — leave empty */
  @IsOptional()
  @IsString()
  cert?: string;

  /** OIDC only — client ID */
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
