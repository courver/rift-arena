export type EnemyType = 'slime' | 'runner' | 'shooter' | 'brute' | 'elite' | 'boss';

export interface EnemyDef {
  name: string;
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
  slime: { name: '裂隙史莱姆', hp: 32, speed: 75, dmg: 10, r: 14, color: 0x6be36b, drop: 0.04 },
  runner: { name: '疾行者', hp: 18, speed: 150, dmg: 7, r: 11, color: 0xffd34a, drop: 0.03 },
  shooter: { name: '虚空射手', hp: 30, speed: 70, dmg: 8, r: 14, color: 0xb67bff, drop: 0.06 },
  brute: { name: '重甲蛮兵', hp: 150, speed: 52, dmg: 18, r: 22, color: 0xff9a3c, drop: 0.2 },
  elite: { name: '精英 · 裂隙守卫', hp: 600, speed: 60, dmg: 20, r: 30, color: 0xff4fd8, drop: 1 },
  boss: { name: '裂隙之主', hp: 4200, speed: 55, dmg: 28, r: 54, color: 0xff3355, drop: 0 },
};

/** Enemy HP grows each wave so upgrades stay meaningful. */
export function hpScale(wave: number) {
  return 1 + 0.14 * (wave - 1);
}
