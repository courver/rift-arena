import Phaser from 'phaser';
import { ARENA, BOT, DEBUG, H, SPEED, TOTAL_WAVES, W } from '../config';
import { Bot } from '../game/bot';
import { ENEMIES, EnemyType } from '../data/enemies';
import { HEROES, HeroId } from '../data/heroes';
import { applyUpgrade, rollUpgrades, Upgrade } from '../data/upgrades';
import { WAVES } from '../data/waves';
import { Enemy } from '../game/Enemy';
import { Fx } from '../game/fx';
import { cast, primary, updateKit } from '../game/kits';
import { Player } from '../game/Player';
import { Hud } from '../ui/Hud';
import { sfx, toggleMute, unlockAudio } from '../sfx';

interface PBullet {
  img: Phaser.GameObjects.Image;
  x: number; y: number; vx: number; vy: number;
  dmg: number; r: number; pierce: number; life: number;
  hit: Set<Enemy>;
}

interface EBullet {
  img: Phaser.GameObjects.Image;
  x: number; y: number; vx: number; vy: number;
  dmg: number; r: number; life: number;
}

interface Pickup { img: Phaser.GameObjects.Image; x: number; y: number; life: number }

export interface RunStats {
  kills: number;
  dmgDealt: number;
  dmgTaken: number;
  time: number;
  picks: string[];
}

export interface DamageOpts {
  kbAngle?: number;
  kb?: number;
  /** big hits get hitstop + shake */
  big?: boolean;
}

