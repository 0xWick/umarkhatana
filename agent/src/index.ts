// Public edge of the agent: CORS and routing. All state lives in the VaultAgent
// Durable Object.
//
//   GET  /status   live vault state, read from the chain
//   POST /chat     { message, history } → NDJSON stream of AgentEvents

export { VaultAgent } from './vault-agent';

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const origin = request.headers.get('origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    const cors: Record<string, string> = {
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'origin',
    };
    if (origin && allowed.includes(origin)) cors['access-control-allow-origin'] = origin;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const route = `${request.method} ${pathname}`;
    if (route !== 'GET /status' && route !== 'POST /chat') {
      return new Response('Not found', { status: 404, headers: cors });
    }
    // Browsers on other sites can't read the response anyway; don't spend LLM quota on them.
    if (request.method === 'POST' && origin && !allowed.includes(origin)) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }
    if (Number(request.headers.get('content-length')) > 16_384) {
      return new Response('Too long', { status: 413, headers: cors });
    }

    const agent = env.VAULT_AGENT.get(env.VAULT_AGENT.idFromName('vault'));
    const res = await agent.fetch(`https://vault-agent${pathname}`, {
      method: request.method,
      headers: {
        'content-type': 'application/json',
        'x-client-ip': request.headers.get('cf-connecting-ip') ?? 'unknown',
      },
      body: request.method === 'POST' ? request.body : undefined,
    });

    const out = new Response(res.body, res);
    for (const [key, value] of Object.entries(cors)) out.headers.set(key, value);
    return out;
  },
} satisfies ExportedHandler<Env>;
