import { HEROES } from './data/heroes';
import { WEAPONS } from './game/weapons';

/**
 * Balance lab (?lab): the bot plays full runs headlessly while this dashboard
 * aggregates results live. Used to tune numbers between playtests.
 */
interface Run {
  hero: string;
  win: boolean;
  wave: number;
  time: number;
  kills: number;
  by: string;
  loadout: string;
  picks: string;
}

const CAUSE: Record<string, string> = {
  bullet: '敌方子弹', slime: '史莱姆', mini: '小史莱姆', runner: '疾行者', shooter: '虚空射手', bomber: '爆裂蜱',
  shielder: '盾卫', priest: '祭司', brute: '蛮兵', 'brute-charge': '蛮兵冲锋', elite: '精英', 'elite-charge': '精英冲锋',
  boss: '裂隙之主', 'boss-charge': '裂隙之主冲锋', colossus: '巨像', 'colossus-slam': '巨像砸地', 'colossus-rock': '巨像落石',
  weaver: '织影', 'weaver-beam': '织影光束',
};

const CSS = `
#lab { position: fixed; inset: 0; overflow: auto; background: #0b0d16; color: #dfe3f0; z-index: 30; touch-action: auto;
  font: 14px "Microsoft YaHei", "PingFang SC", sans-serif; -webkit-user-select: text; user-select: text; }
#lab .wrap { max-width: 1100px; margin: 0 auto; padding: 20px 16px 40px; }
#lab h1 { font-size: 24px; margin: 0 0 4px; color: #fff; }
#lab .sub { color: #8890a8; margin-bottom: 16px; line-height: 1.6; }
#lab .bar-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
#lab button { background: #1a1f33; color: #dfe3f0; border: 1px solid #4a5578; border-radius: 6px; padding: 6px 12px; cursor: pointer; font: inherit; }
#lab button.on { background: #6a4cff; border-color: #a9a3ff; color: #fff; }
#lab .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
#lab .kpi { background: #151a2c; border: 1px solid #262d47; border-radius: 8px; padding: 10px 12px; }
#lab .kpi b { display: block; font-size: 24px; color: #fff; margin-top: 2px; }
#lab .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
#lab .card { background: #151a2c; border: 1px solid #262d47; border-radius: 8px; padding: 12px 14px; }
#lab .card h3 { margin: 0 0 10px; font-size: 15px; color: #a9a3ff; }
#lab .row { display: grid; grid-template-columns: 96px 1fr 70px; align-items: center; gap: 8px; margin: 5px 0; }
#lab .track { background: #0b0d16; border-radius: 3px; height: 14px; overflow: hidden; }
#lab .fill { height: 100%; border-radius: 3px; }
#lab .num { text-align: right; color: #c8cde0; font-variant-numeric: tabular-nums; }
#lab .cols { display: flex; align-items: flex-end; gap: 6px; height: 140px; padding-top: 8px; }
#lab .col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
#lab .col i { width: 100%; background: #ff5566; border-radius: 3px 3px 0 0; min-height: 1px; }
#lab .col span { font-size: 11px; color: #8890a8; margin-top: 4px; }
#lab .col em { font-size: 11px; color: #c8cde0; font-style: normal; }
#lab table { width: 100%; border-collapse: collapse; font-size: 12px; }
#lab td, #lab th { text-align: left; padding: 4px 6px; border-bottom: 1px solid #262d47; }
#lab th { color: #8890a8; font-weight: normal; }
#lab a { color: #a9a3ff; }
`;

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

function bars(rows: [string, number, string][], max: number, color: string) {
  return rows.map(([label, v, text]) => `<div class="row"><span>${label}</span><div class="track"><div class="fill" style="width:${max ? (v / max) * 100 : 0}%;background:${color}"></div></div><span class="num">${text}</span></div>`).join('');
}

