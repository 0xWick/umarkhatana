// Everything the agent remembers, in the Durable Object's SQLite: players and their
// last few turns, the hall of fame, and the recent public feed.

import type { Hex } from 'viem';
import type { ChatTurn, FeedItem, HallEntry, Tactic } from './events';
import { RULES, handleFor } from './game';

export interface Player {
  token: string;
  handle: string;
  address: Hex;
  /** As last written; cool it off with decayed(suspicion, suspicionAt, now) before use. */
  suspicion: number;
  suspicionAt: number;
  note: string;
  attempts: number;
  wins: number;
  lockedUntil: number;
  /** UTC date that `today` and `drafts` count for. */
  day: string;
  today: number;
  drafts: number;
  createdAt: number;
}

type Row = Record<string, SqlStorageValue>;

const HISTORY_TURNS = 8;
const FEED_ITEMS = 30;
const INACTIVE_DAYS = 30;

export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export class Store {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS players (
        token TEXT PRIMARY KEY, handle TEXT NOT NULL, address TEXT NOT NULL,
        suspicion INTEGER NOT NULL, suspicion_at INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '',
        attempts INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
        day TEXT NOT NULL DEFAULT '', today INTEGER NOT NULL DEFAULT 0, drafts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS turns_by_player ON turns (token, id);
      CREATE TABLE IF NOT EXISTS hall (
        tx TEXT PRIMARY KEY, token TEXT NOT NULL, at INTEGER NOT NULL, name TEXT NOT NULL,
        amount TEXT NOT NULL, symbol TEXT NOT NULL, url TEXT NOT NULL, line TEXT NOT NULL, reply TEXT NOT NULL,
        tactic TEXT NOT NULL, attempts INTEGER NOT NULL, intent_hash TEXT NOT NULL, public INTEGER NOT NULL DEFAULT 0,
        trophy INTEGER NOT NULL DEFAULT 0, trophy_url TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS feed (id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL);
    `);
  }

  // ─── Players ───────────────────────────────────────────────────────────────

  createPlayer(token: string, address: Hex, now: number): Player {
    const player: Player = {
      token,
      handle: handleFor(token),
      address,
      suspicion: RULES.startSuspicion,
      suspicionAt: now,
      note: '',
      attempts: 0,
      wins: 0,
      lockedUntil: 0,
      day: utcDay(now),
      today: 0,
      drafts: 0,
      createdAt: now,
    };
    this.sql.exec(
      `INSERT INTO players (token, handle, address, suspicion, suspicion_at, day, created_at, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      token, player.handle, address, player.suspicion, now, player.day, now, now,
    );
    return player;
  }

  /** The player, with the daily counters already reset if the UTC day has changed. */
  player(token: string, now: number): Player | null {
    const [r] = this.sql.exec<Row>('SELECT * FROM players WHERE token = ?', token).toArray();
    if (!r) return null;
    const day = utcDay(now);
    const fresh = r.day === day;
    return {
      token: String(r.token),
      handle: String(r.handle),
      address: String(r.address) as Hex,
      suspicion: Number(r.suspicion),
      suspicionAt: Number(r.suspicion_at),
      note: String(r.note),
      attempts: Number(r.attempts),
      wins: Number(r.wins),
      lockedUntil: Number(r.locked_until),
      day,
      today: fresh ? Number(r.today) : 0,
      drafts: fresh ? Number(r.drafts) : 0,
      createdAt: Number(r.created_at),
    };
  }

  savePlayer(p: Player, now: number): void {
    this.sql.exec(
      `UPDATE players SET address = ?, suspicion = ?, suspicion_at = ?, note = ?, attempts = ?, wins = ?,
       locked_until = ?, day = ?, today = ?, drafts = ?, seen_at = ? WHERE token = ?`,
      p.address, p.suspicion, p.suspicionAt, p.note, p.attempts, p.wins,
      p.lockedUntil, p.day, p.today, p.drafts, now, p.token,
    );
  }

  history(token: string): ChatTurn[] {
    return this.sql
      .exec<Row>('SELECT role, content FROM turns WHERE token = ? ORDER BY id DESC LIMIT ?', token, HISTORY_TURNS)
      .toArray()
      .reverse()
      .map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: String(r.content) }));
  }

  addTurns(token: string, turns: ChatTurn[]): void {
    for (const t of turns) this.sql.exec('INSERT INTO turns (token, role, content) VALUES (?, ?, ?)', token, t.role, t.content);
    this.sql.exec(
      'DELETE FROM turns WHERE token = ? AND id NOT IN (SELECT id FROM turns WHERE token = ? ORDER BY id DESC LIMIT ?)',
      token, token, HISTORY_TURNS,
    );
  }

  /** Forget players who never won and haven't been seen in a month. */
  prune(now: number): number {
    const cutoff = now - INACTIVE_DAYS * 86_400_000;
    const gone = this.sql.exec('SELECT token FROM players WHERE wins = 0 AND seen_at < ?', cutoff).toArray().length;
    this.sql.exec('DELETE FROM turns WHERE token IN (SELECT token FROM players WHERE wins = 0 AND seen_at < ?)', cutoff);
    this.sql.exec('DELETE FROM players WHERE wins = 0 AND seen_at < ?', cutoff);
    return gone;
  }

  // ─── Hall of fame ──────────────────────────────────────────────────────────

  /** Every win is recorded privately; the winner decides whether it goes public. */
  recordWin(e: Omit<HallEntry, 'name'> & { token: string; name: string }): void {
    this.sql.exec(
      `INSERT OR REPLACE INTO hall (tx, token, at, name, amount, symbol, url, line, reply, tactic, attempts, intent_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      e.tx, e.token, e.at, e.name, e.amount, e.symbol, e.url, e.line, e.reply, e.tactic, e.attempts, e.intentHash,
    );
  }

  /** The private record of a player's win, for the moderator to check before publishing. */
  win(tx: string, token: string): HallEntry | null {
    const [r] = this.sql.exec<Row>('SELECT * FROM hall WHERE tx = ? AND token = ?', tx, token).toArray();
    return r ? toEntry(r) : null;
  }

  setTrophy(tx: string, tokenId: number, url: string): void {
    this.sql.exec('UPDATE hall SET trophy = ?, trophy_url = ? WHERE tx = ?', tokenId, url, tx);
  }

  trophyFor(token: string): { tokenId: number; url: string } | null {
    const [r] = this.sql.exec<Row>('SELECT trophy, trophy_url FROM hall WHERE token = ? AND trophy > 0 LIMIT 1', token).toArray();
    return r ? { tokenId: Number(r.trophy), url: String(r.trophy_url) } : null;
  }

  publish(tx: string, token: string, name: string): void {
    this.sql.exec('UPDATE hall SET public = 1, name = ? WHERE tx = ? AND token = ?', name, tx, token);
  }

  hide(tx: string): boolean {
    return this.sql.exec('UPDATE hall SET public = 0 WHERE tx = ?', tx).rowsWritten > 0;
  }

  hall(limit = 20): HallEntry[] {
    return this.sql.exec<Row>('SELECT * FROM hall WHERE public = 1 ORDER BY at DESC LIMIT ?', limit).toArray().map(toEntry);
  }

  // ─── Feed ──────────────────────────────────────────────────────────────────

  addFeed(item: FeedItem): void {
    this.sql.exec('INSERT INTO feed (item) VALUES (?)', JSON.stringify(item));
    this.sql.exec('DELETE FROM feed WHERE id NOT IN (SELECT id FROM feed ORDER BY id DESC LIMIT ?)', FEED_ITEMS);
  }

  feed(): FeedItem[] {
    return this.sql
      .exec<Row>('SELECT item FROM feed ORDER BY id DESC LIMIT ?', FEED_ITEMS)
      .toArray()
      .map((r) => JSON.parse(String(r.item)) as FeedItem);
  }
}

function toEntry(r: Row): HallEntry {
  return {
    tx: String(r.tx) as Hex,
    url: String(r.url),
    at: Number(r.at),
    name: String(r.name),
    amount: String(r.amount),
    symbol: String(r.symbol),
    line: String(r.line),
    reply: String(r.reply),
    tactic: String(r.tactic) as Tactic,
    attempts: Number(r.attempts),
    intentHash: String(r.intent_hash) as Hex,
  };
}
