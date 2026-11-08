import Phaser from 'phaser';
import { ARENA, BOT, DEBUG, H, SPEED, TOTAL_WAVES, TOUCH, W } from '../config';
import { TouchControls } from '../ui/TouchControls';
import { Bot } from '../game/bot';
import { AFFIXES, Affix, BOSS_PHASES, ENEMIES, EnemyType, isBossType } from '../data/enemies';
import { HEROES, HeroId, SkillSlot } from '../data/heroes';
import { WAVES } from '../data/waves';
import { applyCard, Card, cardLabel, rollCards } from '../game/cards';
import { Enemy, SHIELD_ARC } from '../game/Enemy';
import { Fx } from '../game/fx';
import { Player } from '../game/Player';
import { Effect, SKILLS, updatePlayerSkills } from '../game/skills';
import { Hud } from '../ui/Hud';
import { sfx, toggleMute, unlockAudio } from '../sfx';

interface PBullet {
  img: Phaser.GameObjects.Image;
  x: number; y: number; vx: number; vy: number;
  dmg: number; r: number; pierce: number; life: number; maxLife: number; age: number;
  kb: number;
  hit: Set<Enemy>;
  /** counts as a primary-weapon hit (Lumen's passive) */
  primary: boolean;
  quiet: boolean;
  grow: boolean;
  burn?: { dps: number; t: number };
  /** seconds before a boomerang turns back; 0 = normal bullet */
  boomerang: number;
  returning: boolean;
}

export interface PBulletOpts {
  x: number; y: number; angle: number; speed: number; dmg: number; pierce: number; tex: string; life: number;
  r?: number; kb?: number; scale?: number; primary?: boolean; quiet?: boolean; grow?: boolean;
  burn?: { dps: number; t: number }; boomerang?: number;
}

interface EBullet {
  img: Phaser.GameObjects.Image;
  x: number; y: number; vx: number; vy: number;
  dmg: number; r: number; life: number;
  /** turn rate toward the player in rad/s; 0 = straight */
  homing: number;
}

interface Pickup { img: Phaser.GameObjects.Image; x: number; y: number; life: number }

export interface RunStats {
  kills: number;
  dmgDealt: number;
  dmgTaken: number;
  time: number;
  picks: string[];
}

/** Telegraphed danger zone (circle, or a beam when `a` is set); the bot steers away from these. */
export interface Hazard { x: number; y: number; r: number; t: number; a?: number; len?: number }

export interface DamageOpts {
  kbAngle?: number;
  kb?: number;
  /** big hits get hitstop + shake */
  big?: boolean;
  /** area damage ignores the shielder's frontal shield */
  aoe?: boolean;
  /** where the hit came from, for shield checks */
  from?: { x: number; y: number };
  primary?: boolean;
  /** no number / sound (flamethrower ticks) */
  quiet?: boolean;
  /** damage over time: no crit, orange numbers */
  dot?: boolean;
}

const AUTO_KEY = 'rift-autofire';

