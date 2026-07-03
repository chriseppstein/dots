/**
 * Color/identity policy for the client. The server only ever speaks seat
 * indices; this is the one place seats become colors and names. Values
 * must stay in sync with src/styles/tokens.css (--player-1/--player-2,
 * signal colors, --bg).
 */

import type { Seat } from '../engine/game.ts';
import type { MoveAnalysis } from '../engine/analyzer.ts';

/** CVD-safe pair: blue vs orange, distinct in all common color blindness. */
export const PLAYER_COLORS: Record<Seat, string> = {
  0: '#3b82f6',
  1: '#f59e0b',
};

export const PLAYER_DEFAULT_NAMES: Record<Seat, string> = {
  0: 'Player 1',
  1: 'Player 2',
};

/** Move-consequence signals — same semantics as the prototype's preview. */
export const CONSEQUENCE_COLORS: Record<MoveAnalysis['kind'], string> = {
  safe: '#34d399',
  scoring: '#fbbf24',
  chain: '#fb923c',
  danger: '#f87171',
};

export const CONSEQUENCE_LABELS: Record<MoveAnalysis['kind'], string> = {
  safe: 'Safe',
  scoring: 'Completes a face',
  chain: 'Chain!',
  danger: 'Gives one away',
};

export const SCENE = {
  background: '#0e1116',
  fog: '#0e1116',
  dot: '#c8d2e0',
  undrawnEdge: '#3c4859',
  tieCube: '#64748b',
} as const;

export function playerColor(seat: Seat): string {
  return PLAYER_COLORS[seat];
}

export function consequenceLabel(a: MoveAnalysis): string {
  if (a.kind === 'chain') return `Chain ×${a.chainLength}`;
  if (a.claimsCubes > 0) return a.claimsCubes === 1 ? 'Claims a cube!' : `Claims ${a.claimsCubes} cubes!`;
  if (a.kind === 'scoring' && a.completesFaces > 1) return `Completes ${a.completesFaces} faces`;
  return CONSEQUENCE_LABELS[a.kind];
}
