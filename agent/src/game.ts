// The game's rules, as pure functions. Everything that decides *whether* a release
// may go ahead lives in code here, not in a prompt; the contract still decides the
// hard limits. See game.test.ts.

import type { Bounty, Tactic } from './events';

export const RULES = {
  /** A new visitor starts slightly on Warden's radar. */
  startSuspicion: 20,
  /** Suspicion cools off while a visitor is away. */
  decayPerHour: 10,
  /** At this suspicion Warden stops listening… */
  lockoutAt: 100,
  /** …for this long. */
  lockoutMs: 10 * 60_000,
  /** Warden won't pay anyone it already suspects this much (judged before the message). */
  vetoAt: 80,
  /** Nor on a message Sentinel is this sure is a trick, whatever Warden decided. */
  sentinelVetoAt: 90,
  /** Winners are watched closely afterwards, so one jailbreak can't be farmed. */
  afterWin: 90,
  /** The bounty: grows every minute nobody robs the vault, resets after a heist. */
  bountyBase: 50,
  bountyPerMinute: 5,
  /** Circuit breaker: this many releases inside the window holds all releases. */
  breakerReleases: 5,
  breakerWindowMs: 10 * 60_000,
  breakerHoldMs: 30 * 60_000,
} as const;

export const TACTICS: readonly Tactic[] = [
  'small_talk',
  'honest_ask',
  'charm',
  'sob_story',
  'deal',
  'roleplay',
  'reverse_psychology',
  'authority',
  'fake_system',
  'injection',
  'other',
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Suspicion after cooling off since it was last set. */
export function decayed(suspicion: number, since: number, now: number): number {
  const hours = Math.max(0, now - since) / 3_600_000;
  return clamp(Math.round(suspicion - hours * RULES.decayPerHour), 0, 100);
}

/** Sentinel's threat score (0–100) moves suspicion: harmless messages calm Warden down. */
export function nextSuspicion(current: number, threat: number): number {
  return clamp(current + Math.round((clamp(threat, 0, 100) - 40) / 3), 0, 100);
}

/** Whole tokens a successful heist pays right now. */
export function bountyNow(b: Bounty, now: number): number {
  const minutes = Math.floor(Math.max(0, now - b.since) / 60_000);
  return Math.max(0, Math.min(b.cap, b.base + minutes * b.perMinute));
}

/** Release timestamps (ms) → the time the breaker holds releases until, or 0. */
export function breakerUntil(releases: readonly number[], now: number): number {
  const recent = releases.filter((t) => now - t < RULES.breakerWindowMs);
  return recent.length >= RULES.breakerReleases ? Math.max(...recent) + RULES.breakerHoldMs : 0;
}

/** A friendly, stable name for a player, so the public feed never shows tokens or addresses. */
export function handleFor(seed: string): string {
  const adjectives = ['sly', 'quiet', 'bold', 'lucky', 'crafty', 'sneaky', 'swift', 'shady', 'clever', 'nimble', 'cheeky', 'silent', 'wily', 'daring', 'smooth', 'cunning'];
  const animals = ['fox', 'otter', 'raven', 'lynx', 'gecko', 'magpie', 'ferret', 'badger', 'cobra', 'mantis', 'weasel', 'owl', 'jackal', 'marten', 'viper', 'crow'];
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `${adjectives[h % 16]}-${animals[(h >>> 4) % 16]}-${((h >>> 8) & 0xff).toString(16).padStart(2, '0')}`;
}
