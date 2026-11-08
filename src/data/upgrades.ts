import type { HeroId } from './heroes';
import type { Player } from '../game/Player';

export type Rarity = 'common' | 'rare' | 'epic';

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  /** Hero-exclusive upgrades modify that hero's abilities. */
  hero?: HeroId;
  max: number;
  apply?: (p: Player) => void;
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, epic: 12 };

export const UPGRADES: Upgrade[] = [
  // ---- generic stats ----
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

  // ---- Lumen ----
  { id: 'pierce', name: '穿透星弹', desc: '星弹可多穿透 1 个敌人', rarity: 'rare', hero: 'lumen', max: 3 },
  { id: 'multishot', name: '分裂星弹', desc: '每次多射出 1 发星弹', rarity: 'epic', hero: 'lumen', max: 2 },
  { id: 'blinkNova', name: '闪现新星', desc: '相位闪的落点释放一次小型霜环', rarity: 'rare', hero: 'lumen', max: 1 },
  { id: 'permafrost', name: '永冻', desc: '霜环改为冻结敌人 1.2 秒', rarity: 'rare', hero: 'lumen', max: 1 },
  { id: 'meteorShower', name: '流星雨', desc: '坠星落地后追加 5 颗小陨石', rarity: 'epic', hero: 'lumen', max: 1 },
  { id: 'echo', name: '回响', desc: '星弹每次命中，相位闪和霜环冷却 -0.15 秒', rarity: 'rare', hero: 'lumen', max: 1 },

  // ---- Kael ----
  { id: 'wideBlade', name: '宽刃', desc: '斩击距离 +20%，角度更大', rarity: 'common', hero: 'kael', max: 3 },
  { id: 'slashWave', name: '剑气', desc: '每第 3 次斩击额外放出一道穿透剑气', rarity: 'epic', hero: 'kael', max: 1 },
  { id: 'chainDash', name: '连斩', desc: '突进斩击杀敌人时立刻刷新冷却', rarity: 'rare', hero: 'kael', max: 1 },
  { id: 'vortex', name: '漩涡', desc: '旋风会把周围敌人卷向你', rarity: 'rare', hero: 'kael', max: 1 },
  { id: 'longRage', name: '不息之怒', desc: '血怒持续时间 +3 秒', rarity: 'rare', hero: 'kael', max: 2 },
  { id: 'undying', name: '不屈', desc: '生命低于 35% 时伤害 +40%', rarity: 'rare', hero: 'kael', max: 1 },
];

/** Pick `n` distinct upgrades the player can still take, weighted by rarity. */
export function rollUpgrades(p: Player, n = 3): Upgrade[] {
  const pool = UPGRADES.filter((u) => (!u.hero || u.hero === p.hero.id) && p.mod(u.id) < u.max);
  const out: Upgrade[] = [];
  while (out.length < n && pool.length > 0) {
    // hero-exclusive cards get a bonus so each run has build identity
    const weights = pool.map((u) => RARITY_WEIGHT[u.rarity] * (u.hero ? 1.6 : 1));
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (roll > weights[i]) roll -= weights[i++];
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  return out;
}

export function applyUpgrade(p: Player, u: Upgrade) {
  p.mods[u.id] = p.mod(u.id) + 1;
  u.apply?.(p);
}
