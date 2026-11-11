/* =================================================================
   HOCKEY LINEA - Linces de Zaratan · version vectorial
   LOGICA (sin DOM): pista, fisica, IA, reglas.
   Unidades del mundo: 1 = 10 cm. La pista mide 400 x 180 (40 x 18 m).
   Va a 60 Hz fijos. Se puede ejecutar en Node para simular partidos.
   ================================================================= */
const G = (() => {
'use strict';
const DT = 1 / 60;

/* ---------------- pista ---------------- */
const RL = 400, RW = 180, CY = RW / 2, RCR = 26;          /* esquinas redondeadas de 2,6 m */
const GL = 24, GR = RL - 24, GD = 11, GT = CY - 10, GB = CY + 10, GH = 12;   /* porteria 2 m x 1,2 m */

/* ---------------- fisica ---------------- */
const ACC = 330, FRIC = 3.2, GRAV = 98;
const MAX_H = 82, MAX_HP = 72, MAX_C = 76, MAX_CP = 68, MAX_CHG = 40;
const SHOT = 330, PASS = 235, GSPD = 92;
const CHG_MAX = 0.7;                         /* segundos de carga para el tiro mas fuerte */
const STEAL_CPU = 1.6;
let SAVE_C = 0.82, SAVE_E = 0.45, SO_BONUS = -0.25;

/* ---------------- equipos ---------------- */
/* liga: orden de la clasificacion real; "rate" = nivel (1 el mas fuerte) */
const TEAMS = [
  { id: 'linces', crest: 'linc', abbr: 'LINC', name: 'LINCES', full: 'LINCES DE ZARATÁN', goal: 'GOL DE LOS LINCES', rate: 0.25, main: '#8e3fd0', light: '#b072ea', dark: '#4b1a78', trim: '#ffd23a', helm: '#4b1a78', num: '#ffd23a', pant: '#2a1546', hud: '#c084ff' },
  { id: 'lobos', crest: 'lobs', abbr: 'LOBS', name: 'LOBOS', full: 'LOBOS DE ÍSCAR', goal: 'GOL DE LOS LOBOS', rate: 1, main: '#1c1d22', light: '#3a3c44', dark: '#0b0b0e', trim: '#ffd23a', helm: '#ffd23a', num: '#ffd23a', pant: '#111214', hud: '#ffd23a', shade: '#0e0f12' },
  { id: 'canterac', crest: 'cant', abbr: 'CANT', name: 'CANTERAC', full: 'CPLV CANTERAC', goal: 'GOL DEL CANTERAC', rate: 0.92, main: '#f4f6fa', light: '#ffffff', dark: '#16181d', trim: '#16181d', helm: '#f4f6fa', num: '#16181d', pant: '#16181d', hud: '#ffffff', shade: '#c4ccd9' },
  { id: 'toros', crest: 'toro', abbr: 'TORO', name: 'TOROS', full: 'CPLV TOROS', goal: 'GOL DE LOS TOROS', rate: 0.85, main: '#f4f6fa', light: '#ffffff', dark: '#16181d', trim: '#c8202a', helm: '#16181d', num: '#c8202a', pant: '#16181d', hud: '#ff6b6b', shade: '#c4ccd9' },
  { id: 'cerros', crest: 'cerr', abbr: 'CERR', name: 'CERROS', full: 'CPLV CERROS', goal: 'GOL DE LOS CERROS', rate: 0.78, main: '#f4f6fa', light: '#ffffff', dark: '#16181d', trim: '#2a6fdb', helm: '#f4f6fa', num: '#2a6fdb', pant: '#16181d', hud: '#7fb2ff', shade: '#c4ccd9' },
  { id: 'medina', crest: 'medi', abbr: 'MEDI', name: 'MEDINA', full: 'CPHL MEDINA DEL CAMPO', goal: 'GOL DEL MEDINA', rate: 0.7, main: '#c8202a', light: '#e64a52', dark: '#5a0d12', trim: '#ffffff', helm: '#c8202a', num: '#ffffff', pant: '#2a0a0d', hud: '#ff6b6b' },
  { id: 'dragones', crest: 'drag', abbr: 'DRAG', name: 'DRAGONES', full: 'DRAGONES DE TUDELA', goal: 'GOL DE LOS DRAGONES', rate: 0.62, main: '#f6c81e', light: '#ffe066', dark: '#b3261e', trim: '#b3261e', helm: '#b3261e', num: '#b3261e', pant: '#5a1410', hud: '#ffd84a' },
  { id: 'rudos', crest: 'rud', abbr: 'RUD', name: 'RUDOS', full: 'RUDOS', goal: 'GOL DE LOS RUDOS', rate: 0.55, main: '#17306b', light: '#2c4f9e', dark: '#0a1636', trim: '#c0c6d0', helm: '#c0c6d0', num: '#c0c6d0', pant: '#0a1636', hud: '#c0c6d0' },
  { id: 'lemons', crest: 'rlv', abbr: 'RLV', name: 'LEMONS', full: 'ROLLING LEMONS VALLADOLID', goal: 'GOL DE ROLLING LEMONS', rate: 0.48, main: '#ffe23a', light: '#fff27a', dark: '#111214', trim: '#111214', helm: '#111214', num: '#111214', pant: '#111214', hud: '#ffe23a', stripes: true },
  { id: 'erizos', crest: 'erz', abbr: 'ERZ', name: 'ERIZOS', full: 'ERIZOS', goal: 'GOL DE LOS ERIZOS', rate: 0.42, main: '#17306b', light: '#2c4f9e', dark: '#0a1636', trim: '#7fb2ff', helm: '#0a1636', num: '#ffffff', pant: '#0a1636', hud: '#7fb2ff' },
  { id: 'grumetes', crest: 'gril', abbr: 'GRIL', name: 'GRUMETES', full: 'GRUMETES ROLLERS IN LINE LEÓN', goal: 'GOL DE LOS GRUMETES', rate: 0.35, main: '#f07a1a', light: '#ff9d4a', dark: '#1b1d25', trim: '#1b1d25', helm: '#1b1d25', num: '#1b1d25', pant: '#1b1d25', hud: '#ff9d4a' },
  { id: 'universo', crest: 'univ', abbr: 'UNIV', name: 'UNIVERSO', full: 'CPLV UNIVERSO', goal: 'GOL DEL UNIVERSO', rate: 0.3, main: '#f4f6fa', light: '#ffffff', dark: '#16181d', trim: '#18a058', helm: '#18a058', num: '#18a058', pant: '#16181d', hud: '#5fd38d', shade: '#c4ccd9' },
];
const opt = { rival: 1, two: false, demo: false, len: 180, league: false, level: 3 };
/* dificultad 1..5 (el nivel 4 era el juego anterior); solo afecta a la maquina cuando juega contra una persona */
const LV = () => opt.demo || !(isHuman(0) || isHuman(1)) ? 4 : (opt.level || 3);
const cpuVsHuman = t => !isHuman(t) && isHuman(1 - t);   /* len: segundos reales por periodo */
const TM = t => TEAMS[t ? opt.rival : 0];

/* ---------------- estado ---------------- */
const S_FACE = 0, S_PLAY = 1, S_GOAL = 2, S_PEREND = 3, S_OVER = 4, S_FOUL = 5, S_SO = 6;
/* porteria a la que ataca cada equipo (en los penaltis, todos a la derecha) */
const atkGoal = t => W.state === S_SO ? GR : (t ? GL : GR);
const W = {
  state: S_FACE, timer: 0, period: 1, clock: 1200, gtime: 0,
  score: [0, 0], human: [1, 6], swcd: [0, 0], chaser: [1, 6], stealCd: 0,
  goalTeam: -1, scorer: null, help: [-1, -1], msg1: '', msg2: '', stats: { shots: [0, 0], fouls: [0, 0] },
  fo: { x: 200, y: 90, phase: 0, t: 0, dropAt: 1, landT: 0, react: [0.3, 0.3], winner: -1 }, foul: null,
};
const hooks = { sfx() { }, goal() { }, msg() { }, over() { } };
const sfx = n => hooks.sfx(n);

const P = [];
const NUMS = [[1, 27, 9, 4, 5], [1, 8, 6, 3, 2]];      /* el 27 de los Linces es el rubio */
for (let i = 0; i < 10; i++) {
  P.push({ i, team: i < 5 ? 0 : 1, role: i % 5, num: NUMS[i < 5 ? 0 : 1][i % 5], blond: i === 1, name: i === 1 ? 'OLI' : '', hand: (i % 3) ? 1 : -1,
    x: 0, y: 0, vx: 0, vy: 0, hd: 0, ax: 1, ay: 0, anim: 0, speed: 0,
    nograb: 0, charging: false, charge: 0, chargeGoal: 0, strikeT: 0, followT: 0, followAmp: 1, wind: 0, swing: 0, shotPow: 0, windKind: 0,
    saveT: 0, saveKind: 0, saveDir: 1, react: 0, ty: CY, cele: 0, active: true, penT: 0, pokeT: 0, pokeHit: false, stumble: 0 });
}
/* arbitro */
const REF = { x: 200, y: 20, vx: 0, vy: 0, hd: Math.PI / 2, anim: 0, speed: 0, arm: 0, hold: 0, point: 0 };
const puck = { x: 200, y: CY, h: 0, vx: 0, vy: 0, vh: 0, holder: -1, holdT: 0, last: -1, prev: -1, flying: 0 };
const inp = [0, 1].map(() => ({ x: 0, y: 0, shoot: false, pass: false, shootE: false, passE: false, press: false, pressE: false }));

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const isHuman = t => t === 0 ? !opt.demo : (opt.two && !opt.demo && !opt.p2idle);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/* =================================================================
   SAQUES Y PARTIDO
   ================================================================= */
const FO = [[GL + 5, 0], [191, 0], [176, -44], [142, 36], [148, -26]];
const FATT = [null, [300, -34], [300, 34], [228, -48], [228, 48]];
const FDEF = [null, [192, -38], [192, 38], [98, -28], [98, 28]];

/* puntos de saque: centro y zonas */
const SPOTS = [[200, CY], [96, CY - 44], [96, CY + 44], [304, CY - 44], [304, CY + 44]];
const FO_OFF = [null, [6, 0], [22, -26], [46, 28], [46, -28]];
function faceoff(sx = 200, sy = CY) {
  for (const p of P) {
    p.vx = p.vy = 0; p.ay = 0;
    p.nograb = p.strikeT = p.followT = p.saveT = p.charge = p.swing = p.cele = p.pokeT = p.stumble = 0; p.charging = false; p.ty = CY;
    if (!p.active) continue;
    const s = p.team ? 1 : -1;      /* cada equipo en su lado del punto */
    if (p.role === 0) { p.x = p.team ? GR - 5 : GL + 5; p.y = CY; }
    else { const [ox, oy] = FO_OFF[p.role]; p.x = clamp(sx + s * ox, 12, RL - 12); p.y = clamp(sy + oy * (p.team ? -1 : 1), 12, RW - 12); }
    p.hd = p.team ? Math.PI : 0; p.ax = p.team ? -1 : 1;
  }
  /* sin solapes con las porterias */
  for (const p of P) if (p.active && p.role) { cageBlock(p, 5); rinkClamp(p, 5, 0); }
  Object.assign(puck, { x: sx, y: sy, h: 11, vx: 0, vy: 0, vh: 0, holder: -1, holdT: 0, last: -1, prev: -1, flying: 0 });
  Object.assign(REF, { x: sx, y: sy - 5, vx: 0, vy: 0, hd: Math.PI / 2, arm: 0, hold: 1, point: 0 });
  W.fo = { x: sx, y: sy, phase: 0, t: 0, dropAt: rand(0.5, 1.5), landT: 0, react: [rand(0.17, 0.4), rand(0.17, 0.4)], winner: -1 };
  W.human = [P[1].active ? 1 : nearestTo(0, sx, sy), P[6].active ? 6 : nearestTo(1, sx, sy)]; W.swcd = [0, 0]; W.stealCd = 0;
}
function nearestTo(t, x, y) {
  let b = -1, bd = 1e9;
  for (let j = t * 5 + 1; j < t * 5 + 5; j++) { if (!P[j].active) continue; const d = Math.hypot(P[j].x - x, P[j].y - y); if (d < bd) { bd = d; b = j; } }
  return b;
}
/* duelo: el arbitro suelta el disco; gana el primero que pulsa despues de que toque el suelo */
function faceoffTick() {
  const F = W.fo;
  for (const p of P) animTick(p);
  refTick();
  if (F.phase === 0) { if ((W.timer -= DT) <= 0) { F.phase = 1; F.t = 0; if (isHuman(0) || isHuman(1)) setMsg(W.msg1, 'PULSA TIRO AL CAER EL DISCO'); } return; }
  F.t += DT;
  /* pulsar antes de tiempo */
  for (const t of [0, 1]) if (isHuman(t) && inp[t].shootE && F.phase < 3 && F.winner < 0) { F.winner = 1 - t; F.early = t; }
  if (F.phase === 1 && F.t >= F.dropAt) { F.phase = 2; REF.hold = 0; sfx('whistle'); }
  if (F.phase === 2) {
    puck.vh -= GRAV * DT; puck.h += puck.vh * DT;
    if (puck.h <= 0) { puck.h = 0; puck.vh = 0; F.phase = 3; F.landT = 0; sfx('tick'); }
  }
  if (F.phase === 3 && F.winner < 0) {
    F.landT += DT;
    const hs = [0, 1].filter(t => isHuman(t) && inp[t].shootE);
    if (hs.length) F.winner = hs[0];
    else for (const t of [0, 1]) if (!isHuman(t) && F.landT >= F.react[t]) { F.winner = t; break; }
  }
  if (F.winner >= 0 && F.phase === 3) faceoffWin(F.winner, F.early === 1 - F.winner);
}
function faceoffWin(t, early) {
  const c = P[W.human[t]] && P[W.human[t]].role ? P[W.human[t]] : P[nearestTo(t, W.fo.x, W.fo.y)];
  /* el centro gana el disco y lo pasa hacia atras a un defensa */
  let m = null;
  for (const r of [3, 4, 2]) { const q = P[t * 5 + r]; if (q.active && q !== c) { m = q; break; } }
  puck.x = W.fo.x; puck.y = W.fo.y; puck.h = 0;
  if (m) { const d = Math.hypot(m.x - puck.x, m.y - puck.y) || 1; puck.vx = (m.x - puck.x) / d * 150; puck.vy = (m.y - puck.y) / d * 150; }
  else { puck.vx = (t ? 1 : -1) * 120; puck.vy = rand(-30, 30); }
  puck.last = c.i; c.nograb = 0.2; swingQuick(c, 0.5);
  c.hd = Math.atan2(puck.vy, puck.vx);
  sfx('pass');
  setMsg(early ? 'ADELANTADO' : '', early ? 'SAQUE PARA ' + TM(t).name : '');
  W.msgT = early ? 1.4 : 0;
  W.state = S_PLAY;
}
function setMsg(a, b) { W.msg1 = a || ''; W.msg2 = b || ''; hooks.msg(W.msg1, W.msg2); }
function startFaceoff(l1, l2, sx, sy) {
  faceoff(sx, sy);
  W.state = S_FACE; W.timer = l1 ? 2.0 : 1.0;
  setMsg(l1, l2);
}
function newGame() {
  W.score[0] = W.score[1] = 0; W.period = 1; W.clock = 1200; W.gtime = 0;
  W.stats.shots = [0, 0]; W.stats.fouls = [0, 0]; W.scorer = null; W.so = null; W.toSO = false; W.winner = -1;
  for (const p of P) { p.active = true; p.penT = 0; p.gx = 0; p.guessT = 0; }
  startFaceoff('PERIODO 1', 'PREPARADOS...');
}

/* =================================================================
   MOVIMIENTO
   ================================================================= */
/* posicion de la pala del stick: delante y al lado de la mano del jugador */
function blade(p) {
  const c = Math.cos(p.hd), s = Math.sin(p.hd);
  if (p.role === 0) return [p.x + c * 5, p.y + s * 5];
  const f = 8.5 + Math.max(0, p.swing) * 1.5 + pokeK(p) * 6, side = 3 * p.hand * (1 - pokeK(p) * 0.6);
  return [p.x + c * f - s * side, p.y + s * f + c * side];
}

const POKE = 0.3;
const pokeK = p => p.pokeT > 0 ? Math.sin(Math.PI * (1 - p.pokeT / POKE)) : 0;

/* limites con esquinas redondeadas */
function rinkClamp(o, r, rest) {
  let hit = false;
  if (o.x < r) { o.x = r; if (o.vx < 0) { o.vx = -o.vx * rest; hit = true; } }
  if (o.x > RL - r) { o.x = RL - r; if (o.vx > 0) { o.vx = -o.vx * rest; hit = true; } }
  if (o.y < r) { o.y = r; if (o.vy < 0) { o.vy = -o.vy * rest; hit = true; } }
  if (o.y > RW - r) { o.y = RW - r; if (o.vy > 0) { o.vy = -o.vy * rest; hit = true; } }
  const cx = o.x < RCR ? RCR : o.x > RL - RCR ? RL - RCR : null;
  const cy = o.y < RCR ? RCR : o.y > RW - RCR ? RW - RCR : null;
  if (cx !== null && cy !== null) {
    const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy), lim = RCR - r;
    if (d > lim) {
      const nx = dx / d, ny = dy / d;
      o.x = cx + nx * lim; o.y = cy + ny * lim;
      const vn = o.vx * nx + o.vy * ny;
      if (vn > 0) { o.vx -= (1 + rest) * vn * nx; o.vy -= (1 + rest) * vn * ny; hit = true; }
    }
  }
  return hit;
}

/* los jugadores no atraviesan las porterias */
function cageBlock(p, r) {
  for (const side of [0, 1]) {
    const x0 = (side ? GR : GL - GD) - r, x1 = (side ? GR + GD : GL) + r, y0 = GT - 3 - r, y1 = GB + 3 + r;
    if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1) continue;
    const pl = p.x - x0, pr = x1 - p.x, pt = p.y - y0, pb = y1 - p.y, m = Math.min(pl, pr, pt, pb);
    if (m === pl) { p.x = x0; p.vx = Math.min(p.vx, 0); }
    else if (m === pr) { p.x = x1; p.vx = Math.max(p.vx, 0); }
    else if (m === pt) { p.y = y0; p.vy = Math.min(p.vy, 0); }
    else { p.y = y1; p.vy = Math.max(p.vy, 0); }
  }
}

