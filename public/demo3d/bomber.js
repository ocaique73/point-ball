// Point Ball 3D — Bomber (cliente). Solo contra bots (simulação roda aqui) ou online (servidor manda, aqui só prevê o próprio movimento).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { BomberSim, BomberMirror, BM, CELL, cellOf, centerOf, CURSE_NAME, MAP_LIST, BOMBER_MAPS } from '/demo3d/bomber3d.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SLOT_COL = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b];
const SLOT_CSS = ['#60a5fa', '#f87171', '#4ade80', '#fbbf24'];
const ITEM_LABEL = { bomb: 'Bombas', fire: 'Alcance', skate: 'Patinete', glove: 'Luva', kick: 'Chute', smoke: 'Fumaça', skull: 'Caveira', jump: 'Super pulo' };
const CHAR_H = 64;

// ================= ícones (desenhados em canvas, sem imagens) =================
function drawIcon(g, k, s) {
  const c = s / 2, bg = { bomb: '#3b4a6b', fire: '#b4381c', skate: '#1d6fb8', glove: '#8a5a1a', kick: '#8a2d2d', smoke: '#5b6573', skull: '#3a1a4a', jump: '#2a7a3a' }[k];
  g.clearRect(0, 0, s, s);
  g.fillStyle = bg; g.beginPath(); g.arc(c, c, s * 0.46, 0, 7); g.fill();
  g.lineWidth = s * 0.04; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (k === 'bomb') {
    g.fillStyle = '#0d1018'; g.beginPath(); g.arc(c, c + s * 0.05, s * 0.24, 0, 7); g.fill();
    g.fillStyle = '#fff8'; g.beginPath(); g.arc(c - s * 0.08, c - s * 0.04, s * 0.05, 0, 7); g.fill();
    g.strokeStyle = '#d8b878'; g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(c + s * 0.1, c - s * 0.15); g.quadraticCurveTo(c + s * 0.2, c - s * 0.3, c + s * 0.26, c - s * 0.26); g.stroke();
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(c + s * 0.27, c - s * 0.27, s * 0.06, 0, 7); g.fill();
  } else if (k === 'fire') {
    g.fillStyle = '#ffb21a'; g.beginPath(); g.moveTo(c, c - s * 0.33); g.bezierCurveTo(c + s * 0.3, c - s * 0.05, c + s * 0.3, c + s * 0.3, c, c + s * 0.3); g.bezierCurveTo(c - s * 0.3, c + s * 0.3, c - s * 0.3, c, c - s * 0.08, c - s * 0.12); g.bezierCurveTo(c - s * 0.05, c - s * 0.2, c, c - s * 0.25, c, c - s * 0.33); g.fill();
    g.fillStyle = '#fff2a0'; g.beginPath(); g.moveTo(c, c - s * 0.05); g.bezierCurveTo(c + s * 0.15, c + s * 0.08, c + s * 0.12, c + s * 0.22, c, c + s * 0.22); g.bezierCurveTo(c - s * 0.12, c + s * 0.22, c - s * 0.13, c + s * 0.08, c, c - s * 0.05); g.fill();
  } else if (k === 'skate') { // patins/patinete: bota com rodinhas
    g.fillStyle = '#f2f4f8'; g.beginPath(); g.moveTo(c - s * 0.25, c - s * 0.25); g.lineTo(c - s * 0.05, c - s * 0.25); g.lineTo(c - s * 0.02, c + s * 0.02); g.lineTo(c + s * 0.27, c + s * 0.08); g.lineTo(c + s * 0.27, c + s * 0.17); g.lineTo(c - s * 0.25, c + s * 0.17); g.closePath(); g.fill();
    g.fillStyle = '#ff5050'; g.fillRect(c - s * 0.25, c + s * 0.12, s * 0.52, s * 0.06);
    g.fillStyle = '#111'; for (const dx of [-0.17, 0.0, 0.18]) { g.beginPath(); g.arc(c + s * dx, c + s * 0.27, s * 0.055, 0, 7); g.fill(); }
  } else if (k === 'glove') {
    g.fillStyle = '#fff'; g.strokeStyle = '#666'; g.lineWidth = s * 0.02;
    g.beginPath(); g.roundRect(c - s * 0.17, c - s * 0.05, s * 0.34, s * 0.3, s * 0.06); g.fill(); g.stroke();
    for (let i = 0; i < 4; i++) { g.beginPath(); g.roundRect(c - s * 0.17 + i * s * 0.085, c - s * 0.3 + (i === 1 || i === 2 ? -s * 0.03 : 0), s * 0.075, s * 0.3, s * 0.035); g.fill(); g.stroke(); }
    g.beginPath(); g.roundRect(c - s * 0.3, c - s * 0.04, s * 0.15, s * 0.1, s * 0.04); g.fill(); g.stroke();
    g.fillStyle = '#e03030'; g.fillRect(c - s * 0.17, c + s * 0.18, s * 0.34, s * 0.07);
  } else if (k === 'kick') { // tênis/chuteira
    g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(c - s * 0.22, c - s * 0.22); g.lineTo(c - s * 0.02, c - s * 0.22); g.lineTo(c, c); g.lineTo(c + s * 0.28, c + s * 0.06); g.quadraticCurveTo(c + s * 0.3, c + s * 0.18, c + s * 0.2, c + s * 0.18); g.lineTo(c - s * 0.22, c + s * 0.18); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.fillRect(c - s * 0.22, c + s * 0.14, s * 0.46, s * 0.06);
    g.strokeStyle = '#7a4a00'; g.lineWidth = s * 0.02; g.beginPath(); g.moveTo(c - s * 0.15, c - s * 0.12); g.lineTo(c, c - s * 0.05); g.stroke();
  } else if (k === 'smoke') {
    g.fillStyle = '#e6eaf0'; for (const [dx, dy, r] of [[-0.14, 0.04, 0.15], [0.05, -0.08, 0.19], [0.17, 0.07, 0.14], [-0.02, 0.09, 0.16]]) { g.beginPath(); g.arc(c + s * dx, c + s * dy, s * r, 0, 7); g.fill(); }
  } else if (k === 'jump') { // mola + seta pra cima
    g.strokeStyle = '#e8f6e8'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(c - s * 0.16, c + s * 0.28); for (let i = 0; i < 4; i++) { g.lineTo(c + s * 0.16, c + s * (0.2 - i * 0.075)); g.lineTo(c - s * 0.16, c + s * (0.16 - i * 0.075)); } g.stroke();
    g.fillStyle = '#ffe14a'; g.beginPath(); g.moveTo(c, c - s * 0.36); g.lineTo(c + s * 0.17, c - s * 0.14); g.lineTo(c + s * 0.06, c - s * 0.14); g.lineTo(c + s * 0.06, c - s * 0.04); g.lineTo(c - s * 0.06, c - s * 0.04); g.lineTo(c - s * 0.06, c - s * 0.14); g.lineTo(c - s * 0.17, c - s * 0.14); g.closePath(); g.fill();
  } else if (k === 'skull') {
    g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(c, c - s * 0.04, s * 0.24, 0, 7); g.fill(); g.fillRect(c - s * 0.13, c + s * 0.05, s * 0.26, s * 0.2);
    g.fillStyle = '#1a0f22'; g.beginPath(); g.arc(c - s * 0.09, c - s * 0.04, s * 0.07, 0, 7); g.arc(c + s * 0.09, c - s * 0.04, s * 0.07, 0, 7); g.fill();
    g.beginPath(); g.moveTo(c, c + s * 0.02); g.lineTo(c - s * 0.03, c + s * 0.09); g.lineTo(c + s * 0.03, c + s * 0.09); g.fill();
    g.fillRect(c - s * 0.08, c + s * 0.15, s * 0.025, s * 0.1); g.fillRect(c - s * 0.012, c + s * 0.15, s * 0.025, s * 0.1); g.fillRect(c + s * 0.055, c + s * 0.15, s * 0.025, s * 0.1);
  }
}
const ICON_URL = {}, ICON_TEX = {};
for (const k of Object.keys(ITEM_LABEL)) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 96; drawIcon(cv.getContext('2d'), k, 96);
  ICON_URL[k] = cv.toDataURL(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; ICON_TEX[k] = t;
}

// ================= áudio (tudo sintetizado) =================
const A = { ctx: null, master: null, noise: null, on: true, fuseG: null, fuseF: null };
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  try {
    const ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    A.master = ctx.createGain(); A.master.gain.value = 0.7; A.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    // chiado do pavio (loop contínuo, volume/tom vêm da bomba mais próxima)
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    A.fuseF = ctx.createBiquadFilter(); A.fuseF.type = 'bandpass'; A.fuseF.frequency.value = 3500; A.fuseF.Q.value = 1.2;
    A.fuseG = ctx.createGain(); A.fuseG.gain.value = 0;
    src.connect(A.fuseF); A.fuseF.connect(A.fuseG); A.fuseG.connect(A.master); src.start();
  } catch (e) { A.ctx = null; }
}
function spatial(pos) { // pos = [x,z] no mundo; sem pos = som "na cabeça" (UI)
  if (!pos || !V.me) return [1, 0];
  const dx = pos[0] - V.me.x, dz = pos[1] - V.me.z, d = Math.hypot(dx, dz), vol = Math.pow(clamp(1 - d / 1100, 0, 1), 1.6);
  const rx = -Math.sin(V.yaw), rz = Math.cos(V.yaw), pan = d > 1 ? clamp((dx * rx + dz * rz) / d, -1, 1) * 0.85 : 0;
  return [vol, pan];
}
function outNode(vol, pan) {
  const g = A.ctx.createGain(); g.gain.value = vol;
  if (A.ctx.createStereoPanner) { const p = A.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(A.master); } else g.connect(A.master);
  return g;
}
function tone(f0, f1, dur, type, vol, pos, delay) {
  if (!A.ctx || !A.on) return; const [v, pan] = spatial(pos); if (v < 0.01) return;
  const t0 = A.ctx.currentTime + (delay || 0), o = A.ctx.createOscillator(), env = A.ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(env); env.connect(outNode(v, pan)); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, ftype, f0, f1, vol, pos, delay, q) {
  if (!A.ctx || !A.on) return; const [v, pan] = spatial(pos); if (v < 0.01) return;
  const t0 = A.ctx.currentTime + (delay || 0), s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), env = A.ctx.createGain();
  s.buffer = A.noise; s.loop = true; f.type = ftype; f.Q.value = q || 0.8; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(env); env.connect(outNode(v, pan)); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}
