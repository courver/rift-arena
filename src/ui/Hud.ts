import Phaser from 'phaser';
import { DEBUG, FONT, H, TOTAL_WAVES, W, hex } from '../config';
import type { AbilityKey } from '../data/heroes';
import type { Enemy } from '../game/Enemy';
import type { GameScene } from '../scenes/GameScene';
import { isMuted } from '../sfx';

interface Slot {
  key: AbilityKey;
  box: Phaser.GameObjects.Container;
  shade: Phaser.GameObjects.Rectangle;
  cdText: Phaser.GameObjects.Text;
}

const SLOT = 54;

export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private infoText: Phaser.GameObjects.Text;
  private muteText: Phaser.GameObjects.Text;
  private bossName: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private slots: Slot[] = [];
  private boss: Enemy | null = null;
  private shownHp = 0;

  constructor(private s: GameScene) {
    const st = (size: number, color = '#ffffff') => ({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 3 });
    this.g = s.add.graphics().setDepth(60);
    this.hpText = s.add.text(56, 10, '', st(14)).setDepth(61);
    this.waveText = s.add.text(W / 2, 8, '', st(18)).setOrigin(0.5, 0).setDepth(61);
    this.infoText = s.add.text(W - 50, 10, '', st(14, '#c8cde0')).setOrigin(1, 0).setDepth(61);
    this.muteText = s.add.text(W - 50, H - 30, '', st(13, '#8890a8')).setOrigin(1, 0).setDepth(61);
    this.bossName = s.add.text(W / 2, 44, '', st(14, '#ff8899')).setOrigin(0.5, 0).setDepth(61).setVisible(false);
    if (DEBUG) this.debugText = s.add.text(50, H - 30, '', st(12, '#7bff9e')).setDepth(61);
    s.add.text(50, H - 30, 'ESC 暂停 · M 静音', st(13, '#8890a8')).setDepth(61).setVisible(!DEBUG);
    this.setMuted(isMuted());
    this.shownHp = s.player.hp;

    const hero = s.player.hero;
    const n = hero.abilities.length;
    hero.abilities.forEach((ab, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * (SLOT + 12);
      const y = H - 58;
      const bg = s.add.rectangle(0, 0, SLOT, SLOT, 0x1a1f33, 0.85).setStrokeStyle(2, ab.key === 'R' ? 0xffd34a : hero.color);
      const icon = s.add.text(0, -4, ab.icon, { fontFamily: FONT, fontSize: '24px', color: hex(hero.color) }).setOrigin(0.5);
      const keyLbl = s.add.text(-SLOT / 2 + 4, -SLOT / 2 + 2, ab.key === 'LMB' ? '左键' : ab.key, st(11)).setOrigin(0, 0);
      const name = s.add.text(0, SLOT / 2 - 2, ab.name, st(11, '#dfe3f0')).setOrigin(0.5, 1);
      const shade = s.add.rectangle(0, SLOT / 2, SLOT, SLOT, 0x000000, 0.65).setOrigin(0.5, 1);
      shade.scaleY = 0;
      const cdText = s.add.text(0, -4, '', st(18)).setOrigin(0.5);
      const box = s.add.container(x, y, [bg, icon, name, shade, keyLbl, cdText]).setDepth(61);
      this.slots.push({ key: ab.key, box, shade, cdText });
    });
  }

  setMuted(m: boolean) {
    this.muteText.setText(m ? '🔇 已静音' : '');
  }

  banner(text: string, color = '#ffffff') {
    const t = this.s.add.text(W / 2, H / 2 - 120, text, {
      fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(80).setAlpha(0).setScale(1.4);
    this.s.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.s.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  }

  pulse(key: AbilityKey) {
    const slot = this.slots.find((sl) => sl.key === key);
    if (!slot) return;
    this.s.tweens.add({ targets: slot.box, scale: { from: 1.18, to: 1 }, duration: 180 });
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
    const bw = 280;
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
      g.fillStyle(0xffffff, 0.6).fillRect(W / 2 - w / 2 + w * 0.33, 34, 2, 12).fillRect(W / 2 - w / 2 + w * 0.66, 34, 2, 12);
    }

    for (const sl of this.slots) {
      if (sl.key === 'LMB') continue;
      const rem = p.cd[sl.key];
      const total = p.cdOf(sl.key);
      sl.shade.scaleY = rem > 0 ? rem / total : 0;
      sl.cdText.setText(rem > 0 ? (rem > 1000 ? Math.ceil(rem / 1000) + '' : (rem / 1000).toFixed(1)) : '');
    }

    if (this.debugText) {
      this.debugText.setText(`DEBUG  fps ${Math.round(s.game.loop.actualFps)}  enemies ${s.enemies.length}  bullets ${s.eBullets.length}  [N] 清场  [I] 无敌 ${s.godMode ? 'ON' : 'off'}`);
    }
  }
}
