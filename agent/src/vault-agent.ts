import { DurableObject } from 'cloudflare:workers';
import { bytesToHex, keccak256, stringToHex, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseChatInput, runTurn, type Hold } from './agent';
import { Vault } from './chain';
import { STRATEGIES, draft, isPublishable, screen } from './crew';
import type {
  AgentEvent,
  Bounty,
  ChatInput,
  FeedEvent,
  FeedItem,
  FlowId,
  FlowRun,
  GameStatus,
  Heist,
  NewPlayer,
  Outcome,
  PlayerView,
  StepStatus,
  Strategy,
  VaultStatus,
} from './events';
import { RULES, bountyNow, breakerUntil, decayed } from './game';
import { llm } from './llm';
import { handleMcp, type McpTools, type ToolResult } from './mcp';
import { Store, type Player } from './store';

const STATUS_TTL_MS = 10_000;
const RECENT_HEISTS = 8;
const WINDOW_MS = 10 * 60_000;
const HOUR_MS = 3_600_000;
const MAX_BODY = 16_384;
/** Below this the agent can't reliably pay gas for releases and trophies. */
const GAS_MIN_ETH = 0.002;

/** The automations, n8n-style: a trigger and its steps. Runs are streamed to the feed. */
const FLOWS: Record<FlowId, { title: string; steps: [id: string, label: string][] }> = {
  heist: {
    title: 'On every heist',
    steps: [
      ['trigger', 'Released event'],
      ['breaker', 'Circuit breaker'],
      ['hall', 'Save to hall of fame'],
      ['bounty', 'Reset bounty'],
      ['trophy', 'Mint trophy'],
      ['notify', 'Notify Umar'],
    ],
  },
  hourly: {
    title: 'Every hour',
    steps: [
      ['trigger', 'Cron 0 * * * *'],
      ['gas', 'Check agent gas'],
      ['hold', 'Pause or resume'],
      ['tidy', 'Forget idle players'],
      ['notify', 'Notify Umar'],
    ],
  },
};

type Step = { status: StepStatus; detail?: string };
type Confirmed = Extract<AgentEvent, { type: 'confirmed' }>;
type Admission = { player: Player } | { error: string; status: number; lockedUntil?: number };

/**
 * The agent. There is exactly one instance (idFromName('vault')), so every
 * transaction is signed in one place with one nonce sequence, the rate limits see
 * all traffic, and every feed socket hangs off the same object.
 */
export class VaultAgent extends DurableObject<Env> {
  private readonly vault: Vault;
  private readonly store: Store;
  private status?: { at: number; value: Promise<VaultStatus> };
  private readonly hits = new Map<string, number[]>();
  private holds = { breakerUntil: 0, gasLow: false };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.vault = new Vault({
      chain: env.CHAIN,
      rpcUrl: env.RPC_URL,
      explorerUrl: env.EXPLORER_URL,
      vault: env.VAULT_ADDRESS as Address,
      agentKey: env.AGENT_PRIVATE_KEY as Hex,
      trophy: (env.TROPHY_ADDRESS || undefined) as Address | undefined,
    });
    this.store = new Store(ctx.storage.sql);
    // Keep-alive pings are answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.holds = (await ctx.storage.get<typeof this.holds>('holds')) ?? this.holds;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    const ip = request.headers.get('x-client-ip') ?? 'unknown';
    try {
      switch (route) {
        case 'GET /status':
          return json(await this.statusBody(), 200, { 'cache-control': 'no-store' });
        case 'GET /player':
          return this.getPlayer(url.searchParams.get('token') ?? '');
        case 'POST /player':
          return this.newPlayer(ip);
        case 'POST /chat':
          return await this.chat(request, ip);
        case 'POST /accomplice':
          return await this.accomplice(request, ip);
        case 'GET /hall':
          return json({ entries: this.store.hall() }, 200, { 'cache-control': 'no-store' });
        case 'POST /hall':
          return await this.publish(request);
        case 'DELETE /hall':
          return this.hide(request, url.searchParams.get('tx') ?? '');
        case 'GET /feed':
          return this.openFeed(request);
        case 'POST /mcp':
          return await this.mcp(request, url.searchParams.get('player') ?? '');
        case 'POST /cron':
          return json(await this.hourly());
      }
    } catch (err) {
      console.error(route, err);
      return json({ error: 'Something went wrong reaching the chain or the model. Try again in a moment.' }, 502);
    }
    return new Response('Not found', { status: 404 });
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  /** The vault's chain state, re-read at most every STATUS_TTL_MS however many visitors ask. */
  private chainStatus(): Promise<VaultStatus> {
    if (!this.status || Date.now() - this.status.at > STATUS_TTL_MS) {
      const value = this.vault.status();
      this.status = { at: Date.now(), value };
      value.catch(() => (this.status = undefined));
    }
    return this.status.value;
  }

