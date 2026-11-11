/* =================================================================
   INTERFAZ: sonido, entrada (tactil, teclado, mandos), menus, bucle
   ================================================================= */
(() => {
'use strict';
const { W, P, opt, inp, TEAMS } = G;
const $ = id => document.getElementById(id);
const DT = G.DT;

/* ---------------- sonido sintetizado ---------------- */
let AC = null, master = null, noiseBuf = null, crowd = null, crowdLvl = 0.05;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.6; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    /* ambiente de publico */
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
    g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start();
    crowd = g;
    musBus = AC.createGain(); musBus.gain.value = 0; musBus.connect(master);
  } catch (e) { AC = null; }
}

/* =================================================================
   MUSICA DE PABELLON (original): ritmo de fondo, organo y "DE-FENSA"
   ================================================================= */
let musBus = null, musicOn = true;
const MUS = { next: 0, step: 0, bpm: 102, lastChant: 0, zoneT: 0, prevState: -1 };
const NF = n => 440 * Math.pow(2, (n - 69) / 12);         /* nota MIDI -> Hz */
function mTone(f, dur, type, vol, t, f2, filt) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  let node = o;
  if (filt) { const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); node = fl; }
  node.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.02);
}
function mNoise(dur, vol, freq, type, t, dest) {
  const sN = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  sN.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  sN.connect(f); f.connect(g); g.connect(dest || musBus); sN.start(t, Math.random()); sN.stop(t + dur + 0.02);
}
/* organo de pabellon: varios armonicos con un poco de vibrato */
function organ(n, dur, t, vol = 0.05) {
  for (const [h, v] of [[1, 1], [2, 0.6], [3, 0.35], [4, 0.2]]) mTone(NF(n) * h, dur, 'sine', vol * v, t);
}
const BASS = [38, 38, 34, 36];                  /* re, re, si bemol, do (graves) */
function musicStep(t, st) {
  const bar = (st >> 4) & 3, s16 = st & 15;
  if ([0, 6, 8, 11].includes(s16)) mTone(150, 0.22, 'sine', 0.55, t, 45);                  /* bombo */
  if (s16 === 4 || s16 === 12) { mNoise(0.16, 0.32, 1800, 'bandpass', t); mTone(190, 0.08, 'triangle', 0.12, t); }  /* caja y palmas */
  if (!(s16 & 1)) mNoise(s16 === 14 ? 0.12 : 0.035, 0.1, 7500, 'highpass', t);           /* charles */
  if ([0, 3, 6, 8, 10, 14].includes(s16)) mTone(NF(BASS[bar] + (s16 === 10 ? 12 : 0)), 0.18, 'sawtooth', 0.12, t, 0, 420);
  if (bar === 3 && s16 === 12) { organ(62, 0.12, t); organ(65, 0.12, t + 0.15); organ(69, 0.25, t + 0.3); }
}
/* riff de organo en las paradas (saques, faltas) */
function organRiff() {
  if (!AC || !musicOn) return;
  const t = AC.currentTime + 0.05, u = 0.11;
  [62, 65, 69, 72, 69, 65, 74].forEach((n, i) => organ(n, u * 0.9, t + i * u, 0.06));
  [62, 66, 69].forEach(n => organ(n, 0.6, t + 7 * u, 0.04));
}
/* el publico canta DE-FENSA cuando el rival ataca */
function chant() {
  if (!AC) return;
  const t = AC.currentTime + 0.02;
  for (let r = 0; r < 2; r++) {
    const b = t + r * 1.2;
    mNoise(0.22, 0.5, 520, 'bandpass', b, master); mNoise(0.32, 0.45, 380, 'bandpass', b + 0.32, master);
    mNoise(0.05, 0.6, 2500, 'highpass', b + 0.75, master); mNoise(0.05, 0.6, 2500, 'highpass', b + 0.95, master);
  }
}
function musicTick(dt) {
  if (!AC || !musBus) return;
  const inGame = scene === 'game' && !paused && !overShown;
  const play = inGame && musicOn && W.state === G.S_PLAY && !replay;
  const target = !musicOn ? 0 : play ? 0.32 : inGame ? 0.12 : scene === 'title' ? 0.22 : 0;
  musBus.gain.value += (target - musBus.gain.value) * 0.05;
  if (musicOn && (inGame || scene === 'title') && musBus.gain.value > 0.01) {
    const sp = 60 / MUS.bpm / 4;
    if (MUS.next < AC.currentTime) MUS.next = AC.currentTime + 0.05;
    while (MUS.next < AC.currentTime + 0.15) { musicStep(MUS.next, MUS.step++); MUS.next += sp; }
  }
  /* riff en paradas */
  if (inGame && W.state !== MUS.prevState) {
    if ((W.state === G.S_FACE && W.period < 4 && MUS.prevState !== -1) || W.state === G.S_FOUL) organRiff();
    MUS.prevState = W.state;
  }
  /* DE-FENSA: el rival lleva un rato en nuestra zona */
  if (inGame && W.state === G.S_PLAY && G.puck.x < 130 && (G.puck.holder < 0 || P[G.puck.holder].team === 1)) MUS.zoneT += dt; else MUS.zoneT = 0;
  if (MUS.zoneT > 1.5 && W.gtime - MUS.lastChant > 8) { MUS.lastChant = W.gtime; chant(); }
}
function tone(f, dur, type, vol, when = 0, f2 = 0) {
  if (!AC) return;
  const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, ftype = 'lowpass', when = 0, attack = 0) {
  if (!AC) return;
  const t = AC.currentTime + when, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = ftype; f.frequency.value = freq;
  if (attack) { g.gain.setValueAtTime(0.0008, t); g.gain.linearRampToValueAtTime(vol, t + attack); }
  else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
function whistle(long) {
  if (!AC) return;
  const t = AC.currentTime, L = long ? 1.1 : 0.45;
  [2650, 2790].forEach(fq => {
    const o = AC.createOscillator(), g = AC.createGain(), l = AC.createOscillator(), lg = AC.createGain();
    o.frequency.value = fq; l.frequency.value = 28; lg.gain.value = 70;
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0008, t); g.gain.linearRampToValueAtTime(0.09, t + 0.03);
    g.gain.setValueAtTime(0.09, t + L - 0.08); g.gain.linearRampToValueAtTime(0.0008, t + L);
    o.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + L + 0.02); l.stop(t + L + 0.02);
  });
}
const SFX = {
  shot() { noise(0.12, 0.7, 2600, 'bandpass'); tone(120, 0.09, 'square', 0.22, 0, 55); },
  slap() { noise(0.16, 0.95, 2000, 'bandpass'); tone(95, 0.12, 'square', 0.3, 0, 45); noise(0.05, 0.5, 5000, 'highpass'); },
  pass() { noise(0.05, 0.4, 3200, 'bandpass'); tone(620, 0.04, 'square', 0.1); },
  board() { noise(0.16, 0.6, 420); tone(85, 0.11, 'triangle', 0.35); },
  post() { tone(1900, 0.45, 'square', 0.12, 0, 1820); tone(2850, 0.3, 'sine', 0.12); crowdLvl = Math.max(crowdLvl, 0.16); },
  save() { noise(0.1, 0.55, 900); tone(170, 0.08, 'square', 0.2); crowdLvl = Math.max(crowdLvl, 0.12); },
  steal() { tone(300, 0.07, 'square', 0.14, 0, 560); },
  tick() { tone(1400, 0.03, 'square', 0.05); },
  blip() { tone(880, 0.05, 'square', 0.1); },
  whistle() { whistle(false); },
  whistle2() { whistle(true); crowdLvl = Math.max(crowdLvl, 0.14); },
  swish() { noise(0.09, 0.25, 1800, 'bandpass'); },
  horn() { [233, 294, 349].forEach(f => tone(f, 1.3, 'sawtooth', 0.07)); },
};
const sfx = n => { if (AC && SFX[n] && !opt.demo) SFX[n](); };
/* musica de gol de los Linces: bocina + canto de grada original */
function goalMusic(home) {
  if (!AC) return;
  crowdLvl = home ? 0.32 : 0.1;
  [[0, 0.8], [0.95, 0.65]].forEach(([w, d]) => [233, 294, 349].forEach(f => tone(f, d, 'sawtooth', 0.07, w)));
  if (!home) return;
  noise(4.2, 0.2, 1100, 'lowpass', 0, 0.4);
  const N = { D: 293.7, A: 220, C: 261.6, F: 349.2, E: 329.6, G: 196 };
  const song = 'D1 D1 D2 A1 C1 D2 F1 E1 D1 C1 D4 -1 D1 D1 D2 A1 C1 D2 F1 E1 C1 G1 A5'.split(' ');
  let t = 1.75; const u = 0.115;
  for (const s of song) {
    const n = s[0], l = +s.slice(1) * u;
    if (n !== '-') { tone(N[n], l * 0.92, 'square', 0.1, t); tone(N[n] / 2, l * 0.92, 'square', 0.07, t); if (l >= 2 * u) noise(0.07, 0.35, 1600, 'bandpass', t); }
    t += l;
  }
}

