const params = new URLSearchParams(location.search);
export const DEBUG = params.has('debug');
/** Autoplay for balance testing; `?bot&speed=4&loop` simulates runs back to back. */
export const BOT = params.has('bot') || params.has('lab');
export const BOT_LOOP = params.has('loop') || params.has('lab');
export const SIM = BOT && (params.has('sim') || params.has('lab'));
/** `?lab`: balance lab dashboard on top of a headless simulation. */
export const LAB = params.has('lab');
/** Phone / tablet controls: virtual joystick, skill buttons, auto-aim. `?touch` forces it on desktop. */
export const TOUCH = params.has('touch') || params.has('portrait') || window.matchMedia('(pointer: coarse)').matches;
export const SPEED = Math.max(1, Math.min(8, Number(params.get('speed')) || 1));

/**
 * Phones held upright get a tall 720x1280 world instead of being told to rotate:
 * most people browse with rotation lock on. Decided once at startup.
 */
export const PORTRAIT = !BOT && (params.has('portrait') || (TOUCH && window.innerHeight > window.innerWidth));

export const W = PORTRAIT ? 720 : 1280;
export const H = PORTRAIT ? 1280 : 720;

/** Playable area; the HUD draws on top of the margins. */
export const ARENA = { x: 40, y: PORTRAIT ? 110 : 40, w: W - 80, h: H - (PORTRAIT ? 150 : 80) };

export const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';

export const TOTAL_WAVES = 10;

export const RARITY_COLOR = { common: 0x9aa4b8, rare: 0x4aa8ff, epic: 0xc06bff, legend: 0xffd34a } as const;
export const RARITY_NAME = { common: '普通', rare: '稀有', epic: '史诗', legend: '传说' } as const;

export function hex(c: number) {
  return '#' + c.toString(16).padStart(6, '0');
}