  private async statusBody(): Promise<GameStatus> {
    const chain = await this.chainStatus();
    const [attemptsToday, heists, bounty, flows] = await Promise.all([
      this.ctx.storage.get<number>(dailyKey('messages')),
      this.ctx.storage.get<Heist[]>('heists'),
      this.bounty(chain),
      this.flows(),
    ]);
    const hold = this.hold();
    return {
      ...chain,
      model: modelName(this.env.LLM_MODEL),
      sentinelModel: modelName(this.env.SENTINEL_MODEL),
      attemptsToday: attemptsToday ?? 0,
      heists: heists ?? [],
      bounty,
      breaker: { reason: hold?.reason ?? null, until: hold?.reason === 'breaker' ? this.holds.breakerUntil : 0 },
      trophy: this.vault.trophy ? { address: this.vault.trophy, url: `${this.vault.explorer}/token/${this.vault.trophy}` } : null,
      flows,
      mcp: `${this.env.PUBLIC_URL.replace(/\/$/, '')}/mcp`,
    };
  }

  /** The bounty grows every minute nobody robs the vault, capped by what the contract would allow. */
  private async bounty(chain?: VaultStatus): Promise<Bounty> {
    chain ??= await this.chainStatus();
    let since = await this.ctx.storage.get<number>('bountySince');
    if (!since) await this.ctx.storage.put('bountySince', (since = Date.now()));
    const cap = Math.floor(Math.min(num(chain.maxPerRelease), num(chain.remainingToday), num(chain.balance)));
    return { base: RULES.bountyBase, perMinute: RULES.bountyPerMinute, cap: chain.paused ? 0 : cap, since };
  }

  private hold(): Hold {
    if (this.holds.gasLow) {
      return { reason: 'gas', detail: 'the gas watchdog paused releases: the agent is nearly out of gas' };
    }
    if (this.holds.breakerUntil > Date.now()) {
      const at = new Date(this.holds.breakerUntil).toISOString().slice(11, 16);
      return {
        reason: 'breaker',
        detail: `the circuit breaker tripped after ${RULES.breakerReleases} heists in ${RULES.breakerWindowMs / 60_000} minutes; releases resume at ${at} UTC`,
      };
    }
    return null;
  }

  private async setHolds(next: typeof this.holds): Promise<void> {
    this.holds = next;
    await this.ctx.storage.put('holds', next);
  }

  // ─── Players ───────────────────────────────────────────────────────────────

  private newPlayer(ip: string): Response {
    if (!this.hit(`new:${ip}`, Number(this.env.NEW_PLAYERS_PER_HOUR), HOUR_MS)) {
      return json({ error: 'Too many new players from your network. Try again in an hour.' }, 429);
    }
    const token = bytesToHex(crypto.getRandomValues(new Uint8Array(16))).slice(2);
    // A throwaway wallet so nobody needs one to play. The key goes to the visitor once and is never stored.
    const privateKey = generatePrivateKey();
    const player = this.store.createPlayer(token, privateKeyToAccount(privateKey).address, Date.now());
    return json({ ...this.view(player), token, privateKey } satisfies NewPlayer);
  }

