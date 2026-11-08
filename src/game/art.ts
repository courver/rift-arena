import Phaser from 'phaser';

/**
 * Character art, drawn with the Canvas 2D API (gradients, curves) at 3x resolution
 * and displayed at 1/3 scale so it stays crisp when the game is scaled up.
 * Everything faces right; sprites flip to face left.
 */
// roundRect is missing on older mobile browsers (iOS < 16, older Android WebViews / in-app browsers);
// without it the art step throws and the game never leaves the black boot screen.
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r?: number | DOMPointInit | (number | DOMPointInit)[]) {
    const rr = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}

const RES = 3;
export const ART_SCALE = 1 / RES;

type C = CanvasRenderingContext2D;
const INK = '#0b0d16';

function begin(c: C, fill?: string | CanvasGradient, stroke = INK, lw = 2) {
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function circ(c: C, x: number, y: number, r: number, fill?: string | CanvasGradient, stroke = INK, lw = 2) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); begin(c, fill, stroke, lw);
}
function ell(c: C, x: number, y: number, rx: number, ry: number, fill?: string | CanvasGradient, stroke = INK, lw = 2, rot = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); begin(c, fill, stroke, lw);
}
function poly(c: C, pts: number[], fill?: string | CanvasGradient, stroke = INK, lw = 2) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); begin(c, fill, stroke, lw);
}
function line(c: C, pts: number[], color: string, lw: number) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function rgrad(c: C, x: number, y: number, r: number, inner: string, outer: string) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  return g;
}
function lgrad(c: C, x0: number, y0: number, x1: number, y1: number, a: string, b: string) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a); g.addColorStop(1, b);
  return g;
}
function shadow(c: C, x: number, y: number, rx: number, ry: number) {
  ell(c, x, y, rx, ry, 'rgba(0,0,0,0.35)', '', 0);
}
function glow(c: C, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
/** Anime-style eye: dark outline, coloured iris, white highlight. */
function eye(c: C, x: number, y: number, r: number, iris: string) {
  ell(c, x, y, r * 0.8, r, '#ffffff', INK, 1.2);
  ell(c, x + r * 0.15, y + r * 0.1, r * 0.55, r * 0.75, iris, '', 0);
  circ(c, x + r * 0.15, y + r * 0.15, r * 0.25, INK, '', 0);
  circ(c, x - r * 0.15, y - r * 0.35, r * 0.25, '#ffffff', '', 0);
}
function star(c: C, x: number, y: number, r: number, fill: string) {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  poly(c, pts, fill, INK, 1.2);
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: C) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * RES, h * RES)!;
  const c = tex.context;
  c.save();
  c.scale(RES, RES);
  draw(c);
  c.restore();
  tex.refresh();
}

// ------------------------------------------------------------------ heroes

function lumen(c: C) {
  shadow(c, 28, 53, 15, 4);
  // long hair behind
  ell(c, 25, 30, 15, 19, rgrad(c, 25, 30, 19, '#e6fbff', '#7fd6f0'));
  // robe
  poly(c, [17, 33, 39, 33, 45, 52, 11, 52], lgrad(c, 0, 33, 0, 52, '#2c56a0', '#172a55'));
  line(c, [12, 50, 44, 50], '#5ee0ff', 2);
  poly(c, [24, 33, 32, 33, 30, 45, 26, 45], '#e9f6ff', INK, 1.2);
  star(c, 28, 41, 3.2, '#ffe66b');
  // arm holding the weapon forward
  ell(c, 38, 38, 4, 3, '#ffe6d5');
  // head
  circ(c, 29, 21, 13, rgrad(c, 29, 21, 13, '#fff3ea', '#f6d3bd'));
  // bangs
  c.beginPath();
  c.moveTo(16, 21); c.quadraticCurveTo(17, 6, 31, 7); c.quadraticCurveTo(43, 8, 42, 20);
  c.lineTo(38, 15); c.lineTo(35, 20); c.lineTo(31, 13); c.lineTo(26, 19); c.lineTo(22, 13); c.closePath();
  begin(c, rgrad(c, 28, 10, 14, '#f4feff', '#8fdcf2'));
  eye(c, 29, 23, 3.2, '#2fb8e6');
  eye(c, 37, 23, 2.8, '#2fb8e6');
  ell(c, 25, 28, 2.2, 1.2, 'rgba(255,120,140,0.5)', '', 0);
  star(c, 18, 12, 4, '#ffe66b');
}

