import { DurableObject } from 'cloudflare:workers';
import type { Address, Hex } from 'viem';
import { parseChatInput, runTurn } from './agent';
import { Vault } from './chain';
import type { AgentEvent, GameStatus, Heist, VaultStatus } from './events';
import { llm } from './llm';

const STATUS_TTL_MS = 10_000;
const RECENT_HEISTS = 8;
const IP_WINDOW_MS = 10 * 60_000;
const MAX_BODY = 16_384;

/**
 * The agent. There is exactly one instance (idFromName('vault')), so every
 * visitor's transactions are signed in one place with one nonce sequence, and
 * the rate limits see all traffic.
 */
export class VaultAgent extends DurableObject<Env> {
  private readonly vault: Vault;
  private status?: { at: number; value: Promise<VaultStatus> };
  private readonly hits = new Map<string, number[]>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.vault = new Vault({
      chain: env.CHAIN,
      rpcUrl: env.RPC_URL,
      explorerUrl: env.EXPLORER_URL,
      vault: env.VAULT_ADDRESS as Address,
      agentKey: env.AGENT_PRIVATE_KEY as Hex,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/status') return this.getStatus();
    if (pathname === '/chat') return this.chat(request);
    return new Response('Not found', { status: 404 });
  }

  /** The vault's chain state, re-read at most every STATUS_TTL_MS however many visitors ask. */
  private chainStatus(): Promise<VaultStatus> {
    if (!this.status || Date.now() - this.status.at > STATUS_TTL_MS) {
      const value = this.vault.status();
      this.status = { at: Date.now(), value };
      value.catch(() => (this.status = undefined));
    }
    return this.status.value;
  }

  private async getStatus(): Promise<Response> {
    try {
      const [chain, attemptsToday, heists] = await Promise.all([
        this.chainStatus(),
        this.ctx.storage.get<number>(dailyKey('messages')),
        this.ctx.storage.get<Heist[]>('heists'),
      ]);
      const body: GameStatus = {
        ...chain,
        model: modelName(this.env.LLM_MODEL),
        attemptsToday: attemptsToday ?? 0,
        heists: heists ?? [],
      };
      // Cached here, not in the browser: the game re-reads right after a release.
      return json(body, 200, { 'cache-control': 'no-store' });
    } catch (err) {
      console.error('status failed', err);
      return json({ error: 'Could not read the vault from the chain.' }, 502);
    }
  }

  private async chat(request: Request): Promise<Response> {
    const body = await request.text();
    if (body.length > MAX_BODY) return json({ error: 'Too long.' }, 413);

    let input;
    try {
      input = parseChatInput(JSON.parse(body));
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Bad request.' }, 400);
    }

    const ip = request.headers.get('x-client-ip') ?? 'unknown';
    const perIp = Number(this.env.IP_MESSAGES_PER_10_MIN);
    if (!this.hit(ip, perIp)) {
      return json({ error: `Slow down: ${perIp} messages per 10 minutes.` }, 429);
    }
    if (!(await this.takeDaily('messages', Number(this.env.DAILY_MESSAGE_LIMIT)))) {
      return json({ error: 'Warden has used up today’s free LLM budget. Back at 00:00 UTC.' }, 429);
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const emit = async (event: AgentEvent) => {
      if (event.type === 'confirmed') await this.recordHeist(event);
      // A closed tab must not stop a transaction that's already in flight.
      await writer.write(encoder.encode(JSON.stringify(event) + '\n')).catch(() => {});
    };

    const turn = runTurn(input, {
      vault: this.vault,
      decide: llm(this.env),
      status: () => this.chainStatus(),
      emit,
      takeRelease: () => this.takeDaily('releases', Number(this.env.DAILY_RELEASE_LIMIT)),
      contact: this.env.CONTACT_EMAIL,
    })
      .catch(async (err) => {
        console.error('turn failed', err);
        await emit({ type: 'error', message: 'Warden lost its train of thought. Try again.' });
      })
      .finally(async () => {
        this.status = undefined; // a release changes the balance
        await emit({ type: 'done' });
        await writer.close().catch(() => {});
      });
    this.ctx.waitUntil(turn);

    return new Response(readable, {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  /** Sliding-window limit per IP. In memory only: resets if the object is evicted. */
  private hit(ip: string, limit: number): boolean {
    const now = Date.now();
    if (this.hits.size > 5_000) {
      for (const [key, times] of this.hits) {
        if (now - times[times.length - 1] > IP_WINDOW_MS) this.hits.delete(key);
      }
    }
    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);
    this.hits.set(ip, recent);
    return allowed;
  }

  /** Daily counters in durable storage, keyed by UTC date. */
  private async takeDaily(kind: 'messages' | 'releases', limit: number): Promise<boolean> {
    const key = dailyKey(kind);
    const used = (await this.ctx.storage.get<number>(key)) ?? 0;
    if (used >= limit) return false;
    await this.ctx.storage.put(key, used + 1);
    return true;
  }

  /** Only this object holds the agent key, so its list of releases is complete. Each links to its tx. */
  private async recordHeist(e: Extract<AgentEvent, { type: 'confirmed' }>): Promise<void> {
    const heist: Heist = { to: e.to, amount: e.amount, symbol: e.symbol, hash: e.hash, url: e.url, block: e.block, at: Date.now() };
    const heists = (await this.ctx.storage.get<Heist[]>('heists')) ?? [];
    await this.ctx.storage.put('heists', [heist, ...heists].slice(0, RECENT_HEISTS));
  }
}

function dailyKey(kind: 'messages' | 'releases'): string {
  return `${kind}:${new Date().toISOString().slice(0, 10)}`;
}

/** "@cf/meta/llama-3.3-70b-instruct-fp8-fast" → "Llama 3.3 70B". */
function modelName(id: string): string {
  const llama = id.match(/llama-(\d+(?:\.\d+)?)-(\d+b)/i);
  return llama ? `Llama ${llama[1]} ${llama[2].toUpperCase()}` : (id.split('/').pop() ?? id);
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
