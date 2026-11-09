import type { Player } from '../game/Player';

export type Rarity = 'common' | 'rare' | 'epic' | 'legend';

/** Generic stat upgrades. Weapon / skill level-ups and swaps live in game/cards.ts. */
export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  max: number;
  apply: (p: Player) => void;
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, epic: 12, legend: 0 };

export const UPGRADES: Upgrade[] = [
  { id: 'sharp', name: '锋锐', desc: '伤害 +15%', rarity: 'common', max: 6, apply: (p) => (p.stats.dmgMult += 0.15) },
  { id: 'swift', name: '迅捷', desc: '攻击速度 +14%', rarity: 'common', max: 6, apply: (p) => (p.stats.atkRateMult += 0.14) },
  {
    id: 'vital', name: '强健', desc: '最大生命 +25，并回复 25 生命', rarity: 'common', max: 6,
    apply: (p) => { p.stats.maxHp += 25; p.heal(25); },
  },
  { id: 'wind', name: '疾风', desc: '移动速度 +10%', rarity: 'common', max: 3, apply: (p) => (p.stats.moveSpeed *= 1.1) },
  { id: 'keen', name: '致命', desc: '暴击率 +8%', rarity: 'common', max: 5, apply: (p) => (p.stats.critChance += 0.08) },
  { id: 'regen', name: '再生', desc: '每秒回复 1.5 生命', rarity: 'common', max: 3, apply: (p) => (p.stats.regen += 1.5) },
  { id: 'leech', name: '嗜血', desc: '造成伤害的 4% 转化为生命', rarity: 'rare', max: 4, apply: (p) => (p.stats.lifesteal += 0.04) },
  { id: 'focus', name: '专注', desc: '技能冷却 -12%（上限 50%）', rarity: 'rare', max: 4, apply: (p) => (p.stats.cdr += 0.12) },
  { id: 'reach', name: '扩张', desc: '技能范围 +15%', rarity: 'rare', max: 4, apply: (p) => (p.stats.areaMult += 0.15) },
  { id: 'iron', name: '铁壁', desc: '受到的伤害 -10%', rarity: 'rare', max: 3, apply: (p) => (p.stats.armor += 0.1) },
  { id: 'exec', name: '处决者', desc: '暴击伤害 +60%', rarity: 'epic', max: 2, apply: (p) => (p.stats.critMult += 0.6) },
  {
    id: 'glass', name: '玻璃大炮', desc: '伤害 +45%，最大生命 -20%', rarity: 'epic', max: 1,
    apply: (p) => { p.stats.dmgMult += 0.45; p.stats.maxHp = Math.round(p.stats.maxHp * 0.8); p.hp = Math.min(p.hp, p.stats.maxHp); },
  },
];

/** One weighted random stat upgrade the player can still take, excluding `skip`. */
export function rollStat(p: Player, skip: string[] = []): Upgrade | null {
  const pool = UPGRADES.filter((u) => p.mod(u.id) < u.max && !skip.includes(u.id));
  if (!pool.length) return null;
  const weights = pool.map((u) => RARITY_WEIGHT[u.rarity]);
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < pool.length - 1 && roll > weights[i]) roll -= weights[i++];
  return pool[i];
}
