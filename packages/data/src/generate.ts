#!/usr/bin/env tsx
// Generates a deterministic events.json for the 30-day mock window.
//
// Run:  pnpm generate

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EventStream, Pair, PriceTick, Timestamp, UserEvent } from '@hyperunicorn/core';
import { SECONDS } from '@hyperunicorn/core';

import { buildArchetypeEvents, USERS, resetPositionCounter } from './archetypes.js';
import { generatePricePath, PAIR_CONFIGS } from './pricePath.js';
import { makeRng } from './rng.js';

const SEED = 42;
const DAYS = 30;

// Anchor the window to a round point so the UI can render clean date ticks.
// 2026-04-01 00:00 UTC in seconds since epoch.
const START_TS: Timestamp = 1_774_038_400;
const END_TS: Timestamp = START_TS + DAYS * SECONDS.DAY;

function buildPriceLookup(ticks: PriceTick[]) {
  // ticks are per-pair, sorted ascending by ts. Bin by pair for O(1) nearest.
  const byPair = new Map<Pair, PriceTick[]>();
  for (const t of ticks) {
    let arr = byPair.get(t.pair);
    if (!arr) {
      arr = [];
      byPair.set(t.pair, arr);
    }
    arr.push(t);
  }
  // Assume uniform step within each pair.
  return (ts: Timestamp, pair: Pair): number => {
    const arr = byPair.get(pair);
    if (!arr || arr.length === 0) return 0;
    const first = arr[0]!;
    const last = arr[arr.length - 1]!;
    if (ts <= first.ts) return first.price;
    if (ts >= last.ts) return last.price;
    const step = (last.ts - first.ts) / (arr.length - 1);
    const idx = Math.round((ts - first.ts) / step);
    return arr[Math.max(0, Math.min(arr.length - 1, idx))]!.price;
  };
}

function main() {
  const rng = makeRng(SEED);

  // Price paths — one RNG shared, both pairs drawn in sequence so output is
  // stable wrt pair ordering in PAIR_CONFIGS.
  const prices: PriceTick[] = [];
  for (const cfg of PAIR_CONFIGS) {
    prices.push(...generatePricePath(cfg, START_TS, END_TS, rng));
  }

  const priceAt = buildPriceLookup(prices);

  resetPositionCounter();
  const events: UserEvent[] = [];
  for (const user of USERS) {
    // Each archetype gets its own RNG sub-stream for independence.
    const userRng = makeRng(SEED + hashStr(user.id));
    events.push(
      ...buildArchetypeEvents(user, {
        user: user.id,
        rng: userRng,
        startTs: START_TS,
        endTs: END_TS,
        priceAt,
      }),
    );
  }
  events.sort((a, b) => a.ts - b.ts);

  const stream: EventStream = {
    users: USERS,
    events,
    prices,
    startTs: START_TS,
    endTs: END_TS,
  };

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../generated/events.json',
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(stream));

  const sizeKb = (Buffer.byteLength(JSON.stringify(stream)) / 1024).toFixed(1);
  console.log(
    `✓ wrote ${outPath}  (${events.length} user events · ${prices.length} price ticks · ${sizeKb} KB)`,
  );
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

main();
