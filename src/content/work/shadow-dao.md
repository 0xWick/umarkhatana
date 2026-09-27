---
title: Shadow DAO
headline: a private DAO gated by zero-knowledge proofs
summary: Members prove a Polygon ID credential on-chain without revealing who they are, one identity per wallet, then propose, vote and fund from the treasury.
role: Hackathon project
year: '2023'
order: 7
categories: [Blockchain]
stack: [Solidity, Polygon ID, Zero-knowledge proofs, Hardhat, React, wagmi]
problem: A DAO wants one member, one vote, without collecting anyone’s identity.
outcome: Contracts, app and credential schemas in one repo
live: { url: 'https://polygon-id-frontend.vercel.app', label: See the app }
code: https://github.com/0xWick/Shadow-DAO
cover: ../../assets/work/shadow-dao/cover.jpg
coverAlt: The Shadow DAO app for a verified member, with proposals, treasury and pass rate
gallery:
  - src: ../../assets/work/shadow-dao/proof-request.jpg
    alt: The QR code proof request
    caption: Scan the proof request with the Polygon ID wallet.
  - src: ../../assets/work/shadow-dao/wallet.jpg
    alt: The Polygon ID wallet confirming the proof
    caption: The wallet proves membership. The DAO never sees who you are.
---

## What I built

A DAO where membership is a zero-knowledge proof. A member holds a `ProofOfDaoMembership` credential in their Polygon ID wallet and proves it to the contract. The contract verifies the proof on-chain and learns nothing else about the person.

## How it works

- **Credentials.** Members and the owner receive claims from an issuer, following the schemas in the repo.
- **Proofs.** The app shows a QR proof request; the wallet generates a zero-knowledge proof and submits it to the contract.
- **On-chain verification.** The DAO inherits Polygon ID’s `ZKPVerifier` and checks proofs with the credential-query validators.
- **Sybil resistance.** Each identity registers exactly one wallet. The owner can revoke a member, or reset an identity for a new wallet.
- **Governance.** Anyone can donate. Members create proposals and vote within a deadline, and passed proposals are paid from the treasury.
