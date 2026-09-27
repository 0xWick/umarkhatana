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
  // A free "what could I automate?" plan tool, run by the Agentistan agent.
  planTool: 'https://agentistan.umarkhatana.com/#plan',
};

/** A Calendly link tagged so bookings show which part of the site they came from. */
export const bookCall = (medium: string) => `${SITE.calendly}?utm_source=umarkhatana.com&utm_medium=${medium}`;

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

// Plain-English, for business owners rather than engineers. Kept word-for-word in sync
// with the "free automation plan" tool so a prospect never sees two versions.
export const plainServices = [
  {
    heading: 'For clinics, dental practices and labs',
    body: 'Automate the busywork around patients: appointment reminders and no-show follow-ups, intake and insurance forms that fill themselves, results and referrals routed to the right place, and the reports you need pulled together on their own — so your staff spend their time on patients, not paperwork.',
  },
  {
    heading: 'For accounting firms, advisors and fintechs',
    body: 'Take the manual work out of the numbers: invoices and statements reconciled automatically, documents chased and filed, client onboarding and KYC handled step by step, and dashboards that update themselves — accurate, on time, and ready for an audit.',
  },
  {
    heading: 'For any small business, or just for yourself',
    body: 'One-off automations for the jobs you still do by hand: inbox and calendar triage, quotes and follow-ups, data moved between the tools you already use, and an AI assistant that answers from your own documents. We start with the one task that wastes the most time.',
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
  knowsAbout: ['AI agents', 'Large language models', 'Smart contracts', 'Solidity', 'Ethereum', 'Model Context Protocol', 'Cloudflare Workers', 'Go'],
};

export const website = {
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  url: SITE.url,
  name: SITE.name,
  publisher: { '@id': `${SITE.url}/#person` },
};