/* ---------------- escenas y menus ---------------- */
let scene = 'splash', splashT = 0, paused = false, overShown = false;
const screens = ['splash', 'title', 'pause', 'over', 'table'];
const CR = window.CRESTS || {};
const crestOf = i => CR[TEAMS[i].crest] || '';

/* =================================================================
   LIGA: 12 equipos, todos contra todos (11 jornadas)
   ================================================================= */
const LKEY = 'hockey-linces-liga';
let LG = null;
function newLeague() {
  const n = TEAMS.length, arr = [...Array(n).keys()], sched = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push(r % 2 ? [arr[n - 1 - i], arr[i]] : [arr[i], arr[n - 1 - i]]);
    sched.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  const table = TEAMS.map(() => ({ pj: 0, g: 0, p: 0, gf: 0, gc: 0, pts: 0 }));
  LG = { round: 0, sched, table, last: [] };
  saveLeague();
}
function saveLeague() { try { localStorage.setItem(LKEY, JSON.stringify(LG)); } catch (e) { } }
function loadLeague() { try { const o = JSON.parse(localStorage.getItem(LKEY) || 'null'); if (o && o.sched && o.table && o.table.length === TEAMS.length) LG = o; } catch (e) { } if (!LG) newLeague(); }
const lgOver = () => LG.round >= LG.sched.length;
function lgRival() { if (lgOver()) return -1; const pr = LG.sched[LG.round].find(p => p.includes(0)); return pr[0] === 0 ? pr[1] : pr[0]; }
/* resultado: victoria 3 puntos; en prorroga o penaltis 2 al ganador y 1 al perdedor */
function addResult(a, b, ga, gb, extra, winA) {
  const A = LG.table[a], B = LG.table[b];
  A.pj++; B.pj++; A.gf += ga; A.gc += gb; B.gf += gb; B.gc += ga;
  const wa = winA != null ? winA : ga > gb;
  if (wa) { A.g++; B.p++; A.pts += extra ? 2 : 3; B.pts += extra ? 1 : 0; }
  else { B.g++; A.p++; B.pts += extra ? 2 : 3; A.pts += extra ? 1 : 0; }
}
function poisson(l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function simMatch(a, b) {
  const ra = TEAMS[a].rate, rb = TEAMS[b].rate;
  let ga = poisson(Math.max(0.6, 2.8 + 2.2 * (ra - rb))), gb = poisson(Math.max(0.6, 2.8 + 2.2 * (rb - ra)));
  let extra = false, winA = null;
  if (ga === gb) { extra = true; winA = Math.random() < 0.5 + (ra - rb) * 0.4; }
  addResult(a, b, ga, gb, extra, winA);
  return [a, b, ga, gb, extra, winA];
}
function finishLeagueMatch() {
  const rv = lgRival(); if (rv < 0) return;
  const a = W.score[0], b = W.score[1], extra = W.period >= 3, winA = W.winner === 0;
  LG.last = [[0, rv, a, b, extra, winA]];
  addResult(0, rv, a, b, extra, winA);
  for (const [x, y] of LG.sched[LG.round]) if (x !== 0 && y !== 0) LG.last.push(simMatch(x, y));
  LG.round++; saveLeague();
}
function standings() {
  return TEAMS.map((T, i) => Object.assign({ i }, LG.table[i])).sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf);
}
function showTable() {
  const rows = standings();
  const pos = rows.findIndex(r => r.i === 0) + 1;
  $('tblTitle').textContent = lgOver() ? `LIGA TERMINADA · LINCES ${pos}º` : `LIGA · JORNADA ${Math.min(LG.round + 1, LG.sched.length)} DE ${LG.sched.length}`;
  let h = '<tr><th>#</th><th class="n">EQUIPO</th><th>PJ</th><th>G</th><th>P</th><th>GF</th><th>GC</th><th>PTS</th></tr>';
  rows.forEach((r, k) => { h += `<tr class="${r.i === 0 ? 'me' : ''}"><td>${k + 1}</td><td class="n"><img src="${crestOf(r.i)}" alt="">${TEAMS[r.i].full}</td><td>${r.pj}</td><td>${r.g}</td><td>${r.p}</td><td>${r.gf}</td><td>${r.gc}</td><td class="pts">${r.pts}</td></tr>`; });
  $('tbl').innerHTML = h;
  tableFrom = screens.find(id => !$(id).hidden) || 'title';
  show('table');
}
let tableFrom = 'title', newLgArmed = false;
function show(id) { for (const s of screens) $(s).hidden = s !== id; focusIdx = 0; focusFirst(); }

