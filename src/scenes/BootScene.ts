import Phaser from 'phaser';
import { ENEMIES } from '../data/enemies';
import { HEROES } from '../data/heroes';

/** All art is generated here from vector shapes, so the game ships with zero image assets. */
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

    // heroes face +x so sprite rotation == aim angle
    make('hero_lumen', 48, 48, () => {
      g.fillStyle(HEROES.lumen.color, 0.25).fillCircle(24, 24, 22);
      g.fillStyle(0x1b3a52).fillCircle(24, 24, 16);
      g.lineStyle(3, HEROES.lumen.color).strokeCircle(24, 24, 16);
      g.fillStyle(0xffffff).fillTriangle(34, 18, 46, 24, 34, 30);
      g.fillStyle(HEROES.lumen.color).fillCircle(24, 24, 6);
    });
    make('hero_kael', 48, 48, () => {
      g.fillStyle(HEROES.kael.color, 0.25).fillCircle(24, 24, 22);
      g.fillStyle(0x4a1d18).fillCircle(24, 24, 17);
      g.lineStyle(3, HEROES.kael.color).strokeCircle(24, 24, 17);
      g.fillStyle(0xffe0d0).fillRect(30, 21, 17, 6);
      g.fillStyle(HEROES.kael.color).fillRect(28, 17, 4, 14);
    });

    const e = ENEMIES;
    make('slime', 32, 32, () => {
      g.fillStyle(e.slime.color).fillCircle(16, 17, 14);
      g.fillStyle(0xffffff, 0.35).fillCircle(11, 11, 4);
      g.fillStyle(0x0b0d16).fillCircle(12, 17, 2.5).fillCircle(20, 17, 2.5);
    });
    make('runner', 26, 26, () => {
      g.fillStyle(e.runner.color).fillTriangle(25, 13, 2, 2, 2, 24);
      g.fillStyle(0x0b0d16).fillCircle(12, 13, 3);
    });
    make('shooter', 32, 32, () => {
      g.fillStyle(e.shooter.color).fillPoints([new Phaser.Math.Vector2(16, 1), new Phaser.Math.Vector2(31, 16), new Phaser.Math.Vector2(16, 31), new Phaser.Math.Vector2(1, 16)], true);
      g.fillStyle(0xffffff).fillCircle(16, 16, 5);
      g.fillStyle(0x2a0b40).fillCircle(18, 16, 2.5);
    });
    make('brute', 48, 48, () => {
      g.fillStyle(0x5a3010).fillRoundedRect(2, 2, 44, 44, 8);
      g.fillStyle(e.brute.color).fillRoundedRect(6, 6, 36, 36, 6);
      g.fillStyle(0x0b0d16).fillRect(26, 14, 10, 6).fillRect(26, 28, 10, 6);
    });
    make('elite', 64, 64, () => {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = i % 2 ? 22 : 31;
        pts.push(new Phaser.Math.Vector2(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr));
      }
      g.fillStyle(e.elite.color).fillPoints(pts, true);
      g.fillStyle(0x2b0a26).fillCircle(32, 32, 15);
      g.fillStyle(0xffffff).fillCircle(37, 32, 5);
    });
    make('boss', 120, 120, () => {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? 44 : 58;
        pts.push(new Phaser.Math.Vector2(60 + Math.cos(a) * rr, 60 + Math.sin(a) * rr));
      }
      g.fillStyle(0x5a0a1a).fillPoints(pts, true);
      g.lineStyle(4, e.boss.color).strokePoints(pts, true);
      g.fillStyle(e.boss.color).fillCircle(60, 60, 26);
      g.fillStyle(0xffd0d8).fillCircle(70, 60, 10);
      g.fillStyle(0x200008).fillCircle(73, 60, 5);
    });

    make('mini', 20, 20, () => {
      g.fillStyle(e.mini.color).fillCircle(10, 11, 9);
      g.fillStyle(0x0b0d16).fillCircle(7, 11, 1.8).fillCircle(13, 11, 1.8);
    });
    make('bomber', 30, 30, () => {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? 9 : 14;
        pts.push(new Phaser.Math.Vector2(15 + Math.cos(a) * rr, 15 + Math.sin(a) * rr));
      }
      g.fillStyle(e.bomber.color).fillPoints(pts, true);
      g.fillStyle(0xffe070).fillCircle(15, 15, 5);
    });
    make('shielder', 44, 44, () => {
      g.fillStyle(0x23324d).fillRoundedRect(4, 4, 36, 36, 6);
      g.fillStyle(e.shielder.color).fillRoundedRect(8, 8, 28, 28, 5);
      g.fillStyle(0x0b0d16).fillRect(24, 16, 8, 4).fillRect(24, 24, 8, 4);
    });
    // shield arc in front (+x), drawn as its own sprite so it can turn independently
    make('shield', 70, 70, () => {
      g.lineStyle(7, 0xbfe0ff, 1).beginPath().arc(35, 35, 30, -1.13, 1.13).strokePath();
      g.lineStyle(2, 0xffffff, 1).beginPath().arc(35, 35, 33, -1.0, 1.0).strokePath();
    });
    make('priest', 30, 30, () => {
      g.lineStyle(2, 0xffffff, 0.8).strokeCircle(15, 15, 14);
      g.fillStyle(e.priest.color).fillCircle(15, 15, 11);
      g.fillStyle(0xffffff).fillRect(13, 7, 4, 16).fillRect(8, 12, 14, 4);
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
    make('dot', 8, 8, () => g.fillStyle(0xffffff).fillCircle(4, 4, 4));
    make('heart', 20, 20, () => {
      g.fillStyle(0x7bff9e, 0.3).fillCircle(10, 10, 10);
      g.fillStyle(0x7bff9e).fillRect(7, 3, 6, 14).fillRect(3, 7, 14, 6);
    });
    make('ring', 128, 128, () => g.lineStyle(6, 0xffffff).strokeCircle(64, 64, 60));
    g.destroy();

    this.scene.start('Menu');
  }
}