export function startLab() {
  const params = new URLSearchParams(location.search);
  const hero = params.get('hero');
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.getElementById('game')!.style.visibility = 'hidden';
  const root = document.createElement('div');
  root.id = 'lab';
  root.innerHTML = `<div class="wrap">
    <h1>⚙ 平衡实验室</h1>
    <div class="sub">机器人用当前版本的数值自动跑完整对局（走位、躲预警、放技能、选卡都由 AI 机器人完成），不渲染画面、固定 60 帧步长，所以比真人玩快得多。
      下面的数据实时更新，用来在每次改数值后检查胜率、难点在哪一波、玩家主要死于什么。<a href="./">← 返回游戏</a></div>
    <div class="bar-row">
      <button data-hero="">两个英雄轮流</button><button data-hero="lumen">只跑星弦</button><button data-hero="kael">只跑赤刃</button>
      <button id="lab-pause">暂停</button><button id="lab-csv">导出 CSV</button>
    </div>
    <div class="kpis" id="lab-kpis"></div>
    <div class="grid" id="lab-grid"></div>
  </div>`;
  document.body.appendChild(root);
  root.querySelectorAll<HTMLButtonElement>('button[data-hero]').forEach((b) => {
    if ((b.dataset.hero || null) === hero) b.classList.add('on');
    b.onclick = () => { location.search = b.dataset.hero ? `?lab&hero=${b.dataset.hero}` : '?lab'; };
  });
  const w = window as unknown as { __runs?: Run[]; __simPaused?: boolean };
  const pauseBtn = document.getElementById('lab-pause')!;
  pauseBtn.onclick = () => {
    w.__simPaused = !w.__simPaused;
    pauseBtn.textContent = w.__simPaused ? '继续' : '暂停';
  };
  document.getElementById('lab-csv')!.onclick = () => {
    const runs = w.__runs ?? [];
    const head = 'hero,win,wave,time,kills,cause,loadout,picks';
    const lines = runs.map((r) => [r.hero, r.win ? 1 : 0, r.wave, r.time, r.kills, r.by, r.loadout, `"${r.picks}"`].join(','));
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rift-arena-sim-${runs.length}.csv`;
    a.click();
  };

  const started = performance.now();
  const render = () => {
    const runs = w.__runs ?? [];
    const n = runs.length;
    const wins = runs.filter((r) => r.win).length;
    const avgTime = n ? Math.round(runs.reduce((s, r) => s + r.time, 0) / n) : 0;
    const secs = (performance.now() - started) / 1000;
    document.getElementById('lab-kpis')!.innerHTML = [
      ['已模拟对局', `${n}`],
      ['总胜率', `${pct(wins, n)}%`],
      ['平均每局游戏时长', `${Math.floor(avgTime / 60)}:${String(avgTime % 60).padStart(2, '0')}`],
      ['模拟速度', n ? `${(secs / n).toFixed(1)} 秒/局` : '…'],
    ].map(([k, v]) => `<div class="kpi">${k}<b>${v}</b></div>`).join('');

    if (!n) {
      document.getElementById('lab-grid')!.innerHTML = '<div class="card">正在跑第一局，大约需要几秒…</div>';
      return;
    }

    // win rate by hero
    const heroRows = Object.values(HEROES).map((h) => {
      const a = runs.filter((r) => r.hero === h.id);
      const wr = pct(a.filter((r) => r.win).length, a.length);
      return [h.name, wr, a.length ? `${wr}% (${a.length}局)` : '—'] as [string, number, string];
    });

    // survival curve: share of runs that cleared each wave
    const survive = Array.from({ length: 10 }, (_, i) => runs.filter((r) => r.win || r.wave > i + 1).length / n);
    const deaths = Array.from({ length: 10 }, (_, i) => runs.filter((r) => !r.win && r.wave === i + 1).length);
    const maxDeath = Math.max(1, ...deaths);

    // causes
    const causeCount: Record<string, number> = {};
    for (const r of runs) if (!r.win) causeCount[r.by] = (causeCount[r.by] ?? 0) + 1;
    const causes = Object.entries(causeCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const losses = n - wins;

    // final weapon usage and its win rate
    const wStats: Record<string, { n: number; w: number }> = {};
    for (const r of runs) {
      const id = Object.keys(WEAPONS).find((k) => r.loadout.startsWith(k)) ?? '?';
      (wStats[id] ??= { n: 0, w: 0 }).n++;
      if (r.win) wStats[id].w++;
    }
    const weaponRows = Object.entries(wStats).sort((a, b) => b[1].n - a[1].n)
      .map(([id, s]) => [WEAPONS[id]?.name ?? id, pct(s.w, s.n), `${pct(s.w, s.n)}% · ${s.n}局`] as [string, number, string]);

    const recent = runs.slice(-10).reverse().map((r) =>
      `<tr><td>${HEROES[r.hero as 'lumen']?.name ?? r.hero}</td><td>${r.win ? '✅ 通关' : `第${r.wave}波`}</td><td>${r.win ? '' : CAUSE[r.by] ?? r.by}</td><td>${r.loadout}</td></tr>`).join('');

    document.getElementById('lab-grid')!.innerHTML = `
      <div class="card"><h3>各英雄胜率</h3>${bars(heroRows, 100, '#6a4cff')}</div>
      <div class="card"><h3>存活曲线（打过第 N 波的比例）</h3>
        <div class="cols">${survive.map((v, i) => `<div class="col"><em>${Math.round(v * 100)}</em><i style="height:${v * 100}%;background:${[4, 7, 9].includes(i) ? '#ffd34a' : '#4cdb6a'}"></i><span>${i + 1}</span></div>`).join('')}</div>
        <div class="sub" style="margin:6px 0 0">黄色柱 = 首领波（5 / 8 / 10）</div></div>
      <div class="card"><h3>阵亡波次分布</h3>
        <div class="cols">${deaths.map((v, i) => `<div class="col"><em>${v || ''}</em><i style="height:${(v / maxDeath) * 100}%"></i><span>${i + 1}</span></div>`).join('')}</div></div>
      <div class="card"><h3>死因排行（共 ${losses} 次阵亡）</h3>${causes.length ? bars(causes.map(([k, v]) => [CAUSE[k] ?? k, v, `${pct(v, losses)}%`]), causes[0][1], '#ff5566') : '暂无阵亡'}</div>
      <div class="card"><h3>最终主武器 · 胜率</h3>${bars(weaponRows, 100, '#ffc04a')}</div>
      <div class="card"><h3>最近 10 局</h3><table><tr><th>英雄</th><th>结果</th><th>死因</th><th>最终构筑</th></tr>${recent}</table></div>`;
  };
  render();
  window.setInterval(render, 1000);
}
