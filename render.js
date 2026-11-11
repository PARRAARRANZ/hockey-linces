/* =================================================================
   DIBUJO: camara con perspectiva real, suelo WebGL, pabellon,
   jugadores con esqueleto articulado (cinematica inversa)
   ================================================================= */
const R3 = (() => {
'use strict';
const { RL, RW, CY, GL, GR, GD, GT, GB, GH, P: PL, REF, puck, W } = G;
const IMG = {};                     /* imagenes cargadas por la interfaz */
let cv, ctx, glc, gl = null, VW = 0, VH = 0, DPR = 1;

/* mundo logico (1 = 10 cm) -> metros, centrado en la pista */
const mx = u => (u - RL / 2) / 10, mz = v => (v - CY) / 10, mh = h => h / 10;
const HL = RL / 20, HW = RW / 20, RCR = G.RCR / 10;      /* 20 x 9 m, radio esquina 2,6 m */
const GLX = mx(GR), GW = (GB - GT) / 20, GHM = GH / 10, GDM = GD / 10;

/* ---------------- camara ---------------- */
const cam = { p: [0, 12.5, 21], l: [0, 0, -1], fov: 34, mode: 0 };
let CR = [1, 0, 0], CU = [0, 1, 0], CF = [0, 0, -1], FOC = 1;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ease = t => t * t * (3 - 2 * t);

function setupCam() {
  CF = norm(sub(cam.l, cam.p)); CR = norm(cross(CF, [0, 1, 0])); CU = cross(CR, CF);
  const fov = VW / VH < 1 ? cam.fov * 1.7 : cam.fov;
  FOC = (VH / 2) / Math.tan(fov * Math.PI / 360);
}
function Pj(x, y, z) {
  const dx = x - cam.p[0], dy = y - cam.p[1], dz = z - cam.p[2];
  const zr = dx * CF[0] + dy * CF[1] + dz * CF[2], zc = Math.max(0.05, zr);
  const k = FOC / zc;
  return { x: VW / 2 + (dx * CR[0] + dy * CR[1] + dz * CR[2]) * k, y: VH / 2 - (dx * CU[0] + dy * CU[1] + dz * CU[2]) * k, s: k, z: zc, bh: zr < 0.4 };
}
const Pv = v => Pj(v[0], v[1], v[2]);

/* ---------------- utilidades de color ---------------- */
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function shade(h, k) {
  const [r, g, b] = hexRGB(h);
  const f = c => Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/* ---------------- geometria de la pista ---------------- */
function perimeter(hl, hw, r, n) {
  const pts = [], cx = hl - r, cz = hw - r;
  const corners = [[cx, -cz, -Math.PI / 2], [cx, cz, 0], [-cx, cz, Math.PI / 2], [-cx, -cz, Math.PI]];
  for (const [ox, oz, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([ox + Math.cos(a) * r, oz + Math.sin(a) * r]); }
  return pts;
}
const RINK = perimeter(HL, HW, RCR, 10);
const BOARD = perimeter(HL + 0.05, HW + 0.05, RCR + 0.05, 6);
function rinkPath(c, keep) {
  if (!keep) c.beginPath();
  RINK.forEach(([x, z], i) => { const q = Pj(x, 0, z); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
  c.closePath();
}

/* =================================================================
   TEXTURA DEL SUELO (vista cenital): baldosas, lineas, escudo
   ================================================================= */
const TXW = 2048, TXH = 1024;
let floorTex = null;
function buildFloorTexture() {
  const c = document.createElement('canvas'); c.width = TXW; c.height = TXH;
  const g = c.getContext('2d');
  g.scale(TXW / (HL * 2), TXH / (HW * 2)); g.translate(HL, HW);   /* ahora en metros */
  const rr = new Path2D();
  { const r = RCR, x0 = -HL, z0 = -HW, w = HL * 2, h = HW * 2;
    rr.moveTo(x0 + r, z0); rr.arcTo(x0 + w, z0, x0 + w, z0 + h, r); rr.arcTo(x0 + w, z0 + h, x0, z0 + h, r); rr.arcTo(x0, z0 + h, x0, z0, r); rr.arcTo(x0, z0, x0 + w, z0, r); rr.closePath(); }
  g.save(); g.clip(rr);
  /* base: baldosas de pista de hockey linea */
  const bg = g.createLinearGradient(0, -HW, 0, HW);
  bg.addColorStop(0, '#8fb9cc'); bg.addColorStop(0.5, '#a9d0de'); bg.addColorStop(1, '#9cc4d4');
  g.fillStyle = bg; g.fillRect(-HL, -HW, HL * 2, HW * 2);
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let x = -HL; x < HL; x += 0.5) for (let z = -HW; z < HW; z += 0.5) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '40,80,110'},${(rnd() * 0.035).toFixed(3)})`; g.fillRect(x, z, 0.5, 0.5);
  }
  g.strokeStyle = 'rgba(60,100,125,0.22)'; g.lineWidth = 0.025;
  g.beginPath();
  for (let x = -HL; x <= HL; x += 0.5) { g.moveTo(x, -HW); g.lineTo(x, HW); }
  for (let z = -HW; z <= HW; z += 0.5) { g.moveTo(-HL, z); g.lineTo(HL, z); }
  g.stroke();
  /* logos de los Linces difuminados en cada campo */
  if (IMG.logo) for (const s of [-1, 1]) { g.globalAlpha = 0.16; g.drawImage(IMG.logo, s * 5.6 - 1.9, -1.9, 3.8, 3.8); }
  g.globalAlpha = 1;
  const red = '#d23a32', blue = '#2a5fc0';
  const ln = (x0, z0, x1, z1, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, z0); g.lineTo(x1, z1); g.stroke(); };
  const ring = (x, z, r, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.stroke(); };
  /* lineas de gol y areas */
  for (const s of [-1, 1]) {
    const gx = s * GLX;
    ln(gx, -HW, gx, HW, 0.08, red);
    g.fillStyle = 'rgba(70,130,215,0.75)';
    g.beginPath(); g.moveTo(gx, -1.6); g.arc(gx, 0, 1.6, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : Math.PI * 1.5); g.closePath(); g.fill();
    g.strokeStyle = red; g.lineWidth = 0.06; g.stroke();
    /* circulos de saque en las zonas */
    for (const z of [-4.4, 4.4]) {
      ring(s * 10.4, z, 2.25, 0.06, red);
      g.fillStyle = red; g.beginPath(); g.arc(s * 10.4, z, 0.22, 0, 7); g.fill();
      for (const hs of [-1, 1]) { ln(s * 10.4 - 0.6, z + hs * 2.25, s * 10.4 - 0.6, z + hs * 2.65, 0.05, red); ln(s * 10.4 + 0.6, z + hs * 2.25, s * 10.4 + 0.6, z + hs * 2.65, 0.05, red); }
    }
  }
  /* linea central y circulo con el escudo de Zaratan */
  ln(0, -HW, 0, HW, 0.3, red);
  g.fillStyle = 'rgba(255,255,255,0.32)'; g.beginPath(); g.arc(0, 0, 3, 0, 7); g.fill();
  ring(0, 0, 3, 0.08, blue);
  ln(0, -3, 0, 3, 0.3, 'rgba(210,58,50,0.35)');
  if (IMG.escudo) { const h = 3.3, w = h * IMG.escudo.width / IMG.escudo.height; g.drawImage(IMG.escudo, -w / 2, -h / 2 - 0.05, w, h); }
  g.fillStyle = blue; g.beginPath(); g.arc(0, 0, 0.12, 0, 7); g.fill();
  /* rotulo ZARATAN ARENA en el suelo */
  g.font = '900 1.15px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(75,26,120,0.62)';
  g.fillText('ZARATÁN', 0, -3.95);
  g.fillText('ARENA', 0, 3.95);
  g.restore();
  /* sombra suave junto a las vallas */
  g.save(); g.clip(rr);
  g.shadowColor = 'rgba(10,30,45,0.55)'; g.shadowBlur = 40; g.strokeStyle = 'rgba(10,30,45,0.5)'; g.lineWidth = 0.15; g.stroke(rr);
  g.restore();
  floorTex = c;
}

/* ---------------- suelo con WebGL (perspectiva exacta) ---------------- */
let glProg, glBuf, glTex, glU = {};
const LIGHTS = [[-12, 9, -2], [0, 9, -2], [12, 9, -2], [-12, 9, 4], [0, 9, 4], [12, 9, 4]];
function initGL() {
  try { gl = glc.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false }); } catch (e) { gl = null; }
  if (!gl) return;
  const vs = `attribute vec2 a; uniform vec3 cp, cr, cu, cf; uniform vec2 sc; varying vec2 uv; varying vec2 wp;
    void main(){ vec3 p = vec3(a.x, 0.0, a.y); vec3 d = p - cp; float w = dot(d, cf);
      gl_Position = vec4(dot(d, cr) * sc.x, dot(d, cu) * sc.y, 0.0, w);
      uv = vec2((a.x + ${HL.toFixed(1)}) / ${(HL * 2).toFixed(1)}, (a.y + ${HW.toFixed(1)}) / ${(HW * 2).toFixed(1)}); wp = a; }`;
  const fs = `precision mediump float; uniform sampler2D t; uniform vec2 sp[6]; varying vec2 uv; varying vec2 wp;
    void main(){ vec4 c = texture2D(t, uv); if (c.a < 0.5) discard;
      float g = 0.0;
      for (int i = 0; i < 6; i++) { vec2 d = (wp - sp[i]) * vec2(0.55, 0.9); g += exp(-dot(d, d) * 0.9); }
      float s = 0.0; for (int i = 0; i < 3; i++) { vec2 d = wp - vec2(float(i - 1) * 12.0, 0.5); s += exp(-dot(d, d) * 0.012); }
      gl_FragColor = vec4(c.rgb * (0.86 + 0.16 * s) + vec3(0.2) * min(g, 1.2), 1.0); }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  try {
    glProg = gl.createProgram();
    gl.attachShader(glProg, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(glProg, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(glProg);
    if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { gl = null; return; }
  gl.useProgram(glProg);
  glBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-HL, -HW, HL, -HW, -HL, HW, HL, HW]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(glProg, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['cp', 'cr', 'cu', 'cf', 'sc', 't']) glU[n] = gl.getUniformLocation(glProg, n);
  glU.sp = gl.getUniformLocation(glProg, 'sp');
  glTex = gl.createTexture();
}
function uploadFloor() {
  if (!gl) return;
  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, floorTex);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const an = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
}
function drawFloorGL() {
  gl.viewport(0, 0, glc.width, glc.height);
  gl.clearColor(0.03, 0.04, 0.08, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(glProg);
  gl.uniform3fv(glU.cp, cam.p); gl.uniform3fv(glU.cr, CR); gl.uniform3fv(glU.cu, CU); gl.uniform3fv(glU.cf, CF);
  gl.uniform2f(glU.sc, FOC / (VW / 2), FOC / (VH / 2));
  /* reflejo de los focos: donde la recta camara -> foco reflejado corta el suelo */
  const sp = [];
  for (const L of LIGHTS) { const t = cam.p[1] / (cam.p[1] + L[1]); sp.push(cam.p[0] + (L[0] - cam.p[0]) * t, cam.p[2] + (L[2] - cam.p[2]) * t); }
  gl.uniform2fv(glU.sp, new Float32Array(sp));
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glTex); gl.uniform1i(glU.t, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
/* alternativa sin WebGL: la textura en triangulos afines */
function drawFloor2D() {
  const nx = 16, nz = 8, iw = floorTex.width, ih = floorTex.height;
  const V = (i, j) => { const x = -HL + 2 * HL * i / nx, z = -HW + 2 * HW * j / nz; const q = Pj(x, 0, z); return [q.x, q.y, iw * i / nx, ih * j / nz]; };
  ctx.save(); rinkPath(ctx); ctx.clip();
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const a = V(i, j), b = V(i + 1, j), c = V(i, j + 1), d = V(i + 1, j + 1);
    texTri(a, b, c); texTri(b, d, c);
  }
  ctx.restore();
}
function texTri(a, b, c) {
  const [x0, y0, u0, v0] = a, [x1, y1, u1, v1] = b, [x2, y2, u2, v2] = c;
  ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
  const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
  ctx.translate(cx, cy); ctx.scale(1.02, 1.02); ctx.translate(-cx, -cy); ctx.clip();
  const du1 = u1 - u0, dv1 = v1 - v0, du2 = u2 - u0, dv2 = v2 - v0, det = du1 * dv2 - du2 * dv1;
  const a11 = ((x1 - x0) * dv2 - (x2 - x0) * dv1) / det, a12 = ((x2 - x0) * du1 - (x1 - x0) * du2) / det;
  const a21 = ((y1 - y0) * dv2 - (y2 - y0) * dv1) / det, a22 = ((y2 - y0) * du1 - (y1 - y0) * du2) / det;
  ctx.transform(a11, a21, a12, a22, x0 - a11 * u0 - a12 * v0, y0 - a21 * u0 - a22 * v0);
  ctx.drawImage(floorTex, 0, 0); ctx.restore();
}

/* =================================================================
   PABELLON: grada, publico, vallas con publicidad, rotulo
   ================================================================= */
/* imagen en un paralelogramo 3D (troceada para que la perspectiva no se note) */
function imgQuad(img, p0, p1, p2, n = 1, alpha = 1) {
  const w = img.width, h = img.height;
  ctx.save(); ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const A = lerp3(p0, p1, u0), B = lerp3(p0, p1, u1), C = add(A, sub(p2, p0));
    const a = Pv(A), b = Pv(B), c = Pv(C);
    if (a.bh || b.bh || c.bh || a.z < 1.5 || b.z < 1.5) continue;
    const sw = w / n, sx = u0 * w;
    ctx.setTransform(DPR * (b.x - a.x) / sw, DPR * (b.y - a.y) / sw, DPR * (c.x - a.x) / h, DPR * (c.y - a.y) / h, DPR * a.x, DPR * a.y);
    ctx.drawImage(img, sx, 0, Math.min(sw + 1, w - sx), h, 0, 0, Math.min(sw + 1, w - sx), h);
  }
  ctx.restore();
}

/* paneles de publicidad */
const ADS = [];
function buildAds() {
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = 520; c.height = 104; const g = c.getContext('2d'); draw(g); return c; };
  const font = (px, w = 900) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const logoFit = (g, img, x, y, w, h) => { if (!img) return 0; const k = Math.min(w / img.width, h / img.height); g.drawImage(img, x, y + (h - img.height * k) / 2, img.width * k, img.height * k); return img.width * k; };
  const white = g => { g.fillStyle = '#f5f7fa'; g.fillRect(0, 0, 520, 104); };
  ADS.push(mk(g => { white(g); const w = logoFit(g, IMG.jpa, 18, 8, 240, 88); g.fillStyle = '#1d4f91'; g.font = font(40); g.textBaseline = 'middle'; g.fillText('JPA', 40 + w, 54); }));
  ADS.push(mk(g => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 520, 104); logoFit(g, IMG.guerra, 20, 6, 480, 92); }));
  ADS.push(mk(g => { white(g); const w = logoFit(g, IMG.santos, 12, 6, 250, 92); g.fillStyle = '#1b1d25'; g.font = font(30, 700); g.textBaseline = 'middle'; g.fillText('CONSTRUCCIONES', 26 + w, 38); g.fillText('& REFORMAS', 26 + w, 70); }));
  ADS.push(mk(g => { g.fillStyle = '#4b1a78'; g.fillRect(0, 0, 520, 104); g.fillStyle = '#ffd23a'; g.fillRect(0, 92, 520, 12); logoFit(g, IMG.logo, 14, 4, 88, 88); g.fillStyle = '#ffffff'; g.font = font(50); g.textBaseline = 'middle'; g.fillText('LINCES DE ZARATÁN', 114, 50); }));
  ADS.push(mk(g => { white(g); logoFit(g, IMG.escudo, 22, 4, 60, 96); g.fillStyle = '#21407a'; g.font = font(26, 700); g.textBaseline = 'middle'; g.fillText('AYUNTAMIENTO DE', 100, 32); g.font = font(56); g.fillStyle = '#b3261e'; g.fillText('ZARATÁN', 100, 72); }));
  ADS.push(mk(g => { g.fillStyle = '#ffd23a'; g.fillRect(0, 0, 520, 104); logoFit(g, IMG.escudo, 18, 6, 56, 92); g.fillStyle = '#4b1a78'; g.font = font(62); g.textBaseline = 'middle'; g.fillText('ZARATÁN ARENA', 90, 54); }));
}
/* reparto de paneles: lado lejano (8), fondos (3 + 3) */
const PANELS = [];
{
  const far = [0, 1, 2, 3, 4, 0, 1, 2], L = HL - RCR, n = far.length, w = 2 * L / n;
  far.forEach((k, i) => PANELS.push({ k, p0: [-L + i * w + 0.05, 0.86, -HW - 0.07], p1: [-L + (i + 1) * w - 0.05, 0.86, -HW - 0.07] }));
  const ez = HW - RCR, m = 3, ew = 2 * ez / m;
  for (let i = 0; i < m; i++) {
    PANELS.push({ k: [3, 2, 1][i], p0: [-HL - 0.07, 0.86, ez - i * ew - 0.05], p1: [-HL - 0.07, 0.86, ez - (i + 1) * ew + 0.05] });
    PANELS.push({ k: [1, 3, 0][i], p0: [HL + 0.07, 0.86, -ez + i * ew + 0.05], p1: [HL + 0.07, 0.86, -ez + (i + 1) * ew - 0.05] });
  }
}

/* grada y aficionados (en filas para dibujar por lotes) */
const STANDS = [];
let banner = null;
function buildStands() {
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const shirts = ['#8e3fd0', '#8e3fd0', '#8e3fd0', '#8e3fd0', '#7a32b8', '#ffd23a', '#ffd23a', '#ffffff', '#5b2a9a', '#d8312f', '#2a6fdb', '#3aa655', '#ff8a3a', '#c9d0dc', '#1b1d25', '#e4e7ec'];
  const skins = ['#f1c09a', '#e0a77c', '#c98756', '#8d5a3b', '#f6d0ae'];
  const hairs = ['#2a1d14', '#4a3020', '#1b1b1b', '#8a6a3a', '#d8c08a', '#7a7a7a', '#b5562b'];
  const caps = ['#8e3fd0', '#ffd23a', '#1b1d25', '#d8312f', '#ffffff'];
  const signs = ['VAMOS LINCES', '27', 'ZARATÁN', 'LINCES', 'GOOOL', 'OLI 27'];
  const fan = () => {
    const a = rnd(), acc = a < 0.16 ? 1 : a < 0.2 ? 2 : a < 0.24 ? 4 : 0;
    return { c: shirts[(rnd() * shirts.length) | 0], k: skins[(rnd() * skins.length) | 0], h: hairs[(rnd() * hairs.length) | 0],
      hs: (rnd() * 4) | 0, cap: caps[(rnd() * caps.length) | 0], ph: rnd() * 6.28, sc: 0.88 + rnd() * 0.24, w: 0.2 + rnd() * 0.06,
      up: rnd() < 0.3 ? 0.12 : 0, acc, sign: signs[(rnd() * signs.length) | 0], fl: rnd() < 0.5 };
  };
  /* lado lejano */
  for (let r = 0; r < 9; r++) {
    const row = { fans: [], kind: 'far', r, y: 1.55 + r * 0.6, z: -HW - 1.6 - r * 0.85 };
    for (let x = -HL - 3; x <= HL + 3; x += 0.6) { if (r <= 1 && Math.abs(x) < 4.4) continue; if (r >= 2 && r <= 5 && Math.abs(x) < 5.4) continue; if (rnd() > 0.06) row.fans.push(Object.assign(fan(), { x: x + rnd() * 0.16 })); }
    if (r === 3 || r === 6) for (const x of [-15, -8, 9, 16]) row.fans.push(Object.assign(fan(), { x: x + rnd() * 2, acc: 3 }));
    STANDS.push(row);
  }
  /* fondos */
  for (const s of [-1, 1]) for (let r = 0; r < 6; r++) {
    const row = { fans: [], kind: 'end', s, r, y: 1.55 + r * 0.6, x: s * (HL + 1.6 + r * 0.85) };
    for (let z = -HW + 0.5; z <= HW + 2; z += 0.6) if (rnd() > 0.08) row.fans.push(Object.assign(fan(), { z: z + rnd() * 0.16 }));
    STANDS.push(row);
  }
  /* rotulo del pabellon */
  const c = document.createElement('canvas'); c.width = 1400; c.height = 180;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, '#5b2496'); gr.addColorStop(1, '#2e0f52');
  g.fillStyle = gr; g.fillRect(0, 0, 1400, 180);
  g.fillStyle = '#ffd23a'; g.fillRect(0, 0, 1400, 8); g.fillRect(0, 172, 1400, 8);
  if (IMG.escudo) { const h = 150, w = h * IMG.escudo.width / IMG.escudo.height; g.drawImage(IMG.escudo, 40, 15, w, h); g.drawImage(IMG.escudo, 1360 - w, 15, w, h); }
  g.font = '900 128px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffd23a'; g.fillText('ZARATÁN ARENA', 700, 96);
  banner = c;
}

