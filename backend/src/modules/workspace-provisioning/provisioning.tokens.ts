/**
 * Dependency-injection tokens for workspace provisioning.
 * Using a Symbol prevents accidental string collisions across modules.
 */
export const PROVISIONING_PROVIDERS = Symbol('PROVISIONING_PROVIDERS');
