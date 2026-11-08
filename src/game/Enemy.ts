import Phaser from 'phaser';
import { AFFIXES, Affix, ENEMIES, EnemyDef, EnemyType, hpScale } from '../data/enemies';
import { FONT } from '../config';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../sfx';

type State = 'move' | 'windup' | 'charge' | 'recover' | 'spiral' | 'aim' | 'arm';

const KB_TAKEN: Record<EnemyType, number> = {
  slime: 1, mini: 1.4, runner: 1.3, shooter: 1, bomber: 1.1, shielder: 0.3, priest: 1, brute: 0.45, elite: 0.25, boss: 0,
};

/** Half-angle of the shielder's frontal shield. */
export const SHIELD_ARC = (65 * Math.PI) / 180;

export class Enemy {
  img: Phaser.GameObjects.Image;
  /** shield for shielders, affix label for elites */
  extra: Phaser.GameObjects.GameObject[] = [];
  type: EnemyType;
  def: EnemyDef;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dead = false;
  affix: Affix | null = null;
  /** warded affix: absorbs damage first, regenerates out of combat */
  ward = 0;
  wardMax = 0;
  wardRegenT = 0;

  flashT = 0;
  slowT = 0;
  freezeT = 0;
  burnT = 0;
  burnDps = 0;
  burnTick = 0;
  kbx = 0;
  kby = 0;
  /** seconds until this enemy can deal contact damage again */
  hitCd = 0;

  state: State = 'move';
  stateT = 0;
  angle = 0;
  /** direction the shielder's shield faces; turns slowly so it can be flanked */
  facing = 0;
  fireT: number;
  chargeT: number;
  summonT = 6;
  spiralT = 8;
  spiralAngle = 0;
  phase = 1;

  constructor(scene: GameScene, type: EnemyType, x: number, y: number, wave: number, affix: Affix | null = null) {
    this.type = type;
    this.def = ENEMIES[type];
    this.x = x;
    this.y = y;
    this.r = this.def.r;
    this.speed = this.def.speed;
    this.maxHp = this.hp = Math.round(this.def.hp * (type === 'boss' ? 1 : hpScale(wave)));
    this.img = scene.add.image(x, y, type).setDepth(type === 'boss' ? 6 : 5);
    this.fireT = Phaser.Math.FloatBetween(1, 2.2);
    this.chargeT = Phaser.Math.FloatBetween(1.2, 3);
    this.facing = Math.atan2(scene.player.y - y, scene.player.x - x);
    this.img.setScale(0);
    scene.tweens.add({ targets: this.img, scale: 1, duration: 220, ease: 'Back.easeOut' });

    if (type === 'shielder') {
      this.extra.push(scene.add.image(x, y, 'shield').setDepth(6));
    }
    if (affix) {
      this.affix = affix;
      if (affix === 'swift') this.speed *= 1.5;
      if (affix === 'warded') this.ward = this.wardMax = Math.round(this.maxHp * 0.3);
      const label = scene.add.text(x, y, AFFIXES[affix], {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffd0f4', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(21);
      this.extra.push(label);
    }
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

  get enraged() {
    return this.affix === 'enraged' && this.hp < this.maxHp * 0.5;
  }

  update(s: GameScene, dt: number) {
    this.flashT -= dt;
    this.slowT -= dt;
    this.freezeT -= dt;
    this.hitCd -= dt;
    this.wardRegenT -= dt;
    if (this.wardMax && this.wardRegenT <= 0) this.ward = Math.min(this.wardMax, this.ward + this.wardMax * 0.25 * dt);

    const tgt = s.targetPos();
    const toP = Math.atan2(tgt.y - this.y, tgt.x - this.x);
    const dist = Math.hypot(tgt.x - this.x, tgt.y - this.y);
    let vx = 0;
    let vy = 0;
    const spd = this.speed * this.speedMul;
    const frozen = this.freezeT > 0;

    const chase = (mul = 1) => {
      vx = Math.cos(toP) * spd * mul;
      vy = Math.sin(toP) * spd * mul;
    };
    // hold a ring around the target and strafe
    const kite = (near: number, far: number) => {
      const want = dist > far ? 1 : dist < near ? -1 : 0;
      const strafe = toP + Math.PI / 2;
      vx = Math.cos(toP) * spd * want + Math.cos(strafe) * spd * 0.5;
      vy = Math.sin(toP) * spd * want + Math.sin(strafe) * spd * 0.5;
    };

    if (this.state === 'move') this.angle = toP;
    if (!frozen) this.stateT -= dt;

    switch (this.type) {
      case 'slime':
      case 'mini':
        chase();
        break;

      case 'runner': {
        // walk, flash red, then burst toward where the player was
        if (this.state === 'move') {
          chase();
          if (!frozen) this.chargeT -= dt;
          if (this.chargeT <= 0 && dist < 380) { this.state = 'windup'; this.stateT = 0.35; }
        } else if (this.state === 'windup') {
          if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 0.32; }
        } else if (this.state === 'charge') {
          vx = Math.cos(this.angle) * 430 * this.speedMul;
          vy = Math.sin(this.angle) * 430 * this.speedMul;
          if (this.stateT <= 0) { this.state = 'move'; this.chargeT = Phaser.Math.FloatBetween(1.8, 2.6); }
        }
        break;
      }

      case 'shooter': {
        if (this.state === 'aim') {
          if (this.stateT <= 0) {
            this.state = 'move';
            s.spawnEBullet(this.x, this.y, this.angle, 330, 9);
            sfx('ebullet');
          }
        } else {
          kite(220, 330);
          if (!frozen) this.fireT -= dt;
          if (this.fireT <= 0 && dist < 650) {
            this.fireT = 2.4;
            this.state = 'aim';
            this.stateT = 0.45;
            this.angle = toP;
            s.fx.telegraphLine(this.x, this.y, toP, 260, 4, 450);
          }
        }
        break;
      }

      case 'bomber': {
        if (this.state === 'arm') {
          if (this.stateT <= 0) {
            s.bomberBlast(this, true);
            return;
          }
        } else {
          chase();
          if (dist < 70 + this.r) {
            this.state = 'arm';
            this.stateT = 0.7;
            s.fx.telegraphCircle(this.x, this.y, 85, 700, 0xff5a2a);
          }
        }
        break;
      }

      case 'shielder': {
        chase();
        if (!frozen) this.facing += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(toP - this.facing), -1.2 * dt, 1.2 * dt);
        this.angle = this.facing;
        break;
      }

      case 'priest': {
        kite(320, 430);
        if (!frozen) this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = 4.5;
          s.priestHeal(this);
        }
        break;
      }

      case 'brute':
      case 'elite':
      case 'boss':
        this.updateHeavy(s, dt, dist, toP);
        if (this.state === 'charge') {
          const cs = this.type === 'brute' ? 430 : this.type === 'elite' ? 470 : 520;
          vx = Math.cos(this.angle) * cs * (frozen ? 0 : 1);
          vy = Math.sin(this.angle) * cs * (frozen ? 0 : 1);
        } else if (this.state === 'move') {
          chase(this.type === 'boss' && this.phase === 3 ? 1.4 : this.enraged ? 1.3 : 1);
        }
        break;
    }

    if (this.state === 'windup' || this.state === 'aim' || this.state === 'arm') {
      vx = 0;
      vy = 0;
    }
    this.x += (vx + this.kbx) * dt;
    this.y += (vy + this.kby) * dt;
    const decay = Math.exp(-9 * dt);
    this.kbx *= decay;
    this.kby *= decay;
    s.clampToArena(this);
    this.sync();
  }