export class GameScene extends Phaser.Scene {
  player!: Player;
  heroId!: HeroId;
  enemies: Enemy[] = [];
  pBullets: PBullet[] = [];
  eBullets: EBullet[] = [];
  pickups: Pickup[] = [];
  fx!: Fx;
  hud!: Hud;
  wave = 0;
  waveTime = 0;
  spawnQueue: { at: number; type: EnemyType }[] = [];
  pendingSpawns = 0;
  waveClearT = -1;
  hitstop = 0;
  over = false;
  intermission = false;
  boss: Enemy | null = null;
  bossDefeated = false;
  run!: RunStats;
  rerolls = 1;
  godMode = false;
  bot: Bot | null = null;
  lastHitBy = '';
  private bars!: Phaser.GameObjects.Graphics;
  private hurtOverlay!: Phaser.GameObjects.Rectangle;
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
    this.wave = 0;
    this.spawnQueue = [];
    this.pendingSpawns = 0;
    this.waveClearT = -1;
    this.hitstop = 0;
    this.over = false;
    this.intermission = false;
    this.boss = null;
    this.bossDefeated = false;
    this.rerolls = 1;
    this.godMode = false;
    this.whirlImg = null;
    this.bot = BOT ? new Bot() : null;
    this.run = { kills: 0, dmgDealt: 0, dmgTaken: 0, time: 0, picks: [] };
  }

  create() {
    this.drawArena();
    this.fx = new Fx(this);
    this.player = new Player(this, HEROES[this.heroId], W / 2, H / 2);
    this.bars = this.add.graphics().setDepth(20);
    this.hurtOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(90);
    this.hud = new Hud(this);

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
    kb.on('keydown-M', () => this.hud.setMuted(toggleMute()));
    kb.on('keydown-ESC', () => this.openPause());
    kb.on('keydown-P', () => this.openPause());
    if (DEBUG) {
      kb.on('keydown-N', () => this.enemies.forEach((e) => this.damage(e, 99999, {})));
      kb.on('keydown-I', () => (this.godMode = !this.godMode));
    }
    (window as unknown as { __game: GameScene }).__game = this;

    this.events.on('resume', () => this.input.keyboard?.resetKeys());
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
    for (const grp of WAVES[n - 1]) {
      for (let i = 0; i < grp.count; i++) this.spawnQueue.push({ at: grp.delay + i * grp.interval, type: grp.type });
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.hud.banner(n === TOTAL_WAVES ? '最终波 · 裂隙之主' : `第 ${n} 波`, n === TOTAL_WAVES ? '#ff5577' : '#ffffff');
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
    const big = type === 'boss' || type === 'elite';
    const ms = big ? 1200 : 650;
    this.pendingSpawns++;
    this.fx.telegraphCircle(sx, sy, r + 6, ms, ENEMIES[type].color);
    sfx('spawn');
    this.time.delayedCall(ms, () => {
      this.pendingSpawns--;
      if (this.over || (this.bossDefeated && type !== 'boss')) return;
      const e = new Enemy(this, type, sx, sy, this.wave);
      this.enemies.push(e);
      if (type === 'boss') {
        this.boss = e;
        this.shake(400, 0.012);
        this.hud.showBoss(e);
      } else if (type === 'elite') {
        this.fx.text(sx, sy - 30, '精英出现！', '#ff7be8');
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

  private openUpgrades() {
    this.intermission = true;
    const p = this.player;
    p.heal(Math.round(p.stats.maxHp * 0.2));
    this.eBullets.forEach((b) => b.img.destroy());
    this.eBullets = [];
    this.scene.pause();
    this.scene.launch('Upgrade', {
      wave: this.wave,
      choices: rollUpgrades(p),
      rerolls: this.rerolls,
      reroll: () => {
        this.rerolls--;
        return rollUpgrades(p);
      },
      onPick: (u: Upgrade) => {
        applyUpgrade(p, u);
        this.run.picks.push(u.id);
        this.intermission = false;
        this.scene.resume();
        this.startWave(this.wave + 1);
      },
    });
  }

  private openPause() {
    if (this.over || this.intermission) return;
    this.scene.pause();
    this.scene.launch('Pause', { player: this.player });
  }

  private endRun(win: boolean) {
    if (this.over) return;
    this.over = true;
    sfx(win ? 'win' : 'lose');
    const result = { hero: this.heroId, win, wave: this.wave, time: Math.round(this.run.time), hp: Math.round(this.player.hp), kills: this.run.kills, by: win ? '' : this.lastHitBy, taken: this.run.dmgTaken, picks: this.run.picks.join(',') };
    const w = window as unknown as { __runs?: object[] };
    (w.__runs ??= []).push(result);
    console.log('[run]', JSON.stringify(result));
    if (!win) {
      this.fx.burst(this.player.x, this.player.y, this.player.hero.color, 40, 300);
      this.player.sprite.setVisible(false);
    }
    this.time.delayedCall(win ? 600 : 1200, () => {
      this.scene.start('End', { win, hero: this.heroId, wave: this.wave, run: this.run, mods: this.player.mods });
    });
  }

  // ---------------------------------------------------------------- spawning projectiles

  spawnPBullet(x: number, y: number, angle: number, speed: number, dmg: number, pierce: number, tex: string, life: number) {
    const img = this.add.image(x, y, tex).setRotation(angle).setDepth(7);
    this.pBullets.push({
      img, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      dmg, r: tex === 'wave' ? 22 : 7, pierce, life, hit: new Set(),
    });
  }

  spawnEBullet(x: number, y: number, angle: number, speed: number, dmg: number) {
    const img = this.add.image(x, y, 'ebullet').setDepth(7);
    this.eBullets.push({ img, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg, r: 6, life: 5 });
  }

  spawnWhirl(p: Player) {
    this.whirlImg?.destroy();
    const r = 115 * p.stats.areaMult;
    this.whirlImg = this.add.image(p.x, p.y, 'ring').setTint(p.hero.color).setAlpha(0.7).setDepth(8).setScale((r * 2) / 128);
  }

  // ---------------------------------------------------------------- combat

  enemiesInRadius(x: number, y: number, r: number) {
    return this.enemies.filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.r);
  }

  /** Applies player damage modifiers. Returns true if the enemy died. */
  damage(e: Enemy, base: number, o: DamageOpts): boolean {
    if (e.dead) return false;
    const p = this.player;
    const crit = Math.random() < p.stats.critChance;
    let dmg = base * p.stats.dmgMult * (crit ? p.stats.critMult : 1);
    if (p.mod('undying') && p.hp < p.stats.maxHp * 0.35) dmg *= 1.4;
    dmg = Math.round(dmg * Phaser.Math.FloatBetween(0.92, 1.08));
    const dealt = Math.min(dmg, e.hp);
    e.hp -= dmg;
    e.flashT = 0.07;
    this.run.dmgDealt += dealt;
    const ls = p.stats.lifesteal + (p.rageT > 0 ? 0.15 : 0);
    if (ls > 0) p.heal(dealt * ls);
    if (o.kb && o.kbAngle !== undefined) e.knock(o.kbAngle, o.kb);
    this.fx.number(e.x, e.y - e.r, dmg, crit);
    sfx(crit ? 'crit' : 'hit');
    if (o.big || (crit && dmg > 60)) this.hitstop = Math.max(this.hitstop, 0.045);

    if (e.hp <= 0) {
      this.killEnemy(e);
      return true;
    }
    return false;
  }

  private killEnemy(e: Enemy) {
    e.destroy();
    this.run.kills++;
    const big = e.type === 'elite' || e.type === 'boss' || e.type === 'brute';
    this.fx.burst(e.x, e.y, e.def.color, big ? 30 : 12, big ? 320 : 200);
    if (big) {
      this.fx.ring(e.x, e.y, e.r * 2.5, e.def.color, 400);
      this.shake(e.type === 'boss' ? 600 : 160, e.type === 'boss' ? 0.02 : 0.008);
      this.hitstop = Math.max(this.hitstop, e.type === 'boss' ? 0.25 : 0.08);
    }
    sfx('kill');
    if (Math.random() < e.def.drop) {
      this.pickups.push({ img: this.add.image(e.x, e.y, 'heart').setDepth(4), x: e.x, y: e.y, life: 12 });
    }
    if (e === this.boss) {
      this.boss = null;
      this.bossDefeated = true;
      this.hud.hideBoss();
      // the boss takes its summons with it
      this.enemies.forEach((o) => { if (!o.dead) { this.fx.burst(o.x, o.y, o.def.color, 8); o.destroy(); } });
      this.spawnQueue = [];
    }
  }

  hurtPlayer(amount: number, src: string) {
    this.lastHitBy = src;
    const p = this.player;
    if (p.iframes > 0 || this.over || this.godMode) return;
    const dmg = Math.max(1, Math.round(amount * (1 - Math.min(0.6, p.stats.armor))));
    p.hp -= dmg;
    p.iframes = 0.6;
    this.run.dmgTaken += dmg;
    this.shake(120, 0.008);
    this.hurtOverlay.setAlpha(0.25);
    this.tweens.add({ targets: this.hurtOverlay, alpha: 0, duration: 250 });
    this.fx.number(p.x, p.y - 20, dmg, false);
    sfx('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun(false);
    }
  }

  onBossPhase(e: Enemy, ph: number) {
    this.hud.banner(ph === 2 ? '裂隙之主 · 第二阶段' : '裂隙之主 · 狂暴', '#ff5577');
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

  tryCast(key: 'Q' | 'E' | 'R') {
    unlockAudio();
    if (this.over || this.intermission || this.scene.isPaused()) return;
    if (cast(this, this.player, key)) this.hud.pulse(key);
  }

  // ---------------------------------------------------------------- helpers

  clampToArena(o: { x: number; y: number; r: number }) {
    o.x = Phaser.Math.Clamp(o.x, ARENA.x + o.r, ARENA.x + ARENA.w - o.r);
    o.y = Phaser.Math.Clamp(o.y, ARENA.y + o.r, ARENA.y + ARENA.h - o.r);
  }

  moveDir(): { x: number; y: number } | null {
    if (this.bot) return this.bot.move;
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
  }

  private step(dtMs: number) {
    const dt = dtMs / 1000;
    this.run.time += dt;
    this.bot?.update(this, dt);
    this.updatePlayer(dt);
    this.updateWave(dtMs);
    for (const e of this.enemies) if (!e.dead) e.update(this, dt);
    this.separate();
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  /** Where the cursor (or the bot's target) is, for targeted abilities. */
  aimPoint() {
    if (this.bot) {
      const t = this.bot.target;
      if (t) return { x: t.x, y: t.y };
    }
    const ptr = this.input.activePointer;
    return { x: Phaser.Math.Clamp(ptr.worldX, ARENA.x, ARENA.x + ARENA.w), y: Phaser.Math.Clamp(ptr.worldY, ARENA.y, ARENA.y + ARENA.h) };
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const ptr = this.input.activePointer;
    p.aimAngle = this.bot ? this.bot.aim : Math.atan2(ptr.worldY - p.y, ptr.worldX - p.x);
    p.iframes -= dt;
    p.rageT -= dt;
    for (const k of ['Q', 'E', 'R'] as const) p.cd[k] = Math.max(0, p.cd[k] - dt * 1000);
    if (p.stats.regen) p.heal(p.stats.regen * dt);

    if (p.dashT <= 0) {
      const mv = this.moveDir();
      if (mv) {
        const spd = p.speed * (p.whirlT > 0 ? 0.85 : 1);
        p.x += mv.x * spd * dt;
        p.y += mv.y * spd * dt;
        this.clampToArena(p);
      }
    }
    updateKit(this, p, dt);

    p.atkTimer -= dt;
    const firing = this.bot ? this.bot.fire : ptr.leftButtonDown();
    if (firing && p.atkTimer <= 0 && p.dashT <= 0) {
      p.atkTimer = 1 / p.atkRate;
      primary(this, p);
    }

    if (this.whirlImg) {
      if (p.whirlT > 0) this.whirlImg.setPosition(p.x, p.y).setRotation(this.whirlImg.rotation + dt * 18);
      else { this.whirlImg.destroy(); this.whirlImg = null; }
    }
    p.sync();
  }

  /** Cheap pairwise push so crowds spread out instead of stacking. */
  private separate() {
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
        const wa = a.type === 'boss' ? 0 : b.type === 'boss' ? 1 : 0.5;
        a.x -= (dx / d) * push * 2 * wa;
        a.y -= (dy / d) * push * 2 * wa;
        b.x += (dx / d) * push * 2 * (1 - wa);
        b.y += (dy / d) * push * 2 * (1 - wa);
      }
    }
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

  private updateBullets(dt: number) {
    const p = this.player;
    for (const b of this.pBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.img.setPosition(b.x, b.y);
      for (const e of this.enemies) {
        if (e.dead || b.hit.has(e) || b.pierce <= 0) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          b.hit.add(e);
          b.pierce--;
          this.damage(e, b.dmg, { kbAngle: Math.atan2(b.vy, b.vx), kb: 90 });
          this.fx.burst(b.x, b.y, 0xffffff, 3, 120);
          if (p.mod('echo')) { p.cd.Q = Math.max(0, p.cd.Q - 150); p.cd.E = Math.max(0, p.cd.E - 150); }
        }
      }
      if (b.pierce <= 0 || b.life <= 0 || b.x < ARENA.x || b.x > ARENA.x + ARENA.w || b.y < ARENA.y || b.y > ARENA.y + ARENA.h) {
        b.life = -1;
        b.img.destroy();
      }
    }
    this.pBullets = this.pBullets.filter((b) => b.life > 0);

    for (const b of this.eBullets) {
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
      if (e.hp >= e.maxHp || e.type === 'boss') continue;
      const w = e.r * 2;
      const x = e.x - e.r;
      const y = e.y - e.r - 9;
      g.fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, w + 2, 6);
      g.fillStyle(e.type === 'elite' ? 0xff4fd8 : 0xff5050).fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
}
