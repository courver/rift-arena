import Phaser from 'phaser';
import { H, W } from '../config';
import { UPGRADES } from '../data/upgrades';
import type { Player } from '../game/Player';
import { button, textStyle } from '../ui/widgets';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(data: { player: Player }) {
    const p = data.player;
    this.add.rectangle(W / 2, H / 2, W, H, 0x05060c, 0.75);
    this.add.text(W / 2, 110, '暂停', textStyle(40, '#ffffff', true)).setOrigin(0.5);

    const s = p.stats;
    const lines = [
      `伤害 ×${s.dmgMult.toFixed(2)}　攻速 ×${s.atkRateMult.toFixed(2)}　移速 ${Math.round(s.moveSpeed)}`,
      `暴击 ${Math.round(s.critChance * 100)}% ×${s.critMult.toFixed(1)}　吸血 ${Math.round(s.lifesteal * 100)}%　冷却缩减 ${Math.round(Math.min(0.5, s.cdr) * 100)}%`,
      `范围 ×${s.areaMult.toFixed(2)}　减伤 ${Math.round(s.armor * 100)}%　回复 ${s.regen}/秒`,
    ];
    this.add.text(W / 2, 190, lines.join('\n'), { ...textStyle(16, '#c8cde0'), align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0);

    const build = Object.entries(p.mods).map(([id, n]) => {
      const u = UPGRADES.find((x) => x.id === id);
      return u ? `${u.name}${n > 1 ? ' ×' + n : ''}` : id;
    });
    this.add.text(W / 2, 300, '当前构筑', textStyle(18, '#a9a3ff', true)).setOrigin(0.5);
    this.add.text(W / 2, 330, build.length ? build.join('　') : '（还没有强化）', {
      ...textStyle(15, '#dfe3f0'), align: 'center', wordWrap: { width: 800, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    button(this, W / 2, H - 200, '继续 (ESC)', () => this.resume());
    button(this, W / 2, H - 140, '放弃本局，回到选英雄', () => {
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, 300, 0x8890a8);
    this.input.keyboard?.on('keydown-ESC', () => this.resume());
    this.input.keyboard?.on('keydown-P', () => this.resume());
  }

  private resume() {
    this.scene.stop();
    this.scene.resume('Game');
  }
}
