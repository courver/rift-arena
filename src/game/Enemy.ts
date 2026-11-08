import Phaser from 'phaser';
import { ENEMIES, EnemyDef, EnemyType, hpScale } from '../data/enemies';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../sfx';

type State = 'move' | 'windup' | 'charge' | 'recover' | 'spiral';

const KB_TAKEN: Record<EnemyType, number> = { slime: 1, runner: 1.3, shooter: 1, brute: 0.45, elite: 0.25, boss: 0 };

export class Enemy {
  img: Phaser.GameObjects.Image;
  type: EnemyType;
  def: EnemyDef;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  dead = false;

  flashT = 0;
  slowT = 0;
  freezeT = 0;
  kbx = 0;
  kby = 0;
  /** seconds since the last time this enemy dealt contact damage */
  hitCd = 0;

  state: State = 'move';
  stateT = 0;
  angle = 0;
  fireT: number;
  chargeT: number;
  summonT = 6;
  spiralT = 8;
  spiralAngle = 0;
  phase = 1;

  constructor(scene: GameScene, type: EnemyType, x: number, y: number, wave: number) {
    this.type = type;
    this.def = ENEMIES[type];
    this.x = x;
    this.y = y;
    this.r = this.def.r;
    this.maxHp = this.hp = Math.round(this.def.hp * (type === 'boss' ? 1 : hpScale(wave)));
    this.img = scene.add.image(x, y, type).setDepth(type === 'boss' ? 6 : 5);
    this.fireT = Phaser.Math.FloatBetween(1, 2.2);
    this.chargeT = Phaser.Math.FloatBetween(2, 4);
    this.img.setScale(0);
    scene.tweens.add({ targets: this.img, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  knock(angle: number, force: number) {
    const k = force * KB_TAKEN[this.type];
    this.kbx += Math.cos(angle) * k;
    this.kby += Math.sin(angle) * k;
  }

  get speedMul() {
    if (this.freezeT > 0) return 0;
    if (this.slowT > 0) return this.type === 'boss' ? 0.75 : 0.5;
    return 1;
  }

  update(s: GameScene, dt: number) {
    this.flashT -= dt;
    this.slowT -= dt;
    this.freezeT -= dt;
    this.hitCd -= dt;
    const p = s.player;
    const toP = Math.atan2(p.y - this.y, p.x - this.x);
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    let vx = 0;
    let vy = 0;
    const spd = this.def.speed * this.speedMul;
    const frozen = this.freezeT > 0;

    const chase = (mul = 1) => {
      vx = Math.cos(toP) * spd * mul;
      vy = Math.sin(toP) * spd * mul;
    };

    if (this.state === 'move') this.angle = toP;

    switch (this.type) {
      case 'slime':
      case 'runner':
        chase();
        break;

      case 'shooter': {
        // hold a ring around the player and strafe
        const want = dist > 320 ? 1 : dist < 220 ? -1 : 0;
        const strafe = toP + Math.PI / 2;
        vx = Math.cos(toP) * spd * want + Math.cos(strafe) * spd * 0.5;
        vy = Math.sin(toP) * spd * want + Math.sin(strafe) * spd * 0.5;
        if (!frozen) this.fireT -= dt;
        if (this.fireT <= 0 && dist < 650) {
          this.fireT = 2.3;
          s.spawnEBullet(this.x, this.y, toP, 240, 9);
        }
        break;
      }

      case 'brute':
      case 'elite':
      case 'boss':
        this.updateHeavy(s, dt, dist, toP, chase);
        if (this.state === 'charge') {
          const cs = this.type === 'brute' ? 430 : this.type === 'elite' ? 470 : 520;
          vx = Math.cos(this.angle) * cs * (frozen ? 0 : 1);
          vy = Math.sin(this.angle) * cs * (frozen ? 0 : 1);
        } else if (this.state === 'move') {
          chase(this.type === 'boss' && this.phase === 3 ? 1.4 : 1);
        }
        break;
    }

    this.x += (vx + this.kbx) * dt;
    this.y += (vy + this.kby) * dt;
    const decay = Math.exp(-9 * dt);
    this.kbx *= decay;
    this.kby *= decay;
    s.clampToArena(this);

    this.img.setPosition(this.x, this.y);
    if (this.type !== 'slime') this.img.setRotation(this.angle);
    if (this.flashT > 0) this.img.setTintFill(0xffffff);
    else if (this.freezeT > 0) this.img.setTint(0x66ccff);
    else if (this.slowT > 0) this.img.setTint(0xaee6ff);
    else if (this.state === 'windup') this.img.setTint(0xff8080);
    else if (this.type === 'boss' && this.phase === 3) this.img.setTint(0xff9090);
    else this.img.clearTint();
  }

  /** Brute / elite / boss: telegraphed charges plus bullet patterns. */
  private updateHeavy(s: GameScene, dt: number, dist: number, toP: number, chase: () => void) {
    if (this.freezeT > 0) return;
    this.stateT -= dt;
    this.chargeT -= dt;
    const boss = this.type === 'boss';

    if (boss) {
      const frac = this.hp / this.maxHp;
      const ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
      if (ph !== this.phase) {
        this.phase = ph;
        s.onBossPhase(this, ph);
      }
    }

    if (this.state === 'windup' && this.stateT <= 0) {
      this.state = 'charge';
      this.stateT = boss ? 0.75 : 0.55;
    } else if (this.state === 'charge' && this.stateT <= 0) {
      this.state = 'recover';
      this.stateT = 0.6;
    } else if ((this.state === 'recover' || this.state === 'spiral') && this.stateT <= 0) {
      this.state = 'move';
    }

    if (this.state === 'spiral') {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 0.09;
        this.spiralAngle += 0.37;
        for (let k = 0; k < 3; k++) s.spawnEBullet(this.x, this.y, this.spiralAngle + (k * Math.PI * 2) / 3, 200, 10);
      }
      return;
    }
    if (this.state !== 'move') return;

    const chargeRange = boss ? 600 : 300;
    if (this.chargeT <= 0 && dist < chargeRange) {
      this.state = 'windup';
      this.angle = toP;
      const wind = boss ? 0.9 : 0.65;
      this.stateT = wind;
      this.chargeT = boss ? (this.phase === 3 ? 5 : 7) : this.type === 'elite' ? 5 : 4;
      s.fx.telegraphLine(this.x, this.y, toP, boss ? 420 : 260, this.r * 2, wind * 1000);
      return;
    }

    if (this.type === 'elite' || boss) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        const n = boss ? (this.phase === 3 ? 22 : 14) : 10;
        this.fireT = boss ? (this.phase === 3 ? 2.4 : 3.2) : 4;
        const off = Math.random() * Math.PI;
        for (let k = 0; k < n; k++) s.spawnEBullet(this.x, this.y, off + (k / n) * Math.PI * 2, boss ? 210 : 190, boss ? 12 : 10);
        sfx('ebullet');
      }
    }

    if (boss && this.phase >= 2) {
      this.spiralT -= dt;
      this.summonT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = 9;
        this.state = 'spiral';
        this.stateT = 2.6;
        this.fireT = 0;
      }
      if (this.summonT <= 0) {
        this.summonT = 9;
        for (let k = 0; k < 4; k++) s.queueSpawn(k % 2 ? 'runner' : 'slime', this.x + Phaser.Math.Between(-140, 140), this.y + Phaser.Math.Between(-140, 140));
      }
    }
  }

  destroy() {
    this.dead = true;
    this.img.destroy();
  }
}
