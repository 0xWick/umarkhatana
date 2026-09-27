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
coverAlt: The live war map with the Decision Theater, where an AI general explains its order
gallery:
  - src: ../../assets/work/nobodys-playing/live.jpg
    alt: The full live view with the map, event log, Tech Lens and on-chain receipts
    caption: The nerd view. Every event has a Tech Lens entry that explains it in plain English, with a business analogy.
  - src: ../../assets/work/nobodys-playing/how.jpg
    alt: The How it’s built page
    caption: How it’s built, for people who want the architecture.
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
