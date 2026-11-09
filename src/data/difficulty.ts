import { settings } from '../settings';

export type DiffId = 'normal' | 'hard' | 'nightmare';

export interface Difficulty {
  name: string;
  desc: string;
  color: number;
  /** enemy and boss hp */
  hp: number;
  /** damage enemies deal */
  dmg: number;
  /** enemies per wave (bosses excluded) */
  count: number;
  speed: number;
  /** affixes on each elite */
  affixes: number;
}

export const DIFFS: Record<DiffId, Difficulty> = {
  normal: { name: '普通', desc: '第一次玩', color: 0x7bff9e, hp: 1, dmg: 1, count: 1, speed: 1, affixes: 1 },
  hard: { name: '困难', desc: '敌人更多更肉，精英双词缀', color: 0xffc04a, hp: 1.35, dmg: 1.3, count: 1.3, speed: 1.08, affixes: 2 },
  nightmare: { name: '噩梦', desc: '为高手准备', color: 0xff5566, hp: 1.8, dmg: 1.6, count: 1.6, speed: 1.15, affixes: 2 },
};

const forced = new URLSearchParams(location.search).get('diff') as DiffId | null;

/** `?diff=hard` (used by bot runs / the lab) overrides the menu choice. */
export function diffId(): DiffId {
  if (forced && forced in DIFFS) return forced;
  return settings.difficulty in DIFFS ? settings.difficulty : 'normal';
}

export function diff(): Difficulty {
  return DIFFS[diffId()];
}