function savePrefs() { try { localStorage.setItem('hockey-linces-v', JSON.stringify({ rival: friendlyRival, two: opt.two, len: opt.len, cam: R3.cam.mode, music: musicOn, league: opt.league, level: opt.level })); } catch (e) { } }
let friendlyRival = 1;
function loadPrefs() {
  try {
    const o = JSON.parse(localStorage.getItem('hockey-linces-v') || '{}');
    if (o.rival >= 1 && o.rival < TEAMS.length) friendlyRival = o.rival;
    opt.league = !!o.league; if (o.level >= 1 && o.level <= 5) opt.level = o.level;
    opt.two = !!o.two; if (o.music === false) musicOn = false; if ([120, 180, 300].includes(o.len)) opt.len = o.len; if (o.cam >= 0 && o.cam < 3) R3.cam.mode = o.cam;
  } catch (e) { }
}
const LENS = [120, 180, 300];
function refreshTitle() {
  if (!LG) loadLeague();
  const lg = opt.league, rv = lg ? lgRival() : friendlyRival;
  opt.rival = rv > 0 ? rv : friendlyRival;
  const T = TEAMS[opt.rival];
  $('mode').textContent = opt.two ? '2 JUGADORES' : '1 JUGADOR';
  $('comp').textContent = lg ? 'LIGA' : 'AMISTOSO';
  $('rivalLbl').textContent = lg ? (rv > 0 ? 'JORNADA ' + (LG.round + 1) : 'LIGA') : 'RIVAL';
  $('rivL').style.visibility = $('rivR').style.visibility = lg ? 'hidden' : 'visible';
  $('rivalName').textContent = lg && rv < 0 ? 'TERMINADA' : T.name;
  $('rivalName').style.color = lg && rv < 0 ? 'var(--gold)' : T.hud;
  $('rivalCrest').src = lg && rv < 0 ? crestOf(0) : crestOf(opt.rival);
  $('tblBtn').hidden = !lg;
  $('playBtn').textContent = lg ? (rv < 0 ? 'NUEVA LIGA' : 'JUGAR') : 'JUGAR';
  $('len').textContent = `${opt.len / 60} MIN`;
  $('mus').textContent = musicOn ? 'SÍ' : 'NO';
  $('lvl').innerHTML = `<b class="dots">${'●'.repeat(opt.level)}<i>${'●'.repeat(5 - opt.level)}</i></b> ${['MUY FÁCIL', 'FÁCIL', 'NORMAL', 'DIFÍCIL', 'MUY DIFÍCIL'][opt.level - 1]}`;
  $('help').textContent = touch ? (opt.two ? 'Cada jugador usa su lado de la pantalla' : 'Mantén TIRO para cargar · PRESIÓN roba, pero puede ser falta') : 'Cursores · ESPACIO tiro (mantén para cargar) · M pase · B presión · C cámara · P pausa';
}
function changeRival(d) { if (opt.league) return; friendlyRival = (friendlyRival - 1 + d + TEAMS.length - 1) % (TEAMS.length - 1) + 1; sfx2('blip'); savePrefs(); refreshTitle(); }
const sfx2 = n => { if (AC && SFX[n]) SFX[n](); };
const ACT = {
  mode() { opt.two = !opt.two; sfx2('blip'); savePrefs(); refreshTitle(); },
  music() { musicOn = !musicOn; sfx2('blip'); savePrefs(); refreshTitle(); const b = $('pauseMus'); if (b) b.textContent = 'MÚSICA: ' + (musicOn ? 'SÍ' : 'NO'); },
  rivalL() { changeRival(-1); }, rivalR() { changeRival(1); },
  len(d = 1) { opt.len = LENS[(LENS.indexOf(opt.len) + (d > 0 ? 1 : 2)) % 3]; sfx2('blip'); savePrefs(); refreshTitle(); },
  play() { if (opt.league && lgOver()) { newLeague(); refreshTitle(); sfx2('blip'); return; } startGame(); },
  levelCycle() { opt.level = opt.level % 5 + 1; sfx2('blip'); savePrefs(); refreshTitle(); },
  comp() { opt.league = !opt.league; sfx2('blip'); savePrefs(); refreshTitle(); },
  level(d = 1) { opt.level = Math.min(5, Math.max(1, opt.level + (d > 0 ? 1 : -1))); if (d > 0 && opt.level === 5 && this._wrap) { } sfx2('blip'); savePrefs(); refreshTitle(); },
  table() { showTable(); sfx2('blip'); },
  closeTable() { newLgArmed = false; $('newLg').textContent = 'NUEVA LIGA'; show(tableFrom === 'table' ? 'title' : tableFrom); if (tableFrom === 'title') refreshTitle(); },
  newLeague() {
    /* doble pulsacion para no borrar la liga sin querer */
    if (!newLgArmed) { newLgArmed = true; $('newLg').textContent = '¿SEGURO? PULSA OTRA VEZ'; return; }
    newLgArmed = false; $('newLg').textContent = 'NUEVA LIGA'; newLeague(); showTable(); refreshTitle();
  },
  resume() { setPause(false); },
  cam() { cycleCam(); },
  quit() { setPause(false); toTitle(); },
  again() { toTitle(); },
};
function cycleCam() { R3.cam.mode = (R3.cam.mode + 1) % 3; $('camBtn').textContent = R3.CAMS[R3.cam.mode]; const pc = $('pauseCam'); if (pc) pc.textContent = 'CÁMARA: ' + R3.CAMS[R3.cam.mode]; savePrefs(); sfx2('blip'); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  audioInit(); const a = b.dataset.act; if (ACT[a]) ACT[a](+(b.dataset.dir || 1));
});

