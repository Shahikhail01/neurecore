/**
 * project-types.service.spec.ts — Phase 2 unit tests
 *
 * Covers:
 *  - validateCustomFields for every field type (TEXT/NUMBER/DATE/SELECT/MULTI_SELECT)
 *  - Required field enforcement
 *  - Optional field handling
 *  - Edge cases (empty schema, null values, etc.)
 */

import { BadRequestException } from '@nestjs/common';
import { ProjectTypesService } from './project-types.service';
import type { IProjectTypeRepository } from './interfaces/project-type.interface';
import type {
  ProjectType,
  ProjectTypeVersion,
  FieldSchemaItem,
} from './interfaces/project-type.interface';

const REPO_TOKEN = Symbol('REPO');

function makeService(): { service: ProjectTypesService; repo: jest.Mocked<IProjectTypeRepository> } {
  const repo: jest.Mocked<IProjectTypeRepository> = {
    createType: jest.fn(),
    findTypeById: jest.fn(),
    findAllTypes: jest.fn(),
    updateType: jest.fn(),
    deleteType: jest.fn(),
    createVersion: jest.fn(),
    getCurrentVersion: jest.fn(),
    findVersionsByTypeId: jest.fn(),
    findVersionById: jest.fn(),
  } as unknown as jest.Mocked<IProjectTypeRepository>;
  const service = new ProjectTypesService(repo);
  return { service, repo };
}

describe('ProjectTypesService', () => {
  describe('validateCustomFields', () => {
    const textField: FieldSchemaItem = { key: 'notes', label: 'Notes', type: 'TEXT' };
    const numberField: FieldSchemaItem = { key: 'qty', label: 'Quantity', type: 'NUMBER' };
    const dateField: FieldSchemaItem = { key: 'due', label: 'Due Date', type: 'DATE' };
    const selectField: FieldSchemaItem = {
      key: 'status',
      label: 'Status',
      type: 'SELECT',
      options: ['A', 'B', 'C'],
    };
    const multiField: FieldSchemaItem = {
      key: 'tags',
      label: 'Tags',
      type: 'MULTI_SELECT',
      options: ['x', 'y', 'z'],
    };
    const requiredField: FieldSchemaItem = {
      key: 'required_text',
      label: 'Required Text',
      type: 'TEXT',
      required: true,
    };
    const requiredNumber: FieldSchemaItem = {
      key: 'required_num',
      label: 'Required Number',
      type: 'NUMBER',
      required: true,
    };

    let service: ProjectTypesService;

    beforeEach(() => {
      ({ service } = makeService());
    });

    it('passes when fieldSchema is empty', () => {
      expect(() => service.validateCustomFields([], { anything: 'goes' })).not.toThrow();
      expect(() => service.validateCustomFields([] as FieldSchemaItem[], null)).not.toThrow();
    });

    it('passes when all values match schema', () => {
      const schema = [textField, numberField, dateField, selectField, multiField];
      const values = {
        notes: 'hello',
        qty: 42,
        due: '2026-12-31',
        status: 'A',
        tags: ['x', 'y'],
      };
      expect(() => service.validateCustomFields(schema, values)).not.toThrow();
    });

    it('throws when customFieldValues is null but a required field exists', () => {
      expect(() => service.validateCustomFields([requiredField], null)).toThrow(BadRequestException);
    });

    it('passes when values are missing for optional fields', () => {
      expect(() => service.validateCustomFields([textField, numberField], {})).not.toThrow();
    });

    it('throws when required field is empty string', () => {
      expect(() =>
        service.validateCustomFields([requiredField], { required_text: '' }),
      ).toThrow(BadRequestException);
    });

    it('throws when required field is null', () => {
      expect(() =>
        service.validateCustomFields([requiredField], { required_text: null }),
      ).toThrow(BadRequestException);
    });

    it('throws when required field is undefined', () => {
      expect(() =>
        service.validateCustomFields([requiredField], { other: 'value' }),
      ).toThrow(BadRequestException);
    });

    it('throws when NUMBER field has non-numeric value', () => {
      expect(() =>
        service.validateCustomFields([numberField], { qty: 'not a number' }),
      ).toThrow(/must be a number/);
    });

    it('accepts a numeric NUMBER field', () => {
      expect(() =>
        service.validateCustomFields([numberField], { qty: 0 }),
      ).not.toThrow();
      expect(() =>
        service.validateCustomFields([numberField], { qty: -3.14 }),
      ).not.toThrow();
    });

    it('throws when DATE field is unparseable', () => {
      expect(() =>
        service.validateCustomFields([dateField], { due: 'not-a-date' }),
      ).toThrow(/must be a valid date/);
    });

    it('accepts ISO DATE field', () => {
      expect(() =>
        service.validateCustomFields([dateField], { due: '2026-01-15' }),
      ).not.toThrow();
    });

    it('throws when SELECT field value is not in options', () => {
      expect(() =>
        service.validateCustomFields([selectField], { status: 'D' }),
      ).toThrow(/must be one of/);
    });

    it('accepts a valid SELECT value', () => {
      expect(() =>
        service.validateCustomFields([selectField], { status: 'B' }),
      ).not.toThrow();
    });

    it('throws when MULTI_SELECT is not an array', () => {
      expect(() =>
        service.validateCustomFields([multiField], { tags: 'x' }),
      ).toThrow(/must be an array/);
    });

    it('throws when MULTI_SELECT contains an invalid value', () => {
      expect(() =>
        service.validateCustomFields([multiField], { tags: ['x', 'w'] }),
      ).toThrow(/contains invalid values/);
    });

    it('accepts a valid MULTI_SELECT value', () => {
      expect(() =>
        service.validateCustomFields([multiField], { tags: ['x', 'y', 'z'] }),
      ).not.toThrow();
    });

    it('collects all required-number validations in one pass', () => {
      expect(() =>
        service.validateCustomFields(
          [requiredNumber, requiredField],
          { required_num: 5, required_text: 'ok' },
        ),
      ).not.toThrow();
    });
  });

  describe('createVersion', () => {
    it('throws NotFoundException when type does not exist', async () => {
      const { service, repo } = makeService();
      repo.findTypeById.mockResolvedValue(null);

      await expect(
        service.createVersion('pt_x', 'tenant_1', { fieldSchema: [], stageTemplate: [] }),
      ).rejects.toThrow(/not found/);
    });

    it('creates a version when type exists', async () => {
      const { service, repo } = makeService();
      const pt: ProjectType = {
        id: 'pt_1',
        tenantId: 'tenant_1',
        slug: 'tax-return',
        name: 'Tax Return',
        industry: 'accounting',
        isSystem: false,
        classification: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const version: ProjectTypeVersion = {
        id: 'v_1',
        projectTypeId: 'pt_1',
        version: 1,
        fieldSchema: [],
        stageTemplate: [],
        approvalTemplate: [],
        goalTemplate: null,
        roleTemplate: null,
        informationRequirements: [],
        createdAt: new Date(),
      };
      repo.findTypeById.mockResolvedValue(pt);
      repo.createVersion.mockResolvedValue(version);

      const result = await service.createVersion('pt_1', 'tenant_1', {
        fieldSchema: [],
        stageTemplate: [],
        approvalTemplate: [],
      });
      expect(result).toEqual(version);
      expect(repo.createVersion).toHaveBeenCalledWith('pt_1', expect.objectContaining({
        fieldSchema: [],
      }));
    });
  });
});
