import Phaser from 'phaser';
import type { Slot } from '../data/heroes';
import { rollStat, Upgrade, Rarity } from '../data/upgrades';
import type { Player } from './Player';
import { SKILLS } from './skills';
import { MAX_LV, WEAPONS } from './weapons';

/** One choice on the between-wave screen. */
export type Card =
  | { kind: 'stat'; up: Upgrade }
  | { kind: 'level'; slot: Slot }
  | { kind: 'swap'; slot: Slot; id: string };

export const SLOT_NAME: Record<Slot, string> = { weapon: '主武器', Q: 'Q 技能', E: 'E 技能', R: 'R 大招' };

export function defOf(slot: Slot, id: string) {
  return slot === 'weapon' ? WEAPONS[id] : SKILLS[id];
}

/** Swapping keeps most of the investment: the new item starts one level lower. */
export function swapLevel(p: Player, slot: Slot) {
  return Math.max(1, p.loadout[slot].lv - 1);
}

export interface CardView {
  title: string;
  desc: string;
  tag: string;
  rarity: Rarity;
  icon: string;
}

export function describe(c: Card, p: Player): CardView {
  if (c.kind === 'stat') return { title: c.up.name, desc: c.up.desc, tag: '属性', rarity: c.up.rarity, icon: '' };
  const cur = p.loadout[c.slot];
  if (c.kind === 'level') {
    const d = defOf(c.slot, cur.id);
    return {
      title: `${d.name} Lv${cur.lv + 1}`,
      desc: d.levels[cur.lv - 1],
      tag: `${SLOT_NAME[c.slot]} · 升级`,
      rarity: 'rare',
      icon: d.icon,
    };
  }
  const d = defOf(c.slot, c.id);
  const old = defOf(c.slot, cur.id);
  return {
    title: `${d.name} Lv${swapLevel(p, c.slot)}`,
    desc: `${d.desc}\n（替换 ${old.name} Lv${cur.lv}）`,
    tag: `${SLOT_NAME[c.slot]} · 更换`,
    rarity: 'epic',
    icon: d.icon,
  };
}

export function applyCard(c: Card, p: Player) {
  if (c.kind === 'stat') {
    p.mods[c.up.id] = p.mod(c.up.id) + 1;
    c.up.apply(p);
  } else if (c.kind === 'level') {
    p.loadout[c.slot].lv++;
  } else {
    p.loadout[c.slot] = { id: c.id, lv: swapLevel(p, c.slot) };
    if (c.slot !== 'weapon') p.cd[c.slot] = 0;
  }
}

export function cardLabel(c: Card, p: Player) {
  if (c.kind === 'stat') return c.up.id;
  if (c.kind === 'level') return `${p.loadout[c.slot].id}+`;
  return `>${c.id}`;
}

const SLOTS: Slot[] = ['weapon', 'Q', 'E', 'R'];

/** "主武器 星弹 Lv3　Q 相位闪 Lv1 ..." */
export function loadoutText(lo: Record<Slot, { id: string; lv: number }>, sep = '　') {
  return SLOTS.map((s) => `${s === 'weapon' ? '主武器' : s} ${defOf(s, lo[s].id).name} Lv${lo[s].lv}`).join(sep);
}

/**
 * Three cards: one level-up, one stat, and a third that is usually a swap.
 * The fixed shape keeps every pick meaningful while still mixing in new toys.
 */
export function rollCards(p: Player): Card[] {
  const levels: Card[] = SLOTS.filter((s) => p.loadout[s].lv < MAX_LV).map((slot) => ({ kind: 'level', slot }));
  const swaps: Card[] = [];
  for (const slot of SLOTS) {
    const pool = slot === 'weapon' ? Object.keys(WEAPONS) : Object.keys(SKILLS).filter((id) => SKILLS[id].slot === slot);
    for (const id of pool) if (id !== p.loadout[slot].id) swaps.push({ kind: 'swap', slot, id });
  }
  const out: Card[] = [];
  const takeStat = () => {
    const up = rollStat(p, out.flatMap((c) => (c.kind === 'stat' ? [c.up.id] : [])));
    if (up) out.push({ kind: 'stat', up });
  };
  if (levels.length) out.push(levels.splice(Phaser.Math.Between(0, levels.length - 1), 1)[0]);
  takeStat();
  const r = Math.random();
  const pick = (a: Card[]) => a.splice(Phaser.Math.Between(0, a.length - 1), 1)[0];
  if (r < 0.6 && swaps.length) out.push(pick(swaps));
  else if (r < 0.8 && levels.length) out.push(pick(levels));
  else takeStat();
  while (out.length < 3 && swaps.length) out.push(pick(swaps));
  return Phaser.Utils.Array.Shuffle(out);
}