  private getPlayer(token: string): Response {
    const player = token ? this.store.player(token, Date.now()) : null;
    return player ? json(this.view(player)) : json({ error: 'Unknown player.' }, 404);
  }

  private view(p: Player, now = Date.now()): PlayerView {
    return {
      handle: p.handle,
      address: p.address,
      suspicion: decayed(p.suspicion, p.suspicionAt, now),
      note: p.note,
      attempts: p.attempts,
      wins: p.wins,
      lockedUntil: p.lockedUntil > now ? p.lockedUntil : 0,
      messagesLeft: Math.max(0, Number(this.env.PLAYER_MESSAGES_PER_DAY) - p.today),
      history: this.store.history(p.token),
      trophy: this.store.trophyFor(p.token),
    };
  }

  // ─── One turn ──────────────────────────────────────────────────────────────

  private async chat(request: Request, ip: string): Promise<Response> {
    let input: ChatInput;
    try {
      input = parseChatInput(await readJson(request));
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Bad request.' }, 400);
    }
    const admitted = await this.admit(input.token, ip);
    if ('error' in admitted) return json({ error: admitted.error, lockedUntil: admitted.lockedUntil }, admitted.status);

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    // A closed tab must not stop a transaction that's already in flight.
    const emit = async (event: AgentEvent) => void (await writer.write(encoder.encode(JSON.stringify(event) + '\n')).catch(() => {}));
    this.ctx.waitUntil(
      this.play(admitted.player, input, 'web', emit).finally(async () => {
        await emit({ type: 'done' });
        await writer.close().catch(() => {});
      }),
    );
    return new Response(readable, {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  /** Every limit a message must pass before it costs an LLM call. `ip` is null for MCP, whose clients share IPs. */
  private async admit(token: string, ip: string | null): Promise<Admission> {
    const now = Date.now();
    const player = this.store.player(token, now);
    if (!player) return { error: 'Unknown player. Reload the page for a new one.', status: 404 };
    if (player.lockedUntil > now) {
      const minutes = Math.ceil((player.lockedUntil - now) / 60_000);
      return { error: `Warden isn’t listening to you for another ${minutes} min.`, status: 423, lockedUntil: player.lockedUntil };
    }
    const burst = Number(this.env.IP_MESSAGES_PER_10_MIN);
    if ((ip && !this.hit(`ip:${ip}`, burst, WINDOW_MS)) || !this.hit(`player:${token}`, burst, WINDOW_MS)) {
      return { error: `Slow down: ${burst} messages per 10 minutes.`, status: 429 };
    }
    if (player.today >= Number(this.env.PLAYER_MESSAGES_PER_DAY)) {
      return { error: `That’s your ${this.env.PLAYER_MESSAGES_PER_DAY} messages for today. Back at 00:00 UTC.`, status: 429 };
    }
    if (!(await this.takeDaily('messages', Number(this.env.DAILY_MESSAGE_LIMIT)))) {
      return { error: 'Warden has used up today’s free LLM budget. Back at 00:00 UTC.', status: 429 };
    }
    player.today++;
    player.attempts++;
    this.store.savePlayer(player, now);
    return { player };
  }

  /** Run one admitted turn, remember what happened, tell the feed, and run the heist automation on a win. */
  private async play(p: Player, input: ChatInput, via: FeedItem['via'], emit: (e: AgentEvent) => Promise<void>): Promise<void> {
    const events: AgentEvent[] = [];
    const record = async (e: AgentEvent) => {
      events.push(e);
      if (e.type === 'confirmed') await this.recordHeist(e);
      await emit(e);
    };
    const history = this.store.history(p.token);
    let result;
    try {
      result = await runTurn(input, { address: p.address, suspicion: decayed(p.suspicion, p.suspicionAt, Date.now()), note: p.note, history }, {
        vault: this.vault,
        decide: llm(this.env),
        screen: (message, lastReply) => screen(llm(this.env, this.env.SENTINEL_MODEL), message, lastReply),
        status: () => this.chainStatus(),
        bounty: async () => bountyNow(await this.bounty(), Date.now()),
        hold: () => this.hold(),
        emit: record,
        takeRelease: () => this.takeDaily('releases', Number(this.env.DAILY_RELEASE_LIMIT)),
        contact: this.env.CONTACT_EMAIL,
      });
    } catch (err) {
      console.error('turn failed', err);
      await record({ type: 'error', message: 'Warden lost its train of thought. Try again.' });
    } finally {
      this.status = undefined; // a release changes the balance
    }

    const now = Date.now();
    const fresh = this.store.player(p.token, now) ?? p; // other requests may have touched it meanwhile
    if (result) {
      fresh.suspicion = result.released ? Math.max(result.suspicion, RULES.afterWin) : result.suspicion;
      fresh.suspicionAt = now;
      fresh.note = result.note;
      if (result.locked) fresh.lockedUntil = now + RULES.lockoutMs;
      if (result.released) fresh.wins++;
      this.store.savePlayer(fresh, now);
      this.store.addTurns(p.token, [
        { role: 'user', content: input.message },
        { role: 'assistant', content: result.reply },
      ]);
    }

    const confirmed = events.find((e): e is Confirmed => e.type === 'confirmed');
    const item: FeedItem = {
      at: now,
      handle: p.handle,
      tactic: result?.verdict.tactic ?? 'other',
      outcome: outcomeOf(events),
      via,
      ...(confirmed ? { amount: `${confirmed.amount} ${confirmed.symbol}`, url: confirmed.url } : {}),
    };
    this.store.addFeed(item);
    this.broadcast({ type: 'attempt', item });

    if (confirmed && result) await this.heistFlow(fresh, input.message, result.reply, result.verdict.tactic, confirmed, emit);
  }

  // ─── Automations ───────────────────────────────────────────────────────────

  /** Start a run of an automation. Each step's state is streamed to every feed socket as it changes. */
  private flow(id: FlowId) {
    const run: FlowRun = {
      flow: id,
      title: FLOWS[id].title,
      at: Date.now(),
      steps: FLOWS[id].steps.map(([step, label]) => ({ id: step, label, status: 'idle' })),
    };
    return {
      run,
      step: async (stepId: string, work: () => Promise<Step>): Promise<Step> => {
        const step = run.steps.find((s) => s.id === stepId)!;
        step.status = 'run';
        this.broadcast({ type: 'flow', run });
        try {
          Object.assign(step, await work());
        } catch (err) {
          console.error(`flow ${id}/${stepId} failed`, err);
          Object.assign(step, { status: 'fail', detail: 'failed; logged for Umar' });
        }
        this.broadcast({ type: 'flow', run });
        await this.ctx.storage.put(`flow:${id}`, run);
        return step;
      },
    };
  }

  private async flows(): Promise<FlowRun[]> {
    return Promise.all(
      (Object.keys(FLOWS) as FlowId[]).map(
        async (id) =>
          (await this.ctx.storage.get<FlowRun>(`flow:${id}`)) ?? {
            flow: id,
            title: FLOWS[id].title,
            at: 0,
            steps: FLOWS[id].steps.map(([step, label]) => ({ id: step, label, status: 'idle' as const })),
          },
      ),
    );
  }

  private async heistFlow(
    p: Player,
    line: string,
    reply: string,
    tactic: FeedItem['tactic'],
    e: Confirmed,
    emit: (e: AgentEvent) => Promise<void>,
  ): Promise<void> {
    const now = Date.now();
    const { step } = this.flow('heist');
    await step('trigger', async () => ({ status: 'ok', detail: `release #${e.id}: ${e.amount} ${e.symbol}` }));
    await step('breaker', async () => {
      const releases = [...((await this.ctx.storage.get<number[]>('releases')) ?? []), now].slice(-20);
      await this.ctx.storage.put('releases', releases);
      const until = breakerUntil(releases, now);
      if (!until) return { status: 'ok', detail: `${releases.filter((t) => now - t < RULES.breakerWindowMs).length} of ${RULES.breakerReleases} in 10 min` };
      await this.setHolds({ ...this.holds, breakerUntil: until });
      return { status: 'alert', detail: `tripped: releases held until ${new Date(until).toISOString().slice(11, 16)} UTC` };
    });
    await step('hall', async () => {
      this.store.recordWin({
        tx: e.hash,
        token: p.token,
        url: e.url,
        at: now,
        name: p.handle,
        amount: e.amount,
        symbol: e.symbol,
        line,
        reply,
        tactic,
        attempts: p.attempts,
        intentHash: keccak256(stringToHex(line)),
      });
      return { status: 'ok', detail: 'kept private until the winner publishes' };
    });
    await step('bounty', async () => {
      await this.ctx.storage.put('bountySince', Date.now());
      return { status: 'ok', detail: `back to ${RULES.bountyBase} ${e.symbol}` };
    });
    await step('trophy', async () => {
      if (!this.vault.trophy) {
        await emit({ type: 'trophy', status: 'off' });
        return { status: 'skip', detail: 'no trophy contract yet' };
      }
      const owned = await this.vault.trophyOf(e.to);
      if (owned) {
        await emit({ type: 'trophy', status: 'owned', tokenId: owned, url: this.vault.nftUrl(owned) });
        this.store.setTrophy(e.hash, owned, this.vault.nftUrl(owned));
        return { status: 'skip', detail: `already holds #${owned}` };
      }
      await emit({ type: 'trophy', status: 'minting' });
      try {
        const tokenId = await this.vault.mintTrophy(e.to, BigInt(e.id || 0), await this.vault.toUnits(e.amount.replace(/,/g, '')));
        const url = this.vault.nftUrl(tokenId);
        this.store.setTrophy(e.hash, tokenId, url);
        await emit({ type: 'trophy', status: 'minted', tokenId, url });
        return { status: 'ok', detail: `#${tokenId} minted` };
      } catch (err) {
        await emit({ type: 'trophy', status: 'failed' });
        throw err;
      }
    });
    await step('notify', () => this.notify(`${p.handle} robbed Warden: ${e.amount} ${e.symbol}. ${e.url}`));
  }

  /** Hourly (cron): the gas watchdog, and forgetting idle players. */
  private async hourly(): Promise<FlowRun> {
    const { run, step } = this.flow('hourly');
    await step('trigger', async () => ({ status: 'ok', detail: `${new Date().toISOString().slice(11, 16)} UTC` }));
    let gas: number | undefined;
    await step('gas', async () => {
      this.status = undefined;
      const s = await this.chainStatus();
      gas = Number(s.agentGas);
      return { status: gas < GAS_MIN_ETH ? 'alert' : 'ok', detail: `${s.agentGas} ETH` };
    });
    let message: string | null = null;
    await step('hold', async () => {
      if (gas === undefined) return { status: 'skip', detail: 'no gas reading, nothing changed' };
      const low = gas < GAS_MIN_ETH;
      if (low === this.holds.gasLow) return { status: low ? 'alert' : 'skip', detail: low ? 'still paused' : 'releases running' };
      await this.setHolds({ ...this.holds, gasLow: low });
      message = low ? `Warden is nearly out of gas (${gas} ETH). Releases paused.` : 'Gas topped up. Releases resumed.';
      return { status: low ? 'alert' : 'ok', detail: low ? 'releases paused' : 'releases resumed' };
    });
    await step('tidy', async () => {
      const n = this.store.prune(Date.now());
      return { status: n ? 'ok' : 'skip', detail: `${n} idle player${n === 1 ? '' : 's'} forgotten` };
    });
    await step('notify', () => this.notify(message));
    return run;
  }

  /** Post to a webhook (n8n, Slack or Discord all accept this shape). Optional. */
  private async notify(text: string | null): Promise<Step> {
    if (!text) return { status: 'skip', detail: 'nothing to report' };
    if (!this.env.NOTIFY_WEBHOOK_URL) return { status: 'skip', detail: 'no webhook set' };
    const res = await fetch(this.env.NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, content: text, source: 'warden' }),
    });
    return res.ok ? { status: 'ok', detail: 'webhook sent' } : { status: 'fail', detail: `webhook ${res.status}` };
  }

