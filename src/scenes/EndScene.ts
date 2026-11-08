import Phaser from 'phaser';
import { BOT_LOOP, H, TOTAL_WAVES, W } from '../config';
import { HEROES, HeroId } from '../data/heroes';
import { UPGRADES } from '../data/upgrades';
import type { RunStats } from './GameScene';
import { button, textStyle } from '../ui/widgets';

interface EndData {
  win: boolean;
  hero: HeroId;
  wave: number;
  run: RunStats;
  mods: Record<string, number>;
}

const BEST_KEY = 'rift-best';

function fmt(sec: number) {
  const t = Math.floor(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(d: EndData) {
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0d16);
    this.cameras.main.fadeIn(300);
    const hero = HEROES[d.hero];

    // best clear time per hero, per browser
    let best: Record<string, number> = {};
    try { best = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}'); } catch { /* ignore */ }
    let newBest = false;
    if (d.win && (!best[d.hero] || d.run.time < best[d.hero])) {
      best[d.hero] = d.run.time;
      newBest = true;
      try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* ignore */ }
    }

    this.add.text(W / 2, 110, d.win ? '胜利！裂隙已封印' : '你倒下了', textStyle(52, d.win ? '#ffd34a' : '#ff5566', true)).setOrigin(0.5);
    this.add.text(W / 2, 170, `${hero.name} · ${d.win ? '通关全部 10 波' : `止步第 ${d.wave} / ${TOTAL_WAVES} 波`}`, textStyle(20, '#c8cde0')).setOrigin(0.5);

    const rows = [
      ['用时', fmt(d.run.time) + (newBest ? '　新纪录！' : best[d.hero] ? `　最佳 ${fmt(best[d.hero])}` : '')],
      ['击杀', String(d.run.kills)],
      ['造成伤害', String(Math.round(d.run.dmgDealt))],
      ['承受伤害', String(Math.round(d.run.dmgTaken))],
    ];
    rows.forEach(([k, v], i) => {
      this.add.text(W / 2 - 20, 230 + i * 34, k, textStyle(18, '#8890a8')).setOrigin(1, 0);
      this.add.text(W / 2 + 20, 230 + i * 34, v, textStyle(18, newBest && i === 0 ? '#ffd34a' : '#ffffff')).setOrigin(0, 0);
    });

    const build = Object.entries(d.mods).map(([id, n]) => {
      const u = UPGRADES.find((x) => x.id === id);
      return u ? `${u.name}${n > 1 ? ' ×' + n : ''}` : id;
    });
    this.add.text(W / 2, 390, '本局构筑', textStyle(18, '#a9a3ff', true)).setOrigin(0.5);
    this.add.text(W / 2, 420, build.length ? build.join('　') : '（无）', {
      ...textStyle(15, '#dfe3f0'), align: 'center', wordWrap: { width: 820, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    button(this, W / 2 - 130, H - 120, '再来一局', () => this.scene.start('Game', { hero: d.hero }));
    button(this, W / 2 + 130, H - 120, '换英雄', () => this.scene.start('Menu'), 220, 0x8890a8);
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Game', { hero: d.hero }));
    if (BOT_LOOP) {
      const fixed = new URLSearchParams(location.search).get('hero');
      this.time.delayedCall(800, () => this.scene.start('Game', { hero: fixed ? d.hero : d.hero === 'lumen' ? 'kael' : 'lumen' }));
    }
  }
}