function turnTo(p, a, rate) {
  const d = angDiff(p.hd, a);
  p.hd += clamp(d, -rate * DT, rate * DT);
}

function movePlayer(p, ix, iy, maxs, aimFromVel) {
  const m = Math.hypot(ix, iy);
  if (m > 1) { ix /= m; iy /= m; }
  if (ix) p.vx += ix * ACC * DT * (p.vx * ix < 0 ? 2.2 : 1); else p.vx -= p.vx * Math.min(1, FRIC * DT);
  if (iy) p.vy += iy * ACC * DT * (p.vy * iy < 0 ? 2.2 : 1); else p.vy -= p.vy * Math.min(1, FRIC * DT);
  let sp = Math.hypot(p.vx, p.vy);
  if (sp > maxs) { p.vx *= maxs / sp; p.vy *= maxs / sp; sp = maxs; }
  if (sp < 2 && !ix && !iy) { p.vx = p.vy = 0; sp = 0; }
  p.x += p.vx * DT; p.y += p.vy * DT;
  if (aimFromVel && sp > 14) {
    const ax = Math.abs(p.vx) > Math.abs(p.vy) * 0.4 ? Math.sign(p.vx) : 0;
    const ay = Math.abs(p.vy) > Math.abs(p.vx) * 0.4 ? Math.sign(p.vy) : 0;
    p.ax = ax; p.ay = ay;
  }
  /* orientacion del cuerpo: hacia donde apunta o hacia donde patina */
  const busy = p.charging || p.strikeT > 0;
  if (!busy) {
    const a = p.look != null ? p.look : (p.ax || p.ay) ? Math.atan2(p.ay, p.ax) : p.hd;
    const va = sp > 20 ? Math.atan2(p.vy, p.vx) : a;
    const tgt = p.look != null || Math.abs(angDiff(va, a)) < 1.7 ? a : va;
    turnTo(p, tgt, puck.holder === p.i ? 7 : 9);
  }
  rinkClamp(p, 5, 0);
  cageBlock(p, 5);
  p.anim += sp * DT; p.speed = sp;
}