/* navegacion con teclado o mando por los botones del menu visible */
let focusIdx = 0;
function menuButtons() { const s = screens.find(id => !$(id).hidden); return s ? [...$(s).querySelectorAll('[data-nav]')] : []; }
function focusFirst() { const b = menuButtons(); if (b.length && !touch) b[Math.min(focusIdx, b.length - 1)].focus({ preventScroll: true }); }
function menuMove(d) { const b = menuButtons(); if (!b.length) return; focusIdx = (focusIdx + d + b.length) % b.length; b[focusIdx].focus({ preventScroll: true }); sfx2('blip'); }
function menuSide(d) { const b = menuButtons()[focusIdx]; if (!b) return; const a = b.dataset.side; if (a === 'rival') changeRival(d); else if (a && ACT[a]) ACT[a](d); }
function menuOk() { const b = menuButtons()[focusIdx]; if (b) b.click(); }

function startGame() {
  audioInit(); sfx2('whistle');
  if (touch && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { });
  }
  opt.demo = false; opt.p2idle = false; p2Last = 0; overShown = false; RB.length = 0; replay = null; R3.cam.replay = null; $('replay').hidden = true;
  G.newGame(); R3.snap(); R3.confetti.length = 0;
  scene = 'game'; paused = false; show(null);
  $('hud').hidden = false; $('camBtn').textContent = R3.CAMS[R3.cam.mode];
  layoutControls();
}
function toTitle() {
  if (replay) endReplay();
  scene = 'title'; opt.demo = true; G.newGame(); R3.confetti.length = 0;
  $('hud').hidden = true; $('goal').classList.remove('on'); banner('', '');
  show('title'); refreshTitle();
}
function setPause(v) {
  if (scene !== 'game' || W.state === G.S_OVER) return;
  paused = v; show(v ? 'pause' : null);
  if (v) { $('pauseCam').textContent = 'CÁMARA: ' + R3.CAMS[R3.cam.mode]; $('pauseMus').textContent = 'MÚSICA: ' + (musicOn ? 'SÍ' : 'NO'); }
}

