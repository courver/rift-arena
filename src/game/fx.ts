import Phaser from 'phaser';
import { FONT } from '../config';

/** Visual feedback helpers bound to one scene. */
export class Fx {
  private emitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private scene: Phaser.Scene) {}

  burst(x: number, y: number, color: number, count = 10, speed = 180) {
    let em = this.emitters.get(color);
    if (!em) {
      em = this.scene.add.particles(0, 0, 'dot', {
        speed: { min: 40, max: speed },
        lifespan: { min: 250, max: 500 },
        scale: { start: 1, end: 0 },
        tint: color,
        emitting: false,
      }).setDepth(8);
      this.emitters.set(color, em);
    }
    em.explode(count, x, y);
  }

  number(x: number, y: number, amount: number, crit: boolean, color = '#ffffff') {
    const t = this.scene.add.text(x + Phaser.Math.Between(-8, 8), y - 10, String(Math.round(amount)), {
      fontFamily: FONT,
      fontSize: crit ? '22px' : '15px',
      fontStyle: 'bold',
      color: crit ? '#ffd84a' : color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.scene.tweens.add({
      targets: t,
      y: y - (crit ? 50 : 36),
      alpha: { from: 1, to: 0 },
      scale: crit ? { from: 1.4, to: 1 } : 1,
      duration: crit ? 700 : 500,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  text(x: number, y: number, s: string, color = '#7bff9e') {
    const t = this.scene.add.text(x, y - 20, s, {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.scene.tweens.add({ targets: t, y: y - 55, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  /** Expanding ring, used for novas, impacts and shockwaves. */
  ring(x: number, y: number, radius: number, color: number, duration = 300, fill = 0.25) {
    const c = this.scene.add.circle(x, y, radius, color, fill).setStrokeStyle(4, color, 0.9).setDepth(7);
    c.setScale(0.2);
    this.scene.tweens.add({
      targets: c,
      scale: 1,
      alpha: { from: 1, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => c.destroy(),
    });
  }

  slash(x: number, y: number, angle: number, range: number, half: number, color: number) {
    const g = this.scene.add.graphics().setDepth(9);
    g.fillStyle(color, 0.35);
    g.slice(x, y, range, angle - half, angle + half, false).fillPath();
    g.lineStyle(4, 0xffffff, 0.9);
    g.beginPath().arc(x, y, range, angle - half, angle + half).strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  /** Jagged bolt through a list of points. */
  lightning(pts: { x: number; y: number }[], color: number) {
    const g = this.scene.add.graphics().setDepth(9);
    for (const [w, c, a] of [[6, color, 0.5], [2, 0xffffff, 1]] as const) {
      g.lineStyle(w, c, a).beginPath().moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        for (let k = 1; k <= 4; k++) {
          const t = k / 4;
          const j = k < 4 ? 10 : 0;
          g.lineTo(p0.x + (p1.x - p0.x) * t + Phaser.Math.Between(-j, j), p0.y + (p1.y - p0.y) * t + Phaser.Math.Between(-j, j));
        }
      }
      g.strokePath();
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  /** Bright blade streak along a dash path. */
  streak(x0: number, y0: number, x1: number, y1: number, color: number, width = 14) {
    const g = this.scene.add.graphics().setDepth(9);
    g.lineStyle(width, color, 0.35).lineBetween(x0, y0, x1, y1);
    g.lineStyle(Math.max(3, width * 0.3), 0xffffff, 0.95).lineBetween(x0, y0, x1, y1);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  /** Line between two points that fades, e.g. a priest's heal. */
  beam(x0: number, y0: number, x1: number, y1: number, color: number) {
    const g = this.scene.add.graphics().setDepth(4);
    g.lineStyle(3, color, 0.8).lineBetween(x0, y0, x1, y1);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
  }

  /** Ghost of a sprite left behind by dashes. */
  afterimage(src: Phaser.GameObjects.Image, color: number) {
    const a = this.scene.add.image(src.x, src.y, src.texture.key).setRotation(src.rotation).setFlipX(src.flipX)
      .setScale(src.scaleX, src.scaleY).setTintFill(color).setAlpha(0.5).setDepth(9);
    this.scene.tweens.add({ targets: a, alpha: 0, scaleX: src.scaleX * 1.3, scaleY: src.scaleY * 1.3, duration: 300, onComplete: () => a.destroy() });
  }

  /** Pulsing danger circle; resolves after `ms`. */
  telegraphCircle(x: number, y: number, r: number, ms: number, color = 0xff3355) {
    const c = this.scene.add.circle(x, y, r, color, 0.15).setStrokeStyle(2, color, 0.8).setDepth(3);
    const inner = this.scene.add.circle(x, y, r, color, 0.3).setDepth(3).setScale(0);
    this.scene.tweens.add({ targets: inner, scale: 1, duration: ms, onComplete: () => { c.destroy(); inner.destroy(); } });
  }

  telegraphLine(x: number, y: number, angle: number, len: number, width: number, ms: number) {
    const g = this.scene.add.graphics().setDepth(3);
    g.fillStyle(0xff3355, 0.25);
    g.translateCanvas(x, y);
    g.rotateCanvas(angle);
    g.fillRect(0, -width / 2, len, width);
    this.scene.tweens.add({ targets: g, alpha: { from: 0.4, to: 1 }, yoyo: true, repeat: -1, duration: 120 });
    this.scene.time.delayedCall(ms, () => g.destroy());
  }
}
