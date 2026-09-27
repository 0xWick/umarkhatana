---
title: American System
headline: settling money between friends
summary: A khata with every friend, receipts with a full lifecycle, and credit-score tiers from Naya Murga to Nawab Sahib. Try it instantly as a test user.
role: Full-stack project
year: '2024'
order: 6
categories: [Full-stack]
stack: [Next.js, Chakra UI, TypeScript, Cloudflare Workers, D1, JWT]
problem: Friends who split bills lose track of who owes what, and asking for money back is awkward.
outcome: Live, with a one-click test user
live: { url: 'https://wasuli.umarkhatana.com', label: Try it as a test user }
code: https://github.com/0xWick/american-system
cover: ../../assets/work/american-system/cover.jpg
coverAlt: The Wasuli Bhai dashboard with a score of 50, balances, and receipts that need action
gallery:
  - src: ../../assets/work/american-system/landing.jpg
    alt: The Wasuli Bhai landing page with the Try it as a test user button
    caption: No login wall. One click creates a test user with four demo friends and a few weeks of history.
  - src: ../../assets/work/american-system/tab.jpg
    alt: The tab with Bilal, showing overdue receipts and actions
    caption: A tab with one friend. Only the right person can move each receipt.
  - src: ../../assets/work/american-system/rankings.jpg
    alt: Rankings with medals and credit-score tiers
    caption: Rankings. On time counts in full, late counts half, overdue counts nothing.
  - src: ../../assets/work/american-system/mobile.jpg
    alt: The dashboard on a phone with a bottom tab bar
    caption: On a phone.
---

## What I built

American System is a social network for going Dutch, and Wasuli Bhai is its app. Every pair of friends shares a tab. You send a receipt for someone’s share with a due date, they accept it, mark it paid, and you confirm. Your reputation follows how you pay, in tiers everyone can see: Nawab Sahib, Malik Riaz Jr, Kar len ge bro, Mufta, Karzai and Naya Murga.

## How it works

- **One Cloudflare Worker** serves the Next.js app as static files and the API under `/api`, on a D1 (SQLite) database with foreign keys and cascades.
- **A receipt lifecycle** (sent, accepted, rejected, cancelled, paid, confirmed, pardoned) enforced on the server: only the right person can make each move.
- **Credit scores** from payment history: on time counts in full, late counts half, overdue counts nothing.
- **Test users** get four demo friends with their own habits, who accept your receipts and confirm your payments instantly. Hina always pays on time; Bilal turns down anything over Rs 5,000.
- **Security on Web Crypto alone:** PBKDF2 password hashing, HS256 JWTs, rate-limited test users and a daily cleanup cron.

A 28-check smoke test walks the whole API, from the test user’s score moving from 50 to 83 to two real accounts settling a receipt, and checks that nobody can act on or read what isn’t theirs.
