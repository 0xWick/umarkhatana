// Secrets, set with `wrangler secret put <NAME>` (or .dev.vars locally).
// Vars and bindings are generated into worker-configuration.d.ts by `npm run types`.
interface Env {
  AGENT_PRIVATE_KEY: string;
  FALLBACK_LLM_URL?: string;
  FALLBACK_LLM_KEY?: string;
  FALLBACK_LLM_MODEL?: string;
  NOTIFY_WEBHOOK_URL?: string;
  ADMIN_TOKEN?: string;
}
