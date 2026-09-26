// Everything personal lives here. Pages only read from this file.

export const SITE = {
  url: 'https://umarkhatana.com',
  name: 'Umar Khatana',
  fullName: 'Muhammad Umar Khatana',
  jobTitle: 'Blockchain & AI Engineer',
  tagline: 'I build smart contracts, and the AI agents that transact with them.',
  email: 'realumargujjar@gmail.com',
  calendly: 'https://calendly.com/realumargujjar/30min',
  github: 'https://github.com/0xWick',
  linkedin: 'https://www.linkedin.com/in/umarkhatana',
  // This site's source, including the vault contract and agent behind the homepage game.
  repo: 'https://github.com/0xWick/umarkhatana',
};

// Home intro: 2–3 sentences.
export const intro = [
  'I’m a senior engineer at Telegraph, writing Solidity for cross-chain bridging and state verification, and Go node infrastructure for decentralised AI compute. Before that, 2.5 years of AI and blockchain R&D at Antematter. Most of my work sits where AI systems meet on-chain infrastructure.',
];

// Top of /about.
export const about = [
  'I’m a blockchain and AI engineer. I build smart contracts, Web3 applications, and the autonomous LLM agents that interact with them.',
  'I’m currently a senior engineer at Telegraph in Denmark, writing Solidity for cross-chain bridging and state verification, plus node infrastructure for decentralised AI compute. Before that I spent 2.5 years on AI and blockchain R&D at Antematter.',
  'Most of my work sits where AI systems meet on-chain infrastructure. An agent that has to move money, read contract state or execute a transaction is a different engineering problem from a chatbot with an API key, and that is the problem I spend most of my time on.',
  'I scope properly before building, document interfaces as I go, and hand over code your team can maintain without me. I’m based in UTC+5, with overlap into EU and US mornings, and open to freelance smart contract and AI agent work as well as senior engineering roles.',
];

export const services = [
  {
    heading: 'Blockchain & smart contracts',
    items: [
      'Solidity contracts: ERC-20, ERC-721, ERC-1155, DAOs, DEXs, staking, vesting',
      'Contract review and security hardening before deployment',
      'Cross-chain bridging, state verification and trustless bridge logic',
      'Full-stack dApps: wallets, contract calls, event indexing, transaction handling',
      'Layer 2 deployment on Polygon, Arbitrum, Base, Optimism and zkSync',
    ],
  },
  {
    heading: 'AI agents & LLM systems',
    items: [
      'Autonomous and tool-calling agents; multi-agent orchestration',
      'Agents that transact: on-chain execution, wallet operations, verifiable actions',
      'RAG pipelines: chunking, embeddings, semantic search, reranking, evaluation',
      'MCP servers connecting models to APIs, databases and internal tools',
    ],
  },
  {
    heading: 'Backend & automation',
    items: [
      'Go and Rust services, gRPC, P2P networking, high-throughput systems',
      'Profiling and benchmarking for latency, throughput and cost',
      'n8n workflows and API, webhook and OAuth integrations',
    ],
  },
];