/* ---------------- marcador y mensajes ---------------- */
function banner(a, b) {
  const el = $('banner');
  $('m1').textContent = a; $('m2').textContent = b;
  el.classList.toggle('on', !!(a || b) && a !== 'GOL!');
}
function fmtClock(c) { c = Math.max(0, Math.ceil(c)); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; }
let hudCache = '';
function updateHUD() {
  const T0 = G.TM(0), T1 = G.TM(1);
  const pens = P.filter(p => !p.active && p.penT > 0);
  const key = [W.score[0], W.score[1], W.period, Math.ceil(W.clock), opt.rival, W.so ? JSON.stringify(W.so.kicks) : '', pens.map(p => p.i + ':' + Math.ceil(p.penT)).join(',')].join('|');
  if (key === hudCache) return; hudCache = key;
  $('t0').textContent = T0.name; $('t1').textContent = T1.name;
  $('c0').style.background = T0.main; $('c1').style.background = T1.main;
  if ($('k0').dataset.t !== T0.crest) { $('k0').src = CR[T0.crest] || ''; $('k0').dataset.t = T0.crest; }
  if ($('k1').dataset.t !== T1.crest) { $('k1').src = CR[T1.crest] || ''; $('k1').dataset.t = T1.crest; }
  $('s0').textContent = W.score[0]; $('s1').textContent = W.score[1];
  $('clk').textContent = W.period === 3 ? `PRÓRROGA · ${fmtClock(W.clock)}` : W.period >= 4 ? 'PENALTIS' : `${W.period}ª · ${fmtClock(W.clock)}`;
  const so = $('so');
  so.hidden = !W.so;
  if (W.so) {
    const row = t => { const k = W.so.kicks[t], n = Math.max(3, k.length, W.so.kicks[1 - t].length); let h = `<span class="sot">${G.TM(t).abbr}</span>`; for (let i = 0; i < n; i++) h += `<i class="${k[i] === 1 ? 'g' : k[i] === 0 ? 'x' : ''}"></i>`; return `<div>${h}</div>`; };
    so.innerHTML = row(0) + row(1);
  }
  const el = $('pen');
  el.hidden = !pens.length;
  if (pens.length) {
    const n0 = G.playersOn(0), n1 = G.playersOn(1);
    el.innerHTML = pens.map(p => `<span class="pp${p.penT <= 10 ? ' end' : ''}"><i style="background:${G.TM(p.team).main}"></i>${G.TM(p.team).abbr} ${p.num} <b>${fmtClock(p.penT)}</b></span>`).join('') +
      (n0 !== n1 ? `<span class="pp sup">${n0} c ${n1}</span>` : '');
  }
}

G.hooks.sfx = n => sfx(n);
G.hooks.msg = (a, b) => { if (!opt.demo) banner(a, b); };
G.hooks.goal = (t, sc) => {
  replayDone = false;
  const T = G.TM(t);
  const gx = (t === 0 ? 1 : -1) * 17.6;
  R3.spawnConfetti([T.main, T.trim, '#ffffff', T.light || T.main], gx);
  if (opt.demo) return;
  $('goalSub').textContent = (sc.num ? sc.num + ' · ' : '') + T.full + (sc.assist ? `  (asist. ${sc.assist})` : '');
  $('goal').style.setProperty('--gc', T.id === 'linces' ? '#ffd23a' : T.main === '#f4f6fa' ? '#ffffff' : T.hud);
  $('goal').style.setProperty('--gs', T.dark);
  $('goal').classList.add('on');
  setTimeout(() => $('goal').classList.remove('on'), t === 0 && !sc.so ? 1350 : 2600);
  goalMusic(t === 0);
  if (navigator.vibrate) try { navigator.vibrate([60, 40, 120]); } catch (e) { }
};
G.hooks.over = () => {
  if (opt.demo) return;
  setTimeout(() => {
    if (scene !== 'game') return;
    const a = W.score[0], b = W.score[1];
    $('ovT').textContent = W.winner < 0 ? 'EMPATE' : W.winner === 0 ? '¡GANAN LOS LINCES!' : 'GANA ' + G.TM(1).name;
    $('ovS').textContent = `${G.TM(0).name} ${a} - ${b} ${G.TM(1).name}` + (W.so ? `  (PEN ${G.soCount(0)}-${G.soCount(1)})` : W.period === 3 ? '  (PRÓRROGA)' : '');
    $('ovX').textContent = `Tiros: ${W.stats.shots[0]} - ${W.stats.shots[1]}`;
    $('ovTbl').hidden = !opt.league;
    if (opt.league && !opt.two) {
      finishLeagueMatch();
      const r = standings(), pos = r.findIndex(x => x.i === 0) + 1;
      $('ovX').textContent += `  ·  Linces ${pos}º con ${LG.table[0].pts} puntos`;
    }
    show('over'); overShown = true; banner('', '');
  }, 1800);
};

/* =================================================================
   ENTRADA
   ================================================================= */
const keys = new Set();
let touch = false, VW = 0, VH = 0, DPR = 1, safe = { l: 0, r: 0, t: 0, b: 0 };
const touches = new Map();
let ctrls = [];
const prevBtn = [{ s: false, p: false, k: false }, { s: false, p: false, k: false }];

