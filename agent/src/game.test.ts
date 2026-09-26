// npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES, bountyNow, breakerUntil, decayed, handleFor, nextSuspicion } from './game';

const HOUR = 3_600_000;

test('suspicion cools off by the hour, never below zero', () => {
  assert.equal(decayed(60, 0, 2 * HOUR), 40);
  assert.equal(decayed(60, 0, 30 * 60_000), 55);
  assert.equal(decayed(15, 0, 10 * HOUR), 0);
  assert.equal(decayed(60, 5 * HOUR, 0), 60, 'a clock going backwards changes nothing');
});

test('harmless messages calm Warden, attacks alarm it', () => {
  assert.equal(nextSuspicion(20, 0), 7);
  assert.equal(nextSuspicion(20, 40), 20);
  assert.equal(nextSuspicion(20, 100), 40);
  assert.equal(nextSuspicion(95, 100), 100);
  assert.equal(nextSuspicion(50, 999), 70, 'threat is clamped');
  assert.equal(nextSuspicion(5, 0), 0, 'never below zero');
});

test('blatant attacks: past the veto line after four, locked out on the fifth', () => {
  let s: number = RULES.startSuspicion;
  const path: number[] = [];
  for (let i = 0; i < 6; i++) path.push((s = nextSuspicion(s, 95)));
  assert.ok(path[2] < RULES.vetoAt && path[3] >= RULES.vetoAt, `veto after 4: ${path}`);
  assert.ok(path[3] < RULES.lockoutAt && path[4] === RULES.lockoutAt, `lockout on 5: ${path}`);
});

test('the bounty grows per whole minute and stops at the cap', () => {
  const b = { base: 50, perMinute: 5, cap: 1000, since: 0 };
  assert.equal(bountyNow(b, 0), 50);
  assert.equal(bountyNow(b, 59_999), 50);
  assert.equal(bountyNow(b, 60_000), 55);
  assert.equal(bountyNow(b, 10 * HOUR), 1000);
  assert.equal(bountyNow({ ...b, cap: 20 }, 0), 20, 'a cap below the base wins');
  assert.equal(bountyNow({ ...b, cap: -5 }, 0), 0);
});

test('the circuit breaker trips on the fifth release inside the window', () => {
  const now = 100 * 60_000;
  const four = [1, 2, 3, 4].map((m) => now - m * 60_000);
  assert.equal(breakerUntil(four, now), 0);
  assert.equal(breakerUntil([...four, now], now), now + RULES.breakerHoldMs);
  const old = [...four, now - 11 * 60_000];
  assert.equal(breakerUntil(old, now), 0, 'releases outside the window do not count');
});

test('handles are stable and look like adjective-animal-xx', () => {
  assert.equal(handleFor('abc'), handleFor('abc'));
  assert.match(handleFor('abc'), /^[a-z]+-[a-z]+-[0-9a-f]{2}$/);
  assert.notEqual(handleFor('abc'), handleFor('abd'));
});