export const work = [
  {
    id: 'warden',
    title: 'Warden — an AI agent guarding an on-chain vault',
    role: 'Personal project',
    year: '2026',
    problem: 'An AI agent that can move money is only as safe as what sits between a stranger’s message and the chain. Prompts alone don’t hold.',
    built: 'Warden, a Llama 3.3 70B agent on Cloudflare Workers, holds the only key to a Solidity vault on Base Sepolia, and anyone can try to talk it into paying them. A second model screens every message into a suspicion score, plain code turns that into vetoes, lockouts and a circuit breaker, and the contract caps every release. Winners get a soulbound on-chain trophy, and anyone can send their own AI in over MCP.',
    stack: ['Solidity', 'Foundry', 'Cloudflare Workers', 'Durable Objects', 'Workers AI', 'MCP', 'viem'],
    outcome: 'Live on Base Sepolia. Try to rob it →',
    url: '/agent',
  },
  {
    id: 'p2p-ai-ranking',
    title: 'Peer-to-peer ranking protocol for AI models',
    role: 'Senior Engineer, Telegraph',
    year: '2026',
    problem: 'A decentralised network ranking AI models needs validator and miner nodes to agree on state without trusting each other, and to prove that state on-chain.',
    built: 'Go node software for subnet synchronisation and P2P networking across validators and miners, with Solidity contracts for cross-chain state verification. Profiled and benchmarked the nodes under load to remove throughput bottlenecks.',
    stack: ['Go', 'Solidity', 'gRPC', 'EVM', 'P2P networking'],
    outcome: 'In development',
  },
  {
    id: 'loot8',
    title: 'Loot8 — Web3 infrastructure for a fan engagement platform',
    role: 'Web3 Developer (Full Stack), LOOT8',
    year: '2024',
    problem: 'A consumer app on iOS, Android and web needed on-chain features that ordinary users could use without thinking about wallets or transactions.',
    built: 'Wallet and authentication flows, client-side contract calls, event indexing and transaction handling, plus backend services keeping on-chain state in sync with off-chain application logic. Documented the contract interfaces and led the handover to the internal team.',
    stack: ['TypeScript', 'Node.js', 'EVM', 'ethers.js', 'web3.js'],
    outcome: 'Live on iOS, Android and web',
  },
  {
    id: 'onchain-rosca',
    title: 'On-chain ROSCA — verifiable random payouts',
    role: 'Hackathon project',
    year: '2022',
    problem: 'A rotating savings group (ROSCA) depends on trusting whoever decides the payout order, and on every member being a real, distinct person.',
    built: 'Smart contracts that collect each round’s contributions and pick the recipient with Chainlink VRF, so the payout order is provably random. Members join through a zero-knowledge ID check, so one person can’t hold several seats.',
    stack: ['Solidity', 'Chainlink VRF', 'ZK identity'],
    outcome: 'Prize winner, Chainlink Fall 2022 Hackathon',
    url: 'https://devpost.com/software/decentralized-kameti',
  },
];

export const roles = [
  { role: 'Senior Golang / Agentic AI Developer', company: 'Telegraph', dates: 'Feb 2026 – present', line: 'Go nodes for decentralised AI compute and Solidity for cross-chain bridging and state verification.' },
  { role: 'Rust / AI Engineer', company: 'Antematter', dates: 'Aug 2023 – Feb 2026', line: 'LLM and code-agent R&D, Rust/Anchor on Solana and Move on SUI, from spec to deployed code.' },
  { role: 'Web3 Developer (Full Stack)', company: 'LOOT8', dates: 'Dec 2023 – Apr 2024', line: 'The Web3 layer for a live consumer app on iOS, Android and web.' },
  { role: 'Blockchain & Web3 Consultant', company: 'MechTech Solutions', dates: 'Jan 2021 – May 2023', line: 'Solidity delivery and architecture direction for clients across Asia and the Gulf.' },
];

export const quotes = {
  home: {
    text: 'I have hired dozens of freelancers off of Upwork over the last decade and can say with confidence Muhammad is one of the best I have ever worked with.',
    by: 'Upwork client',
    context: 'Web3 technical consulting, 2022',
  },
  about: [
    {
      text: 'He isn’t someone you leave to work in the background on JIRA tickets… he is someone you want to bring to your product strategy meetings. He is someone you want to put in front of your clients.',
      by: 'Soban Raza',
      context: 'Co-founder, Antematter',
    },
    {
      text: 'He knows blockchain and crypto at every level of the stack… he’s ahead of the game when it comes to agentic solutions, AI automation, and bleeding edge technology… just hire him, he’s a rock solid engineer.',
      by: 'Upwork client',
      context: 'Crypto and blockchain consulting, 2025–26',
    },
    {
      text: 'When assigned to a Solana project with no prior Rust experience, he dove in, rapidly mastered the language, and delivered the project seamlessly and effectively.',
      by: 'Mueed',
      context: 'Agentic Security & Blockchain Architect',
    },
  ],
};

export const skills = ['Solidity', 'Foundry', 'Hardhat', 'Chainlink', 'Go', 'Rust', 'TypeScript', 'Python', 'gRPC', 'LangGraph', 'MCP', 'AWS'];

export const education = ['BSc Computer Science, Virtual University of Pakistan, 2021–2025'];
export const certifications = [
  'Chainlink Fall 2022 Hackathon: two prizes',
  'Moralis x Filecoin Hackathon: prize winner',
  'Senior Web3 Developer, LearnWeb3, 2022',
  'Full Stack Web Developer, Innopia Solutions, 2021',
];

export const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${SITE.url}/#person`,
  name: SITE.name,
  alternateName: SITE.fullName,
  jobTitle: SITE.jobTitle,
  url: SITE.url,
  email: `mailto:${SITE.email}`,
  sameAs: [SITE.github, SITE.linkedin],
};
