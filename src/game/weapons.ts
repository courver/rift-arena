import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Player } from './Player';
import type { Enemy } from './Enemy';
import { sfx } from '../sfx';

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
      for (let i = 0; i < n; i++) {
        const a = p.aimAngle + (i - (n - 1) / 2) * 0.13;
        s.spawnPBullet({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, angle: a, speed: 700, dmg: 15 + 3 * (lv - 1), pierce: 1 + b(lv >= 3) + b(lv >= 5), tex: 'bolt', life: 0.9 });
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
      const range = 100 * (1 + 0.08 * (lv - 1)) * p.stats.areaMult * (p.rageT > 0 ? 1.15 : 1);
      const half = (62 + 5 * (lv - 1)) * DEG;
      s.fx.slash(p.x, p.y, p.aimAngle, range, half, p.hero.color);
      for (const e of s.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > range + e.r) continue;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        if (Math.abs(Phaser.Math.Angle.Wrap(a - p.aimAngle)) > half + Math.atan2(e.r, Math.max(d, 1))) continue;
        s.damage(e, 25 + 4 * (lv - 1), { kbAngle: a, kb: 260, from: p, primary: true });
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
      const n = 5 + (lv - 1);
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
};
