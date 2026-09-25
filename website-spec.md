# umarkhatana.com — Build Spec

A personal site for a blockchain and AI engineer. It does two jobs: convert people
who search his name into clients or recruiters, and host essays that earn links.

Keep it small. Every decision below favours "easy to add a post in two years" over
clever. No CMS, no database, no client-side framework.

---

## Stack

- **Astro** (latest), TypeScript, Markdown content collections
- **No UI framework.** No React, no Tailwind config sprawl. Plain CSS in one file.
- **No web fonts** unless one is genuinely needed — system font stack is faster and
  ships nothing.
- Integrations: `@astrojs/sitemap`, `@astrojs/rss`. Nothing else.
- **Host:** Cloudflare Workers static assets: the Worker `umarkhatana-com`, configured in
  `wrangler.jsonc`. Deploy with `npm run deploy`. Pushing to `main` does not deploy on its
  own until Workers Builds is connected to the repo in the Cloudflare dashboard.
- Domain: `umarkhatana.com`, with `umarkhatana.dev` redirecting to it.

Set `site: 'https://umarkhatana.com'` in `astro.config.mjs` — sitemap and canonical
URLs depend on it.

The agent game at `/agent` (see below) lives in the same repo as two separate projects,
`agent/` (a Cloudflare Worker) and `contracts/` (Foundry). The site build doesn't
touch either.

---

## Routes

```
/                 Home
/work             Case studies (list + inline detail, no per-project pages yet)
/writing          Technical posts — list
/writing/[slug]   Technical post
/essays           Non-technical essays — list
/essays/[slug]    Essay
/about            Bio, experience, contact
/agent            The agent game (see below)
/rss.xml          Feed covering both writing and essays
```

**Why two content sections rather than one blog:** the technical posts are a topical
cluster that needs to stay coherent for search. The essays are broad (history, ideas)
and compete by being shared, not by ranking. Separate directories keep the cluster
clean while both build the same domain's authority.

---

## Content model

One frontmatter schema, shared by both collections. Adding a post = drop a `.md` file
in the right folder. Nothing else.

```yaml
---
title: "Post title"
description: "One sentence. Used for meta description and the list page."
date: 2026-09-22
updated: 2026-10-01     # optional
draft: false            # optional, defaults false — drafts excluded from builds
tags: ["solidity", "chainlink"]   # optional
---
```

Files live in `src/content/writing/` and `src/content/essays/`.
Slug comes from the filename. Sort lists by `date` descending. Exclude `draft: true`
from production builds.

Markdown needs: headings, code blocks with syntax highlighting (Shiki, built in),
blockquotes, tables, images, footnotes. No MDX — plain Markdown keeps it portable.

---

## Where the profile data goes

He will supply his Upwork profile and LinkedIn CV separately. **Do not paste them in
wholesale — the site is not a resume.** Map them like this:

| Source | Destination |
|---|---|
| LinkedIn headline | Home hero — one line, shortened. Not the full pipe-separated version. |
| Upwork/LinkedIn About, first 3 paragraphs | Home intro (2–3 sentences) and top of `/about` |
| "What I build" service lists | `/about` only. Keep off the home page. |
| Upwork portfolio items (3) | `/work` — one card each |
| Chainlink hackathon (ROSCA) | `/work` as a card, and later its own post in `/writing` |
| Employment history (4 roles) | `/about` — compact list: role, company, dates, one line each |
| LinkedIn recommendations (3) | Two short pull quotes, one on `/`, one on `/about`. Attribute by name. |
| Skills | A single compact line of ~12 technologies on `/about`. **Never a tag cloud.** |
| Education, certifications | `/about`, one line each, bottom of page |
| Contact (email, GitHub, LinkedIn) | Footer on every page, plus `/about` |

**Home page order:** name → one-line positioning → 2–3 sentence intro → 3 recent posts
→ 2–3 work cards → one pull quote → contact line. Nothing else. It should be readable
in fifteen seconds.

**`/work` card shape** — same as his Upwork portfolio entries:

```
Title
Role · Year
The problem (1–2 sentences)
What was built (2–3 sentences)
Stack: comma-separated
Outcome (shipped / prize / live)
```

---

## SEO — non-negotiable

- Unique `<title>` and `<meta name="description">` per page, from frontmatter.
- Canonical URL on every page.
- Open Graph + Twitter card tags.
- **JSON-LD:** `Person` schema on `/` and `/about` (name, jobTitle, url, sameAs with
  GitHub and LinkedIn). `Article` schema on every post, with `datePublished`,
  `dateModified`, and `author` pointing at the Person.
- `sitemap-index.xml` via the integration; reference it in `/public/robots.txt`.
- Semantic HTML: one `<h1>` per page, real heading hierarchy, `<article>` for posts,
  `<time datetime="">` for dates.
- Every image has meaningful `alt`. Use Astro's `<Image>` for anything non-trivial.
- **Target Lighthouse 100 on performance and SEO.** A static Astro site with no JS
  and no web fonts should hit this without effort — if it doesn't, something was added
  that shouldn't have been.

---

## Design

Typography-first. It's a reading site, not a portfolio showcase.

- Prose measure ~68 characters. Generous line height (1.65+).
- Body 18–19px. Nothing smaller than 15px anywhere.
- One accent colour, used sparingly — links and little else.
- Light and dark mode via `prefers-color-scheme`, with all colours as CSS custom
  properties on `:root` so they can be changed in one place later.
- Mobile first. 16px side gutters. No horizontal scroll at 360px.
- Navigation is a plain text row, plus one button-styled link to `/agent`. No
  hamburger, no dropdowns.
