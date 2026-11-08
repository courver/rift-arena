import Phaser from 'phaser';
import { FONT } from '../config';
import { unlockAudio } from '../sfx';

export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, w = 220, color = 0x6a4cff) {
  const bg = scene.add.rectangle(0, 0, w, 48, color, 0.25).setStrokeStyle(2, color);
  const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]).setSize(w, 48).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => { bg.setFillStyle(color, 0.5); scene.tweens.add({ targets: c, scale: 1.05, duration: 100 }); });
  c.on('pointerout', () => { bg.setFillStyle(color, 0.25); scene.tweens.add({ targets: c, scale: 1, duration: 100 }); });
  c.on('pointerup', () => { unlockAudio(); onClick(); });
  return c;
}

export function textStyle(size: number, color = '#ffffff', bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', stroke: '#000', strokeThickness: size >= 28 ? 5 : 2 };
}