function drawPenaltyBox() {
  const z0 = -HW - 0.25, z1 = -HW - 1.3;
  for (const [x0, x1, col] of [[-5.6, -0.6, '#2a1546'], [0.6, 5.6, '#1d2340']]) {
    quad(Pj(x0, 0, z0), Pj(x1, 0, z0), Pj(x1, 0, z1), Pj(x0, 0, z1), col);
    quad(Pj(x0, 0, z1), Pj(x1, 0, z1), Pj(x1, 0.5, z1), Pj(x0, 0.5, z1), '#151a2e');
    const a = Pj(x0, 0.3, z1 + 0.2), b = Pj(x1, 0.3, z1 + 0.2), c = Pj(x1, 0.4, z1 + 0.2), d = Pj(x0, 0.4, z1 + 0.2);
    quad(a, b, c, d, '#3b4467');
  }
  for (const p of PL) if (!p.active && p.penT > 0) drawSkater(p, kitOf(G.TM(p.team)), time, false);
  /* cuenta atras sobre cada castigado */
  for (const p of PL) {
    if (p.active || !(p.penT > 0)) continue;
    const q = Pj(mx(p.x), 2.35, mz(p.y)); if (q.bh) continue;
    const T = G.TM(p.team), sec = Math.ceil(p.penT), txt = `${p.num} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const fs = clamp(0.32 * q.s, 11, 30);
    ctx.font = `900 ${fs.toFixed(0)}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + fs * 0.8, h = fs * 1.35;
    if (p.penT <= 10 && Math.floor(time * 4) % 2) continue;
    ctx.fillStyle = 'rgba(8,10,20,0.85)'; ctx.fillRect(q.x - w / 2, q.y - h / 2, w, h);
    ctx.fillStyle = T.main; ctx.fillRect(q.x - w / 2, q.y - h / 2, fs * 0.22, h);
    ctx.fillStyle = p.penT <= 10 ? '#ff6b5a' : '#ffd23a'; ctx.fillText(txt, q.x + fs * 0.1, q.y + 1);
  }
}