function separate() {
  for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) {
    const a = P[i], b = P[j];
    if (!a.active || !b.active) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
    if (d2 >= 81 || d2 < 0.0001) continue;
    const d = Math.sqrt(d2), push = 9 - d, nx = dx / d, ny = dy / d;
    const wa = a.role === 0 ? 0 : b.role === 0 ? 1 : 0.5, wb = 1 - wa;
    a.x -= nx * push * wa; a.y -= ny * push * wa;
    b.x += nx * push * wb; b.y += ny * push * wb;
  }
}

/* =================================================================
   DISCO: control, pases y tiros
   ================================================================= */
function take(p) {
  if (puck.last !== p.i) { puck.prev = puck.last; }
  puck.holder = p.i; puck.holdT = 0; puck.last = p.i; puck.h = 0; puck.vh = 0; puck.flying = 0;
}
function release(p) { puck.holder = -1; p.nograb = p.role ? 0.14 : 0.25; }

/* lanza el disco hacia (tx,ty) con altura objetivo ht al llegar */
function launch(p, tx, ty, spd, ht) {
  const dx = tx - puck.x, dy = ty - puck.y, d = Math.hypot(dx, dy) || 1;
  puck.vx = dx / d * spd; puck.vy = dy / d * spd;
  const T = d / spd;
  puck.h = 0.5;
  puck.vh = ht > 0.6 ? (ht - puck.h + 0.5 * GRAV * T * T) / T : 0;
  puck.flying = puck.vh > 0 ? 1 : 0;
  release(p);
}
function launchDir(p, ax, ay, spd, lift) {
  const n = Math.hypot(ax, ay) || 1;
  puck.vx = ax / n * spd; puck.vy = ay / n * spd;
  puck.h = 0.5; puck.vh = lift || 0; puck.flying = lift ? 1 : 0;
  release(p);
}

function steal(p) {
  const h = P[puck.holder];
  h.nograb = 0.45; h.charging = false; h.strikeT = 0;
  take(p); W.stealCd = 0.45; swingQuick(p, 0.5);
  sfx('steal');
}

/* PRESION: meter el stick al rival */
function startPoke(p) {
  if (p.pokeT > 0 || p.charging || p.strikeT > 0) return;
  p.pokeT = POKE; p.pokeHit = false; sfx('swish');
}
function pokeResolve(p) {
  p.pokeHit = true;
  const [bx, by] = blade(p);
  const h = puck.holder >= 0 ? P[puck.holder] : null;
  /* disco suelto al alcance: se lo queda */
  if (!h) { if (puck.h < 4 && Math.hypot(puck.x - bx, puck.y - by) < 8 && p.nograb <= 0) { take(p); sfx('steal'); } return; }
  if (h.team === p.team) return;
  const dp = Math.hypot(puck.x - bx, puck.y - by);
  const body = Math.min(Math.hypot(h.x - bx, h.y - by), dist(h, p));
  if (dp < 7.5 && h.role) {
    /* robo limpio: el disco sale suelto hacia delante del que presiona */
    h.nograb = 0.45; h.charging = false; h.strikeT = 0; puck.holder = -1;
    const a = p.hd + rand(-0.5, 0.5);
    puck.vx = Math.cos(a) * 90; puck.vy = Math.sin(a) * 90; puck.last = p.i;
    p.nograb = 0; W.stealCd = 0.3; sfx('steal');
    return;
  }
  if (body < 9) {
    const behind = Math.cos(h.hd) * (p.x - h.x) + Math.sin(h.hd) * (p.y - h.y) < 0;
    let ch = 0.3 + (behind ? 0.4 : 0) + (p.speed > 60 ? 0.15 : 0);
    if (!isHuman(p.team)) ch *= 0.18;
    if (Math.random() < ch && playersOn(p.team) > 4) callFoul(p, h);
    else { h.stumble = 0.3; h.vx *= 0.6; h.vy *= 0.6; sfx('board'); }
  }
}
function callFoul(p, victim) {
  W.state = S_FOUL; W.timer = 2.8; W.stats.fouls[p.team]++;
  W.foul = { off: p.i, team: p.team, x: p.x, y: p.y };
  victim.stumble = 0.8; victim.vx *= 0.3; victim.vy *= 0.3;
  if (puck.holder >= 0) puck.holder = -1;
  puck.vx *= 0.3; puck.vy *= 0.3;
  REF.arm = 0.01;
  setMsg('FALTA', 'EXCLUSIÓN 2 MIN · ' + TM(p.team).name + ' ' + p.num);
  sfx('whistle2');
}
function serveFoul() {
  const f = W.foul, p = P[f.off];
  p.active = false; p.penT = 120; p.charging = false; p.pokeT = 0;
  placeInBox(p);
  if (puck.holder === p.i) puck.holder = -1;
  /* saque en la zona defensiva del infractor, en el circulo mas cercano */
  const sx = f.team === 0 ? 96 : 304, sy = f.y < CY ? CY - 44 : CY + 44;
  W.foul = null;
  startFaceoff('', 'SUPERIORIDAD ' + TM(1 - f.team).name, sx, sy);
  W.timer = 1.6;
}
function placeInBox(p) {
  const n = P.filter(q => !q.active && q.team === p.team && q !== p).length;
  p.x = (p.team ? 230 : 170) + (p.team ? 1 : -1) * n * 8; p.y = -7; p.hd = Math.PI / 2; p.vx = p.vy = 0; p.speed = 0;
}
function penaltyTick(dtc) {
  for (const p of P) {
    if (p.active || p.penT <= 0) continue;
    p.penT -= dtc;
    if (p.penT <= 0) releasePen(p);
  }
}
function releasePen(p) {
  p.penT = 0; p.active = true; p.x = p.team ? 222 : 178; p.y = 8; p.vx = 0; p.vy = 6; p.hd = Math.PI / 2;
  hooks.msg('', 'VUELVE EL ' + p.num + ' DE ' + TM(p.team).name); W.msgT = 1.6;
}
const playersOn = t => P.filter(q => q.team === t && q.active).length;

