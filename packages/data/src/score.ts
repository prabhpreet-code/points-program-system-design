#!/usr/bin/env tsx
// Reads events.json, runs the scorer, writes scores.json.
//
// Run:  pnpm score  (after pnpm generate)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeScores } from '@hyperunicorn/core';
import type { EventStream } from '@hyperunicorn/core';

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const inPath = resolve(here, '../generated/events.json');
  const outPath = resolve(here, '../generated/scores.json');

  const stream = JSON.parse(readFileSync(inPath, 'utf-8')) as EventStream;
  const result = computeScores(stream);

  writeFileSync(outPath, JSON.stringify(result));

  console.log(`✓ wrote ${outPath}  (${result.scores.length} users)`);
  console.log();
  console.log('Leaderboard (total points, post-saturation):');
  console.log('─'.repeat(60));
  for (const s of result.scores) {
    const user = stream.users.find((u) => u.id === s.user);
    const label = user?.label ?? s.user;
    const total = s.total.toFixed(1).padStart(9);
    const raw = s.rawTotal.toFixed(1).padStart(9);
    console.log(
      `  ${label.padEnd(22)} total=${total}   raw=${raw}   ` +
        `v=${s.breakdown.vault.toFixed(1).padStart(7)}  ` +
        `l=${s.breakdown.directLp.toFixed(1).padStart(7)}  ` +
        `t=${s.breakdown.taker.toFixed(1).padStart(7)}`,
    );
  }
}

main();