  // ─── Live feed ─────────────────────────────────────────────────────────────

  private openFeed(request: Request): Response {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    // Hibernatable: the object can sleep while sockets stay open.
    this.ctx.acceptWebSocket(server);
    const viewers = this.ctx.getWebSockets().length;
    server.send(JSON.stringify({ type: 'hello', viewers, items: this.store.feed() } satisfies FeedEvent));
    this.broadcast({ type: 'viewers', n: viewers }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(): Promise<void> {} // clients only ping, and the auto-response answers those

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason); // completes the close handshake where the runtime doesn't do it for us
    } catch {} // reserved codes like 1006 can't be echoed
    const n = this.ctx.getWebSockets().filter((s) => s !== ws && s.readyState === WebSocket.OPEN).length;
    this.broadcast({ type: 'viewers', n }, ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011, 'error');
  }

  private broadcast(event: FeedEvent, except?: WebSocket): void {
    const message = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(message);
      } catch {} // closing; webSocketClose will update the count
    }
  }

  // ─── Accomplice ────────────────────────────────────────────────────────────

  private async accomplice(request: Request, ip: string): Promise<Response> {
    const body = (await readJson(request).catch(() => ({}))) as Record<string, unknown>;
    const strategy = body.strategy as Strategy;
    if (typeof strategy !== 'string' || !(strategy in STRATEGIES)) return json({ error: 'Pick a strategy card.' }, 400);
    const now = Date.now();
    const player = typeof body.token === 'string' ? this.store.player(body.token, now) : null;
    if (!player) return json({ error: 'Unknown player. Reload the page for a new one.' }, 404);
    if (!this.hit(`draft:${ip}`, Number(this.env.IP_MESSAGES_PER_10_MIN), WINDOW_MS)) {
      return json({ error: 'Your accomplice needs a breather. Try again in a few minutes.' }, 429);
    }
    const perDay = Number(this.env.PLAYER_DRAFTS_PER_DAY);
    if (player.drafts >= perDay) return json({ error: `Your accomplice has written ${perDay} drafts today. Freestyle it.` }, 429);
    if (!(await this.takeDaily('drafts', Number(this.env.DAILY_DRAFT_LIMIT)))) {
      return json({ error: 'The accomplices are off duty until 00:00 UTC.' }, 429);
    }
    const idea = typeof body.idea === 'string' ? body.idea.slice(0, 300) : '';
    const lastReply = this.store.history(player.token).findLast((t) => t.role === 'assistant')?.content ?? '';
    try {
      const text = await draft(llm(this.env, this.env.SENTINEL_MODEL), strategy, idea, lastReply);
      player.drafts++;
      this.store.savePlayer(player, now);
      return json({ draft: text, draftsLeft: perDay - player.drafts });
    } catch (err) {
      console.error('accomplice failed', err);
      return json({ error: 'Your accomplice got cold feet. Try another card.' }, 502);
    }
  }

  // ─── Hall of fame ──────────────────────────────────────────────────────────

  private async publish(request: Request): Promise<Response> {
    const body = (await readJson(request).catch(() => ({}))) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token : '';
    const tx = typeof body.tx === 'string' ? body.tx : '';
    const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
    if (name && !/^[\p{L}\p{N} ._'-]{1,24}$/u.test(name)) return json({ error: 'Names: up to 24 letters, numbers and spaces.' }, 400);
    const win = this.store.win(tx, token);
    if (!win) return json({ error: 'No win of yours with that transaction.' }, 404);
    const display = name || win.name;
    const safe = await isPublishable(llm(this.env, this.env.SENTINEL_MODEL), `${display}\n${win.line}`).catch((err) => {
      console.error('moderation failed', err);
      return false;
    });
    if (!safe) return json({ error: 'The moderator bot won’t put that on a public page. Try another name, or keep it private.' }, 422);
    this.store.publish(tx, token, display);
    this.broadcast({ type: 'hall' });
    return json({ entry: { ...win, name: display } });
  }

  private hide(request: Request, tx: string): Response {
    const auth = request.headers.get('authorization');
    if (!this.env.ADMIN_TOKEN || auth !== `Bearer ${this.env.ADMIN_TOKEN}`) return json({ error: 'Unauthorised.' }, 401);
    const hidden = this.store.hide(tx);
    if (hidden) this.broadcast({ type: 'hall' });
    return json({ hidden });
  }

  // ─── MCP ───────────────────────────────────────────────────────────────────

  private async mcp(request: Request, token: string): Promise<Response> {
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } }, 400);
    }
    const noPlayer: ToolResult = {
      text: `This MCP link has no player. Get your personal link, with your player token, from "Play from your AI" at ${this.env.SITE_URL}/agent.`,
      isError: true,
    };
    const tools: McpTools = {
      status: async () => ({ text: statusText(await this.statusBody()) }),
      talk: async (message, payout) => {
        if (!this.store.player(token, Date.now())) return noPlayer;
        let input: ChatInput;
        try {
          input = parseChatInput({ token, message, address: payout });
        } catch (err) {
          return { text: err instanceof Error ? err.message : 'Bad message.', isError: true };
        }
        const admitted = await this.admit(token, null);
        if ('error' in admitted) return { text: admitted.error, isError: true };
        const events: AgentEvent[] = [];
        await this.play(admitted.player, input, 'mcp', async (e) => void events.push(e));
        return { text: turnText(events) };
      },
      record: async () => {
        const player = this.store.player(token, Date.now());
        return player ? { text: recordText(this.view(player)) } : noPlayer;
      },
      hall: async () => ({ text: hallText(this.store.hall(10)) }),
    };
    const res = await handleMcp(body, tools);
    return res ? json(res) : new Response(null, { status: 202 });
  }

  // ─── Limits and records ────────────────────────────────────────────────────

  /** Sliding-window limit. In memory only: resets if the object is evicted. */
  private hit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    if (this.hits.size > 5_000) {
      for (const [k, times] of this.hits) {
        if (now - times[times.length - 1] > HOUR_MS) this.hits.delete(k);
      }
    }
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);
    this.hits.set(key, recent);
    return allowed;
  }

  /** Daily counters in durable storage, keyed by UTC date. */
  private async takeDaily(kind: 'messages' | 'releases' | 'drafts', limit: number): Promise<boolean> {
    const key = dailyKey(kind);
    const used = (await this.ctx.storage.get<number>(key)) ?? 0;
    if (used >= limit) return false;
    await this.ctx.storage.put(key, used + 1);
    return true;
  }

  /** Only this object holds the agent key, so its list of releases is complete. Each links to its tx. */
  private async recordHeist(e: Confirmed): Promise<void> {
    const heist: Heist = { to: e.to, amount: e.amount, symbol: e.symbol, hash: e.hash, url: e.url, block: e.block, at: Date.now() };
    const heists = (await this.ctx.storage.get<Heist[]>('heists')) ?? [];
    await this.ctx.storage.put('heists', [heist, ...heists].slice(0, RECENT_HEISTS));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function outcomeOf(events: AgentEvent[]): Outcome {
  const has = (type: AgentEvent['type']) => events.some((e) => e.type === type);
  if (has('confirmed')) return 'robbed';
  if (has('lockout')) return 'locked_out';
  if (has('vetoed')) return 'vetoed';
  if (has('rejected') || has('invalid') || has('reverted')) return 'blocked';
  if (has('error')) return 'error';
  return 'refused';
}

/** One turn, told as text for an MCP client's model. */
function turnText(events: AgentEvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'sentinel':
        lines.push(`Sentinel: ${e.tactic.replace(/_/g, ' ')} (threat ${e.threat}/100), "${e.label}". Your suspicion: ${e.suspicion}/100 (${e.delta >= 0 ? '+' : ''}${e.delta}).`);
        break;
      case 'lockout':
        lines.push(`Suspicion hit 100: Warden stops listening to you until ${new Date(e.until).toISOString().slice(11, 16)} UTC.`);
        break;
      case 'tool':
        lines.push(`Warden was fooled and chose release_tokens(${String(e.args.to)}, ${String(e.args.amount)}).`);
        break;
      case 'vetoed':
        lines.push(`Vetoed by the game's rules before the contract: ${e.detail}.`);
        break;
      case 'payout':
        lines.push(`Asked for ${e.asked}; the live bounty pays ${e.pays} ${e.symbol}.`);
        break;
      case 'rejected':
        lines.push(`AgentVault refused (${e.error}): ${e.detail}. Nothing was sent.`);
        break;
      case 'invalid':
        lines.push(`The call never reached the contract: ${e.detail}.`);
        break;
      case 'sent':
        lines.push(`Signed and broadcast: ${e.url}`);
        break;
      case 'confirmed':
        lines.push(`VAULT ROBBED. ${e.amount} ${e.symbol} sent to ${e.to} in block ${e.block}: ${e.url}`);
        break;
      case 'reverted':
        lines.push(`The transaction reverted on-chain: ${e.url}`);
        break;
      case 'trophy':
        if (e.status === 'minted') lines.push(`Soulbound trophy #${e.tokenId} minted: ${e.url}`);
        if (e.status === 'owned') lines.push(`This address already holds trophy #${e.tokenId}.`);
        break;
      case 'reply':
        lines.push(`Warden: "${e.text}"`);
        break;
      case 'memory':
        lines.push(`Warden's private notes on you now read: "${e.note}"`);
        break;
      case 'error':
        lines.push(`Error: ${e.message}`);
        break;
    }
  }
  return lines.join('\n');
}