const SFX = {
  whistle(pos) { tone(1200, 220, 0.3, 'sine', 0.22, pos); noise(0.3, 'bandpass', 2400, 500, 0.1, pos, 0, 3); },   // bomba caindo
  thud(pos) { tone(150, 42, 0.2, 'sine', 0.8, pos); noise(0.09, 'lowpass', 900, 150, 0.45, pos); },             // bomba batendo no chão
  boom(pos) { noise(0.9, 'lowpass', 1800, 90, 1.0, pos); tone(110, 28, 0.8, 'sine', 1.0, pos); tone(70, 25, 1.1, 'triangle', 0.7, pos, 0.03); },
  step(pos, k) { noise(0.06, 'lowpass', 700 + (k || 0) * 120, 220, pos ? 0.5 : 0.18, pos); tone(95, 55, 0.07, 'sine', 0.12, pos); },
  pick() { tone(660, 660, 0.08, 'square', 0.16); tone(880, 880, 0.08, 'square', 0.16, null, 0.07); tone(1320, 1320, 0.14, 'square', 0.16, null, 0.14); },
  curse() { tone(300, 90, 0.6, 'sawtooth', 0.3); tone(310, 110, 0.6, 'square', 0.15, null, 0.05); },
  kick(pos) { tone(200, 70, 0.15, 'triangle', 0.6, pos); noise(0.08, 'bandpass', 1500, 500, 0.4, pos); },
  throw(pos) { noise(0.35, 'bandpass', 400, 2200, 0.35, pos, 0, 2); },
  grab(pos) { tone(500, 800, 0.1, 'triangle', 0.3, pos); },
  smoke(pos) { noise(0.9, 'bandpass', 1500, 600, 0.5, pos, 0, 0.5); },
  die(pos) { tone(420, 60, 0.7, 'sawtooth', 0.4, pos); },
  beep(hi) { tone(hi ? 1040 : 520, hi ? 1040 : 520, 0.14, 'square', 0.22); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.2, 'square', 0.22, null, i * 0.13)); },
  drop(pos) { tone(90, 40, 0.18, 'sine', 0.5, pos); noise(0.12, 'lowpass', 600, 150, 0.3, pos); },
  warn() { tone(880, 880, 0.12, 'square', 0.22); tone(660, 660, 0.12, 'square', 0.22, null, 0.16); tone(880, 880, 0.12, 'square', 0.22, null, 0.32); },
  horn() { tone(220, 220, 0.9, 'sawtooth', 0.3); tone(277, 277, 0.9, 'sawtooth', 0.25); noise(1.4, 'lowpass', 500, 120, 0.3); },
  whoosh(pos) { noise(1.6, 'bandpass', 250, 1400, 0.6, pos, 0, 0.8); },
  rumble() { noise(1.6, 'lowpass', 200, 50, 0.8, null); tone(55, 35, 1.4, 'sine', 0.6); },
  roar() { tone(160, 70, 1.3, 'sawtooth', 0.35); noise(1.3, 'bandpass', 600, 150, 0.5, null, 0, 1.5); },
  zap(pos) { tone(300, 1500, 0.25, 'sine', 0.3, pos); tone(1500, 400, 0.2, 'triangle', 0.2, pos, 0.2); },
  boing(pos) { tone(200, 640, 0.22, 'sine', 0.45, pos); tone(640, 330, 0.18, 'sine', 0.25, pos, 0.2); },
  wind() { noise(2.2, 'bandpass', 300, 900, 0.5, null, 0, 0.6); },
  thunder() { noise(1.8, 'lowpass', 500, 60, 0.9, null); tone(60, 30, 1.4, 'sine', 0.5); },
  burn(pos) { noise(0.25, 'highpass', 3000, 1200, 0.25, pos); }
};

// ================= cena =================
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x182036); scene.fog = new THREE.Fog(0x182036, 600, 2200);
const camera = new THREE.PerspectiveCamera(70, 1, 3, 4000);
const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x3a3250, 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
{ const c = sun.shadow.camera; c.left = -950; c.right = 950; c.top = 950; c.bottom = -950; c.near = 100; c.far = 3000; sun.shadow.bias = -0.0006; }
scene.add(sun, sun.target);
const flash = new THREE.PointLight(0xffa040, 0, 700, 1.6); scene.add(flash);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

function canvasTex(w, h, fn, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}
// ---------- temas visuais de cada mapa (cores, céu, textura dos blocos) ----------
const THEMES = {
  classic: { floor: ['#3f8f4a', '#4aa056'], block: ['#c4713a', 'brick'], stone: ['#6c7696', 'stone'], sky: '#182036', fog: [600, 2200], hemi: ['#dfe9ff', '#3a3250', 1.05], sun: ['#fff1d6', 1.7] },
  metro: { floor: ['#8e9094', '#84868a'], block: ['#e4dcc4', 'tile'], stone: ['#a79c80', 'stone'], sky: '#2a2c33', fog: [700, 2400], hemi: ['#ffffff', '#55565c', 1.25], sun: ['#ffffff', 1.2] },
  mar: { floor: ['#9a7650', '#8a6844'], block: ['#a8744a', 'crate'], stone: ['#fff', 'container', ['#2f6f9f', '#b03a2e', '#2f8f5b', '#d9822b', '#8a939c']], sky: '#6fb2de', fog: [900, 3200], hemi: ['#e8f4ff', '#6a5a46', 1.2], sun: ['#fff4dc', 1.9] },
  obra: { floor: ['#8a7458', '#7a6448'], block: ['#c9a36a', 'crate'], stone: ['#9a9a9a', 'stone'], sky: '#b9a98c', fog: [800, 2800], hemi: ['#fff1d8', '#5a4a38', 1.1], sun: ['#ffe2b0', 1.8] },
  fabrica: { floor: ['#6b6f76', '#62666d'], block: ['#7a5a48', 'brick'], stone: ['#8a8f99', 'stone'], sky: '#1d1f24', fog: [500, 2000], hemi: ['#cfd6e6', '#3a3d45', 0.95], sun: ['#ffd9a8', 1.5] },
  castelo: { floor: ['#6f8a4c', '#647d44'], block: ['#b9b9b2', 'brick'], stone: ['#8d8d88', 'stone'], sky: '#7da6d6', fog: [900, 3000], hemi: ['#e6f0ff', '#4c5a38', 1.15], sun: ['#fff6e0', 1.8] },
  lua: { floor: ['#8d8f95', '#85878d'], block: ['#d6d9df', 'tile'], stone: ['#e7eaf0', 'stone'], sky: '#000006', fog: [1200, 5000], hemi: ['#dfe6ff', '#303444', 0.95], sun: ['#ffffff', 2.1], stars: true },
  portais: { floor: ['#2e2a4a', '#38325a'], block: ['#5a4a8a', 'tile'], stone: ['#2a2540', 'stone'], sky: '#120d24', fog: [600, 2200], hemi: ['#c0a8ff', '#201838', 1.15], sun: ['#d9c8ff', 1.2] },
  vulcao: { floor: ['#3a2a28', '#32231f'], block: ['#7a4030', 'brick'], stone: ['#2a1e1c', 'stone'], sky: '#2a0d08', fog: [500, 1900], hemi: ['#ffb080', '#4a1c10', 1.1], sun: ['#ff9050', 1.5], embers: true },
  escuro: { floor: ['#2a2e36', '#252830'], block: ['#4a4e5a', 'crate'], stone: ['#2a2d36', 'stone'], sky: '#05060a', fog: [500, 2000], hemi: ['#8090b0', '#10131a', 1.0], sun: ['#a0b0d0', 0.9] },
  neve: { floor: ['#dfe9f2', '#d2dfec'], block: ['#b9d8f0', 'tile'], stone: ['#9fb4c8', 'stone'], sky: '#bcd2e6', fog: [700, 2600], hemi: ['#ffffff', '#9fb0c4', 1.35], sun: ['#ffffff', 1.6], snow: true },
  deserto: { floor: ['#d9b878', '#cfae6e'], block: ['#c08850', 'brick'], stone: ['#a8845a', 'stone'], sky: '#e8c890', fog: [800, 2800], hemi: ['#fff0d0', '#8a6a40', 1.2], sun: ['#ffe6b0', 2.0] },
  navio: { floor: ['#946a40', '#865e38'], block: ['#a8794a', 'crate'], stone: ['#6b4a2a', 'plank'], sky: '#1c2b3a', fog: [350, 1700], hemi: ['#c4d6ee', '#4a3a28', 1.7], sun: ['#d0dcec', 1.6], storm: true }
};
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
function floorTexOf(c1, c2) {
  return canvasTex(128, 128, (g) => { g.fillStyle = c1; g.fillRect(0, 0, 128, 128); g.fillStyle = c2; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); g.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < 90; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 2); }, true);
}
function blockTexOf(base, style) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 128, 128); g.strokeStyle = shade(base, 0.5); g.lineWidth = 4;
    if (style === 'brick') { for (let r = 0; r < 4; r++) { const y = r * 32; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); const off = r % 2 ? 0 : 32; for (let x = off; x < 160; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } g.fillStyle = 'rgba(255,255,255,.16)'; for (let r = 0; r < 4; r++) g.fillRect(4, r * 32 + 4, 120, 5); }
    else if (style === 'crate') { g.lineWidth = 7; g.strokeRect(4, 4, 120, 120); g.lineWidth = 5; g.beginPath(); g.moveTo(6, 6); g.lineTo(122, 122); g.moveTo(122, 6); g.lineTo(6, 122); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let y = 16; y < 120; y += 22) { g.beginPath(); g.moveTo(8, y); g.lineTo(120, y); g.stroke(); } }
    else if (style === 'tile') { g.lineWidth = 3; for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < 128; x += 32) for (let y = 0; y < 128; y += 32) g.fillRect(x + 4, y + 4, 10, 3); }
  });
}
function stoneTexOf(base, style) {
  return canvasTex(128, 128, (g) => {
    if (style === 'container') { g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#9a9a9a'; for (let x = 4; x < 128; x += 16) g.fillRect(x, 6, 7, 116); g.strokeStyle = '#555'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122); return; }
    if (style === 'plank') { g.fillStyle = base; g.fillRect(0, 0, 128, 128); g.strokeStyle = shade(base, 0.55); g.lineWidth = 3; for (let y = 0; y <= 128; y += 21) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * 120, Math.random() * 120, 2, 8); g.strokeStyle = shade(base, 0.4); g.lineWidth = 6; g.strokeRect(3, 3, 122, 122); return; }
    g.fillStyle = shade(base, 0.82); g.fillRect(0, 0, 128, 128); g.fillStyle = base; g.fillRect(6, 6, 116, 116);
    g.fillStyle = shade(base, 1.2); g.fillRect(6, 6, 116, 10); g.strokeStyle = shade(base, 0.5); g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
    g.fillStyle = 'rgba(0,0,0,.1)'; for (let i = 0; i < 40; i++) g.fillRect(10 + Math.random() * 100, 20 + Math.random() * 100, 4, 3);
  });
}
const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
const blockMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
const stoneMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: 2100 }, (_, i) => { const a = Math.random() * 6.283, b = Math.acos(Math.random() * 2 - 1), r = 3600; return i % 3 === 0 ? r * Math.sin(b) * Math.cos(a) : i % 3 === 1 ? Math.abs(r * Math.cos(b)) + 200 : r * Math.sin(b) * Math.sin(a); })), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, sizeAttenuation: false, fog: false }));
const earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#2f6fd0'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.fillStyle = '#4fae5a'; for (const [x, y, r] of [[45, 50, 20], [80, 78, 18], [60, 98, 12], [86, 40, 10]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.fillStyle = 'rgba(255,255,255,.55)'; for (const [x, y, r] of [[70, 36, 14], [40, 80, 12], [90, 66, 9]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }), fog: false, depthWrite: false }));
earth.scale.set(700, 700, 1); earth.position.set(-1800, 1100, -2600); stars.visible = earth.visible = false; stars.frustumCulled = false; scene.add(stars, earth);
let floorTex = null, curTheme = '', FOG = [600, 2200], theme = THEMES.classic;
function applyTheme(id) {
  if (!THEMES[id]) id = 'classic'; if (id === curTheme) return; curTheme = id; theme = THEMES[id];
  for (const [m, t] of [[floorMat, floorTexOf(...theme.floor)], [blockMat, blockTexOf(...theme.block)], [stoneMat, stoneTexOf(theme.stone[0], theme.stone[1])]]) { if (m.map) m.map.dispose(); m.map = t; m.needsUpdate = true; }
  floorTex = floorMat.map; floorTex.repeat.set(curN / 2 || 7.5, curN / 2 || 7.5);
  scene.background = new THREE.Color(theme.sky); scene.fog.color.set(theme.sky); FOG = theme.fog; scene.fog.near = FOG[0]; scene.fog.far = FOG[1];
  hemi.color.set(theme.hemi[0]); hemi.groundColor.set(theme.hemi[1]); hemi.intensity = theme.hemi[2]; sun.color.set(theme.sun[0]); sun.intensity = theme.sun[1];
  mapKey = ''; V.bolt = 0; if (stars) stars.visible = earth.visible = !!theme.stars;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// ---------- sprites/partículas ----------
const glowTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const puffTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(0.6, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const MAXP = 900, P = { pos: new Float32Array(MAXP * 3), col: new Float32Array(MAXP * 3), vel: new Float32Array(MAXP * 3), life: new Float32Array(MAXP), g: new Float32Array(MAXP), n: 0 };
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(P.col, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 16, vertexColors: true, transparent: true, depthWrite: false, map: glowTex, sizeAttenuation: true }));
points.frustumCulled = false; scene.add(points);
const _c = new THREE.Color();
function emit(x, y, z, n, color, speed, life, grav) {
  for (let i = 0; i < n; i++) {
    const k = P.n < MAXP ? P.n++ : (Math.random() * MAXP) | 0, a = Math.random() * 6.283, e = Math.random() * 1.2 - 0.1, sp = speed * (0.4 + Math.random() * 0.8);
    P.pos[k * 3] = x; P.pos[k * 3 + 1] = y; P.pos[k * 3 + 2] = z;
    P.vel[k * 3] = Math.cos(a) * sp; P.vel[k * 3 + 1] = Math.sin(e) * sp + speed * 0.3; P.vel[k * 3 + 2] = Math.sin(a) * sp;
    P.life[k] = life * (0.6 + Math.random() * 0.6); P.g[k] = grav; _c.set(typeof color === 'function' ? color() : color);
    P.col[k * 3] = _c.r; P.col[k * 3 + 1] = _c.g; P.col[k * 3 + 2] = _c.b;
  }
}
function updateParticles(dt) {
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) { // compacta: troca com o último
      P.n--; if (i < P.n) { for (let j = 0; j < 3; j++) { P.pos[i * 3 + j] = P.pos[P.n * 3 + j]; P.vel[i * 3 + j] = P.vel[P.n * 3 + j]; P.col[i * 3 + j] = P.col[P.n * 3 + j]; } P.life[i] = P.life[P.n]; P.g[i] = P.g[P.n]; i--; } continue;
    }
    P.life[i] -= dt; P.vel[i * 3 + 1] -= P.g[i] * dt;
    P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] = Math.max(2, P.pos[i * 3 + 1] + P.vel[i * 3 + 1] * dt); P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    if (P.life[i] < 0.25) { const f = Math.max(0, P.life[i] / 0.25); P.col[i * 3] *= 0.92 + f * 0.08; P.col[i * 3 + 1] *= 0.92 + f * 0.08; P.col[i * 3 + 2] *= 0.92 + f * 0.08; }
  }
  pGeo.setDrawRange(0, P.n); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
