import Phaser from 'phaser';
import { BOT, H, RARITY_COLOR, RARITY_NAME, SPEED, TOTAL_WAVES, W, hex } from '../config';
import { Card, describe } from '../game/cards';
import type { Player } from '../game/Player';
import { sfx } from '../sfx';
import { button, textStyle } from '../ui/widgets';

interface UpgradeData {
  wave: number;
  player: Player;
  cards: Card[];
  rerolls: number;
  bonus?: boolean;
  reroll: () => Card[];
  onPick: (c: Card) => void;
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
    this.add.text(W / 2, 100, data.bonus ? `首领击破 · 额外强化` : `第 ${data.wave} 波完成`, textStyle(36, data.bonus ? '#ffd34a' : '#7bff9e', true)).setOrigin(0.5);
    this.add.text(W / 2, 146, `选择一项强化（已回复 20% 生命）· 下一波：${data.wave + 1} / ${TOTAL_WAVES}`, textStyle(16, '#c8cde0')).setOrigin(0.5);
    this.add.text(W / 2, 172, '蓝色 = 升级当前武器 / 技能　紫色 = 更换（保留等级 -1）　灰色 = 属性', textStyle(13, '#8890a8')).setOrigin(0.5);
    this.showCards(data.cards);
    this.makeRerollButton();

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.choose(0));
    kb.on('keydown-TWO', () => this.choose(1));
    kb.on('keydown-THREE', () => this.choose(2));
    if (BOT) this.time.delayedCall(400 / SPEED, () => this.choose(this.botPick()));
  }

  private makeRerollButton() {
    this.rerollBtn?.destroy();
    if (this.data_.rerolls <= 0) return;
    this.rerollBtn = button(this, W / 2, H - 100, `重随（剩 ${this.data_.rerolls} 次）`, () => {
      this.data_.rerolls--;
      this.data_.cards = this.data_.reroll();
      sfx('spawn');
      this.showCards(this.data_.cards);
      this.makeRerollButton();
    }, 220, 0x8890a8);
  }

  private showCards(cards: Card[]) {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    const cw = 300;
    const ch = 270;
    cards.forEach((card, i) => {
      const v = describe(card, this.data_.player);
      const x = W / 2 + (i - (cards.length - 1) / 2) * (cw + 36);
      const y = H / 2 + 30;
      const col = RARITY_COLOR[v.rarity];
      const bg = this.add.rectangle(0, 0, cw, ch, 0x151a2c, 0.97).setStrokeStyle(3, col);
      const band = this.add.rectangle(0, -ch / 2 + 18, cw, 36, col, 0.25);
      const tag = this.add.text(-cw / 2 + 14, -ch / 2 + 8, v.tag, textStyle(14, hex(col), true));
      const rar = this.add.text(cw / 2 - 14, -ch / 2 + 8, card.kind === 'stat' ? RARITY_NAME[v.rarity] : '', textStyle(13, '#9aa4b8')).setOrigin(1, 0);
      const icon = this.add.text(0, -62, v.icon, { fontFamily: 'sans-serif', fontSize: '34px', color: hex(col) }).setOrigin(0.5);
      const name = this.add.text(0, -20, v.title, textStyle(26, '#ffffff', true)).setOrigin(0.5);
      const desc = this.add.text(0, 18, v.desc, { ...textStyle(15, '#dfe3f0'), align: 'center', lineSpacing: 6, wordWrap: { width: cw - 36, useAdvancedWrap: true } }).setOrigin(0.5, 0);
      const key = this.add.text(0, ch / 2 - 18, `[${i + 1}]`, textStyle(14, '#8890a8')).setOrigin(0.5);
      const c = this.add.container(x, y, [bg, band, tag, rar, icon, name, desc, key]).setSize(cw, ch).setInteractive({ useHandCursor: true });
      c.setAlpha(0).setY(y + 40);
      this.tweens.add({ targets: c, alpha: 1, y, delay: i * 80, duration: 260, ease: 'Back.easeOut' });
      c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
      c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
      c.on('pointerup', () => this.choose(i));
      this.cards.push(c);
    });
  }

  /** Bot prefers levelling what it has, sometimes tries a swap, like a typical player. */
  private botPick() {
    const w = this.data_.cards.map((c) => (c.kind === 'level' ? 5 : c.kind === 'stat' ? 3 : 1.5));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < w.length - 1 && r > w[i]) r -= w[i++];
    return i;
  }

  private choose(i: number) {
    const card = this.data_.cards[i];
    if (!card || this.picked) return;
    this.picked = true;
    sfx('pick');
    this.tweens.add({
      targets: this.cards[i], scale: 1.15, duration: 160, yoyo: true,
      onComplete: () => {
        this.scene.stop();
        this.data_.onPick(card);
      },
    });
  }
}
