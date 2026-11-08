import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Player } from './Player';
import { sfx } from '../sfx';

const DEG = Math.PI / 180;

/** Primary attack (held left mouse button). */
export function primary(s: GameScene, p: Player) {
  if (p.hero.id === 'lumen') {
    const n = 1 + p.mod('multishot');
    const spread = 0.13;
    for (let i = 0; i < n; i++) {
      const a = p.aimAngle + (i - (n - 1) / 2) * spread;
      s.spawnPBullet(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a, 700, 15, 1 + p.mod('pierce'), 'bolt', 0.9);
    }
    sfx('shoot');
    return;
  }

  const wide = p.mod('wideBlade');
  const range = 100 * (1 + 0.2 * wide) * p.stats.areaMult * (p.rageT > 0 ? 1.15 : 1);
  const half = (62 + 10 * wide) * DEG;
  s.fx.slash(p.x, p.y, p.aimAngle, range, half, p.hero.color);
  for (const e of s.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > range + e.r) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    if (Math.abs(Phaser.Math.Angle.Wrap(a - p.aimAngle)) > half + Math.atan2(e.r, Math.max(d, 1))) continue;
    s.damage(e, 22, { kbAngle: a, kb: 260 });
  }
  p.slashCount++;
  if (p.mod('slashWave') && p.slashCount % 3 === 0) {
    s.spawnPBullet(p.x, p.y, p.aimAngle, 560, 30, 99, 'wave', 0.5);
  }
  sfx('slash');
}

/** Returns false when on cooldown. */
export function cast(s: GameScene, p: Player, key: 'Q' | 'E' | 'R'): boolean {
  if (p.cd[key] > 0) {
    sfx('deny');
    return false;
  }
  p.cd[key] = p.cdOf(key);
  if (p.hero.id === 'lumen') castLumen(s, p, key);
  else castKael(s, p, key);
  return true;
}

function frostNova(s: GameScene, p: Player, x: number, y: number, radius: number, dmg: number) {
  const r = radius * p.stats.areaMult;
  s.fx.ring(x, y, r, 0x9be8ff, 350);
  s.fx.burst(x, y, 0x9be8ff, 24, 320);
  for (const e of s.enemiesInRadius(x, y, r)) {
    s.damage(e, dmg, { kbAngle: Math.atan2(e.y - y, e.x - x), kb: 180 });
    if (p.mod('permafrost') && e.type !== 'boss') e.freezeT = 1.2;
    e.slowT = 2.2;
  }
  sfx('nova');
}

function castLumen(s: GameScene, p: Player, key: 'Q' | 'E' | 'R') {
  if (key === 'Q') {
    const mv = s.moveDir();
    const a = mv ? Math.atan2(mv.y, mv.x) : p.aimAngle;
    s.fx.afterimage(p.sprite, p.hero.color);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      p.x += (Math.cos(a) * 200) / steps;
      p.y += (Math.sin(a) * 200) / steps;
      s.clampToArena(p);
      if (i < steps) s.fx.burst(p.x, p.y, p.hero.color, 3, 60);
    }
    p.iframes = Math.max(p.iframes, 0.35);
    s.fx.ring(p.x, p.y, 40, p.hero.color, 200);
    if (p.mod('blinkNova')) frostNova(s, p, p.x, p.y, 95, 22);
    sfx('blink');
  } else if (key === 'E') {
    frostNova(s, p, p.x, p.y, 150, 32);
    s.shake(80, 0.004);
  } else {
    const { x: tx, y: ty } = s.aimPoint();
    meteor(s, p, tx, ty, 165, 140, 650, true);
    if (p.mod('meteorShower')) {
      for (let i = 0; i < 5; i++) {
        s.time.delayedCall(700 + i * 160, () =>
          meteor(s, p, tx + Phaser.Math.Between(-170, 170), ty + Phaser.Math.Between(-170, 170), 80, 55, 300, false));
      }
    }
  }
}

function meteor(s: GameScene, p: Player, x: number, y: number, radius: number, dmg: number, delay: number, big: boolean) {
  const r = radius * p.stats.areaMult;
  s.fx.telegraphCircle(x, y, r, delay, p.hero.color);
  s.time.delayedCall(delay, () => {
    if (s.over) return;
    s.fx.ring(x, y, r, 0xfff0a0, 450, 0.5);
    s.fx.burst(x, y, 0xffe080, big ? 40 : 14, big ? 420 : 240);
    s.shake(big ? 220 : 90, big ? 0.012 : 0.005);
    for (const e of s.enemiesInRadius(x, y, r)) s.damage(e, dmg, { kbAngle: Math.atan2(e.y - y, e.x - x), kb: 320, big });
    sfx('boom');
  });
}

function castKael(s: GameScene, p: Player, key: 'Q' | 'E' | 'R') {
  if (key === 'Q') {
    const a = p.aimAngle;
    const dur = 0.16;
    p.dashT = dur;
    p.dashVx = (Math.cos(a) * 240) / dur;
    p.dashVy = (Math.sin(a) * 240) / dur;
    p.dashHit.clear();
    p.iframes = Math.max(p.iframes, 0.3);
    sfx('blink');
  } else if (key === 'E') {
    p.whirlT = 1.6;
    p.whirlTick = 0;
    s.spawnWhirl(p);
  } else {
    p.rageT = 6 + 3 * p.mod('longRage');
    const r = 170 * p.stats.areaMult;
    s.fx.ring(p.x, p.y, r, 0xff3020, 400, 0.4);
    s.fx.burst(p.x, p.y, 0xff5030, 36, 380);
    s.shake(200, 0.01);
    for (const e of s.enemiesInRadius(p.x, p.y, r)) s.damage(e, 65, { kbAngle: Math.atan2(e.y - p.y, e.x - p.x), kb: 520, big: true });
    sfx('rage');
  }
}

/** Per-frame ability logic (dash contact, whirlwind ticks). */
export function updateKit(s: GameScene, p: Player, dt: number) {
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dashVx * dt;
    p.y += p.dashVy * dt;
    s.clampToArena(p);
    s.fx.afterimage(p.sprite, p.hero.color);
    for (const e of s.enemies) {
      if (e.dead || p.dashHit.has(e)) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 14) {
        p.dashHit.add(e);
        const killed = s.damage(e, 38, { kbAngle: Math.atan2(p.dashVy, p.dashVx) + Math.PI / 2, kb: 300 });
        if (killed && p.mod('chainDash')) p.cd.Q = 0;
      }
    }
  }
  if (p.whirlT > 0) {
    p.whirlT -= dt;
    p.whirlTick -= dt;
    const r = 115 * p.stats.areaMult;
    if (p.mod('vortex')) {
      for (const e of s.enemiesInRadius(p.x, p.y, r * 1.6)) {
        if (e.type === 'boss') continue;
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.x += Math.cos(a) * 140 * dt;
        e.y += Math.sin(a) * 140 * dt;
      }
    }
    if (p.whirlTick <= 0) {
      p.whirlTick = 0.25;
      for (const e of s.enemiesInRadius(p.x, p.y, r)) s.damage(e, 13, { kbAngle: Math.atan2(e.y - p.y, e.x - p.x), kb: 60 });
      sfx('slash');
    }
  }
}
