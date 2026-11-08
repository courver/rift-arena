export const W = 1280;
export const H = 720;

/** Playable area; the HUD draws on top of the margins. */
export const ARENA = { x: 40, y: 40, w: W - 80, h: H - 80 };

export const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';

export const TOTAL_WAVES = 10;

const params = new URLSearchParams(location.search);
export const DEBUG = params.has('debug');
/** Autoplay for balance testing; `?bot&speed=4&loop` simulates runs back to back. */
export const BOT = params.has('bot');
export const BOT_LOOP = params.has('loop');
export const SIM = BOT && params.has('sim');
/** Phone / tablet controls: virtual joystick, skill buttons, auto-aim. `?touch` forces it on desktop. */
export const TOUCH = params.has('touch') || window.matchMedia('(pointer: coarse)').matches;
export const SPEED = Math.max(1, Math.min(8, Number(params.get('speed')) || 1));

export const RARITY_COLOR = { common: 0x9aa4b8, rare: 0x4aa8ff, epic: 0xc06bff } as const;
export const RARITY_NAME = { common: '普通', rare: '稀有', epic: '史诗' } as const;

export function hex(c: number) {
  return '#' + c.toString(16).padStart(6, '0');
}