function drawBackdrop(time) {
  /* fondo oscuro del pabellon (fuera de la pista) con focos */
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, VW, VH); rinkPath(ctx, true); ctx.clip('evenodd');
  const bg = ctx.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#04050c'); bg.addColorStop(0.5, '#0c1024'); bg.addColorStop(1, '#161b33');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
  for (const L of LIGHTS.slice(0, 3)) {
    const q = Pj(L[0], 13, -16), r = 4 * q.s;
    if (q.y < -r) continue;
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
    g.addColorStop(0, 'rgba(255,250,235,0.9)'); g.addColorStop(0.08, 'rgba(255,245,220,0.35)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function quad(a, b, c, d, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
}

function drawStands(time, cheer) {
  /* rotulo ZARATAN ARENA sobre la grada lejana */
  if (false && banner) imgQuad(banner, [-10, 9.4, -HW - 8.6], [10, 9.4, -HW - 8.6], [-10, 6.83, -HW - 8.6], 4);
  /* escalones: de atras hacia delante */
  const order = STANDS.slice().sort((a, b) => b.r - a.r);
  for (const row of order) {
    const y = row.y - 0.35;
    if (row.kind === 'far') {
      const z = row.z;
      quad(Pj(-HL - 4, y, z - 0.45), Pj(HL + 4, y, z - 0.45), Pj(HL + 4, y - 0.6, z + 0.4), Pj(-HL - 4, y - 0.6, z + 0.4), row.r & 1 ? '#1d1838' : '#241d45');
    } else {
      const x = row.x, s = row.s;
      quad(Pj(x + s * 0.45, y, -HW - 1), Pj(x + s * 0.45, y, HW + 3), Pj(x - s * 0.4, y - 0.6, HW + 3), Pj(x - s * 0.4, y - 0.6, -HW - 1), row.r & 1 ? '#1d1838' : '#241d45');
    }
    drawFans(row, time, cheer);
    if (row.kind === 'far' && row.r === 2) drawPenaFlag(time);
    if (row.kind === 'far' && row.r <= 1) for (const f of PENA) if (f.row === row.r) drawPenaFan(f, row, time, cheer);
  }
}

/* =================================================================
   PENA DE LOS LINCES: aficion propia en el centro de la grada,
   con sudaderas grises de mangas moradas y una gran bandera detras
   ================================================================= */
const HOOD = '#d8d3cd', HOODD = '#b9b3ad', PURP = '#7a3aa6', JEANS = '#5d6f8f', JEANSD = '#4a5a76';
/* x en metros, fila (0 delante), pelo, color de pelo, piel y extras */
const PENA = [
  { x: -3.3, row: 1, hair: 'long', hc: '#5a3a26', sk: '#f0c2a0' },
  { x: -2.65, row: 1, hair: 'long', hc: '#2a1d16', sk: '#f2c6a6' },
  { x: -2.0, row: 1, hair: 'bun', hc: '#2a1d16', sk: '#eebd9a', glasses: true },
  { x: -1.35, row: 1, hair: 'long', hc: '#1f1612', sk: '#f2c6a6', glasses: true },
  { x: -0.7, row: 1, hair: 'mid', hc: '#9b7a52', sk: '#f3c9a8', glasses: true },
  { x: -0.05, row: 1, hair: 'long', hc: '#c9a66b', sk: '#f3cbaa' },
  { x: 0.6, row: 1, hair: 'short', hc: '#9a9a98', sk: '#efc09c' },
  { x: 1.25, row: 1, hair: 'short', hc: '#2b211b', sk: '#e9b48e', beard: '#3a2c22' },
  { x: 2.0, row: 1, hair: 'short', hc: '#3a2c22', sk: '#eab894', beard: '#3a2c22', dark: true },
  { x: -3.0, row: 0, hair: 'bald', hc: '#8a8a88', sk: '#eeb995', beard: '#8f8f8f', jacket: true },
  { x: -2.15, row: 0, hair: 'bald', hc: '#9b9b98', sk: '#eeb995' },
  { x: 1.05, row: 0, hair: 'mid', hc: '#2a1d16', sk: '#f0c2a0', dog: true },
  { x: 1.8, row: 0, hair: 'curly', hc: '#5b3420', sk: '#f2c6a6' },
  /* segunda foto */
  { x: -1.45, row: 0, hair: 'bald', hc: '#8c7f74', sk: '#efbd98', beard: '#a3958a', top: '#f4f4f2', inner: '#3d2a8c' },
  { x: -0.72, row: 0, hair: 'short', hc: '#4a4a48', sk: '#e3ab84', beard: '#5a5a58', cap: '#8f9399', stick: true },
  { x: 0.0, row: 0, hair: 'mid', hc: '#1f1612', sk: '#f0c2a0', sun: true, num: '27' },
  { x: 2.65, row: 1, hair: 'short', hc: '#a9a9a7', sk: '#eab894', sun: true },
  { x: 3.3, row: 1, hair: 'bob', hc: '#1f1612', sk: '#f0c2a0', sun: true, top: '#f6f6f4', banner: true },
  { x: 3.95, row: 1, hair: 'short', hc: '#2b211b', sk: '#e3ab84', sun: true, top: '#2a3550' },
  { x: 2.55, row: 0, hair: 'short', hc: '#3a2c22', sk: '#eab894', sun: true },
];
let penaFlag = null;
function buildPenaFlag() {
  const c = document.createElement('canvas'); c.width = 1100; c.height = 380;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 380); gr.addColorStop(0, '#8e3fd0'); gr.addColorStop(1, '#5b1f96');
  g.fillStyle = gr; g.fillRect(0, 0, 1100, 380);
  g.fillStyle = '#ffd23a'; g.fillRect(0, 0, 1100, 22); g.fillRect(0, 358, 1100, 22);
  g.fillStyle = '#ffffff'; g.fillRect(0, 22, 1100, 8); g.fillRect(0, 350, 1100, 8);
  if (IMG.logo) g.drawImage(IMG.logo, 40, 45, 290, 290);
  g.font = '900 120px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#ffd23a'; g.fillText('LINCES', 360, 125);
  g.fillStyle = '#ffffff'; g.font = '900 86px "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText('DE ZARATÁN', 362, 245);
  penaFlag = c;
}
function drawPenaFlag(time) {
  if (!penaFlag) buildPenaFlag();
  /* bandera colgada sobre la grada, ondeando un poco: se dibuja en franjas verticales */
  const n = 14, x0 = -5.0, x1 = 5.0, yTop = 4.75, yBot = 1.75, z = -HW - 2.95, w = penaFlag.width, h = penaFlag.height;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const wv = u => Math.sin(time * 1.6 + u * 7) * 0.12;
    const A = Pj(lerp(x0, x1, u0), yTop, z + wv(u0)), B = Pj(lerp(x0, x1, u1), yTop, z + wv(u1)), C = Pj(lerp(x0, x1, u0), yBot, z + 0.1 + wv(u0));
    const sw = w / n, sx = u0 * w;
    ctx.save();
    ctx.setTransform(DPR * (B.x - A.x) / sw, DPR * (B.y - A.y) / sw, DPR * (C.x - A.x) / h, DPR * (C.y - A.y) / h, DPR * A.x, DPR * A.y);
    ctx.drawImage(penaFlag, sx, 0, Math.min(sw + 1, w - sx), h, 0, 0, Math.min(sw + 1, w - sx), h);
    /* sombreado de los pliegues */
    ctx.fillStyle = `rgba(0,0,0,${(0.12 + 0.12 * Math.sin(time * 1.6 + u0 * 7 + 1)).toFixed(3)})`; ctx.fillRect(0, 0, sw + 1, h);
    ctx.restore();
  }
}
function drawPenaFan(f, row, time, cheer) {
  const sway = Math.sin(time * 1.7 + f.x * 3) * 0.015;
  const ph = time * 9 + f.x * 2;
  const jump = cheer ? Math.max(0, Math.sin(ph)) * 0.22 : 0;
  const q = Pj(f.x + sway, row.y + jump, row.z);
  if (q.z < 3 || q.x < -60 || q.x > VW + 60) return;
  const s = q.s, x = q.x, y = q.y;
  const R2 = (a, b, c, d, col) => { ctx.fillStyle = col; ctx.fillRect(x + a * s, y + b * s, c * s, d * s); };
  const C2 = (a, b, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + a * s, y + b * s, r * s, 0, 6.29); ctx.fill(); };
  const RR = (a, b, w, h, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + a * s, y + b * s, w * s, h * s, r * s) : ctx.rect(x + a * s, y + b * s, w * s, h * s); ctx.fill(); };
  /* piernas sentadas: vaqueros y zapatillas */
  RR(-0.19, 0.22, 0.17, 0.3, 0.05, JEANS); RR(0.02, 0.22, 0.17, 0.3, 0.05, JEANSD);
  RR(-0.18, 0.5, 0.14, 0.34, 0.04, JEANS); RR(0.04, 0.5, 0.14, 0.34, 0.04, JEANSD);
  RR(-0.21, 0.82, 0.18, 0.08, 0.03, f.dark ? '#2a2a2e' : '#f2f2f2'); RR(0.03, 0.82, 0.18, 0.08, 0.03, f.dark ? '#2a2a2e' : '#f2f2f2');
  /* tronco: sudadera gris con mangas raglan moradas (o chaqueta morada) */
  const body = f.jacket ? '#3d2a8c' : f.top || HOOD;
  RR(-0.24, -0.3, 0.48, 0.58, 0.13, body);
  RR(0.06, -0.3, 0.18, 0.58, 0.1, 'rgba(0,0,0,0.10)');
  if (f.top) {
    /* chaqueta o camiseta lisa; con camiseta morada debajo si la lleva abierta */
    if (f.inner) { ctx.fillStyle = f.inner; ctx.beginPath(); ctx.moveTo(x - 0.08 * s, y - 0.3 * s); ctx.lineTo(x + 0.08 * s, y - 0.3 * s); ctx.lineTo(x + 0.06 * s, y + 0.26 * s); ctx.lineTo(x - 0.06 * s, y + 0.26 * s); ctx.closePath(); ctx.fill(); R2(-0.05, -0.12, 0.1, 0.04, '#ffffff'); }
  } else if (f.jacket) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 0.025 * s);
    ctx.beginPath(); for (const d of [-0.04, 0, 0.04]) { ctx.moveTo(x - 0.22 * s, y + (-0.22 + d) * s); ctx.lineTo(x - 0.08 * s, y + (-0.3 + d) * s); ctx.moveTo(x + 0.22 * s, y + (-0.22 + d) * s); ctx.lineTo(x + 0.08 * s, y + (-0.3 + d) * s); } ctx.stroke();
    R2(-0.012, -0.28, 0.024, 0.52, '#d8d8e8');
    C2(0.1, -0.16, 0.03, '#e84a9a');
  } else {
    /* capucha morada alrededor del cuello y cordones */
    ctx.fillStyle = PURP; ctx.beginPath(); ctx.moveTo(x - 0.17 * s, y - 0.3 * s); ctx.quadraticCurveTo(x, y - 0.05 * s, x + 0.17 * s, y - 0.3 * s); ctx.lineTo(x + 0.1 * s, y - 0.32 * s); ctx.quadraticCurveTo(x, y - 0.14 * s, x - 0.1 * s, y - 0.32 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.8, 0.012 * s);
    ctx.beginPath(); ctx.moveTo(x - 0.04 * s, y - 0.17 * s); ctx.lineTo(x - 0.05 * s, y - 0.02 * s); ctx.moveTo(x + 0.04 * s, y - 0.17 * s); ctx.lineTo(x + 0.05 * s, y - 0.02 * s); ctx.stroke();
    /* pequeno escudo en el pecho */
    C2(0.11, -0.12, 0.035, '#8e3fd0'); C2(0.11, -0.12, 0.018, '#ffd23a');
  }
  if (f.num && s > 16) { ctx.fillStyle = PURP; ctx.font = `900 ${(0.13 * s).toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.num, x - 0.09 * s, y - 0.12 * s); }
  if (f.stick) { ctx.strokeStyle = '#1d1d22'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, 0.035 * s); ctx.beginPath(); ctx.moveTo(x + 0.3 * s, y - 0.55 * s); ctx.lineTo(x - 0.25 * s, y + 0.82 * s); ctx.lineTo(x - 0.5 * s, y + 0.86 * s); ctx.stroke(); ctx.strokeStyle = '#e66ab0'; ctx.lineWidth = Math.max(1, 0.03 * s); ctx.beginPath(); ctx.moveTo(x - 0.3 * s, y + 0.84 * s); ctx.lineTo(x - 0.46 * s, y + 0.86 * s); ctx.stroke(); }
  /* brazos: celebran o descansan sobre las rodillas */
  const sleeve = f.jacket ? '#3d2a8c' : f.top || PURP, up = cheer && Math.sin(ph) > 0;
  ctx.strokeStyle = sleeve; ctx.lineCap = 'round'; ctx.lineWidth = 0.11 * s;
  ctx.beginPath();
  if (up) { ctx.moveTo(x - 0.2 * s, y - 0.22 * s); ctx.lineTo(x - 0.34 * s, y - 0.78 * s); ctx.moveTo(x + 0.2 * s, y - 0.22 * s); ctx.lineTo(x + 0.34 * s, y - 0.78 * s); }
  else { ctx.moveTo(x - 0.21 * s, y - 0.2 * s); ctx.quadraticCurveTo(x - 0.26 * s, y + 0.1 * s, x - 0.06 * s, y + 0.22 * s); ctx.moveTo(x + 0.21 * s, y - 0.2 * s); ctx.quadraticCurveTo(x + 0.26 * s, y + 0.1 * s, x + 0.06 * s, y + 0.22 * s); }
  ctx.stroke();
  if (up) { C2(-0.34, -0.82, 0.055, f.sk); C2(0.34, -0.82, 0.055, f.sk); } else { C2(0, 0.22, 0.065, f.sk); }
  if (f.banner) {
    /* ensena una sudadera de los Linces */
    const bx = x + 0.14 * s, by = y - 0.3 * s, bw = 0.62 * s, bh = 0.46 * s;
    ctx.fillStyle = HOOD; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = PURP; ctx.fillRect(bx + bw - 0.1 * s, by, 0.1 * s, bh + 0.08 * s);
    if (IMG.logo) ctx.drawImage(IMG.logo, bx + bw * 0.25, by + bh * 0.12, bh * 0.75, bh * 0.75);
  }
  if (f.dog && !up) { RR(-0.16, 0.08, 0.3, 0.16, 0.07, '#3b2a20'); C2(0.15, 0.08, 0.075, '#3b2a20'); C2(0.19, 0.06, 0.02, '#111'); }
  /* cuello y cabeza */
  R2(-0.045, -0.4, 0.09, 0.1, f.sk);
  const hy = -0.52;
  if (f.hair === 'long' || f.hair === 'curly') RR(-0.16, hy - 0.06, 0.32, f.hair === 'curly' ? 0.4 : 0.36, 0.1, f.hc);
  if (f.hair === 'mid') RR(-0.15, hy - 0.06, 0.3, 0.22, 0.09, f.hc);
  C2(0, hy, 0.125, f.sk);
  if (f.hair === 'curly') for (const [a, b] of [[-0.12, -0.6], [-0.05, -0.65], [0.04, -0.66], [0.11, -0.61], [-0.15, -0.5], [0.15, -0.5], [-0.15, -0.38], [0.15, -0.38]]) C2(a, b, 0.055, f.hc);
  else if (f.hair !== 'bald') { ctx.fillStyle = f.hc; ctx.beginPath(); ctx.arc(x, y + (hy - 0.01) * s, 0.13 * s, Math.PI * 1.02, -0.02); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x - 0.04 * s, y + (hy - 0.06) * s, 0.04 * s, 0, 6.29); ctx.fill(); C2(-0.12, hy + 0.01, 0.03, f.hc); C2(0.12, hy + 0.01, 0.03, f.hc); }
  if (f.hair === 'bun') C2(0, hy - 0.14, 0.06, f.hc);
  if (f.hair === 'bob') RR(-0.15, hy - 0.08, 0.3, 0.2, 0.09, f.hc);
  if (f.cap) { ctx.fillStyle = f.cap; ctx.beginPath(); ctx.arc(x, y + (hy - 0.02) * s, 0.135 * s, Math.PI, 0); ctx.fill(); RR(-0.17, hy - 0.04, 0.3, 0.045, 0.02, shade(f.cap, 0.8)); C2(0.0, hy - 0.08, 0.02, '#ffffff'); }
  if (f.beard) { ctx.fillStyle = f.beard; ctx.beginPath(); ctx.arc(x, y + (hy + 0.02) * s, 0.12 * s, 0.15, Math.PI - 0.15); ctx.fill(); C2(0, hy + 0.04, 0.035, f.sk); }
  /* cara sencilla: ojos y sonrisa */
  if (s > 18) {
    C2(-0.045, hy - 0.01, 0.014, '#2a1d16'); C2(0.045, hy - 0.01, 0.014, '#2a1d16');
    ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = Math.max(0.7, 0.012 * s); ctx.beginPath(); ctx.arc(x, y + (hy + 0.03) * s, 0.04 * s, 0.3, Math.PI - 0.3); ctx.stroke();
    if (f.sun) { ctx.fillStyle = '#1b1f2a'; ctx.beginPath(); ctx.ellipse(x - 0.047 * s, y + (hy - 0.01) * s, 0.04 * s, 0.026 * s, 0, 0, 6.29); ctx.ellipse(x + 0.047 * s, y + (hy - 0.01) * s, 0.04 * s, 0.026 * s, 0, 0, 6.29); ctx.fill(); ctx.fillStyle = 'rgba(120,200,255,0.5)'; ctx.fillRect(x - 0.07 * s, y + (hy - 0.025) * s, 0.025 * s, 0.01 * s); }
    if (f.glasses) { ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = Math.max(0.7, 0.012 * s); ctx.beginPath(); ctx.arc(x - 0.045 * s, y + (hy - 0.01) * s, 0.032 * s, 0, 6.29); ctx.moveTo(x + 0.077 * s, y + (hy - 0.01) * s); ctx.arc(x + 0.045 * s, y + (hy - 0.01) * s, 0.032 * s, 0, 6.29); ctx.stroke(); }
  }
}
function drawFans(row, time, cheer) {
  const M = {};
  const get = k => M[k] || (M[k] = new Path2D());
  const flags = [], cards = [];
  for (const f of row.fans) {
    const ph = time * (cheer ? 10 : 2.2) + f.ph;
    const jump = cheer ? Math.max(0, Math.sin(ph)) * 0.28 : Math.max(0, Math.sin(time * 1.3 + f.ph)) * 0.025;
    const q = row.kind === 'far' ? Pj(f.x, row.y + jump + f.up, row.z) : Pj(row.x, row.y + jump + f.up, f.z);
    if (q.z < 3 || q.x < -40 || q.x > VW + 40 || q.y < -40 || q.y > VH + 60) continue;
    const s = q.s * f.sc, x = q.x, y = q.y, w = f.w * s;
    if (f.acc === 3) { flags.push(x, y, s, f.ph, f.fl); continue; }
    /* torso con hombros redondeados */
    const b = get('b' + f.c);
    b.moveTo(x - w, y + 0.32 * s); b.lineTo(x - w, y - 0.16 * s);
    b.quadraticCurveTo(x - w, y - 0.32 * s, x - w + 0.12 * s, y - 0.32 * s); b.lineTo(x + w - 0.12 * s, y - 0.32 * s);
    b.quadraticCurveTo(x + w, y - 0.32 * s, x + w, y - 0.16 * s); b.lineTo(x + w, y + 0.32 * s); b.closePath();
    /* sombra lateral y cuello */
    const sh = get('shade'); sh.rect(x + w * 0.35, y - 0.2 * s, w * 0.65, 0.52 * s);
    const nk = get('k' + f.k); nk.rect(x - 0.05 * s, y - 0.4 * s, 0.1 * s, 0.1 * s);
    /* brazos: arriba cuando celebran, si no a los lados (o aplaudiendo) */
    const raise = cheer && Math.sin(ph) > 0.1;
    const arm = get('a' + f.c);
    if (raise) {
      const sw = Math.sin(ph * 0.5) * 0.06 * s;
      arm.moveTo(x - w + 0.02 * s, y - 0.22 * s); arm.lineTo(x - w - 0.14 * s + sw, y - 0.8 * s); arm.lineTo(x - w - 0.04 * s + sw, y - 0.82 * s); arm.lineTo(x - w + 0.1 * s, y - 0.24 * s); arm.closePath();
      arm.moveTo(x + w - 0.02 * s, y - 0.22 * s); arm.lineTo(x + w + 0.14 * s - sw, y - 0.8 * s); arm.lineTo(x + w + 0.04 * s - sw, y - 0.82 * s); arm.lineTo(x + w - 0.1 * s, y - 0.24 * s); arm.closePath();
      const hd = get('k' + f.k);
      hd.moveTo(x - w - 0.09 * s + sw, y - 0.84 * s); hd.arc(x - w - 0.09 * s + sw, y - 0.84 * s, 0.055 * s, 0, 6.29);
      hd.moveTo(x + w + 0.09 * s - sw, y - 0.84 * s); hd.arc(x + w + 0.09 * s - sw, y - 0.84 * s, 0.055 * s, 0, 6.29);
    } else {
      const clap = Math.sin(ph * 3) > 0.6 && (f.ph > 3);
      arm.rect(x - w - 0.03 * s, y - 0.24 * s, 0.09 * s, 0.4 * s); arm.rect(x + w - 0.06 * s, y - 0.24 * s, 0.09 * s, 0.4 * s);
      if (clap) { const hd = get('k' + f.k); hd.moveTo(x + 0.06 * s, y - 0.02 * s); hd.arc(x, y - 0.02 * s, 0.06 * s, 0, 6.29); }
    }
    /* bufanda de los Linces */
    if (f.acc === 1) {
      if (raise) { const sc = get('scarf'); sc.rect(x - w - 0.12 * s, y - 0.88 * s, (w + 0.12) * 2 * s / s * s, 0.09 * s); const st = get('scarf2'); for (let i = 0; i < 4; i++) st.rect(x - w - 0.12 * s + i * 0.16 * s, y - 0.88 * s, 0.07 * s, 0.09 * s); }
      else { const sc = get('scarf'); sc.rect(x - w * 0.9, y - 0.33 * s, w * 1.8, 0.07 * s); sc.rect(x + w * 0.2, y - 0.3 * s, 0.07 * s, 0.32 * s); const st = get('scarf2'); st.rect(x + w * 0.2, y - 0.16 * s, 0.07 * s, 0.05 * s); st.rect(x + w * 0.2, y - 0.04 * s, 0.07 * s, 0.05 * s); }
    }
    if (f.acc === 4) { const fh = get('foam'); fh.moveTo(x + w + 0.14 * s, y - 0.9 * s); fh.arc(x + w + 0.1 * s, y - 0.92 * s, 0.13 * s, 0, 6.29); fh.rect(x + w + 0.07 * s, y - 1.12 * s, 0.07 * s, 0.2 * s); }
    if (f.acc === 2) cards.push(x, y, s, f.sign);
    /* cabeza y pelo */
    const hy = y - 0.5 * s, hr = 0.135 * s;
    const hp = get('k' + f.k); hp.moveTo(x + hr, hy); hp.arc(x, hy, hr, 0, 6.29);
    if (f.hs === 2) { const cp = get('c' + f.cap); cp.moveTo(x + hr * 1.05, hy - 0.02 * s); cp.arc(x, hy - 0.02 * s, hr * 1.05, Math.PI, 0); cp.rect(x - hr * 0.2, hy - 0.04 * s, hr * 1.5, 0.04 * s); }
    else if (f.hs !== 3) {
      const hh = get('h' + f.h); hh.moveTo(x + hr * 1.05, hy - 0.01 * s); hh.arc(x, hy - 0.01 * s, hr * 1.05, Math.PI * 1.05, -0.05);
      if (f.hs === 1) { hh.rect(x - hr * 1.05, hy - 0.02 * s, 0.06 * s, 0.2 * s); hh.rect(x + hr * 1.05 - 0.06 * s, hy - 0.02 * s, 0.06 * s, 0.2 * s); }
    }
  }
  const col = k => k === 'shade' ? 'rgba(0,0,0,0.18)' : k === 'scarf' ? '#8e3fd0' : k === 'scarf2' ? '#ffd23a' : k === 'foam' ? '#ffd23a' : k.slice(1);
  for (const pre of ['b', 'a', 'shade', 'scarf', 'scarf2', 'k', 'h', 'c', 'foam']) for (const k in M) if (k === pre || (pre.length === 1 && k[0] === pre && !['shade', 'scarf', 'scarf2', 'foam'].includes(k))) { ctx.fillStyle = k[0] === 'a' ? shade(k.slice(1), 0.8) : col(k); ctx.fill(M[k]); }
  /* carteles */
  for (let i = 0; i < cards.length; i += 4) {
    const x = cards[i], y = cards[i + 1], s = cards[i + 2], txt = cards[i + 3];
    const cw = Math.max(0.5, txt.length * 0.09) * s, ch = 0.3 * s, cy = y - 0.98 * s;
    ctx.fillStyle = '#f7f7f2'; ctx.fillRect(x - cw / 2, cy - ch / 2, cw, ch);
    ctx.fillStyle = '#c9a42a'; ctx.fillRect(x - 0.02 * s, cy + ch / 2, 0.04 * s, 0.3 * s);
    if (s > 14) { ctx.fillStyle = '#5b1fa0'; ctx.font = `900 ${(0.2 * s).toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, cy + 0.01 * s); }
  }
  /* banderas ondeando */
  for (let i = 0; i < flags.length; i += 5) {
    const x = flags[i], y = flags[i + 1], s = flags[i + 2], ph = flags[i + 3], alt = flags[i + 4];
    const top = y - 1.9 * s, fw = 1.3 * s, fh = 0.75 * s;
    ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = Math.max(1, 0.04 * s); ctx.beginPath(); ctx.moveTo(x, y + 0.2 * s); ctx.lineTo(x, top); ctx.stroke();
    const wv = u => Math.sin(time * 4 + ph + u * 4) * 0.12 * s * u;
    const band = (v0, v1, c) => {
      ctx.fillStyle = c; ctx.beginPath();
      for (let j = 0; j <= 8; j++) { const u = j / 8; ctx.lineTo(x + u * fw, top + v0 * fh + wv(u)); }
      for (let j = 8; j >= 0; j--) { const u = j / 8; ctx.lineTo(x + u * fw, top + v1 * fh + wv(u)); }
      ctx.closePath(); ctx.fill();
    };
    if (alt) { band(0, 1, '#8e3fd0'); band(0.4, 0.6, '#ffd23a'); }
    else { band(0, 0.5, '#ffd23a'); band(0.5, 1, '#8e3fd0'); }
  }
}

