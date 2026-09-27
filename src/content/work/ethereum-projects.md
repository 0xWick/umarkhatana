---
title: Ethereum projects
headline: DeFi, security, NFTs and DAOs
summary: 27 smart-contract projects in one repo, from a Uniswap V1-style DEX and flash loans to exploit demos, NFT mints and a DAO.
role: Open source
year: '2022–2023'
order: 8
categories: [Blockchain]
stack: [Solidity, Hardhat, Brownie, Next.js, ethers.js, Chainlink, The Graph, IPFS]
problem: Every protocol pattern has its own traps. The fastest way to know them is to build each one, and to break a few on purpose.
outcome: 27 projects, each with its own README
code: https://github.com/0xWick/ethereum-projects
gallery:
  - src: ../../assets/work/ethereum-projects/dex.jpg
    alt: The Crypto Devs Exchange app
    caption: A Uniswap V1-style exchange with liquidity and swaps.
  - src: ../../assets/work/ethereum-projects/nft.jpg
    alt: The Crypto Devs NFT mint page
    caption: An NFT collection with a whitelist presale.
  - src: ../../assets/work/ethereum-projects/flash-loan.jpg
    alt: Diagram of a flash loan borrowed and repaid in one transaction
    caption: Aave V3 flash loans, borrowed and repaid in one transaction.
---

## What’s inside

- **DeFi.** ZoomV1, a DEX on the Uniswap V1 design with a factory of constant-product pools, LP fees, slippage limits and token-to-token routing, covered by 25 tests. Also staking with hourly rewards, Aave flash loans and a token sale.
- **Security.** Reentrancy, denial of service, `delegatecall` storage takeovers, reading “private” data and predicting on-chain randomness. Each has a vulnerable contract, an attacker and a test that proves the exploit.
- **NFTs and tokens.** An NFT collection with whitelist presale, IPFS-hosted metadata, a Merkle-proof whitelist, and token lists.
- **Governance and infrastructure.** An NFT-holder DAO, a Chainlink VRF game indexed by The Graph, an ENS dapp and a mempool watcher.