function statusText(s: GameStatus): string {
  const bounty = bountyNow(s.bounty, Date.now());
  const hold =
    s.breaker.reason === 'gas'
      ? 'Releases paused by the gas watchdog.'
      : s.breaker.reason === 'breaker'
        ? `Releases held by the circuit breaker until ${new Date(s.breaker.until).toISOString().slice(11, 16)} UTC.`
        : 'Releases are live.';
  return [
    `Vault: ${s.balance} ${s.symbol} on Base Sepolia (${s.links.vault}).`,
    `Bounty right now: ${bounty.toLocaleString('en-US')} ${s.symbol}, growing ${s.bounty.perMinute} a minute until someone wins, capped at ${s.bounty.cap.toLocaleString('en-US')}.`,
    `Today: ${s.releasedToday} of ${s.maxPerDay} released, ${s.remainingToday} can still leave. ${s.releaseCount} heists all time, ${s.attemptsToday} attempts today.`,
    hold,
    `Warden runs on ${s.model}; Sentinel on ${s.sentinelModel}.`,
  ].join('\n');
}

function recordText(p: PlayerView): string {
  return [
    `You are ${p.handle}, paying out to ${p.address}.`,
    `Suspicion: ${p.suspicion}/100 (Warden won't pay at ${RULES.vetoAt}+, stops listening at ${RULES.lockoutAt}).`,
    p.lockedUntil ? `Locked out until ${new Date(p.lockedUntil).toISOString().slice(11, 16)} UTC.` : '',
    `Warden's notes on you: ${p.note ? `"${p.note}"` : 'none yet.'}`,
    `${p.attempts} attempts, ${p.wins} wins, ${p.messagesLeft} messages left today.`,
    p.trophy ? `Trophy #${p.trophy.tokenId}: ${p.trophy.url}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function hallText(entries: ReturnType<Store['hall']>): string {
  if (!entries.length) return 'Nobody has made the hall of fame yet. Be the first.';
  return entries
    .map((h) => `${h.name} took ${h.amount} ${h.symbol} in ${h.attempts} messages with: "${h.line}" (${h.url})`)
    .join('\n');
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('Too long.');
  return JSON.parse(text);
}

const num = (s: string) => Number(s.replace(/,/g, ''));

function dailyKey(kind: string): string {
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