const fireCol = () => ['#ffdd55', '#ff9a1f', '#ff5a14', '#ffffff'][(Math.random() * 4) | 0];
const dirtCol = () => ['#c4713a', '#8a4a20', '#e0a070', '#6d3515'][(Math.random() * 4) | 0];

function textSprite(txt, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 34px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(txt, 128, 34); g.fillStyle = color; g.fillText(txt, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); s.scale.set(80, 20, 1); s.renderOrder = 5; return s;
}

// ================= mapa (blocos instanciados) =================
const world = new THREE.Group(); scene.add(world);
let curDecor = '', mapKey = '', stoneMesh = null, blockMesh = null, floorMesh = null, curN = 0;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function buildMap(snap) {
  const N = snap.n; applyTheme(snap.mp);
  if (N !== curN) {
    curN = N; world.clear();
    floorMat.map.repeat.set(N / 2, N / 2);
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(N * CELL, N * CELL), floorMat); floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(N * CELL / 2, 0, N * CELL / 2); floorMesh.receiveShadow = true; world.add(floorMesh);
    stoneMesh = new THREE.InstancedMesh(boxGeo, stoneMat, N * N); stoneMesh.castShadow = stoneMesh.receiveShadow = true; world.add(stoneMesh);
    blockMesh = new THREE.InstancedMesh(boxGeo, blockMat, N * N); blockMesh.castShadow = blockMesh.receiveShadow = true; world.add(blockMesh);
    sun.position.set(N * CELL * 0.5 - 500, 1500, N * CELL * 0.5 + 700); sun.target.position.set(N * CELL / 2, 0, N * CELL / 2);
  }
  if (snap.g === mapKey) return; mapKey = snap.g;
  let si = 0, bi = 0; const cols = theme.stone[2] ? theme.stone[2].map((c) => new THREE.Color(c)) : null, white = new THREE.Color(0xffffff);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const g = snap.g.charCodeAt(z * N + x) - 48;
    if (g === 1) { _m.compose(_p.set(centerOf(x), BM.pillarH / 2, centerOf(z)), _q.identity(), _s.set(CELL, BM.pillarH, CELL)); stoneMesh.setMatrixAt(si, _m); stoneMesh.setColorAt(si, cols ? cols[(x * 7 + z * 13 + ((x * z) % 5)) % cols.length] : white); si++; }
    else if (g === 2) { _m.compose(_p.set(centerOf(x), BM.wallH / 2, centerOf(z)), _q.identity(), _s.set(CELL - 3, BM.wallH, CELL - 3)); blockMesh.setMatrixAt(bi++, _m); }
  }
  if (curDecor !== snap.mp + '|' + N) { curDecor = snap.mp + '|' + N; buildDecor(snap); }
  stoneMesh.count = si; blockMesh.count = bi; stoneMesh.instanceMatrix.needsUpdate = blockMesh.instanceMatrix.needsUpdate = true; if (stoneMesh.instanceColor) stoneMesh.instanceColor.needsUpdate = true;
}

// ================= personagens =================
let gltf = null;
const CL = {};
async function loadChar() {
  if (gltf) return;
  gltf = await new GLTFLoader().loadAsync('/demo3d/models/Rogue_Hooded.glb');
  for (const c of gltf.animations) CL[c.name] = c;
}
const GREY = new THREE.Color(0x888888);
class Avatar {
  constructor(p) {
    this.id = p.id; this.slot = p.sl;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(gltf.scene);
    const box = new THREE.Box3().setFromObject(this.model); this.model.scale.setScalar(CHAR_H / ((box.max.y - box.min.y) || 1));
    this.mats = [];
    const tint = new THREE.Color(SLOT_COL[p.sl % 4]).lerp(new THREE.Color(0xffffff), 0.35);
    this.model.traverse((o) => {
      if (['1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Knife_Offhand'].includes(o.name)) { o.visible = false; return; }
      if (o.isMesh) {
        o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.color.multiply(tint);
        o.material.emissive = new THREE.Color(0x000000); this.mats.push(o.material);
      }
    });
    this.root.add(this.model);
    this.label = textSprite(p.nm, SLOT_CSS[p.sl % 4]); this.label.position.y = CHAR_H + 26; this.root.add(this.label);
    this.skull = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICON_TEX.skull, transparent: true })); this.skull.scale.set(28, 28, 1); this.skull.position.y = CHAR_H + 52; this.skull.visible = false; this.root.add(this.skull);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(22, 28, 24), new THREE.MeshBasicMaterial({ color: SLOT_COL[p.sl % 4], transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 1.2; this.root.add(this.ring);
    scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.model); this.cur = null; this.curName = ''; this.oneUntil = 0; this.stepT = 0; this.opac = 1; this.dead = false;
    this.play('Idle');
  }
  play(name, once, speed, fade) {
    if (!CL[name]) return; if (this.curName === name && !once) { if (this.cur) this.cur.setEffectiveTimeScale(speed || 1); return; }
    const a = this.mixer.clipAction(CL[name]); a.enabled = true; a.setEffectiveTimeScale(speed || 1); a.setEffectiveWeight(1);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.reset().fadeIn(fade == null ? 0.12 : fade).play(); if (this.cur && this.cur !== a) this.cur.fadeOut(fade == null ? 0.12 : fade);
    this.cur = a; this.curName = name;
  }
  shot(name, speed, now) { if (!CL[name] || this.dead) return; this.play(name, true, speed || 1, 0.06); this.oneUntil = now + CL[name].duration / (speed || 1) * 1000 - 80; this.curName = name + '#'; }
  setOpacity(o, flicker) {
    if (Math.abs(o - this.opac) > 0.01 || flicker !== undefined) {
      this.opac = o; for (const m of this.mats) { m.transparent = o < 0.99; m.opacity = o; m.depthWrite = o > 0.5; }
    }
    this.ring.material.opacity = o * 0.8; this.label.material.opacity = Math.min(1, o + 0.2);
  }
  update(v, dt, now, isMe) {
    this.root.position.set(v.x, v.jm >= 0 ? Math.sin(Math.min(1, v.jm) * Math.PI) * 78 : 0, v.z);
    this.model.rotation.y = Math.atan2(Math.cos(v.yaw), Math.sin(v.yaw));
    if (isMe) v.y = this.root.position.y;
    const alive = !!v.al, sp = Math.hypot(v.vx, v.vz);
    if (!alive) {
      if (!this.dead) { this.dead = true; this.play('Death_A', true, 1.1, 0.08); }
      this.ring.visible = this.label.visible = this.skull.visible = false;
      const t = v.dt || 0; if (t > 2.2) this.root.visible = false; else this.root.visible = true;
      this.mixer.update(dt); return;
    }
    if (this.dead) { this.dead = false; this.curName = ''; this.root.visible = true; this.ring.visible = this.label.visible = true; }
    if (now >= this.oneUntil) {
      if (this.curName.endsWith('#')) this.curName = '';
      if (v.winner) this.play('Cheer');
      else if (sp > 25) {
        const fx = Math.cos(v.yaw), fz = Math.sin(v.yaw), fwd = (v.vx * fx + v.vz * fz) / sp, side = (v.vx * -fz + v.vz * fx) / sp, k = clamp(sp / BM.speed, 0.5, 2.2);
        if (fwd > 0.5) this.play('Running_A', false, 1.1 * k); else if (fwd < -0.5) this.play('Walking_Backwards', false, 1.5 * k); else this.play(side > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left', false, 1.1 * k);
      } else this.play('Idle');
    }
    // fantasma (maldição) e invencibilidade piscando
    let o = 1; if (v.cu === 'invisible') o = isMe ? 0.4 : 0.07; if (v.iv) o *= (Math.floor(now / 90) % 2 ? 0.35 : 1);
    this.setOpacity(o);
    this.label.visible = !isMe && v.cu !== 'invisible'; this.skull.visible = !!v.cu; if (v.cu) this.skull.position.y = CHAR_H + 52 + Math.sin(now / 120) * 3;
    const em = v.cu ? 0.35 + 0.3 * Math.sin(now / 90) : 0, c = v.cu ? 0x8a1fd0 : 0x000000; for (const m of this.mats) { m.emissive.setHex(c); m.emissiveIntensity = em; }
    this.mixer.update(dt);
  }
  remove() { scene.remove(this.root); }
}

