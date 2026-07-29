/**
 * Customer DTO validation tests — regression for the
 * "modal opens but submit does nothing" bug.
 *
 * The form's create payload can include empty strings for the optional
 * Phase 4 F&C enum fields (e.g. when a user clears a <select>). Before
 * `EmptyToUndefined` was added to the DTO, those `""` values were
 * rejected by `IsIn` and the whole POST 400'd, leaving the modal in a
 * confusing "I clicked submit but nothing happened" state.
 *
 * These tests pin down the contract:
 *   - empty / whitespace-only strings for enum fields → undefined
 *   - valid enum values → pass through
 *   - missing fields → undefined (optional)
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCustomerDto, UpdateCustomerDto } from '../dto/customer.dto';

async function validateCreate(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateCustomerDto, payload);
  const errors = await validate(dto as object);
  return errors;
}

async function validateUpdate(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCustomerDto, payload);
  const errors = await validate(dto as object);
  return errors;
}

describe('CreateCustomerDto — EmptyToUndefined normalisation', () => {
  it('accepts a minimal payload (name only)', async () => {
    const errors = await validateCreate({ name: 'Acme Bank' });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty name', async () => {
    const errors = await validateCreate({ name: '' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('coerces empty-string enums to undefined so IsIn does not 400', async () => {
    const errors = await validateCreate({
      name: 'Acme Bank',
      kycStatus: '',
      riskRating: '   ',
      financialSubType: '',
      lifecycleStage: '',
    });
    expect(errors).toHaveLength(0);
  });

  it('coerces empty taxId to undefined', async () => {
    const errors = await validateCreate({
      name: 'Acme Bank',
      taxId: '   ',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts valid F&C enum values', async () => {
    const errors = await validateCreate({
      name: 'Acme Bank',
      kycStatus: 'VERIFIED',
      riskRating: 'HIGH',
      financialSubType: 'BANKING',
      lifecycleStage: 'ACTIVE',
      taxId: '12-3456789',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid enum values', async () => {
    const errors = await validateCreate({
      name: 'Acme Bank',
      kycStatus: 'WHATEVER',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'kycStatus')).toBe(true);
  });

  it('accepts the optional email field as empty string (normalised)', async () => {
    const errors = await validateCreate({
      name: 'Acme Bank',
      primaryEmail: '',
    });
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateCustomerDto — EmptyToUndefined normalisation', () => {
  it('accepts an empty patch (all fields optional)', async () => {
    const errors = await validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('coerces empty-string enums on update too', async () => {
    const errors = await validateUpdate({
      kycStatus: '',
      riskRating: '',
      financialSubType: '',
      lifecycleStage: '',
      taxId: '',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid status', async () => {
    const errors = await validateUpdate({ status: 'DELETED' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});