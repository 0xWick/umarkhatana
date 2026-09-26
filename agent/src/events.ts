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

export type AgentEvent =
  /** Sentinel screened the message and moved the visitor's suspicion. */
  | { type: 'sentinel'; tactic: Tactic; threat: number; label: string; suspicion: number; delta: number }
  /** Suspicion hit the ceiling: Warden stops listening to this visitor until `until` (ms). */
  | { type: 'lockout'; until: number }
  /** The model chose a tool. `args` is exactly what it asked for. */
  | { type: 'tool'; name: string; args: Record<string, unknown> }
  /** The game's own rules refused a release before it reached the contract. */
  | { type: 'vetoed'; reason: 'suspicion' | 'sentinel' | 'breaker' | 'gas'; detail: string }
  /** What the release pays: the live bounty, whatever the model asked for. */
  | { type: 'payout'; asked: string; pays: string; symbol: string }
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

/** The bounty grows from `base` by `perMinute` since `since` (ms), up to `cap`. All whole tokens. */
export interface Bounty {
  base: number;
  perMinute: number;
  cap: number;
  since: number;
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
  bounty: Bounty;
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
