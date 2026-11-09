import Phaser from 'phaser';
import type { Equip, HeroDef, SkillSlot, Slot } from '../data/heroes';
import type { Enemy } from './Enemy';
import { SKILLS } from './skills';
import { WEAPONS } from './weapons';
import { ART_SCALE } from './art';
import { SYNERGY_BY_ID } from './synergy';

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
  weaponImg: Phaser.GameObjects.Image;
  aimImg: Phaser.GameObjects.Image;
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
  /** recharge timer (ms) for the next charge */
  cd: Record<SkillSlot, number> = { Q: 0, E: 0, R: 0 };
  /** stored uses; most skills hold 1, some upgrade to 2 */
  charges: Record<SkillSlot, number> = { Q: 1, E: 1, R: 1 };
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
  /** 星轨 synergy window after a blink */
  trailT = 0;
  /** relic ids (遗物) */
  relics: string[] = [];
  /** boss cores needed to evolve a weapon */
  cores = 0;
  /** guaranteed crits left (tactical roll) */
  critShots = 0;
  critBonus = false;
  /** true while the current weapon attack uses a guaranteed crit */
  critNow = false;
  /** overcharge relic window after casting R */
  overT = 0;
  frostHeartCd = 0;
  twinCount = 0;
  /** animation state */
  moving = false;
  animT = 0;
  swingT = 0;
  recoilT = 0;

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
    this.aimImg = scene.add.image(x, y, 'aim').setAlpha(0.45).setDepth(3);
    this.sprite = scene.add.image(x, y, 'hero_' + hero.id).setDepth(10).setScale(ART_SCALE);
    this.weaponImg = scene.add.image(x, y, 'w_' + hero.loadout.weapon).setDepth(11).setScale(ART_SCALE);
  }

  mod(id: string) {
    return this.mods[id] ?? 0;
  }

  /** Is this weapon / skill id currently equipped? */
  owns(id: string) {
    const lo = this.loadout;
    return lo.weapon.id === id || lo.Q.id === id || lo.E.id === id || lo.R.id === id;
  }

  relic(id: string) {
    return this.relics.includes(id);
  }

  /** Is this synergy (羁绊) active? */
  syn(id: string) {
    const s = SYNERGY_BY_ID[id];
    return !!s && this.owns(s.a) && this.owns(s.b);
  }

  maxCharges(slot: SkillSlot) {
    const e = this.loadout[slot];
    return SKILLS[e.id].charges?.(e.lv) ?? 1;
  }

  /** Give back one charge (kill refunds etc.). */
  refund(slot: SkillSlot) {
    const max = this.maxCharges(slot);
    this.charges[slot] = Math.min(max, this.charges[slot] + 1);
    if (this.charges[slot] >= max) this.cd[slot] = 0;
  }

  /** Recharge one charge at a time. */
  tickCharges(dtMs: number) {
    for (const k of ['Q', 'E', 'R'] as const) {
      const max = this.maxCharges(k);
      if (this.charges[k] > max) this.charges[k] = max;
      if (this.charges[k] >= max) { this.cd[k] = 0; continue; }
      // the timer is started when a charge is spent (GameScene.tryCast); cooldown cuts just shorten it
      this.cd[k] -= dtMs;
      if (this.cd[k] <= 0) {
        this.charges[k]++;
        this.cd[k] = this.charges[k] < max ? this.cdOf(k) + this.cd[k] : 0;
      }
    }
  }

  get weapon() {
    return WEAPONS[this.loadout.weapon.id];
  }

  get atkRate() {
    const w = this.loadout.weapon;
    const lost = this.relic('berserker') ? Math.floor((1 - this.hp / this.stats.maxHp) * 10) * 0.08 : 0;
    return WEAPONS[w.id].rate(w.lv) * this.stats.atkRateMult * (this.rageT > 0 ? 1.5 : 1) * (1 + lost);
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
    return SKILLS[e.id].cd(e.lv) * (1 - Math.min(0.5, this.stats.cdr)) * (slot === 'R' && this.relic('overcharge') ? 0.7 : 1);
  }

  heal(n: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  sync(dt = 0) {
    this.animT += dt;
    this.swingT -= dt;
    this.recoilT -= dt;
    const t = this.animT;
    const left = Math.cos(this.aimAngle) < 0;
    // hop while walking, breathe while idle
    const bob = this.moving ? -Math.abs(Math.sin(t * 12)) * 3 : Math.sin(t * 3) * 0.8;
    this.sprite.setPosition(this.x, this.y + bob).setFlipX(left).setRotation(this.moving ? Math.sin(t * 12) * 0.06 : 0);

    // weapon held at the hand, pointing at the cursor
    const wdef = WEAPONS[this.loadout.weapon.id];
    const id = wdef.base ?? wdef.id;
    if (this.weaponImg.texture.key !== 'w_' + id) {
      this.weaponImg.setTexture('w_' + id);
      if (wdef.ultimate) this.weaponImg.setTint(0xffe066); else this.weaponImg.clearTint();
    }
    let rot = this.aimAngle;
    if (this.swingT > 0) rot += (left ? -1 : 1) * (1.3 - 2.6 * (1 - this.swingT / 0.15)); // melee swing arc
    const push = this.recoilT > 0 ? -4 : 0;
    const hx = this.x + (left ? -7 : 7) + Math.cos(this.aimAngle) * (6 + push);
    const hy = this.y + 7 + bob + Math.sin(this.aimAngle) * (6 + push);
    this.weaponImg.setOrigin(id === 'boomerang' ? 0.5 : 0.12, 0.5).setPosition(hx, hy).setRotation(id === 'boomerang' ? t * 10 : rot).setFlipY(left && id !== 'boomerang');
    this.weaponImg.setDepth(Math.sin(this.aimAngle) < -0.35 ? 9.5 : 11);
    this.aimImg.setPosition(this.x + Math.cos(this.aimAngle) * 36, this.y + Math.sin(this.aimAngle) * 36).setRotation(this.aimAngle);

    this.aura.setPosition(this.x, this.y).setVisible(this.rageT > 0);
    const blink = this.iframes > 0 && this.dashT <= 0 && Math.floor(this.iframes * 20) % 2 === 0;
    this.sprite.setAlpha(blink ? 0.45 : 1);
    this.weaponImg.setAlpha(blink ? 0.45 : 1);
  }

  hide() {
    this.sprite.setVisible(false);
    this.weaponImg.setVisible(false);
    this.aimImg.setVisible(false);
  }
}
