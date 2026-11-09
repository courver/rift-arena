import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Player } from './Player';
import type { Enemy } from './Enemy';
import { sfx } from '../sfx';
import { ARENA } from '../config';

const DEG = Math.PI / 180;
const b = (cond: boolean) => (cond ? 1 : 0);

export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  desc: string;
  /** preferred fighting distance, used by the bot */
  range: number;
  rate(lv: number): number;
  /** text for reaching lv 2..5 (index 0 = lv2) */
  levels: string[];
  fire(s: GameScene, p: Player, lv: number): void;
  /** evolved weapon (究极): fixed at max level, reuses `base` art in gold */
  ultimate?: boolean;
  base?: string;
}

/** Distance from (x, y) to the arena wall along angle a. */
function toWall(x: number, y: number, a: number) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const tx = ca > 0 ? (ARENA.x + ARENA.w - x) / ca : ca < 0 ? (ARENA.x - x) / ca : Infinity;
  const ty = sa > 0 ? (ARENA.y + ARENA.h - y) / sa : sa < 0 ? (ARENA.y - y) / sa : Infinity;
  return Math.min(tx, ty);
}

/** Instant piercing line (railgun). */
function rail(s: GameScene, p: Player, a: number, width: number, dmg: number, color: number) {
  const len = toWall(p.x, p.y, a);
  const ex = p.x + Math.cos(a) * len;
  const ey = p.y + Math.sin(a) * len;
  s.fx.streak(p.x, p.y, ex, ey, color, width);
  for (const e of s.enemiesOnSegment(p.x, p.y, ex, ey, width / 2)) s.damage(e, dmg, { aoe: true, primary: true, kbAngle: a, kb: 120 });
}

export const MAX_LV = 5;