function swingQuick(p, amp) { p.followT = 0.32; p.followAmp = amp; p.wind = 0; }

function bestMate(p, ax, ay, cone) {
  const first = p.team * 5 + 1;
  let best = null, bs = -1e9;
  for (let j = first; j < first + 4; j++) {
    if (j === p.i || !P[j].active) continue;
    const m = P[j], dx = m.x - p.x, dy = m.y - p.y;
    const along = dx * ax + dy * ay, perp = Math.abs(dx * ay - dy * ax);
    if (cone && (along <= 4 || perp * 1.5 >= along)) continue;
    const sc = along - perp * (cone ? 2 : 0.6);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}

function passTo(p, m) {
  const tx = m.x + m.vx * 0.3, ty = m.y + m.vy * 0.3;
  const d = Math.hypot(tx - puck.x, ty - puck.y);
  p.hd = Math.atan2(ty - p.y, tx - p.x);
  launch(p, tx, ty, Math.min(PASS, 90 + d * 1.5), 0);
  swingQuick(p, 0.55);
  sfx('pass');
}
function cpuPass(p) {
  const s = p.team ? -1 : 1;
  let ax = p.ax || s, ay = p.ay;
  const n = Math.hypot(ax, ay); ax /= n; ay /= n;
  const m = bestMate(p, ax * 0.6 + s * 0.4, ay * 0.6, false);
  if (m) passTo(p, m);
}
function humanPass(p) {
  let ax = p.ax, ay = p.ay;
  if (!ax && !ay) { ax = Math.cos(p.hd); ay = Math.sin(p.hd); }
  const n = Math.hypot(ax, ay);
  const m = bestMate(p, ax / n, ay / n, true);
  if (m) passTo(p, m);
  else { launchDir(p, ax, ay, PASS, 0); swingQuick(p, 0.55); sfx('pass'); }
}

/* --- tiro cargado: armado (carga), golpeo y acompanamiento --- */
function startCharge(p, kind, goal) {
  p.charging = true; p.charge = 0; p.windKind = kind; p.chargeGoal = goal || 0;
}
function startStrike(p) {
  p.charging = false;
  const k = Math.min(1, p.charge / CHG_MAX);
  p.shotPow = SHOT * (0.76 + 0.42 * k);       /* de 250 a 390 */
  p.wind = Math.max(0.25, k);
  p.strikeT = 0.07 + 0.05 * k;
  p.strikeT0 = p.strikeT;
}

/* objetivo del tiro humano: si apunta hacia la porteria rival va a puerta
   (recto: al centro; en diagonal: a la escuadra de ese lado) */
function humanShoot(p, pow, k) {
  const t = p.team, gx = atkGoal(t), s = gx === GR ? 1 : -1;
  let ax = p.ax, ay = p.ay;
  if (!ax && !ay) { ax = Math.round(Math.cos(p.hd)); ay = Math.round(Math.sin(p.hd)); }
  const dxg = gx - p.x, dyg = CY - p.y, adx = Math.abs(dxg), ady = Math.abs(dyg);
  W.stats.shots[t]++;
  const high = Math.random() < (k > 0.4 ? 0.75 : 0.35) ? rand(5.5, 11) : rand(0.6, 4.5);
  if (ax === s && adx > 10) {
    if (ay === 0 && ady <= adx * 0.9) { aimShot(p, gx + s * 3, CY + rand(-4, 4), pow, high); return; }
    if (ay !== 0 && dyg * ay >= -14 && ady <= adx * 2) { aimShot(p, gx + s * 3, CY + ay * 8, pow, high); return; }
  }
  p.hd = Math.atan2(ay, ax);
  launchDir(p, ax, ay, pow, k > 0.55 ? 18 : 0);
  shotFx(p);
}
function aimShot(p, tx, ty, pow, ht) {
  p.hd = Math.atan2(ty - p.y, tx - p.x);
  launch(p, tx, ty, pow, ht);
  shotFx(p);
}
function shotFx(p) { p.followT = 0.42; p.followAmp = 1; sfx(p.shotPow > 340 ? 'slap' : 'shot'); }

function cpuShoot(p, pow) {
  const t = p.team, gg = atkGoal(t), gx = gg + (gg === GR ? 3 : -3), g = P[t ? 0 : 5];
  let gy = g.y < CY ? GB - 2.5 : GT + 2.5;
  if (cpuVsHuman(t) && LV() < 4) gy += rand(-1, 1) * (4 - LV()) * 4;   /* en niveles faciles apunta peor */
  if (Math.random() < 0.3) gy = CY + rand(-6, 6);
  W.stats.shots[t]++;
  aimShot(p, gx, gy, pow * rand(0.9, 1), Math.random() < 0.55 ? rand(5.5, 11) : rand(0.6, 4));
}

function releaseShot(p) {
  if (puck.holder !== p.i) return;
  const k = Math.min(1, p.charge / CHG_MAX);
  if (p.windKind === 1) humanShoot(p, p.shotPow, k); else cpuShoot(p, p.shotPow);
}

/* =================================================================
   CONTROL HUMANO
   ================================================================= */
function nearest(t, excl) {
  let best = -1, bd = 1e9;
  for (let j = t * 5 + 1; j < t * 5 + 5; j++) {
    if (j === excl || !P[j].active) continue;
    const d = dist(P[j], puck);
    if (d < bd) { bd = d; best = j; }
  }
  return best;
}
function updateControl(t) {
  if (!P[W.human[t]].active) W.human[t] = nearest(t, -1);
  if (puck.holder >= 0 && P[puck.holder].team === t) {
    if (P[puck.holder].role) W.human[t] = puck.holder;
    return;
  }
  if (W.swcd[t] > 0) { W.swcd[t] -= DT; return; }
  const b = nearest(t, -1);
  if (b >= 0 && b !== W.human[t] && dist(P[b], puck) + 12 < dist(P[W.human[t]], puck)) { W.human[t] = b; W.swcd[t] = 0.33; }
}
function switchPlayer(t) {
  const b = nearest(t, W.human[t]);
  if (b >= 0) { W.human[t] = b; W.swcd[t] = 0.7; sfx('blip'); }
}

const DIR8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function humanCtl(p) {
  const t = p.team, I = inp[t];
  if (Math.hypot(I.x, I.y) > 0.3) {
    const o = Math.round(Math.atan2(I.y, I.x) / (Math.PI / 4));
    [p.ax, p.ay] = DIR8[(o + 8) % 8];
  }
  if (p.charging) {
    if (puck.holder !== p.i) p.charging = false;
    else {
      p.charge += DT;
      if (!I.shoot || p.charge > CHG_MAX + 0.35) startStrike(p);
    }
    return [I.x * 0.5, I.y * 0.5];
  }
  if (I.shootE) {
    if (puck.holder === p.i) startCharge(p, 1);
    else if (puck.holder >= 0) swingQuick(p, 0.4);
    else {
      const [bx, by] = blade(p);
      if (p.nograb <= 0 && puck.h < 4 && Math.hypot(puck.x - bx, puck.y - by) < 9) {   /* tiro a la primera */
        take(p); p.charge = CHG_MAX * 0.5; p.shotPow = SHOT; p.windKind = 1; humanShoot(p, SHOT, 0.5);
      } else swingQuick(p, 0.4);
    }
  }
  if (I.passE) { if (puck.holder === p.i) humanPass(p); else switchPlayer(t); }
  if (I.pressE && puck.holder !== p.i) startPoke(p);
  return [I.x, I.y];
}

/* =================================================================
   IA
   ================================================================= */
function steer(p, tx, ty, want) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  let dvx = 0, dvy = 0;
  if (d > 1.5) { const s = Math.min(want, d * 3.2); dvx = dx / d * s; dvy = dy / d * s; }
  return [clamp((dvx - p.vx) / 25, -1, 1), clamp((dvy - p.vy) / 25, -1, 1)];
}