export class GameScene extends Phaser.Scene {
  player!: Player;
  heroId!: HeroId;
  enemies: Enemy[] = [];
  pBullets: PBullet[] = [];
  eBullets: EBullet[] = [];
  pickups: Pickup[] = [];
  effects: Effect[] = [];
  hazards: Hazard[] = [];
  decoy: { x: number; y: number; r: number } | null = null;
  fx!: Fx;
  hud!: Hud;
  wave = 0;
  waveTime = 0;
  spawnQueue: { at: number; type: EnemyType }[] = [];
  pendingSpawns = 0;
  waveClearT = -1;
  hitstop = 0;
  timeStopT = 0;
  timeStopBonus = false;
  over = false;
  intermission = false;
  boss: Enemy | null = null;
  bossDefeated = false;
  run!: RunStats;
  rerolls = 1;
  /** boss waves grant a second pick */
  bonusPick = false;
  godMode = false;
  autoFire = true;
  bot: Bot | null = null;
  touch: TouchControls | null = null;
  /** auto-aim target on touch screens */
  private aimTarget: Enemy | null = null;
  lastHitBy = '';
  private toAdd: Enemy[] = [];
  private seen = new Set<EnemyType>();
  private echoT = 0;
  private bars!: Phaser.GameObjects.Graphics;
  private hurtOverlay!: Phaser.GameObjects.Rectangle;
  private stopOverlay!: Phaser.GameObjects.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private whirlImg: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('Game');
  }

  // Scene instances are reused across restarts, so all run state is reset here.
  init(data: { hero: HeroId }) {
    this.heroId = data.hero ?? 'lumen';
    this.enemies = [];
    this.pBullets = [];
    this.eBullets = [];
    this.pickups = [];
    this.effects = [];
    this.hazards = [];
    this.decoy = null;
    this.toAdd = [];
    this.seen = new Set();
    this.wave = 0;
    this.spawnQueue = [];
    this.pendingSpawns = 0;
    this.waveClearT = -1;
    this.hitstop = 0;
    this.timeStopT = 0;
    this.over = false;
    this.intermission = false;
    this.boss = null;
    this.bossDefeated = false;
    this.rerolls = 1;
    this.bonusPick = false;
    this.godMode = false;
    this.whirlImg = null;
    this.bot = BOT ? new Bot() : null;
    this.run = { kills: 0, dmgDealt: 0, dmgTaken: 0, time: 0, picks: [] };
    try { this.autoFire = localStorage.getItem(AUTO_KEY) !== '0'; } catch { this.autoFire = true; }
  }

  create() {
    this.drawArena();
    this.fx = new Fx(this);
    this.player = new Player(this, HEROES[this.heroId], W / 2, H / 2);
    this.bars = this.add.graphics().setDepth(20);
    this.hurtOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(90);
    this.stopOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x4060ff, 0).setDepth(2);
    this.hud = new Hud(this);
    this.touch = TOUCH && !BOT ? new TouchControls(this) : null;

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,E,R,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      unlockAudio();
      if (ptr.rightButtonDown()) this.tryCast('Q');
    });
    kb.on('keydown-Q', () => this.tryCast('Q'));
    kb.on('keydown-SPACE', () => this.tryCast('Q'));
    kb.on('keydown-SHIFT', () => this.tryCast('Q'));
    kb.on('keydown-E', () => this.tryCast('E'));
    kb.on('keydown-R', () => this.tryCast('R'));
    kb.on('keydown-F', () => {
      this.autoFire = !this.autoFire;
      try { localStorage.setItem(AUTO_KEY, this.autoFire ? '1' : '0'); } catch { /* ignore */ }
      this.hud.setAutoFire(this.autoFire);
    });
    kb.on('keydown-M', () => this.hud.setMuted(toggleMute()));
    kb.on('keydown-ESC', () => this.openPause());
    kb.on('keydown-P', () => this.openPause());
    if (DEBUG) {
      kb.on('keydown-N', () => this.enemies.forEach((e) => this.damage(e, 99999, { aoe: true })));
      kb.on('keydown-I', () => (this.godMode = !this.godMode));
    }
    (window as unknown as { __game: GameScene }).__game = this;

    this.events.on('resume', () => { this.input.keyboard?.resetKeys(); this.touch?.release(); });
    this.time.timeScale = SPEED;
    this.tweens.timeScale = SPEED;
    this.time.delayedCall(600, () => this.startWave(1));
  }

  private drawArena() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x0b0d16).fillRect(0, 0, W, H);
    g.fillStyle(0x121626).fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    g.lineStyle(1, 0x1c2238, 1);
    for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 40) g.lineBetween(x, ARENA.y, x, ARENA.y + ARENA.h);
    for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += 40) g.lineBetween(ARENA.x, y, ARENA.x + ARENA.w, y);
    g.lineStyle(2, 0x3a2b5a, 0.8).strokeCircle(W / 2, H / 2, 200);
    g.lineStyle(1, 0x3a2b5a, 0.5).strokeCircle(W / 2, H / 2, 120);
    g.lineStyle(3, 0x6a4cff, 0.8).strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  }

  // ---------------------------------------------------------------- waves

  startWave(n: number) {
    this.wave = n;
    this.waveTime = 0;
    this.waveClearT = -1;
    this.spawnQueue = [];
    this.bossDefeated = false;
    for (const grp of WAVES[n - 1]) {
      for (let i = 0; i < grp.count; i++) this.spawnQueue.push({ at: grp.delay + i * grp.interval, type: grp.type });
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    const boss = WAVES[n - 1].find((g) => isBossType(g.type));
    if (boss) this.hud.banner(`${n === TOTAL_WAVES ? '最终首领' : '首领'} · ${ENEMIES[boss.type].name}`, '#ff5577');
    else this.hud.banner(`第 ${n} 波`, '#ffffff');
  }

  /** Spawn with a short telegraph so enemies never appear on top of the player unannounced. */
  queueSpawn(type: EnemyType, x?: number, y?: number) {
    const p = this.player;
    if (x === undefined || y === undefined) {
      for (let tries = 0; tries < 20; tries++) {
        const side = Phaser.Math.Between(0, 3);
        x = side === 0 ? ARENA.x + 30 : side === 1 ? ARENA.x + ARENA.w - 30 : Phaser.Math.Between(ARENA.x + 30, ARENA.x + ARENA.w - 30);
        y = side === 2 ? ARENA.y + 30 : side === 3 ? ARENA.y + ARENA.h - 30 : Phaser.Math.Between(ARENA.y + 30, ARENA.y + ARENA.h - 30);
        if (Math.hypot(x - p.x, y - p.y) > 260) break;
      }
    }
    const r = ENEMIES[type].r;
    const sx = Phaser.Math.Clamp(x!, ARENA.x + r, ARENA.x + ARENA.w - r);
    const sy = Phaser.Math.Clamp(y!, ARENA.y + r, ARENA.y + ARENA.h - r);
    const big = isBossType(type) || type === 'elite';
    const ms = big ? 1200 : 650;
    this.pendingSpawns++;
    this.fx.telegraphCircle(sx, sy, r + 6, ms, ENEMIES[type].color);
    sfx('spawn');
    this.time.delayedCall(ms, () => {
      this.pendingSpawns--;
      if (this.over || (this.bossDefeated && !isBossType(type))) return;
      const affix = type === 'elite' ? (Phaser.Utils.Array.GetRandom(Object.keys(AFFIXES)) as Affix) : null;
      const e = new Enemy(this, type, sx, sy, this.wave, affix);
      this.enemies.push(e);
      if (!this.seen.has(type)) {
        this.seen.add(type);
        if (ENEMIES[type].hint && type !== 'elite') this.hud.hint(ENEMIES[type].name, ENEMIES[type].hint, ENEMIES[type].color);
      }
      if (isBossType(type)) {
        this.boss = e;
        this.shake(400, 0.012);
        this.hud.showBoss(e);
      } else if (type === 'elite') {
        this.hud.hint(`精英 · ${AFFIXES[affix!]}`, AFFIX_HINT[affix!], ENEMIES.elite.color);
      }
    });
  }

  private updateWave(dtMs: number) {
    this.waveTime += dtMs;
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime) this.queueSpawn(this.spawnQueue.shift()!.type);

    if (this.waveClearT < 0 && !this.spawnQueue.length && this.pendingSpawns === 0 && this.enemies.length === 0) {
      this.waveClearT = 900;
      if (this.wave < TOTAL_WAVES) this.hud.banner('波次清除', '#7bff9e');
    }
    if (this.waveClearT >= 0) {
      this.waveClearT -= dtMs;
      if (this.waveClearT < 0) {
        if (this.wave >= TOTAL_WAVES) this.endRun(true);
        else this.openUpgrades();
      }
    }
  }

  private openUpgrades(heal = true) {
    this.intermission = true;
    const p = this.player;
    if (heal) p.heal(Math.round(p.stats.maxHp * 0.2));
    this.eBullets.forEach((b) => b.img.destroy());
    this.eBullets = [];
    this.scene.pause();
    this.scene.launch('Upgrade', {
      wave: this.wave,
      player: p,
      cards: rollCards(p),
      rerolls: this.rerolls,
      reroll: () => {
        this.rerolls--;
        return rollCards(p);
      },
      bonus: this.bonusPick,
      onPick: (c: Card) => {
        this.run.picks.push(cardLabel(c, p));
        applyCard(c, p);
        this.hud.refreshLoadout();
        if (this.bonusPick) {
          // boss reward: a second pick right away
          this.bonusPick = false;
          // the game scene is paused here, so use a real timer; the Upgrade scene needs a tick to shut down first
          window.setTimeout(() => this.openUpgrades(false), 50);
          return;
        }
        this.intermission = false;
        this.scene.resume();
        this.startWave(this.wave + 1);
      },
    });
  }

  openPause() {
    if (this.over || this.intermission) return;
    this.scene.pause();
    this.scene.launch('Pause', { player: this.player });
  }

  private endRun(win: boolean) {
    if (this.over) return;
    this.over = true;
    sfx(win ? 'win' : 'lose');
    const lo = this.player.loadout;
    const result = {
      hero: this.heroId, win, wave: this.wave, time: Math.round(this.run.time), hp: Math.round(this.player.hp), kills: this.run.kills,
      by: win ? '' : this.lastHitBy, taken: this.run.dmgTaken,
      loadout: `${lo.weapon.id}${lo.weapon.lv} ${lo.Q.id}${lo.Q.lv} ${lo.E.id}${lo.E.lv} ${lo.R.id}${lo.R.lv}`,
      picks: this.run.picks.join(','),
    };
    const w = window as unknown as { __runs?: object[] };
    (w.__runs ??= []).push(result);
    console.log('[run]', JSON.stringify(result));
    if (!win) {
      this.fx.burst(this.player.x, this.player.y, this.player.hero.color, 40, 300);
      this.player.hide();
    }
    this.time.delayedCall(win ? 600 : 1200, () => {
      this.scene.start('End', { win, hero: this.heroId, wave: this.wave, run: this.run, mods: this.player.mods, loadout: this.player.loadout });
    });
  }

  // ---------------------------------------------------------------- spawning

  spawnPBullet(o: PBulletOpts) {
    const img = this.add.image(o.x, o.y, o.tex).setRotation(o.angle).setDepth(7).setScale(o.scale ?? 1);
    this.pBullets.push({
      img, x: o.x, y: o.y, vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed,
      dmg: o.dmg, r: o.r ?? 7, pierce: o.pierce, life: o.life, maxLife: o.life, age: 0, kb: o.kb ?? 90, hit: new Set(),
      primary: o.primary ?? true, quiet: o.quiet ?? false, grow: o.grow ?? false, burn: o.burn,
      boomerang: o.boomerang ?? 0, returning: false,
    });
  }

  spawnEBullet(x: number, y: number, angle: number, speed: number, dmg: number, homing = 0) {
    const img = this.add.image(x, y, homing ? 'orb' : 'ebullet').setDepth(7);
    this.eBullets.push({ img, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg, r: homing ? 9 : 6, life: homing ? 6 : 5, homing });
  }

  /** Telegraphed circle that hurts the player if they are still inside when it lands. */
  delayedHit(x: number, y: number, r: number, ms: number, dmg: number, src: string, color: number) {
    this.fx.telegraphCircle(x, y, r, ms, color);
    this.hazards.push({ x, y, r, t: ms / 1000 });
    this.time.delayedCall(ms, () => {
      if (this.over) return;
      this.fx.ring(x, y, r, color, 300, 0.45);
      this.fx.burst(x, y, color, 14, 240);
      this.shake(80, 0.004);
      const p = this.player;
      if (Math.hypot(p.x - x, p.y - y) < r + p.r * 0.5) this.hurtPlayer(dmg, src);
    });
  }

  /** Telegraphed beam from (x, y); hurts the player if they stand on the line when it fires. */
  beamHit(x: number, y: number, angle: number, len: number, width: number, ms: number, dmg: number, src: string) {
    this.fx.telegraphLine(x, y, angle, len, width, ms);
    this.hazards.push({ x, y, r: width / 2, t: ms / 1000, a: angle, len });
    this.time.delayedCall(ms, () => {
      if (this.over) return;
      const g = this.add.graphics().setDepth(8);
      const ex = x + Math.cos(angle) * len;
      const ey = y + Math.sin(angle) * len;
      g.lineStyle(width, 0xd9a8ff, 0.5).lineBetween(x, y, ex, ey);
      g.lineStyle(width * 0.35, 0xffffff, 1).lineBetween(x, y, ex, ey);
      this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
      const p = this.player;
      const rx = p.x - x;
      const ry = p.y - y;
      const along = rx * Math.cos(angle) + ry * Math.sin(angle);
      const across = Math.abs(-rx * Math.sin(angle) + ry * Math.cos(angle));
      if (along > 0 && along < len && across < width / 2 + p.r * 0.5) this.hurtPlayer(dmg, src);
    });
  }

  spawnWhirl(p: Player) {
    this.whirlImg?.destroy();
    const r = 115 * p.stats.areaMult;
    this.whirlImg = this.add.image(p.x, p.y, 'ring').setTint(p.hero.color).setAlpha(0.7).setDepth(8).setScale((r * 2) / 128);
  }

  addEffect(f: Effect) {
    this.effects.push(f);
  }

  startTimeStop(dur: number, bonus: boolean) {
    this.timeStopT = dur;
    this.timeStopBonus = bonus;
    this.stopOverlay.setAlpha(0.16);
    this.fx.ring(this.player.x, this.player.y, 700, 0x8fa8ff, 600, 0.15);
    this.hud.banner('时间凝滞', '#a8c0ff');
  }

  // ---------------------------------------------------------------- combat

  enemiesInRadius(x: number, y: number, r: number) {
    return this.enemies.filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.r);
  }

  /** Enemies chase the decoy while one exists. */
  targetPos(): { x: number; y: number } {
    return this.decoy ?? this.player;
  }

  /** True if a hit from (x, y) lands on a shielder's shield. */
  shieldBlocks(e: Enemy, x: number, y: number) {
    if (e.type !== 'shielder' || e.freezeT > 0) return false;
    return Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - e.y, x - e.x) - e.facing)) < SHIELD_ARC;
  }

  /** Applies player damage modifiers. Returns true if the enemy died. */
  damage(e: Enemy, base: number, o: DamageOpts): boolean {
    if (e.dead) return false;
    const p = this.player;
    const blocked = !o.aoe && !!o.from && this.shieldBlocks(e, o.from.x, o.from.y);
    const crit = !o.dot && Math.random() < p.stats.critChance;
    let dmg = base * p.stats.dmgMult * (crit ? p.stats.critMult : 1);
    if (p.desperate) dmg *= 1.4;
    if (this.timeStopT > 0 && this.timeStopBonus) dmg *= 1.3;
    if (blocked) dmg *= 0.2;
    dmg = Math.max(1, Math.round(dmg * Phaser.Math.FloatBetween(0.92, 1.08)));

    let toHp = dmg;
    if (e.ward > 0) {
      const a = Math.min(e.ward, toHp);
      e.ward -= a;
      toHp -= a;
    }
    if (e.wardMax) e.wardRegenT = 4;
    const dealt = Math.min(toHp, e.hp);
    e.hp -= toHp;
    e.flashT = 0.07;
    this.run.dmgDealt += dmg;
    const ls = p.stats.lifesteal + (p.rageT > 0 ? 0.15 : 0);
    if (ls > 0) p.heal(dealt * ls);
    if (o.kb && o.kbAngle !== undefined && !blocked) e.knock(o.kbAngle, o.kb);
    if (o.primary && p.hero.id === 'lumen' && this.echoT <= 0) {
      this.echoT = 0.08;
      p.cd.Q = Math.max(0, p.cd.Q - 100);
      p.cd.E = Math.max(0, p.cd.E - 100);
    }
    if (!o.quiet) {
      this.fx.number(e.x, e.y - e.r, dmg, crit, blocked ? '#8fb8ff' : o.dot ? '#ffa060' : '#ffffff');
      if (!o.dot) sfx(blocked ? 'block' : crit ? 'crit' : 'hit');
    }
    if (o.big || (crit && dmg > 60)) this.hitstop = Math.max(this.hitstop, 0.045);

    if (e.hp <= 0) {
      this.killEnemy(e);
      return true;
    }
    return false;
  }

  private killEnemy(e: Enemy, suicide = false) {
    e.destroy();
    if (!suicide) this.run.kills++;
    const big = e.type === 'elite' || e.isBoss || e.type === 'brute';
    this.fx.burst(e.x, e.y, e.def.color, big ? 30 : 12, big ? 320 : 200);
    if (big) {
      this.fx.ring(e.x, e.y, e.r * 2.5, e.def.color, 400);
      this.shake(e.isBoss ? 600 : 160, e.isBoss ? 0.02 : 0.008);
      this.hitstop = Math.max(this.hitstop, e.isBoss ? 0.25 : 0.08);
    }
    if (!suicide) sfx('kill');

    if (e.type === 'slime') {
      for (let k = 0; k < 2; k++) {
        const m = new Enemy(this, 'mini', e.x + (k ? 10 : -10), e.y, this.wave);
        m.knock(Math.random() * Math.PI * 2, 160);
        this.toAdd.push(m);
      }
    }
    if (e.affix === 'splitting') {
      for (let k = 0; k < 3; k++) this.toAdd.push(new Enemy(this, 'runner', e.x + Phaser.Math.Between(-30, 30), e.y + Phaser.Math.Between(-30, 30), this.wave));
    }
    if (e.type === 'bomber' && !suicide) this.bomberBlast(e, false);

    if (!suicide && Math.random() < e.def.drop) {
      this.pickups.push({ img: this.add.image(e.x, e.y, 'heart').setDepth(4), x: e.x, y: e.y, life: 12 });
    }
    if (e === this.boss) {
      this.boss = null;
      this.bossDefeated = true;
      if (this.wave < TOTAL_WAVES) {
        this.bonusPick = true;
        this.hud.banner(`击败 ${e.def.name}！额外强化 +1`, '#ffd34a');
      }
      this.hud.hideBoss();
      // the boss takes its summons with it
      [...this.enemies, ...this.toAdd].forEach((o) => { if (!o.dead) { this.fx.burst(o.x, o.y, o.def.color, 8); o.destroy(); } });
      this.toAdd = [];
      this.spawnQueue = [];
    }
  }

  /** Bomber explosion. Armed = it reached the player and blew itself up. */
  bomberBlast(e: Enemy, armed: boolean) {
    const r = 85;
    this.fx.ring(e.x, e.y, r, 0xff5a2a, 320, 0.45);
    this.fx.burst(e.x, e.y, 0xffa040, 20, 300);
    this.shake(120, 0.006);
    sfx('boom');
    if (armed) {
      const p = this.player;
      if (Math.hypot(p.x - e.x, p.y - e.y) < r + p.r) this.hurtPlayer(26, 'bomber');
      e.hp = 0;
      this.killEnemy(e, true);
    }
    for (const o of this.enemiesInRadius(e.x, e.y, r)) {
      if (o !== e) this.damage(o, 35, { aoe: true, kbAngle: Math.atan2(o.y - e.y, o.x - e.x), kb: 220 });
    }
  }

  priestHeal(pr: Enemy) {
    this.fx.ring(pr.x, pr.y, 220, 0x3fe0c0, 400, 0.08);
    for (const e of this.enemiesInRadius(pr.x, pr.y, 220)) {
      if (e.isBoss || e.hp >= e.maxHp) continue;
      const amt = Math.round(e.maxHp * 0.08);
      e.hp = Math.min(e.maxHp, e.hp + amt);
      if (e !== pr) this.fx.beam(pr.x, pr.y, e.x, e.y, 0x3fe0c0);
      this.fx.text(e.x, e.y - e.r, `+${amt}`, '#3fe0c0');
    }
    sfx('heal');
  }

  hurtPlayer(amount: number, src: string) {
    this.lastHitBy = src;
    const p = this.player;
    if (p.iframes > 0 || this.over || this.godMode) return;
    let mult = 1 - Math.min(0.6, p.stats.armor);
    if (p.desperate) mult *= 0.85;
    if (p.rageT > 0 && p.rageArmor) mult *= 0.7;
    const dmg = Math.max(1, Math.round(amount * mult));
    p.hp -= dmg;
    p.iframes = 0.6;
    this.run.dmgTaken += dmg;
    this.shake(120, 0.008);
    this.hurtOverlay.setAlpha(0.25);
    this.tweens.add({ targets: this.hurtOverlay, alpha: 0, duration: 250 });
    this.fx.number(p.x, p.y - 20, dmg, false, '#ff7070');
    sfx('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun(false);
    }
  }

  onBossPhase(e: Enemy, ph: number) {
    const last = ph === BOSS_PHASES[e.type]!.length + 1;
    this.hud.banner(`${e.def.name} · ${last ? '狂暴' : '第二阶段'}`, '#ff5577');
    this.fx.ring(e.x, e.y, 260, 0xff3355, 500, 0.3);
    this.shake(300, 0.01);
    // clear space so the phase change reads clearly
    const p = this.player;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < 220) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      p.x += Math.cos(a) * (220 - d);
      p.y += Math.sin(a) * (220 - d);
      this.clampToArena(p);
    }
    e.fireT = 1;
  }

  tryCast(slot: SkillSlot) {
    unlockAudio();
    if (this.over || this.intermission || this.scene.isPaused()) return;
    const p = this.player;
    if (p.cd[slot] > 0) {
      sfx('deny');
      return;
    }
    const eq = p.loadout[slot];
    p.cd[slot] = p.cdOf(slot);
    SKILLS[eq.id].cast(this, p, eq.lv);
    this.hud.pulse(slot);
  }

  // ---------------------------------------------------------------- helpers

  clampToArena(o: { x: number; y: number; r: number }) {
    o.x = Phaser.Math.Clamp(o.x, ARENA.x + o.r, ARENA.x + ARENA.w - o.r);
    o.y = Phaser.Math.Clamp(o.y, ARENA.y + o.r, ARENA.y + ARENA.h - o.r);
  }

  moveDir(): { x: number; y: number } | null {
    if (this.bot) return this.bot.move;
    if (this.touch?.move) return this.touch.move;
    const k = this.keys;
    const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (!x && !y) return null;
    const l = Math.hypot(x, y);
    return { x: x / l, y: y / l };
  }

  shake(ms: number, intensity: number) {
    this.cameras.main.shake(ms, intensity);
  }

  /** Where the cursor (or the bot's target) is, for targeted abilities. */
  aimPoint() {
    const t = this.bot ? this.bot.target : this.touch ? this.aimTarget : null;
    if (t && !t.dead) return { x: t.x, y: t.y };
    if (this.touch) {
      const p = this.player;
      return { x: p.x + Math.cos(p.aimAngle) * 200, y: p.y + Math.sin(p.aimAngle) * 200 };
    }
    const ptr = this.input.activePointer;
    return { x: Phaser.Math.Clamp(ptr.worldX, ARENA.x, ARENA.x + ARENA.w), y: Phaser.Math.Clamp(ptr.worldY, ARENA.y, ARENA.y + ARENA.h) };
  }

  // ---------------------------------------------------------------- frame

  update(_t: number, delta: number) {
    if (this.over) {
      this.hud.update();
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= delta / 1000;
      return;
    }
    for (let i = 0; i < SPEED && !this.over && !this.intermission; i++) this.step(Math.min(delta, 50));
    this.drawBars();
    this.hud.update();
    this.touch?.update();
  }

  private step(dtMs: number) {
    const dt = dtMs / 1000;
    this.run.time += dt;
    this.echoT -= dt;
    if (this.hazards.length) this.hazards = this.hazards.filter((h) => (h.t -= dt) > 0);
    this.bot?.update(this, dt);
    this.updatePlayer(dt);
    this.effects = this.effects.filter((f) => {
      const alive = f.update(this, dt);
      if (!alive) {
        f.destroy();
        if ((f as unknown) === this.decoy) this.decoy = null;
      }
      return alive;
    });

    const stopped = this.timeStopT > 0;
    if (stopped) {
      this.timeStopT -= dt;
      if (this.timeStopT <= 0) this.stopOverlay.setAlpha(0);
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (stopped) {
        e.flashT -= dt;
        e.sync();
        if (e.flashT <= 0) e.img.setTint(0x8899cc);
      } else {
        e.update(this, dt);
      }
    }
    this.updateBurns(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.toAdd.length) {
      this.enemies.push(...this.toAdd.filter((e) => !e.dead));
      this.toAdd = [];
    }
    this.updateWave(dtMs);
    this.separate(stopped);
    this.updateBullets(dt, stopped);
    this.updatePickups(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const ptr = this.input.activePointer;
    if (this.bot) p.aimAngle = this.bot.aim;
    else if (this.touch) this.autoAim(p);
    else p.aimAngle = Math.atan2(ptr.worldY - p.y, ptr.worldX - p.x);
    p.iframes -= dt;
    p.rageT -= dt;
    for (const k of ['Q', 'E', 'R'] as const) p.cd[k] = Math.max(0, p.cd[k] - dt * 1000);
    if (p.stats.regen) p.heal(p.stats.regen * dt);

    p.moving = false;
    if (p.dashT <= 0) {
      const mv = this.moveDir();
      p.moving = !!mv;
      if (mv) {
        const spd = p.speed * (p.whirlT > 0 ? 0.85 : 1);
        p.x += mv.x * spd * dt;
        p.y += mv.y * spd * dt;
        this.clampToArena(p);
      }
    }
    updatePlayerSkills(this, p, dt);

    // primary weapon fires on its own toward the cursor; holding the left button also fires
    p.atkTimer -= dt;
    const firing = this.bot ? this.bot.fire : this.touch ? this.enemies.length > 0 : ptr.leftButtonDown() || (this.autoFire && this.enemies.length > 0);
    if (firing && p.atkTimer <= 0 && p.dashT <= 0) {
      p.atkTimer = 1 / p.atkRate;
      p.weapon.fire(this, p, p.loadout.weapon.lv);
      if (p.loadout.weapon.id === 'slash') p.swingT = 0.15;
      else p.recoilT = 0.06;
    }

    if (this.whirlImg) {
      if (p.whirlT > 0) this.whirlImg.setPosition(p.x, p.y).setRotation(this.whirlImg.rotation + dt * 18);
      else { this.whirlImg.destroy(); this.whirlImg = null; }
    }
    p.sync(dt);
  }

  /** Touch screens: aim at the nearest enemy, otherwise where we're walking. */
  private autoAim(p: Player) {
    let best = Infinity;
    this.aimTarget = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) - (e.isBoss ? 120 : 0);
      if (d < best) { best = d; this.aimTarget = e; }
    }
    const t = this.aimTarget;
    if (t) p.aimAngle = Math.atan2(t.y - p.y, t.x - p.x);
    else if (this.touch?.move) p.aimAngle = Math.atan2(this.touch.move.y, this.touch.move.x);
  }

  private updateBurns(dt: number) {
    for (const e of this.enemies) {
      if (e.dead || e.burnT <= 0) continue;
      e.burnT -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        this.damage(e, e.burnDps * 0.5, { dot: true, aoe: true });
      }
      if (e.burnT <= 0) e.burnDps = 0;
    }
  }

  /** Cheap pairwise push so crowds spread out instead of stacking. */
  private separate(stopped: boolean) {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const wa = a.isBoss ? 0 : b.isBoss ? 1 : 0.5;
        a.x -= (dx / d) * push * 2 * wa;
        a.y -= (dy / d) * push * 2 * wa;
        b.x += (dx / d) * push * 2 * (1 - wa);
        b.y += (dy / d) * push * 2 * (1 - wa);
      }
    }
    if (stopped) return;
    // contact damage
    const p = this.player;
    for (const e of es) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r - 2 && e.hitCd <= 0 && p.dashT <= 0) {
        const charging = e.state === 'charge';
        this.hurtPlayer(e.def.dmg * (charging ? 1.4 : 1), e.type + (charging ? '-charge' : ''));
        e.hitCd = 0.5;
      }
    }
  }

  private updateBullets(dt: number, stopped: boolean) {
    const p = this.player;
    for (const b of this.pBullets) {
      b.age += dt;
      b.life -= dt;
      const outside = b.x < ARENA.x || b.x > ARENA.x + ARENA.w || b.y < ARENA.y || b.y > ARENA.y + ARENA.h;
      if (b.boomerang) {
        if (!b.returning && (b.age > b.boomerang || outside)) {
          b.returning = true;
          b.hit.clear();
        }
        if (b.returning) {
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          b.vx = ((p.x - b.x) / d) * 720;
          b.vy = ((p.y - b.y) / d) * 720;
          if (d < 24) b.life = -1;
        }
        b.img.rotation += dt * 22;
      }
      const px = b.x;
      const py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.img.setPosition(b.x, b.y);
      if (b.grow) b.img.setScale(0.5 + (b.age / b.maxLife) * 1.4).setAlpha(1 - (b.age / b.maxLife) * 0.6);
      for (const e of this.enemies) {
        if (e.dead || b.hit.has(e) || b.pierce <= 0) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) >= e.r + b.r) continue;
        b.hit.add(e);
        if (this.shieldBlocks(e, px, py)) {
          // the shield stops the projectile; damage() applies the 80% reduction
          this.fx.burst(b.x, b.y, 0xbfe0ff, 4, 140);
          this.damage(e, b.dmg, { from: { x: px, y: py }, primary: b.primary, quiet: b.quiet });
          if (b.boomerang) { b.returning = true; b.hit.clear(); b.hit.add(e); } else b.pierce = 0;
          continue;
        }
        b.pierce--;
        this.damage(e, b.dmg, { kbAngle: Math.atan2(b.vy, b.vx), kb: b.kb, from: { x: px, y: py }, primary: b.primary, quiet: b.quiet });
        if (b.burn && !e.dead) {
          e.burnT = b.burn.t;
          e.burnDps = Math.max(e.burnDps, b.burn.dps);
        }
        if (!b.quiet) this.fx.burst(b.x, b.y, 0xffffff, 3, 120);
      }
      if (b.pierce <= 0 || b.life <= 0 || (outside && !b.boomerang)) {
        b.life = -1;
        b.img.destroy();
      }
    }
    this.pBullets = this.pBullets.filter((b) => b.life > 0);

    for (const b of this.eBullets) {
      if (stopped) {
        b.img.setTint(0x8899cc);
        continue;
      }
      b.img.clearTint();
      if (b.homing) {
        const want = Math.atan2(p.y - b.y, p.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const a = cur + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - cur), -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
        b.img.rotation += dt * 6;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.img.setPosition(b.x, b.y);
      if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r - 2 && p.iframes <= 0) {
        this.hurtPlayer(b.dmg, 'bullet');
        b.life = -1;
      }
      if (b.life <= 0 || b.x < ARENA.x - 20 || b.x > ARENA.x + ARENA.w + 20 || b.y < ARENA.y - 20 || b.y > ARENA.y + ARENA.h + 20) {
        b.life = -1;
        b.img.destroy();
      }
    }
    this.eBullets = this.eBullets.filter((b) => b.life > 0);
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const k of this.pickups) {
      k.life -= dt;
      const d = Math.hypot(p.x - k.x, p.y - k.y);
      if (d < 110) {
        // magnet toward the player
        k.x += ((p.x - k.x) / d) * 420 * dt;
        k.y += ((p.y - k.y) / d) * 420 * dt;
      }
      k.img.setPosition(k.x, k.y).setAlpha(k.life < 3 ? (Math.floor(k.life * 6) % 2 ? 0.3 : 1) : 1);
      if (d < p.r + 10) {
        const amt = Math.round(p.stats.maxHp * 0.12);
        p.heal(amt);
        this.fx.text(p.x, p.y, `+${amt}`);
        sfx('heal');
        k.life = -1;
      }
      if (k.life <= 0) k.img.destroy();
    }
    this.pickups = this.pickups.filter((k) => k.life > 0);
  }

  private drawBars() {
    const g = this.bars;
    g.clear();
    for (const e of this.enemies) {
      if (e.isBoss) continue;
      const hurt = e.hp < e.maxHp;
      if (!hurt && !e.wardMax) continue;
      const w = e.r * 2;
      const x = e.x - e.r;
      const y = e.y - e.r - 9;
      g.fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, w + 2, 6);
      g.fillStyle(e.type === 'elite' ? 0xff4fd8 : 0xff5050).fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
      if (e.wardMax && e.ward > 0) g.fillStyle(0x8fd0ff).fillRect(x, y - 4, w * (e.ward / e.wardMax), 3);
    }
  }
}

const AFFIX_HINT: Record<Affix, string> = {
  swift: '移动速度提高 50%',
  warded: '带有会再生的护盾（蓝条），持续压制才能打穿',
  splitting: '死亡时分裂出 3 只疾行者',
  enraged: '生命低于一半后攻击频率翻倍',
};