function kael(c: C) {
  shadow(c, 28, 53, 15, 4);
  // scarf trailing behind
  c.beginPath();
  c.moveTo(22, 32); c.quadraticCurveTo(10, 30, 4, 38); c.quadraticCurveTo(12, 36, 14, 42); c.quadraticCurveTo(18, 36, 26, 36); c.closePath();
  begin(c, lgrad(c, 4, 0, 26, 0, '#a8221a', '#ff4a36'));
  // armoured body
  c.beginPath(); c.roundRect(15, 31, 26, 21, 6); begin(c, lgrad(c, 0, 31, 0, 52, '#4a3640', '#251a22'));
  poly(c, [17, 33, 39, 33, 36, 42, 20, 42], '#7a2b26', INK, 1.4);
  line(c, [28, 33, 28, 42], '#ff6a4a', 1.5);
  ell(c, 15, 34, 5, 4, '#8a8f9e');
  ell(c, 41, 34, 5, 4, '#8a8f9e');
  ell(c, 41, 40, 4, 3, '#f2c6a8');
  // head
  circ(c, 28, 21, 12.5, rgrad(c, 28, 21, 12.5, '#ffe7d6', '#e7b796'));
  // spiky hair swept back
  poly(c, [15, 22, 13, 9, 19, 13, 20, 4, 26, 10, 30, 2, 33, 10, 40, 6, 39, 13, 44, 15, 39, 18, 35, 13, 29, 16, 22, 14], rgrad(c, 28, 10, 16, '#ff8a6a', '#c0261c'));
  // headband
  line(c, [17, 15, 39, 15], '#1d1d28', 3);
  // eyes, narrow and sharp
  c.save(); c.beginPath(); c.rect(24, 21, 18, 5); c.clip();
  eye(c, 30, 24, 3, '#ffb02a'); eye(c, 37, 24, 2.6, '#ffb02a');
  c.restore();
  line(c, [27, 20, 33, 21], INK, 1.4);
  line(c, [35, 21, 39, 20], INK, 1.4);
  line(c, [34, 28, 37, 30], '#c65a4a', 1.2);
}

// ------------------------------------------------------------------ held weapons (pointing right, handle at the left)

const WEAPON_ART: Record<string, [number, number, (c: C) => void]> = {
  bolt: [38, 14, (c) => {
    line(c, [2, 7, 28, 7], '#6b4a2e', 3);
    glow(c, 31, 7, 9, 'rgba(94,224,255,0.8)');
    star(c, 31, 7, 6, '#bff4ff');
  }],
  slash: [44, 14, (c) => {
    c.beginPath(); c.roundRect(1, 5, 9, 4, 2); begin(c, '#a8221a', INK, 1.2);
    c.beginPath(); c.roundRect(9, 2, 3, 10, 1); begin(c, '#ffd34a', INK, 1.2);
    poly(c, [12, 4, 38, 4, 43, 7, 38, 10, 12, 10], lgrad(c, 0, 4, 0, 10, '#ffffff', '#9aa4b8'), INK, 1.2);
    line(c, [14, 7, 37, 7], 'rgba(255,255,255,0.8)', 1);
  }],
  scatter: [38, 18, (c) => {
    c.beginPath(); c.roundRect(2, 6, 10, 8, 2); begin(c, '#5a4632', INK, 1.2);
    c.beginPath(); c.roundRect(10, 4, 20, 10, 3); begin(c, lgrad(c, 0, 4, 0, 14, '#ffe08a', '#b07a1a'), INK, 1.4);
    poly(c, [29, 3, 36, 1, 36, 17, 29, 15], '#ffc04a', INK, 1.4);
    line(c, [14, 7, 26, 7], 'rgba(255,255,255,0.6)', 1.2);
  }],
  chain: [38, 16, (c) => {
    line(c, [2, 8, 28, 8], '#7a8296', 3);
    for (let x = 10; x <= 24; x += 4) ell(c, x, 8, 1.6, 4.5, '', '#8fb0ff', 1.6);
    glow(c, 31, 8, 9, 'rgba(168,184,255,0.9)');
    circ(c, 31, 8, 4, '#e8eeff', INK, 1.2);
  }],
  boomerang: [26, 26, (c) => {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      poly(c, [13 + Math.cos(a) * 12, 13 + Math.sin(a) * 12, 13 + Math.cos(a + 1.1) * 4, 13 + Math.sin(a + 1.1) * 4,
        13 + Math.cos(a - 0.4) * 4, 13 + Math.sin(a - 0.4) * 4], '#d0ff6a', INK, 1.2);
    }
    circ(c, 13, 13, 3, '#ffffff', INK, 1.2);
  }],
  flame: [40, 18, (c) => {
    c.beginPath(); c.roundRect(1, 3, 12, 12, 4); begin(c, lgrad(c, 0, 3, 0, 15, '#ff9a3a', '#a8401a'), INK, 1.4);
    c.beginPath(); c.roundRect(12, 6, 18, 6, 2); begin(c, '#6a6f80', INK, 1.2);
    poly(c, [29, 5, 34, 4, 34, 14, 29, 13], '#3a3f50', INK, 1.2);
    glow(c, 37, 9, 6, 'rgba(255,140,40,0.9)');
  }],
};

