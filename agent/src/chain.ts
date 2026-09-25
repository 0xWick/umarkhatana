import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  parseAbi,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, baseSepolia } from 'viem/chains';
import type { VaultStatus } from './events';

// Mirrors contracts/src/AgentVault.sol. Only what the agent touches.
export const vaultAbi = parseAbi([
  'struct Status { address token; address agent; bool paused; uint256 balance; uint256 maxPerRelease; uint256 maxPerDay; uint256 releasedToday; uint256 remainingToday; uint256 releaseCount; }',
  'function status() view returns (Status)',
  'function release(address to, uint256 amount, bytes32 intentHash) returns (uint256 id)',
  'event Released(uint256 indexed id, address indexed to, uint256 amount, bytes32 intentHash)',
  'error NotAgent()',
  'error VaultPaused()',
  'error InvalidRecipient(address to)',
  'error ZeroAmount()',
  'error ExceedsReleaseLimit(uint256 amount, uint256 limit)',
  'error ExceedsDailyLimit(uint256 amount, uint256 remaining)',
  'error InsufficientBalance(uint256 amount, uint256 balance)',
]);

const chains = { 'base-sepolia': baseSepolia, anvil };

export interface VaultConfig {
  chain: string;
  rpcUrl: string;
  explorerUrl: string;
  vault: Address;
  agentKey: Hex;
}

export type Simulation = { ok: true } | { ok: false; error: string; detail: string };

export interface Release {
  hash: Hash;
  status: 'success' | 'reverted';
  block: bigint;
  id?: bigint;
  to?: Address;
  amount?: bigint;
}

/** The vault as the agent sees it: read state, dry-run a release, sign and send it. */
export class Vault {
  readonly address: Address;
  readonly explorer: string;
  private readonly account;
  private readonly publicClient;
  private readonly walletClient;
  private meta?: Promise<{ token: Address; symbol: string; decimals: number }>;

  // Sends are serialised through one promise chain with a locally tracked nonce,
  // so two visitors releasing at the same moment get consecutive nonces instead
  // of both reading the same pending count from the RPC.
  private nonce?: number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(cfg: VaultConfig) {
    const chain = chains[cfg.chain as keyof typeof chains];
    if (!chain) throw new Error(`Unknown chain "${cfg.chain}"`);
    const transport = http(cfg.rpcUrl);
    this.address = cfg.vault;
    this.explorer = cfg.explorerUrl.replace(/\/$/, '');
    this.account = privateKeyToAccount(cfg.agentKey);
    this.publicClient = createPublicClient({ chain, transport });
    this.walletClient = createWalletClient({ chain, transport, account: this.account });
  }

  get agent(): Address {
    return this.account.address;
  }

  txUrl(hash: Hash): string {
    return `${this.explorer}/tx/${hash}`;
  }

  token() {
    this.meta ??= (async () => {
      const { token } = await this.readStatus();
      const [symbol, decimals] = await Promise.all([
        this.publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
        this.publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
      ]);
      return { token, symbol, decimals };
    })().catch((err) => {
      this.meta = undefined; // don't cache a failed RPC call
      throw err;
    });
    return this.meta;
  }

  /** Whole tokens → base units, e.g. "250" → 250e18. */
  async toUnits(amount: string): Promise<bigint> {
    return parseUnits(amount, (await this.token()).decimals);
  }

  async format(units: bigint): Promise<string> {
    const { decimals } = await this.token();
    return Number(formatUnits(units, decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 });
  }

  async status(): Promise<VaultStatus> {
    const [s, { symbol }, gas, block] = await Promise.all([
      this.readStatus(),
      this.token(),
      this.publicClient.getBalance({ address: this.account.address }),
      this.publicClient.getBlockNumber(),
    ]);
    const fmt = (v: bigint) => this.format(v);
    return {
      chainId: this.publicClient.chain.id,
      block: block.toString(),
      vault: this.address,
      token: s.token,
      agent: s.agent,
      symbol,
      paused: s.paused,
      balance: await fmt(s.balance),
      maxPerRelease: await fmt(s.maxPerRelease),
      maxPerDay: await fmt(s.maxPerDay),
      releasedToday: await fmt(s.releasedToday),
      remainingToday: await fmt(s.remainingToday),
      releaseCount: Number(s.releaseCount),
      agentGas: Number(formatEther(gas)).toFixed(5),
      links: {
        explorer: this.explorer,
        vault: `${this.explorer}/address/${this.address}`,
        token: `${this.explorer}/token/${s.token}`,
        holders: `${this.explorer}/token/${s.token}#balances`,
        agent: `${this.explorer}/address/${s.agent}`,
      },
    };
  }

  /** Dry-run release() with eth_call. A policy revert comes back as a readable reason. */
  async simulate(to: Address, amount: bigint, intentHash: Hex): Promise<Simulation> {
    try {
      await this.publicClient.simulateContract({
        account: this.account,
        address: this.address,
        abi: vaultAbi,
        functionName: 'release',
        args: [to, amount, intentHash],
      });
      return { ok: true };
    } catch (err) {
      const revert = err instanceof BaseError && err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (!(revert instanceof ContractFunctionRevertedError)) throw err;
      const error = revert.data?.errorName ?? 'Reverted';
      return { ok: false, error, detail: await this.explain(error, revert.data?.args ?? []) };
    }
  }

  send(to: Address, amount: bigint, intentHash: Hex): Promise<Hash> {
    const run = this.queue.then(async () => {
      this.nonce ??= await this.publicClient.getTransactionCount({
        address: this.account.address,
        blockTag: 'pending',
      });
      try {
        const hash = await this.walletClient.writeContract({
          address: this.address,
          abi: vaultAbi,
          functionName: 'release',
          args: [to, amount, intentHash],
          nonce: this.nonce,
        });
        this.nonce++;
        return hash;
      } catch (err) {
        this.nonce = undefined; // resync from the chain on the next send
        throw err;
      }
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async confirm(hash: Hash): Promise<Release> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      pollingInterval: 1_000,
      timeout: 90_000,
    });
    const [released] = parseEventLogs({ abi: vaultAbi, eventName: 'Released', logs: receipt.logs });
    return {
      hash,
      status: receipt.status,
      block: receipt.blockNumber,
      id: released?.args.id,
      to: released?.args.to,
      amount: released?.args.amount,
    };
  }

  private readStatus() {
    return this.publicClient.readContract({ address: this.address, abi: vaultAbi, functionName: 'status' });
  }

  private async explain(error: string, args: readonly unknown[]): Promise<string> {
    const [a, b] = args as bigint[];
    switch (error) {
      case 'NotAgent':
        return 'this key is no longer the vault’s agent';
      case 'VaultPaused':
        return 'the vault is paused by its owner';
      case 'InvalidRecipient':
        return 'cannot send to the zero address, the vault itself or the token contract';
      case 'ZeroAmount':
        return 'amount must be more than zero';
      case 'ExceedsReleaseLimit':
        return `${await this.format(a)} is over the per-release limit of ${await this.format(b)}`;
      case 'ExceedsDailyLimit':
        return `only ${await this.format(b)} can leave the vault for the rest of today (UTC)`;
      case 'InsufficientBalance':
        return `the vault only holds ${await this.format(b)}`;
      default:
        return 'the contract reverted';
    }
  }
}
