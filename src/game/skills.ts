import Phaser from 'phaser';
import type { SkillSlot } from '../data/heroes';
import type { GameScene } from '../scenes/GameScene';
import type { Player } from './Player';
import type { Enemy } from './Enemy';
import { sfx } from '../sfx';
import { ARENA } from '../config';
import { ART_SCALE } from './art';

const b =(cond: boolean) => (cond ? 1 : 0);

/** How the bot should use a skill. */
export type SkillUse = 'escape' | 'engage' | 'strike' | 'aoe' | 'zone' | 'summon' | 'ult';

export interface SkillDef {
  id: string;
  slot: SkillSlot;
  name: string;
  icon: string;
  desc: string;
  use: SkillUse;
  cd(lv: number): number;
  /** stored charges at this level (default 1) */
  charges?(lv: number): number;
  /** text for reaching lv 2..5 (index 0 = lv2) */
  levels: string[];
  cast(s: GameScene, p: Player, lv: number): void;
}

/** Something that lives in the arena for a while (turret, decoy, beam...). */
export interface Effect {
  update(s: GameScene, dt: number): boolean;
  destroy(): void;
}

// ------------------------------------------------------------------ shared pieces

function frostNova(s: GameScene, p: Player, x: number, y: number, radius: number, dmg: number, freeze: boolean) {
  const r = radius * p.stats.areaMult;
  s.fx.ring(x, y, r, 0x9be8ff, 350);
  s.fx.burst(x, y, 0x9be8ff, 24, 320);
  const frostfire = p.syn('frostfire');
  for (const e of s.enemiesInRadius(x, y, r)) {
    if (frostfire && e.burnT > 0) {
      s.damage(e, 45, { aoe: true, big: true });
      s.fx.burst(e.x, e.y, 0xff9a3a, 8, 200);
    }
    s.damage(e, dmg, { kbAngle: Math.atan2(e.y - y, e.x - x), kb: 180, aoe: true });
    if (freeze && !e.isBoss) e.freezeT = 1.2;
    e.slowT = 2.2;
  }
  sfx('nova');
}

function meteor(s: GameScene, p: Player, x: number, y: number, radius: number, dmg: number, delay: number, big: boolean) {
  const r = radius * p.stats.areaMult;
  s.fx.telegraphCircle(x, y, r, delay, p.hero.color);
  s.time.delayedCall(delay, () => {
    if (s.over) return;
    s.fx.ring(x, y, r, 0xfff0a0, 450, 0.5);
    s.fx.burst(x, y, 0xffe080, big ? 40 : 14, big ? 420 : 240);
    s.shake(big ? 220 : 90, big ? 0.012 : 0.005);
    for (const e of s.enemiesInRadius(x, y, r)) s.damage(e, dmg, { kbAngle: Math.atan2(e.y - y, e.x - x), kb: 320, big, aoe: true });
    sfx('boom');
  });
}

function blast(s: GameScene, x: number, y: number, r: number, dmg: number, color: number) {
  s.fx.ring(x, y, r, color, 380, 0.4);
  s.fx.burst(x, y, color, 26, 340);
  s.shake(140, 0.007);
  for (const e of s.enemiesInRadius(x, y, r)) s.damage(e, dmg, { kbAngle: Math.atan2(e.y - y, e.x - x), kb: 300, aoe: true });
  sfx('boom');
}

function dashDir(s: GameScene, p: Player) {
  const mv = s.moveDir();
  return mv ? Math.atan2(mv.y, mv.x) : p.aimAngle;
}

// ------------------------------------------------------------------ effects

