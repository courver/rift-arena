import Phaser from 'phaser';
import { BOT_LOOP, FONT, H, PORTRAIT, TOTAL_WAVES, W } from '../config';
import { Equip, HEROES, HeroId, Slot } from '../data/heroes';
import { UPGRADES } from '../data/upgrades';
import { loadoutText } from '../game/cards';
import type { RunStats } from './GameScene';
import { button, textStyle } from '../ui/widgets';
import { sfx } from '../sfx';

interface EndData {
  win: boolean;
  hero: HeroId;
  wave: number;
  run: RunStats;
  mods: Record<string, number>;
  loadout: Record<Slot, Equip>;
  /** what landed the last hit, e.g. 'colossus-slam' */
  by: string;
}

const BEST_KEY = 'rift-best';
const FEEDBACK_KEY = 'rift-feedback';

/** Readable names for death causes. */
const CAUSE: Record<string, string> = {
  bullet: '敌方子弹', slime: '史莱姆', mini: '小史莱姆', runner: '疾行者的突进', shooter: '虚空射手',
  bomber: '爆裂蜱的自爆', shielder: '盾卫', priest: '祭司', brute: '重甲蛮兵', 'brute-charge': '蛮兵的冲锋',
  elite: '精英守卫', 'elite-charge': '精英的冲锋', boss: '裂隙之主', 'boss-charge': '裂隙之主的冲锋',
  colossus: '熔核巨像', 'colossus-slam': '巨像的砸地', 'colossus-rock': '巨像的落石',
  weaver: '虚空织影', 'weaver-beam': '织影的光束',
};

const MOODS = ['😫', '🙁', '😐', '🙂', '🤩'];
const TAGS = ['太难', '太简单', '打击感好', '构筑有趣', '看不懂', '卡顿', '操作别扭', '还想再玩'];

