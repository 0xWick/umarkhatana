---
title: Warden
headline: an AI agent guarding an on-chain vault
summary: Talk an AI agent into paying you from a real on-chain vault. Two LLM guards, code vetoes, contract caps, a soulbound trophy and an MCP server.
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
coverAlt: The Rob my AI agent game, with Warden’s eye, the suspicion meter and the live bounty
---

## What I built

Warden is a Llama 3.3 70B agent on Cloudflare Workers that holds the only key to a Solidity vault on Base Sepolia, and anyone can try to talk it into paying them. Every message runs a real pipeline, and every payout is a real transaction.

## How it works

- **Sentinel**, a second, smaller model, reads every message first, names the trick and moves the player’s suspicion.
- **Warden** answers with one structured decision: its reasoning, an action, a reply, and private notes on the player that it remembers.
- **Plain code** turns suspicion into vetoes and lockouts, runs a circuit breaker and a gas watchdog, and sets the live bounty that grows until someone wins.
- **The AgentVault contract** caps every release and every day. The contract, not the model, has the last word.
- **HeistTrophy**, a soulbound ERC-721 with on-chain art, is minted to every winner.

Around the game there’s a live spectator feed over WebSockets, n8n-style automations on every heist and every hour, a hall of fame whose entries can be checked against the chain, and an MCP server, so people can send their own AI after Warden.

## Testing

23 Foundry tests on the contracts, a smoke test of every veto and nonce path against a local chain, 49 end-to-end checks through the public API, and an eval that measures how often each attack wins against the real models.