  sync() {
    this.img.setPosition(this.x, this.y);
    if (this.type !== 'slime' && this.type !== 'mini' && this.type !== 'priest') this.img.setRotation(this.angle);
    for (const o of this.extra) {
      const g = o as Phaser.GameObjects.Image;
      if (o.type === 'Text') g.setPosition(this.x, this.y - this.r - 20);
      else g.setPosition(this.x, this.y).setRotation(this.facing);
    }
    const blinkArm = this.state === 'arm' && Math.floor(this.stateT * 14) % 2 === 0;
    if (this.flashT > 0 || blinkArm) this.img.setTintFill(0xffffff);
    else if (this.freezeT > 0) this.img.setTint(0x66ccff);
    else if (this.slowT > 0) this.img.setTint(0xaee6ff);
    else if (this.state === 'windup' || this.state === 'aim') this.img.setTint(0xff8080);
    else if (this.burnT > 0) this.img.setTint(0xffb080);
    else if ((this.type === 'boss' && this.phase === 3) || this.enraged) this.img.setTint(0xff9090);
    else this.img.clearTint();
  }

  /** Brute / elite / boss: telegraphed charges plus bullet patterns. */
  private updateHeavy(s: GameScene, dt: number, dist: number, toP: number) {
    if (this.freezeT > 0) return;
    const rage = this.enraged ? 2 : 1;
    this.chargeT -= dt * rage;
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
      this.fireT -= dt * rage;
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
        const pool: EnemyType[] = this.phase === 3 ? ['bomber', 'bomber', 'runner', 'shielder'] : ['slime', 'runner', 'bomber', 'slime'];
        for (const t of pool) s.queueSpawn(t, this.x + Phaser.Math.Between(-150, 150), this.y + Phaser.Math.Between(-150, 150));
      }
    }
  }

  destroy() {
    this.dead = true;
    this.img.destroy();
    this.extra.forEach((o) => o.destroy());
  }
}
