// The wire format between the agent and the site. POST /chat streams one
// AgentEvent per line (NDJSON); GET /status returns a GameStatus; GET /feed is a
// WebSocket of FeedEvents.
// No runtime imports: the Astro site imports these types too.

type Hex = `0x${string}`;

/** How Sentinel classifies a message. The feed only ever shows this, never raw text. */
export type Tactic =
  | 'small_talk'
  | 'honest_ask'
  | 'charm'
  | 'sob_story'
  | 'deal'
  | 'roleplay'
  | 'reverse_psychology'
  | 'authority'
  | 'fake_system'
  | 'injection'
  | 'other';

/** The Accomplice's strategy cards. */
export type Strategy = 'rank' | 'system' | 'pretend' | 'reverse' | 'sob' | 'deal' | 'inject' | 'charm';

/** How big a heist is, which decides what it takes to win it. See tierFor() in game.ts. */
export type Tier = 'tip' | 'score' | 'big';

export type AgentEvent =
  /** Where this turn's conversation came from: the browser's copy, or the server's own record. */
  | { type: 'history'; source: 'client' | 'server'; turns: number; matches: boolean }
  /** Sentinel screened the message and moved the visitor's suspicion. */
  | { type: 'sentinel'; tactic: Tactic; threat: number; label: string; suspicion: number; delta: number }
  /** Suspicion hit the ceiling: Warden stops listening to this visitor until `until` (ms). */
  | { type: 'lockout'; until: number }
  /** The model chose a tool. `args` is exactly what it asked for. */
  | { type: 'tool'; name: string; args: Record<string, unknown> }
  /** The game's own rules refused a release before it reached the contract. */
  | { type: 'vetoed'; reason: 'suspicion' | 'sentinel' | 'approval' | 'breaker' | 'gas'; detail: string }
  /** The amount Warden chose, and the tier whose rules it passed. */
  | { type: 'payout'; amount: string; tier: Tier; symbol: string }
  /** The contract would revert, so nothing was sent. `error` is the Solidity error name. */
  | { type: 'rejected'; error: string; detail: string }
  /** The model chose to release but asked for something unusable, e.g. no address. Nothing was sent. */
  | { type: 'invalid'; detail: string }
  /** Signed and broadcast; not yet in a block. */
  | { type: 'sent'; hash: Hex; url: string }
  /** Included in a block and the Released event was emitted. */
  | { type: 'confirmed'; hash: Hex; url: string; block: string; id: string; to: Hex; amount: string; symbol: string }
  /** Included in a block but reverted, e.g. a concurrent release used up the daily cap. */
  | { type: 'reverted'; hash: Hex; url: string }
  /** The soulbound trophy for a first win. */
  | { type: 'trophy'; status: 'minting' | 'minted' | 'owned' | 'failed' | 'off'; tokenId?: number; url?: string }
  /** Warden rewrote its private notes about this visitor. */
  | { type: 'memory'; note: string }
  | { type: 'reply'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** Read from the chain. */
export interface VaultStatus {
  chainId: number;
  block: string;
  vault: Hex;
  token: Hex;
  agent: Hex;
  symbol: string;
  paused: boolean;
  /** Token amounts are human-readable strings, already scaled by decimals. */
  balance: string;
  maxPerRelease: string;
  maxPerDay: string;
  releasedToday: string;
  remainingToday: string;
  releaseCount: number;
  /** The agent key's ETH balance, i.e. how long it can keep paying gas. */
  agentGas: string;
  links: { explorer: string; vault: string; token: string; holders: string; agent: string };
}

/** A successful release, as the agent recorded it. `url` is the transaction on the explorer. */
export interface Heist {
  to: Hex;
  amount: string;
  symbol: string;
  hash: Hex;
  url: string;
  block: string;
  at: number;
}

export type FlowId = 'heist' | 'hourly';
export type StepStatus = 'idle' | 'run' | 'ok' | 'skip' | 'alert' | 'fail';

/** One run of an automation, n8n-style: a trigger and the steps after it. */
export interface FlowRun {
  flow: FlowId;
  title: string;
  at: number;
  steps: { id: string; label: string; status: StepStatus; detail?: string }[];
}

/** GET /status: the chain state plus what the agent itself knows. */
export interface GameStatus extends VaultStatus {
  model: string;
  sentinelModel: string;
  attemptsToday: number;
  heists: Heist[];
  /** Releases are held by the circuit breaker or the gas watchdog until `until` (ms), or 0. */
  breaker: { reason: 'breaker' | 'gas' | null; until: number };
  trophy: { address: Hex; url: string } | null;
  flows: FlowRun[];
  mcp: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** A visitor, as they see themselves. */
export interface PlayerView {
  handle: string;
  address: Hex;
  suspicion: number;
  note: string;
  attempts: number;
  wins: number;
  lockedUntil: number;
  messagesLeft: number;
  history: ChatTurn[];
  trophy: { tokenId: number; url: string } | null;
  /** The tiers this player has won at least once. */
  tiers: Tier[];
}

/** POST /player: a new visitor with a throwaway wallet. The key is returned once and never stored. */
export interface NewPlayer extends PlayerView {
  token: string;
  privateKey: Hex;
}

export interface ChatInput {
  token: string;
  message: string;
  /** Where the loot goes. Defaults to the player's own wallet. */
  address?: Hex;
  /** The conversation so far, as the browser remembers it. */
  history?: ChatTurn[];
}

export interface HallEntry {
  tx: Hex;
  url: string;
  at: number;
  name: string;
  amount: string;
  symbol: string;
  line: string;
  reply: string;
  tactic: Tactic;
  attempts: number;
  /** keccak256 of `line`: the intentHash in the Released event, so anyone can check the line is real. */
  intentHash: Hex;
}

export type Outcome = 'refused' | 'vetoed' | 'locked_out' | 'blocked' | 'robbed' | 'error';

/** One attempt in the live feed. No free text from visitors ever goes in here. */
export interface FeedItem {
  at: number;
  handle: string;
  tactic: Tactic;
  outcome: Outcome;
  via: 'web' | 'mcp';
  /** The turn ran on a conversation that doesn't match the server's record. */
  forged?: boolean;
  amount?: string;
  url?: string;
}

export type FeedEvent =
  | { type: 'hello'; viewers: number; items: FeedItem[] }
  | { type: 'viewers'; n: number }
  | { type: 'attempt'; item: FeedItem }
  | { type: 'flow'; run: FlowRun }
  /** The public hall of fame changed; fetch it again. */
  | { type: 'hall' };