function layoutControls() {
  const m = Math.min(VW, VH);
  const rs = clamp(m * 0.15, 46, 86), rb = clamp(m * 0.1, 32, 60), pad = 16;
  ctrls = [];
  const L = safe.l + pad, Rr = VW - safe.r - pad, Bt = VH - safe.b - pad;
  if (!opt.two) {
    ctrls.push({ type: 'zone', pl: 0, x0: 0, x1: VW * 0.5, y0: VH * 0.2, y1: VH, rs, hx: L + rs, hy: Bt - rs });
    ctrls.push({ type: 'btn', pl: 0, b: 's', x: Rr - rb * 1.05, y: Bt - rb * 1.25, r: rb * 1.05, label: 'TIRO', col: '#e2483d' });
    ctrls.push({ type: 'btn', pl: 0, b: 'p', x: Rr - rb * 3.35, y: Bt - rb * 0.7, r: rb * 0.85, label: 'PASE', col: '#3b7be2' });
    ctrls.push({ type: 'btn', pl: 0, b: 'k', x: Rr - rb * 1.3, y: Bt - rb * 3.55, r: rb * 0.8, label: 'PRESIÓN', col: '#e8862a' });
  } else {
    ctrls.push({ type: 'zone', pl: 0, x0: 0, x1: VW * 0.32, y0: VH * 0.45, y1: VH, rs: rs * 0.85, hx: L + rs * 0.85, hy: Bt - rs * 0.85 });
    ctrls.push({ type: 'btn', pl: 0, b: 's', x: L + rb, y: VH * 0.33, r: rb * 0.85, label: 'TIRO', col: '#e2483d' });
    ctrls.push({ type: 'btn', pl: 0, b: 'p', x: L + rb * 3, y: VH * 0.33, r: rb * 0.75, label: 'PASE', col: '#3b7be2' });
    ctrls.push({ type: 'btn', pl: 0, b: 'k', x: L + rb * 2, y: VH * 0.33 - rb * 1.9, r: rb * 0.7, label: 'PRESIÓN', col: '#e8862a' });
    ctrls.push({ type: 'zone', pl: 1, x0: VW * 0.68, x1: VW, y0: VH * 0.45, y1: VH, rs: rs * 0.85, hx: Rr - rs * 0.85, hy: Bt - rs * 0.85 });
    ctrls.push({ type: 'btn', pl: 1, b: 's', x: Rr - rb, y: VH * 0.33, r: rb * 0.85, label: 'TIRO', col: '#e2483d' });
    ctrls.push({ type: 'btn', pl: 1, b: 'p', x: Rr - rb * 3, y: VH * 0.33, r: rb * 0.75, label: 'PASE', col: '#3b7be2' });
    ctrls.push({ type: 'btn', pl: 1, b: 'k', x: Rr - rb * 2, y: VH * 0.33 - rb * 1.9, r: rb * 0.7, label: 'PRESIÓN', col: '#e8862a' });
  }
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function onPointerDown(e) {
  audioInit();
  if (e.pointerType === 'touch') { if (!touch) { touch = true; refreshTitle(); } }
  if (scene === 'splash') { toTitle(); return; }
  if (scene !== 'game' || paused || overShown) return;
  if (replay) { endReplay(); return; }
  const cx = e.clientX, cy = e.clientY;
  for (const c of ctrls) if (c.type === 'btn' && Math.hypot(cx - c.x, cy - c.y) < c.r * 1.3) { touches.set(e.pointerId, { kind: 'btn', c }); c.down = true; return; }
  for (const c of ctrls) if (c.type === 'zone' && cx >= c.x0 && cx < c.x1 && cy >= c.y0 && cy < c.y1) { touches.set(e.pointerId, { kind: 'stick', c, ox: cx, oy: cy, x: cx, y: cy }); return; }
}
function onPointerMove(e) { const t = touches.get(e.pointerId); if (t && t.kind === 'stick') { t.x = e.clientX; t.y = e.clientY; } }
function onPointerUp(e) { const t = touches.get(e.pointerId); if (!t) return; if (t.kind === 'btn') t.c.down = false; touches.delete(e.pointerId); }

const padPrev = {};
let p2Last = 0;
function gatherInput() {
  const raw = [{ x: 0, y: 0, s: false, p: false, k: false }, { x: 0, y: 0, s: false, p: false, k: false }];
  const K = c => keys.has(c);
  const addK = (r, l, rt, u, d, s, ps, ks) => {
    if (K(l)) r.x -= 1; if (K(rt)) r.x += 1; if (K(u)) r.y -= 1; if (K(d)) r.y += 1;
    if (s.some(K)) r.s = true; if (ps.some(K)) r.p = true; if (ks.some(K)) r.k = true;
  };
  addK(raw[0], 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ['Space', 'KeyX', 'Enter'], ['KeyM', 'KeyN', 'KeyZ'], ['KeyB', 'KeyV']);
  addK(raw[opt.two ? 1 : 0], 'KeyA', 'KeyD', 'KeyW', 'KeyS', ['KeyQ'], ['KeyE'], ['KeyR']);
  const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
  let pi = 0;
  for (const pd of pads) {
    if (!pd) continue;
    const r = raw[opt.two ? Math.min(pi, 1) : 0]; pi++;
    const ax = pd.axes[0] || 0, ay = pd.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.25) { r.x += ax; r.y += ay; }
    const B = i => pd.buttons[i] && pd.buttons[i].pressed;
    if (B(14)) r.x -= 1; if (B(15)) r.x += 1; if (B(12)) r.y -= 1; if (B(13)) r.y += 1;
    if (B(0) || B(7)) r.s = true; if (B(1) || B(2) || B(6)) r.p = true; if (B(3) || B(5)) r.k = true;
    if (B(9) && !padPrev[pd.index]) { if (scene === 'game') setPause(!paused); }
    padPrev[pd.index] = B(9);
  }
  for (const t of touches.values()) {
    if (t.kind === 'stick') {
      const r = raw[t.c.pl], dx = t.x - t.ox, dy = t.y - t.oy, d = Math.hypot(dx, dy), m = t.c.rs * 0.75;
      if (d > m * 0.2) { const k = Math.min(1, d / m); r.x += dx / d * k; r.y += dy / d * k; }
      if (d > t.c.rs) { t.ox = t.x - dx / d * t.c.rs; t.oy = t.y - dy / d * t.c.rs; }
    } else if (t.c.down) raw[t.c.pl][t.c.b] = true;
  }
  /* en modo 2 jugadores, si el J2 no toca nada en 6 s juega la maquina por el */
  if (opt.two && scene === 'game') {
    const r = raw[1], act = Math.hypot(r.x, r.y) > 0.2 || r.s || r.p || r.k;
    if (act) { p2Last = W.gtime; if (opt.p2idle) { opt.p2idle = false; banner('', 'ENTRA EL JUGADOR 2'); setTimeout(() => banner('', ''), 1500); } }
    else if (!opt.p2idle && W.gtime - p2Last > 6) { opt.p2idle = true; banner('', 'J2 SIN MANDO: JUEGA LA MÁQUINA'); setTimeout(() => banner('', ''), 2000); }
  }
  for (const t of [0, 1]) {
    const r = raw[t], I = inp[t], m = Math.hypot(r.x, r.y);
    I.x = m > 1 ? r.x / m : r.x; I.y = m > 1 ? r.y / m : r.y;
    I.shootE = r.s && !prevBtn[t].s; I.passE = r.p && !prevBtn[t].p; I.pressE = r.k && !prevBtn[t].k;
    I.shoot = r.s; I.pass = r.p; I.press = r.k;
    prevBtn[t].s = r.s; prevBtn[t].p = r.p; prevBtn[t].k = r.k;
  }
}