/* --- lectura del juego --- */
/* linea libre entre dos puntos: ningun rival (salvo su portero, si se pide) a menos de r */
function laneOpen(t, ax, ay, bx, by, r, skipGoalie) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  for (const o of P) {
    if (o.team === t || !o.active || (skipGoalie && o.role === 0)) continue;
    const u = ((o.x - ax) * dx + (o.y - ay) * dy) / L2;
    if (u < 0.04 || u > 1) continue;
    if (Math.hypot(o.x - (ax + dx * u), o.y - (ay + dy * u)) < r) return false;
  }
  return true;
}
/* calidad de tiro desde (x,y): distancia, angulo y linea libre a algun palo */
function shotQ(t, x, y) {
  const gx = atkGoal(t), s = gx === GR ? 1 : -1, dx = (gx - x) * s, dy = Math.abs(y - CY);
  if (dx < 5) return 0;
  const d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  const q = clamp(1 - (d - 22) / 120, 0, 1) * clamp(1.15 - ang / 1.15, 0, 1);
  const open = laneOpen(t, x, y, gx, CY - 7, 4.5, true) || laneOpen(t, x, y, gx, CY + 7, 4.5, true);
  return open ? q : q * 0.3;
}
function oppNear(t, x, y, r) {
  let n = null, bd = r;
  for (const o of P) { if (o.team === t || !o.active) continue; const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; n = o; } }
  return n;
}
/* marcajes: cada defensa (no el que presiona) cubre a un atacante, por cercania */
function assignMarks(t) {
  const mine = P.filter(q => q.team === t && q.active && q.role && q.i !== W.chaser[t]);
  const theirs = P.filter(q => q.team !== t && q.active && q.role && q.i !== puck.holder);
  const pairs = [];
  for (const a of mine) for (const b of theirs) pairs.push([dist(a, b), a, b]);
  pairs.sort((x, y) => x[0] - y[0]);
  const used = new Set();
  for (const a of mine) a.mark = -1;
  for (const [, a, b] of pairs) { if (a.mark >= 0 || used.has(b.i)) continue; a.mark = b.i; used.add(b.i); }
}

function skaterAI(p) {
  const t = p.team, gx = atkGoal(t), s = gx === GR ? 1 : -1, h = puck.holder, own = gx === GR ? GL : GR;
  if (p.charging) {
    if (puck.holder !== p.i) { p.charging = false; return [0, 0]; }
    p.charge += DT;
    if (p.charge >= p.chargeGoal) startStrike(p);
    return [0, 0];
  }
  /* ---- con el disco ---- */
  if (h === p.i) {
    const q = shotQ(t, p.x, p.y);
    const toGoal = Math.atan2(CY - p.y, gx - p.x), facing = Math.cos(p.hd - toGoal) > 0.35;
    const press = oppNear(t, p.x + Math.cos(p.hd) * 8, p.y + Math.sin(p.hd) * 8, 15);
    if (puck.holdT > (q > 0.6 ? 0.06 : 0.22)) {
      if (facing && (q > 0.58 || (q > 0.32 && Math.random() < 2.2 * DT))) {
        startCharge(p, 2, q > 0.7 ? rand(0.03, 0.2) : rand(0.2, 0.55));
        p.ax = s; p.ay = 0; return [0, 0];
      }
      /* buscar pase a un companero desmarcado */
      let best = null, bv = q + (press ? 0.02 : 0.2) - Math.min(0.3, puck.holdT * 0.06);
      for (let j = t * 5 + 1; j < t * 5 + 5; j++) {
        const m = P[j];
        if (m === p || !m.active) continue;
        const d = dist(m, p);
        if (d < 22 || d > 190) continue;
        const mx = m.x + m.vx * 0.3, my = m.y + m.vy * 0.3;
        if (!laneOpen(t, p.x, p.y, mx, my, 7.5)) continue;
        const v = shotQ(t, mx, my) * 0.85 + (mx - p.x) * s / 500 - (oppNear(t, mx, my, 12) ? 0.35 : 0);
        if (v > bv) { bv = v; best = m; }
      }
      if (best && (press || puck.holdT > 0.5)) { passTo(p, best); return [0, 0]; }
      if (puck.holdT > 4) { cpuPass(p); return [0, 0]; }
    }
    /* conducir hacia el slot esquivando rivales */
    let tx = gx - s * 36, ty = CY + (p.y < CY ? -12 : 12);
    if ((tx - p.x) * s < 0) { tx = gx - s * 20; ty = CY + (p.y < CY ? -26 : 26); }
    let vx = tx - p.x, vy = ty - p.y; const n = Math.hypot(vx, vy) || 1; vx /= n; vy /= n;
    for (const o of P) {
      if (o.team === t || !o.active || o.role === 0) continue;
      const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
      const ahead = (o.x - p.x) * vx + (o.y - p.y) * vy;
      if (d < 34 && ahead > -6) { const k = 260 / (d * d + 30); vx += dx / d * k; vy += dy / d * k; }
    }
    return steer(p, p.x + vx * 30, p.y + vy * 30, 80);
  }
  const mineHas = h >= 0 && P[h].team === t, theirsHas = h >= 0 && P[h].team !== t;
  /* ---- el que presiona: va a por el disco, encarando al rival ---- */
  const second = theirsHas && p.i !== W.chaser[t] && (P[h].x - 200) * s < -40 && dist(p, P[h]) < 35 && p.mark === -1;
  if (((p.i === W.chaser[t] || p.i === W.help[t]) && !mineHas) || second) {
    let tx, ty;
    if (h < 0) {
      const k = clamp(dist(p, puck) / 260, 0.05, 0.35); tx = puck.x + puck.vx * k; ty = puck.y + puck.vy * k;
      p.look = Math.atan2(ty - p.y, tx - p.x);
      return steer(p, tx, ty, 92);
    }
    const o = P[h];
    /* se pone entre el disco y su porteria, con la pala apuntando al disco */
    const gxo = own + s * 6, dx = gxo - puck.x, dy = CY - puck.y, d = Math.hypot(dx, dy) || 1;
    tx = puck.x + dx / d * 4; ty = puck.y + dy / d * 4;
    p.look = Math.atan2(puck.y - p.y, puck.x - p.x);
    const near = Math.hypot(puck.x - p.x, puck.y - p.y) < 13 || dist(o, p) < 12;
    if (near && W.stealCd <= 0 && o.role) {
      const agg = cpuVsHuman(t) ? 0.4 + 0.15 * LV() : 1;
      if (Math.random() < STEAL_CPU * agg * DT) startPoke(p);
      else if (Math.random() < 0.55 * agg * agg * DT) { steal(p); return [0, 0]; }   /* levanta el stick y se la queda */
    }
    return steer(p, tx, ty, 92);
  }
  /* ---- defensa: marcaje al hombre por el lado de la porteria ---- */
  const looseOurs = h < 0 && (puck.x - 200) * s < -20;
  if (theirsHas || looseOurs) {
    const m = p.mark >= 0 ? P[p.mark] : null;
    if (m && m.active) {
      const k = clamp(0.22 + dist(m, puck) / 600, 0.22, 0.5);
      let tx = m.x + (own + s * 8 - m.x) * k, ty = m.y + (CY - m.y) * k;
      tx += (puck.x - tx) * 0.08; ty += (puck.y - ty) * 0.08;
      tx += Math.sin(W.gtime * 1.3 + p.i) * 3; ty += Math.cos(W.gtime * 1.1 + p.i) * 3;
      return steer(p, clamp(tx, 14, RL - 14), clamp(ty, 12, RW - 12), 82);
    }
    const F = FDEF[p.role];
    let tx = t ? RL - F[0] : F[0], ty = CY + (t ? -F[1] : F[1]);
    tx += (puck.x - 200) / 3; ty += (puck.y - CY) / 3;
    return steer(p, clamp(tx, 16, RL - 16), clamp(ty, 12, RW - 12), 78);
  }
  /* ---- ataque sin disco: buscar hueco ---- */
  if ((p.aiT = (p.aiT || 0) - DT) <= 0 || !p.tgt) {
    p.aiT = rand(0.25, 0.45);
    const F = FATT[p.role];
    let bx = t ? RL - F[0] : F[0], by = CY + (t ? -F[1] : F[1]);
    bx += (puck.x - 200) / 4; by += (puck.y - CY) / 5;
    /* el delantero mas adelantado ataca el slot para rebotes y tiros a la primera */
    if (p.role === 1 || p.role === 2) {
      const lead = P[t * 5 + 1].active && P[t * 5 + 2].active ? ((P[t * 5 + 1].x - P[t * 5 + 2].x) * s > 0 ? 1 : 2) : p.role;
      if (lead === p.role && (puck.x - 200) * s > 20) { bx = gx - s * 34; by = CY + (puck.y < CY ? 10 : -10); }
    }
    let bestV = -1e9, bt = [bx, by];
    for (const [ox, oy] of [[0, 0], [12, 0], [-12, 0], [0, 16], [0, -16], [10, 12], [10, -12]]) {
      const cx = clamp(bx + ox * s, 16, RL - 16), cy = clamp(by + oy, 12, RW - 12);
      const o = oppNear(t, cx, cy, 60), free = o ? Math.hypot(o.x - cx, o.y - cy) : 60;
      const lane = h >= 0 && laneOpen(t, P[h].x, P[h].y, cx, cy, 7) ? 25 : 0;
      const v = free + lane + shotQ(t, cx, cy) * 30 - Math.hypot(ox, oy) * 0.4;
      if (v > bestV) { bestV = v; bt = [cx, cy]; }
    }
    p.tgt = bt;
  }
  return steer(p, p.tgt[0] + Math.sin(W.gtime * 0.9 + p.i) * 7, p.tgt[1] + Math.cos(W.gtime * 1.1 + p.i * 2) * 6, 80);
}