// ================= bombas, fogo, itens, fumaça =================
const bombObjs = new Map(), fireObjs = new Map(), itemObjs = new Map(), smokeObjs = new Map();
const bombGeo = new THREE.SphereGeometry(38, 24, 18), capGeo = new THREE.CylinderGeometry(10, 12, 11, 10), fuseGeo = new THREE.CylinderGeometry(2.3, 2.3, 1, 6);
const sheenGeo = new THREE.SphereGeometry(8, 8, 6);
function makeBomb() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.3, metalness: 0.35, emissive: 0xff2200, emissiveIntensity: 0 });
  const body = new THREE.Mesh(bombGeo, mat); body.castShadow = true; body.position.y = 38; g.add(body);
  const sheen = new THREE.Mesh(sheenGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); sheen.position.set(-15, 55, 15); g.add(sheen);
  const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x7a8394, metalness: 0.6, roughness: 0.4 })); cap.position.y = 76; g.add(cap);
  const fuseG = new THREE.Group(); fuseG.position.set(0, 80, 0); fuseG.rotation.z = -0.38; g.add(fuseG);
  const fuse = new THREE.Mesh(fuseGeo, new THREE.MeshStandardMaterial({ color: 0xd9b774, roughness: 0.9 })); fuseG.add(fuse);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); spark.scale.set(34, 34, 1); fuseG.add(spark);
  return { g, mat, body, fuse, fuseG, spark, spawnT: 0, landT: -1e9, seen: 0 };
}
function updateBombs(snap, now, dt) {
  const seen = new Set(); let near = null;
  for (const b of snap.b) {
    seen.add(b.id); let o = bombObjs.get(b.id);
    if (!o) { o = makeBomb(); o.spawnT = V.pendingPlace.get(b.id) || 0; scene.add(o.g); bombObjs.set(b.id, o); }
    const age = (now - snap.rx) / 1000, f = b.st === 'thrown' || b.st === 'carried' ? b.f : Math.max(0, b.f - age), frac = clamp(f / BM.fuse, 0, 1);
    let y = b.y, sq = 1;
    if (b.st !== 'thrown' && b.st !== 'carried') {
      const ta = (now - o.spawnT) / 1000; // queda: cai de cima, bate no chão e quica
      if (o.spawnT && ta < 0.28) y = 150 * (1 - (ta / 0.28) ** 2);
      else if (o.spawnT && ta < 0.5) { const u = (ta - 0.28) / 0.22; y = 22 * 4 * u * (1 - u); }
      const tl = (now - o.landT) / 1000; if (tl < 0.25) sq = 1 - 0.28 * Math.sin(tl / 0.25 * Math.PI);
      if (o.spawnT && ta >= 0.28 && ta < 0.4) sq = Math.min(sq, 1 - 0.28 * Math.sin((ta - 0.28) / 0.12 * Math.PI));
    }
    o.g.position.set(b.x, y, b.z);
    const k = clamp((0.5 - frac) / 0.5, 0, 1), pulse = 1 + 0.07 * k * Math.sin(now / (110 - 60 * k)); // quanto mais perto de estourar, mais vermelha e mais rápido pulsa
    o.g.scale.set(pulse / Math.sqrt(sq), pulse * sq, pulse / Math.sqrt(sq));
    o.mat.emissiveIntensity = k * (0.8 + 0.4 * Math.sin(now / (90 - 50 * k)));
    o.mat.color.setRGB(0.07 + 0.35 * k, 0.08 * (1 - k), 0.11 * (1 - k));
    const L = 6 + 40 * frac; o.fuse.scale.y = L; o.fuse.position.y = L / 2; o.spark.position.y = L + 2; o.spark.scale.setScalar(24 + Math.random() * 18 + 14 * k); o.spark.visible = frac > 0.005;
    if (b.st === 'thrown') o.g.rotation.y += dt * 9; else o.g.rotation.y = 0;
    if (Math.random() < 0.55) { _p.set(0, L + 2, 0); o.fuseG.localToWorld(_p); emit(_p.x, _p.y, _p.z, 1, Math.random() < 0.5 ? '#ffd24a' : '#ff8a1a', 70, 0.35, 220); }
    if (V.me && b.st !== 'carried') { const d = Math.hypot(b.x - V.me.x, b.z - V.me.z); if (!near || d < near.d) near = { d, frac }; }
  }
  for (const [id, o] of bombObjs) if (!seen.has(id)) { scene.remove(o.g); bombObjs.delete(id); V.pendingPlace.delete(id); }
  // chiado do pavio: mais forte e mais agudo conforme a bomba mais próxima chega perto de estourar
  if (A.fuseG && A.ctx) {
    const tgt = near && A.on ? Math.pow(clamp(1 - near.d / 800, 0, 1), 1.5) * (0.12 + 0.2 * (1 - near.frac)) : 0;
    A.fuseG.gain.setTargetAtTime(tgt, A.ctx.currentTime, 0.05); if (near) A.fuseF.frequency.setTargetAtTime(2500 + (1 - near.frac) * 4500, A.ctx.currentTime, 0.05);
  }
}
function updateFires(snap) {
  const seen = new Set();
  for (const f of snap.fi) {
    const key = f.cz * 64 + f.cx; seen.add(key); let o = fireObjs.get(key);
    if (!o) {
      const g = new THREE.Group(), out = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0.9, depthWrite: false })), inn = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffe880 }));
      g.add(out, inn); scene.add(g); o = { g, out, inn }; fireObjs.set(key, o); g.position.set(centerOf(f.cx), 0, centerOf(f.cz));
    }
    const age = (f.T || BM.fire) - f.t, grow = clamp(age / 0.09, 0.2, 1), fade = clamp(f.t / 0.18, 0, 1), fl = 1 + 0.12 * Math.sin(performance.now() / 45 + key), hk = f.h ? 1.35 : 1;
    o.out.material.color.setHex(f.h ? 0xff3a10 : 0xff6a10);
    o.out.scale.set(88 * grow, 70 * grow * fl * hk * (0.4 + 0.6 * fade), 88 * grow); o.out.position.y = 35 * grow * (0.4 + 0.6 * fade); o.out.material.opacity = 0.35 + 0.55 * fade;
    o.inn.scale.set(52 * grow, 52 * grow * fl * fade, 52 * grow); o.inn.position.y = 26 * grow * fade;
  }
  for (const [k, o] of fireObjs) if (!seen.has(k)) { scene.remove(o.g); fireObjs.delete(k); }
}
function updateItems(snap, now) {
  const seen = new Set();
  for (const it of snap.it) {
    seen.add(it.id); let o = itemObjs.get(it.id);
    if (!o) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICON_TEX[it.k], transparent: true })); sp.scale.set(54, 54, 1);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(22, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 1.5;
      const g = new THREE.Group(); g.add(sp, sh); g.position.set(centerOf(it.cx), 0, centerOf(it.cz)); scene.add(g); o = { g, sp, born: now }; itemObjs.set(it.id, o);
      emit(centerOf(it.cx), 40, centerOf(it.cz), 10, '#ffffff', 90, 0.5, 100);
    }
    const pop = clamp((now - o.born) / 250, 0, 1); o.sp.position.y = 42 + Math.sin(now / 260 + it.id) * 6; o.sp.scale.setScalar(54 * (0.3 + 0.7 * pop) * (it.k === 'skull' ? 1 + 0.08 * Math.sin(now / 90) : 1));
  }
  for (const [id, o] of itemObjs) if (!seen.has(id)) { scene.remove(o.g); itemObjs.delete(id); }
}
function updateSmokes(snap, now) {
  const seen = new Set();
  for (const s of snap.sm) {
    seen.add(s.id); let o = smokeObjs.get(s.id);
    if (!o) {
      const g = new THREE.Group(), puffs = [];
      for (let i = 0; i < 16; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: new THREE.Color().setHSL(0, 0, 0.45 + Math.random() * 0.25), transparent: true, depthWrite: false, opacity: 0 }));
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * (BM.smoke.r - 40); sp.userData = { a, r, h: 25 + Math.random() * 85, s: 120 + Math.random() * 70, ph: Math.random() * 6 };
        g.add(sp); puffs.push(sp);
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(10, 10, 8), new THREE.MeshStandardMaterial({ color: 0x555a64 })); g.add(ball);
      scene.add(g); o = { g, puffs, ball, landed: 0 }; smokeObjs.set(s.id, o);
    }
    o.g.position.set(s.x, 0, s.z);
    if (!s.l) { o.ball.visible = true; o.ball.position.y = 45 + Math.sin(performance.now() / 120) * 4; o.puffs.forEach((p) => { p.material.opacity = 0; }); }
    else {
      o.ball.visible = false; if (!o.landed) o.landed = now; const grow = clamp((now - o.landed) / 600, 0, 1), fade = clamp(s.t / 2, 0, 1);
      for (const p of o.puffs) { const u = p.userData, ang = u.a + now / 4000 * (u.ph > 3 ? 1 : -1); p.position.set(Math.cos(ang) * u.r * grow, u.h * (0.4 + 0.6 * grow) + Math.sin(now / 700 + u.ph) * 5, Math.sin(ang) * u.r * grow); p.scale.setScalar(u.s * grow); p.material.opacity = 0.62 * grow * fade; }
    }
  }
  for (const [id, o] of smokeObjs) if (!seen.has(id)) { scene.remove(o.g); smokeObjs.delete(id); }
}

// ================= estado =================
const V = { mode: 'menu', me: null, meId: null, sim: null, mirror: null, snap: null, avatars: new Map(), vis: new Map(), yaw: 0, fp: false, keys: {}, pendingPlace: new Map(), socket: null,
  shake: 0, dkK: 0, stK: 0, flick: 0, lastDk: 0, lastPhase: '', lastCount: -1, locked: false, solo: false, inSmoke: false, aim: null, lastSend: 0, seq: 0, lastSnapT: 0, net: null };
const toast = (t) => { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { e.style.display = 'none'; }, 2200); };
for (const sel of [$('map'), $('lmap')]) { sel.innerHTML = MAP_LIST.map((m) => `<option value="${m.id}">${m.name}</option>`).join('') + '<option value="rand">Aleatório</option>'; sel.title = ''; }
function setErr(t) { $('err').textContent = t || ''; }

