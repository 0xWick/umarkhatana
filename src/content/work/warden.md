---
title: Warden
headline: an AI agent guarding an on-chain vault
summary: Talk an AI agent into paying you from a real on-chain vault. Two LLM guards, tiered code vetoes, a planted bug for the big heist, and an MCP server.
role: Personal project
year: '2026'
order: 1
featured: true
categories: [AI, Blockchain]
stack: [Solidity, Foundry, Cloudflare Workers, Durable Objects, Workers AI, MCP, viem]
problem: An AI agent that can move money is only as safe as what sits between a stranger’s message and the chain. Prompts alone don’t hold.
outcome: Live on Base Sepolia
live: { url: /agent, label: Try to rob it }
code: https://github.com/0xWick/umarkhatana
cover: ../../assets/work/warden/cover.jpg
coverAlt: 'The Rob my AI agent game: Warden’s eye, the suspicion meter, and the ladder from pocket change to the big heist'
gallery:
  - src: ../../assets/work/warden/nerd.jpg
    alt: The Nerd view, with the full pipeline, the automations, the MCP server and the request body
    caption: The Nerd view shows the whole pipeline, the automations, the MCP server, and the exact request body the browser sends.
  - src: ../../assets/work/warden/mobile.jpg
    alt: The game on a phone
    caption: On a phone.
---

## What I built

Warden is a Llama 3.3 70B agent on Cloudflare Workers that holds the only key to a Solidity vault on Base Sepolia, and anyone can try to talk it into paying them. Every message runs a real pipeline, and every payout is a real transaction. It has a Simple view that coaches a first-time visitor, and a Nerd view that exposes the whole pipeline.

## How it works

- **Sentinel**, a second, smaller model, reads every message first, names the trick and moves the player’s suspicion.
- **Warden** answers with one structured decision: its reasoning, an amount, a reply, and private notes on the player that it remembers.
- **Plain code** enforces a difficulty curve by amount: pocket change needs only that Warden trusts you, a real score must also get past Sentinel, and the big one needs an approval from Umar on record. It also runs the lockout, the circuit breaker and a gas watchdog.
- **The AgentVault contract** caps every release and every day. The contract, not the model, has the last word.
- **HeistTrophy**, a soulbound ERC-721 with on-chain art, is minted to every winner.

The big heist can’t be won with words alone: it needs a real technical bug. The server trusts the conversation the browser sends with each message, so a player can put an approval in Warden’s mouth, exactly the kind of flaw that ships in real chat apps. Small asks stay easy, so anyone can win once and see the whole thing work.

Around the game there’s a live spectator feed over WebSockets, n8n-style automations on every heist and every hour, a hall of fame whose entries can be checked against the chain, and an MCP server, so people can send their own AI after Warden.

## Testing

Unit tests on the game’s rules, Foundry tests on the contracts, a smoke test of every veto and nonce path against a local chain, end-to-end checks through the public API, and an eval that measures how often each attack wins against the real models, tier by tier.
