/**
 * Relics (遗物): passive items that bend how a build plays. Up to MAX_RELICS per run,
 * offered on some cards and guaranteed on boss reward picks. Hooks live in GameScene / Player.
 */
export interface Relic {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const MAX_RELICS = 4;

export const RELICS: Relic[] = [
  { id: 'vampFang', name: '吸血獠牙', icon: '🦷', desc: '每击杀一个敌人回复 2 生命' },
  { id: 'chainReaction', name: '连锁反应', icon: '💥', desc: '敌人死亡时 30% 概率爆炸，波及周围敌人' },
  { id: 'thorns', name: '荆棘甲', icon: '🌵', desc: '受到伤害时，对周围敌人造成 40 伤害并击退' },
  { id: 'hourglass', name: '时之沙', icon: '⏳', desc: '每击杀一个敌人，Q / E 冷却 -0.2 秒' },
  { id: 'twinFang', name: '双生', icon: '♊', desc: '主武器每第 4 次攻击会额外再攻击一次' },
  { id: 'berserker', name: '狂战士', icon: '😤', desc: '每损失 10% 生命，攻击速度 +8%' },
  { id: 'hunterMark', name: '猎手印记', icon: '🎯', desc: '对精英和首领造成的伤害 +35%' },
  { id: 'frostHeart', name: '冰霜之心', icon: '💠', desc: '受伤时冻结周围敌人 1 秒（6 秒冷却）' },
  { id: 'phantom', name: '幽魂披风', icon: '👻', desc: '受到攻击时 15% 概率闪避' },
  { id: 'overcharge', name: '超载核心', icon: '🔋', desc: 'R 冷却 -30%；释放 R 后 4 秒内伤害 +30%' },
  { id: 'magnet', name: '引力核心', icon: '🧲', desc: '治疗球吸取范围 ×3，治疗量 +50%' },
  { id: 'bounty', name: '赏金令', icon: '💰', desc: '每波结束额外获得 1 次重随' },
];

export const RELIC_BY_ID: Record<string, Relic> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
