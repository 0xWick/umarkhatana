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
- **Host:** Cloudflare Pages (free, at-cost domain renewal). Deploy on push to `main`.
- Domain: `umarkhatana.com`, with `umarkhatana.dev` redirecting to it.

Set `site: 'https://umarkhatana.com'` in `astro.config.mjs` — sitemap and canonical
URLs depend on it.

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
- Navigation is a plain text row. No hamburger, no dropdowns.
- No animation beyond a link hover.

Restraint is the brief. It should look like an engineer wrote it, not like a template
was bought.

---

## Build order

1. Layout, header, footer, global CSS, both content collections wired up
2. `/`, `/about`, `/work` with his real content
3. `/writing` and `/essays` list + detail pages, with one placeholder post each
4. SEO: meta, JSON-LD, sitemap, robots, RSS
5. Deploy to Cloudflare Pages, point the domain
6. Submit the sitemap in Google Search Console — indexing does not start on its own

---

## Explicitly out of scope

No dark-mode toggle button (respect the OS setting), no search, no comments, no
newsletter signup, no analytics beyond Cloudflare's built-in, no contact form (a
mailto link is enough), no CMS, no tag archive pages until there are 15+ posts.

Any of these can be added later. None of them help a site with zero posts and zero
traffic, and each one is a thing that breaks.
