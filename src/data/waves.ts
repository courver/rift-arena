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

export const WAVES: SpawnGroup[][] = [
  [g('slime', 10, 700)],
  [g('slime', 12, 600), g('runner', 6, 500, 3000)],
  [g('slime', 10, 600), g('shooter', 4, 1500, 1500), g('runner', 8, 400, 5000)],
  [g('brute', 2, 4000, 1000), g('slime', 14, 500), g('shooter', 5, 1400, 3000)],
  [g('elite', 1, 0, 1500), g('slime', 14, 600, 3000), g('runner', 10, 450, 6000)],
  [g('runner', 20, 300), g('shooter', 6, 1200, 2500), g('brute', 2, 3500, 4000)],
  [g('brute', 4, 2500, 500), g('shooter', 8, 1000, 2000), g('slime', 20, 350, 1000)],
  [g('elite', 1, 0, 500), g('runner', 16, 350, 2000), g('shooter', 8, 1000, 3000), g('brute', 3, 3000, 5000)],
  [g('elite', 2, 6000, 500), g('slime', 24, 300, 1000), g('shooter', 10, 900, 2500), g('brute', 4, 2500, 4000)],
  [g('boss', 1, 0, 1200)],
];