export const WEAPONS: Record<string, WeaponDef> = {
  bolt: {
    id: 'bolt', name: '星弹', icon: '✦', color: 0x5ee0ff, range: 260,
    desc: '高速穿透弹，单体输出稳定',
    rate: () => 3.2,
    levels: ['多射 1 发 · 伤害 +3', '穿透 +1 · 伤害 +3', '多射 1 发 · 伤害 +3', '穿透 +1 · 伤害 +3'],
    fire(s, p, lv) {
      const n = 1 + b(lv >= 2) + b(lv >= 4);
      const trail = p.trailT > 0; // 星轨 synergy
      for (let i = 0; i < n; i++) {
        const a = p.aimAngle + (i - (n - 1) / 2) * 0.13;
        s.spawnPBullet({
          x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, angle: a, speed: 700, dmg: (15 + 3 * (lv - 1)) * (trail ? 1.5 : 1),
          pierce: 1 + b(lv >= 3) + b(lv >= 5) + (trail ? 2 : 0), tex: 'bolt', life: 0.9, tint: trail ? 0xffe066 : undefined,
        });
      }
      sfx('shoot');
    },
  },

  slash: {
    id: 'slash', name: '斩击', icon: '⚔', color: 0xff6a4a, range: 70,
    desc: '近身扇形斩击，带击退',
    rate: () => 2.2,
    levels: ['伤害 +4 · 范围扩大', '每第 3 次斩击放出穿透剑气', '伤害 +4 · 范围扩大', '剑气改为每 2 次斩击'],
    fire(s, p, lv) {
      const blood = p.rageT > 0 && p.syn('bloodBlade');
      const range = 100 * (1 + 0.08 * (lv - 1)) * p.stats.areaMult * (p.rageT > 0 ? 1.15 : 1) * (blood ? 1.25 : 1);
      const half = (62 + 5 * (lv - 1)) * DEG;
      s.fx.slash(p.x, p.y, p.aimAngle, range, half, blood ? 0xff2030 : p.hero.color);
      for (const e of s.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > range + e.r) continue;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        if (Math.abs(Phaser.Math.Angle.Wrap(a - p.aimAngle)) > half + Math.atan2(e.r, Math.max(d, 1))) continue;
        s.damage(e, (25 + 4 * (lv - 1)) * (blood ? 1.5 : 1), { kbAngle: a, kb: 260, from: p, primary: true });
      }
      p.shots++;
      const every = lv >= 5 ? 2 : lv >= 3 ? 3 : 0;
      if (every && p.shots % every === 0) {
        s.spawnPBullet({ x: p.x, y: p.y, angle: p.aimAngle, speed: 560, dmg: 30 + 4 * (lv - 1), pierce: 99, tex: 'wave', life: 0.5, r: 22 });
      }
      sfx('slash');
    },
  },

  scatter: {
    id: 'scatter', name: '散射炮', icon: '⁂', color: 0xffc04a, range: 150,
    desc: '近距离扇形弹丸，击退强',
    rate: () => 1.5,
    levels: ['+1 弹丸 · 伤害 +2', '+1 弹丸 · 伤害 +2', '+1 弹丸 · 伤害 +2', '+1 弹丸 · 弹丸穿透 +1'],
    fire(s, p, lv) {
      const n = (5 + (lv - 1)) * (p.critNow && p.syn('gunKata') ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const a = p.aimAngle + (i / (n - 1) - 0.5) * 0.6 + Phaser.Math.FloatBetween(-0.04, 0.04);
        s.spawnPBullet({ x: p.x, y: p.y, angle: a, speed: Phaser.Math.Between(560, 680), dmg: 9 + 2 * (lv - 1), pierce: 1 + b(lv >= 5), tex: 'pellet', life: 0.36, kb: 170 });
      }
      s.shake(40, 0.002);
      sfx('slash');
    },
  },

  chain: {
    id: 'chain', name: '雷链', icon: 'ϟ', color: 0xa8b8ff, range: 230,
    desc: '闪电锁定准星附近的敌人并弹跳',
    rate: (lv) => 1.5 + 0.1 * (lv - 1),
    levels: ['伤害 +5 · 攻速提升', '弹跳 +1', '伤害 +5 · 攻速提升', '弹跳 +1'],
    fire(s, p, lv) {
      const range = 340;
      let first: Enemy | null = null;
      let best = Infinity;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > range + e.r) continue;
        const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - p.y, e.x - p.x) - p.aimAngle));
        const score = off < 40 * DEG ? off * 100 : 1000 + d; // prefer the one under the cursor
        if (score < best) { best = score; first = e; }
      }
      if (!first) return;
      const pts = [{ x: p.x, y: p.y }];
      const hit = new Set<Enemy>();
      let cur: Enemy | null = first;
      const jumps = 2 + Math.floor((lv - 1) / 2);
      for (let k = 0; k <= jumps && cur; k++) {
        hit.add(cur);
        pts.push({ x: cur.x, y: cur.y });
        s.damage(cur, (20 + 5 * Math.floor(lv / 2)) * (k === 0 ? 1 : 0.8), { kbAngle: Math.atan2(cur.y - p.y, cur.x - p.x), kb: 60, from: p, aoe: true, primary: true });
        let next: Enemy | null = null;
        let nd = 170;
        for (const e of s.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = Math.hypot(e.x - cur.x, e.y - cur.y);
          if (d < nd) { nd = d; next = e; }
        }
        cur = next;
      }
      s.fx.lightning(pts, 0xa8b8ff);
      sfx('zap');
    },
  },

  boomerang: {
    id: 'boomerang', name: '回旋刃', icon: '✣', color: 0xd0ff6a, range: 200,
    desc: '飞出后折返，往返都能伤害，无限穿透',
    rate: () => 1.0,
    levels: ['伤害 +5', '+1 把回旋刃', '伤害 +5 · 体积变大', '+1 把回旋刃'],
    fire(s, p, lv) {
      const n = 1 + b(lv >= 3) + b(lv >= 5);
      const big = lv >= 4 ? 1.35 : 1;
      for (let i = 0; i < n; i++) {
        const a = p.aimAngle + (i - (n - 1) / 2) * 0.4;
        s.spawnPBullet({ x: p.x, y: p.y, angle: a, speed: 640, dmg: 20 + 5 * (b(lv >= 2) + b(lv >= 4)), pierce: 999, tex: 'blade', life: 3, r: 16 * big, scale: big, boomerang: 0.42 });
      }
      sfx('blink');
    },
  },

  flame: {
    id: 'flame', name: '烈焰', icon: '♨', color: 0xff7a2a, range: 130,
    desc: '持续喷射火焰，命中附加灼烧',
    rate: () => 9,
    levels: ['灼烧伤害提升', '射程提升', '灼烧伤害提升', '射程提升 · 直接伤害 +2'],
    fire(s, p, lv) {
      const a = p.aimAngle + Phaser.Math.FloatBetween(-0.18, 0.18);
      const life = 0.32 + 0.06 * (b(lv >= 3) + b(lv >= 5));
      s.spawnPBullet({
        x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, angle: a, speed: 400, dmg: 3 + 2 * b(lv >= 5), pierce: 99,
        tex: 'flame', life, r: 12, kb: 12, quiet: true, grow: true,
        burn: { dps: 9 + 4 * (b(lv >= 2) + b(lv >= 4)), t: 2 },
      });
      sfx('flame');
    },
  },

  railgun: {
    id: 'railgun', name: '轨道炮', icon: '═', color: 0x8fd0ff, range: 300,
    desc: '慢速蓄能，瞬间射出贯穿全场的电磁炮',
    rate: (lv) => 0.75 + 0.08 * (lv - 1),
    levels: ['伤害 +15 · 射速提升', '炮线加粗', '伤害 +15 · 射速提升', '一次射出两道炮线'],
    fire(s, p, lv) {
      const width = lv >= 3 ? 28 : 18;
      const dmg = 55 + 15 * (lv >= 2 ? 1 : 0) + 15 * (lv >= 4 ? 1 : 0);
      if (lv >= 5) { rail(s, p, p.aimAngle - 0.08, width, dmg, 0x8fd0ff); rail(s, p, p.aimAngle + 0.08, width, dmg, 0x8fd0ff); }
      else rail(s, p, p.aimAngle, width, dmg, 0x8fd0ff);
      s.shake(70, 0.004);
      sfx('zap');
    },
  },

  venom: {
    id: 'venom', name: '毒刺', icon: '✧', color: 0x8aff5a, range: 240,
    desc: '高速毒镖，每次命中叠加中毒（层数越多伤害越高）',
    rate: () => 4,
    levels: ['每次命中多叠 1 层毒', '多射 1 发', '每次命中再多叠 1 层毒', '多射 1 发 · 伤害 +3'],
    fire(s, p, lv) {
      const n = 1 + b(lv >= 3) + b(lv >= 5);
      for (let i = 0; i < n; i++) {
        const a = p.aimAngle + (i - (n - 1) / 2) * 0.12;
        s.spawnPBullet({ x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, angle: a, speed: 780, dmg: 5 + 3 * b(lv >= 5), pierce: 1, tex: 'dart', life: 0.8, poison: 1 + b(lv >= 2) + b(lv >= 4) });
      }
      sfx('shoot');
    },
  },

  // ---------------------------------------------------------------- 究极武器 (evolved, see synergy.ts ULTIMATES)
  galaxy: {
    id: 'galaxy', name: '银河星爆', icon: '✶', color: 0xffe066, range: 260, ultimate: true, base: 'bolt',
    desc: '5 发金色穿透星弹，每 5 轮炸开一圈星环',
    rate: () => 3.6, levels: [],
    fire(s, p) {
      const trail = p.trailT > 0;
      for (let i = 0; i < 5; i++) {
        const a = p.aimAngle + (i - 2) * 0.1;
        s.spawnPBullet({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, angle: a, speed: 760, dmg: 30 * (trail ? 1.5 : 1), pierce: 5, tex: 'bolt', life: 1, scale: 1.4, tint: 0xffe066 });
      }
      p.shots++;
      if (p.shots % 5 === 0) {
        for (let i = 0; i < 14; i++) s.spawnPBullet({ x: p.x, y: p.y, angle: (i / 14) * Math.PI * 2, speed: 600, dmg: 22, pierce: 2, tex: 'bolt', life: 0.7, tint: 0xffe066 });
        s.fx.ring(p.x, p.y, 70, 0xffe066, 250);
      }
      sfx('shoot');
    },
  },
  bloodmoon: {
    id: 'bloodmoon', name: '血月斩', icon: '☾', color: 0xff3040, range: 70, ultimate: true, base: 'slash',
    desc: '360° 环斩并吸血，每斩放出巨型剑气',
    rate: () => 2.4, levels: [],
    fire(s, p) {
      const r = 150 * p.stats.areaMult * (p.rageT > 0 ? 1.15 : 1);
      s.fx.ring(p.x, p.y, r, 0xff3040, 220, 0.35);
      let dealt = 0;
      for (const e of s.enemiesInRadius(p.x, p.y, r)) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        s.damage(e, 50, { kbAngle: a, kb: 300, aoe: true, primary: true });
        dealt += 50;
      }
      p.heal(dealt * 0.03);
      s.spawnPBullet({ x: p.x, y: p.y, angle: p.aimAngle, speed: 600, dmg: 40, pierce: 99, tex: 'wave', life: 0.6, r: 30, scale: 1.5, tint: 0xff5060 });
      sfx('slash');
    },
  },
  annihilator: {
    id: 'annihilator', name: '毁灭炮', icon: '✹', color: 0xffa040, range: 160, ultimate: true, base: 'scatter',
    desc: '11 发弹丸，命中后爆炸',
    rate: () => 1.6, levels: [],
    fire(s, p) {
      for (let i = 0; i < 11; i++) {
        const a = p.aimAngle + (i / 10 - 0.5) * 0.75 + Phaser.Math.FloatBetween(-0.03, 0.03);
        s.spawnPBullet({ x: p.x, y: p.y, angle: a, speed: Phaser.Math.Between(560, 700), dmg: 14, pierce: 2, tex: 'pellet', life: 0.42, kb: 170, scale: 1.4, explode: { r: 55, dmg: 16 } });
      }
      s.shake(60, 0.003);
      sfx('boom');
    },
  },
  thunderGod: {
    id: 'thunderGod', name: '天雷', icon: '⚡', color: 0xd0d8ff, range: 230, ultimate: true, base: 'chain',
    desc: '闪电弹跳 7 次，并随机降下 2 道落雷',
    rate: () => 2, levels: [],
    fire(s, p) {
      const pool = s.enemies.filter((e) => !e.dead && e.x > ARENA.x && e.y > ARENA.y);
      if (!pool.length) return;
      let cur: Enemy | null = pool.reduce((a, e) => (Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? e : a));
      const pts = [{ x: p.x, y: p.y }];
      const hit = new Set<Enemy>();
      for (let k = 0; k <= 7 && cur; k++) {
        hit.add(cur);
        pts.push({ x: cur.x, y: cur.y });
        s.damage(cur, 42, { aoe: true, primary: true, kbAngle: Math.atan2(cur.y - p.y, cur.x - p.x), kb: 60 });
        let next: Enemy | null = null;
        let nd = 200;
        for (const e of s.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = Math.hypot(e.x - cur.x, e.y - cur.y);
          if (d < nd) { nd = d; next = e; }
        }
        cur = next;
      }
      s.fx.lightning(pts, 0xd0d8ff);
      for (const e of Phaser.Utils.Array.Shuffle(pool).slice(0, 2)) {
        if (e.dead) continue;
        s.fx.lightning([{ x: e.x + Phaser.Math.Between(-40, 40), y: e.y - 320 }, { x: e.x, y: e.y }], 0xffffff);
        s.damage(e, 50, { aoe: true });
      }
      sfx('zap');
    },
  },
  bladestorm: {
    id: 'bladestorm', name: '千刃风暴', icon: '❂', color: 0xe0ff8a, range: 200, ultimate: true, base: 'boomerang',
    desc: '一次掷出 5 把巨型回旋刃',
    rate: () => 1.4, levels: [],
    fire(s, p) {
      for (let i = 0; i < 5; i++) {
        const a = p.aimAngle + (i - 2) * 0.4;
        s.spawnPBullet({ x: p.x, y: p.y, angle: a, speed: 680, dmg: 34, pierce: 999, tex: 'blade', life: 3, r: 24, scale: 1.6, boomerang: 0.45, tint: 0xffffaa });
      }
      sfx('blink');
    },
  },
  dragonBreath: {
    id: 'dragonBreath', name: '冰焰龙息', icon: '❋', color: 0x9be8ff, range: 140, ultimate: true, base: 'flame',
    desc: '更宽更远的龙息，灼烧并减速',
    rate: () => 12, levels: [],
    fire(s, p) {
      for (let i = 0; i < 2; i++) {
        const a = p.aimAngle + Phaser.Math.FloatBetween(-0.3, 0.3);
        s.spawnPBullet({
          x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, angle: a, speed: 430, dmg: 6, pierce: 99, tex: 'flame', life: 0.5, r: 14,
          kb: 14, quiet: true, grow: true, burn: { dps: 28, t: 2 }, chill: 1.2, tint: i ? 0x9be8ff : undefined,
        });
      }
      sfx('flame');
    },
  },
  starBreaker: {
    id: 'starBreaker', name: '歼星炮', icon: '☲', color: 0xc8e8ff, range: 300, ultimate: true, base: 'railgun',
    desc: '三道扇形巨型炮线，贯穿全场',
    rate: () => 0.95, levels: [],
    fire(s, p) {
      for (const off of [-0.16, 0, 0.16]) rail(s, p, p.aimAngle + off, 34, 140, 0xffffff);
      s.shake(120, 0.008);
      sfx('boom');
    },
  },
  plagueLord: {
    id: 'plagueLord', name: '万毒之源', icon: '☣', color: 0xb0ff6a, range: 240, ultimate: true, base: 'venom',
    desc: '5 发毒镖每发叠 3 层毒（上限 20），中毒者死亡时扩散',
    rate: () => 4.2, levels: [],
    fire(s, p) {
      for (let i = 0; i < 5; i++) {
        const a = p.aimAngle + (i - 2) * 0.13;
        s.spawnPBullet({ x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, angle: a, speed: 800, dmg: 8, pierce: 2, tex: 'dart', life: 0.9, poison: 3, tint: 0xd0ff80 });
      }
      sfx('shoot');
    },
  },
};
