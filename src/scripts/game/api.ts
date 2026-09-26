// The agent's HTTP and WebSocket API, typed with the agent's own wire format.
import type { AgentEvent, FeedEvent, GameStatus, HallEntry, NewPlayer, PlayerView, Strategy } from '../../../agent/src/events';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function api(endpoint: string) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${endpoint}${path}`, {
      cache: 'no-store',
      ...init,
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body.error ?? `Something went wrong (${res.status}).`, res.status, body);
    return body as T;
  }
  const post = (body: object): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

  return {
    status: () => call<GameStatus>('/status'),
    player: (token: string) => call<PlayerView>(`/player?token=${encodeURIComponent(token)}`),
    newPlayer: () => call<NewPlayer>('/player', { method: 'POST' }),
    accomplice: (token: string, strategy: Strategy, idea: string) =>
      call<{ draft: string; draftsLeft: number }>('/accomplice', post({ token, strategy, idea })),
    hall: () => call<{ entries: HallEntry[] }>('/hall'),
    publish: (token: string, tx: string, name: string) => call<{ entry: HallEntry }>('/hall', post({ token, tx, name })),

    /** One turn. Every AgentEvent is handed to `onEvent` as it streams in. */
    async chat(token: string, message: string, address: string | undefined, onEvent: (e: AgentEvent) => void): Promise<void> {
      const res = await fetch(`${endpoint}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, message, address }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.error ?? 'Something went wrong. Try again.', res.status, body);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (line) onEvent(JSON.parse(line) as AgentEvent);
        }
      }
    },

    /** The live feed, reconnecting with backoff. Pings keep proxies from closing it. */
    feed(onEvent: (e: FeedEvent) => void, onOpen: (open: boolean) => void): void {
      let delay = 1_000;
      const connect = () => {
        const ws = new WebSocket(`${endpoint.replace(/^http/, 'ws')}/feed`);
        let ping = 0;
        ws.onopen = () => {
          delay = 1_000;
          onOpen(true);
          ping = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 30_000);
        };
        ws.onmessage = (m) => {
          if (m.data !== 'pong') onEvent(JSON.parse(String(m.data)) as FeedEvent);
        };
        ws.onclose = () => {
          clearInterval(ping);
          onOpen(false);
          setTimeout(connect, delay);
          delay = Math.min(delay * 2, 30_000);
        };
      };
      connect();
    },
  };
}