class Decoy implements Effect {
  img: Phaser.GameObjects.Image;
  readonly r = 16;
  constructor(s: GameScene, public x: number, public y: number, private t: number, private boom: number, color: number) {
    // a ghostly copy of the hero
    this.img = s.add.image(x, y, 'hero_' + s.player.hero.id).setScale(ART_SCALE).setFlipX(s.player.sprite.flipX).setTint(color).setAlpha(0.75).setDepth(9);
    s.tweens.add({ targets: this.img, alpha: 0.4, yoyo: true, repeat: -1, duration: 300 });
    s.decoy = this;
  }
  private throwT = 0.2;
  update(s: GameScene, dt: number) {
    this.t -= dt;
    if (s.player.syn('phantomBlade')) {
      this.throwT -= dt;
      if (this.throwT <= 0) {
        this.throwT = 0.7;
        let best = 500;
        let a = Math.random() * Math.PI * 2;
        for (const e of s.enemies) {
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (!e.dead && d < best) { best = d; a = Math.atan2(e.y - this.y, e.x - this.x); }
        }
        s.spawnPBullet({ x: this.x, y: this.y, angle: a, speed: 600, dmg: 24, pierce: 999, tex: 'blade', life: 3, r: 16, boomerang: 0.4, primary: false });
      }
    }
    if (this.t > 0) return true;
    if (this.boom) blast(s, this.x, this.y, 130 * s.player.stats.areaMult, this.boom, 0xc08bff);
    return false;
  }
  destroy() {
    this.img.destroy();
  }
}

class GravityWell implements Effect {
  img: Phaser.GameObjects.Image;
  private tick = 0;
  private zapT = 0.3;
  constructor(s: GameScene, private x: number, private y: number, private r: number, private t: number, private dmg: number, private implode: number) {
    this.img = s.add.image(x, y, 'ring').setTint(0xb07bff).setAlpha(0.8).setDepth(3).setScale((r * 2) / 128);
    s.fx.ring(x, y, r, 0xb07bff, 300, 0.2);
  }
  update(s: GameScene, dt: number) {
    this.t -= dt;
    this.tick -= dt;
    this.img.rotation -= dt * 4;
    this.img.setScale(((this.r * 2) / 128) * (0.85 + 0.15 * Math.sin(this.t * 10)));
    for (const e of s.enemiesInRadius(this.x, this.y, this.r)) {
      if (e.isBoss) continue;
      const d = Math.hypot(this.x - e.x, this.y - e.y);
      if (d < 8) continue;
      const pull = (e.type === 'elite' ? 80 : 190) * dt;
      e.x += ((this.x - e.x) / d) * Math.min(pull, d);
      e.y += ((this.y - e.y) / d) * Math.min(pull, d);
    }
    if (this.tick <= 0) {
      this.tick = 0.3;
      for (const e of s.enemiesInRadius(this.x, this.y, this.r)) s.damage(e, this.dmg, { aoe: true });
    }
    this.zapT -= dt;
    if (this.zapT <= 0 && s.player.syn('thunderWell')) {
      this.zapT = 0.6;
      const inside = Phaser.Utils.Array.Shuffle(s.enemiesInRadius(this.x, this.y, this.r)).slice(0, 3);
      for (const e of inside) {
        s.fx.lightning([{ x: e.x + Phaser.Math.Between(-30, 30), y: e.y - 260 }, { x: e.x, y: e.y }], 0xa8b8ff);
        s.damage(e, 30, { aoe: true });
      }
      if (inside.length) sfx('zap');
    }
    if (this.t > 0) return true;
    if (this.implode) blast(s, this.x, this.y, this.r * 0.7, this.implode, 0xb07bff);
    return false;
  }
  destroy() {
    this.img.destroy();
  }
}