function goalieAI(p) {
  const t = p.team, hx = p.gx || (t ? GR - 5 : GL + 5), right = hx > 200;
  p.hd = right ? Math.PI : 0; p.x = hx; p.vx = 0;
  if (puck.holder === p.i) {
    p.vy = 0;
    if (W.state !== S_PLAY) { if (puck.holdT > 0.9) cpuPass(p); return; }
    let mate = null, md = 34;
    for (let j = t * 5 + 1; j < t * 5 + 5; j++) { const m = P[j]; if (m.active && dist(m, p) < md && !oppNear(t, m.x, m.y, 10)) { md = dist(m, p); mate = m; } }
    if (mate && puck.holdT > 0.3) { passTo(p, mate); return; }
    if (puck.holdT > 0.7) {
      /* la retiene: pitido y saque en el circulo de su zona */
      sfx('whistle');
      const sx = right ? 304 : 96, sy = puck.y < CY ? CY - 44 : CY + 44;
      startFaceoff('', 'BLOCAJE DEL PORTERO', sx, sy); W.timer = 1.2;
    }
    return;
  }
  p.react -= DT;
  if (p.react <= 0) {
    p.react = 0.12;
    let ty = puck.y;
    if (Math.abs(puck.x - hx) > 230) ty = CY;
    else if (puck.holder < 0 && (right ? puck.vx > 20 : puck.vx < -20)) ty = puck.y + puck.vy * ((hx - puck.x) / puck.vx);
    p.ty = clamp(ty + rand(-3, 3), GT + 3, GB - 3);
  }
  const gs = GSPD * (cpuVsHuman(t) ? 0.85 + 0.0375 * LV() : 1);
  const dy = clamp(p.ty - p.y, -gs * DT, gs * DT);
  p.vy = dy / DT; p.y += dy; p.anim += Math.abs(dy); p.speed = Math.abs(p.vy);
}

/* =================================================================
   GOLES, PARADAS Y FISICA DEL DISCO
   ================================================================= */
function scoreGoal(t) {
  W.score[t]++;
  /* gol en superioridad: vuelve el castigado del equipo que lo encaja */
  if (playersOn(t) > playersOn(1 - t)) {
    const pen = P.filter(q => q.team === 1 - t && !q.active && q.penT > 0).sort((a, b) => a.penT - b.penT)[0];
    if (pen) { pen.penT = 0; pen.active = true; pen.x = pen.team ? 222 : 178; pen.y = 8; }
  }
  W.goalTeam = t; W.state = S_GOAL; W.timer = 4.6; puck.holder = -1;
  const sc = puck.last >= 0 && P[puck.last].team === t && P[puck.last].role ? P[puck.last] : null;
  const as = sc && puck.prev >= 0 && P[puck.prev].team === t && puck.prev !== sc.i ? P[puck.prev] : null;
  W.scorer = { t, num: sc ? sc.num : 0, assist: as ? as.num : 0 };
  for (const p of P) if (p.team === t && p.role) p.cele = 0.01;
  setMsg('GOL!', TM(t).goal);
  hooks.goal(t, W.scorer);
}

/* 0 nada, 1 gol, 2 rebote en porteria o poste */
function goalCheck(ox, oy) {
  for (const side of [0, 1]) {
    const gl = side ? GR : GL;
    /* postes */
    for (const py of [GT, GB]) {
      const dx = puck.x - gl, dy = puck.y - py, d = Math.hypot(dx, dy);
      if (d < 2.2 && d > 0.001 && puck.h < GH) {
        const nx = dx / d, ny = dy / d;
        puck.x = gl + nx * 2.2; puck.y = py + ny * 2.2;
        const vn = puck.vx * nx + puck.vy * ny;
        if (vn < 0) { puck.vx -= 1.7 * vn * nx; puck.vy -= 1.7 * vn * ny; }
        sfx('post'); return 2;
      }
    }
    const back = side ? GR + GD : GL - GD;
    const inX = side ? (puck.x >= gl && puck.x <= back + 1) : (puck.x <= gl && puck.x >= back - 1);
    if (!inX || puck.y < GT - 1 || puck.y > GB + 1) continue;
    const front = side ? ox < gl : ox > gl;
    if (front && oy > GT + 0.6 && oy < GB - 0.6) {
      if (puck.h < GH - 0.6) {
        puck.x = gl + (side ? 3 : -3); puck.vx *= 0.15; puck.vy *= 0.15; puck.vh = Math.min(puck.vh, 0);
        if (W.state === S_SO) soResult(1); else scoreGoal(side ? 0 : 1);
        return 1;
      }
      /* larguero o por encima: rebota */
      puck.x = ox; puck.vx = -puck.vx * 0.45; puck.vh = Math.abs(puck.vh) * 0.4 + 10;
      sfx(puck.h < GH + 1.5 ? 'post' : 'board'); return 2;
    }
    if (puck.h > GH + 1) continue;
    if (side ? ox > back + 1 : ox < back - 1) { puck.x = ox; puck.vx = -puck.vx * 0.5; }
    else if (!front) { puck.y = oy; puck.vy = -puck.vy * 0.5; }
    else { puck.x = ox; puck.vx = -puck.vx * 0.5; }
    sfx('board'); return 2;
  }
  return 0;
}

/* tipos de parada para la animacion del portero */
const SV_PAD = 1, SV_BUTTERFLY = 2, SV_GLOVE = 3, SV_BLOCK = 4, SV_DIVE = 5;
function grabCheck() {
  const sp = Math.hypot(puck.vx, puck.vy);
  for (const p of P) {
    if (p.nograb > 0 || !p.active) continue;
    if (Math.abs(puck.x - p.x) > 14 || Math.abs(puck.y - p.y) > 14) continue;
    if (p.role === 0) {
      const dx = puck.x - p.x, dy = puck.y - p.y, ady = Math.abs(dy);
      const guessed = p.guessT > 0 && p.guess && Math.sign(dy) === p.guess;
      if (Math.abs(dx) <= 4.5 && ady <= (guessed ? 14 : 10.5) && puck.h < 14) {
        if (!(p.guessT > 0)) {
          p.saveT = 0.55; p.saveDir = dy < 0 ? -1 : 1;
          const glove = (p.x > 200 ? -1 : 1) * p.saveDir > 0;   /* lado del guante */
          p.saveKind = ady > 7.5 ? SV_DIVE : puck.h > 4.5 ? (glove ? SV_GLOVE : SV_BLOCK) : ady < 4 ? SV_BUTTERFLY : SV_PAD;
        }
        if (sp < 130 && puck.h < 6) { take(p); sfx('save'); return true; }
        let chance = (ady < 5 ? SAVE_C : SAVE_E) + (isHuman(p.team) ? 0 : (TM(p.team).rate - 0.6) * 0.08);
        if (cpuVsHuman(p.team)) chance += (LV() - 4) * 0.07;            /* portero rival segun el nivel */
        else if (isHuman(p.team)) chance += (4 - LV()) * 0.03;          /* tu portero ayuda en niveles faciles */
        if (puck.h > 6 && ady > 5) chance *= 0.88;
        if (W.state === S_SO && !(p.guessT > 0)) chance = Math.min(0.93, chance + SO_BONUS);
        if (p.guessT > 0) { if (guessed) chance = Math.min(0.95, chance + 0.35); else if (!p.guess && puck.h < 4) chance += 0.25; else chance *= 0.25; }
        if (Math.random() < chance) {
          if (Math.random() < (p.saveKind === SV_GLOVE ? 0.75 : 0.25)) { take(p); sfx('save'); return true; }
          puck.vx = (Math.abs(puck.vx) * 0.35 + 70) * (p.x > 200 ? -1 : 1);
          puck.vy = (Math.random() < 0.5 ? -1 : 1) * rand(80, 140);
          puck.vh = puck.h > 3 ? rand(5, 20) : 0;
          p.nograb = 0.12; puck.last = p.i; sfx('save');
        } else p.nograb = 0.35;
        return false;
      }
    } else {
      const [bx, by] = blade(p);
      if (Math.hypot(puck.x - bx, puck.y - by) < 6 || Math.hypot(puck.x - p.x, puck.y - p.y) < 5) {
        if (puck.h > 9) continue;
        if (puck.h > 3) { puck.vx *= 0.4; puck.vy *= 0.4; puck.vh = -10; p.nograb = 0.1; puck.last = p.i; sfx('board'); return false; }
        if (sp < 190 || Math.random() < 0.35) { take(p); return true; }
        puck.vx *= 0.45; puck.vy *= 0.45; p.nograb = 0.08; puck.last = p.i; sfx('board');
        return false;
      }
    }
  }
  return false;
}

