// ─── validators.ts ────────────────────────────────────────────────────────────
// Pure validation utilities — no side effects, no imports from services.
// SRP: All input validation centralised here.

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const OK: ValidationResult = { valid: true };
const fail = (message: string): ValidationResult => ({ valid: false, message });

// ─── Field validators ─────────────────────────────────────────────────────────

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) return fail('Email is required.');
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return fail('Please enter a valid email address.');
  return OK;
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return fail('Password is required.');
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) return fail('Include at least one uppercase letter.');
  if (!/[0-9]/.test(password)) return fail('Include at least one number.');
  return OK;
}

export function validateRequired(value: string, fieldName = 'This field'): ValidationResult {
  if (!value.trim()) return fail(`${fieldName} is required.`);
  return OK;
}

export function validateMinLength(value: string, min: number, fieldName = 'Field'): ValidationResult {
  if (value.trim().length < min) return fail(`${fieldName} must be at least ${min} characters.`);
  return OK;
}

export function validateMaxLength(value: string, max: number, fieldName = 'Field'): ValidationResult {
  if (value.length > max) return fail(`${fieldName} must not exceed ${max} characters.`);
  return OK;
}

export function validateUrl(url: string): ValidationResult {
  if (!url.trim()) return OK; // optional fields
  try {
    new URL(url);
    return OK;
  } catch {
    return fail('Please enter a valid URL.');
  }
}

export function validateUUID(id: string): ValidationResult {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!re.test(id)) return fail('Invalid identifier format.');
  return OK;
}

// ─── Form-level validators ────────────────────────────────────────────────────

export interface LoginFormValues {
  email: string;
  password: string;
}

export function validateLoginForm(values: LoginFormValues): Partial<Record<keyof LoginFormValues, string>> {
  const errors: Partial<Record<keyof LoginFormValues, string>> = {};
  const emailResult = validateEmail(values.email);
  if (!emailResult.valid) errors.email = emailResult.message;
  if (!values.password) errors.password = 'Password is required.';
  return errors;
}

export interface TaskFormValues {
  title: string;
  description?: string;
  priority?: string;
  dueAt?: string;
}

export function validateTaskForm(values: TaskFormValues): Partial<Record<keyof TaskFormValues, string>> {
  const errors: Partial<Record<keyof TaskFormValues, string>> = {};
  const titleResult = validateRequired(values.title, 'Title');
  if (!titleResult.valid) errors.title = titleResult.message;
  if (values.title && values.title.length > 200) errors.title = 'Title must not exceed 200 characters.';
  return errors;
}