/* vallas: cara interior visible = lejana (antes que los jugadores); si no, cercana y translucida */
function drawBoards(near) {
  for (let i = 0; i < BOARD.length; i++) {
    const a = BOARD[i], b = BOARD[(i + 1) % BOARD.length];
    const mxp = (a[0] + b[0]) / 2, mzp = (a[1] + b[1]) / 2;
    const nIn = [-(b[1] - a[1]), (b[0] - a[0])];           /* normal hacia dentro (sentido horario en pantalla) */
    const isNear = (cam.p[0] - mxp) * nIn[0] + (cam.p[2] - mzp) * nIn[1] <= 0;
    if (isNear !== near) continue;
    const a0 = Pj(a[0], 0, a[1]), b0 = Pj(b[0], 0, b[1]), a1 = Pj(a[0], 1.0, a[1]), b1 = Pj(b[0], 1.0, b[1]);
    const zmin = Math.min(a0.z, b0.z, a1.z, b1.z);
    if (zmin < 3.5 || (near && zmin < 5.5)) continue;
    const ak = Pj(a[0], 0.2, a[1]), bk = Pj(b[0], 0.2, b[1]), ag = Pj(a[0], 2.0, a[1]), bg = Pj(b[0], 2.0, b[1]);
    if (near) {
      quad(a0, b0, b1, a1, 'rgba(225,232,240,0.38)');
      quad(a0, b0, bk, ak, 'rgba(242,194,48,0.35)');
    } else {
      quad(a0, b0, b1, a1, '#edf1f5');
      quad(a0, b0, bk, ak, '#f2c230');
    }
    ctx.strokeStyle = near ? 'rgba(38,48,77,0.55)' : '#26304d'; ctx.lineWidth = Math.max(1.2, 0.07 * a1.s);
    ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    quad(a1, b1, bg, ag, 'rgba(190,225,255,0.07)');
    ctx.strokeStyle = 'rgba(220,235,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ag.x, ag.y); ctx.lineTo(bg.x, bg.y); ctx.stroke();
  }
  if (!near) for (const pn of PANELS) {
    const img = ADS[pn.k]; if (!img) continue;
    /* solo si se ve la cara interior del panel */
    const nIn = [-(pn.p1[2] - pn.p0[2]), pn.p1[0] - pn.p0[0]];
    const mxp = (pn.p0[0] + pn.p1[0]) / 2, mzp = (pn.p0[2] + pn.p1[2]) / 2;
    if ((cam.p[0] - mxp) * nIn[0] + (cam.p[2] - mzp) * nIn[1] <= 0) continue;
    imgQuad(img, pn.p0, pn.p1, [pn.p0[0], 0.24, pn.p0[2]], 3);
  }
}

