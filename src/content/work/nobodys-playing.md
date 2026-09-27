---
title: Nobody’s Playing
headline: a live war run by AI agents, n8n and Chainlink
summary: A war game with no players. AI generals, n8n workflows, Chainlink prices, real weather and an on-chain ledger run it on Cloudflare every 30 minutes. Just watch.
role: Personal project
year: '2026'
order: 2
featured: true
categories: [AI, Blockchain]
stack: [Solidity, Foundry, Chainlink, n8n, Groq, viem, Cloudflare Workers, Durable Objects, Discord]
problem: Clients have heard of AI agents, n8n, oracles and blockchains, but can’t picture what each one does, or what they look like working together in one system.
outcome: Live on Base Sepolia
live: { url: 'https://nobodysplaying.umarkhatana.com', label: Watch the war }
code: https://github.com/0xWick/agentistan
cover: ../../assets/work/nobodys-playing/cover.jpg
coverAlt: 'The simple view: tech tiles for Cloudflare, n8n, AI, Chainlink, weather and blockchain, with the map, narrator and score'
gallery:
  - src: ../../assets/work/nobodys-playing/live.jpg
    alt: The nerd view with the timeline, Decision Theater and counters
    caption: The nerd view. A timeline, the Decision Theater where a general explains its order, and a Tech Lens that turns every event into plain English plus a business analogy.
  - src: ../../assets/work/nobodys-playing/business.jpg
    alt: The same live game seen as a business, castles as clients and armies as teams
    caption: “See it as your business” rewrites the live game in a company’s words, and each tile shows what that tech would do for a business.
  - src: ../../assets/work/nobodys-playing/mobile.jpg
    alt: The war on a phone
    caption: On a phone.
---

## What I built

A war game with no players. Two AI generals read the board through tools and give one order every 30 minutes. The world runs on a Cloudflare Worker and a Durable Object, on the free tier, with nothing running on a PC. n8n drives the turns and keeps the world in sync with real markets and real weather. Every capture is written to a Base Sepolia contract that reads Chainlink itself.

## How it works

- **AI agents.** Each general gets a situation report, checks the map through tools with attack odds, gives one order and keeps a journal.
- **n8n automations.** Hosted on Render: the turn router, a market sync every 10 minutes, a weather sync every 15, and a War Correspondent that posts round reports and big moments to Discord.
- **Chainlink oracle.** ETH, BTC and LINK feeds on Base Sepolia. Each treasury is held in a coin, so every 1% move wins or loses 100 gold a turn. The season’s trend sets fighting strength, up to ±40%, and LINK sets soldier prices for both sides.
- **Real weather.** Five map regions are each dealt a real city every season (hot, cold, wet, tropical and changeable, such as Lahore, Moscow, London, Mumbai and New York) through Open-Meteo. Each kind of weather changes movement, food or fighting on its own ground.
- **Blockchain ledger.** `RealmLedger` records every capture and season result, stamped with the oracle price.
- **Two views.** A simple view with a narrator that tells the season in plain sentences, and a nerd view with the Decision Theater, a timeline, and a Tech Lens that turns every event into plain English plus a business analogy.

## Try it on your own business

The same agent runs a free [automation plan tool](https://nobodysplaying.umarkhatana.com/#plan): describe your business, or pick a clinic, accounting firm or fintech, and it drafts a 2–3 step plan for what I could automate for you.
