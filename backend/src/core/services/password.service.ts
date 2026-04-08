/**
 * Password Hashing Service
 * Secure password hashing with bcrypt
 * SOLID: Single Responsibility - Password operations only
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * PasswordService - Handles password hashing and validation
 * Uses bcrypt with cost factor 10 (production-grade security)
 *
 * SOLID:
 * - S: Only password hashing concerns
 * - O: Can swap bcrypt for Argon2 without changing interface
 * - L: Implements consistent interface
 * - I: Only needed methods exposed
 * - D: No external dependencies on implementation
 */
@Injectable()
export class PasswordService {
  private readonly saltRounds = 10;

  /**
   * Hash a plain-text password
   * @param password Plain-text password
   * @returns Hashed password (bcrypt)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify a plain-text password against hash
   * @param password Plain-text password to check
   * @param hash Stored hash
   * @returns true if password matches hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Check password strength
   * Requirements:
   * - Minimum 8 characters
   * - At least 1 uppercase letter
   * - At least 1 lowercase letter
   * - At least 1 digit
   * - At least 1 special character (!@#$%^&*)
   *
   * @param password Password to validate
   * @returns { valid: boolean, errors: string[] }
   */
  validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!password) {
      return { valid: false, errors: ['Password is required'] };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain digit');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain special character (!@#$%^&*)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate random password
   * Useful for password resets
   * Format: 12 characters with mixed case, digits, and symbols
   * @returns Random secure password
   */
  generateRandomPassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*';

    const allChars = uppercase + lowercase + digits + symbols;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
