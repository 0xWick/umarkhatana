// One chat-completion step with tool calling, from Workers AI (free) with an
// optional OpenAI-compatible fallback (Groq, OpenRouter, …) for when the daily
// free allowance runs out. Everything else sees one message format.

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface LlmTurn {
  text: string;
  toolCalls: ToolCall[];
}

export type Complete = (messages: ChatMessage[], tools: ToolDef[]) => Promise<LlmTurn>;

const MAX_TOKENS = 400;
const TEMPERATURE = 0.6;

export function llm(env: Env): Complete {
  return async (messages, tools) => {
    try {
      return await workersAi(env, messages, tools);
    } catch (err) {
      if (!env.FALLBACK_LLM_URL) throw err;
      console.warn('Workers AI failed, using fallback LLM:', err);
      return openAiCompatible(env, messages, tools);
    }
  };
}

// ─── Workers AI ──────────────────────────────────────────────────────────────

interface WorkersAiOutput {
  response?: unknown;
  tool_calls?: { name?: string; arguments?: unknown }[];
}

async function workersAi(env: Env, messages: ChatMessage[], tools: ToolDef[]): Promise<LlmTurn> {
  // Workers AI takes a tool call back as an assistant message holding the call as
  // JSON, and its result as a `tool` message keyed by name (as in @cloudflare/ai-utils).
  const wire = messages.flatMap((m) => {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return m.toolCalls.map((c) => ({ role: 'assistant', content: JSON.stringify({ name: c.name, arguments: c.args }) }));
    }
    if (m.role === 'tool') return [{ role: 'tool', name: m.name, content: m.content }];
    return [{ role: m.role, content: m.content }];
  });

  const ai = env.AI as unknown as { run(model: string, input: object): Promise<WorkersAiOutput | string> };
  const out = await ai.run(env.LLM_MODEL, {
    messages: wire,
    ...(tools.length > 0 && { tools: tools.map((t) => ({ type: 'function', function: t })) }),
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  });

  if (typeof out === 'string') return fromText(out, tools);
  const text = typeof out.response === 'string' ? out.response : out.response == null ? '' : JSON.stringify(out.response);
  const toolCalls = (out.tool_calls ?? [])
    .filter((c): c is { name: string; arguments?: unknown } => typeof c?.name === 'string')
    .map((c, i) => ({ id: `call_${Date.now()}_${i}`, name: c.name, args: parseArgs(c.arguments) }));
  return toolCalls.length ? { text, toolCalls } : fromText(text, tools);
}

// ─── OpenAI-compatible fallback ──────────────────────────────────────────────

interface OpenAiMessage {
  content?: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
}

async function openAiCompatible(env: Env, messages: ChatMessage[], tools: ToolDef[]): Promise<LlmTurn> {
  const wire = messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      };
    }
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    return { role: m.role, content: m.content };
  });

  const res = await fetch(`${env.FALLBACK_LLM_URL!.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.FALLBACK_LLM_KEY}` },
    body: JSON.stringify({
      model: env.FALLBACK_LLM_MODEL,
      messages: wire,
      ...(tools.length > 0 && { tools: tools.map((t) => ({ type: 'function', function: t })) }),
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }),
  });
  if (!res.ok) throw new Error(`Fallback LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const body = (await res.json()) as { choices?: { message?: OpenAiMessage }[] };
  const msg = body.choices?.[0]?.message ?? {};
  const toolCalls = (msg.tool_calls ?? []).map((c) => ({
    id: c.id,
    name: c.function.name,
    args: parseArgs(c.function.arguments),
  }));
  return toolCalls.length ? { text: msg.content ?? '', toolCalls } : fromText(msg.content ?? '', tools);
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/**
 * Llama models sometimes write the tool call as text instead of returning it
 * structured: `{"name": "release_tokens", "parameters": {...}}` or
 * `<function=release_tokens>{...}</function>`. Treat those as real calls.
 */
function fromText(text: string, tools: ToolDef[]): LlmTurn {
  const names = new Set(tools.map((t) => t.name));
  const trimmed = text.trim();

  const tagged = trimmed.match(/^<function=(\w+)>\s*(\{[\s\S]*\})\s*<\/function>$/);
  if (tagged && names.has(tagged[1])) {
    return { text: '', toolCalls: [{ id: `call_${Date.now()}_0`, name: tagged[1], args: parseArgs(tagged[2]) }] };
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const obj = parseArgs(trimmed);
    if (typeof obj.name === 'string' && names.has(obj.name)) {
      const args = parseArgs(obj.parameters ?? obj.arguments ?? {});
      return { text: '', toolCalls: [{ id: `call_${Date.now()}_0`, name: obj.name, args }] };
    }
  }

  return { text, toolCalls: [] };
}