function puckPhys() {
  if (puck.holder >= 0) {
    const h = P[puck.holder], ox = puck.x, oy = puck.y;
    [puck.x, puck.y] = blade(h);
    puck.vx = h.vx; puck.vy = h.vy; puck.holdT += DT; puck.h = 0;
    rinkClamp(puck, 1.2, 0);
    const r = goalCheck(ox, oy);
    if (r === 2) { h.nograb = 0.2; puck.holder = -1; }
    return;
  }
  for (let s = 0; s < 4; s++) {
    const ox = puck.x, oy = puck.y, dt = DT / 4;
    puck.x += puck.vx * dt; puck.y += puck.vy * dt;
    if (puck.h > 0 || puck.vh > 0) {
      puck.h += puck.vh * dt; puck.vh -= GRAV * dt;
      if (puck.h <= 0) {
        puck.h = 0;
        if (puck.vh < -14) { puck.vh = -puck.vh * 0.32; sfx('tick'); } else { puck.vh = 0; puck.flying = 0; }
      }
    }
    if (rinkClamp(puck, 1.2, 0.72) && Math.hypot(puck.vx, puck.vy) > 60) sfx('board');
    if (goalCheck(ox, oy) === 1) return;
    if (grabCheck()) return;
  }
  if (puck.h <= 0) {
    const f = Math.pow(0.62, DT);
    puck.vx *= f; puck.vy *= f;
    if (Math.hypot(puck.vx, puck.vy) < 4) puck.vx = puck.vy = 0;
  }
}

function puckInNet() {
  const f = Math.pow(0.05, DT);
  puck.vx *= f; puck.vy *= f;
  puck.x += puck.vx * DT; puck.y += puck.vy * DT;
  puck.y = clamp(puck.y, GT + 2, GB - 2);
  if (puck.h > 0) { puck.vh -= GRAV * DT; puck.h = Math.max(0, puck.h + puck.vh * DT); }
}

/* =================================================================
   ANIMACION (valores que lee el dibujo)
   ================================================================= */
function animTick(p) {
  if (p.followT > 0) p.followT -= DT;
  if (p.saveT > 0) p.saveT -= DT;
  if (p.cele > 0) p.cele += DT;
  if (p.stumble > 0) p.stumble -= DT;
  if (p.guessT > 0) p.guessT -= DT;
  if (p.pokeT > 0) { p.pokeT -= DT; if (!p.pokeHit && p.pokeT <= POKE * 0.5 && W.state === S_PLAY) pokeResolve(p); }
  if (p.charging) {
    p.swing = -Math.min(1, p.charge / CHG_MAX) * 0.85 - 0.15;
  } else if (p.strikeT > 0) {
    const u = 1 - p.strikeT / (p.strikeT0 || 0.1);
    p.swing = -p.wind + p.wind * u;
  } else if (p.followT > 0) {
    const u = 1 - p.followT / 0.42;
    p.swing = (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75) * p.followAmp;
  } else p.swing *= Math.pow(0.001, DT);
}

/* el arbitro sigue el juego desde el lado lejano sin estorbar */
function refTick() {
  let tx, ty;
  if (W.state === S_FACE) { tx = W.fo.x; ty = W.fo.y - 5; REF.hd = Math.PI / 2; }
  else if (W.state === S_FOUL && W.foul) { tx = W.foul.x; ty = clamp(W.foul.y - 25, 10, RW - 10); }
  else { tx = clamp(puck.x - (puck.vx > 0 ? 25 : -25), 40, RL - 40); ty = puck.y > CY - 10 ? clamp(puck.y - 55, 10, 60) : clamp(puck.y + 55, 120, RW - 10); }
  const [ix, iy] = W.state === S_FACE ? [0, 0] : steer(REF, tx, ty, 60);
  if (W.state === S_FACE) { REF.x += (tx - REF.x) * 0.2; REF.y += (ty - REF.y) * 0.2; REF.speed = 0; }
  else {
    REF.vx += ix * ACC * DT * 0.7; REF.vy += iy * ACC * DT * 0.7;
    const sp = Math.hypot(REF.vx, REF.vy); if (sp > 60) { REF.vx *= 60 / sp; REF.vy *= 60 / sp; }
    REF.vx -= REF.vx * Math.min(1, FRIC * DT * 0.5); REF.vy -= REF.vy * Math.min(1, FRIC * DT * 0.5);
    REF.x += REF.vx * DT; REF.y += REF.vy * DT; REF.speed = Math.hypot(REF.vx, REF.vy); REF.anim += REF.speed * DT;
    const look = Math.atan2(puck.y - REF.y, puck.x - REF.x);
    REF.hd += clamp(angDiff(REF.hd, look), -6 * DT, 6 * DT);
    rinkClamp(REF, 5, 0); cageBlock(REF, 5);
  }
  if (W.state === S_FOUL) REF.arm = Math.min(1, REF.arm + DT * 4); else REF.arm = Math.max(0, REF.arm - DT * 3);
}

/* =================================================================
   BUCLE
   ================================================================= */
function updatePlay() {
  if (W.stealCd > 0) W.stealCd -= DT;
  for (const p of P) { if (p.nograb > 0) p.nograb -= DT; }
  for (const t of [0, 1]) {
    W.help[t] = -1;
    if (isHuman(t)) {
      updateControl(t); W.chaser[t] = W.human[t];
      /* los companeros del humano tambien van a por el disco suelto si estan mas cerca */
      if (puck.holder < 0) { const b = nearest(t, W.human[t]); if (b >= 0 && dist(P[b], puck) < dist(P[W.human[t]], puck) + 10) W.help[t] = b; }
    } else W.chaser[t] = nearest(t, -1);
    if (!isHuman(t) || true) assignMarks(t);
  }
  for (const p of P) {
    animTick(p);
    if (!p.active) continue;
    if (p.role === 0) { goalieAI(p); continue; }
    if (p.stumble > 0) { movePlayer(p, 0, 0, MAX_H, false); continue; }
    const hum = isHuman(p.team) && W.human[p.team] === p.i, carry = puck.holder === p.i;
    if (p.strikeT > 0) {
      p.strikeT -= DT;
      if (p.strikeT <= 0) releaseShot(p);
      movePlayer(p, 0, 0, MAX_H, false);
      continue;
    }
    let ix, iy;
    p.look = null;
    if (hum) [ix, iy] = humanCtl(p); else [ix, iy] = skaterAI(p);
    const lv = TM(p.team).rate - 0.6 + (cpuVsHuman(p.team) ? (LV() - 4) * 0.4 : 0);
    const maxs = p.charging ? MAX_CHG : hum ? (carry ? MAX_HP : MAX_H) : (carry ? MAX_CP : MAX_C) + lv * 8;
    movePlayer(p, ix, iy, maxs, !hum);
    if (W.state !== S_PLAY) return;
  }
  separate();
  puckPhys();
  refTick();
}

function coast() {
  for (const p of P) {
    animTick(p);
    if (!p.active) continue;
    if (p.role === 0) continue;
    if (p.cele > 0 && W.state === S_GOAL) {
      /* celebracion: los del equipo que marca se juntan en el goleador */
      const sc = P.find(q => q.team === p.team && q.num === (W.scorer && W.scorer.num)) || P[p.team * 5 + 1];
      const [ix, iy] = p === sc ? [0, 0] : steer(p, sc.x - (p.team ? -1 : 1) * 10, sc.y + (p.role - 2.5) * 8, 60);
      movePlayer(p, ix, iy, 60, true);
    } else movePlayer(p, 0, 0, MAX_H, false);
  }
}

function endPeriod() {
  sfx('horn');
  const tie = W.score[0] === W.score[1];
  if (W.period === 1) { setMsg('DESCANSO', 'FIN DEL PERIODO 1'); W.state = S_PEREND; W.timer = 3.2; }
  else if (W.period === 2 && tie) { setMsg('PRÓRROGA', '3 CONTRA 3 · GOL DE ORO'); W.state = S_PEREND; W.timer = 3.4; }
  else if (W.period === 3 && tie) { setMsg('PENALTIS', '3 POR EQUIPO Y MUERTE SÚBITA'); W.state = S_PEREND; W.timer = 3.4; W.toSO = true; }
  else finalWhistle();
}
function finalWhistle(extra) {
  const a = W.score[0], b = W.score[1];
  let w;
  if (W.so) { const pa = soCount(0), pb = soCount(1); w = 'GANAN ' + TM(pa > pb ? 0 : 1).name + '  ' + a + '-' + b + ' (PEN ' + pa + '-' + pb + ')'; W.winner = pa > pb ? 0 : 1; }
  else { w = (a === b ? 'EMPATE' : 'GANAN ' + TM(a > b ? 0 : 1).name) + '  ' + a + '-' + b + (W.period === 3 ? ' (PRÓRROGA)' : ''); W.winner = a === b ? -1 : a > b ? 0 : 1; }
  setMsg('FINAL', w);
  W.state = S_OVER; W.timer = 1.5;
  hooks.over();
}
function startOvertime() {
  W.period = 3; W.clock = 300;
  for (const p of P) { p.penT = 0; p.active = p.role !== 4; }
  startFaceoff('PRÓRROGA', 'EL PRIMER GOL GANA');
}