// ------------------------------------------------------------------ enemies

function slime(c: C, w: number, color: string, dark: string) {
  const s = w / 36;
  c.save(); c.scale(s, s);
  shadow(c, 18, 30, 14, 3.5);
  c.beginPath();
  c.moveTo(3, 28); c.quadraticCurveTo(2, 6, 18, 5); c.quadraticCurveTo(34, 6, 33, 28); c.quadraticCurveTo(18, 32, 3, 28);
  begin(c, rgrad(c, 18, 17, 16, color, dark));
  ell(c, 11, 12, 4, 2.5, 'rgba(255,255,255,0.55)', '', 0, -0.5);
  ell(c, 20, 19, 2.2, 3, INK, '', 0); ell(c, 28, 19, 2, 2.8, INK, '', 0);
  circ(c, 20.6, 18, 0.9, '#fff', '', 0); circ(c, 28.5, 18, 0.8, '#fff', '', 0);
  line(c, [22, 24, 24, 25, 26, 24], INK, 1.2);
  c.restore();
}

function runner(c: C) {
  shadow(c, 17, 27, 13, 3);
  line(c, [10, 20, 6, 27], '#b8901c', 2); line(c, [16, 21, 14, 28], '#b8901c', 2);
  line(c, [20, 21, 24, 28], '#b8901c', 2); line(c, [24, 20, 29, 26], '#b8901c', 2);
  c.beginPath(); c.moveTo(12, 17); c.quadraticCurveTo(2, 14, 1, 7); c.quadraticCurveTo(6, 13, 14, 13); begin(c, '#e0a820', INK, 1.4);
  ell(c, 17, 16, 10, 6, rgrad(c, 17, 16, 10, '#fff07a', '#d9a21a'));
  ell(c, 27, 12, 6, 5, rgrad(c, 27, 12, 6, '#fff07a', '#d9a21a'));
  circ(c, 29, 11, 2.6, '#ffffff', INK, 1); circ(c, 29.7, 11.3, 1.3, '#d02020', '', 0);
  line(c, [14, 11, 19, 11], '#b8901c', 1.5);
}

function shooter(c: C) {
  shadow(c, 17, 36, 10, 2.5);
  c.beginPath(); c.moveTo(17, 3); c.quadraticCurveTo(31, 14, 28, 32); c.quadraticCurveTo(17, 28, 6, 32); c.quadraticCurveTo(3, 14, 17, 3);
  begin(c, lgrad(c, 0, 3, 0, 32, '#c99aff', '#5a2a9a'));
  ell(c, 18, 15, 7, 6, '#1a0b2c', INK, 1.2);
  glow(c, 20, 15, 6, 'rgba(255,90,220,0.9)');
  circ(c, 20, 15, 2, '#ffd0f4', '', 0);
  glow(c, 30, 24, 6, 'rgba(255,79,216,0.8)');
  circ(c, 30, 24, 2.6, '#ffb0ee', INK, 1);
}

