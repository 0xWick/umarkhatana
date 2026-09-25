// The wire format between the agent and the site. POST /chat streams one
// AgentEvent per line (NDJSON); GET /status returns a GameStatus.
// No runtime imports: the Astro site imports these types too.

type Hex = `0x${string}`;

export type AgentEvent =
  /** The model chose a tool. `args` is exactly what it asked for. */
  | { type: 'tool'; name: string; args: Record<string, unknown> }
  /** The contract would revert, so nothing was sent. `error` is the Solidity error name. */
  | { type: 'rejected'; error: string; detail: string }
  /** The model chose to release but asked for something unusable, e.g. no address. Nothing was sent. */
  | { type: 'invalid'; detail: string }
  /** Signed and broadcast; not yet in a block. */
  | { type: 'sent'; hash: Hex; url: string }
  /** Included in a block and the Released event was emitted. */
  | { type: 'confirmed'; hash: Hex; url: string; block: string; to: Hex; amount: string; symbol: string }
  /** Included in a block but reverted, e.g. a concurrent release used up the daily cap. */
  | { type: 'reverted'; hash: Hex; url: string }
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

/** GET /status: the chain state plus what the agent itself knows. */
export interface GameStatus extends VaultStatus {
  model: string;
  attemptsToday: number;
  heists: Heist[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatInput {
  message: string;
  history: ChatTurn[];
  /** Where the visitor wants the loot sent. Optional; they can also say it in the message. */
  address?: Hex;
}
