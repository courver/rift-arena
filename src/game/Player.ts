import Phaser from 'phaser';
import type { AbilityKey, HeroDef } from '../data/heroes';
import type { Enemy } from './Enemy';

export interface Stats {
  maxHp: number;
  moveSpeed: number;
  dmgMult: number;
  atkRateMult: number;
  critChance: number;
  critMult: number;
  lifesteal: number;
  /** cooldown reduction, capped at 0.5 */
  cdr: number;
  areaMult: number;
  /** fraction of incoming damage removed */
  armor: number;
  /** hp per second */
  regen: number;
}

export class Player {
  sprite: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  readonly r = 16;
  hero: HeroDef;
  stats: Stats;
  /** upgrade stack counts by id */
  mods: Record<string, number> = {};
  hp: number;
  cd: Record<Exclude<AbilityKey, 'LMB'>, number> = { Q: 0, E: 0, R: 0 };
  atkTimer = 0;
  iframes = 0;
  aimAngle = 0;

  dashT = 0;
  dashVx = 0;
  dashVy = 0;
  dashHit = new Set<Enemy>();
  whirlT = 0;
  whirlTick = 0;
  rageT = 0;
  slashCount = 0;

  constructor(scene: Phaser.Scene, hero: HeroDef, x: number, y: number) {
    this.hero = hero;
    this.x = x;
    this.y = y;
    this.stats = {
      maxHp: hero.hp,
      moveSpeed: hero.speed,
      dmgMult: 1,
      atkRateMult: 1,
      critChance: 0.05,
      critMult: 1.8,
      lifesteal: 0,
      cdr: 0,
      areaMult: 1,
      armor: 0,
      regen: 0,
    };
    this.hp = hero.hp;
    this.aura = scene.add.circle(x, y, 30, 0xff3020, 0.25).setVisible(false).setDepth(9);
    this.sprite = scene.add.image(x, y, 'hero_' + hero.id).setDepth(10);
  }

  mod(id: string) {
    return this.mods[id] ?? 0;
  }

  get atkRate() {
    return this.hero.atkRate * this.stats.atkRateMult * (this.rageT > 0 ? 1.6 : 1);
  }

  get speed() {
    return this.stats.moveSpeed * (this.rageT > 0 ? 1.2 : 1);
  }

  cdOf(key: Exclude<AbilityKey, 'LMB'>) {
    const def = this.hero.abilities.find((a) => a.key === key)!;
    return def.cd * (1 - Math.min(0.5, this.stats.cdr));
  }

  heal(n: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  sync() {
    this.sprite.setPosition(this.x, this.y).setRotation(this.aimAngle);
    this.aura.setPosition(this.x, this.y).setVisible(this.rageT > 0);
    const blink = this.iframes > 0 && this.dashT <= 0 && Math.floor(this.iframes * 20) % 2 === 0;
    this.sprite.setAlpha(blink ? 0.45 : 1);
  }
}
