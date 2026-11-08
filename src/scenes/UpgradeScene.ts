import Phaser from 'phaser';
import { BOT, H, RARITY_COLOR, RARITY_NAME, SPEED, TOTAL_WAVES, W, hex } from '../config';
import { HEROES } from '../data/heroes';
import type { Upgrade } from '../data/upgrades';
import { sfx } from '../sfx';
import { button, textStyle } from '../ui/widgets';

interface UpgradeData {
  wave: number;
  choices: Upgrade[];
  rerolls: number;
  reroll: () => Upgrade[];
  onPick: (u: Upgrade) => void;
}

export class UpgradeScene extends Phaser.Scene {
  private data_!: UpgradeData;
  private cards: Phaser.GameObjects.Container[] = [];
  private rerollBtn?: Phaser.GameObjects.Container;
  private picked = false;

  constructor() {
    super('Upgrade');
  }

  create(data: UpgradeData) {
    this.data_ = data;
    this.picked = false;
    this.cards = [];
    this.add.rectangle(W / 2, H / 2, W, H, 0x05060c, 0.72);
    this.add.text(W / 2, 120, `第 ${data.wave} 波完成`, textStyle(36, '#7bff9e', true)).setOrigin(0.5);
    this.add.text(W / 2, 166, `选择一项强化（已回复 20% 生命）· 下一波：${data.wave + 1} / ${TOTAL_WAVES}`, textStyle(16, '#c8cde0')).setOrigin(0.5);
    this.showCards(data.choices);
    this.makeRerollButton();

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.choose(0));
    kb.on('keydown-TWO', () => this.choose(1));
    kb.on('keydown-THREE', () => this.choose(2));
    if (BOT) this.time.delayedCall(400 / SPEED, () => this.choose(Phaser.Math.Between(0, data.choices.length - 1)));
  }

  private makeRerollButton() {
    this.rerollBtn?.destroy();
    if (this.data_.rerolls <= 0) return;
    this.rerollBtn = button(this, W / 2, H - 110, `重随（剩 ${this.data_.rerolls} 次）`, () => {
      this.data_.rerolls--;
      this.data_.choices = this.data_.reroll();
      sfx('spawn');
      this.showCards(this.data_.choices);
      this.makeRerollButton();
    }, 220, 0x8890a8);
  }

  private showCards(choices: Upgrade[]) {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    const cw = 300;
    const ch = 260;
    choices.forEach((u, i) => {
      const x = W / 2 + (i - (choices.length - 1) / 2) * (cw + 36);
      const y = H / 2 + 20;
      const col = RARITY_COLOR[u.rarity];
      const bg = this.add.rectangle(0, 0, cw, ch, 0x151a2c, 0.97).setStrokeStyle(3, col);
      const band = this.add.rectangle(0, -ch / 2 + 18, cw, 36, col, 0.25);
      const rarity = this.add.text(-cw / 2 + 14, -ch / 2 + 8, RARITY_NAME[u.rarity], textStyle(14, hex(col), true));
      const tag = u.hero ? `${HEROES[u.hero].name} 专属` : '通用';
      const tagT = this.add.text(cw / 2 - 14, -ch / 2 + 8, tag, textStyle(14, u.hero ? hex(HEROES[u.hero].color) : '#9aa4b8')).setOrigin(1, 0);
      const name = this.add.text(0, -30, u.name, textStyle(30, '#ffffff', true)).setOrigin(0.5);
      const desc = this.add.text(0, 30, u.desc, { ...textStyle(16, '#dfe3f0'), align: 'center', wordWrap: { width: cw - 40, useAdvancedWrap: true } }).setOrigin(0.5, 0);
      const key = this.add.text(0, ch / 2 - 18, `[${i + 1}]`, textStyle(14, '#8890a8')).setOrigin(0.5);
      const c = this.add.container(x, y, [bg, band, rarity, tagT, name, desc, key]).setSize(cw, ch).setInteractive({ useHandCursor: true });
      c.setAlpha(0).setY(y + 40);
      this.tweens.add({ targets: c, alpha: 1, y, delay: i * 80, duration: 260, ease: 'Back.easeOut' });
      c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
      c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
      c.on('pointerup', () => this.choose(i));
      this.cards.push(c);
    });
  }

  private choose(i: number) {
    const u = this.data_.choices[i];
    if (!u || this.picked) return;
    this.picked = true;
    sfx('pick');
    const card = this.cards[i];
    this.tweens.add({
      targets: card, scale: 1.15, duration: 160, yoyo: true,
      onComplete: () => {
        this.scene.stop();
        this.data_.onPick(u);
      },
    });
  }
}