function fmt(sec: number) {
  const t = Math.floor(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export class EndScene extends Phaser.Scene {
  private rating = 0;
  private tags = new Set<string>();

  constructor() {
    super('End');
  }

  create(d: EndData) {
    this.rating = 0;
    this.tags = new Set();
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

    let y = PORTRAIT ? 150 : 80;
    this.add.text(W / 2, y, d.win ? '胜利！裂隙已封印' : '你倒下了', textStyle(PORTRAIT ? 46 : 50, d.win ? '#ffd34a' : '#ff5566', true)).setOrigin(0.5);
    y += 56;
    const sub = d.win ? '通关全部 10 波' : `止步第 ${d.wave} / ${TOTAL_WAVES} 波 · 死于${CAUSE[d.by] ?? d.by}`;
    this.add.text(W / 2, y, `${hero.name} · ${sub}`, textStyle(19, '#c8cde0')).setOrigin(0.5);
    y += 44;

    const rows = [
      ['用时', fmt(d.run.time) + (newBest ? '　新纪录！' : best[d.hero] ? `　最佳 ${fmt(best[d.hero])}` : '')],
      ['击杀', String(d.run.kills)],
      ['造成 / 承受伤害', `${Math.round(d.run.dmgDealt)} / ${Math.round(d.run.dmgTaken)}`],
    ];
    rows.forEach(([k, v], i) => {
      this.add.text(W / 2 - 16, y + i * 30, k, textStyle(17, '#8890a8')).setOrigin(1, 0);
      this.add.text(W / 2 + 16, y + i * 30, v, textStyle(17, newBest && i === 0 ? '#ffd34a' : '#ffffff')).setOrigin(0, 0);
    });
    y += rows.length * 30 + 16;

    const build = Object.entries(d.mods).map(([id, n]) => {
      const u = UPGRADES.find((x) => x.id === id);
      return u ? `${u.name}${n > 1 ? ' ×' + n : ''}` : id;
    });
    const lo = this.add.text(W / 2, y, loadoutText(d.loadout, PORTRAIT ? '\n' : '　'), { ...textStyle(15, '#ffd34a'), align: 'center' }).setOrigin(0.5, 0);
    y += lo.height + 6;
    const bt = this.add.text(W / 2, y, build.length ? build.join('　') : '（无属性强化）', {
      ...textStyle(14, '#dfe3f0'), align: 'center', wordWrap: { width: Math.min(820, W - 60), useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    y += bt.height + 24;

    // ---- playtest feedback: a 5-point mood, quick tags, and a report to paste to the developer
    this.add.text(W / 2, y, '这局感觉如何？（帮我改进游戏）', textStyle(16, '#a9a3ff', true)).setOrigin(0.5, 0);
    y += 34;
    const moodBtns = MOODS.map((m, i) => {
      const t = this.add.text(W / 2 + (i - 2) * 64, y + 20, m, { fontFamily: 'sans-serif', fontSize: '34px' }).setOrigin(0.5).setAlpha(0.45)
        .setInteractive({ useHandCursor: true });
      t.on('pointerup', () => {
        this.rating = i + 1;
        moodBtns.forEach((b, j) => b.setAlpha(j === i ? 1 : 0.35).setScale(j === i ? 1.25 : 1));
        sfx('pick');
        this.saveFeedback(d);
      });
      return t;
    });
    y += 56;
    const perRow = PORTRAIT ? 4 : 8;
    TAGS.forEach((tag, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = W / 2 + (col - (perRow - 1) / 2) * 116;
      const bg = this.add.rectangle(0, 0, 106, 34, 0x1a1f33).setStrokeStyle(1, 0x4a5578);
      const t = this.add.text(0, 0, tag, { fontFamily: FONT, fontSize: '15px', color: '#c8cde0' }).setOrigin(0.5);
      const c = this.add.container(x, y + row * 42 + 17, [bg, t]).setSize(106, 34).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        if (this.tags.has(tag)) this.tags.delete(tag); else this.tags.add(tag);
        const on = this.tags.has(tag);
        bg.setFillStyle(on ? 0x6a4cff : 0x1a1f33).setStrokeStyle(1, on ? 0xa9a3ff : 0x4a5578);
        t.setColor(on ? '#ffffff' : '#c8cde0');
        this.saveFeedback(d);
      });
    });
    y += Math.ceil(TAGS.length / perRow) * 42 + 18;
    const copied = this.add.text(W / 2, y + 30, '', textStyle(13, '#7bff9e')).setOrigin(0.5, 0);
    button(this, W / 2, y + 6, '复制对局报告（发给作者）', () => {
      void this.copyReport(d).then((ok) => copied.setText(ok ? '已复制，粘贴到聊天里发给作者即可' : '复制失败，请截图本页面'));
    }, 300, 0x4a5578);

    const by = PORTRAIT ? H - 110 : H - 60;
    button(this, W / 2 - 130, by, '再来一局', () => this.scene.start('Game', { hero: d.hero }));
    button(this, W / 2 + 130, by, '换英雄', () => this.scene.start('Menu'), 220, 0x8890a8);
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Game', { hero: d.hero }));
    if (BOT_LOOP) {
      const fixed = new URLSearchParams(location.search).get('hero');
      this.time.delayedCall(800, () => this.scene.start('Game', { hero: fixed ? d.hero : d.hero === 'lumen' ? 'kael' : 'lumen' }));
    }
  }

  private report(d: EndData) {
    const lo = d.loadout;
    return [
      `【裂隙竞技场 对局报告】`,
      `英雄：${HEROES[d.hero].name}　结果：${d.win ? '通关' : `第 ${d.wave} 波阵亡（${CAUSE[d.by] ?? d.by}）`}　用时：${fmt(d.run.time)}`,
      `击杀 ${d.run.kills}　造成伤害 ${Math.round(d.run.dmgDealt)}　承受伤害 ${Math.round(d.run.dmgTaken)}`,
      `构筑：${loadoutText(lo, ' / ')}`,
      `选卡顺序：${d.run.picks.join(', ')}`,
      `评分：${this.rating ? MOODS[this.rating - 1] + ' ' + this.rating + '/5' : '未评分'}　标签：${[...this.tags].join('、') || '无'}`,
      `设备：${navigator.userAgent}`,
    ].join('\n');
  }

  private async copyReport(d: EndData) {
    const text = this.report(d);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // older / in-app browsers: fall back to a hidden textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  /** Keeps the last 50 ratings locally, so a playtest session can be reviewed later. */
  private saveFeedback(d: EndData) {
    try {
      const list = JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? '[]') as object[];
      const entry = { at: Date.now(), hero: d.hero, win: d.win, wave: d.wave, by: d.by, time: Math.round(d.run.time), rating: this.rating, tags: [...this.tags] };
      const last = list[list.length - 1] as { at?: number } | undefined;
      if (last && last.at && Date.now() - last.at < 60000 && (last as { time?: number }).time === entry.time) list[list.length - 1] = entry;
      else list.push(entry);
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-50)));
    } catch { /* ignore */ }
  }
}