class Turret implements Effect {
  img: Phaser.GameObjects.Image;
  private fireT = 0.3;
  constructor(s: GameScene, private x: number, private y: number, private t: number, private lv: number) {
    this.img = s.add.image(x, y, 'turret').setDepth(6);
    s.fx.ring(x, y, 40, 0x7bff9e, 250);
  }
  update(s: GameScene, dt: number) {
    this.t -= dt;
    this.fireT -= dt;
    let target: Enemy | null = null;
    let best = 430;
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (!e.dead && d < best) { best = d; target = e; }
    }
    if (target) {
      const a = Math.atan2(target.y - this.y, target.x - this.x);
      this.img.setRotation(a);
      if (this.fireT <= 0) {
        this.fireT = 0.4;
        const battery = s.player.syn('battery');
        const n = (1 + b(this.lv >= 3)) * (battery ? 3 : 1);
        for (let i = 0; i < n; i++) {
          const aa = a + (i - (n - 1) / 2) * (battery ? 0.16 : 0.12);
          s.spawnPBullet({ x: this.x, y: this.y, angle: aa, speed: 650, dmg: 11 + 3 * (this.lv - 1), pierce: this.lv >= 5 ? 3 : 1, tex: battery ? 'pellet' : 'tbolt', life: 0.8, primary: false });
        }
        sfx('shoot');
      }
    }
    this.img.setAlpha(this.t < 1.5 && Math.floor(this.t * 8) % 2 ? 0.4 : 1);
    return this.t > 0;
  }
  destroy() {
    this.img.destroy();
  }
}

class Laser implements Effect {
  g: Phaser.GameObjects.Graphics;
  private tick = 0;
  constructor(s: GameScene, private t: number, private dmg: number, private width: number) {
    this.g = s.add.graphics().setDepth(8);
  }
  update(s: GameScene, dt: number) {
    const p = s.player;
    this.t -= dt;
    this.tick -= dt;
    const ca = Math.cos(p.aimAngle);
    const sa = Math.sin(p.aimAngle);
    // stop the beam at the arena wall
    const tx = ca > 0 ? (ARENA.x + ARENA.w - p.x) / ca : ca < 0 ? (ARENA.x - p.x) / ca : Infinity;
    const ty = sa > 0 ? (ARENA.y + ARENA.h - p.y) / sa : sa < 0 ? (ARENA.y - p.y) / sa : Infinity;
    const len = Math.min(tx, ty);
    const w = this.width * p.stats.areaMult;
    const flick = 0.85 + Math.random() * 0.3;
    this.g.clear();
    this.g.lineStyle(w * flick, 0xffe9a0, 0.35).lineBetween(p.x, p.y, p.x + ca * len, p.y + sa * len);
    this.g.lineStyle(w * 0.45 * flick, 0xffffff, 0.9).lineBetween(p.x, p.y, p.x + ca * len, p.y + sa * len);
    this.g.fillStyle(0xffffff, 0.9).fillCircle(p.x + ca * 20, p.y + sa * 20, w * 0.5);
    if (this.tick <= 0) {
      this.tick = 0.1;
      s.shake(60, 0.003);
      for (const e of s.enemies) {
        if (e.dead) continue;
        const rx = e.x - p.x;
        const ry = e.y - p.y;
        const along = rx * ca + ry * sa;
        const across = Math.abs(-rx * sa + ry * ca);
        if (along > 0 && along < len && across < w / 2 + e.r) s.damage(e, this.dmg, { aoe: true, kbAngle: p.aimAngle, kb: 40 });
      }
    }
    return this.t > 0;
  }
  destroy() {
    this.g.destroy();
  }
}

// ------------------------------------------------------------------ definitions

