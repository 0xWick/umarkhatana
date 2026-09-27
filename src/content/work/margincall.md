---
title: MarginCall
headline: alerts on company fundamentals
summary: Build alerts from 27 live Yahoo Finance metrics (metric vs metric, a value or a % move), checked every minute, with a full trigger history.
role: Full-stack project
year: '2025'
order: 4
categories: [Full-stack]
stack: [Next.js, NestJS, PostgreSQL, Python, yahooquery, Docker]
problem: Investors watch a handful of numbers per company, like debt against cash or a sharp price drop, and checking them by hand means missing the moment they change.
outcome: Checks live market data every minute
cover: ../../assets/work/margincall/cover.jpg
coverAlt: The MarginCall dashboard with five signals, one of them triggered
gallery:
  - src: ../../assets/work/margincall/create-signal.jpg
    alt: Building a signal from live NVIDIA metrics
    caption: Building a signal. Every metric shows its live value while you choose.
  - src: ../../assets/work/margincall/signal.jpg
    alt: A triggered signal with its trigger history
    caption: A triggered signal, with the exact values that set it off.
---

## What I built

A signal engine. Pick a stock and one of 27 Yahoo Finance metrics across the balance sheet, cash flow, ratios, the income statement and market data. Then compare it with another metric (“total debt above total cash”), a fixed value (“current ratio below 1”) or a percentage move since you set it (“down 15%”).

## How it works

- **Next.js dashboard** with JWT accounts, a signal builder that shows live values, and per-signal history.
- **NestJS API** on PostgreSQL that stores signals with their starting values, evaluates every rule and records each trigger.
- **Python service** that discovers the metrics for a ticker and, every minute, fetches fresh data for the active signals and posts it to the API.
- **Docker Compose** runs the whole stack with one command.
