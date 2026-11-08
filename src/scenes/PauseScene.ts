import Phaser from 'phaser';
import { H, PORTRAIT, W } from '../config';
import { UPGRADES } from '../data/upgrades';
import { loadoutText } from '../game/cards';
import type { Player } from '../game/Player';
import { button, textStyle } from '../ui/widgets';
import { saveSettings, settings } from '../settings';
import { setMusic, toggleMute } from '../sfx';

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
    this.add.text(W / 2, 190, lines.join('\n'), { ...textStyle(PORTRAIT ? 14 : 16, '#c8cde0'), align: 'center', lineSpacing: 8, wordWrap: { width: W - 40, useAdvancedWrap: true } }).setOrigin(0.5, 0);

    const build = Object.entries(p.mods).map(([id, n]) => {
      const u = UPGRADES.find((x) => x.id === id);
      return u ? `${u.name}${n > 1 ? ' ×' + n : ''}` : id;
    });
    this.add.text(W / 2, PORTRAIT ? 340 : 290, '武器与技能', textStyle(18, '#a9a3ff', true)).setOrigin(0.5);
    this.add.text(W / 2, PORTRAIT ? 370 : 318, loadoutText(p.loadout, PORTRAIT ? '\n' : '　'), { ...textStyle(15, '#ffd34a'), align: 'center' }).setOrigin(0.5, 0);
    const py = PORTRAIT ? 490 : 346;
    this.add.text(W / 2, py, `被动 · ${p.hero.passive.name}：${p.hero.passive.desc}`, { ...textStyle(14, '#c8cde0'), align: 'center', wordWrap: { width: W - 60, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    this.add.text(W / 2, py + 44, '属性强化', textStyle(18, '#a9a3ff', true)).setOrigin(0.5);
    this.add.text(W / 2, py + 72, build.length ? build.join('　') : '（还没有属性强化）', {
      ...textStyle(15, '#dfe3f0'), align: 'center', wordWrap: { width: Math.min(800, W - 60), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    // settings toggles
    const toggles: [string, () => boolean, () => void][] = [
      ['音效', () => settings.sound, () => toggleMute()],
      ['音乐', () => settings.music, () => setMusic(!settings.music)],
      ['震屏', () => settings.shake, () => { settings.shake = !settings.shake; saveSettings(); }],
    ];
    const label = (name: string, on: boolean) => `${name}：${on ? '开' : '关'}`;
    toggles.forEach(([name, get, flip], i) => {
      const x = W / 2 + (i - 1) * (PORTRAIT ? 210 : 230);
      const b = button(this, x, H - 240, label(name, get()), () => {
        flip();
        (b.list[1] as Phaser.GameObjects.Text).setText(label(name, get()));
      }, PORTRAIT ? 190 : 200, 0x4a5578);
    });

    button(this, W / 2, H - 160, '继续 (ESC)', () => this.resume());
    button(this, W / 2, H - 100, '放弃本局，回到选英雄', () => {
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