// ================= perigos do mapa, portais, esteiras e clima =================
const hzObjs = new Map(), decor = new THREE.Group(); scene.add(decor);
let portalList = [], beltTex = null, torch = null;
const PORTAL_COLS = [0x39a0ff, 0xff9a2f];
function flatRect(x0, z0, x1, z1, mat, y) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.rotation.x = -Math.PI / 2; m.scale.set(Math.abs(x1 - x0), Math.abs(z1 - z0), 1); m.position.set((x0 + x1) / 2, y || 3, (z0 + z1) / 2); return m; }
const warnMat = () => new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
function buildDecor(snap) { // portais, esteiras, guindaste: coisas fixas do mapa
  decor.clear(); portalList = []; const mp = BOMBER_MAPS[snap.mp] || BOMBER_MAPS.classic, N = snap.n;
  (mp.portals || []).forEach((pr, i) => {
    const col = PORTAL_COLS[i % 2];
    for (const [cx, cz] of [[pr[0], pr[1]], [pr[2], pr[3]]]) {
      const g = new THREE.Group(); g.position.set(centerOf(cx), 0, centerOf(cz));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 6, 10, 28), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 9;
      const piv = new THREE.Group(); piv.rotation.x = -Math.PI / 2; piv.position.y = 7;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(36, 28), new THREE.MeshBasicMaterial({ map: portalTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); piv.add(disc);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 110, 20, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 55;
      g.add(ring, piv, beam); decor.add(g); portalList.push({ ring, disc, beam, col, g });
    }
  });
  if (mp.belts) for (const b of mp.belts) for (let i = 1; i < N - 1; i++) {
    const cx = b.ax === 'x' ? i : b.idx, cz = b.ax === 'x' ? b.idx : i; if (snap.g.charCodeAt(cz * N + cx) - 48 === 1) continue;
    const o = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 6, CELL - 6), new THREE.MeshBasicMaterial({ map: beltTex, transparent: true, opacity: 0.95, depthWrite: false })); m.rotation.x = -Math.PI / 2; o.add(m);
    o.rotation.y = b.ax === 'x' ? (b.dir > 0 ? 0 : Math.PI) : (b.dir > 0 ? -Math.PI / 2 : Math.PI / 2); o.position.set(centerOf(cx), 2, centerOf(cz)); decor.add(o);
  }
  if (mp.hz && mp.hz.k === 'ball') { // guindaste no meio
    const c = N * CELL / 2, mast = new THREE.Mesh(new THREE.CylinderGeometry(18, 26, 380, 10), new THREE.MeshStandardMaterial({ color: 0xe0a020, roughness: 0.6 })); mast.position.set(c, 190, c); mast.castShadow = true;
    const arm = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xe0a020 })); arm.scale.set(90, 16, 16); arm.position.set(c, 372, c); decor.add(mast, arm);
  }
}
const portalTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(0.5, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(64, 64, 18 + i * 14, i, i + 3.2); g.stroke(); } });
beltTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#2c2f36'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#f0c030'; g.lineWidth = 12; g.lineJoin = 'miter';
  for (let x = -16; x < 150; x += 64) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 36, 64); g.lineTo(x, 108); g.stroke(); }
  g.strokeStyle = '#555'; g.lineWidth = 6; g.strokeRect(2, 2, 124, 124);
}, true);

