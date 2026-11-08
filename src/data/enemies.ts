export type EnemyType =
  | 'slime' | 'mini' | 'runner' | 'shooter' | 'bomber' | 'shielder' | 'priest' | 'brute' | 'elite' | 'boss';

export interface EnemyDef {
  name: string;
  /** one-line hint shown the first time this enemy appears */
  hint: string;
  hp: number;
  speed: number;
  /** Contact damage. */
  dmg: number;
  r: number;
  color: number;
  /** Chance to drop a heal orb. */
  drop: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  slime: { name: '裂隙史莱姆', hint: '死亡时分裂成两只小史莱姆', hp: 32, speed: 75, dmg: 10, r: 14, color: 0x6be36b, drop: 0.03 },
  mini: { name: '小史莱姆', hint: '', hp: 11, speed: 100, dmg: 6, r: 9, color: 0x9bf09b, drop: 0.01 },
  runner: { name: '疾行者', hint: '蓄力后高速突进，看到它变红就闪开', hp: 18, speed: 115, dmg: 8, r: 11, color: 0xffd34a, drop: 0.03 },
  shooter: { name: '虚空射手', hint: '保持距离，瞄准线亮起后开火', hp: 30, speed: 70, dmg: 8, r: 14, color: 0xb67bff, drop: 0.06 },
  bomber: { name: '爆裂蜱', hint: '贴近后引爆；提前击杀会炸伤周围的敌人', hp: 22, speed: 118, dmg: 4, r: 12, color: 0xff5a2a, drop: 0.04 },
  shielder: { name: '盾卫', hint: '正面护盾挡住子弹，绕到背后或用范围技能', hp: 100, speed: 48, dmg: 12, r: 20, color: 0x6aa8ff, drop: 0.15 },
  priest: { name: '裂隙祭司', hint: '远离战场，周期性治疗附近的敌人，优先击杀', hp: 48, speed: 70, dmg: 6, r: 13, color: 0x3fe0c0, drop: 0.25 },
  brute: { name: '重甲蛮兵', hint: '红色预警线后冲锋', hp: 150, speed: 52, dmg: 18, r: 22, color: 0xff9a3c, drop: 0.2 },
  elite: { name: '精英 · 裂隙守卫', hint: '冲锋 + 环形弹幕，并带随机词缀', hp: 600, speed: 60, dmg: 20, r: 30, color: 0xff4fd8, drop: 1 },
  boss: { name: '裂隙之主', hint: '', hp: 4200, speed: 55, dmg: 22, r: 54, color: 0xff3355, drop: 0 },
};

export type Affix = 'swift' | 'warded' | 'splitting' | 'enraged';

export const AFFIXES: Record<Affix, string> = {
  swift: '迅捷',
  warded: '护盾',
  splitting: '分裂',
  enraged: '狂怒',
};

/** Enemy HP grows each wave so upgrades stay meaningful. */
export function hpScale(wave: number) {
  return 1 + 0.11 * (wave - 1);
}
