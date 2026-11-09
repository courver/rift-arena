import Phaser from 'phaser';
import type { Slot, SkillSlot } from '../data/heroes';
import { rollStat, Upgrade, Rarity } from '../data/upgrades';
import type { Player } from './Player';
import { SKILLS } from './skills';
import { SYNERGIES, ULTIMATES, UltimatePath } from './synergy';
import { MAX_LV, WEAPONS } from './weapons';
import { MAX_RELICS, RELICS, RELIC_BY_ID } from './relics';

/** One choice on the between-wave screen. */
export type Card =
  | { kind: 'stat'; up: Upgrade }
  | { kind: 'level'; slot: Slot; n?: number }
  | { kind: 'swap'; slot: Slot; id: string }
  | { kind: 'evolve'; id: string }
  | { kind: 'relic'; id: string };

export const SLOT_NAME: Record<Slot, string> = { weapon: '主武器', Q: 'Q 技能', E: 'E 技能', R: 'R 大招' };

export function defOf(slot: Slot, id: string) {
  return slot === 'weapon' ? WEAPONS[id] : SKILLS[id];
}

/** Swapping keeps most of the investment: the new item starts one level lower. */
export function swapLevel(p: Player, slot: Slot) {
  return Math.max(1, p.loadout[slot].lv - 1);
}

function itemName(id: string) {
  return (WEAPONS[id] ?? SKILLS[id]).name;
}

/** Ultimate path for the currently equipped weapon (if it is not evolved yet). */
export function ultimatePath(p: Player): UltimatePath | undefined {
  return ULTIMATES.find((u) => u.from === p.loadout.weapon.id);
}

function slotOf(p: Player, id: string): Slot | undefined {
  return (['weapon', 'Q', 'E', 'R'] as Slot[]).find((s) => p.loadout[s].id === id);
}

/** The weapon and its partner skill are both maxed: the next pick offers evolution. */
export function evolveReady(p: Player): UltimatePath | undefined {
  const u = ultimatePath(p);
  if (!u || p.loadout.weapon.lv < MAX_LV) return undefined;
  const s = slotOf(p, u.partner);
  return s && p.loadout[s].lv >= MAX_LV && p.cores > 0 ? u : undefined;
}

/** "究极进化：星弹 Lv3/5 + 相位闪 Lv2/5 → 银河星爆" */
export function ultimateProgress(p: Player) {
  const u = ultimatePath(p);
  if (!u) return WEAPONS[p.loadout.weapon.id].ultimate ? `究极武器「${WEAPONS[p.loadout.weapon.id].name}」已觉醒` : '';
  const s = slotOf(p, u.partner);
  const partner = s ? `${itemName(u.partner)} Lv${p.loadout[s].lv}/5` : `${itemName(u.partner)}（未装备）`;
  return `究极进化：${itemName(u.from)} Lv${p.loadout.weapon.lv}/5 + ${partner} + 首领核心 ${p.cores}/1 → ${WEAPONS[u.id].name}`;
}

export interface CardView {
  title: string;
  desc: string;
  tag: string;
  rarity: Rarity;
  icon: string;
}

/** Synergy hints for a swap: what it completes and what it breaks. */
function synergyHint(p: Player, slot: Slot, newId: string) {
  const oldId = p.loadout[slot].id;
  const owns = (id: string) => (id === newId ? true : id === oldId ? false : p.owns(id));
  const lines: string[] = [];
  for (const sy of SYNERGIES) {
    const after = owns(sy.a) && owns(sy.b);
    const before = p.syn(sy.id);
    if (after && !before) lines.push(`★ 激活羁绊「${sy.name}」`);
    if (before && !after) lines.push(`（会失去羁绊「${sy.name}」）`);
  }
  const u = ULTIMATES.find((x) => (x.from === newId && p.owns(x.partner)) || (x.partner === newId && x.from === p.loadout.weapon.id));
  if (u) lines.push(`◆ 可走究极路线「${WEAPONS[u.id].name}」`);
  return lines.length ? '\n' + lines.join('\n') : '';
}

export function describe(c: Card, p: Player): CardView {
  if (c.kind === 'stat') return { title: c.up.name, desc: c.up.desc, tag: '属性', rarity: c.up.rarity, icon: '' };
  if (c.kind === 'relic') {
    const r = RELIC_BY_ID[c.id];
    return { title: r.name, desc: `${r.desc}\n（遗物 ${p.relics.length + 1}/${MAX_RELICS}）`, tag: '遗物', rarity: 'relic', icon: r.icon };
  }
  if (c.kind === 'evolve') {
    const d = WEAPONS[c.id];
    return { title: d.name, desc: `${d.desc}\n（${itemName(p.loadout.weapon.id)} → 究极武器）`, tag: '究极进化', rarity: 'legend', icon: d.icon };
  }
  const cur = p.loadout[c.slot];
  if (c.kind === 'level') {
    const d = defOf(c.slot, cur.id);
    const u = evolvesSoon(p, c.slot);
    const n = c.n ?? 1;
    return {
      title: `${d.name} Lv${cur.lv + n}`,
      desc: d.levels.slice(cur.lv - 1, cur.lv - 1 + n).join('\n') + (u ? `\n◆ 究极路线「${WEAPONS[u.id].name}」进度` : ''),
      tag: `${SLOT_NAME[c.slot]} · ${n > 1 ? '连升 2 级' : '升级'}`,
      rarity: 'rare',
      icon: d.icon,
    };
  }
  const d = defOf(c.slot, c.id);
  const old = defOf(c.slot, cur.id);
  return {
    title: `${d.name} Lv${swapLevel(p, c.slot)}`,
    desc: `${d.desc}\n（替换 ${old.name} Lv${cur.lv}）${synergyHint(p, c.slot, c.id)}`,
    tag: `${SLOT_NAME[c.slot]} · 更换`,
    rarity: 'epic',
    icon: d.icon,
  };
}

