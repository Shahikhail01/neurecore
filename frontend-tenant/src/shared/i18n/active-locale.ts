/**
 * Phase 29 — Ambient locale context (CR-AI-1304).
 *
 * The tenant portal has hundreds of call sites that format a date or
 * an amount through the shared helpers in `utils/formatters.ts` and
 * `lib/utils.ts`. Threading a context parameter through all of them
 * would be a mechanical change with a large regression surface, so
 * instead the resolved context is published once, here, and the
 * helpers read it.
 *
 * This is a deliberate, single, explicit piece of module state with
 * exactly one writer (`LocaleProvider`) — not an ambient global that
 * anything may mutate.
 *
 * SOLID
 *   SRP — owns ONLY the current context and its subscribers.
 *   DIP — helpers depend on this accessor, never on `navigator`,
 *         a store or a cookie.
 */

import {
  DEFAULT_LOCALE_CONTEXT,
  type LocaleFormatContext,
} from './locale-format.types';

type Listener = (context: LocaleFormatContext) => void;

let activeContext: LocaleFormatContext = DEFAULT_LOCALE_CONTEXT;
const listeners = new Set<Listener>();

export function getActiveLocaleContext(): LocaleFormatContext {
  return activeContext;
}

export function setActiveLocaleContext(context: LocaleFormatContext): void {
  activeContext = context;
  for (const listener of listeners) listener(context);
}

export function resetActiveLocaleContext(): void {
  setActiveLocaleContext(DEFAULT_LOCALE_CONTEXT);
}

export function subscribeToLocaleContext(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