/* =================================================================
   JUGADORES: esqueleto articulado en 3D
   ================================================================= */
/* cinematica inversa de dos huesos: articulacion intermedia (rodilla, codo) */
function ik(a, b, l1, l2, pole) {
  let d = sub(b, a), dl = len(d);
  const maxl = l1 + l2 - 0.001;
  if (dl > maxl) { b = add(a, mul(d, maxl / dl)); d = sub(b, a); dl = maxl; }
  const dir = mul(d, 1 / (dl || 1));
  const x = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl || 1), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let pp = sub(pole, mul(dir, dot(pole, dir))); pp = norm(pp);
  return [add(add(a, mul(dir, x)), mul(pp, h)), b];
}

/* equipaciones */
function kitOf(T) {
  if (T._kit) return T._kit;
  T._kit = { main: T.main, mainD: shade(T.main, 0.72), light: T.light || T.main, dark: T.dark, darkD: shade(T.dark, 0.7), trim: T.trim, num: T.num,
    pant: T.pant || '#1b1d25', pantD: shade(T.pant || '#1b1d25', 0.7), helm: T.helm, stripes: !!T.stripes, shadeC: T.shade };
  return T._kit;
}
const REF_KIT = { main: '#f4f4f4', mainD: '#c9c9c9', light: '#ffffff', dark: '#141414', darkD: '#0a0a0a', trim: '#141414', num: '#141414', pant: '#141414', pantD: '#0a0a0a', helm: '#141414', stripes: true, shadeC: '#cfcfcf' };
const REFP = { ref: true, role: -1, num: 0, hand: 1, swing: 0, active: true, i: -1 };
function refPlayer() { return Object.assign(REFP, { x: REF.x, y: REF.y, hd: REF.hd, anim: REF.anim, speed: REF.speed, arm: REF.arm, hold: W.state === G.S_FACE && W.fo.phase < 2 ? 1 : 0 }); }
const BLOND = '#f6d86a', BLOND_HELM = '#f3cf55', SKIN = '#f1b47f';

/* calcula las articulaciones de un patinador (en metros, mundo) */
function skeleton(p, time) {
  const X = mx(p.x), Z = mz(p.y);
  const f = [Math.cos(p.hd), 0, Math.sin(p.hd)], r = [-f[2], 0, f[0]], up = [0, 1, 0];
  const L = (lf, lr, lu) => [X + f[0] * lf + r[0] * lr, lu, Z + f[2] * lf + r[2] * lr];
  const goalie = p.role === 0;
  const J = { goalie, f, r, X, Z };
  const spd = clamp(p.speed / 80, 0, 1);
  if (goalie) return goalieSkeleton(p, J, L, time);
  const sw = p.swing || 0, hand = p.hand || 1;
  const pk = p.pokeT > 0 ? Math.sin(Math.PI * (1 - p.pokeT / G.POKE)) : 0;
  /* zancada: cada pie empuja hacia fuera y atras y vuelve levantado */
  const ph = (p.anim / 10) / 1.7 * Math.PI * 2;
  const amp = spd;
  const pel = 0.93 - 0.05 * amp - 0.05 * Math.abs(sw) - 0.06 * pk;
  const lean = (p.ref ? 0.12 : 0.24) + 0.16 * amp + (p.cele > 0 ? -0.3 : 0) + 0.3 * pk + (p.stumble > 0 ? 0.6 * Math.min(1, p.stumble * 3) : 0);
  J.pelvis = L(-0.04, 0, pel);
  J.feet = []; J.knees = []; J.hips = [];
  for (const side of [-1, 1]) {
    const a = ph + (side > 0 ? 0 : Math.PI), push = Math.sin(a), rec = Math.max(0, -Math.cos(a));
    let lat = side * (0.13 + amp * 0.17 * Math.max(0, push));
    let fw = 0.04 - amp * 0.22 * push;
    let lift = amp * 0.12 * rec * (push < 0 ? 1 : 0.3);
    if (p.charging || p.strikeT > 0) { lat = side * 0.3; fw = side * hand * -0.12; lift = 0; }   /* piernas abiertas para tirar */
    const hip = L(-0.04, side * 0.11, pel);
    const ankle = L(fw, lat, 0.11 + lift);
    const [knee, ank] = ik(hip, ankle, 0.45, 0.44, add(f, mul(r, side * 0.25)));
    J.hips.push(hip); J.knees.push(knee); J.feet.push(ank);
  }
  /* tronco con giro de hombros en el tiro */
  const twist = -sw * 0.75 * hand;
  const spine = norm(add(mul(up, Math.cos(lean)), mul(f, Math.sin(lean))));
  J.spine = spine;
  J.chest = add(J.pelvis, mul(spine, 0.62));
  const ax = norm(add(mul(r, Math.cos(twist)), mul(f, Math.sin(twist))));
  J.sh = [add(J.chest, mul(ax, -0.21)), add(J.chest, mul(ax, 0.21))];
  J.shAx = ax;
  J.head = add(add(J.chest, mul(spine, 0.18)), [0, 0.13, 0]);
  if (p.ref) {
    /* arbitro: brazo con el disco en el saque o levantado al pitar falta */
    const hR = p.arm > 0 ? lerp3(L(0.25, 0.3, 0.9), L(0.05, 0.28, 2.25), ease(p.arm)) : p.hold ? L(0.5, 0.05, 1.12) : L(0.05, 0.3, 0.82);
    const hL = L(0.0, -0.3, 0.82);
    const pole = s => add(add([0, -0.6, 0], mul(r, s * 0.6)), mul(f, -0.2));
    const [e1, h1] = ik(J.sh[1], hR, 0.3, 0.3, pole(1)), [e0, h0] = ik(J.sh[0], hL, 0.3, 0.3, pole(-1));
    J.arms = [[J.sh[0], e0, h0, -1], [J.sh[1], e1, h1, 1]];
    J.noStick = true; J.handR = h1;
    return J;
  }
  /* stick: pala segun el momento del tiro */
  let bl;
  const dr = puck.holder === p.i ? Math.sin(time * 9 + p.i) * 0.08 : 0;
  if (sw < 0) {
    const k = -sw;
    bl = L(0.85 - 1.45 * k, hand * (0.3 + 0.3 * k) + dr, 0.03 + 1.25 * k * k);
  } else if (sw > 0) {
    bl = L(0.85 + 0.45 * sw, hand * (0.3 - 0.45 * sw), 0.03 + 1.15 * sw * sw);
  } else bl = L(0.85, hand * 0.3 + dr, 0.03);
  if (pk > 0) bl = L(0.85 + 0.75 * pk, hand * 0.3 * (1 - 0.6 * pk), 0.03);
  if (p.cele > 0) { const k = clamp(p.cele / 0.5, 0, 1); bl = lerp3(bl, L(0.15, hand * 0.25, 2.15 + Math.sin(time * 8 + p.i) * 0.1), ease(k)); }
  /* mano de arriba a la altura de la cadera, del lado contrario: el stick queda inclinado unos 40 grados */
  const handT = add(add(lerp3(J.pelvis, J.chest, 0.35), mul(ax, -hand * 0.1)), mul(f, 0.22));
  const sd = norm(sub(handT, bl));
  J.blade = bl; J.top = add(bl, mul(sd, 1.48));
  /* la pala sigue el plano del palo (forma de L), apoyada en el suelo */
  const hz = [bl[0] - J.top[0], 0, bl[2] - J.top[2]];
  J.bladeDir = len(hz) > 0.05 ? norm(hz) : f;
  J.handTop = add(bl, mul(sd, 1.42)); J.handLow = add(bl, mul(sd, 0.78));
  /* brazos: el de arriba es el contrario al lado del stick */
  const shTop = J.sh[hand > 0 ? 0 : 1], shLow = J.sh[hand > 0 ? 1 : 0];
  const elbowPole = s => add(add([0, -0.6, 0], mul(r, s * 0.6)), mul(f, -0.2));
  const [eT, hT] = ik(shTop, J.handTop, 0.3, 0.3, elbowPole(-hand));
  const [eL, hL] = ik(shLow, J.handLow, 0.3, 0.3, elbowPole(hand));
  J.arms = [[shTop, eT, hT, -hand], [shLow, eL, hL, hand]];
  return J;
}

