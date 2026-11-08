export type HeroId = 'lumen' | 'kael';
export type AbilityKey = 'LMB' | 'Q' | 'E' | 'R';

export interface AbilityDef {
  key: AbilityKey;
  name: string;
  desc: string;
  /** Base cooldown in ms (0 for the primary attack). */
  cd: number;
  icon: string;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  role: string;
  desc: string;
  color: number;
  hp: number;
  speed: number;
  /** Primary attacks per second. */
  atkRate: number;
  abilities: AbilityDef[];
}

export const HEROES: Record<HeroId, HeroDef> = {
  lumen: {
    id: 'lumen',
    name: '星弦',
    title: 'Lumen',
    role: '远程 · 控场',
    desc: '用星弹风筝敌人，霜环减速，坠星清场。手短血薄，靠走位活下来。',
    color: 0x5ee0ff,
    hp: 105,
    speed: 230,
    atkRate: 3.2,
    abilities: [
      { key: 'LMB', name: '星弹', desc: '向鼠标方向射出星弹', cd: 0, icon: '✦' },
      { key: 'Q', name: '相位闪', desc: '向移动方向瞬移，短暂无敌', cd: 4000, icon: '➤' },
      { key: 'E', name: '霜环', desc: '冲击周围敌人并减速 50%', cd: 7000, icon: '❄' },
      { key: 'R', name: '坠星', desc: '在鼠标处召下陨星，造成巨额范围伤害', cd: 26000, icon: '☄' },
    ],
  },
  kael: {
    id: 'kael',
    name: '赤刃',
    title: 'Kael',
    role: '近战 · 斗士',
    desc: '贴身挥砍、突进切入，开血怒后越打越猛。血厚，但要冲进人堆。',
    color: 0xff6a4a,
    hp: 140,
    speed: 215,
    atkRate: 2.2,
    abilities: [
      { key: 'LMB', name: '斩击', desc: '向鼠标方向挥出扇形斩击', cd: 0, icon: '⚔' },
      { key: 'Q', name: '突进斩', desc: '冲向鼠标方向，沿途造成伤害，短暂无敌', cd: 5000, icon: '➤' },
      { key: 'E', name: '旋风', desc: '持续旋转 1.6 秒，伤害周围敌人', cd: 8000, icon: '◎' },
      { key: 'R', name: '血怒', desc: '震退周围敌人，6 秒内攻速、吸血、移速大增', cd: 26000, icon: '♨' },
    ],
  },
};