function bomber(c: C) {
  shadow(c, 16, 27, 12, 3);
  for (const [x0, x1] of [[9, 5], [13, 11], [19, 21], [23, 27]]) line(c, [x0, 20, x1, 27], '#6a2010', 2);
  const pts: number[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rr = i % 2 ? 10 : 13;
    pts.push(16 + Math.cos(a) * rr, 16 + Math.sin(a) * rr * 0.85);
  }
  poly(c, pts, rgrad(c, 16, 16, 13, '#ff8a4a', '#a8280a'), INK, 1.4);
  glow(c, 16, 17, 8, 'rgba(255,224,112,0.9)');
  line(c, [11, 15, 14, 18, 12, 21], '#ffe070', 1.2); line(c, [20, 13, 18, 17, 21, 20], '#ffe070', 1.2);
  circ(c, 22, 13, 1.8, INK, '', 0);
  line(c, [16, 3, 18, 0], '#7a5a3a', 1.6);
  glow(c, 18, 0.5, 3.5, 'rgba(255,240,150,1)');
}

function shielder(c: C) {
  shadow(c, 23, 44, 15, 3.5);
  c.beginPath(); c.roundRect(11, 22, 24, 20, 5); begin(c, lgrad(c, 0, 22, 0, 42, '#7fb6ff', '#2f4f8a'));
  line(c, [23, 24, 23, 40], '#bfe0ff', 1.5);
  ell(c, 11, 25, 6, 5, '#9ab8e0'); ell(c, 35, 25, 6, 5, '#9ab8e0');
  c.beginPath(); c.arc(23, 16, 11, Math.PI, 0); c.lineTo(34, 22); c.lineTo(12, 22); c.closePath();
  begin(c, lgrad(c, 0, 5, 0, 22, '#d6e6ff', '#6a88b8'));
  c.beginPath(); c.roundRect(20, 13, 13, 3.5, 1.5); begin(c, '#0b1426', INK, 1);
  glow(c, 28, 14.7, 5, 'rgba(120,220,255,0.9)');
  poly(c, [23, 3, 26, 0, 25, 6], '#ff5a5a', INK, 1);
}

function priest(c: C) {
  shadow(c, 17, 40, 10, 2.5);
  ell(c, 17, 6, 8, 2.5, '', '#ffd34a', 2);
  c.beginPath(); c.moveTo(17, 9); c.quadraticCurveTo(29, 18, 27, 38); c.lineTo(7, 38); c.quadraticCurveTo(5, 18, 17, 9);
  begin(c, lgrad(c, 0, 9, 0, 38, '#7ff0d8', '#1f8a78'));
  line(c, [17, 22, 17, 36], '#e8fff8', 2); line(c, [13, 27, 21, 27], '#e8fff8', 2);
  ell(c, 19, 17, 5, 4.5, '#0d2a26', INK, 1.2);
  circ(c, 20.5, 17, 1.4, '#aaffee', '', 0); circ(c, 17.5, 17, 1.2, '#aaffee', '', 0);
  line(c, [29, 12, 29, 39], '#8a6a4a', 2);
  glow(c, 29, 11, 6, 'rgba(63,224,192,0.9)');
  circ(c, 29, 11, 2.6, '#c8fff2', INK, 1);
}

function brute(c: C) {
  shadow(c, 27, 49, 19, 4);
  ell(c, 15, 43, 5, 4, '#7a3a14'); ell(c, 36, 43, 5, 4, '#7a3a14');
  ell(c, 26, 32, 18, 14, rgrad(c, 26, 30, 18, '#ffb070', '#c0601c'));
  c.beginPath(); c.roundRect(12, 36, 28, 5, 2); begin(c, '#5a3010', INK, 1.4);
  circ(c, 26, 38.5, 2.5, '#ffd34a', INK, 1);
  ell(c, 8, 27, 7, 8, rgrad(c, 8, 27, 8, '#ffb070', '#b0501a'));
  ell(c, 45, 30, 7, 8, rgrad(c, 45, 30, 8, '#ffb070', '#b0501a'));
  circ(c, 30, 15, 10, rgrad(c, 30, 15, 10, '#ffc08a', '#d0702a'));
  poly(c, [22, 9, 17, 1, 25, 7], '#f2ead8', INK, 1.2); poly(c, [36, 8, 42, 0, 38, 9], '#f2ead8', INK, 1.2);
  line(c, [29, 12, 33, 13.5], INK, 1.6); line(c, [35, 13.5, 38, 12], INK, 1.6);
  circ(c, 32, 15, 1.4, '#ff2020', '', 0); circ(c, 37, 15, 1.2, '#ff2020', '', 0);
  poly(c, [31, 21, 32, 18, 33, 21], '#fff', INK, 0.8); poly(c, [36, 21, 37, 18, 38, 21], '#fff', INK, 0.8);
}

