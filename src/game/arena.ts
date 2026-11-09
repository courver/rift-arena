import Phaser from 'phaser';
import { ARENA, H, W } from '../config';

/** Each act of the run gets the look of the boss that ends it. */
export type ThemeId = 'lava' | 'void' | 'rift';

export function themeForWave(wave: number): ThemeId {
  return wave <= 5 ? 'lava' : wave <= 8 ? 'void' : 'rift';
}

interface Theme {
  name: string;
  floor: number;
  tile: number;
  edge: number;
  particle: number[];
}

export const THEMES: Record<ThemeId, Theme> = {
  lava: { name: '熔岩洞窟', floor: 0x1b1311, tile: 0x2a1c17, edge: 0xff7a2a, particle: [0xff9a3a, 0xffd070, 0xff5a2a] },
  void: { name: '虚空回廊', floor: 0x0f0d20, tile: 0x1b1736, edge: 0xb06bff, particle: [0xb06bff, 0x7be8ff, 0xd9a8ff] },
  rift: { name: '裂隙王座', floor: 0x170a10, tile: 0x2a1220, edge: 0xff3355, particle: [0xff3355, 0xff8899, 0xffd0d8] },
};

const rnd = Phaser.Math.FloatBetween;
const AX0 = ARENA.x;
const AY0 = ARENA.y;
const AX1 = ARENA.x + ARENA.w;
const AY1 = ARENA.y + ARENA.h;

/** Random point near the arena border, where decorations don't hide the fight. */
function edgePoint(inset = 50) {
  const side = Phaser.Math.Between(0, 3);
  const t = Math.random();
  if (side === 0) return { x: AX0 + inset * rnd(0.3, 1), y: AY0 + t * ARENA.h };
  if (side === 1) return { x: AX1 - inset * rnd(0.3, 1), y: AY0 + t * ARENA.h };
  if (side === 2) return { x: AX0 + t * ARENA.w, y: AY0 + inset * rnd(0.3, 1) };
  return { x: AX0 + t * ARENA.w, y: AY1 - inset * rnd(0.3, 1) };
}

/** Background layers for the arena: floor, decorations, ambient particles, boss vignette. */
export class Arena {
  current: ThemeId | null = null;
  private layer: Phaser.GameObjects.Container | null = null;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private vignette: Phaser.GameObjects.Image;
  private vignetteTween: Phaser.Tweens.Tween | null = null;

  constructor(private s: Phaser.Scene) {
    s.add.rectangle(W / 2, H / 2, W, H, 0x0b0d16).setDepth(-2);
    if (!s.textures.exists('vignette')) {
      const tex = s.textures.createCanvas('vignette', 256, 256)!;
      const c = tex.context;
      const g = c.createRadialGradient(128, 128, 60, 128, 128, 182);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      tex.refresh();
    }
    this.vignette = s.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setDepth(2).setAlpha(0);
  }

  set(id: ThemeId, animate: boolean) {
    if (id === this.current) return;
    this.current = id;
    const old = this.layer;
    const oldEm = this.emitter;
    this.layer = this.build(id).setAlpha(animate ? 0 : 1);
    this.emitter = this.ambient(id);
    if (animate) {
      this.s.tweens.add({ targets: this.layer, alpha: 1, duration: 1200 });
      if (old) this.s.tweens.add({ targets: old, alpha: 0, duration: 1200, onComplete: () => old.destroy() });
    } else old?.destroy();
    if (oldEm) {
      oldEm.stop();
      this.s.time.delayedCall(4000, () => oldEm.destroy());
    }
    this.vignette.setTint(THEMES[id].edge);
  }

