---
title: Decentralized Kameti
headline: savings circles with verifiable random payouts
summary: A rotating savings circle run by a smart contract. Chainlink VRF makes the draw and Chainlink Automation runs each round. Prize winner, Chainlink Fall 2022.
role: Hackathon project
year: '2022'
order: 9
categories: [Blockchain]
stack: [Solidity, Chainlink VRF, Chainlink Automation, Polygon ID, IPFS, Hardhat]
problem: A rotating savings group (ROSCA) depends on trusting whoever decides the payout order, and on every member being a real, distinct person.
outcome: Prize winner, Chainlink Fall 2022 Hackathon
extra: { url: 'https://devpost.com/software/decentralized-kameti', label: Devpost }
code: https://github.com/0xWick/Kameti
cover: ../../assets/work/decentralized-kameti/cover.jpg
coverAlt: The Decentralized Kameti Devpost card with its winner ribbon
coverFit: contain
---

## What I built

Across South Asia, millions of people save through kametis: a group pays in every month and one member takes the whole pool. It runs on trust in the organiser, and that’s where it breaks. This contract replaces the organiser.

## How it works

- **Create.** Anyone opens a kameti with its members, the monthly payment and an IPFS record of the details. The organiser has no control after that.
- **Draw.** Chainlink VRF provides randomness nobody controls to pick who is paid.
- **Pay and settle.** Members pay each round, and Chainlink Automation checks the round and pays the pool to its recipient.
- **Accountability.** If someone defaults, the on-chain record shows who, and Polygon ID ties that address to a verified identity without putting personal data on-chain.