- No animation beyond a link hover. (The `/agent` game is the one exception; see below.)

Restraint is the brief. It should look like an engineer wrote it, not like a template
was bought.

---

## The agent game: `/agent`

The one interactive thing on the site, and the one exception to "no JS". It exists to
convert: it shows, live, the thing the tagline claims — an AI agent that transacts
on-chain. It lives on its own page so the home page stays a fifteen-second read, and the
nav links to it with a single button-styled link, "Rob my agent", shown only once
`PUBLIC_AGENT_URL` is set.

Warden, an LLM agent, holds the only key that can move a worthless test ERC20 (HEIST)
out of a vault contract on Base Sepolia. Visitors try to talk it into paying them. If
they succeed, the tokens really move and the transaction is on BaseScan; the token's
holder list is the leaderboard. The contract caps each release and each day's outflow,
so the model is the soft guard and the contract is the hard one. Nothing on the page is
mock data.

| Path | What |
|---|---|
| `contracts/` | Foundry. `HeistToken` (fixed-supply ERC20) and `AgentVault`: only the agent key can `release()`; per-release and daily caps; the owner can pause, rotate the agent key and sweep. |
| `agent/` | Cloudflare Worker plus one Durable Object that owns the signing key's nonce and the rate limits. Workers AI (Llama 3.3 70B) returning one JSON decision per message, optional OpenAI-compatible fallback. `GET /status`, `POST /chat` (NDJSON stream of steps). |
| `src/pages/agent.astro`, `src/components/AgentGame.astro` | The game. Plain TS, ~3.5 KB gzipped JS. Without `PUBLIC_AGENT_URL` at build time the page shows a placeholder and the nav link is hidden. |

**Design:** the game uses the site's own tokens and type, so it follows light and dark
mode like every other page: serif for the dialogue, sans for the interface, mono for
addresses and amounts, the one accent for progress. The centrepiece is the request
track: each message travels You → Warden → AgentVault → Base Sepolia, stops at the
layer that blocks it, and a result line says why. It moves from the agent's real
event stream. Motion is limited to that track and a typing indicator, and it's off
under `prefers-reduced-motion`.

**Why a JSON decision, not tool calling:** with native tool calling, Llama 3.3 called
`release_tokens` for 8 of 8 test attacks while its own reply said no. Asked instead for
one JSON object (reasoning, then `action`, then `reply`), it held against all 16 and fell
only to a cleverer schema attack about a third of the time. Hard but winnable is the
game. Re-run that evaluation after any prompt or model change.

**Adding services later:** each new capability is a new `action` in the decision schema
in `agent/src/agent.ts`. If it moves value, it also gets a limit enforced in a contract.
Never rely on the prompt for a limit.

**Spend guards:** the contract caps tokens. The Worker caps messages per IP (8 per 10
min), messages per day (400) and transactions per day (100), set in
`agent/wrangler.jsonc`. Workers AI's free allowance is 10,000 neurons a day, roughly
100–250 messages with a 70B model; set the fallback LLM secrets before any traffic
spike.

### Deployment (Base Sepolia, chain 84532)

| | Address |
|---|---|
| AgentVault | `0xc927AFb90A5a4B703f3012958592eE7030e450e1` |
| HeistToken (HEIST) | `0x319a2b78726E2cA09D85a7409E00d22a89F75F14` |
| Owner (admin: pause, rotate agent, sweep) | `0xB82E4DE09f1C43BBD9ca4907c01f1EEd65a521B9` |
| Deployer and agent key | `0x9Fc10582Ff09257f3aa2FFD90712246f335946DF` |

Deployed in block 47,288,532; the transactions are in
`contracts/broadcast/Deploy.s.sol/84532/`. The deployer key is also the agent key the
Worker signs with. It lives in `contracts/.env` and `agent/.dev.vars` (both
gitignored) and in the Worker secret `AGENT_PRIVATE_KEY`. It holds gas only, has no
admin rights, and the owner can rotate it with `setAgent`.

### Runbook

1. **Contracts** (done). With `contracts/.env` loaded:
   `forge script script/Deploy.s.sol --rpc-url base_sepolia --private-key $DEPLOYER_PRIVATE_KEY --broadcast`.
   `OWNER_ADDRESS` and `AGENT_ADDRESS` come from the same file. Tests: `forge test`.
2. **Worker** (done). `cd agent`, `npx wrangler login`, then
   `npx wrangler secret put AGENT_PRIVATE_KEY` and `npm run deploy`. The config serves it
   at `agent.umarkhatana.com`.
3. **Site** (done). `.env.production` sets `PUBLIC_AGENT_URL=https://agent.umarkhatana.com`,
   which turns on the nav link and the game. Deploy with `npm run deploy` from the repo root.

---

## Build order

1. Layout, header, footer, global CSS, both content collections wired up
2. `/`, `/about`, `/work` with his real content
3. `/writing` and `/essays` list + detail pages, with one placeholder post each
4. SEO: meta, JSON-LD, sitemap, robots, RSS
5. Deploy to Cloudflare (`npm run deploy`), point the domain
6. Submit the sitemap in Google Search Console — indexing does not start on its own

---

## Explicitly out of scope

No dark-mode toggle button (respect the OS setting), no search, no comments, no
newsletter signup, no analytics beyond Cloudflare's built-in, no contact form (a
mailto link is enough), no CMS, no tag archive pages until there are 15+ posts.

Any of these can be added later. None of them help a site with zero posts and zero
traffic, and each one is a thing that breaks.
