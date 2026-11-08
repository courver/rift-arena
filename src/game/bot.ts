import type { GameScene } from '../scenes/GameScene';
import { ARENA } from '../config';
import type { Enemy } from './Enemy';
import { SKILLS } from './skills';

/**
 * Autoplay used for balance testing (?bot). Steers with simple potential fields:
 * pushed away from enemies and bullets, pulled toward a preferred distance from the target.
 */
export class Bot {
  move: { x: number; y: number } | null = null;
  aim = 0;
  fire = false;
  target: Enemy | null = null;
  private castCd = 0;

  update(s: GameScene, dt: number) {
    const p = s.player;
    const range = p.weapon.range;
    const melee = range < 100;
    this.castCd -= dt;
    let target: Enemy | null = null;
    let best = Infinity;
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) { best = d; target = e; }
    }
    this.target = target;
    this.fire = !!target;
    let fx = 0;
    let fy = 0;
    if (target) {
      this.aim = Math.atan2(target.y - p.y, target.x - p.x);
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      const want = melee ? (p.whirlT > 0 || p.rageT > 0 ? 20 : range) + target.r : range;
      const pull = (d - want) / 100;
      fx += Math.cos(this.aim) * pull;
      fy += Math.sin(this.aim) * pull;
    }
    for (const e of s.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.max(1, Math.hypot(dx, dy) - e.r);
      const reach = melee ? 60 : Math.min(170, range * 0.7);
      if (d < reach) {
        const w = (reach - d) / reach * (e.state === 'charge' || e.state === 'windup' ? 4 : 1.5);
        fx += (dx / d) * w;
        fy += (dy / d) * w;
      }
    }
    for (const b of s.eBullets) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      if (d > 140) continue;
      // only dodge bullets heading our way, sideways to their path
      if (dx * b.vx + dy * b.vy <= 0) continue;
      const side = Math.sign(dx * -b.vy + dy * b.vx) || 1;
      const sp = Math.hypot(b.vx, b.vy);
      const w = (140 - d) / 140 * 3;
      fx += (-b.vy / sp) * side * w;
      fy += (b.vx / sp) * side * w;
    }
    // step out of telegraphed slams and beams
    for (const h of s.hazards) {
      if (h.a === undefined) {
        const dx = p.x - h.x;
        const dy = p.y - h.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        if (d < h.r + p.r + 20) {
          fx += (dx / d) * 6;
          fy += (dy / d) * 6;
        }
      } else {
        const rx = p.x - h.x;
        const ry = p.y - h.y;
        const along = rx * Math.cos(h.a) + ry * Math.sin(h.a);
        const across = -rx * Math.sin(h.a) + ry * Math.cos(h.a);
        if (along > 0 && along < h.len! && Math.abs(across) < h.r + p.r + 20) {
          const side = Math.sign(across) || 1;
          fx += -Math.sin(h.a) * side * 6;
          fy += Math.cos(h.a) * side * 6;
        }
      }
    }
    // keep off the walls
    const cx = ARENA.x + ARENA.w / 2;
    const cy = ARENA.y + ARENA.h / 2;
    const edge = 90;
    if (p.x < ARENA.x + edge || p.x > ARENA.x + ARENA.w - edge) fx += Math.sign(cx - p.x) * 1.5;
    if (p.y < ARENA.y + edge || p.y > ARENA.y + ARENA.h - edge) fy += Math.sign(cy - p.y) * 1.5;

    const l = Math.hypot(fx, fy);
    this.move = l > 0.15 ? { x: fx / l, y: fy / l } : null;

    if (!target || this.castCd > 0) return;
    const near = (r: number) => s.enemiesInRadius(p.x, p.y, r).length;
    const danger = near(70) >= 2 || p.hp < p.stats.maxHp * 0.35 || s.eBullets.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 40);
    const cluster = s.enemiesInRadius(target.x, target.y, 180).length;
    const bigFight = !!s.boss || target.type === 'elite';
    for (const slot of ['Q', 'E', 'R'] as const) {
      if (p.cd[slot] > 0) continue;
      const use = SKILLS[p.loadout[slot].id].use;
      const go =
        use === 'escape' ? danger :
        use === 'engage' ? best > 140 && best < 300 :
        use === 'aoe' ? near(140) >= 3 || (bigFight && best < 150) :
        use === 'zone' ? cluster >= 4 || bigFight :
        use === 'summon' ? s.enemies.length >= 4 :
        cluster >= 5 || bigFight;
      if (go) {
        s.tryCast(slot);
        this.castCd = 0.3;
        return;
      }
    }
  }
}