export const SKILLS: Record<string, SkillDef> = {
  // ---- Q: mobility ----
  blink: {
    id: 'blink', slot: 'Q', name: '相位闪', icon: '➤', use: 'strike',
    desc: '瞬移穿过敌群，斩伤路径上的所有敌人，短暂无敌',
    cd: (lv) => 4000 - 250 * (lv - 1),
    charges: (lv) => (lv >= 4 ? 2 : 1),
    levels: ['路径伤害 +6 · 冷却 -0.25 秒', '穿行击杀敌人时返还 1 层充能', '充能变为 2 层', '落点星爆 · 路径伤害 ×1.5'],
    cast(s, p, lv) {
      const a = dashDir(s, p);
      const dist = 220;
      const x0 = p.x;
      const y0 = p.y;
      s.fx.afterimage(p.sprite, p.hero.color);
      for (let i = 1; i <= 4; i++) {
        p.x += (Math.cos(a) * dist) / 4;
        p.y += (Math.sin(a) * dist) / 4;
        s.clampToArena(p);
        if (i < 4) s.fx.burst(p.x, p.y, p.hero.color, 3, 60);
      }
      p.iframes = Math.max(p.iframes, 0.2);
      s.fx.streak(x0, y0, p.x, p.y, p.hero.color);
      // cut everything along the path
      const dmg = (14 + 6 * (lv - 1)) * (lv >= 5 ? 1.5 : 1);
      const hit = s.enemiesOnSegment(x0, y0, p.x, p.y, 34);
      let refunded = false;
      for (const e of hit) {
        const killed = s.damage(e, dmg, { aoe: true, kbAngle: a + Math.PI / 2, kb: 140 });
        if (killed && lv >= 3 && !refunded) {
          refunded = true;
          p.refund('Q');
          s.fx.text(p.x, p.y - 26, '充能 +1', '#5ee0ff');
        }
      }
      if (hit.length >= 3) s.hitstop = Math.max(s.hitstop, 0.05);
      s.fx.ring(p.x, p.y, 40, p.hero.color, 200);
      if (lv >= 5) frostNova(s, p, p.x, p.y, 110, 40, false);
      if (p.syn('starTrail')) p.trailT = 2.5;
      sfx(hit.length ? 'slash' : 'blink');
    },
  },
  dashStrike: {
    id: 'dashStrike', slot: 'Q', name: '突进斩', icon: '⇶', use: 'engage',
    desc: '冲向准星方向，沿途造成伤害，短暂无敌',
    cd: (lv) => 5000 - 300 * (lv - 1),
    charges: (lv) => (lv >= 5 ? 2 : 1),
    levels: ['伤害 +10', '击杀敌人时返还 1 层充能', '伤害 +10', '2 层充能 · 突进距离 +40%'],
    cast(s, p, lv) {
      const dur = 0.16;
      const dist = 240 * (lv >= 5 ? 1.4 : 1);
      p.dashT = dur;
      p.dashVx = (Math.cos(p.aimAngle) * dist) / dur;
      p.dashVy = (Math.sin(p.aimAngle) * dist) / dur;
      p.dashDmg = 38 + 10 * (b(lv >= 2) + b(lv >= 4));
      p.dashRefund = lv >= 3;
      p.dashHit.clear();
      p.iframes = Math.max(p.iframes, 0.3);
      sfx('blink');
    },
  },
  shadowStep: {
    id: 'shadowStep', slot: 'Q', name: '幻影步', icon: '☍', use: 'escape',
    desc: '闪开并在原地留下分身，敌人会转去攻击分身',
    cd: (lv) => 7000 - 400 * (lv - 1),
    levels: ['分身持续 +0.4 秒', '分身消失时爆炸', '分身持续 +0.4 秒', '爆炸伤害翻倍'],
    cast(s, p, lv) {
      s.addEffect(new Decoy(s, p.x, p.y, 2.5 + 0.4 * (b(lv >= 2) + b(lv >= 4)), lv >= 3 ? (55 + 10 * (lv - 3)) * (lv >= 5 ? 2 : 1) : 0, 0xc8a8ff));
      const a = dashDir(s, p);
      s.fx.afterimage(p.sprite, 0xc08bff);
      p.x += Math.cos(a) * 160;
      p.y += Math.sin(a) * 160;
      s.clampToArena(p);
      p.iframes = Math.max(p.iframes, 0.3);
      sfx('blink');
    },
  },

  // ---- E: utility ----
  frostNova: {
    id: 'frostNova', slot: 'E', name: '霜环', icon: '❄', use: 'aoe',
    desc: '冲击周围敌人并减速 50%',
    cd: (lv) => 7000 - 400 * (lv - 1),
    levels: ['伤害、范围提升', '改为冻结敌人 1.2 秒', '伤害、范围提升', '伤害、范围提升'],
    cast(s, p, lv) {
      frostNova(s, p, p.x, p.y, 150 * (1 + 0.08 * (lv - 1)), 32 + 8 * (lv - 1), lv >= 3);
      s.shake(80, 0.004);
    },
  },
  whirlwind: {
    id: 'whirlwind', slot: 'E', name: '旋风', icon: '◎', use: 'aoe',
    desc: '持续旋转，伤害周围敌人',
    cd: (lv) => 8000 - 400 * (lv - 1),
    levels: ['伤害 +3 · 持续 +0.2 秒', '把周围敌人卷向你', '伤害 +3 · 持续 +0.2 秒', '伤害 +3 · 持续 +0.2 秒'],
    cast(s, p, lv) {
      p.whirlT = 1.6 + 0.2 * (lv - 1);
      p.whirlTick = 0;
      p.whirlLv = lv;
      s.spawnWhirl(p);
    },
  },
  gravityWell: {
    id: 'gravityWell', slot: 'E', name: '引力井', icon: '◉', use: 'zone',
    desc: '在准星处制造引力场，吸住并持续伤害敌人',
    cd: (lv) => 9000 - 500 * (lv - 1),
    levels: ['伤害提升', '结束时坍缩爆炸', '伤害提升', '范围 +25%'],
    cast(s, p, lv) {
      const pt = s.aimPoint();
      s.addEffect(new GravityWell(s, pt.x, pt.y, 190 * p.stats.areaMult * (lv >= 5 ? 1.25 : 1), 3, 8 + 3 * (lv - 1), lv >= 3 ? 60 + 20 * (lv - 3) : 0));
      sfx('nova');
    },
  },
  turret: {
    id: 'turret', slot: 'E', name: '哨戒炮台', icon: '⌖', use: 'summon',
    desc: '放下一座自动射击最近敌人的炮台',
    cd: (lv) => 12000 - 700 * (lv - 1),
    levels: ['持续 +1 秒 · 伤害 +3', '每次射出 2 发', '持续 +1 秒 · 伤害 +3', '子弹穿透 3 个敌人'],
    cast(s, p, lv) {
      s.addEffect(new Turret(s, p.x, p.y, 7 + (lv - 1), lv));
      sfx('spawn');
    },
  },

  // ---- R: ultimates ----
  starfall: {
    id: 'starfall', slot: 'R', name: '坠星', icon: '☄', use: 'ult',
    desc: '在准星处召下陨星，巨额范围伤害',
    cd: (lv) => 26000 - 1500 * (lv - 1),
    levels: ['伤害 +35', '追加 5 颗小陨石', '伤害 +35', '小陨石增加到 8 颗'],
    cast(s, p, lv) {
      const { x, y } = s.aimPoint();
      meteor(s, p, x, y, 165, 140 + 35 * (lv - 1), 650, true);
      const extra = lv >= 5 ? 8 : lv >= 3 ? 5 : 0;
      for (let i = 0; i < extra; i++) {
        s.time.delayedCall(700 + i * 140, () =>
          meteor(s, p, x + Phaser.Math.Between(-170, 170), y + Phaser.Math.Between(-170, 170), 80, 55, 300, false));
      }
    },
  },
  bloodrage: {
    id: 'bloodrage', slot: 'R', name: '血怒', icon: '♥', use: 'ult',
    desc: '震退周围敌人；期间攻速、吸血、移速大增',
    cd: (lv) => 26000 - 1500 * (lv - 1),
    levels: ['持续 +1 秒 · 冲击伤害 +20', '血怒期间受到伤害 -30%', '持续 +1 秒 · 冲击伤害 +20', '冲击范围 +30%'],
    cast(s, p, lv) {
      p.rageT = 6 + (lv - 1);
      p.rageArmor = lv >= 3;
      const r = 170 * p.stats.areaMult * (lv >= 5 ? 1.3 : 1);
      s.fx.ring(p.x, p.y, r, 0xff3020, 400, 0.4);
      s.fx.burst(p.x, p.y, 0xff5030, 36, 380);
      s.shake(200, 0.01);
      for (const e of s.enemiesInRadius(p.x, p.y, r)) s.damage(e, 65 + 20 * (lv - 1), { kbAngle: Math.atan2(e.y - p.y, e.x - p.x), kb: 520, big: true, aoe: true });
      sfx('rage');
    },
  },
  timeStop: {
    id: 'timeStop', slot: 'R', name: '时间凝滞', icon: '⌛', use: 'ult',
    desc: '冻结所有敌人和敌方子弹',
    cd: (lv) => 30000 - 1500 * (lv - 1) - (lv >= 5 ? 3000 : 0),
    levels: ['持续 +0.5 秒', '凝滞期间伤害 +30%', '持续 +0.5 秒', '冷却额外 -3 秒'],
    cast(s, p, lv) {
      s.startTimeStop(3 + 0.5 * (b(lv >= 2) + b(lv >= 4)), lv >= 3);
      sfx('nova');
    },
  },
  laser: {
    id: 'laser', slot: 'R', name: '天罚光束', icon: '☀', use: 'ult',
    desc: '朝准星方向持续发射贯穿光束，跟随鼠标转向',
    cd: (lv) => 24000 - 1500 * (lv - 1),
    levels: ['伤害 +4 · 持续 +0.2 秒', '光束变粗 50%', '伤害 +4 · 持续 +0.2 秒', '伤害 +4 · 持续 +0.2 秒'],
    cast(s, p, lv) {
      s.addEffect(new Laser(s, 1.6 + 0.2 * (lv - 1), 14 + 4 * (lv - 1), lv >= 3 ? 60 : 40));
      sfx('rage');
    },
  },
};

