import Phaser from 'phaser';
import type { Equip, HeroDef, SkillSlot, Slot } from '../data/heroes';
import type { Enemy } from './Enemy';
import { SKILLS } from './skills';
import { WEAPONS } from './weapons';

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
  /** stat upgrade stack counts by id */
  mods: Record<string, number> = {};
  loadout: Record<Slot, Equip>;
  hp: number;
  cd: Record<SkillSlot, number> = { Q: 0, E: 0, R: 0 };
  atkTimer = 0;
  iframes = 0;
  aimAngle = 0;
  /** swing / shot counter for weapons with every-Nth-attack effects */
  shots = 0;

  dashT = 0;
  dashVx = 0;
  dashVy = 0;
  dashDmg = 0;
  dashRefund = false;
  dashHit = new Set<Enemy>();
  whirlT = 0;
  whirlTick = 0;
  whirlLv = 1;
  rageT = 0;
  rageArmor = false;

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
    this.loadout = {
      weapon: { id: hero.loadout.weapon, lv: 1 },
      Q: { id: hero.loadout.Q, lv: 1 },
      E: { id: hero.loadout.E, lv: 1 },
      R: { id: hero.loadout.R, lv: 1 },
    };
    this.hp = hero.hp;
    this.aura = scene.add.circle(x, y, 30, 0xff3020, 0.25).setVisible(false).setDepth(9);
    this.sprite = scene.add.image(x, y, 'hero_' + hero.id).setDepth(10);
  }

  mod(id: string) {
    return this.mods[id] ?? 0;
  }

  get weapon() {
    return WEAPONS[this.loadout.weapon.id];
  }

  get atkRate() {
    const w = this.loadout.weapon;
    return WEAPONS[w.id].rate(w.lv) * this.stats.atkRateMult * (this.rageT > 0 ? 1.5 : 1);
  }

  get speed() {
    return this.stats.moveSpeed * (this.rageT > 0 ? 1.2 : 1);
  }

  /** Kael's passive kicks in at low health. */
  get desperate() {
    return this.hero.id === 'kael' && this.hp < this.stats.maxHp * 0.35;
  }

  cdOf(slot: SkillSlot) {
    const e = this.loadout[slot];
    return SKILLS[e.id].cd(e.lv) * (1 - Math.min(0.5, this.stats.cdr));
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
