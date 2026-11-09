/**
 * Build depth on top of single items:
 * - Synergies (羁绊): owning two specific items (any level) adds a combo effect.
 * - Ultimates (究极进化): a weapon at Lv5 plus its partner skill at Lv5 can evolve the weapon.
 * Effects are implemented where the items live (weapons.ts / skills.ts / GameScene), keyed by these ids.
 */
export interface Synergy {
  id: string;
  name: string;
  a: string;
  b: string;
  desc: string;
}

export const SYNERGIES: Synergy[] = [
  { id: 'starTrail', name: '星轨', a: 'bolt', b: 'blink', desc: '相位闪后 2.5 秒内，星弹伤害 +50%、穿透 +2' },
  { id: 'bloodBlade', name: '血刃', a: 'slash', b: 'bloodrage', desc: '血怒期间，斩击范围 +25%、伤害 +50%' },
  { id: 'frostfire', name: '霜火', a: 'flame', b: 'frostNova', desc: '灼烧对减速 / 冻结的敌人伤害翻倍；霜环命中燃烧中的敌人额外 +45 伤害' },
  { id: 'thunderWell', name: '雷暴', a: 'chain', b: 'gravityWell', desc: '引力井每 0.6 秒对井内 3 个敌人降下落雷' },
  { id: 'shadowDance', name: '影舞', a: 'dashStrike', b: 'whirlwind', desc: '突进斩结束时自动卷起 0.8 秒旋风' },
  { id: 'battery', name: '炮阵', a: 'scatter', b: 'turret', desc: '哨戒炮台改为一次射出 3 发散射弹' },
  { id: 'timeRift', name: '时隙', a: 'blink', b: 'timeStop', desc: '时间凝滞期间，相位闪不消耗充能' },
  { id: 'timeSlash', name: '斩时', a: 'dashStrike', b: 'timeStop', desc: '时间凝滞期间，突进斩不消耗充能' },
  { id: 'phantomBlade', name: '幻刃', a: 'boomerang', b: 'shadowStep', desc: '幻影分身存在期间不断投出回旋刃' },
];

export const SYNERGY_BY_ID: Record<string, Synergy> = Object.fromEntries(SYNERGIES.map((s) => [s.id, s]));

export interface UltimatePath {
  /** the evolved weapon id (in WEAPONS) */
  id: string;
  from: string;
  partner: string;
}

export const ULTIMATES: UltimatePath[] = [
  { id: 'galaxy', from: 'bolt', partner: 'blink' },
  { id: 'bloodmoon', from: 'slash', partner: 'bloodrage' },
  { id: 'annihilator', from: 'scatter', partner: 'turret' },
  { id: 'thunderGod', from: 'chain', partner: 'gravityWell' },
  { id: 'bladestorm', from: 'boomerang', partner: 'whirlwind' },
  { id: 'dragonBreath', from: 'flame', partner: 'frostNova' },
];
