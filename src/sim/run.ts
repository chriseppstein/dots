/**
 * CLI for fairness simulations. Chunkable so runs can be parallelized at
 * the shell level and aggregated afterwards:
 *
 *   npx tsx src/sim/run.ts --size 4 --count 125 --seed-start 0 \
 *       --difficulty medium --json results/part1.json
 *   npx tsx src/sim/run.ts --aggregate results/part*.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { simulateGame, summarize, type SimResult } from './simulate.ts';
import type { GridSize } from '../engine/lattice.ts';
import type { Difficulty } from '../ai/ai.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function printSummary(label: string, games: SimResult[]): void {
  const s = summarize(games);
  const pct = (x: number) => (x * 100).toFixed(1) + '%';
  console.log(
    `${label}: n=${s.games}  P1 wins ${s.wins[0]} (${pct(s.firstWinRate)} of decisive)  ` +
      `P2 wins ${s.wins[1]}  draws ${s.draws}  ` +
      `mean cubes ${s.meanScores[0].toFixed(2)} vs ${s.meanScores[1].toFixed(2)}  ` +
      `margin ${s.meanMargin >= 0 ? '+' : ''}${s.meanMargin.toFixed(2)}  ` +
      `z=${s.zScore.toFixed(2)} p=${s.pValue.toExponential(2)}`,
  );
}

const aggregateAt = process.argv.indexOf('--aggregate');
if (aggregateAt >= 0) {
  const files = process.argv.slice(aggregateAt + 1);
  const bySize = new Map<number, SimResult[]>();
  for (const f of files) {
    const { size, games } = JSON.parse(readFileSync(f, 'utf8')) as {
      size: number;
      games: SimResult[];
    };
    bySize.set(size, [...(bySize.get(size) ?? []), ...games]);
  }
  for (const [size, games] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
    printSummary(`${size}³`, games);
  }
} else {
  const size = Number(arg('size') ?? 3) as GridSize;
  const count = Number(arg('count') ?? 100);
  const seedStart = Number(arg('seed-start') ?? 0);
  const difficulty = (arg('difficulty') ?? 'medium') as Difficulty;
  const jsonPath = arg('json');

  const games: SimResult[] = [];
  const t0 = Date.now();
  for (let i = 0; i < count; i++) {
    games.push(simulateGame(size, [difficulty, difficulty], seedStart + i));
  }
  const elapsed = (Date.now() - t0) / 1000;
  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify({ size, games }));
    console.error(`${size}³ ×${count} done in ${elapsed.toFixed(1)}s → ${jsonPath}`);
  } else {
    printSummary(`${size}³ (${difficulty}, ${elapsed.toFixed(1)}s)`, games);
  }
}