function elite(c: C) {
  shadow(c, 36, 66, 24, 5);
  c.beginPath(); c.moveTo(24, 30); c.quadraticCurveTo(8, 50, 12, 66); c.lineTo(36, 58); c.closePath();
  begin(c, lgrad(c, 0, 30, 0, 66, '#6a1050', '#2a0620'));
  c.beginPath(); c.roundRect(22, 30, 30, 30, 8); begin(c, lgrad(c, 0, 30, 0, 60, '#ff6fe0', '#7a1a66'));
  poly(c, [26, 34, 48, 34, 44, 48, 30, 48], '#3a0a30', INK, 1.4);
  glow(c, 37, 41, 7, 'rgba(255,79,216,0.9)');
  for (const [x, y] of [[20, 32], [54, 32]]) {
    ell(c, x, y, 8, 6, '#a83a90');
    poly(c, [x - 4, y - 4, x, y - 13, x + 4, y - 4], '#ffd0f4', INK, 1.2);
  }
  circ(c, 38, 21, 12, lgrad(c, 0, 9, 0, 33, '#ff8ae8', '#8a1a72'));
  poly(c, [29, 13, 22, 0, 33, 10], '#2a0620', INK, 1.4); poly(c, [44, 11, 52, 0, 47, 14], '#2a0620', INK, 1.4);
  c.beginPath(); c.roundRect(33, 19, 14, 4, 2); begin(c, '#1a0414', INK, 1);
  glow(c, 39, 21, 4, 'rgba(255,255,160,1)'); glow(c, 45, 21, 3.5, 'rgba(255,255,160,1)');
}

function riftLord(c: C) {
  // tentacles
  for (let i = 0; i < 6; i++) {
    const x = 30 + i * 16;
    c.beginPath(); c.moveTo(x - 6, 96); c.quadraticCurveTo(x - 10 + (i % 2) * 14, 118, x + (i % 2 ? 6 : -6), 136);
    c.quadraticCurveTo(x + 4, 116, x + 6, 96); c.closePath();
    begin(c, lgrad(c, 0, 96, 0, 136, '#9a1430', '#3a0410'), INK, 2);
  }
  // spiked crown
  const pts: number[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rr = i % 2 ? 50 : 66;
    pts.push(70 + Math.cos(a) * rr, 66 + Math.sin(a) * rr);
  }
  poly(c, pts, rgrad(c, 70, 66, 66, '#c0203c', '#3a0410'), INK, 2.5);
  circ(c, 70, 66, 44, rgrad(c, 70, 66, 44, '#ff5a70', '#7a0a20'), INK, 2.5);
  // rift cracks
  line(c, [40, 50, 52, 60, 46, 74], '#ffb0c0', 1.6); line(c, [98, 46, 88, 58, 96, 70], '#ffb0c0', 1.6);
  // the great eye
  ell(c, 76, 66, 26, 20, '#fff0f2', INK, 2.5);
  glow(c, 80, 66, 18, 'rgba(255,200,60,0.8)');
  ell(c, 80, 66, 12, 15, rgrad(c, 80, 66, 15, '#ffe070', '#d04010'), INK, 1.5);
  ell(c, 81, 66, 4, 12, INK, '', 0);
  circ(c, 74, 58, 4, '#ffffff', '', 0);
}