/** Is levelling this slot progress toward the current weapon's ultimate? */
function evolvesSoon(p: Player, slot: Slot) {
  const u = ultimatePath(p);
  if (!u) return undefined;
  const id = p.loadout[slot].id;
  return id === u.from || id === u.partner ? u : undefined;
}

export function applyCard(c: Card, p: Player) {
  if (c.kind === 'stat') {
    p.mods[c.up.id] = p.mod(c.up.id) + 1;
    c.up.apply(p);
  } else if (c.kind === 'relic') {
    p.relics.push(c.id);
  } else if (c.kind === 'evolve') {
    p.loadout.weapon = { id: c.id, lv: MAX_LV };
    p.cores--;
  } else if (c.kind === 'level') {
    p.loadout[c.slot].lv = Math.min(MAX_LV, p.loadout[c.slot].lv + (c.n ?? 1));
  } else {
    p.loadout[c.slot] = { id: c.id, lv: swapLevel(p, c.slot) };
    if (c.slot !== 'weapon') {
      const s = c.slot as SkillSlot;
      p.cd[s] = 0;
      p.charges[s] = p.maxCharges(s);
    }
  }
}

export { evolvesSoon };

export function cardLabel(c: Card, p: Player) {
  if (c.kind === 'stat') return c.up.id;
  if (c.kind === 'evolve') return `!${c.id}`;
  if (c.kind === 'relic') return `#${c.id}`;
  if (c.kind === 'level') return `${p.loadout[c.slot].id}+`;
  return `>${c.id}`;
}

const SLOTS: Slot[] = ['weapon', 'Q', 'E', 'R'];

/** "主武器 星弹 Lv3　Q 相位闪 Lv1 ..." */
export function loadoutText(lo: Record<Slot, { id: string; lv: number }>, sep = '　') {
  return SLOTS.map((s) => `${s === 'weapon' ? '主武器' : s} ${defOf(s, lo[s].id).name} ${WEAPONS[lo[s].id]?.ultimate ? '★究极' : 'Lv' + lo[s].lv}`).join(sep);
}

/**
 * Three cards: one level-up, one stat, and a third that is usually a swap.
 * The fixed shape keeps every pick meaningful while still mixing in new toys.
 * When the weapon and its partner are both maxed, an evolution card leads.
 */
export function rollCards(p: Player, bonus = false): Card[] {
  const out: Card[] = [];
  const relics: Card[] = p.relics.length < MAX_RELICS
    ? RELICS.filter((r) => !p.relic(r.id)).map((r) => ({ kind: 'relic', id: r.id }))
    : [];
  const ready = evolveReady(p);
  if (ready) out.push({ kind: 'evolve', id: ready.id });

  const levels: Card[] = SLOTS.filter((s) => p.loadout[s].lv < MAX_LV).map((slot) => ({ kind: 'level', slot }));
  const ultimate = !!WEAPONS[p.loadout.weapon.id].ultimate;
  const swaps: Card[] = [];
  for (const slot of SLOTS) {
    if (slot === 'weapon' && ultimate) continue; // never offer to throw away an evolved weapon
    const pool = slot === 'weapon'
      ? Object.keys(WEAPONS).filter((id) => !WEAPONS[id].ultimate)
      : Object.keys(SKILLS).filter((id) => SKILLS[id].slot === slot);
    for (const id of pool) if (id !== p.loadout[slot].id) swaps.push({ kind: 'swap', slot, id });
  }
  const takeStat = () => {
    const up = rollStat(p, out.flatMap((c) => (c.kind === 'stat' ? [c.up.id] : [])));
    if (up) out.push({ kind: 'stat', up });
  };
  const pick = (a: Card[]) => a.splice(Phaser.Math.Between(0, a.length - 1), 1)[0];
  // level cards lean slightly toward the weapon's ultimate path
  const pickLevel = () => {
    const w = levels.map((c) => (c.kind === 'level' && evolvesSoon(p, c.slot) ? 1.5 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < w.length - 1 && r > w[i]) r -= w[i++];
    return levels.splice(i, 1)[0];
  };

  // boss reward picks always show a relic
  if (bonus && relics.length && out.length < 3) out.push(pick(relics));
  if (levels.length && out.length < 3) out.push(pickLevel());
  if (out.length < 3) takeStat();
  if (out.length < 3) {
    const r = Math.random();
    if (r < 0.35 && swaps.length) out.push(pick(swaps));
    else if (r < 0.55 && relics.length) out.push(pick(relics));
    else if (r < 0.85 && levels.length) out.push(pickLevel());
    else takeStat();
  }
  while (out.length < 3 && swaps.length) out.push(pick(swaps));
  const first = out[0].kind === 'evolve' ? out.shift() : undefined;
  const rest = Phaser.Utils.Array.Shuffle(out);
  return first ? [first, ...rest] : rest;
}