  /** Pulsing coloured vignette while a boss is alive. */
  setBoss(on: boolean) {
    this.vignetteTween?.stop();
    this.vignetteTween = null;
    if (on) {
      this.vignette.setAlpha(0.15);
      this.vignetteTween = this.s.tweens.add({ targets: this.vignette, alpha: 0.4, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.s.tweens.add({ targets: this.vignette, alpha: 0, duration: 800 });
    }
  }

  private ambient(id: ThemeId) {
    const t = THEMES[id];
    const common = { tint: t.particle, emitting: true, blendMode: Phaser.BlendModes.ADD };
    const cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
      id === 'lava'
        ? { ...common, x: { min: AX0, max: AX1 }, y: { min: AY0 + ARENA.h * 0.3, max: AY1 }, speedY: { min: -60, max: -20 }, speedX: { min: -10, max: 10 }, lifespan: 3000, scale: { start: 0.6, end: 0 }, alpha: { start: 0.8, end: 0 }, frequency: 90 }
        : id === 'void'
          ? { ...common, x: { min: AX0, max: AX1 }, y: { min: AY0, max: AY1 }, speed: { min: 5, max: 20 }, lifespan: 5000, scale: { start: 0.1, end: 0.55 }, alpha: { start: 0, end: 0.7 }, frequency: 120 }
          : { ...common, x: { min: AX0, max: AX1 }, y: { min: AY0, max: AY0 + ARENA.h * 0.6 }, speedY: { min: 15, max: 45 }, speedX: { min: -15, max: 15 }, lifespan: 3500, scale: { start: 0.5, end: 0 }, alpha: { start: 0.7, end: 0 }, frequency: 100 };
    return this.s.add.particles(0, 0, 'dot', cfg).setDepth(1.5);
  }

  private build(id: ThemeId) {
    const s = this.s;
    const t = THEMES[id];
    const items: Phaser.GameObjects.GameObject[] = [];
    const floor = s.add.graphics();
    items.push(floor);
    floor.fillStyle(t.floor).fillRect(AX0, AY0, ARENA.w, ARENA.h);

    if (id === 'lava') {
      // irregular flagstones with dark seams
      for (let y = AY0; y < AY1; y += 64) {
        const off = ((y - AY0) / 64) % 2 ? 32 : 0;
        for (let x = AX0 - off; x < AX1; x += 64) {
          const x0 = Math.max(AX0, x + 3);
          const x1 = Math.min(AX1, x + 61);
          if (x1 - x0 < 8) continue;
          floor.fillStyle(t.tile, rnd(0.6, 1)).fillRoundedRect(x0, y + 3, x1 - x0, Math.min(58, AY1 - y - 3), 6);
        }
      }
      // glowing magma cracks
      for (let i = 0; i < 9; i++) {
        let x = rnd(AX0 + 40, AX1 - 40);
        let y = rnd(AY0 + 40, AY1 - 40);
        const pts = [x, y];
        let a = rnd(0, Math.PI * 2);
        for (let k = 0; k < 5; k++) {
          a += rnd(-0.7, 0.7);
          x = Phaser.Math.Clamp(x + Math.cos(a) * rnd(25, 50), AX0, AX1);
          y = Phaser.Math.Clamp(y + Math.sin(a) * rnd(25, 50), AY0, AY1);
          pts.push(x, y);
        }
        for (const [w, c, al] of [[7, 0xff5a1a, 0.18], [2.5, 0xffb050, 0.55]] as const) {
          floor.lineStyle(w, c, al).beginPath().moveTo(pts[0], pts[1]);
          for (let k = 2; k < pts.length; k += 2) floor.lineTo(pts[k], pts[k + 1]);
          floor.strokePath();
        }
      }
      // lava pools near the walls, gently pulsing
      for (let i = 0; i < 5; i++) {
        const p = edgePoint(70);
        const pool = s.add.graphics();
        const rx = rnd(40, 80);
        const ry = rx * rnd(0.45, 0.65);
        pool.fillStyle(0xff4a10, 0.22).fillEllipse(p.x, p.y, rx * 2.4, ry * 2.4);
        pool.fillStyle(0xff7a2a, 0.45).fillEllipse(p.x, p.y, rx * 1.6, ry * 1.6);
        pool.fillStyle(0xffd070, 0.5).fillEllipse(p.x, p.y, rx * 0.8, ry * 0.8);
        s.tweens.add({ targets: pool, alpha: { from: 0.65, to: 1 }, duration: rnd(900, 1600), yoyo: true, repeat: -1 });
        items.push(pool);
      }
      // boulders
      for (let i = 0; i < 10; i++) {
        const p = edgePoint(40);
        const r = rnd(10, 22);
        const pts: Phaser.Math.Vector2[] = [];
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          pts.push(new Phaser.Math.Vector2(p.x + Math.cos(a) * r * rnd(0.7, 1.1), p.y + Math.sin(a) * r * rnd(0.6, 0.9)));
        }
        floor.fillStyle(0x3a2c26).fillPoints(pts, true);
        floor.lineStyle(2, 0x0b0d16, 0.8).strokePoints(pts, true);
        floor.fillStyle(0xffffff, 0.06).fillCircle(p.x - r * 0.3, p.y - r * 0.3, r * 0.35);
      }
    } else if (id === 'void') {
      // nebula and star field
      for (let i = 0; i < 7; i++) {
        floor.fillStyle(Phaser.Utils.Array.GetRandom([0x5a2a9a, 0x2a3a8a, 0x6a1a6a]), 0.12).fillCircle(rnd(AX0, AX1), rnd(AY0, AY1), rnd(90, 200));
      }
      for (let i = 0; i < 220; i++) {
        floor.fillStyle(0xffffff, rnd(0.15, 0.8)).fillCircle(rnd(AX0, AX1), rnd(AY0, AY1), rnd(0.6, 1.8));
      }
      floor.lineStyle(1, t.tile, 0.9);
      for (let x = AX0; x <= AX1; x += 80) floor.lineBetween(x, AY0, x, AY1);
      for (let y = AY0; y <= AY1; y += 80) floor.lineBetween(AX0, y, AX1, y);
      // slowly turning rune circle in the middle
      const rune = s.add.graphics({ x: W / 2, y: AY0 + ARENA.h / 2 });
      const R = Math.min(ARENA.w, ARENA.h) * 0.32;
      rune.lineStyle(2, t.edge, 0.35).strokeCircle(0, 0, R).strokeCircle(0, 0, R * 0.82);
      const star: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 6; k++) star.push(new Phaser.Math.Vector2(Math.cos((k * 2 * Math.PI * 2) / 6) * R * 0.8, Math.sin((k * 2 * Math.PI * 2) / 6) * R * 0.8));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        rune.lineStyle(2, t.edge, 0.3).lineBetween(Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82, Math.cos(a + Math.PI * 2 / 3) * R * 0.82, Math.sin(a + Math.PI * 2 / 3) * R * 0.82);
        rune.fillStyle(0xd9a8ff, 0.5).fillCircle(Math.cos(a) * R, Math.sin(a) * R, 4);
      }
      s.tweens.add({ targets: rune, rotation: Math.PI * 2, duration: 60000, repeat: -1 });
      items.push(rune);
      // floating crystals at the edges
      for (let i = 0; i < 9; i++) {
        const p = edgePoint(45);
        const c = s.add.graphics({ x: p.x, y: p.y });
        const h = rnd(16, 30);
        c.fillStyle(0x7a4ad8, 0.85).fillPoints([new Phaser.Math.Vector2(0, -h), new Phaser.Math.Vector2(h * 0.35, 0), new Phaser.Math.Vector2(0, h * 0.6), new Phaser.Math.Vector2(-h * 0.35, 0)], true);
        c.fillStyle(0xd9a8ff, 0.7).fillPoints([new Phaser.Math.Vector2(0, -h), new Phaser.Math.Vector2(h * 0.35, 0), new Phaser.Math.Vector2(0, 0)], true);
        c.fillStyle(0x000000, 0.3).fillEllipse(0, h + 8, h * 0.8, 6);
        s.tweens.add({ targets: c, y: p.y - 6, duration: rnd(1400, 2200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        items.push(c);
      }
    } else {
      // dark hex-like plates
      for (let y = AY0; y < AY1; y += 56) {
        for (let x = AX0 + (((y - AY0) / 56) % 2 ? 28 : 0); x < AX1; x += 56) {
          floor.lineStyle(1, t.tile, 0.9).strokeCircle(x, y, 27);
        }
      }
      // rift tears radiating from the throne (center), pulsing
      const tears = s.add.graphics();
      const cx = W / 2;
      const cy = AY0 + ARENA.h / 2;
      for (let i = 0; i < 7; i++) {
        let a = (i / 7) * Math.PI * 2 + rnd(-0.2, 0.2);
        let x = cx + Math.cos(a) * 60;
        let y = cy + Math.sin(a) * 60;
        const pts = [x, y];
        for (let k = 0; k < 6; k++) {
          a += rnd(-0.35, 0.35);
          x = Phaser.Math.Clamp(x + Math.cos(a) * rnd(35, 60), AX0, AX1);
          y = Phaser.Math.Clamp(y + Math.sin(a) * rnd(35, 60), AY0, AY1);
          pts.push(x, y);
        }
        for (const [w, c, al] of [[10, 0xff1a40, 0.16], [4, 0xff3355, 0.5], [1.5, 0xffd0d8, 0.9]] as const) {
          tears.lineStyle(w, c, al).beginPath().moveTo(pts[0], pts[1]);
          for (let k = 2; k < pts.length; k += 2) tears.lineTo(pts[k], pts[k + 1]);
          tears.strokePath();
        }
      }
      tears.fillStyle(0xff3355, 0.12).fillCircle(cx, cy, 70);
      s.tweens.add({ targets: tears, alpha: { from: 0.55, to: 1 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      items.push(tears);
      // bone spikes along the walls
      for (let i = 0; i < 16; i++) {
        const p = edgePoint(30);
        const h = rnd(14, 26);
        floor.fillStyle(0xe8d8c8, 0.75).fillTriangle(p.x - h * 0.25, p.y + h * 0.3, p.x + h * 0.25, p.y + h * 0.3, p.x + rnd(-3, 3), p.y - h);
        floor.fillStyle(0x000000, 0.35).fillEllipse(p.x, p.y + h * 0.35, h * 0.7, 5);
      }
    }

    // glowing border in the act's colour
    const edge = s.add.graphics();
    edge.lineStyle(8, t.edge, 0.15).strokeRect(AX0, AY0, ARENA.w, ARENA.h);
    edge.lineStyle(3, t.edge, 0.85).strokeRect(AX0, AY0, ARENA.w, ARENA.h);
    const layer = s.add.container(0, 0, items).setDepth(0);
    // keep pools and props inside the arena; the border is drawn on top, unclipped
    const clip = s.make.graphics({}, false).fillStyle(0xffffff).fillRect(AX0, AY0, ARENA.w, ARENA.h);
    layer.setMask(clip.createGeometryMask());
    const frame = s.add.container(0, 0, [layer, edge]).setDepth(0);
    return frame;
  }
}
