import Phaser from 'phaser';
import { HEROES } from '../data/heroes';
import { buildArt } from '../game/art';

/** All art is generated in code (here and in game/art.ts), so the game ships with zero image assets. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();
    const make = (key: string, w: number, h: number, draw: () => void) => {
      g.clear();
      draw();
      g.generateTexture(key, w, h);
    };

    // shield arc in front (+x), drawn as its own sprite so it can turn independently
    make('shield', 70, 70, () => {
      g.lineStyle(7, 0xbfe0ff, 1).beginPath().arc(35, 35, 30, -1.13, 1.13).strokePath();
      g.lineStyle(2, 0xffffff, 1).beginPath().arc(35, 35, 33, -1.0, 1.0).strokePath();
    });
    make('bolt', 22, 10, () => {
      g.fillStyle(HEROES.lumen.color, 0.4).fillEllipse(11, 5, 22, 10);
      g.fillStyle(0xffffff).fillEllipse(13, 5, 12, 5);
    });
    make('wave', 24, 48, () => {
      g.lineStyle(6, 0xffb090, 1).beginPath().arc(0, 24, 20, -1.2, 1.2).strokePath();
      g.lineStyle(2, 0xffffff, 1).beginPath().arc(0, 24, 20, -1.0, 1.0).strokePath();
    });
    make('ebullet', 16, 16, () => {
      g.fillStyle(0xff3355).fillCircle(8, 8, 7);
      g.fillStyle(0xffd0d8).fillCircle(8, 8, 3.5);
    });
    make('pellet', 10, 10, () => {
      g.fillStyle(0xffc04a, 0.5).fillCircle(5, 5, 5);
      g.fillStyle(0xffffff).fillCircle(5, 5, 2.5);
    });
    make('tbolt', 16, 8, () => {
      g.fillStyle(0x7bff9e, 0.5).fillEllipse(8, 4, 16, 8);
      g.fillStyle(0xffffff).fillEllipse(9, 4, 8, 3);
    });
    make('blade', 36, 36, () => {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.fillStyle(0xd0ff6a).fillTriangle(
          18 + Math.cos(a) * 17, 18 + Math.sin(a) * 17,
          18 + Math.cos(a + 1.1) * 6, 18 + Math.sin(a + 1.1) * 6,
          18 + Math.cos(a - 0.4) * 6, 18 + Math.sin(a - 0.4) * 6,
        );
      }
      g.fillStyle(0xffffff).fillCircle(18, 18, 4);
    });
    make('flame', 24, 24, () => {
      g.fillStyle(0xff4a1a, 0.35).fillCircle(12, 12, 12);
      g.fillStyle(0xff9a3a, 0.7).fillCircle(12, 12, 7);
      g.fillStyle(0xfff0a0).fillCircle(12, 12, 3);
    });
    make('turret', 36, 36, () => {
      g.fillStyle(0x1d3a2a).fillCircle(18, 18, 14);
      g.lineStyle(2, 0x7bff9e).strokeCircle(18, 18, 14);
      g.fillStyle(0x7bff9e).fillRect(18, 15, 17, 6);
      g.fillStyle(0xffffff).fillCircle(18, 18, 5);
    });
    make('decoy', 40, 40, () => {
      g.fillStyle(0xffffff, 0.35).fillCircle(20, 20, 18);
      g.lineStyle(3, 0xffffff).strokeCircle(20, 20, 15);
      g.fillStyle(0xffffff).fillCircle(20, 20, 5);
    });
    make('orb', 22, 22, () => {
      g.fillStyle(0xb06bff, 0.35).fillCircle(11, 11, 11);
      g.fillStyle(0xd9a8ff).fillCircle(11, 11, 7);
      g.fillStyle(0xffffff).fillCircle(11, 11, 3);
    });
    make('aim', 16, 16, () => g.fillStyle(0xffffff, 0.8).fillTriangle(2, 2, 15, 8, 2, 14));
    make('dot', 8, 8, () => g.fillStyle(0xffffff).fillCircle(4, 4, 4));
    make('heart', 20, 20, () => {
      g.fillStyle(0x7bff9e, 0.3).fillCircle(10, 10, 10);
      g.fillStyle(0x7bff9e).fillRect(7, 3, 6, 14).fillRect(3, 7, 14, 6);
    });
    make('ring', 128, 128, () => g.lineStyle(6, 0xffffff).strokeCircle(64, 64, 60));
    g.destroy();
    buildArt(this);
    document.getElementById('loading')?.remove();
    (window as unknown as { __booted: boolean }).__booted = true;

    this.scene.start('Menu');
  }
}
