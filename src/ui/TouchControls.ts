import Phaser from 'phaser';
import { FONT, H, PORTRAIT, W, hex } from '../config';
import type { SkillSlot } from '../data/heroes';
import type { GameScene } from '../scenes/GameScene';
import { SKILLS } from '../game/skills';

interface Btn {
  slot: SkillSlot;
  x: number;
  y: number;
  r: number;
  icon: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Arc;
}

const STICK_R = 70;

/**
 * Phone controls: a floating joystick on the left half of the screen,
 * skill buttons on the right. Aiming is automatic (nearest enemy).
 */
export class TouchControls {
  move: { x: number; y: number } | null = null;
  private stickId = -1;
  private ox = 0;
  private oy = 0;
  private g: Phaser.GameObjects.Graphics;
  private btns: Btn[] = [];

  constructor(private s: GameScene) {
    this.g = s.add.graphics().setDepth(85);
    const layout: [SkillSlot, number, number, number][] = [
      ['Q', W - 95, H - 95, 54],
      ['E', W - 225, H - 75, 44],
      ['R', W - 120, H - 225, 44],
    ];
    for (const [slot, x, y, r] of layout) {
      const zone = s.add.circle(x, y, r + 10, 0xffffff, 0.001).setDepth(86).setInteractive();
      zone.on('pointerdown', () => s.tryCast(slot));
      const icon = s.add.text(x, y, '', { fontFamily: FONT, fontSize: `${Math.round(r * 0.75)}px`, color: '#ffffff' }).setOrigin(0.5).setDepth(87);
      this.btns.push({ slot, x, y, r, icon, zone });
    }
    const pause = s.add.circle(W - 40, 76, 24, 0x000000, 0.35).setStrokeStyle(2, 0xffffff, 0.5).setDepth(86).setInteractive();
    s.add.text(W - 40, 76, 'Ⅱ', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(87);
    pause.on('pointerdown', () => s.openPause());

    s.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.stickId !== -1 || p.x > W * (PORTRAIT ? 0.6 : 0.5) || p.y < 100) return;
      this.stickId = p.id;
      this.ox = p.x;
      this.oy = p.y;
      this.move = null;
    });
    s.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickId) return;
      let dx = p.x - this.ox;
      let dy = p.y - this.oy;
      const d = Math.hypot(dx, dy);
      // the base follows the thumb if it drags too far, so direction changes stay responsive
      if (d > STICK_R) {
        this.ox += (dx / d) * (d - STICK_R);
        this.oy += (dy / d) * (d - STICK_R);
        dx = p.x - this.ox;
        dy = p.y - this.oy;
      }
      const len = Math.max(1, Math.hypot(dx, dy));
      this.move = d > 10 ? { x: dx / len, y: dy / len } : null;
    });
    const end = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickId) return;
      this.stickId = -1;
      this.move = null;
    };
    s.input.on('pointerup', end);
    s.input.on('pointerupoutside', end);
  }

  /** Reset when the scene pauses so a lifted finger isn't missed. */
  release() {
    this.stickId = -1;
    this.move = null;
  }

  update() {
    const g = this.g;
    const p = this.s.player;
    g.clear();
    if (this.stickId !== -1) {
      const ptr = this.s.input.manager.pointers.find((q) => q.id === this.stickId);
      g.fillStyle(0xffffff, 0.08).fillCircle(this.ox, this.oy, STICK_R);
      g.lineStyle(3, 0xffffff, 0.35).strokeCircle(this.ox, this.oy, STICK_R);
      if (ptr) {
        const dx = ptr.x - this.ox;
        const dy = ptr.y - this.oy;
        const d = Math.min(STICK_R, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        g.fillStyle(0xffffff, 0.45).fillCircle(this.ox + Math.cos(a) * d, this.oy + Math.sin(a) * d, 28);
      }
    } else {
      g.lineStyle(2, 0xffffff, 0.12).strokeCircle(PORTRAIT ? 150 : 170, H - (PORTRAIT ? 190 : 150), STICK_R);
    }
    for (const b of this.btns) {
      const eq = p.loadout[b.slot];
      const def = SKILLS[eq.id];
      const color = b.slot === 'R' ? 0xffd34a : p.hero.color;
      const rem = p.charges[b.slot] <= 0 ? p.cd[b.slot] : 0;
      const max = p.maxCharges(b.slot);
      g.fillStyle(0x0b0d16, 0.55).fillCircle(b.x, b.y, b.r);
      g.lineStyle(3, color, rem > 0 ? 0.35 : 0.95).strokeCircle(b.x, b.y, b.r);
      if (rem > 0) {
        const frac = Math.min(1, rem / p.cdOf(b.slot));
        g.fillStyle(0x000000, 0.55).slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false).fillPath();
      }
      if (max > 1) {
        for (let i = 0; i < max; i++) {
          g.fillStyle(i < p.charges[b.slot] ? 0x7be8ff : 0x2a3150, 1).fillCircle(b.x - (max - 1) * 7 + i * 14, b.y + b.r + 10, 4);
        }
      }
      b.icon.setText(rem > 0 ? (rem > 1000 ? String(Math.ceil(rem / 1000)) : (rem / 1000).toFixed(1)) : def.icon)
        .setColor(rem > 0 ? '#c8cde0' : hex(color));
    }
  }
}
