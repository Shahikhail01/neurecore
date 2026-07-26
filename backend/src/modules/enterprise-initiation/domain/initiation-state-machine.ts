// src/modules/enterprise-initiation/domain/initiation-state-machine.ts
import { InitiationStatus, INITIATION_TRANSITIONS } from './initiation-states';

export class InvalidTransitionError extends Error {
  constructor(from: InitiationStatus, to: InitiationStatus) {
    super(`Invalid transition from ${from} to ${to}`);
  }
}

export class InitiationStateMachine {
  static canTransition(from: InitiationStatus, to: InitiationStatus): boolean {
    return INITIATION_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: InitiationStatus, to: InitiationStatus): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidTransitionError(from, to);
    }
  }

  static isTerminal(status: InitiationStatus): boolean {
    return INITIATION_TRANSITIONS[status]?.length === 0;
  }
}
