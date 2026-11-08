import type { EnemyType } from './enemies';

export interface SpawnGroup {
  type: EnemyType;
  count: number;
  /** ms between spawns in this group */
  interval: number;
  /** ms after wave start before the first spawn */
  delay: number;
}

const g = (type: EnemyType, count: number, interval: number, delay = 0): SpawnGroup => ({ type, count, interval, delay });

// Each wave introduces at most one new enemy type so players learn them one by one.
// Waves 5 / 8 / 10 are boss fights.
export const WAVES: SpawnGroup[][] = [
  [g('slime', 10, 700)],
  [g('slime', 9, 650), g('runner', 6, 600, 3000)],
  [g('slime', 8, 600), g('shooter', 4, 1500, 1500), g('bomber', 5, 900, 4000)],
  [g('shielder', 3, 2500, 500), g('slime', 10, 500), g('shooter', 4, 1400, 3000), g('bomber', 4, 1000, 5000)],
  [g('colossus', 1, 0, 1200)],
  [g('priest', 2, 4000, 1000), g('shielder', 3, 2500, 1500), g('runner', 14, 350), g('shooter', 5, 1200, 3000)],
  [g('elite', 1, 0, 500), g('brute', 3, 2500, 1500), g('bomber', 9, 600, 2000), g('priest', 2, 5000, 1500), g('shooter', 6, 1000, 3000), g('slime', 12, 400, 1000)],
  [g('weaver', 1, 0, 1200)],
  [g('elite', 1, 0, 500), g('slime', 12, 350, 1000), g('shooter', 6, 1000, 2500), g('brute', 3, 2500, 4000), g('priest', 2, 5000, 2000), g('shielder', 3, 2500, 3000), g('bomber', 6, 700, 6000)],
  [g('boss', 1, 0, 1200)],
];