function colossus(c: C) {
  shadow(c, 60, 112, 40, 7);
  const rock = (x: number, y: number, w: number, h: number) => {
    c.beginPath(); c.roundRect(x, y, w, h, 7); begin(c, lgrad(c, 0, y, 0, y + h, '#8a8078', '#3e3832'), INK, 2.2);
  };
  rock(30, 88, 22, 22); rock(68, 88, 22, 22); // legs
  rock(24, 38, 72, 56); // torso
  // magma cracks
  for (const pts of [[40, 46, 50, 60, 44, 76, 54, 88], [80, 44, 72, 58, 82, 70, 76, 86], [56, 52, 62, 64, 58, 74]]) {
    line(c, pts, 'rgba(255,140,40,0.55)', 6);
    line(c, pts, '#ffd070', 2.2);
  }
  glow(c, 60, 66, 14, 'rgba(255,140,40,0.9)');
  circ(c, 60, 66, 7, '#fff0b0', INK, 1.5);
  // huge fists
  rock(2, 50, 26, 30); rock(92, 54, 26, 30);
  line(c, [8, 60, 20, 60], '#2a2420', 2); line(c, [98, 64, 110, 64], '#2a2420', 2);
  // head
  rock(42, 12, 40, 30);
  c.beginPath(); c.roundRect(52, 22, 26, 7, 3); begin(c, '#1a0c04', INK, 1.2);
  glow(c, 62, 25.5, 6, 'rgba(255,170,40,1)'); glow(c, 73, 25.5, 6, 'rgba(255,170,40,1)');
  poly(c, [46, 14, 40, 2, 54, 12], '#5e5650', INK, 1.6);
}

function weaver(c: C) {
  // flowing robe tail
  c.beginPath(); c.moveTo(26, 40); c.quadraticCurveTo(10, 70, 22, 96); c.quadraticCurveTo(34, 86, 44, 98); c.quadraticCurveTo(54, 86, 66, 96);
  c.quadraticCurveTo(76, 70, 62, 40); c.closePath();
  begin(c, lgrad(c, 0, 40, 0, 98, '#8a4ad8', '#1a0838'), INK, 2);
  // threads to floating orbs
  for (const [x, y] of [[8, 34], [84, 30], [14, 70], [82, 66]]) {
    line(c, [44, 46, x, y], 'rgba(217,168,255,0.7)', 1);
    glow(c, x, y, 7, 'rgba(200,120,255,0.9)');
    circ(c, x, y, 3, '#f0d8ff', INK, 1);
  }
  // hood and body
  c.beginPath(); c.moveTo(44, 6); c.quadraticCurveTo(66, 16, 64, 50); c.lineTo(24, 50); c.quadraticCurveTo(22, 16, 44, 6);
  begin(c, lgrad(c, 0, 6, 0, 50, '#c49aff', '#4a1a8a'), INK, 2);
  ell(c, 46, 28, 13, 12, '#0e0420', INK, 1.5);
  // three eyes
  for (const [x, y, r] of [[42, 26, 2.6], [51, 26, 2.6], [46.5, 33, 2]]) {
    glow(c, x, y, r * 2.6, 'rgba(255,120,255,0.9)');
    circ(c, x, y, r, '#ffe0ff', '', 0);
  }
  line(c, [30, 50, 58, 50], '#ffd34a', 2);
}

// ------------------------------------------------------------------ build all

export function buildArt(scene: Phaser.Scene) {
  make(scene, 'hero_lumen', 56, 58, lumen);
  make(scene, 'hero_kael', 56, 58, kael);
  for (const [id, [w, h, draw]] of Object.entries(WEAPON_ART)) make(scene, 'w_' + id, w, h, draw);
  make(scene, 'slime', 36, 34, (c) => slime(c, 36, '#9bff8a', '#2f9a3a'));
  make(scene, 'mini', 24, 23, (c) => slime(c, 24, '#c8ffb8', '#4cb04a'));
  make(scene, 'runner', 36, 31, runner);
  make(scene, 'shooter', 36, 40, shooter);
  make(scene, 'bomber', 33, 30, bomber);
  make(scene, 'shielder', 46, 48, shielder);
  make(scene, 'priest', 36, 43, priest);
  make(scene, 'brute', 54, 54, brute);
  make(scene, 'elite', 72, 72, elite);
  make(scene, 'boss', 140, 140, riftLord);
  make(scene, 'colossus', 120, 120, colossus);
  make(scene, 'weaver', 90, 100, weaver);
}