let prevAxis = [0, 0];
function menuTick() {
  const I0 = inp[0], I1 = inp[1];
  const ay = Math.abs(I0.y) > 0.5 ? Math.sign(I0.y) : Math.abs(I1.y) > 0.5 ? Math.sign(I1.y) : 0;
  const ax = Math.abs(I0.x) > 0.5 ? Math.sign(I0.x) : Math.abs(I1.x) > 0.5 ? Math.sign(I1.x) : 0;
  if (ay && ay !== prevAxis[1]) menuMove(ay);
  if (ax && ax !== prevAxis[0]) menuSide(ax);
  prevAxis = [ax, ay];
  if (I0.shootE || I1.shootE) menuOk();
}

/* =================================================================
   CONTROLES TACTILES (dibujados sobre el lienzo)
   ================================================================= */
function drawControls(c) {
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const k of ctrls) {
    if (k.type === 'zone') {
      let t = null;
      for (const q of touches.values()) if (q.kind === 'stick' && q.c === k) t = q;
      const ox = t ? t.ox : k.hx, oy = t ? t.oy : k.hy;
      c.globalAlpha = t ? 0.45 : 0.25;
      c.fillStyle = '#0b0e1a'; c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      c.beginPath(); c.arc(ox, oy, k.rs, 0, 7); c.fill(); c.stroke();
      let kx = ox, ky = oy;
      if (t) { const dx = t.x - ox, dy = t.y - oy, d = Math.hypot(dx, dy), m = Math.min(d, k.rs); if (d > 0) { kx += dx / d * m; ky += dy / d * m; } }
      c.globalAlpha = t ? 0.85 : 0.5; c.fillStyle = k.pl ? '#5ce1ff' : '#ffe14d';
      c.beginPath(); c.arc(kx, ky, k.rs * 0.42, 0, 7); c.fill();
    } else if (k.type === 'btn') {
      c.globalAlpha = k.down ? 0.92 : 0.6; c.fillStyle = k.col;
      c.beginPath(); c.arc(k.x, k.y, k.r * (k.down ? 0.93 : 1), 0, 7); c.fill();
      c.globalAlpha = 0.9; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
      /* carga del tiro alrededor del boton */
      if (k.b === 's') {
        const p = P[W.human[k.pl]];
        if (p && p.charging) {
          const f = Math.min(1, p.charge / G.CHG_MAX);
          c.strokeStyle = f >= 1 ? '#ffe14d' : '#ffffff'; c.lineWidth = 5; c.globalAlpha = 1;
          c.beginPath(); c.arc(k.x, k.y, k.r + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); c.stroke();
        }
      }
      c.globalAlpha = 1; c.fillStyle = '#ffffff'; c.font = `700 ${Math.round(k.r * (k.label.length > 5 ? 0.34 : 0.46))}px "Barlow Condensed", system-ui, sans-serif`;
      c.fillText(k.label, k.x, k.y + 1);
    }
  }
  c.restore();
}

/* =================================================================
   BUCLE PRINCIPAL
   ================================================================= */
