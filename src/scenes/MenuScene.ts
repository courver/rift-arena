import Phaser from 'phaser';
import { BOT, FONT, H, W, hex } from '../config';
import { HEROES, HeroDef, Slot } from '../data/heroes';
import { defOf } from '../game/cards';
import { sfx, unlockAudio } from '../sfx';
import { textStyle } from '../ui/widgets';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  private picked = false;

  create() {
    this.picked = false;
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0d16);
    // drifting background sparks
    this.add.particles(0, 0, 'dot', {
      x: { min: 0, max: W }, y: H + 10, speedY: { min: -60, max: -20 }, lifespan: 9000,
      scale: { min: 0.2, max: 0.6 }, alpha: { start: 0.6, end: 0 }, tint: [0x6a4cff, 0x5ee0ff, 0xff6a4a], frequency: 120,
    });

    const title = this.add.text(W / 2, 92, '裂隙竞技场', textStyle(64, '#ffffff', true)).setOrigin(0.5);
    title.setShadow(0, 0, '#6a4cff', 18, true, true);
    this.add.text(W / 2, 150, 'RIFT ARENA · 英雄肉鸽竞技场', textStyle(18, '#a9a3ff')).setOrigin(0.5);
    this.add.text(W / 2, 186, '选择你的英雄，撑过 10 波，击败裂隙之主', textStyle(16, '#c8cde0')).setOrigin(0.5);

    this.heroCard(W / 2 - 250, 390, HEROES.lumen);
    this.heroCard(W / 2 + 250, 390, HEROES.kael);

    this.add.text(W / 2, H - 70, 'WASD 移动　鼠标瞄准（主武器自动开火，F 切换）　Q / 空格 / 右键 位移　E 技能　R 大招', textStyle(15, '#c8cde0')).setOrigin(0.5);
    this.add.text(W / 2, H - 40, '6 种武器 · 11 种技能：每波结束可升级或更换 · 8 种敌人 · 精英带随机词缀 · 第 10 波 Boss', textStyle(13, '#8890a8')).setOrigin(0.5);
    this.add.text(W - 12, H - 12, 'Made with Claude Code', { fontFamily: FONT, fontSize: '11px', color: '#555c78' }).setOrigin(1, 1);

    this.input.keyboard?.on('keydown-ONE', () => this.pick('lumen'));
    this.input.keyboard?.on('keydown-TWO', () => this.pick('kael'));
    if (BOT) this.time.delayedCall(300, () => this.pick(new URLSearchParams(location.search).get('hero') === 'kael' ? 'kael' : 'lumen'));
  }

  private pick(id: HeroDef['id']) {
    if (this.picked) return;
    this.picked = true;
    unlockAudio();
    sfx('pick');
    this.cameras.main.fadeOut(250, 11, 13, 22);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { hero: id }));
  }

  private heroCard(x: number, y: number, h: HeroDef) {
    const cw = 420;
    const ch = 300;
    const bg = this.add.rectangle(0, 0, cw, ch, 0x151a2c, 0.95).setStrokeStyle(2, h.color, 0.6);
    const portrait = this.add.image(-cw / 2 + 60, -ch / 2 + 60, 'hero_' + h.id).setScale(1.8);
    this.tweens.add({ targets: portrait, rotation: Math.PI * 2, duration: 9000, repeat: -1 });
    const idx = h.id === 'lumen' ? '1' : '2';
    const name = this.add.text(-cw / 2 + 115, -ch / 2 + 24, `${h.name}  ${h.title}`, textStyle(28, hex(h.color), true));
    const role = this.add.text(-cw / 2 + 117, -ch / 2 + 66, `${h.role}　生命 ${h.hp}`, textStyle(14, '#c8cde0'));
    const desc = this.add.text(-cw / 2 + 24, -ch / 2 + 106, h.desc, { ...textStyle(14, '#dfe3f0'), wordWrap: { width: cw - 48, useAdvancedWrap: true } });
    const slots: Slot[] = ['weapon', 'Q', 'E', 'R'];
    const abilities = slots.map((s, i) => {
      const d = defOf(s, h.loadout[s]);
      return this.add.text(-cw / 2 + 24, -ch / 2 + 140 + i * 25, `${s === 'weapon' ? '武器' : s}  ${d.name}　${d.desc}`, textStyle(13, i === 3 ? '#ffd34a' : '#b8bfd6'));
    });
    abilities.push(this.add.text(-cw / 2 + 24, -ch / 2 + 245, `被动 · ${h.passive.name}：${h.passive.desc}`, { ...textStyle(13, hex(h.color)), wordWrap: { width: cw - 48, useAdvancedWrap: true } }));
    const hint = this.add.text(cw / 2 - 14, ch / 2 - 12, `点击选择 [${idx}]`, textStyle(13, hex(h.color))).setOrigin(1, 1);

    const c = this.add.container(x, y, [bg, portrait, name, role, desc, ...abilities, hint]).setSize(cw, ch).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { bg.setStrokeStyle(3, h.color, 1); this.tweens.add({ targets: c, scale: 1.03, duration: 120 }); });
    c.on('pointerout', () => { bg.setStrokeStyle(2, h.color, 0.6); this.tweens.add({ targets: c, scale: 1, duration: 120 }); });
    c.on('pointerup', () => this.pick(h.id));
  }
}
