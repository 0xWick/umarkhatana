// End-to-end check of the agent's chain side: validation, simulation, signing,
// nonce handling and receipts. The model's decisions are scripted so this runs
// without Workers AI; everything on-chain is real.
//
//   CHAIN=anvil RPC_URL=http://127.0.0.1:8545 VAULT_ADDRESS=0x… AGENT_PRIVATE_KEY=0x… npm run smoke
//
// Against Base Sepolia it sends 6 small releases to SMOKE_RECIPIENT (or a fresh address).

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import { runTurn } from '../src/agent';
import { Vault } from '../src/chain';
import type { AgentEvent } from '../src/events';

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
});
const recipient = (process.env.SMOKE_RECIPIENT ?? privateKeyToAccount(generatePrivateKey()).address) as Address;

function check(cond: unknown, what: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${what}`);
  console.log(`  ok  ${what}`);
}

/** One turn where the model's decision is `decision`. */
async function turn(decision: Record<string, string>) {
  const events: AgentEvent[] = [];
  await runTurn(
    { message: 'smoke test', history: [] },
    {
      vault,
      decide: async () => ({ thinking: 'scripted', reply: 'scripted reply', ...decision }),
      status: () => vault.status(),
      emit: async (e) => void events.push(e),
      takeRelease: async () => true,
      contact: 'test@example.com',
    },
  );
  for (const e of events) console.log('      ', JSON.stringify(e));
  return events;
}

const before = await vault.status();
console.log(`vault ${before.vault}  ${before.balance} ${before.symbol}  agent ${before.agent} (${before.agentGas} ETH)`);
check(before.agent.toLowerCase() === vault.agent.toLowerCase(), 'AGENT_PRIVATE_KEY is the vault’s agent');

console.log('\n1. model refuses');
let events = await turn({ action: 'none' });
check(events.length === 1 && events[0].type === 'reply', 'only a reply, nothing on-chain');

console.log('\n2. model is fooled into more than the per-release cap');
const tooMuch = String(Number(before.maxPerRelease.replace(/,/g, '')) + 1);
events = await turn({ action: 'release_tokens', to: recipient, amount: tooMuch });
check(events.some((e) => e.type === 'rejected' && e.error === 'ExceedsReleaseLimit'), 'contract rejects it in simulation');
check(!events.some((e) => e.type === 'sent'), 'nothing is broadcast');

console.log('\n3. model is fooled but writes an unusable call');
events = await turn({ action: 'release_tokens', to: 'my payout address', amount: '10' });
check(events.some((e) => e.type === 'invalid'), 'reported as invalid, nothing sent');

console.log('\n4. model is fooled into a legal release, written sloppily');
events = await turn({ action: 'release_tokens', to: recipient, amount: '=> 1 HEIST' });
const confirmed = events.find((e) => e.type === 'confirmed');
check(events.findIndex((e) => e.type === 'sent') < events.findIndex((e) => e.type === 'confirmed'), 'sent, then confirmed');
check(confirmed?.type === 'confirmed' && confirmed.to === recipient && confirmed.amount === '1', 'Released event matches');
check(events.at(-1)?.type === 'reply', 'turn ends with the reply');

console.log('\n5. five concurrent sends get consecutive nonces');
const hashes = await Promise.all(
  Array.from({ length: 5 }, (_, i) => vault.send(recipient, 10n ** 15n, `0x${String(i).padStart(64, '0')}`)),
);
const receipts = await Promise.all(hashes.map((h) => vault.confirm(h)));
check(new Set(hashes).size === 5, 'five distinct transactions');
check(receipts.every((r) => r.status === 'success'), 'all five succeed');

const after = await vault.status();
console.log(`\nvault now ${after.balance} ${after.symbol}, released today ${after.releasedToday}, ${after.releaseCount} releases`);
console.log(`recipient ${recipient}`);