/* ---------------- repeticion a camara lenta ---------------- */
const RB = [], RB_N = 170;
let replay = null, replayDone = false;
const FIELDS = ['x', 'y', 'hd', 'anim', 'speed', 'swing', 'saveT', 'saveKind', 'saveDir', 'pokeT', 'cele', 'active', 'stumble', 'charging', 'charge', 'penT', 'followT'];
function snapAll() { return { p: P.map(p => { const o = {}; for (const k of FIELDS) o[k] = p[k]; return o; }), pk: Object.assign({}, G.puck), r: Object.assign({}, G.REF) }; }
function applySnap(sn) { sn.p.forEach((o, i) => Object.assign(P[i], o)); Object.assign(G.puck, sn.pk); Object.assign(G.REF, sn.r); }
function startReplay() {
  replayDone = true;
  if (RB.length < 30) return;
  replay = { buf: RB.slice(), f: 0, live: snapAll() };
  const gx = (W.goalTeam === 0 ? 1 : -1) * 17.6;
  R3.cam.replay = { gx }; R3.snap(); R3.confetti.length = 0;
  $('goal').classList.remove('on'); banner('', '');
  $('replay').hidden = false;
}
function endReplay() {
  if (!replay) return;
  applySnap(replay.live); replay = null; R3.cam.replay = null; R3.snap();
  W.timer = Math.min(W.timer, 1.0);
  $('replay').hidden = true;
}
function replayTick() {
  if (inp[0].shootE || inp[1].shootE || inp[0].passE) { endReplay(); return; }
  replay.f += 0.45;
  const i = Math.floor(replay.f);
  if (i >= replay.buf.length - 1) { endReplay(); return; }
  applySnap(replay.buf[i]);
}

function tick() {
  gatherInput();
  if (scene === 'splash') {
    splashT += DT;
    if (splashT > 5 || inp[0].shootE || inp[1].shootE) toTitle();
    G.step();
    return;
  }
  if (scene === 'title' || paused || overShown) { menuTick(); if (scene === 'title') G.step(); return; }
  if (replay) { replayTick(); return; }
  G.step();
  if (W.state === G.S_PLAY || (W.state === G.S_GOAL && W.timer > 3.6 && !W.so)) { RB.push(snapAll()); if (RB.length > RB_N) RB.shift(); }
  else if (W.state === G.S_FACE) RB.length = 0;
  if (W.state === G.S_GOAL && !replayDone && W.timer < (W.goalTeam === 0 ? 1.7 : 3.0) && !W.so && W.period !== 3) startReplay();
}

let last = 0, accT = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
  accT += dt;
  while (accT >= DT) { tick(); accT -= DT; }
  if (crowd && AC) {
    const target = scene === 'game' && !paused ? crowdLvl : 0.02;
    crowd.gain.value += (target - crowd.gain.value) * 0.05;
    crowdLvl += (0.05 - crowdLvl) * 0.006;
  }
  const cheer = (W.state === G.S_GOAL && W.goalTeam === 0 && !replay) || (W.so && W.so.phase === 'res' && W.so.goal && W.so.turn === 0) || (W.state === G.S_OVER && W.winner === 0);
  musicTick(dt);
  R3.frame(paused ? 0 : dt, cheer);
  const c = R3.ctx;
  if (scene === 'game' && touch && !paused && !overShown) { c.setTransform(DPR, 0, 0, DPR, 0, 0); drawControls(c); }
  if (scene === 'game') updateHUD();
  $('rotate').hidden = !(touch && scene === 'game' && VH > VW);
  requestAnimationFrame(frame);
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, touch ? 1.75 : 2);
  VW = window.innerWidth; VH = window.innerHeight;
  const cs = getComputedStyle($('safe'));
  safe = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
  R3.resize(VW, VH, DPR);
  layoutControls();
}

function loadImg(src) { return new Promise(res => { if (!src || src.startsWith('__')) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

async function boot() {
  touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  loadPrefs();
  const A = window.ASSETS || {};
  const [logo, jpa, escudo, guerra, santos] = await Promise.all([A.logo, A.jpa, A.escudo, A.guerra, A.santos].map(loadImg));
  Object.assign(R3.IMG, { logo, jpa, escudo, guerra, santos });
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
  R3.init($('view'), $('gl'));
  resize();
  addEventListener('resize', resize);
  const cv = $('view');
  cv.addEventListener('pointerdown', onPointerDown);
  $('splash').addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove);
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    audioInit();
    if (scene === 'splash') { toTitle(); return; }
    const menu = scene === 'title' || paused || overShown;
    if (menu) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') menuMove(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') menuMove(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') menuSide(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') menuSide(1);
      else if (e.code === 'Space' || e.code === 'Enter') menuOk();
      else if ((e.code === 'KeyP' || e.code === 'Escape') && paused) setPause(false);
      return;
    }
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') setPause(true);
    if (e.code === 'KeyC') cycleCam();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { setPause(true); if (AC) AC.suspend(); } else if (AC) AC.resume(); });
  $('pauseBtn').addEventListener('click', () => setPause(true));
  $('camBtn').addEventListener('click', cycleCam);
  opt.demo = true; G.newGame();
  if (/demo/.test(location.hash)) { scene = 'title'; toTitle(); }
  else show('splash');
  if (/play/.test(location.hash)) startGame();
  refreshTitle();
  window.__game = { G, R3, startGame, toTitle, setPause, get scene() { return scene; } };
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
})();
