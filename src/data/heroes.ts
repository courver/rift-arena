export type HeroId = 'lumen' | 'kael';
export type SkillSlot = 'Q' | 'E' | 'R';
export type Slot = 'weapon' | SkillSlot;

export interface Equip {
  id: string;
  lv: number;
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
  /** Starting weapon and skills; all of them can be swapped by upgrade cards. */
  loadout: Record<Slot, string>;
  passive: { name: string; desc: string };
}

export const HEROES: Record<HeroId, HeroDef> = {
  lumen: {
    id: 'lumen',
    name: '星弦',
    title: 'Lumen',
    role: '远程 · 控场',
    desc: '血薄手长，靠走位和控场活下来。',
    color: 0x5ee0ff,
    hp: 105,
    speed: 230,
    loadout: { weapon: 'bolt', Q: 'blink', E: 'frostNova', R: 'starfall' },
    passive: { name: '星辉回响', desc: '主武器每次命中，Q / E 冷却 -0.1 秒' },
  },
  kael: {
    id: 'kael',
    name: '赤刃',
    title: 'Kael',
    role: '近战 · 斗士',
    desc: '血厚，贴身输出，越残越猛。',
    color: 0xff6a4a,
    hp: 155,
    speed: 215,
    loadout: { weapon: 'slash', Q: 'dashStrike', E: 'whirlwind', R: 'bloodrage' },
    passive: { name: '不屈战意', desc: '生命低于 35% 时伤害 +40%、受伤 -15%' },
  },
};
