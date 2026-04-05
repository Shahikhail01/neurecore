/**
 * UpdateProvisioningConfigDto
 * Validates the body for PUT /workspace-provisioning/configure.
 * Allows tenants to create or update their provisioning config at any time —
 * not only via the onboarding wizard.
 */
import { IsEnum, IsString, IsNotEmpty, Matches } from 'class-validator';

const PROVIDERS = ['GOOGLE_WORKSPACE', 'MICROSOFT_365'] as const;
const EMAIL_PATTERNS = ['FIRST_DOT_LAST', 'FIRSTLAST', 'F_DOT_LAST'] as const;
const FOLDER_STRUCTURES = ['BY_DEPARTMENT', 'FLAT'] as const;

export type ProviderValue = (typeof PROVIDERS)[number];
export type EmailPatternValue = (typeof EMAIL_PATTERNS)[number];
export type FolderStructureValue = (typeof FOLDER_STRUCTURES)[number];

export class UpdateProvisioningConfigDto {
  @IsEnum(PROVIDERS, {
    message: 'provider must be GOOGLE_WORKSPACE or MICROSOFT_365',
  })
  provider!: ProviderValue;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/, {
    message: 'emailDomain must be a valid domain (e.g. company.com)',
  })
  emailDomain!: string;

  @IsEnum(EMAIL_PATTERNS, {
    message: 'emailPattern must be FIRST_DOT_LAST, FIRSTLAST, or F_DOT_LAST',
  })
  emailPattern!: EmailPatternValue;

  @IsEnum(FOLDER_STRUCTURES, {
    message: 'folderStructure must be BY_DEPARTMENT or FLAT',
  })
  folderStructure!: FolderStructureValue;
}
