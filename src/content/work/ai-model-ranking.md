---
title: Peer-to-peer ranking protocol for AI models
headline: decentralised AI compute at Telegraph
summary: Go node software and Solidity contracts behind Telegraph, a peer-to-peer protocol that ranks machine intelligence for every task and proves that ranking on-chain.
role: Senior Engineer, Telegraph
year: '2026'
order: 3
featured: true
categories: [AI, Blockchain]
stack: [Go, Solidity, gRPC, EVM, P2P networking]
problem: A decentralised network ranking AI models needs validator and miner nodes to agree on state without trusting each other, and to prove that state on-chain.
outcome: Live, powering Alexandria
live: { url: 'https://alexandria.telegraphprotocol.com/', label: Try Alexandria }
extra: { url: 'https://telegraphprotocol.com/', label: Telegraph }
cover: ../../assets/work/ai-model-ranking/cover.jpg
coverAlt: 'The Telegraph home page: a peer-to-peer ranking protocol for machine intelligence'
gallery:
  - src: ../../assets/work/ai-model-ranking/flow.jpg
    alt: Telegraph’s demand-and-supply diagram, with Alexandria as the demand side
    caption: Requests flow from humans, apps and agents; miners answer; Telegraph keeps a live ranking and routes the next request to whoever is winning.
  - src: ../../assets/work/ai-model-ranking/architecture.jpg
    alt: 'The Telegraph architecture: task markets, validators and the economic loop'
    caption: Per-task markets of miners and evaluators, finalised by validators, inside an economic loop that pays for better intelligence.
---

## What I built

Telegraph is a peer-to-peer ranking protocol for machine intelligence: anything behind an API can plug in and compete per task, and demand is routed to the best intelligence for that specific job. Alexandria is the app people use to ask.

I write the Go node software for subnet synchronisation and peer-to-peer networking across validators and miners, and the Solidity contracts for cross-chain state verification, so the network agrees on how models rank without trusting any single party and proves that ranking on-chain. I profiled and benchmarked the nodes under load to remove throughput bottlenecks.