function goalieSkeleton(p, J, L, time) {
  const up = [0, 1, 0], f = J.f, r = J.r;
  const sv = p.saveT > 0 ? p.saveKind : 0, k = sv ? ease(clamp((0.55 - p.saveT) / 0.12, 0, 1)) * (p.saveT < 0.15 ? p.saveT / 0.15 : 1) : 0;
  const ls = (p.team ? -1 : 1) * p.saveDir;          /* lado de la parada en ejes locales */
  const shuffle = Math.sin(p.anim * 0.6) * 0.04;
  let pel = 0.7, feet = [[0.05, -0.34, 0.1], [0.05, 0.34, 0.1]], lean = 0.32, roll = 0, shift = 0;
  let glove = [0.35, 0.45, 0.95], block = [0.38, -0.42, 0.8];      /* derecha: guante, izquierda: blocker */
  if (sv === G.SV_BUTTERFLY || sv === G.SV_PAD) {
    pel = lerp(0.7, 0.42, k);
    feet = [[lerp(0.05, -0.25, k), lerp(-0.34, -0.62, k), lerp(0.1, 0.08, k)], [lerp(0.05, -0.25, k), lerp(0.34, 0.62, k), lerp(0.1, 0.08, k)]];
    if (sv === G.SV_PAD) { const i = ls > 0 ? 1 : 0; feet[i] = [0.15, ls * lerp(0.34, 1.0, k), 0.1]; shift = ls * 0.15 * k; }
  } else if (sv === G.SV_GLOVE) { glove = lerp3(glove, [0.3, 0.7, 1.55], k); }
  else if (sv === G.SV_BLOCK) { block = lerp3(block, [0.35, -0.7, 1.35], k); }
  else if (sv === G.SV_DIVE) {
    roll = ls * 1.15 * k; shift = ls * 0.55 * k; pel = lerp(0.7, 0.55, k);
    if (ls > 0) glove = lerp3(glove, [0.2, 0.75, 1.4], k); else block = lerp3(block, [0.2, -0.75, 1.3], k);
  }
  /* coordenadas locales -> mundo, con giro lateral (estirada) */
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const LL = (lf, lr, lu) => { const r2 = lr * cr + lu * sr, u2 = -lr * sr + lu * cr; return L(lf, r2 + shift, Math.max(0.02, u2)); };
  J.pelvis = LL(-0.05, 0, pel);
  J.hips = [LL(-0.05, -0.14, pel), LL(-0.05, 0.14, pel)];
  J.feet = []; J.knees = [];
  for (let i = 0; i < 2; i++) {
    const [a, b, c] = feet[i];
    const ankle = LL(a, b + (i ? shuffle : -shuffle), c);
    const [kn, an] = ik(J.hips[i], ankle, 0.44, 0.44, add(f, mul(r, (i ? 1 : -1) * 0.5)));
    J.knees.push(kn); J.feet.push(an);
  }
  const spine = norm(sub(LL(Math.sin(lean) * 0.6, 0, pel + Math.cos(lean) * 0.6), J.pelvis));
  J.spine = spine;
  J.chest = add(J.pelvis, mul(spine, 0.55));
  J.shAx = norm(sub(LL(0, 1, pel + 0.55), LL(0, -1, pel + 0.55)));
  J.sh = [add(J.chest, mul(J.shAx, -0.25)), add(J.chest, mul(J.shAx, 0.25))];
  J.head = add(add(J.chest, mul(spine, 0.2)), [0, 0.12, 0]);
  J.glove = LL(...glove); J.block = LL(...block);
  /* stick del portero: pala en el suelo delante */
  J.blade = LL(0.55, -0.12, 0.03); J.top = add(J.block, mul(norm(sub(J.block, J.blade)), 0.12));
  J.bladeDir = r;
  const pole = s => add([0, -0.5, 0], mul(r, s * 0.7));
  const [e0, h0] = ik(J.sh[0], J.block, 0.32, 0.32, pole(-1));
  const [e1, h1] = ik(J.sh[1], J.glove, 0.32, 0.32, pole(1));
  J.arms = [[J.sh[0], e0, h0, -1], [J.sh[1], e1, h1, 1]];
  return J;
}

/* dibuja una lista de piezas ordenadas por profundidad */
function drawSkater(p, kit, time, mirror) {
  if (dot(sub([mx(p.x), 1, mz(p.y)], cam.p), CF) < 2) return;
  const J = skeleton(p, time);
  const items = [];
  const toCam = norm(sub(cam.p, [J.X, 1, J.Z]));
  const PJ = mirror ? (v => Pj(v[0], -v[1], v[2])) : Pv;
  const taper = (a, b, wa, wb, col) => items.push({ t: 7, a, b, wa, wb, col, d: (dot(sub(a, cam.p), CF) + dot(sub(b, cam.p), CF)) / 2 });
  const seg = (a, b, w, col, cap = 'round') => items.push({ t: 0, a, b, w, col, cap, d: (dot(sub(a, cam.p), CF) + dot(sub(b, cam.p), CF)) / 2 });
  const blob = (c, rr, col, d0 = 0) => items.push({ t: 1, c, r: rr, col, d: dot(sub(c, cam.p), CF) + d0 });
  const sideCol = (s, col, colD) => dot(mul(J.r, s), toCam) < -0.15 ? colD : col;   /* lado lejano mas oscuro */
  const goalie = J.goalie;
  /* piernas y patines */
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1, hip = J.hips[i], kn = J.knees[i], an = J.feet[i];
    if (goalie) {
      seg(hip, kn, 0.26, sideCol(s, '#e9eef4', '#c3cbd5'));
      seg(kn, an, 0.3, sideCol(s, '#f6f8fb', '#cfd6df'));
      seg(lerp3(kn, an, 0.15), lerp3(kn, an, 0.25), 0.31, kit.main);
    } else {
      /* pierna con forma: muslo ancho, rodilla, gemelo y tobillo fino (pantalon largo) */
      const pc = sideCol(s, kit.pant, kit.pantD), calf = add(lerp3(kn, an, 0.35), mul(J.f, -0.025));
      taper(hip, kn, 0.215, 0.135, pc);
      taper(kn, calf, 0.135, 0.15, pc);
      taper(calf, an, 0.15, 0.1, pc);
      blob(add(kn, mul(J.f, 0.02)), 0.06, sideCol(s, shade(kit.pant, 1.08), kit.pantD), -0.01);
      /* franja lateral del pantalon */
      const off = mul(J.r, s * 0.085);
      seg(add(hip, off), add(kn, mul(off, 0.8)), 0.028, kit.trim);
      seg(add(kn, mul(off, 0.8)), add(an, mul(off, 0.6)), 0.024, kit.trim);
    }
    /* patin en linea: bota, chasis y cuatro ruedas */
    const F = J.f, U = [0, 1, 0], at = (fw, up) => add(an, add(mul(F, fw), mul(U, up)));
    items.push({ t: 8, pts: [at(-0.075, 0.13), at(0.06, 0.13), at(0.2, -0.015), at(0.235, -0.06), at(-0.1, -0.06), at(-0.115, 0.03)], col: sideCol(s, '#25272e', '#18191e'), d: dot(sub(an, cam.p), CF) - 0.005 });
    seg(at(-0.09, -0.02), at(0.12, -0.02), 0.02, '#e9edf2', 'butt');
    seg(at(-0.11, -0.082), at(0.24, -0.082), 0.03, '#9aa3ad', 'butt');
    for (let w = 0; w < 4; w++) { const c = at(-0.085 + w * 0.098, -0.078); blob(c, 0.036, p.blond ? '#ff5cb8' : '#e6c13a', -0.002); blob(c, 0.014, '#3a3d45', -0.004); }
  }
  /* cadera / pantalon */
  seg(J.hips[0], J.hips[1], goalie ? 0.34 : 0.27, kit.pant);
  /* tronco */
  const bottom = add(J.pelvis, mul(J.spine, -0.04));
  items.push({ t: 2, d: dot(sub(J.chest, cam.p), CF) - 0.02, J, bottom, kit, goalie });
  /* numero en la espalda o en el pecho */
  if (!goalie && !mirror && p.num) {
    const back = dot(J.f, toCam) < -0.25, front = dot(J.f, toCam) > 0.35;
    if (back || front) items.push({ t: 3, d: dot(sub(J.chest, cam.p), CF) - 0.2, J, back, num: p.num, name: p.name, kit });
  }
  /* cabeza */
  const hd = J.head;
  if (p.blond && !goalie) {
    /* melena rubia que asoma bajo el casco: nuca y laterales */
    seg(add(hd, add(mul(J.f, -0.12), [0, -0.08, 0])), add(hd, add(mul(J.f, -0.14), [0, -0.2, 0])), 0.13, BLOND);
    for (const sd of [-1, 1]) seg(add(hd, add(add(mul(J.r, sd * 0.11), mul(J.f, -0.05)), [0, -0.09, 0])), add(hd, add(add(mul(J.r, sd * 0.11), mul(J.f, -0.07)), [0, -0.17, 0])), 0.05, '#e9c24e');
  }
  blob(add(hd, add(mul(J.f, 0.07), [0, -0.04, 0])), 0.08, SKIN, -0.01);
  const helm = goalie ? '#f3f6f9' : kit.helm;
  items.push({ t: 4, c: hd, r: 0.145, col: helm, d: dot(sub(hd, cam.p), CF), goalie, kit, f: J.f, r3: J.r });
  if (!mirror && !goalie && !p.ref) items.push({ t: 9, c: hd, f: J.f, r3: J.r, d: dot(sub(hd, cam.p), CF) - 0.14 });
  /* brazos */
  for (const [sh, el, hn, s] of J.arms) {
    const c = sideCol(s, kit.main, kit.mainD), g = goalie ? 1.25 : 1;
    /* hombrera, brazo con forma, codera y guante con puno */
    blob(add(sh, [0, 0.01, 0]), 0.078 * g, c, 0.01);
    taper(sh, el, 0.14 * g, 0.105 * g, c);
    blob(el, 0.054 * g, c, -0.01);
    const cuff = lerp3(el, hn, 0.72);
    taper(el, cuff, 0.105 * g, 0.095 * g, kit.stripes && !goalie ? kit.dark : c);
    if (!goalie) { taper(cuff, hn, 0.1, 0.09, sideCol(s, kit.dark, kit.darkD)); blob(hn, 0.058, sideCol(s, kit.dark, kit.darkD)); }
  }
  /* stick */
  if (J.noStick) { }
  else if (goalie) {
    seg(J.block, J.blade, 0.05, '#2b2d35');
    seg(add(J.blade, mul(J.r, -0.05)), add(J.blade, mul(J.r, 0.36)), 0.09, '#16171b', 'butt');
    seg(J.blade, lerp3(J.blade, J.block, 0.35), 0.09, '#2b2d35', 'butt');
    items.push({ t: 5, c: J.block, d: dot(sub(J.block, cam.p), CF) - 0.05, f: J.f, r3: J.r, kit });
    items.push({ t: 6, c: J.glove, d: dot(sub(J.glove, cam.p), CF) - 0.05, f: J.f, r3: J.r, kit });
  } else {
    /* palo hasta el talon; la pala (en L) centrada donde va el disco */
    const heel = add(J.blade, mul(J.bladeDir, -0.12)), toe = add(J.blade, mul(J.bladeDir, 0.17));
    seg(J.top, heel, 0.035, '#2b2d35');
    seg(J.top, lerp3(J.top, heel, 0.07), 0.042, '#eef2f5', 'butt');
    seg(heel, add(toe, [0, 0.012, 0]), 0.07, '#16171b');
    seg(lerp3(heel, toe, 0.25), lerp3(heel, toe, 0.75), 0.072, '#eef2f5', 'butt');
  }
  items.sort((a, b) => b.d - a.d);
  for (const it of items) drawItem(it, PJ, mirror);
}

