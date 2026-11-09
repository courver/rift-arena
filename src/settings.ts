/** Player preferences, remembered per browser. */
export interface Settings {
  sound: boolean;
  music: boolean;
  shake: boolean;
  /** first-run tips already shown */
  tutorialDone: boolean;
  difficulty: 'normal' | 'hard' | 'nightmare';
}

const KEY = 'rift-settings';

function load(): Settings {
  const d: Settings = { sound: true, music: true, shake: true, tutorialDone: false, difficulty: 'normal' };
  try {
    const legacyMuted = localStorage.getItem('rift-muted') === '1';
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return { ...d, sound: !legacyMuted, ...saved };
  } catch {
    return d;
  }
}

export const settings: Settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode etc. */ }
}
