import Phaser from 'phaser';
import { DEBUG, FONT, H, PORTRAIT, TOTAL_WAVES, TOUCH, W, hex } from '../config';
import type { Slot } from '../data/heroes';
import { BOSS_PHASES } from '../data/enemies';
import { ARENA } from '../config';

const ARENA_TOP = ARENA.y + 10;
import type { Enemy } from '../game/Enemy';
import { defOf } from '../game/cards';
import type { GameScene } from '../scenes/GameScene';
import { isMuted } from '../sfx';

interface SlotView {
  slot: Slot;
  box: Phaser.GameObjects.Container;
  shade: Phaser.GameObjects.Rectangle;
  cdText: Phaser.GameObjects.Text;
}

const SLOT = 58;
const KEY_LABEL: Record<Slot, string> = { weapon: '自动', Q: 'Q', E: 'E', R: 'R' };

export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private infoText: Phaser.GameObjects.Text;
  private muteText: Phaser.GameObjects.Text;
  private autoText: Phaser.GameObjects.Text;
  private bossName: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private slots: SlotView[] = [];
  private boss: Enemy | null = null;
  private shownHp = 0;
  private hintY = 0;

  constructor(private s: GameScene) {
    const st = (size: number, color = '#ffffff') => ({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 3 });
    this.g = s.add.graphics().setDepth(60);
    this.hpText = s.add.text(56, 10, '', st(14)).setDepth(61);
    this.waveText = s.add.text(W / 2, 8, '', st(18)).setOrigin(0.5, 0).setDepth(61);
    this.infoText = s.add.text(W - 50, 10, '', st(14, '#c8cde0')).setOrigin(1, 0).setDepth(61);
    this.muteText = s.add.text(W - 50, H - 30, '', st(13, '#8890a8')).setOrigin(1, 0).setDepth(61);
    this.autoText = s.add.text(W - 160, H - 30, '', st(13, '#8890a8')).setOrigin(1, 0).setDepth(61);
    this.bossName = s.add.text(W / 2, 44, '', st(14, '#ff8899')).setOrigin(0.5, 0).setDepth(61).setVisible(false);
    if (DEBUG) this.debugText = s.add.text(50, H - 30, '', st(12, '#7bff9e')).setDepth(61);
    s.add.text(50, H - 30, 'ESC 暂停 · M 静音', st(13, '#8890a8')).setDepth(61).setVisible(!DEBUG && !TOUCH);
    this.autoText.setVisible(!TOUCH);
    this.setMuted(isMuted());
    this.setAutoFire(s.autoFire);
    this.shownHp = s.player.hp;
    this.refreshLoadout();
  }

  /** Rebuild the four slot icons after a level-up or swap. */
  refreshLoadout() {
    const s = this.s;
    const st = (size: number, color = '#ffffff') => ({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 3 });
    this.slots.forEach((v) => v.box.destroy());
    this.slots = [];
    const order: Slot[] = ['weapon', 'Q', 'E', 'R'];
    order.forEach((slot, i) => {
      const eq = s.player.loadout[slot];
      const def = defOf(slot, eq.id);
      const color = slot === 'weapon' ? (def as { color: number }).color : slot === 'R' ? 0xffd34a : s.player.hero.color;
      // phones: compact row under the HP bar (the right side holds the skill buttons)
      const x = TOUCH ? 74 + i * 50 : W / 2 + (i - 1.5) * (SLOT + 12);
      const y = TOUCH ? 72 : H - 60;
      const bg = s.add.rectangle(0, 0, SLOT, SLOT, 0x1a1f33, 0.85).setStrokeStyle(2, color);
      const icon = s.add.text(0, -6, def.icon, { fontFamily: FONT, fontSize: '24px', color: hex(color) }).setOrigin(0.5);
      const keyLbl = s.add.text(-SLOT / 2 + 4, -SLOT / 2 + 2, KEY_LABEL[slot], st(11)).setOrigin(0, 0);
      const lv = s.add.text(SLOT / 2 - 3, -SLOT / 2 + 2, `Lv${eq.lv}`, st(10, '#ffd34a')).setOrigin(1, 0);
      const name = s.add.text(0, SLOT / 2 - 2, def.name, st(11, '#dfe3f0')).setOrigin(0.5, 1);
      const shade = s.add.rectangle(0, SLOT / 2, SLOT, SLOT, 0x000000, 0.65).setOrigin(0.5, 1);
      shade.scaleY = 0;
      const cdText = s.add.text(0, -6, '', st(18)).setOrigin(0.5);
      const box = s.add.container(x, y, [bg, icon, name, shade, keyLbl, lv, cdText]).setDepth(61).setScale(TOUCH ? 0.75 : 1);
      this.slots.push({ slot, box, shade, cdText });
    });
  }

  setMuted(m: boolean) {
    this.muteText.setText(m ? '🔇 已静音' : '');
  }

  setAutoFire(on: boolean) {
    this.autoText.setText(on ? 'F 自动开火：开' : 'F 自动开火：关（按住左键射击）');
  }

  banner(text: string, color = '#ffffff') {
    const t = this.s.add.text(W / 2, H / 2 - 120, text, {
      fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(80).setAlpha(0).setScale(1.4);
    this.s.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.s.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  }

  /** "New enemy" card on the left, so players learn each type the first time it shows up. */
  hint(name: string, desc: string, color: number) {
    const y = (PORTRAIT ? ARENA_TOP + 10 : TOUCH ? 130 : 70) + this.hintY * 52;
    this.hintY = (this.hintY + 1) % 3;
    const bg = this.s.add.rectangle(0, 0, 330, 46, 0x0b0d16, 0.85).setStrokeStyle(2, color).setOrigin(0, 0.5);
    const t1 = this.s.add.text(10, -11, `新敌人 · ${name}`, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: hex(color) }).setOrigin(0, 0.5);
    const t2 = this.s.add.text(10, 10, desc, { fontFamily: FONT, fontSize: '12px', color: '#dfe3f0' }).setOrigin(0, 0.5);
    const c = this.s.add.container(-340, y, [bg, t1, t2]).setDepth(70);
    this.s.tweens.add({ targets: c, x: 50, duration: 300, ease: 'Cubic.easeOut' });
    this.s.tweens.add({ targets: c, alpha: 0, delay: 4500, duration: 500, onComplete: () => c.destroy() });
  }

  /** First-run tips, one after another near the bottom of the screen. */
  tutorial(touch: boolean) {
    const tips = touch
      ? ['左半屏按住拖动 = 移动', '主武器会自动瞄准最近的敌人开火', '右下按钮：Q 闪避 · E 技能 · R 大招', '每清完一波，三选一升级或更换武器技能']
      : ['WASD 移动，鼠标瞄准', '主武器会自动朝准星开火（F 可切换为按住左键）', 'Q / 空格 闪避 · E 技能 · R 大招', '每清完一波，三选一升级或更换武器技能'];
    tips.forEach((tip, i) => {
      this.s.time.delayedCall(i * 3600, () => {
        const y = touch ? H * 0.62 : H - 150;
        const t = this.s.add.text(W / 2, y, tip, {
          fontFamily: FONT, fontSize: '20px', color: '#ffffff', backgroundColor: '#1a1f33cc', padding: { x: 16, y: 10 },
          stroke: '#000', strokeThickness: 2, align: 'center', wordWrap: { width: W - 80, useAdvancedWrap: true },
        }).setOrigin(0.5).setDepth(75).setAlpha(0);
        this.s.tweens.add({ targets: t, alpha: 1, y: y - 10, duration: 250 });
        this.s.tweens.add({ targets: t, alpha: 0, delay: 3100, duration: 300, onComplete: () => t.destroy() });
      });
    });
  }

  pulse(slot: Slot) {
    const v = this.slots.find((sl) => sl.slot === slot);
    if (!v) return;
    this.s.tweens.add({ targets: v.box, scale: { from: 1.18, to: 1 }, duration: 180 });
  }

  showBoss(e: Enemy) {
    this.boss = e;
    this.bossName.setText(e.def.name).setVisible(true);
  }

  hideBoss() {
    this.boss = null;
    this.bossName.setVisible(false);
  }

  update() {
    const s = this.s;
    const p = s.player;
    const g = this.g;
    g.clear();

    // HP bar with a trailing "recent damage" segment
    this.shownHp += (p.hp - this.shownHp) * 0.08;
    if (this.shownHp < p.hp) this.shownHp = p.hp;
    const bw = PORTRAIT ? 200 : 280;
    g.fillStyle(0x000000, 0.6).fillRect(48, 8, bw + 4, 22);
    g.fillStyle(0xffffff, 0.5).fillRect(50, 10, bw * (this.shownHp / p.stats.maxHp), 18);
    const frac = p.hp / p.stats.maxHp;
    g.fillStyle(frac < 0.3 ? 0xff4040 : 0x4cdb6a).fillRect(50, 10, bw * frac, 18);
    this.hpText.setText(`${Math.ceil(p.hp)} / ${p.stats.maxHp}`).setPosition(56, 10);

    const left = s.enemies.length + s.spawnQueue.length + s.pendingSpawns;
    this.waveText.setText(`第 ${s.wave} / ${TOTAL_WAVES} 波` + (s.boss ? '' : `　剩余 ${left}`));
    const t = Math.floor(s.run.time);
    this.infoText.setText(`${p.hero.name}　击杀 ${s.run.kills}　${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);

    if (this.boss) {
      const e = this.boss;
      const w = 520;
      g.fillStyle(0x000000, 0.7).fillRect(W / 2 - w / 2 - 2, 34, w + 4, 12);
      g.fillStyle(0xff3355).fillRect(W / 2 - w / 2, 36, w * Math.max(0, e.hp / e.maxHp), 8);
      g.fillStyle(0xffffff, 0.6);
      for (const m of BOSS_PHASES[e.type] ?? []) g.fillRect(W / 2 - w / 2 + w * m, 34, 2, 12);
    }

    for (const v of this.slots) {
      if (v.slot === 'weapon') continue;
      const rem = p.cd[v.slot];
      const total = p.cdOf(v.slot);
      v.shade.scaleY = rem > 0 ? Math.min(1, rem / total) : 0;
      v.cdText.setText(rem > 0 ? (rem > 1000 ? Math.ceil(rem / 1000) + '' : (rem / 1000).toFixed(1)) : '');
    }

    if (this.debugText) {
      this.debugText.setText(`DEBUG  fps ${Math.round(s.game.loop.actualFps)}  enemies ${s.enemies.length}  bullets ${s.eBullets.length}  [N] 清场  [I] 无敌 ${s.godMode ? 'ON' : 'off'}`);
    }
  }
}
