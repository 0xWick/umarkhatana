// End-to-end check of the agent's chain side and the game's code rules: lockout,
// vetoes, the bounty, validation, simulation, signing, nonce handling, receipts and
// the trophy. The models are scripted so this runs without Workers AI; everything
// on-chain is real.
//
//   CHAIN=anvil RPC_URL=http://127.0.0.1:8545 VAULT_ADDRESS=0x… TROPHY_ADDRESS=0x… AGENT_PRIVATE_KEY=0x… npm run smoke
//
// Against Base Sepolia it sends a few small releases to SMOKE_RECIPIENT (or a fresh address).

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import { runTurn, type Hold } from '../src/agent';
import { Vault } from '../src/chain';
import type { AgentEvent } from '../src/events';
import { RULES } from '../src/game';

const env = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Set ${name}`);
  return value;
};

const vault = new Vault({
  chain: env('CHAIN', 'anvil'),
  rpcUrl: env('RPC_URL', 'http://127.0.0.1:8545'),
  explorerUrl: env('EXPLORER_URL', 'https://sepolia.basescan.org'),
  vault: env('VAULT_ADDRESS') as Address,
  agentKey: env('AGENT_PRIVATE_KEY') as Hex,
  trophy: process.env.TROPHY_ADDRESS as Address | undefined,
});
const recipient = (process.env.SMOKE_RECIPIENT ?? privateKeyToAccount(generatePrivateKey()).address) as Address;

function check(cond: unknown, what: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${what}`);
  console.log(`  ok  ${what}`);
}

interface Setup {
  bounty?: number;
  suspicion?: number;
  threat?: number;
  hold?: Hold;
}

/** One turn where Sentinel rates `threat` and Warden's decision is `decision`. */
async function turn(decision: Record<string, string>, s: Setup = {}) {
  const events: AgentEvent[] = [];
  let wardenCalled = false;
  const result = await runTurn(
    { token: 'smoke', message: 'smoke test' },
    { address: recipient, suspicion: s.suspicion ?? RULES.startSuspicion, note: '', history: [] },
    {
      vault,
      decide: async () => {
        wardenCalled = true;
        return { thinking: 'scripted', reply: 'scripted reply', note: 'scripted note', ...decision };
      },
      screen: async () => ({ tactic: 'other', threat: s.threat ?? 40, label: 'scripted' }),
      status: () => vault.status(),
      bounty: async () => s.bounty ?? 1,
      hold: () => s.hold ?? null,
      emit: async (e) => void events.push(e),
      takeRelease: async () => true,
      contact: 'test@example.com',
    },
  );
  for (const e of events) console.log('      ', JSON.stringify(e));
  return { events, result, wardenCalled, has: (type: AgentEvent['type']) => events.some((e) => e.type === type) };
}

const release = (amount = '5000') => ({ action: 'release_tokens', to: recipient, amount });

const before = await vault.status();
console.log(`vault ${before.vault}  ${before.balance} ${before.symbol}  agent ${before.agent} (${before.agentGas} ETH)`);
check(before.agent.toLowerCase() === vault.agent.toLowerCase(), 'AGENT_PRIVATE_KEY is the vault’s agent');

console.log('\n1. Sentinel pushes a suspicious visitor over the edge');
let t = await turn(release(), { suspicion: 95, threat: 100 });
check(t.has('lockout') && t.result.locked, 'locked out');
check(!t.wardenCalled && !t.has('tool'), 'Warden never sees the message');

console.log('\n2. model refuses');
t = await turn({ action: 'none' });
check(!t.has('tool') && t.has('reply'), 'a reply, nothing on-chain');
check(t.events.some((e) => e.type === 'memory' && e.note === 'scripted note'), 'Warden’s notes are updated');

console.log('\n3. model is fooled, but the visitor was already suspected');
t = await turn(release(), { suspicion: RULES.vetoAt });
check(t.events.some((e) => e.type === 'vetoed' && e.reason === 'suspicion'), 'vetoed by the suspicion rule');
check(!t.has('payout') && !t.has('sent'), 'the contract is never asked');

console.log('\n3b. model is fooled, but Sentinel was sure the message was an attack');
t = await turn(release(), { threat: RULES.sentinelVetoAt });
check(t.events.some((e) => e.type === 'vetoed' && e.reason === 'sentinel'), 'vetoed by the guard model');
check(!t.has('payout') && !t.has('sent'), 'the contract is never asked');

console.log('\n4. model is fooled while the circuit breaker holds releases');
t = await turn(release(), { hold: { reason: 'breaker', detail: 'held for the smoke test' } });
check(t.events.some((e) => e.type === 'vetoed' && e.reason === 'breaker'), 'vetoed by the breaker');

console.log('\n5. model is fooled, and a misconfigured bounty asks for more than the per-release cap');
const overCap = Number(before.maxPerRelease.replace(/,/g, '')) + 1;
t = await turn(release(), { bounty: overCap });
check(t.events.some((e) => e.type === 'rejected' && e.error === 'ExceedsReleaseLimit'), 'the contract rejects it in simulation');
check(!t.has('sent'), 'nothing is broadcast');

console.log('\n6. model is fooled but writes an unusable call');
t = await turn({ action: 'release_tokens', to: 'my payout address', amount: '10' });
check(t.has('invalid') && !t.has('sent'), 'reported as invalid, nothing sent');

console.log('\n7. model is fooled into a legal release: the bounty pays, whatever it asked');
t = await turn(release('=> 5000 HEIST'), { bounty: 1 });
const payout = t.events.find((e) => e.type === 'payout');
check(payout?.type === 'payout' && payout.asked === '5000' && payout.pays === '1', 'asked 5000, bounty pays 1');
const confirmed = t.events.find((e) => e.type === 'confirmed');
check(t.events.findIndex((e) => e.type === 'sent') < t.events.findIndex((e) => e.type === 'confirmed'), 'sent, then confirmed');
check(confirmed?.type === 'confirmed' && confirmed.to === recipient && confirmed.amount === '1' && Number(confirmed.id) > 0, 'Released event matches');
check(t.result.released, 'the turn reports the release');

if (vault.trophy && confirmed?.type === 'confirmed') {
  console.log('\n8. the winner gets one soulbound trophy');
  const id = await vault.mintTrophy(recipient, BigInt(confirmed.id), 10n ** 18n);
  check(id > 0 && (await vault.trophyOf(recipient)) === id, `trophy #${id} minted`);
  const again = await vault.mintTrophy(recipient, BigInt(confirmed.id), 10n ** 18n).then(() => 'minted', () => 'refused');
  check(again === 'refused', 'a second trophy for the same address is refused');
}

console.log('\n9. concurrent releases and a trophy mint get consecutive nonces');
const other = privateKeyToAccount(generatePrivateKey()).address;
const [hashes, minted] = await Promise.all([
  Promise.all(Array.from({ length: 5 }, (_, i) => vault.send(recipient, 10n ** 15n, `0x${String(i).padStart(64, '0')}`))),
  vault.trophy ? vault.mintTrophy(other, 1n, 10n ** 18n) : Promise.resolve(0),
]);
const receipts = await Promise.all(hashes.map((h) => vault.confirm(h)));
check(new Set(hashes).size === 5 && receipts.every((r) => r.status === 'success'), 'five distinct releases succeed');
if (vault.trophy) check(minted > 0, 'the mint in the same queue succeeds too');

const after = await vault.status();
console.log(`\nvault now ${after.balance} ${after.symbol}, released today ${after.releasedToday}, ${after.releaseCount} releases`);
console.log(`recipient ${recipient}`);
