// Public edge of the agent: CORS and routing. All state lives in the VaultAgent
// Durable Object.
//
//   GET    /status       live vault state, bounty, automations
//   POST   /player       a new player with a throwaway wallet
//   GET    /player       ?token=… the player's suspicion, notes and history
//   POST   /chat         { token, message, address? } → NDJSON stream of AgentEvents
//   POST   /accomplice   { token, strategy, idea? } → a drafted attack
//   GET    /hall         the public hall of fame
//   POST   /hall         { token, tx, name } publish your own win
//   DELETE /hall         ?tx=… hide an entry (Bearer ADMIN_TOKEN)
//   GET    /feed         WebSocket: live attempts, viewers, automation runs
//   POST   /mcp          ?player=… MCP (Streamable HTTP, stateless, tools only)
//   cron   hourly        gas watchdog and tidy-up

export { VaultAgent } from './vault-agent';

const ROUTES = new Set([
  'GET /status',
  'POST /player',
  'GET /player',
  'POST /chat',
  'POST /accomplice',
  'GET /hall',
  'POST /hall',
  'DELETE /hall',
  'GET /feed',
  'POST /mcp',
]);

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    const mcp = url.pathname === '/mcp';

    // MCP clients connect from anywhere and send no cookies, so /mcp is open to every origin.
    const cors: Record<string, string> = mcp
      ? {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-session-id, authorization',
          'access-control-max-age': '86400',
        }
      : {
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
          'access-control-max-age': '86400',
          vary: 'origin',
        };
    if (!mcp && origin && allowed.includes(origin)) cors['access-control-allow-origin'] = origin;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (mcp && request.method !== 'POST') {
      // Stateless server: no SSE stream to open and no session to delete.
      return new Response('Method not allowed', { status: 405, headers: { ...cors, allow: 'POST, OPTIONS' } });
    }
    if (!ROUTES.has(`${request.method} ${url.pathname}`)) {
      return new Response('Not found', { status: 404, headers: cors });
    }
    // Browsers on other sites can't read the response anyway; don't spend LLM quota on them.
    const writes = request.method !== 'GET' || url.pathname === '/feed';
    if (!mcp && writes && origin && !allowed.includes(origin)) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }
    if (Number(request.headers.get('content-length')) > 16_384) {
      return new Response('Too long', { status: 413, headers: cors });
    }

    const agent = env.VAULT_AGENT.get(env.VAULT_AGENT.idFromName('vault'));
    const forwarded = new Request(`https://vault-agent${url.pathname}${url.search}`, request);
    forwarded.headers.set('x-client-ip', request.headers.get('cf-connecting-ip') ?? 'unknown');
    const res = await agent.fetch(forwarded);
    if (res.webSocket) return res; // the feed: hand the socket straight back

    const out = new Response(res.body, res);
    for (const [key, value] of Object.entries(cors)) out.headers.set(key, value);
    return out;
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    const agent = env.VAULT_AGENT.get(env.VAULT_AGENT.idFromName('vault'));
    ctx.waitUntil(agent.fetch('https://vault-agent/cron', { method: 'POST' }));
  },
} satisfies ExportedHandler<Env>;
