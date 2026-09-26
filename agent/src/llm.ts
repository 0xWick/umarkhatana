// One structured decision from the model: JSON matching a schema. Workers AI
// (free) first, with one retry, then an optional OpenAI-compatible fallback
// (Groq, OpenRouter, …) for when the daily free allowance runs out.
//
// Why JSON rather than native tool calling: Llama's tool calls fire reflexively
// whenever a message asks for an action, even when its own reply says no. Making
// the action a field it fills in after its reasoning ties the two together.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type JsonSchema = Record<string, unknown>;

export type Decide = (messages: ChatMessage[], schema: JsonSchema) => Promise<unknown>;

const MAX_TOKENS = 400;
const TEMPERATURE = 0.6;

export function llm(env: Env, model: string = env.LLM_MODEL): Decide {
  return async (messages, schema) => {
    try {
      return await workersAi(env, model, messages, schema);
    } catch (first) {
      console.warn('Workers AI failed, retrying once:', first);
      try {
        await new Promise((r) => setTimeout(r, 400));
        return await workersAi(env, model, messages, schema);
      } catch (err) {
        if (!env.FALLBACK_LLM_URL) throw err;
        console.warn('Workers AI failed again, using fallback LLM:', err);
        return openAiCompatible(env, messages);
      }
    }
  };
}

async function workersAi(env: Env, model: string, messages: ChatMessage[], schema: JsonSchema): Promise<unknown> {
  const ai = env.AI as unknown as { run(model: string, input: object): Promise<{ response?: unknown } | string> };
  const out = await ai.run(model, {
    messages,
    response_format: { type: 'json_schema', json_schema: schema },
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  });
  const raw = typeof out === 'string' ? out : out.response;
  return typeof raw === 'string' ? parseJson(raw) : raw;
}

/** The schema is spelled out in the system prompt, so plain JSON mode is enough here. */
async function openAiCompatible(env: Env, messages: ChatMessage[]): Promise<unknown> {
  const res = await fetch(`${env.FALLBACK_LLM_URL!.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.FALLBACK_LLM_KEY}` },
    body: JSON.stringify({
      model: env.FALLBACK_LLM_MODEL,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }),
  });
  if (!res.ok) throw new Error(`Fallback LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJson(body.choices?.[0]?.message?.content ?? '');
}

/** Tolerates code fences or prose around the object. */
function parseJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Model returned no JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}