/* =================================================================
   TANDA DE PENALTIS: 3 por equipo y despues muerte subita
   ================================================================= */
const soCount = t => W.so ? W.so.kicks[t].reduce((a, b) => a + b, 0) : 0;
function startShootout() {
  W.state = S_SO; W.period = 4;
  W.so = { kicks: [[], []], turn: 0, phase: 'ready', t: 0, shooter: -1, keeper: -1, shot: false, shotT: 0, plan: null };
  soSetup();
}
function soSetup() {
  const S = W.so, t = S.turn, order = [1, 2, 3, 4];
  for (const p of P) { p.active = false; p.penT = 0; p.charging = false; p.strikeT = p.followT = p.pokeT = p.saveT = p.guessT = p.cele = 0; p.swing = 0; p.gx = 0; }
  const sh = P[t * 5 + order[S.kicks[t].length % 4]], kp = P[(1 - t) * 5];
  Object.assign(sh, { active: true, x: 150, y: CY, vx: 0, vy: 0, hd: 0, ax: 1, ay: 0, nograb: 0 });
  Object.assign(kp, { nograb: 0, active: true, gx: GR - 5, x: GR - 5, y: CY, ty: CY, vy: 0, hd: Math.PI });
  Object.assign(puck, { x: 156, y: CY, h: 0, vx: 0, vy: 0, vh: 0, holder: sh.i, holdT: 0, last: sh.i, prev: -1, flying: 0 });
  Object.assign(REF, { x: 200, y: 22, vx: 0, vy: 0, hd: Math.PI / 2, arm: 0, hold: 0 });
  S.shooter = sh.i; S.keeper = kp.i; S.phase = 'ready'; S.t = 0; S.shot = false; S.shotT = 0;
  S.plan = { deke: Math.random() < 0.5, side: Math.random() < 0.5 ? -1 : 1, lane: rand(-14, 14) };
  W.human[t] = sh.i;
  const round = S.kicks[t].length + 1;
  setMsg('PENALTI ' + (round <= 3 ? round + ' DE 3' : '· MUERTE SÚBITA'), TM(t).name + ' · ' + sh.num + (isHuman(1 - t) ? '   (PARA: ↑↓ Y TIRO)' : ''));
}
function soResult(g) {
  const S = W.so;
  if (S.phase !== 'live') return;
  S.kicks[S.turn].push(g ? 1 : 0); S.phase = 'res'; S.t = 0; S.goal = !!g;
  setMsg(g ? 'GOL!' : 'PARADA', TM(S.turn).name + '  ' + soCount(0) + ' - ' + soCount(1) + '  ' + TM(1).name);
  if (g) { const sh = P[S.shooter]; sh.cele = 0.01; hooks.goal(S.turn, { t: S.turn, num: sh.num, assist: 0, so: true }); }
  else sfx('save');
}
function soDecided() {
  const S = W.so, a = soCount(0), b = soCount(1), n0 = S.kicks[0].length, n1 = S.kicks[1].length;
  if (n0 <= 3 && n1 <= 3) { if (a + (3 - n0) < b || b + (3 - n1) < a) return true; }
  return n0 === n1 && n0 >= 3 && a !== b;
}
function cpuShooter(p) {
  const S = W.so, pl = S.plan;
  if (p.charging) { p.charge += DT; if (p.charge >= p.chargeGoal) startStrike(p); return [0, 0]; }
  if (!pl.deke) {
    if (p.x > GR - 75) { startCharge(p, 2, rand(0.15, 0.45)); p.ax = 1; p.ay = 0; return [0, 0]; }
    return steer(p, GR - 60, CY + pl.lane, 80);
  }
  if (p.x < GR - 55) return steer(p, GR - 40, CY + pl.lane * 0.5, 80);
  if (p.x > GR - 34 || Math.abs(p.y - (CY + pl.side * 16)) < 4) { startCharge(p, 2, 0.02); p.ax = 1; p.ay = 0; return [0, 0]; }
  return steer(p, GR - 24, CY + pl.side * 16, 85);
}
function keeperCtl(p) {
  const I = inp[p.team];
  p.x = p.gx; p.hd = Math.PI; p.vx = 0;
  if (p.saveT <= 0) {
    const dy = clamp(I.y * GSPD * 1.1 * DT, -GSPD * DT, GSPD * DT);
    p.y = clamp(p.y + dy, GT + 2, GB - 2); p.vy = dy / DT; p.anim += Math.abs(dy); p.speed = Math.abs(p.vy);
  }
  if (I.shootE && p.guessT <= 0) {
    const g = Math.abs(I.y) > 0.3 ? Math.sign(I.y) : 0;
    p.guess = g; p.guessT = 0.65; p.saveT = 0.6; p.saveDir = g || 1;
    p.saveKind = g ? SV_DIVE : SV_BUTTERFLY;
    if (g) p.y = clamp(p.y + g * 4, GT + 2, GB - 2);
  }
}
function soTick() {
  const S = W.so, sh = P[S.shooter], kp = P[S.keeper];
  for (const p of P) { animTick(p); if (p.nograb > 0 && p.nograb < 50) p.nograb -= DT; }
  S.t += DT;
  if (S.phase === 'ready') { if (S.t > 1.8) { S.phase = 'live'; S.t = 0; sfx('whistle'); setMsg(W.msg1, ''); } return; }
  if (S.phase === 'live') {
    if (sh.strikeT > 0) { sh.strikeT -= DT; if (sh.strikeT <= 0) releaseShot(sh); movePlayer(sh, 0, 0, MAX_H, false); }
    else {
      const hum = isHuman(sh.team);
      const [ix, iy] = S.shot ? [0, 0] : hum ? humanCtl(sh) : cpuShooter(sh);
      movePlayer(sh, ix, iy, sh.charging ? MAX_CHG : (hum ? MAX_HP : 80), !hum);
    }
    if (isHuman(kp.team)) keeperCtl(kp); else goalieAI(kp);
    puckPhys();
    if (S.phase !== 'live') return;
    if (!S.shot && puck.holder !== sh.i) { S.shot = true; S.shotT = 0; sh.nograb = 99; }
    if (S.shot) {
      S.shotT += DT;
      const sp = Math.hypot(puck.vx, puck.vy);
      if (puck.holder === kp.i || S.shotT > 1.8 || (S.shotT > 0.35 && sp < 10) || puck.x < 150) soResult(0);
    } else if (S.t > 9 || sh.x > GR + 2) soResult(0);
    return;
  }
  /* resultado: pausa y siguiente lanzamiento */
  if (S.goal) puckInNet();
  if (S.t > 2.2) {
    if (soDecided()) { finalWhistle(); return; }
    S.turn = 1 - S.turn; soSetup();
  }
}

function step() {
  W.gtime += DT;
  switch (W.state) {
    case S_FACE:
      faceoffTick();
      break;
    case S_PLAY: {
      updatePlay();
      if (W.msgT > 0 && (W.msgT -= DT) <= 0) setMsg();
      const dtc = DT * 1200 / opt.len;
      if (W.state === S_PLAY) { penaltyTick(dtc); if ((W.clock -= dtc) <= 0) { W.clock = 0; endPeriod(); } }
      break;
    }
    case S_FOUL:
      coast(); refTick();
      for (const p of P) if (p.active && p.role) p.vx *= 0.95;
      if ((W.timer -= DT) <= 0) serveFoul();
      break;
    case S_GOAL:
      coast(); puckInNet();
      if ((W.timer -= DT) <= 0) { setMsg(); for (const p of P) p.cele = 0; if (W.period === 3) finalWhistle(); else if (W.clock <= 0) endPeriod(); else startFaceoff('', ''); }
      break;
    case S_PEREND:
      coast();
      if ((W.timer -= DT) <= 0) {
        if (W.toSO) { W.toSO = false; startShootout(); }
        else if (W.period === 2) startOvertime();
        else { W.period++; W.clock = 1200; startFaceoff('PERIODO 2', 'PREPARADOS...'); }
      }
      break;
    case S_SO:
      soTick();
      break;
    case S_OVER:
      coast(); W.timer -= DT;
      break;
  }
}

return { DT, RL, RW, CY, RCR, GL, GR, GD, GT, GB, GH, CHG_MAX, POKE, TEAMS, TM, opt, W, P, REF, puck, inp, hooks, isHuman, blade, playersOn,
  S_FACE, S_PLAY, S_GOAL, S_PEREND, S_OVER, S_FOUL, S_SO, soCount, SV_PAD, SV_BUTTERFLY, SV_GLOVE, SV_BLOCK, SV_DIVE,
  newGame, faceoff, step, setSave(c, e) { SAVE_C = c; SAVE_E = e; }, setSO(b) { SO_BONUS = b; } };
})();
if (typeof module !== 'undefined') module.exports = G;