/** Per-frame ability logic tied to the player (dash contact, whirlwind ticks). */
export function updatePlayerSkills(s: GameScene, p: Player, dt: number) {
  p.trailT -= dt;
  if (p.dashT > 0) {
    p.dashT -= dt;
    if (p.dashT <= 0 && p.syn('shadowDance')) {
      p.whirlT = Math.max(p.whirlT, 0.8);
      p.whirlTick = 0;
      p.whirlLv = p.loadout.E.id === 'whirlwind' ? p.loadout.E.lv : 1;
      s.spawnWhirl(p);
    }
    p.x += p.dashVx * dt;
    p.y += p.dashVy * dt;
    s.clampToArena(p);
    s.fx.afterimage(p.sprite, p.hero.color);
    for (const e of s.enemies) {
      if (e.dead || p.dashHit.has(e)) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 14) {
        p.dashHit.add(e);
        const killed = s.damage(e, p.dashDmg, { kbAngle: Math.atan2(p.dashVy, p.dashVx) + Math.PI / 2, kb: 300, aoe: true });
        if (killed && p.dashRefund) p.refund('Q');
      }
    }
  }
  if (p.whirlT > 0) {
    p.whirlT -= dt;
    p.whirlTick -= dt;
    const r = 115 * p.stats.areaMult;
    if (p.whirlLv >= 3) {
      for (const e of s.enemiesInRadius(p.x, p.y, r * 1.6)) {
        if (e.isBoss) continue;
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.x += Math.cos(a) * 140 * dt;
        e.y += Math.sin(a) * 140 * dt;
      }
    }
    if (p.whirlTick <= 0) {
      p.whirlTick = 0.25;
      for (const e of s.enemiesInRadius(p.x, p.y, r)) s.damage(e, 13 + 3 * (b(p.whirlLv >= 2) + b(p.whirlLv >= 4) + b(p.whirlLv >= 5)), { kbAngle: Math.atan2(e.y - p.y, e.x - p.x), kb: 60, aoe: true });
      sfx('slash');
    }
  }
}
