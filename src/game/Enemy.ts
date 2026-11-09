import Phaser from 'phaser';
import { AFFIXES, Affix, BOSS_PHASES, ENEMIES, EnemyDef, EnemyType, hpScale, isBossType } from '../data/enemies';
import { ART_SCALE } from './art';
import { diff } from '../data/difficulty';
import { FONT } from '../config';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../sfx';

type State = 'move' | 'windup' | 'charge' | 'recover' | 'spiral' | 'aim' | 'arm';

const KB_TAKEN: Record<EnemyType, number> = {
  slime: 1, mini: 1.4, runner: 1.3, shooter: 1, bomber: 1.1, shielder: 0.3, priest: 1, brute: 0.45, elite: 0.25, boss: 0, colossus: 0, weaver: 0,
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
  affixes: Affix[] = [];
  /** warded affix: absorbs damage first, regenerates out of combat */
  ward = 0;
  wardMax = 0;
  wardRegenT = 0;

  flashT = 0;
  slowT = 0;
  freezeT = 0;
  burnT = 0;
  /** poison stacks (毒), refreshed on each application */
  poison = 0;
  poisonT = 0;
  poisonTick = 0;
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
  readonly isBoss: boolean;
  /** animation clock, randomised so crowds don't bob in sync */
  private animT = Math.random() * 10;
  private patIdx = 0;
  private teleT = 3;
  private beamT = 5;
  private orbT = 4;

  constructor(scene: GameScene, type: EnemyType, x: number, y: number, wave: number, affixes: Affix[] = []) {
    this.type = type;
    this.def = ENEMIES[type];
    this.x = x;
    this.y = y;
    this.r = this.def.r;
    const D = diff();
    this.speed = this.def.speed * D.speed;
    this.isBoss = isBossType(type);
    this.maxHp = this.hp = Math.round(this.def.hp * (this.isBoss ? 1 : hpScale(wave)) * D.hp);
    this.img = scene.add.image(x, y, type).setDepth(this.isBoss ? 6 : 5);
    this.fireT = Phaser.Math.FloatBetween(1, 2.2);
    this.chargeT = Phaser.Math.FloatBetween(1.2, 3);
    this.facing = Math.atan2(scene.player.y - y, scene.player.x - x);
    this.img.setScale(0);
    scene.tweens.add({ targets: this.img, scale: ART_SCALE, duration: 220, ease: 'Back.easeOut' });

    if (type === 'shielder') {
      this.extra.push(scene.add.image(x, y, 'shield').setDepth(6));
    }
    if (affixes.length) {
      this.affixes = affixes;
      if (affixes.includes('swift')) this.speed *= 1.5;
      if (affixes.includes('warded')) this.ward = this.wardMax = Math.round(this.maxHp * 0.3);
      const label = scene.add.text(x, y, affixes.map((a) => AFFIXES[a]).join(' · '), {
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
    if (this.slowT > 0) return this.isBoss ? 0.75 : 0.5;
    return 1;
  }

  get enraged() {
    return this.affixes.includes('enraged') && this.hp < this.maxHp * 0.5;
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

      case 'colossus':
        if (this.updateBossPhase(s) || frozen) break;
        if (this.state === 'move') chase(this.phase === 2 ? 1.3 : 1);
        this.updateColossus(s, dt);
        break;

      case 'weaver':
        if (this.updateBossPhase(s) || frozen) break;
        if (this.state === 'move') kite(260, 380);
        this.updateWeaver(s, dt, toP);
        break;

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

    if (this.state === 'windup' || this.state === 'aim' || this.state === 'arm' || (this.state === 'recover' && this.isBoss)) {
      vx = 0;
      vy = 0;
    }
    this.x += (vx + this.kbx) * dt;
    this.y += (vy + this.kby) * dt;
    const decay = Math.exp(-9 * dt);
    this.kbx *= decay;
    this.kby *= decay;
    s.clampToArena(this);
    this.animT += dt;
    this.sync();
  }

  sync() {
    // 3/4-view art: face the target by flipping, bob while alive, lean into charges
    const t = this.animT;
    const jelly = this.type === 'slime' || this.type === 'mini';
    const bob = jelly ? 0 : Math.sin(t * (this.isBoss ? 3 : 8)) * (this.isBoss ? 3 : 1.6);
    this.img.setPosition(this.x, this.y + bob);
    if (jelly) {
      const q = Math.sin(t * 7) * 0.08;
      this.img.setScale(ART_SCALE * (1 + q), ART_SCALE * (1 - q));
    }
    this.img.setFlipX(Math.cos(this.angle) < 0);
    const leaning = this.state === 'charge' && !this.isBoss;
    this.img.setRotation(leaning ? (Math.cos(this.angle) < 0 ? -0.25 : 0.25) : 0);
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
    else if (this.poison > 0) this.img.setTint(0xa8ff80);
    else if ((this.isBoss && this.phase === BOSS_PHASES[this.type]!.length + 1) || this.enraged) this.img.setTint(0xff9090);
    else this.img.clearTint();
  }

  /** Brute / elite / boss: telegraphed charges plus bullet patterns. */
  private updateHeavy(s: GameScene, dt: number, dist: number, toP: number) {
    if (this.freezeT > 0) return;
    const rage = this.enraged ? 2 : 1;
    this.chargeT -= dt * rage;
    const boss = this.type === 'boss';

    if (boss) this.updateBossPhase(s);

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

  /** Advances the boss phase from its hp; returns true on the frame it changes. */
  private updateBossPhase(s: GameScene) {
    const marks = BOSS_PHASES[this.type]!;
    const frac = this.hp / this.maxHp;
    const ph = 1 + marks.filter((m) => frac <= m).length;
    if (ph === this.phase) return false;
    this.phase = ph;
    s.onBossPhase(this, ph);
    return true;
  }

  /** 熔核巨像: slow chaser that alternates slam chains, gapped quake rings and rock rain. */
  private updateColossus(s: GameScene, dt: number) {
    if (this.state === 'recover' && this.stateT <= 0) this.state = 'move';
    if (this.state !== 'move') return;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    const p2 = this.phase === 2;
    this.fireT = p2 ? 2.6 : 3.4;
    this.state = 'recover';
    this.stateT = 0.9;
    const pat = this.patIdx++ % 3;
    if (pat === 0) {
      const n = p2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        s.time.delayedCall(i * (p2 ? 320 : 450), () => {
          if (this.dead) return;
          const p = s.player;
          s.delayedHit(p.x, p.y, 90, 900, 20, 'colossus-slam', 0xff8a3a);
        });
      }
    } else if (pat === 1) {
      // wind-up glow first, so melee players get a beat to back off
      s.fx.telegraphCircle(this.x, this.y, this.r * 2.2, 500, 0xff8a3a);
      for (let k = 0; k < (p2 ? 2 : 1); k++) {
        s.time.delayedCall(500 + k * 650, () => {
          if (this.dead) return;
          // a ring with one gap: find the gap and walk through it
          const gap = Math.random() * Math.PI * 2;
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            if (Math.abs(Phaser.Math.Angle.Wrap(a - gap)) < 0.42) continue;
            s.spawnEBullet(this.x, this.y, a, 165, 14);
          }
          s.fx.ring(this.x, this.y, this.r * 2, 0xff8a3a, 300, 0.3);
          s.shake(150, 0.006);
          sfx('boom');
        });
      }
    } else {
      const p = s.player;
      for (let i = 0; i < (p2 ? 8 : 5); i++) {
        const x = p.x + Phaser.Math.Between(-170, 170);
        const y = p.y + Phaser.Math.Between(-170, 170);
        s.time.delayedCall(i * 90, () => { if (!this.dead) s.delayedHit(x, y, 55, 1000, 18, 'colossus-rock', 0xffb070); });
      }
    }
  }

  /** 虚空织影: kites, blinks around the arena, fires fans and cross-shaped beams. */
  private updateWeaver(s: GameScene, dt: number, toP: number) {
    if (this.state === 'aim' && this.stateT <= 0) this.state = 'move';
    if (this.state !== 'move') return;
    const p2 = this.phase === 2;
    this.teleT -= dt;
    this.beamT -= dt;
    this.orbT -= dt;
    this.summonT -= dt;

    if (this.beamT <= 0) {
      this.beamT = p2 ? 5.5 : 7;
      this.state = 'aim';
      this.stateT = 1.1;
      const n = p2 ? 6 : 4;
      for (let k = 0; k < n; k++) s.beamHit(this.x, this.y, toP + (k * Math.PI * 2) / n, 1100, 34, 950, 24, 'weaver-beam');
      return;
    }
    if (this.teleT <= 0) {
      this.teleT = p2 ? 3.2 : 4.2;
      this.state = 'aim';
      this.stateT = 0.55;
      s.fx.burst(this.x, this.y, this.def.color, 18, 220);
      s.tweens.add({ targets: this.img, alpha: 0, duration: 200, yoyo: true });
      s.time.delayedCall(250, () => {
        if (this.dead) return;
        const p = s.player;
        for (let tries = 0; tries < 20; tries++) {
          const a = Math.random() * Math.PI * 2;
          const d = Phaser.Math.Between(280, 420);
          this.x = p.x + Math.cos(a) * d;
          this.y = p.y + Math.sin(a) * d;
          s.clampToArena(this);
          if (Math.hypot(this.x - p.x, this.y - p.y) > 240) break;
        }
        s.fx.burst(this.x, this.y, this.def.color, 18, 220);
        const aim = Math.atan2(p.y - this.y, p.x - this.x);
        for (let i = 0; i < 9; i++) s.spawnEBullet(this.x, this.y, aim + (i - 4) * 0.14, 230, 11);
        sfx('blink');
      });
      return;
    }
    if (p2 && this.orbT <= 0) {
      this.orbT = 6;
      for (let i = 0; i < 3; i++) s.spawnEBullet(this.x, this.y, toP + (i - 1) * 0.8, 140, 14, 1.8);
    }
    if (p2 && this.summonT <= 0) {
      this.summonT = 10;
      for (let i = 0; i < 2; i++) s.queueSpawn('shooter', this.x + Phaser.Math.Between(-120, 120), this.y + Phaser.Math.Between(-120, 120));
    }
  }

  destroy() {
    this.dead = true;
    this.img.destroy();
    this.extra.forEach((o) => o.destroy());
  }
}