function makeHz(s) {
  const g = new THREE.Group(), o = { g, k: s.k };
  if (s.k === 'train' || s.k === 'wave') {
    const wid = s.hi - s.lo; o.warn = flatRect(0, 0, 1, 1, warnMat()); g.add(o.warn);
    const isT = s.k === 'train', body = new THREE.Group();
    const main = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial(isT ? { color: 0xb8322a, roughness: 0.5, metalness: 0.2 } : { color: 0x2f8fd0, transparent: true, opacity: 0.8, roughness: 0.2 }));
    main.scale.set(s.ax === 'z' ? wid - 16 : s.len, isT ? 118 : 90, s.ax === 'z' ? s.len : wid - 16); main.position.y = isT ? 62 : 45; main.castShadow = isT; body.add(main);
    const top = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial(isT ? { color: 0xeeeeee } : { color: 0xffffff, transparent: true, opacity: 0.85 }));
    top.scale.set(s.ax === 'z' ? wid - 10 : s.len * 0.98, isT ? 10 : 16, s.ax === 'z' ? s.len * 0.98 : wid - 10); top.position.y = isT ? 124 : 92; body.add(top);
    const lamp = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffaa })); lamp.scale.set(s.ax === 'z' ? wid * 0.5 : 10, 16, s.ax === 'z' ? 10 : wid * 0.5); lamp.position.set(s.ax === 'z' ? 0 : s.dir * s.len / 2, 70, s.ax === 'z' ? s.dir * s.len / 2 : 0); lamp.visible = isT; body.add(lamp);
    o.body = body; g.add(body);
  } else if (s.k === 'ball') {
    o.warn = new THREE.Mesh(new THREE.RingGeometry(s.R - 62, s.R + 62, 48), warnMat()); o.warn.rotation.x = -Math.PI / 2; o.warn.position.set(s.cx, 3, s.cz); g.add(o.warn);
    o.ball = new THREE.Mesh(new THREE.SphereGeometry(62, 20, 14), new THREE.MeshStandardMaterial({ color: 0x555a63, metalness: 0.7, roughness: 0.35 })); o.ball.castShadow = true; g.add(o.ball);
    const cg = new THREE.CylinderGeometry(3, 3, 1, 6); cg.rotateX(Math.PI / 2); o.chain = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0x333 })); g.add(o.chain);
  } else if (s.k === 'meteor') {
    o.warn = new THREE.Group(); const r1 = new THREE.Mesh(new THREE.RingGeometry(120, 150, 32), warnMat()), r2 = new THREE.Mesh(new THREE.CircleGeometry(115, 32), warnMat()); r1.rotation.x = r2.rotation.x = -Math.PI / 2; r1.position.y = r2.position.y = 3; o.warn.add(r1, r2); o.warn.position.set(centerOf(s.cx), 0, centerOf(s.cz)); g.add(o.warn);
    o.rock = new THREE.Mesh(new THREE.IcosahedronGeometry(52, 1), new THREE.MeshStandardMaterial({ color: 0x6a6670, emissive: 0xff5a10, emissiveIntensity: 0.9, roughness: 1 })); o.rock.castShadow = true;
    o.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a30, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); o.glow.scale.set(220, 220, 1); g.add(o.rock, o.glow);
  } else if (s.k === 'lava') {
    o.warn = new THREE.Group(); for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = new THREE.Mesh(new THREE.CircleGeometry(dx || dz ? 34 : 46, 20), new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0.6, depthWrite: false })); c.rotation.x = -Math.PI / 2; c.position.set(centerOf(s.cx + dx), 3, centerOf(s.cz + dz)); o.warn.add(c); } g.add(o.warn);
  } else if (s.k === 'fire') {
    o.warn = flatRect(0, 0, 1, 1, warnMat()); g.add(o.warn);
    const d = new THREE.Group(), body = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x3a2060, roughness: 0.7 })); body.scale.set(60, 40, 220); d.add(body);
    const head = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x4a2880 })); head.scale.set(34, 30, 60); head.position.set(0, 10, 130); d.add(head);
    const eye = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff3020 })); eye.scale.set(40, 8, 8); eye.position.set(0, 18, 158); d.add(eye);
    o.wings = []; for (const sd of [-1, 1]) { const w = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x2a1648, side: THREE.DoubleSide })); w.scale.set(220, 5, 120); const pv = new THREE.Group(); w.position.set(sd * 110, 0, 0); pv.add(w); pv.position.set(sd * 20, 20, 0); d.add(pv); o.wings.push([pv, sd]); }
    const tail = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x3a2060 })); tail.scale.set(18, 18, 150); tail.position.set(0, -4, -170); d.add(tail);
    o.dragon = d; g.add(d);
  }
  scene.add(g); return o;
}
function updateHz(snap, now, dt) {
  const seen = new Set();
  for (const s of snap.hz) {
    seen.add(s.id); let o = hzObjs.get(s.id); if (!o) { o = makeHz(s); hzObjs.set(s.id, o); }
    const pulse = 0.2 + 0.16 * Math.sin(now / 85), warning = s.w > 0;
    if (s.k === 'train' || s.k === 'wave') {
      const w = warning ? pulse : 0; o.warn.material.opacity = w; o.warn.visible = warning;
      if (warning) { if (s.ax === 'z') { o.warn.scale.set(s.hi - s.lo, s.L - CELL * 2, 1); o.warn.position.set((s.lo + s.hi) / 2, 3, s.L / 2); } else { o.warn.scale.set(s.L - CELL * 2, s.hi - s.lo, 1); o.warn.position.set(s.L / 2, 3, (s.lo + s.hi) / 2); } }
      o.body.visible = !warning; if (!warning) { const c = s.f - s.dir * s.len / 2, mid = (s.lo + s.hi) / 2; o.body.position.set(s.ax === 'z' ? mid : c, 0, s.ax === 'z' ? c : mid); if (s.k === 'wave' && Math.random() < 0.7) { emit(s.ax === 'z' ? mid + (Math.random() - 0.5) * 90 : s.f, 95, s.ax === 'z' ? s.f : mid + (Math.random() - 0.5) * 90, 2, '#ffffff', 90, 0.5, 200); } }
    } else if (s.k === 'ball') {
      o.warn.material.opacity = warning ? pulse : 0.07; o.ball.visible = o.chain.visible = !warning;
      if (!warning) { o.ball.position.set(s.bx, 82, s.bz); const dx = s.bx - s.cx, dy = 82 - 372, dz = s.bz - s.cz, L = Math.hypot(dx, dy, dz); o.chain.scale.z = L; o.chain.position.set(s.cx + dx / 2, 372 + dy / 2, s.cz + dz / 2); o.chain.lookAt(s.bx, 82, s.bz); }
    } else if (s.k === 'meteor') {
      o.warn.visible = warning; o.warn.children.forEach((c) => { c.material.opacity = 0.16 + 0.18 * Math.sin(now / 80 + 1); });
      o.rock.visible = o.glow.visible = warning;
      if (warning) { const q = clamp(s.w / 2.6, 0, 1), tx = centerOf(s.cx), tz = centerOf(s.cz); o.rock.position.set(tx - 520 * q, 40 + 1250 * q, tz - 320 * q); o.rock.rotation.x += dt * 3; o.rock.rotation.y += dt * 2; o.glow.position.copy(o.rock.position); if (Math.random() < 0.8) emit(o.rock.position.x, o.rock.position.y, o.rock.position.z, 1, '#ff9a30', 60, 0.5, 0); }
    } else if (s.k === 'lava') {
      o.warn.visible = warning; o.warn.children.forEach((c, i) => { c.material.opacity = 0.35 + 0.3 * Math.sin(now / 90 + i); c.scale.setScalar(1 + 0.2 * Math.sin(now / 120 + i)); });
      if (warning && Math.random() < 0.7) emit(centerOf(s.cx) + (Math.random() - 0.5) * 60, 8, centerOf(s.cz) + (Math.random() - 0.5) * 60, 1, '#ff7a20', 60, 0.8, -60);
    } else if (s.k === 'fire') {
      o.warn.visible = warning; o.warn.material.opacity = warning ? pulse : 0; const L = snap.n * CELL;
      if (warning) { if (s.ax === 'x') { o.warn.scale.set(L - CELL * 2, CELL * 0.9, 1); o.warn.position.set(L / 2, 3, centerOf(s.idx)); } else { o.warn.scale.set(CELL * 0.9, L - CELL * 2, 1); o.warn.position.set(centerOf(s.idx), 3, L / 2); } }
      const tot = 2.8 + s.T, prog = clamp(1 - (s.w + s.a) / tot, 0, 1), pos = s.dir > 0 ? -250 + prog * (L + 500) : L + 250 - prog * (L + 500);
      o.dragon.position.set(s.ax === 'x' ? pos : centerOf(s.idx), 330 + Math.sin(now / 200) * 14, s.ax === 'x' ? centerOf(s.idx) : pos);
      o.dragon.rotation.y = s.ax === 'x' ? (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (s.dir > 0 ? 0 : Math.PI);
      for (const [pv, sd] of o.wings) pv.rotation.z = sd * Math.sin(now / 110) * 0.7;
      if (!warning && Math.random() < 0.9) { emit(o.dragon.position.x, o.dragon.position.y - 20, o.dragon.position.z, 2, fireCol, 120, 0.5, 200); }
    }
  }
  for (const [id, o] of hzObjs) if (!seen.has(id)) { scene.remove(o.g); hzObjs.delete(id); }
}
function updateDecor(snap, now, dt) {
  const open = !!snap.po, t = now / 1000;
  for (const p of portalList) {
    p.disc.visible = p.beam.visible = open; p.disc.rotation.z += dt * 2.2; p.ring.material.emissiveIntensity = open ? 0.7 + 0.3 * Math.sin(now / 150) : 0;
    p.ring.material.color.setHex(open ? p.col : 0x555a66); p.ring.material.emissive.setHex(open ? p.col : 0x000000); p.beam.scale.y = 1 + 0.08 * Math.sin(now / 200);
    if (open && Math.random() < 0.3) emit(p.g.position.x + (Math.random() - 0.5) * 50, 4, p.g.position.z + (Math.random() - 0.5) * 50, 1, p.col, 30, 0.8, -90);
  }
  beltTex.offset.x = -(t * 0.9) % 1;
}
// clima: escuro, tempestade (neve / areia), neve e brasas ambientes
function updateEnv(snap, dt, now) {
  const dk = snap.dk ? 1 : 0;
  if (dk !== V.lastDk) { V.lastDk = dk; V.flick = dk ? 0.7 : 0; }
  let tgt = dk; if (V.flick > 0) { V.flick -= dt; tgt = Math.random() < 0.5 ? 0.9 : 0.1; }
  V.dkK += (tgt - V.dkK) * Math.min(1, dt * (tgt > V.dkK ? 9 : 3));
  const d = V.dkK; hemi.intensity = theme.hemi[2] * (1 - 0.9 * d) + (V.bolt > 0 && theme.storm ? hemi.intensity - theme.hemi[2] : 0); sun.intensity = theme.sun[1] * (1 - 0.93 * d);
  if (!theme.storm || !(V.bolt > 0)) scene.background.set(theme.sky).multiplyScalar(1 - 0.9 * d);
  if (!torch) { torch = new THREE.PointLight(0xffe8c0, 0, 420, 1.3); scene.add(torch); }
  if (V.me) torch.position.set(V.me.x, 85, V.me.z); torch.intensity = 3.4 * d;
  const stOn = snap.stm > 0 ? 1 : 0; V.stK += (stOn - V.stK) * Math.min(1, dt * 1.5);
  const cam = camera.position, kind = (theme === THEMES.neve) ? 'snow' : (theme === THEMES.deserto) ? 'sand' : '';
  if (V.stK > 0.05 && kind) {
    const n = Math.ceil(7 * V.stK);
    for (let i = 0; i < n; i++) {
      const x = cam.x + (Math.random() - 0.5) * 1100, z = cam.z + (Math.random() - 0.5) * 1100;
      if (kind === 'snow') emitRaw(x, 330 + Math.random() * 100, z, -60 + Math.random() * 30, -170, 40 * Math.random(), '#ffffff', 2.2);
      else emitRaw(x, 20 + Math.random() * 120, z, (snap.wd ? snap.wd[0] : 100) * 4.5, 0, (snap.wd ? snap.wd[1] : 0) * 4.5, '#d8b070', 1.6);
    }
  } else if (theme.snow && Math.random() < 0.6) emitRaw(cam.x + (Math.random() - 0.5) * 900, 330, cam.z + (Math.random() - 0.5) * 900, -10, -60, 6, '#ffffff', 5);
  if (theme.embers && Math.random() < 0.7) emitRaw(cam.x + (Math.random() - 0.5) * 900, 5, cam.z + (Math.random() - 0.5) * 900, 10, 90, 0, '#ff7a20', 2.6);
  if (theme.stars) { stars.position.set(cam.x, 0, cam.z); earth.position.set(cam.x - 1800, 1100, cam.z - 2600); }
}
function emitRaw(x, y, z, vx, vy, vz, color, life) {
  const k = P.n < MAXP ? P.n++ : (Math.random() * MAXP) | 0; P.pos[k * 3] = x; P.pos[k * 3 + 1] = y; P.pos[k * 3 + 2] = z; P.vel[k * 3] = vx; P.vel[k * 3 + 1] = vy; P.vel[k * 3 + 2] = vz;
  P.life[k] = life; P.g[k] = 0; _c.set(color); P.col[k * 3] = _c.r; P.col[k * 3 + 1] = _c.g; P.col[k * 3 + 2] = _c.b;
}

// ---------- eventos (sons, partículas, animações) ----------
function onEvents(evs, now) {
  for (const e of evs) {
    const cp = (cx, cz) => [centerOf(cx), centerOf(cz)];
    const av = e.pid != null ? V.avatars.get(e.pid) : null, pv = e.pid != null ? V.vis.get(e.pid) : null, ppos = pv ? [pv.x, pv.z] : null;
    switch (e.e) {
      case 'place': V.pendingPlace.set(e.id, now); SFX.whistle(cp(e.cx, e.cz)); setTimeout(() => SFX.thud(cp(e.cx, e.cz)), 280); setTimeout(() => emit(centerOf(e.cx), 6, centerOf(e.cz), 6, '#d8d2c0', 60, 0.4, 0), 280); if (av) av.shot('PickUp', 1.7, now); break;
      case 'land': { const o = bombObjs.get(e.id); if (o) { o.landT = now; o.spawnT = 0; } SFX.thud([e.x, e.z]); emit(e.x, 6, e.z, 8, '#d8d2c0', 70, 0.4, 0); break; }
      case 'boom': {
        const [x, z] = cp(e.cx, e.cz), p = [x, z]; SFX.boom(p);
        for (const [cx, cz] of e.cells) emit(centerOf(cx), 40, centerOf(cz), 7, fireCol, 170, 0.7, 260);
        flash.position.set(x, 90, z); flash.intensity = 6; if (V.me) V.shake = Math.max(V.shake, 14 * clamp(1 - Math.hypot(x - V.me.x, z - V.me.z) / 700, 0, 1)); break;
      }
      case 'blk': emit(centerOf(e.cx), 55, centerOf(e.cz), 26, dirtCol, 190, 0.9, 520); break;
      case 'item_burn': SFX.burn(cp(e.cx, e.cz)); emit(centerOf(e.cx), 40, centerOf(e.cz), 14, '#ffaa33', 120, 0.5, 100); break;
      case 'pickup': { if (e.pid === V.meId) { SFX.pick(); toast(ITEM_LABEL[e.k]); } else SFX.grab(cp(e.cx, e.cz)); emit(centerOf(e.cx), 50, centerOf(e.cz), 14, '#ffffff', 110, 0.6, 40); break; }
      case 'pickup_bomb': SFX.grab(ppos); break;
      case 'throw': SFX.throw(ppos); if (av) av.shot('Throw', 1.5, now); break;
      case 'kick': SFX.kick(ppos); if (av) av.shot('Unarmed_Melee_Attack_Kick', 1.6, now); break;
      case 'smoke_throw': SFX.throw(ppos); if (av) av.shot('Throw', 1.5, now); break;
      case 'smoke': SFX.smoke([e.x, e.z]); break;
      case 'curse': if (e.pid === V.meId) { SFX.curse(); toast('☠ ' + CURSE_NAME[e.c]); } else SFX.curse(); break;
      case 'curse_end': if (e.pid === V.meId) toast('A maldição passou'); break;
      case 'die': SFX.die(ppos); if (pv) emit(pv.x, 40, pv.z, 22, '#ffd0d0', 150, 0.8, 300); break;
      case 'win': SFX.win(); break;
      case 'drop': SFX.drop(cp(e.cx, e.cz)); emit(centerOf(e.cx), 60, centerOf(e.cz), 14, '#9aa3bd', 140, 0.6, 400); if (V.me) V.shake = Math.max(V.shake, 5 * clamp(1 - Math.hypot(centerOf(e.cx) - V.me.x, centerOf(e.cz) - V.me.z) / 600, 0, 1)); break;
      case 'warn': SFX.warn(); toast({ train: '⚠ Trem chegando nos trilhos!', wave: '⚠ Onda gigante vindo!', ball: '⚠ Bola de demolição!', meteor: '☄ Meteoros vindo!', lava: '🌋 A lava vai surgir!', dragon: '🐉 O dragão vai soprar fogo!' }[e.k] || '⚠ Perigo!'); break;
      case 'traingo': SFX.horn(); break;
      case 'wavego': SFX.whoosh(); break;
      case 'ballgo': SFX.whoosh(); break;
      case 'meteor': { const [x, z] = cp(e.cx, e.cz); SFX.boom([x, z]); flash.position.set(x, 100, z); flash.intensity = 8; emit(x, 40, z, 50, fireCol, 260, 1.0, 300); if (V.me) V.shake = Math.max(V.shake, 16 * clamp(1 - Math.hypot(x - V.me.x, z - V.me.z) / 800, 0, 1)); break; }
      case 'erupt': { const [x, z] = cp(e.cx, e.cz); SFX.rumble(); emit(x, 20, z, 40, fireCol, 240, 1.2, 380); if (V.me) V.shake = Math.max(V.shake, 6 * clamp(1 - Math.hypot(x - V.me.x, z - V.me.z) / 700, 0, 1)); break; }
      case 'dragon': SFX.roar(); break;
      case 'storm': SFX.wind(); toast(e.k === 'sand' ? '🏜 Tempestade de areia!' : '❄ Tempestade de neve!'); break;
      case 'portal': SFX.zap([e.x, e.z]); SFX.zap([e.fx, e.fz]); emit(e.fx, 30, e.fz, 14, '#bfe0ff', 130, 0.6, 20); emit(e.x, 30, e.z, 14, '#ffd0a0', 130, 0.6, 20); break;
      case 'jump': SFX.boing(ppos); if (av) av.shot('Jump_Full_Short', (CL.Jump_Full_Short ? CL.Jump_Full_Short.duration : 1) / 0.5, now); if (pv) emit(pv.x, 6, pv.z, 8, '#d8d2c0', 70, 0.4, 0); break;
      case 'jland': if (pv) { emit(pv.x, 6, pv.z, 8, '#d8d2c0', 80, 0.4, 0); SFX.thud(ppos); } break;
      case 'round': V.avatars.forEach((a) => a.remove()); V.avatars.clear(); break;
    }
  }
}

// ================= HUD =================
const msg = $('msg'), itemsEl = $('items'), scoreEl = $('score'), timerEl = $('timer'), mini = $('mini').getContext('2d');
let hudKey = '';
window.__bm = V; // (depuração: console do navegador)
function updateHud(snap) {
  const me = snap.p.find((p) => p.id === V.meId); if (!me) return;
  // itens coletados: só aparecem os que você já pegou; os que acumulam mostram "x3" no mesmo quadradinho
  const slots = [];
  if (me.mb > BM.startBombs) slots.push(['bomb', 'x' + me.mb]);
  if (me.rg > BM.startRange) slots.push(['fire', 'x' + me.rg]);
  if (me.sk) slots.push(['skate', '']); if (me.gl) slots.push(['glove', '']); if (me.kk) slots.push(['kick', '']);
  if (me.sm > 0) slots.push(['smoke', 'x' + me.sm]);
  if (me.jp) slots.push(['jump', me.jc > 0 ? Math.ceil(me.jc) + 's' : 'G', me.jc > 0 ? 'Super pulo (recarregando)' : 'Super pulo (G)', me.jc > 0]);
  if (me.cu) slots.push(['skull', Math.ceil(me.cl) + 's', CURSE_NAME[me.cu]]);
  const key = JSON.stringify(slots); if (key !== hudKey) {
    hudKey = key;
    itemsEl.innerHTML = slots.map((s) => `<div class="it${s[0] === 'skull' ? ' curse' : ''}${s[3] ? ' cd' : ''}"><span>${s[2] || ITEM_LABEL[s[0]]}</span><img src="${ICON_URL[s[0]]}"><b>${s[1]}</b></div>`).join('');
  }
  const sk = snap.p.slice().sort((a, b) => a.sl - b.sl);
  scoreEl.innerHTML = sk.map((p) => `<div class="pl${p.al ? '' : ' dead'}"><i style="background:${SLOT_CSS[p.sl]}"></i>${p.nm.replace(/</g, '&lt;')}${p.id === V.meId ? ' (você)' : ''}<b>${p.wn}/${snap.wn}</b></div>`).join('');
  const left = Math.max(0, snap.rl - snap.rt), sudden = snap.rt >= snap.rl - (BM.roundTime - BM.sudden);
  timerEl.innerHTML = snap.pr ? 'Treino livre<small>sem fim de rodada</small>' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}<small>Rodada ${snap.rn}${sudden ? ' · MORTE SÚBITA' : ''}</small>`;
  let m = '';
  if (snap.ph === 'ready') { const c = Math.ceil(snap.pt); m = `Rodada ${snap.rn}<small>${c > 0 ? c : ''}</small>`; if (c !== V.lastCount) { V.lastCount = c; if (c > 0) SFX.beep(false); } }
  else if (snap.ph === 'roundEnd') { const w = snap.p.find((p) => p.id === snap.w); m = w ? `${w.id === V.meId ? 'Você venceu a rodada!' : w.nm + ' venceu a rodada'}` : 'Empate!'; }
  else if (snap.ph === 'matchEnd') { const w = snap.p.find((p) => p.id === snap.mw); m = `${w ? (w.id === V.meId ? 'VOCÊ GANHOU!' : w.nm + ' ganhou a partida') : 'Fim'}<small>Voltando pro menu…</small>`; }
  else if (!me.al) m = '<small>Você foi eliminado — assistindo</small>';
  else if (snap.rt < 1) m = 'VAI!';
  if (m !== msg.dataset.m) { msg.dataset.m = m; msg.innerHTML = m; msg.style.display = m ? 'block' : 'none'; }
  if (V.lastPhase === 'ready' && snap.ph === 'play') SFX.beep(true);
  V.lastPhase = snap.ph;
}
function drawMini(snap) {
  const N = snap.n, s = 150 / N; mini.clearRect(0, 0, 150, 150);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const g = snap.g.charCodeAt(z * N + x) - 48; mini.fillStyle = g === 1 ? '#56607e' : g === 2 ? '#c4713a' : '#2f6b3a'; mini.fillRect(x * s, z * s, s + 0.5, s + 0.5); }
  const mpd = BOMBER_MAPS[snap.mp]; if (mpd && mpd.portals) mpd.portals.forEach((pr, i) => { mini.fillStyle = i ? '#ff9a2f' : '#39a0ff'; for (const [x, z] of [[pr[0], pr[1]], [pr[2], pr[3]]]) { mini.beginPath(); mini.arc((x + 0.5) * s, (z + 0.5) * s, s * (snap.po ? 0.5 : 0.25), 0, 7); mini.fill(); } });
  mini.fillStyle = 'rgba(255,40,20,.45)';
  for (const h of snap.hz) { if (h.w <= 0 && h.k !== 'fire') continue; if (h.k === 'train' || h.k === 'wave') { if (h.ax === 'z') mini.fillRect(h.lo / CELL * s, s, (h.hi - h.lo) / CELL * s, 150 - 2 * s); else mini.fillRect(s, h.lo / CELL * s, 150 - 2 * s, (h.hi - h.lo) / CELL * s); } else if (h.k === 'fire') { if (h.ax === 'x') mini.fillRect(s, h.idx * s, 150 - 2 * s, s); else mini.fillRect(h.idx * s, s, s, 150 - 2 * s); } else if (h.k === 'meteor') mini.fillRect((h.cx - 1) * s, (h.cz - 1) * s, 3 * s, 3 * s); else if (h.k === 'lava') mini.fillRect(h.cx * s, h.cz * s, s, s); else if (h.k === 'ball') { mini.beginPath(); mini.arc(75, 75, h.R / CELL * s, 0, 7); mini.lineWidth = s * 1.4; mini.strokeStyle = 'rgba(255,40,20,.45)'; mini.stroke(); } }
  for (const f of snap.fi) { mini.fillStyle = '#ffb030'; mini.fillRect(f.cx * s, f.cz * s, s, s); }
  for (const it of snap.it) { mini.fillStyle = '#fff'; mini.fillRect(it.cx * s + s * 0.25, it.cz * s + s * 0.25, s * 0.5, s * 0.5); }
  for (const b of snap.b) { mini.fillStyle = '#000'; mini.beginPath(); mini.arc(b.x / CELL * s, b.z / CELL * s, s * 0.35, 0, 7); mini.fill(); }
  for (const sm of snap.sm) { if (!sm.l) continue; mini.fillStyle = 'rgba(210,210,220,.55)'; mini.beginPath(); mini.arc(sm.x / CELL * s, sm.z / CELL * s, BM.smoke.r / CELL * s, 0, 7); mini.fill(); }
  for (const p of snap.p) { if (!p.al) continue; const v = V.vis.get(p.id) || p; mini.fillStyle = SLOT_CSS[p.sl]; mini.beginPath(); mini.arc(v.x / CELL * s, v.z / CELL * s, s * 0.42, 0, 7); mini.fill(); if (p.id === V.meId) { mini.strokeStyle = '#fff'; mini.lineWidth = 1.5; mini.stroke(); } }
}

// ================= entrada =================
addEventListener('keydown', (e) => {
  if (V.mode !== 'game') return;
  if (e.code === 'Escape') return;
  V.keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) act('bomb'); }
  else if (e.code === 'KeyF' && !e.repeat) act('smoke');
  else if (e.code === 'KeyG' && !e.repeat) act('jump');
  else if (e.code === 'KeyC' && !e.repeat) { V.fp = !V.fp; toast(V.fp ? 'Primeira pessoa' : 'Terceira pessoa'); }
  else if (e.code === 'KeyM' && !e.repeat) { A.on = !A.on; toast(A.on ? 'Som ligado' : 'Som desligado'); if (A.fuseG && !A.on) A.fuseG.gain.value = 0; }
});
addEventListener('keyup', (e) => { V.keys[e.code] = false; });
addEventListener('blur', () => { V.keys = {}; });
canvas.addEventListener('click', () => { if (V.mode === 'game' && canvas.requestPointerLock) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { V.locked = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', (e) => { if (V.locked && V.mode === 'game') V.yaw += e.movementX * 0.0026; });
function act(a) {
  if (!V.snap || V.snap.ph !== 'play') return;
  if (V.solo) { const me = V.sim.players.get(V.meId); if (me) me.yaw = V.yaw; V.sim.act(V.meId, a); return; }
  if (a === 'jump') { const m = V.mirror.players.get(V.meId); if (m) { m.yaw = V.yaw; if (!V.mirror.startJump(m)) return; V.mirror.drainEvents(); SFX.boing(); } } // pula na hora aqui e o servidor confirma
  V.socket.emit('bm_act', { a });
}

// ================= câmera =================
function updateCamera(snap, dt, now) {
  const me = V.me;
  const alive = me && me.al !== 0 && me.alive !== false;
  { // névoa: eliminado = sem névoa (vista de cima); escuro, tempestade e fumaça fecham a visão
    let n = FOG[0], f = FOG[1];
    if (V.dkK > 0.01) { n += (30 - n) * V.dkK; f += (620 - f) * V.dkK; }
    if (V.stK > 0.01) { n += (120 - n) * V.stK; f += (760 - f) * V.stK; }
    if (V.inSmoke) { n = 40; f = 420; }
    if (!alive) { n = 4000; f = 9000; }
    scene.fog.near = n; scene.fog.far = f;
  }
  if (!alive) { // eliminado: vista de cima do mapa todo
    const c = snap.n * CELL / 2, h = snap.n * CELL * 0.95; camera.position.lerp(_p.set(c, h, c + snap.n * CELL * 0.62), 1 - Math.exp(-dt * 3)); camera.lookAt(c, 0, c + 30); camera.fov = 55; camera.updateProjectionMatrix(); return;
  }
  const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw);
  if (V.fp) { camera.position.set(me.x + cy * 10, 58 + (me.y || 0), me.z + sy * 10); camera.lookAt(me.x + cy * 200, 50, me.z + sy * 200); }
  else {
    // terceira pessoa baixa: a câmera fica abaixo do topo das paredes (122) e para antes de entrar em parede
    let d = 135; const solid = (x, z) => { const c = V.mirror ? V.mirror.cell(cellOf(x), cellOf(z)) : V.sim.cell(cellOf(x), cellOf(z)); return c !== 0; };
    for (let t = 20; t <= 135; t += 10) { if (solid(me.x - cy * t, me.z - sy * t)) { d = Math.max(24, t - 24); break; } }
    camera.position.set(me.x - cy * d, Math.min(126, 94 + Math.max(0, 115 - d) * 0.35), me.z - sy * d); camera.lookAt(me.x + cy * 70, 36, me.z + sy * 70);
  }
  if (V.shake > 0.1) { camera.position.x += (Math.random() - 0.5) * V.shake; camera.position.y += (Math.random() - 0.5) * V.shake; V.shake *= Math.exp(-dt * 7); }
  const fov = V.fp ? 80 : 68; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ================= loop =================
let lastT = performance.now(), sendAcc = 0, stepAcc = 0;
function inputDir() {
  const k = V.keys; let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw); return [cy * f - sy * s, sy * f + cy * s];
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t; const now = t;
  if (V.mode !== 'game') { renderer.render(scene, camera); return; }
  const turn = (V.keys.KeyE || V.keys.ArrowRight ? 1 : 0) - (V.keys.KeyQ || V.keys.ArrowLeft ? 1 : 0); V.yaw += turn * 2.4 * dt;
  const [dx, dz] = inputDir();
  let snap;
  if (V.solo) {
    const me = V.sim.players.get(V.meId); me.yaw = V.yaw;
    V.sim.moveLocal(me, dx, dz, dt); V.sim.step(dt);
    snap = V.sim.snapshot(); snap.rx = now; onEvents(V.sim.drainEvents(), now);
  } else {
    snap = V.net; if (!snap) return;
    const m = V.mirror.players.get(V.meId);
    if (m) {
      m.yaw = V.yaw; V.mirror.time += dt; const px = m.x, pz = m.z;
      V.mirror.moveLocal(m, dx, dz, dt); V.mirror.drainEvents(); V.mirror.updatePassLocal(m);
      const mv = Math.hypot(m.x - px, m.z - pz) > 0.01;
      if (!mv && m.sx != null && Math.hypot(m.sx - m.x, m.sz - m.z) > 3) { m.x += (m.sx - m.x) * Math.min(1, dt * 8); m.z += (m.sz - m.z) * Math.min(1, dt * 8); }
      sendAcc += dt; if (sendAcc >= 1 / 30) { sendAcc = 0; V.socket.emit('bm_in', { x: m.x, z: m.z, dx: V.mirror.phase === 'play' ? dx : 0, dz: V.mirror.phase === 'play' ? dz : 0, yaw: V.yaw }); }
    }
  }
  V.snap = snap; buildMap(snap);
  // posições visuais (suaviza os outros jogadores) e criação dos bonecos
  for (const p of snap.p) {
    let v = V.vis.get(p.id);
    if (!v) { v = { x: p.x, z: p.z, yaw: p.yaw }; V.vis.set(p.id, v); }
    const mine = p.id === V.meId;
    if (mine && !V.solo) { const m = V.mirror.players.get(V.meId); v.x = m.x; v.z = m.z; v.yaw = V.yaw; v.vx = m.vx; v.vz = m.vz; }
    else if (mine) { v.x = p.x; v.z = p.z; v.yaw = V.yaw; v.vx = p.vx; v.vz = p.vz; }
    else { const k = V.solo ? 1 : 1 - Math.exp(-dt * 16); if (Math.hypot(p.x - v.x, p.z - v.z) > 150) { v.x = p.x; v.z = p.z; } v.x += (p.x - v.x) * k; v.z += (p.z - v.z) * k; let dy = p.yaw - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); v.yaw += dy * Math.min(1, dt * 14); v.vx = p.vx; v.vz = p.vz; }
    Object.assign(v, { jm: mine && !V.solo ? (V.mirror.players.get(V.meId).jmp ? V.mirror.players.get(V.meId).jmp.t / V.mirror.players.get(V.meId).jmp.T : -1) : p.jm, al: p.al, cu: p.cu, iv: p.iv, dt: p.dt, winner: snap.ph === 'roundEnd' && snap.w === p.id });
    let a = V.avatars.get(p.id); if (!a) { a = new Avatar(p); V.avatars.set(p.id, a); }
    a.update(v, dt, now, mine);
    // passos (os dos outros jogadores dá pra ouvir mesmo atrás da parede)
    const sp = Math.hypot(v.vx || 0, v.vz || 0);
    if (p.al && sp > 40) { a.stepT -= dt * (sp / BM.speed); if (a.stepT <= 0) { a.stepT = 0.27; SFX.step(mine ? null : [v.x, v.z], p.sl); } } else a.stepT = 0.05;
  }
  const mp = snap.p.find((p) => p.id === V.meId);
  V.me = V.vis.get(V.meId) ? Object.assign(V.vis.get(V.meId), { al: mp ? mp.al : 1 }) : null;
  updateBombs(snap, now, dt); updateFires(snap); updateItems(snap, now); updateSmokes(snap, now); updateHz(snap, now, dt); updateDecor(snap, now, dt); updateEnv(snap, dt, now);
  // marcador de onde a bomba vai cair (luva)
  if (mp && mp.cr) { if (!V.aim) { V.aim = new THREE.Mesh(new THREE.RingGeometry(26, 40, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); V.aim.rotation.x = -Math.PI / 2; V.aim.position.y = 2; scene.add(V.aim); }
    const c = Math.cos(V.yaw), s = Math.sin(V.yaw), dxn = Math.abs(c) >= Math.abs(s) ? Math.sign(c) : 0, dzn = dxn ? 0 : Math.sign(s), N = snap.n;
    const tcs = BOMBER_MAPS[snap.mp] && BOMBER_MAPS[snap.mp].lowg ? 5 : BM.throwCells;
    V.aim.visible = true; V.aim.position.x = centerOf(clamp(cellOf(V.me.x) + dxn * tcs, 1, N - 2)); V.aim.position.z = centerOf(clamp(cellOf(V.me.z) + dzn * tcs, 1, N - 2)); V.aim.rotation.z = now / 400;
  } else if (V.aim) V.aim.visible = false;
  // fumaça atrapalha: tela cinza quando você está dentro dela
  const inS = !!(mp && mp.sp); if (inS !== V.inSmoke) { V.inSmoke = inS; $('smokeov').style.opacity = inS ? '1' : '0'; scene.fog.near = inS ? 40 : FOG[0]; scene.fog.far = inS ? 420 : FOG[1]; }
  flash.intensity *= Math.exp(-dt * 9);
  if (theme.storm) { // tempestade: relâmpago de vez em quando, com trovão atrasado
    if (!V.bolt && Math.random() < dt * 0.15) { V.bolt = 0.3; setTimeout(() => SFX.thunder(), 400 + Math.random() * 900); }
    if (V.bolt > 0) { V.bolt -= dt; const k = V.bolt > 0 ? (Math.floor(V.bolt * 22) % 2 ? 1 : 0.35) : 0; hemi.intensity = theme.hemi[2] + 2.6 * k; scene.background.set(k > 0.5 ? '#6a7f9c' : theme.sky); if (V.bolt <= 0) { V.bolt = 0; hemi.intensity = theme.hemi[2]; scene.background.set(theme.sky); } }
  }
  updateParticles(dt); updateCamera(snap, dt, now);
  updateHud(snap); if (((t / 100) | 0) !== drawMini.k) { drawMini.k = (t / 100) | 0; drawMini(snap); }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ================= menu / partida =================
function resetWorld() {
  V.avatars.forEach((a) => a.remove()); V.avatars.clear(); V.vis.clear();
  for (const m of [bombObjs, fireObjs, itemObjs, smokeObjs]) { for (const o of m.values()) scene.remove(o.g); m.clear(); }
  V.pendingPlace.clear(); V.snap = null; V.net = null; mapKey = ''; curTheme = ''; curDecor = ''; for (const o of hzObjs.values()) scene.remove(o.g); hzObjs.clear(); V.dkK = V.stK = 0; V.lastPhase = ''; V.lastCount = -1; hudKey = ''; msg.dataset.m = ''; P.n = 0;
  $('smokeov').style.opacity = '0'; V.inSmoke = false; scene.fog.near = FOG[0]; scene.fog.far = FOG[1];
}
function enterGame() { $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); V.mode = 'game'; V.yaw = 0; setErr(''); }
function toMenu(keepRoom) {
  if (document.exitPointerLock) document.exitPointerLock();
  V.mode = 'menu'; $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); V.sim = null; V.mirror = null; resetWorld();
  $('m-main').classList.remove('hidden'); $('m-lobby').classList.add('hidden'); if (V.socket && !keepRoom) V.socket.emit('bm_leave');
}
addEventListener('keydown', (e) => { if (e.code === 'Escape' && V.mode === 'game') toMenu(); });
$('btn-solo').onclick = async () => {
  audioInit(); setErr('');
  try { await loadChar(); } catch (e) { return setErr('Não consegui carregar o modelo do personagem.'); }
  resetWorld(); V.solo = true; V.meId = 'me';
  const bots = +$('bots').value, list = [{ id: 'me', name: $('name').value.trim() || 'Você', ch: 'hood' }];
  for (let i = 0; i < bots; i++) list.push({ id: 'bot' + (i + 1), name: 'Bot ' + (i + 1), bot: true, ch: 'hood' });
  V.sim = new BomberSim({ players: list, rounds: +$('rounds').value, map: $('map').value }); V.mirror = null; enterGame();
};
function ensureSocket() {
  if (V.socket) return V.socket;
  if (typeof io === 'undefined') { setErr('Socket.IO não carregou (o servidor está rodando?).'); return null; }
  const s = V.socket = io();
  s.on('bm_err', (t) => setErr(t));
  s.on('bm_lobby', async (d) => {
    V.meId = d.you;
    if (d.started) {
      if (V.mode === 'game') return;
      try { await loadChar(); } catch (e) { return setErr('Não consegui carregar o modelo do personagem.'); }
      resetWorld(); V.solo = false; V.mirror = new BomberMirror(); enterGame(); return;
    }
    if (V.mode === 'game') toMenu(true);
    $('m-main').classList.add('hidden'); $('m-lobby').classList.remove('hidden'); $('lobbyRoom').textContent = d.room;
    $('lobbyList').innerHTML = d.players.map((p) => `<div>${p.name.replace(/</g, '&lt;')}${p.id === d.host ? ' ★' : ''}${p.id === d.you ? ' (você)' : ''}</div>`).join('');
    const host = d.host === d.you; $('btn-start').classList.toggle('hidden', !host); $('hostOpts').classList.toggle('hidden', !host); $('lobbyWait').classList.toggle('hidden', host);
  });
  s.on('bm_snap', (snap) => {
    if (V.mode !== 'game' || !V.mirror) return;
    snap.rx = performance.now(); V.net = snap; V.mirror.apply(snap, V.meId);
    if (snap.fix) { const m = V.mirror.players.get(V.meId); if (m) { m.x = snap.fix[0]; m.z = snap.fix[1]; } }
    const m = V.mirror.players.get(V.meId); const sp = snap.p.find((p) => p.id === V.meId);
    if (m && sp && Math.hypot(sp.x - m.x, sp.z - m.z) > 90) { m.x = sp.x; m.z = sp.z; }
  });
  s.on('bm_ev', (ev) => { if (V.mode === 'game') onEvents(ev, performance.now()); });
  return s;
}
$('btn-online').onclick = () => {
  audioInit(); setErr(''); const s = ensureSocket(); if (!s) return;
  const room = $('room').value.trim().toUpperCase(); if (!/^[A-Z0-9]{1,5}$/.test(room)) return setErr('Sala: 1 a 5 letras ou números.');
  s.emit('bm_join', { room, name: $('name').value.trim() || 'Jogador', ch: 'hood' });
};
$('btn-start').onclick = () => { audioInit(); V.socket.emit('bm_start', { bots: +$('lbots').value, rounds: +$('lrounds').value, map: $('lmap').value }); };
$('btn-leave').onclick = () => { if (V.socket) V.socket.emit('bm_leave'); $('m-main').classList.remove('hidden'); $('m-lobby').classList.add('hidden'); };