function drawItem(it, PJ, mirror) {
  if (it.t === 0) {
    const a = PJ(it.a), b = PJ(it.b);
    if (a.bh || b.bh) return;
    ctx.strokeStyle = it.col; ctx.lineCap = it.cap; ctx.lineWidth = Math.max(1, it.w * (a.s + b.s) / 2);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  } else if (it.t === 1) {
    const q = PJ(it.c); ctx.fillStyle = it.col; ctx.beginPath(); ctx.arc(q.x, q.y, it.r * q.s, 0, 6.29); ctx.fill();
  } else if (it.t === 2) torso(it, PJ, mirror);
  else if (it.t === 3) number(it);
  else if (it.t === 4) helmet(it, PJ, mirror);
  else if (it.t === 5 || it.t === 6) goalieHand(it, PJ);
  else if (it.t === 9) cage(it, PJ);
  else if (it.t === 7) {
    const a = PJ(it.a), b = PJ(it.b), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    if (a.bh || b.bh) return;
    const ra = it.wa * a.s / 2, rb = it.wb * b.s / 2;
    ctx.fillStyle = it.col; ctx.beginPath();
    ctx.moveTo(a.x + nx * ra, a.y + ny * ra); ctx.lineTo(b.x + nx * rb, b.y + ny * rb); ctx.arc(b.x, b.y, rb, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
    ctx.lineTo(a.x - nx * ra, a.y - ny * ra); ctx.arc(a.x, a.y, ra, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
    ctx.closePath(); ctx.fill();
  } else if (it.t === 8) {
    ctx.fillStyle = it.col; ctx.beginPath();
    it.pts.forEach((v, i) => { const q = PJ(v); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath(); ctx.fill();
  }
}

const PROF_REF = [[0, 0.18, 0.13, 0.01], [0.3, 0.195, 0.14, 0.01], [0.62, 0.22, 0.15, 0], [0.85, 0.235, 0.145, 0], [1, 0.2, 0.115, 0]];
const PROF_PL = [[0, 0.17, 0.12, 0], [0.3, 0.185, 0.13, 0], [0.62, 0.22, 0.15, 0], [0.85, 0.235, 0.145, 0], [1, 0.2, 0.115, 0]];
/* envolvente convexa de puntos en pantalla */
function hull(pts) {
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
/* tronco con volumen: anillos elipticos (cintura, pecho, hombros) y su silueta */
function torsoRings(it, t0, t1, PJ) {
  const { J, bottom, goalie } = it;
  const top = add(J.chest, mul(J.spine, 0.05));
  const g = goalie ? 1.25 : 1;
  /* [altura 0..1, semiancho, semifondo] */
  /* el arbitro tiene una buena barriga: anillos mas anchos y adelantados en la cintura */
  const prof = it.kit === REF_KIT ? PROF_REF : PROF_PL;
  const pts = [];
  const ring = (h, a, b, fo) => {
    const c = add(lerp3(bottom, top, h), mul(J.f, fo * g));
    const ax = norm(lerp3(J.r, J.shAx, h)), fz = norm(cross([0, 1, 0], ax)).map(v => -v);
    const fw = norm(sub(J.f, mul(ax, dot(J.f, ax))));
    for (let k = 0; k < 12; k++) { const an = k / 12 * Math.PI * 2; pts.push(PJ(add(c, add(mul(ax, Math.cos(an) * a * g), mul(fw, Math.sin(an) * b * g))))); }
  };
  for (let i = 0; i < prof.length - 1; i++) {
    const [h0, a0, b0] = prof[i], [h1, a1, b1] = prof[i + 1];
    for (const h of [h0, h1]) {
      if (h < t0 - 1e-6 || h > t1 + 1e-6) continue;
      const u = (h - h0) / (h1 - h0 || 1); ring(h, lerp(a0, a1, u), lerp(b0, b1, u), lerp(prof[i][3], prof[i + 1][3], u));
    }
  }
  for (const h of [t0, t1]) { let i = 0; while (i < prof.length - 2 && prof[i + 1][0] < h) i++; const [h0, a0, b0, f0] = prof[i], [h1, a1, b1, f1] = prof[i + 1], u = clamp((h - h0) / (h1 - h0), 0, 1); ring(h, lerp(a0, a1, u), lerp(b0, b1, u), lerp(f0, f1, u)); }
  return hull(pts);
}
function torsoPt(it, h, an) {
  const { J, bottom, goalie } = it;
  const top = add(J.chest, mul(J.spine, 0.05)), g = goalie ? 1.25 : 1;
  const prof = it.kit === REF_KIT ? PROF_REF : PROF_PL;
  let i = 0; while (i < prof.length - 2 && prof[i + 1][0] < h) i++;
  const [h0, a0, b0, f0] = prof[i], [h1, a1, b1, f1] = prof[i + 1], u = clamp((h - h0) / (h1 - h0), 0, 1);
  const a = lerp(a0, a1, u) * g, b = lerp(b0, b1, u) * g, fo = lerp(f0, f1, u) * g;
  const ax = norm(lerp3(J.r, J.shAx, h)), fw = norm(sub(J.f, mul(ax, dot(J.f, ax))));
  const c = add(lerp3(bottom, top, h), mul(J.f, fo));
  const P3 = add(c, add(mul(ax, Math.cos(an) * a), mul(fw, Math.sin(an) * b)));
  const n = norm(add(mul(ax, Math.cos(an) / a), mul(fw, Math.sin(an) / b)));
  return [P3, n];
}
function fillPoly(h, style) {
  ctx.fillStyle = style; ctx.beginPath(); h.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fill();
}
function torso(it, PJ, mirror) {
  const { kit } = it;
  const h = torsoRings(it, 0, 1, PJ);
  if (mirror) { fillPoly(h, kit.main); return; }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of h) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  /* luz desde arriba a la izquierda: volumen en horizontal y en vertical */
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, kit.light); g.addColorStop(0.45, kit.main); g.addColorStop(1, kit.shadeC || kit.mainD);
  fillPoly(h, g);
  const v = ctx.createLinearGradient(0, y0, 0, y1);
  v.addColorStop(0, 'rgba(255,255,255,0.14)'); v.addColorStop(0.35, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(0,0,0,0.22)');
  fillPoly(h, v);
  /* franjas pintadas sobre la superficie visible del tronco (recortadas a su silueta) */
  ctx.save(); ctx.beginPath(); h.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.clip();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  const toCam = norm(sub(cam.p, it.J.chest));
  const strokeVis = (pts, w, col) => {
    let open = false;
    ctx.strokeStyle = col; ctx.beginPath();
    for (const [P3, n] of pts) {
      if (dot(n, toCam) > -0.05) { const q = PJ(P3); if (!open) { ctx.moveTo(q.x, q.y); open = true; } else ctx.lineTo(q.x, q.y); ctx.lineWidth = Math.max(1, w * q.s); }
      else open = false;
    }
    ctx.stroke();
  };
  if (kit === REF_KIT) {
    /* arbitro: rayas verticales que siguen la curva de la barriga */
    for (let k = 0; k < 14; k += 2) { const col = []; for (let j = 0; j <= 10; j++) col.push(torsoPt(it, j / 10, (k + 0.5) / 14 * Math.PI * 2)); strokeVis(col, 0.075, kit.dark); }
  } else {
    const ringAt = hh => { const r = []; for (let k = 0; k <= 24; k++) r.push(torsoPt(it, hh, k / 24 * Math.PI * 2)); return r; };
    if (kit.stripes) { strokeVis(ringAt(0.25), 0.11, kit.dark); strokeVis(ringAt(0.57), 0.11, kit.dark); }
    else strokeVis(ringAt(0.13), 0.06, kit.trim);
    strokeVis(ringAt(0.97), 0.04, kit.dark);
  }
  ctx.restore();
}

function number(it) {
  const { J, back, num, kit } = it;
  const c = add(lerp3(J.pelvis, J.chest, 0.6), mul(J.f, back ? -0.165 : 0.165));
  const o = Pv(c), ex = Pv(add(c, mul(J.r, back ? 0.01 : -0.01))), ey = Pv(add(c, mul(J.spine, -0.01)));
  const a = (ex.x - o.x) * 100, b = (ex.y - o.y) * 100, cc = (ey.x - o.x) * 100, d = (ey.y - o.y) * 100;
  if (Math.abs(a * d - b * cc) < 30) return;
  ctx.save();
  ctx.transform(a, b, cc, d, o.x, o.y);
  ctx.font = `900 ${back ? 0.3 : 0.16}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = kit.num;
  if (back && it.name) {
    ctx.fillText(String(num), 0, 0.06);
    ctx.font = '900 0.11px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillText(it.name, 0, -0.15);
  } else ctx.fillText(String(num), back ? 0 : 0.06, 0.01);
  ctx.restore();
}

function helmet(it, PJ, mirror) {
  const q = PJ(it.c), rr = it.r * q.s;
  if (mirror) { ctx.fillStyle = it.col; ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, 6.29); ctx.fill(); return; }
  const g = ctx.createRadialGradient(q.x - rr * 0.35, q.y - rr * 0.45, rr * 0.05, q.x, q.y, rr);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, it.col); g.addColorStop(1, shade(it.col.startsWith('#') ? it.col : '#888888', 0.75));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, 6.29); ctx.fill();
  /* borde del casco sobre la frente */
  const toCam = norm(sub(cam.p, it.c));
  if (dot(it.f, toCam) > -0.2) {
    ctx.strokeStyle = shade(it.col.startsWith('#') ? it.col : '#888888', 0.6); ctx.lineWidth = Math.max(1, 0.02 * q.s);
    ctx.beginPath();
    for (let k = -6; k <= 6; k++) { const a = k / 6 * 1.1, v = PJ(add(it.c, add(mul(it.f, Math.cos(a) * 0.15), add(mul(it.r3, Math.sin(a) * 0.15), [0, 0.03, 0])))); k === -6 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y); }
    ctx.stroke();
  }
  if (it.goalie) {   /* mascara con los colores del equipo */
    const a = PJ(add(it.c, [0, 0.1, 0])), b = PJ(add(it.c, add(mul(it.f, -0.1), [0, 0.06, 0])));
    ctx.strokeStyle = it.kit.main; ctx.lineWidth = 0.05 * q.s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

/* rejilla metalica del casco: barras sobre una media esfera delante de la cara */
function cage(it, PJ) {
  const toCam = norm(sub(cam.p, it.c));
  if (dot(it.f, toCam) < -0.15) return;
  const R0 = 0.165, c = add(it.c, [0, -0.03, 0]);
  const pt = (ph, th) => PJ(add(c, add(mul(it.f, Math.cos(th) * Math.cos(ph) * R0), add(mul(it.r3, Math.cos(th) * Math.sin(ph) * R0), [0, Math.sin(th) * R0 * 1.05, 0]))));
  const vis = (ph, th) => dot(add(mul(it.f, Math.cos(th) * Math.cos(ph)), mul(it.r3, Math.cos(th) * Math.sin(ph))), toCam) > -0.1;
  const q = PJ(c), w = Math.max(0.7, 0.011 * q.s);
  ctx.lineCap = 'round';
  const bar = (fn, n, col, lw) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); let open = false;
    for (let i = 0; i <= n; i++) { const [ph, th] = fn(i / n); if (vis(ph, th)) { const v = pt(ph, th); open ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y); open = true; } else open = false; }
    ctx.stroke();
  };
  const col = '#c3cad3', dark = '#6d7480';
  /* marco exterior y barbillera */
  bar(u => [-1.0 + 2.0 * u, 0.18], 12, dark, w * 1.8);
  bar(u => [-1.0, 0.18 - 1.0 * u], 8, dark, w * 1.8);
  bar(u => [1.0, 0.18 - 1.0 * u], 8, dark, w * 1.8);
  bar(u => [-1.0 + 2.0 * u, -0.86], 12, dark, w * 2.4);
  /* barras verticales finas y horizontales */
  for (let k = -3; k <= 3; k++) bar(u => [k * 0.27, 0.18 - 1.04 * u], 8, col, w);
  for (const th of [-0.08, -0.34, -0.6]) bar(u => [-1.0 + 2.0 * u, th], 12, col, w);
}

function goalieHand(it, PJ) {
  const q = PJ(it.c), s = q.s;
  if (it.t === 6) {   /* guante */
    ctx.fillStyle = it.kit.dark; ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.15 * s, 0.13 * s, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = it.kit.trim; ctx.beginPath(); ctx.arc(q.x, q.y, 0.07 * s, 0, 6.29); ctx.fill();
  } else {            /* blocker */
    const a = PJ(add(it.c, add(mul(it.f, 0.05), [0, 0.15, 0]))), b = PJ(add(it.c, add(mul(it.f, 0.05), [0, -0.15, 0])));
    ctx.strokeStyle = it.kit.dark; ctx.lineCap = 'butt'; ctx.lineWidth = 0.2 * s;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = it.kit.main; ctx.lineWidth = 0.06 * s; ctx.stroke();
  }
}

/* =================================================================
   PORTERIAS (cada linea con su profundidad) Y DISCO
   ================================================================= */
function goalSegs(side, out) {
  const x0 = side * GLX, D = side * GDM, W2 = GW, Hh = GHM;
  const net = 'rgba(255,255,255,0.5)', red = '#e23b33';
  const L = (a, b, w, col) => out.push({ k: 'seg', a, b, w, col, d: (dot(sub(a, cam.p), CF) + dot(sub(b, cam.p), CF)) / 2 });
  for (let i = 0; i <= 10; i++) {
    const z = -W2 + 2 * W2 * i / 10;
    L([x0 + D, 0.25, z], [x0 + D, 0, z], 0, net);
    L([x0, Hh, z], [x0 + D * 0.45, Hh * 0.55, z], 0, net); L([x0 + D * 0.45, Hh * 0.55, z], [x0 + D, 0.25, z], 0, net);
  }
  for (let j = 1; j < 5; j++) { const f = j / 5; L([x0 + D * 0.45 * f, Hh - Hh * 0.45 * f, -W2], [x0 + D * 0.45 * f, Hh - Hh * 0.45 * f, W2], 0, net); }
  for (const z of [-W2, W2]) for (let j = 1; j < 5; j++) { const y = Hh * j / 5; L([x0, y, z], [x0 + D * Math.min(1, (Hh - y) / Hh * 1.4), Math.min(y, 0.25 + (Hh - y)), z], 0, net); }
  for (const z of [-W2, W2]) {
    L([x0, 0, z], [x0, Hh, z], 0.07, red); L([x0, Hh, z], [x0 + D * 0.45, Hh * 0.55, z], 0.05, red);
    L([x0 + D * 0.45, Hh * 0.55, z], [x0 + D, 0.25, z], 0.05, red); L([x0 + D, 0.25, z], [x0 + D, 0, z], 0.05, red); L([x0, 0, z], [x0 + D, 0, z], 0.05, red);
  }
  L([x0, Hh, -W2], [x0, Hh, W2], 0.07, red); L([x0 + D, 0.25, -W2], [x0 + D, 0.25, W2], 0.05, red); L([x0 + D, 0, -W2], [x0 + D, 0, W2], 0.05, red);
}

function drawPuck(trail) {
  const X = mx(puck.x), Y = mh(puck.h) + 0.0125, Z = mz(puck.y);
  const sh = Pj(X, 0, Z), q = Pj(X, Y, Z), r = Math.max(4, 0.062 * q.s);
  /* halo en el suelo para localizar el disco */
  const hr = Math.max(14, 0.36 * sh.s);
  const hg = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, hr);
  hg.addColorStop(0, 'rgba(255,255,255,0.55)'); hg.addColorStop(0.5, 'rgba(255,245,200,0.22)'); hg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, hr, hr * 0.45, 0, 0, 6.29); ctx.fill();
  const air = clamp(Y / 1.2, 0, 1);
  ctx.fillStyle = `rgba(15,35,55,${(0.45 - air * 0.25).toFixed(2)})`; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * (1.3 - air * 0.5), r * (0.5 - air * 0.2), 0, 0, 6.29); ctx.fill();
  if (Y > 0.12) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); }
  const spd = Math.hypot(puck.vx, puck.vy);
  if (trail && spd > 180 && puck.holder < 0) {
    const k = clamp((spd - 180) / 200, 0, 1) * 0.06;
    const b = Pj(X - puck.vx * k / 10, Y - puck.vh * k / 10, Z - puck.vy * k / 10);
    const g = ctx.createLinearGradient(b.x, b.y, q.x, q.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.8)');
    ctx.strokeStyle = g; ctx.lineWidth = r * 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  const tilt = Y > 0.1 ? Math.sin(time * 25) * 0.5 : 0;
  ctx.fillStyle = '#0e0f13'; ctx.beginPath(); ctx.ellipse(q.x, q.y, r, Math.max(r * (0.45 + Math.abs(tilt) * 0.5), 2), tilt, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, r * 0.22); ctx.stroke();
  ctx.fillStyle = '#ff6a00'; ctx.beginPath(); ctx.ellipse(q.x, q.y - r * 0.1, r * 0.72, Math.max(r * 0.3, 1.2), 0, 0, 6.29); ctx.fill();
}

/* =================================================================
   CONFETI
   ================================================================= */
const confetti = [];
function spawnConfetti(cols, gx) {
  confetti.length = 0;
  for (let i = 0; i < 220; i++) confetti.push({ x: gx + (Math.random() - 0.5) * 16, y: 6 + Math.random() * 4, z: -6 + Math.random() * 10, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5 - 0.5, vz: (Math.random() - 0.5), r: Math.random() * 6, vr: (Math.random() - 0.5) * 16, c: cols[i % cols.length] });
}
function updateConfetti(dt) {
  for (const p of confetti) { p.vy = Math.max(p.vy - 3 * dt, -2.2); p.x += p.vx * dt + Math.sin(p.r) * 0.01; p.y += p.vy * dt; p.z += p.vz * dt; p.r += p.vr * dt; }
}
function drawConfetti() {
  for (const p of confetti) {
    if (p.y < 0) continue;
    const q = Pj(p.x, p.y, p.z), s = q.s * 0.07;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.r * 1.7));
    ctx.fillStyle = p.c; ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
  }
}

/* =================================================================
   CAMARA DE JUEGO
   ================================================================= */
const CAMS = ['TV', 'CERCA', 'PISTA'];
let fx = 0, fz = 0, camSnap = true;
function camTarget() {
  if (cam.debug) return cam.debug;
  if (cam.replay) {
    const gx = cam.replay.gx, sg = Math.sign(gx), px = mx(puck.x), pz = mz(puck.y);
    return [[gx - sg * 6.5 + (px - gx) * 0.25, 3.0, 10.2], [px * 0.55 + gx * 0.45, 0.55, pz * 0.6]];
  }
  let tx = mx(puck.x + puck.vx * 0.25), tz = mz(puck.y);
  tx = clamp(tx, -15, 15);
  const portrait = VW < VH;
  /* plano corto de la pena de los Linces celebrando el gol */
  const crowd = W.state === G.S_GOAL && W.goalTeam === 0 && !W.so && !cam.replay && W.timer < 3.2 && W.timer > 1.7;
  if (crowd !== camTarget.crowd) { camTarget.crowd = crowd; camSnap = true; }
  if (crowd) { const u = (3.2 - W.timer) / 1.5; return [[-0.9 + u * 1.0, 3.3, -3.2 - u * 0.5], [-0.4 + u * 0.5, 2.15, -12]]; }
  if (W.state === G.S_GOAL && W.goalTeam >= 0) {
    const gx = W.goalTeam === 0 ? GLX : -GLX, u = ease(clamp((4.6 - W.timer) / 1.2, 0, 1));
    const s = Math.sign(gx);
    return [lerp3(base(tx, tz, portrait), [gx - s * 7, 4.6, 11.5], u), lerp3(look(tx, tz), [gx - s * 0.5, 0.6, -0.5], u)];
  }
  return [base(tx, tz, portrait), look(tx, tz)];
}
function base(tx, tz, portrait) {
  const m = cam.mode;
  if (m === 1) return [tx * 0.95, 8.2, 13.5 + tz * 0.15];
  if (m === 2) return [tx * 0.9 - 2.5, 2.6, 12.2];
  return portrait ? [tx * 0.6, 17, 22] : [tx * 0.8, 12.2, 19.4];
}
function look(tx, tz) {
  const m = cam.mode;
  if (m === 1) return [tx * 0.95, 0, tz * 0.35 - 0.6];
  if (m === 2) return [tx * 0.9 + 1, 0.6, tz * 0.3 - 1.5];
  return [tx * 0.8, 0, tz * 0.2 - 0.1];
}
function updateCamera(dt) {
  const [tp, tl] = camTarget();
  const k = camSnap ? 1 : 1 - Math.exp(-dt * 4.5);
  cam.p = lerp3(cam.p, tp, k); cam.l = lerp3(cam.l, tl, k); camSnap = false;
  cam.fov = cam.mode === 2 ? 46 : cam.mode === 1 ? 38 : 34;
  setupCam();
}

/* =================================================================
   MARCADORES BAJO EL JUGADOR CONTROLADO
   ================================================================= */
function ringOnIce(X, Z, r, col, w, a0 = 0, a1 = Math.PI * 2) {
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) { const a = a0 + (a1 - a0) * i / 32, q = Pj(X + Math.cos(a) * r, 0.005, Z + Math.sin(a) * r); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
function drawMarkers() {
  for (const t of [0, 1]) {
    if (!G.isHuman(t) || (W.state !== G.S_PLAY && W.state !== G.S_FACE)) continue;
    if (!PL[W.human[t]] || !PL[W.human[t]].active) continue;
    const p = PL[W.human[t]], X = mx(p.x), Z = mz(p.y), col = t ? '#5ce1ff' : '#ffe14d';
    const q = Pj(X, 0, Z);
    ringOnIce(X, Z, 0.55, col, Math.max(2, 0.06 * q.s));
    if (p.charging) {
      const k = Math.min(1, p.charge / G.CHG_MAX);
      ringOnIce(X, Z, 0.72, k >= 1 ? '#ff4b3a' : '#ffffff', Math.max(3, 0.1 * q.s), -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    }
    const hq = Pj(X, 2.45, Z), s = hq.s;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hq.x, hq.y + 0.14 * s); ctx.lineTo(hq.x - 0.13 * s, hq.y - 0.06 * s); ctx.lineTo(hq.x + 0.13 * s, hq.y - 0.06 * s); ctx.closePath(); ctx.fill();
  }
}

/* =================================================================
   FOTOGRAMA
   ================================================================= */
let time = 0;
function frame(dt, cheer) {
  time += dt;
  updateCamera(dt);
  if (gl) drawFloorGL();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  drawBackdrop(time);
  drawStands(time, cheer);
  drawPenaltyBox();
  drawBoards(false);
  if (!gl) drawFloor2D();
  /* reflejos y sombras sobre la pista */
  ctx.save(); rinkPath(ctx); ctx.clip();
  ctx.globalAlpha = 0.13;
  for (const p of PL) if (p.active) drawSkater(p, kitOf(G.TM(p.team)), time, true);
  const rp = refPlayer();
  drawSkater(rp, REF_KIT, time, true);
  ctx.globalAlpha = 1;
  for (const p of PL.concat([rp])) {
    if (!p.active) continue;
    const q = Pj(mx(p.x) + 0.12, 0, mz(p.y) - 0.08), rx = (p.role ? 0.6 : 0.8) * q.s;
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rx);
    g.addColorStop(0, 'rgba(15,40,60,0.38)'); g.addColorStop(1, 'rgba(15,40,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(q.x, q.y, rx, rx * 0.42, 0, 0, 6.29); ctx.fill();
  }
  drawMarkers();
  ctx.restore();
  /* jugadores, porterias y disco por profundidad */
  const ents = [];
  for (const p of PL) if (p.active) ents.push({ k: 'pl', p, d: dot(sub([mx(p.x), 0.9, mz(p.y)], cam.p), CF) });
  ents.push({ k: 'ref', d: dot(sub([mx(rp.x), 0.9, mz(rp.y)], cam.p), CF) });
  goalSegs(-1, ents); goalSegs(1, ents);
  ents.push({ k: 'puck', d: dot(sub([mx(puck.x), 0, mz(puck.y)], cam.p), CF) - (puck.holder >= 0 ? 0.3 : 0) });
  ents.sort((a, b) => b.d - a.d);
  for (const e of ents) {
    if (e.k === 'pl') drawSkater(e.p, kitOf(G.TM(e.p.team)), time, false);
    else if (e.k === 'ref') drawSkater(rp, REF_KIT, time, false);
    else if (e.k === 'puck') drawPuck(true);
    else {
      const a = Pv(e.a), b = Pv(e.b);
      if (a.bh || b.bh) continue;
      ctx.strokeStyle = e.col; ctx.lineCap = 'round'; ctx.lineWidth = e.w ? Math.max(1.5, e.w * (a.s + b.s) / 2) : 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  drawBoards(true);
  if (confetti.length) { updateConfetti(dt); drawConfetti(); }
  if (cam.replay) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH * 0.07); ctx.fillRect(0, VH * 0.93, VW, VH * 0.07); }
}

function resize(w, h, dpr) {
  VW = w; VH = h; DPR = dpr;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  glc.width = Math.round(w * dpr); glc.height = Math.round(h * dpr);
  setupCam();
}

function init(canvas2d, canvasGL) {
  cv = canvas2d; glc = canvasGL; ctx = cv.getContext('2d');
  initGL();
  buildFloorTexture(); uploadFloor();
  buildAds(); buildStands();
}

return { IMG, init, resize, frame, cam, CAMS, spawnConfetti, confetti, snap() { camSnap = true; }, get ctx() { return ctx; }, get hasGL() { return !!gl; },
  rebuild() { buildFloorTexture(); uploadFloor(); ADS.length = 0; buildAds(); STANDS.length = 0; buildStands(); } };
})();
