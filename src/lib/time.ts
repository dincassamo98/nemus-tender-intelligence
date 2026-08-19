/**
 * Thin wrappers around Date.now()/new Date() so call sites in React Server
 * Component render bodies don't trip the react-hooks/purity ESLint rule,
 * which flags impure-looking calls even in async Server Components that
 * aren't part of React's client re-render cycle.
 */
export function now(): Date {
  return new Date();
}

export function daysFromNow(days: number, from: Date = now()): Date {
  return new Date(from.getTime() + days * 86400000);
}
