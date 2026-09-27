// Demo 3D FPS do Point Ball (Three.js).
// A simulação 3D (física, armas, bots) fica em sim3d.js; aqui ficam o desenho, os controles, o menu (Esc),
// a mira editável, o placar (Tab) e os bonecos KayKit animados.
// Eixos: x e z no chão (mesmas medidas do mapa 2D), y para cima.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sim3D, MAGIC_NAME, WEAPONS, WEAPON_IDS, P, PORTAL, HOLE, DuneField, holeEdgeR, TRAIN, WAVE, CEILING_Y, LAMP, TREE, TORNADO, FROST, METEOR, PLAT, AIM, DRINK, DOOR_HOLD, CRANE, craneAngle, pistonTop, DRAGON, dragonX } from '/demo3d/sim3d.js';
import { world3D, simOptions, IGLOO, TREEHOUSE, MAPS3D, TOWER, SHIP, setEditOverride, activeEdits } from '/demo3d/world3d.js';
import { FX_DEFAULT } from '/demo3d/fx3d.js';
import { CHARS, TEAM_PAL, LEATHER, HAIR, SKIN, HATS, SLOTS, LOOK_DEFAULT, normLook, botLook, dressModel } from '/demo3d/looks3d.js';

const $ = (id) => document.getElementById(id);
const G = window.RC_GAME, BOTS = window.RC_BOTS, MAPS = Object.assign({}, window.RC_MAPS.MAPS, MAPS3D), CFG = window.RC_CONFIG.DEFAULT_CONFIG; // + mapas só do 3D
const TEAM = { A: 0x3b82f6, B: 0xef4444 };
const STEP = 1 / 60;
const CHAR_H = P.height;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- configurações (ficam salvas neste navegador) ----------
const DEFAULTS = {
  cam: '1', map: 'deserto', bots: '2', allies: '0', level: 'amador', shadow: '1', fov: 80, camDist: 150, camSide: '1', streamer: '0', gunDist: 100, pause: '1', armSize: 100, armLen: 100, armW: 100, magic: '0', weapon: 'arco', sens: 1.6, invert: '0',
  mode: 'tdm', kills: '30', rounds: '3', hill: '100', mtime: '300', kc: '1', sfx: {}, adszoom: '1',
  die: '1', speed: P.speed, jumpv: P.jumpV, tweapon: WEAPON_IDS[0], wtune: {},
  x: { color: '#ffffff', outline: '1', len: 7, thick: 2, gap: 4, dot: '1', dotsize: 2, ring: '1', ringr: 22, ringw: 2, hit: '1', hitlen: 10, hitw: 1 }
};
let S = JSON.parse(JSON.stringify(DEFAULTS));
try { const saved = JSON.parse(localStorage.getItem('pb3d_settings') || 'null'); if (saved) { S = Object.assign(S, saved); S.x = Object.assign({}, DEFAULTS.x, saved.x || {}); S.wtune = Object.assign({}, saved.wtune || {}); } } catch (e) {}
const save = () => { try { localStorage.setItem('pb3d_settings', JSON.stringify(S)); } catch (e) {} };
if (S.mute == null) S.mute = '0';
if (!WEAPON_IDS.includes(S.weapon)) S.weapon = 'arco'; // armas antigas (lançador/disco) saíram
if (!WEAPON_IDS.includes(S.tweapon)) S.tweapon = WEAPON_IDS[0];
S.sfx = Object.assign({}, S.sfx || {});
S.look = normLook(S.look); // roupa do seu personagem
delete S.test;
// editor de mapa: o rascunho do editor (só neste navegador, fora do multiplayer) e a prévia (?preview=mapa)
function localEdits() { try { if (localStorage.getItem('pb3d_edits_on') !== '1' && !PREVIEW && !EDIT3D_MAP) return null; return JSON.parse(localStorage.getItem('pb3d_edits') || 'null'); } catch (e) { return null; } }
const PREVIEW = (() => { try { const q = new URLSearchParams(location.search); return q.get('preview'); } catch (e) { return null; } })();
const EDIT3D_MAP = (() => { try { return new URLSearchParams(location.search).get('edit3d'); } catch (e) { return null; } })(); // editor de mapa em 3D
let EDIT3D = null;
if (EDIT3D_MAP) { S.map = EDIT3D_MAP; S.bots = '0'; S.allies = '0'; S.die = '0'; S.mode = 'livre'; }
if (PREVIEW) { S.map = PREVIEW; S.bots = '0'; S.allies = '0'; S.die = '0'; S.mode = 'livre'; }
// efeitos visuais do tiro (o editor muda estes números)
let FX = JSON.parse(JSON.stringify(FX_DEFAULT));
function applyFx() { const e = activeEdits().fx || {}; FX = JSON.parse(JSON.stringify(FX_DEFAULT)); for (const k of Object.keys(FX)) Object.assign(FX[k], e[k] || {}); }

// ---------- sons (sintetizados, sem arquivo de áudio) ----------
const SFX = (() => {
  let ctx = null, master = null, farBus = null;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      farBus = ctx.createBiquadFilter(); farBus.type = 'lowpass'; farBus.frequency.value = 650; farBus.Q.value = 0.5; farBus.connect(master); // sons dos outros: abafados (mais graves)
    } catch (e) { ctx = null; }
  }
  function noiseBuf(dur) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    return buf;
  }
  function out(node, opts) {
    if (opts && opts.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); node.connect(p); return p; }
    return node;
  }
  // tom curto: onda + envelope de volume (slideTo = escorrega a nota)
  function tone(freq, dur, type, vol, opts) {
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const pk = opts.pitch || 1;
    const osc = ctx.createOscillator(); osc.type = type || 'square'; osc.frequency.setValueAtTime(freq * pk, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo * pk), t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out(osc, opts).connect(g); g.connect(opts.far && farBus ? farBus : master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  // chiado filtrado (type: lowpass / highpass / bandpass; sweep = filtro escorregando)
  function noise(dur, vol, opts) {
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(dur);
    const filt = ctx.createBiquadFilter(); filt.type = opts.type || (opts.lowpass ? 'lowpass' : 'highpass'); filt.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.q) filt.Q.value = opts.q;
    if (opts.sweep) filt.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + (opts.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); out(filt, opts).connect(g); g.connect(opts.far && farBus ? farBus : master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  // voz de gente (bem simples): dente de serra com a nota subindo um pouco + 2 filtros de vogal "é"
  function voice(f0, dur, vol, opts) {
    opts = opts || {}; const t0 = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f0, t0); osc.frequency.linearRampToValueAtTime(f0 * 1.25, t0 + dur * 0.35); osc.frequency.linearRampToValueAtTime(f0 * 0.95, t0 + dur);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5 + Math.random() * 2; vg.gain.value = f0 * 0.03; vib.connect(vg); vg.connect(osc.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1900; f2.Q.value = 5; const g2 = ctx.createGain(); g2.gain.value = 0.5;
    osc.connect(f1); osc.connect(f2); f2.connect(g2); out(f1, opts).connect(g); out(g2, opts).connect(g); g.connect(opts.far && farBus ? farBus : master);
    osc.start(t0); vib.start(t0); osc.stop(t0 + dur + 0.05); vib.stop(t0 + dur + 0.05);
  }
  // rugido (dragão): 2 osciladores ásperos com a nota subindo e caindo, tremido rápido (garganta), distorção e um filtro
  // de vogal abrindo e fechando ("rrrAAAaaah"), mais o bafo (chiado grave)
  function roar(f0, dur, vol, opts) {
    opts = opts || {}; const t0 = ctx.currentTime + (opts.delay || 0);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + dur * 0.18); g.gain.setValueAtTime(vol, t0 + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 26 + Math.random() * 8; lg.gain.value = 0.45; trem.gain.value = 0.6; lfo.connect(lg); lg.connect(trem.gain);
    const ws = ctx.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * 3.2); } ws.curve = cv;
    const fm = ctx.createBiquadFilter(); fm.type = 'bandpass'; fm.Q.value = 1.6; fm.frequency.setValueAtTime(380, t0); fm.frequency.linearRampToValueAtTime(900, t0 + dur * 0.35); fm.frequency.linearRampToValueAtTime(420, t0 + dur);
    for (const [k, type, gv] of [[1, 'sawtooth', 0.6], [1.49, 'square', 0.25], [0.5, 'sawtooth', 0.5]]) {
      const o = ctx.createOscillator(); o.type = type; const og = ctx.createGain(); og.gain.value = gv;
      o.frequency.setValueAtTime(f0 * k, t0); o.frequency.linearRampToValueAtTime(f0 * k * 1.55, t0 + dur * 0.3); o.frequency.exponentialRampToValueAtTime(f0 * k * 0.62, t0 + dur);
      o.connect(og); og.connect(trem); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    trem.connect(ws); ws.connect(fm); out(fm, opts).connect(g); g.connect(opts.far && farBus ? farBus : master);
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    noise(dur * 0.9, vol * 0.55, Object.assign({}, opts, { type: 'lowpass', freq: 500, sweep: 250, attack: dur * 0.2 }));
  }
  // estalos de fogo/pedra: vários cliques curtinhos espalhados no tempo
  function crackle(dur, n, vol, opts) { for (let i = 0; i < n; i++) noise(0.02 + Math.random() * 0.03, vol * (0.4 + Math.random() * 0.6), Object.assign({}, opts, { type: 'bandpass', freq: 1500 + Math.random() * 3500, q: 2, delay: (opts && opts.delay || 0) + Math.random() * dur })); }
  // som de fundo contínuo (chuva, mar): chiado em loop passando por um filtro; o volume muda devagar
  const beds = {};
  function bed(key, type, freq, q) {
    if (!ctx) return null; if (beds[key]) return beds[key];
    const n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(master); src.start();
    return (beds[key] = { g, f });
  }
  function setBed(key, v, type, freq, q) {
    if (!ctx || S.mute === '1') v = 0;
    const b = beds[key] || (v > 0 ? bed(key, type, freq, q) : null); if (!b) return;
    b.g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.4);
  }
  const O = (o, extra) => Object.assign({}, o, extra);
  const LP = (f) => ({ type: 'lowpass', freq: f }), BP = (f, q) => ({ type: 'bandpass', freq: f, q: q || 1.2 }), HP = (f) => ({ type: 'highpass', freq: f });
  // cada som tem várias opções (o Caique escolhe na aba "Sala de teste"); a primeira é a padrão
  const LIB = {
    shot: [
      ['Flecha (vuush grave)', (v, o) => { noise(0.14, 0.4 * v, O(o, BP(700, 0.9))); tone(150, 0.13, 'triangle', 0.28 * v, O(o, { slideTo: 80 })); }],
      ['Corda do arco (tum)', (v, o) => { tone(105, 0.2, 'sawtooth', 0.2 * v, O(o, { slideTo: 70 })); noise(0.08, 0.25 * v, O(o, LP(1100))); }],
      ['Bola de neve (puf)', (v, o) => { noise(0.11, 0.5 * v, O(o, LP(520))); tone(85, 0.11, 'sine', 0.4 * v, O(o, { slideTo: 48 })); }],
      ['Estilingue (tlac)', (v, o) => { tone(240, 0.05, 'square', 0.16 * v, O(o, { slideTo: 110 })); noise(0.07, 0.32 * v, O(o, LP(900))); }],
      ['Grave (bum)', (v, o) => { tone(68, 0.22, 'sine', 0.55 * v, O(o, { slideTo: 38 })); noise(0.1, 0.25 * v, O(o, LP(380))); }],
      ['Sopro (fuu)', (v, o) => noise(0.18, 0.4 * v, O(o, { type: 'bandpass', freq: 1200, sweep: 300, q: 0.8 }))],
      ['Clássico agudo (pew)', (v, o) => tone(620, 0.09, 'square', 0.4 * v, O(o, { slideTo: 160 }))]
    ],
    hit: [
      ['Toc', (v, o) => tone(180, 0.09, 'sine', 0.4 * v, o)],
      ['Tum', (v, o) => tone(120, 0.13, 'sine', 0.45 * v, O(o, { slideTo: 60 }))],
      ['Pá', (v, o) => { noise(0.06, 0.35 * v, O(o, LP(1500))); tone(220, 0.07, 'triangle', 0.25 * v, o); }],
      ['Borracha (boing)', (v, o) => tone(300, 0.12, 'triangle', 0.3 * v, O(o, { slideTo: 150 }))],
      ['Plin', (v, o) => tone(520, 0.1, 'sine', 0.3 * v, O(o, { slideTo: 260 }))]
    ],
    kill: [
      ['Tan-tan', (v, o) => { tone(500, 0.12, 'sawtooth', 0.45 * v, o); tone(760, 0.16, 'sawtooth', 0.35 * v, o); }],
      ['Ding', (v, o) => { tone(880, 0.25, 'sine', 0.35 * v, o); tone(1320, 0.3, 'sine', 0.2 * v, O(o, { delay: 0.05 })); }],
      ['Grave duplo', (v, o) => { tone(220, 0.14, 'triangle', 0.45 * v, o); tone(330, 0.18, 'triangle', 0.4 * v, O(o, { delay: 0.1 })); }],
      ['Sino', (v, o) => { tone(660, 0.5, 'sine', 0.32 * v, o); tone(990, 0.45, 'sine', 0.16 * v, o); }],
      ['Fliperama', (v, o) => tone(400, 0.2, 'square', 0.25 * v, O(o, { slideTo: 1200 }))]
    ],
    jump: [
      ['Pulinho', (v, o) => tone(340, 0.1, 'triangle', 0.28 * v, O(o, { slideTo: 560 }))],
      ['Pulo grave', (v, o) => tone(170, 0.12, 'sine', 0.35 * v, O(o, { slideTo: 290 }))],
      ['Vento', (v, o) => noise(0.13, 0.25 * v, O(o, BP(650)))],
      ['Mola', (v, o) => tone(200, 0.18, 'sine', 0.28 * v, O(o, { slideTo: 700 }))],
      ['Baixinho', (v, o) => noise(0.08, 0.1 * v, O(o, LP(800)))]
    ],
    land: [
      ['Pó', (v, o) => noise(0.06, 0.22 * v, O(o, LP(500)))],
      ['Tum', (v, o) => tone(90, 0.1, 'sine', 0.35 * v, O(o, { slideTo: 50 }))],
      ['Areia', (v, o) => noise(0.09, 0.25 * v, O(o, LP(1300)))],
      ['Pesado', (v, o) => { noise(0.12, 0.3 * v, O(o, LP(300))); tone(60, 0.12, 'sine', 0.3 * v, o); }]
    ],
    knife: [
      ['Corte (lâmina)', (v, o) => { noise(0.16, 0.36 * v, O(o, { type: 'bandpass', freq: 4200, sweep: 1100, q: 1.3 })); noise(0.07, 0.22 * v, O(o, { type: 'bandpass', freq: 6500, q: 7, delay: 0.05 })); noise(0.09, 0.2 * v, O(o, { type: 'lowpass', freq: 500, delay: 0.1 })); }],
      ['Corte', (v, o) => noise(0.07, 0.35 * v, O(o, LP(2200)))],
      ['Swish', (v, o) => noise(0.13, 0.35 * v, O(o, { type: 'bandpass', freq: 3000, sweep: 900, q: 1 }))],
      ['Lâmina', (v, o) => { noise(0.05, 0.3 * v, O(o, HP(3000))); tone(900, 0.08, 'triangle', 0.15 * v, O(o, { slideTo: 400 })); }],
      ['Sopro', (v, o) => noise(0.1, 0.3 * v, O(o, LP(900)))]
    ],
    reload: [
      ['Clique', (v, o) => noise(0.04, 0.25 * v, O(o, LP(1800)))],
      ['Clique duplo', (v, o) => { tone(1100, 0.02, 'square', 0.12 * v, o); tone(900, 0.03, 'square', 0.12 * v, O(o, { delay: 0.12 })); }],
      ['Trava', (v, o) => { noise(0.05, 0.3 * v, O(o, LP(1200))); tone(300, 0.06, 'triangle', 0.2 * v, O(o, { delay: 0.05 })); }],
      ['Corda esticando', (v, o) => tone(200, 0.16, 'triangle', 0.2 * v, O(o, { slideTo: 420 }))]
    ],
    throw: [
      ['Arremesso', (v, o) => tone(300, 0.12, 'triangle', 0.28 * v, O(o, { slideTo: 220 }))],
      ['Vuush', (v, o) => noise(0.16, 0.3 * v, O(o, { type: 'bandpass', freq: 1500, sweep: 400, q: 0.8 }))],
      ['Grave', (v, o) => tone(150, 0.15, 'sine', 0.35 * v, O(o, { slideTo: 95 }))],
      ['Ar', (v, o) => noise(0.2, 0.22 * v, O(o, BP(500)))]
    ],
    erupt: [
      ['Chão de pedra quebrando e lava', (v, o) => { noise(0.5, 0.5 * v, O(o, { type: 'lowpass', freq: 900, sweep: 150 })); crackle(0.6, 18, 0.3 * v, o); noise(1.6, 0.4 * v, O(o, { type: 'lowpass', freq: 160, sweep: 60, delay: 0.1, attack: 0.08 })); tone(38, 1.2, 'sine', 0.3 * v, O(o, { delay: 0.05 })); noise(1.4, 0.16 * v, O(o, { type: 'bandpass', freq: 700, sweep: 300, q: 0.7, delay: 0.35, attack: 0.3 })); for (let i = 0; i < 4; i++) tone(90 + Math.random() * 80, 0.18, 'sine', 0.12 * v, O(o, { slideTo: 40, delay: 0.5 + i * 0.22 })); }],
      ['Explosão (antiga)', (v, o) => { noise(0.8, 0.5 * v, O(o, LP(700))); tone(55, 0.6, 'sine', 0.3 * v, o); }]
    ],
    explode: [
      ['Explosão', (v, o) => noise(0.45, 0.6 * v, O(o, LP(700)))],
      ['Bum grave longo', (v, o) => { noise(0.8, 0.6 * v, O(o, LP(300))); tone(55, 0.7, 'sine', 0.5 * v, O(o, { slideTo: 30 })); }],
      ['Estalo', (v, o) => noise(0.3, 0.55 * v, O(o, LP(2000)))],
      ['Trovão', (v, o) => { noise(1.0, 0.55 * v, O(o, { type: 'lowpass', freq: 900, sweep: 150 })); tone(42, 0.9, 'sine', 0.45 * v, O(o, { slideTo: 22 })); }],
      ['Abafada', (v, o) => noise(0.5, 0.5 * v, O(o, LP(220)))]
    ],
    bounce: [
      ['Batidinha', (v, o) => noise(0.05, 0.18 * v, O(o, LP(1400)))],
      ['Toc de borracha', (v, o) => tone(250, 0.05, 'sine', 0.2 * v, O(o, { slideTo: 180 }))],
      ['Estalinho', (v, o) => noise(0.03, 0.15 * v, O(o, HP(2500)))],
      ['Baixinho', (v, o) => noise(0.04, 0.07 * v, O(o, LP(900)))],
      ['Mudo', () => {}]
    ],
    portal: [
      ['Vuuum subindo', (v, o) => { tone(220, 0.28, 'sine', 0.26 * v, O(o, { slideTo: 880 })); tone(330, 0.22, 'triangle', 0.13 * v, O(o, { slideTo: 1320 })); }],
      ['Vento', (v, o) => noise(0.35, 0.3 * v, O(o, { type: 'bandpass', freq: 300, sweep: 2500, q: 2 }))],
      ['Sci-fi descendo', (v, o) => tone(880, 0.3, 'sine', 0.22 * v, O(o, { slideTo: 220 }))],
      ['Grave', (v, o) => tone(110, 0.35, 'triangle', 0.3 * v, O(o, { slideTo: 440 }))]
    ],
    drink: [
      ['Glub-glub', (v, o) => { for (let i = 0; i < 3; i++) tone(260 - i * 30, 0.1, 'sine', 0.3 * v, O(o, { delay: 0.18 + i * 0.22, slideTo: 150 })); }],
      ['Gole grave', (v, o) => { for (let i = 0; i < 2; i++) { tone(140, 0.16, 'sine', 0.4 * v, O(o, { delay: 0.2 + i * 0.3, slideTo: 90 })); noise(0.08, 0.12 * v, O(o, Object.assign(LP(600), { delay: 0.22 + i * 0.3 }))); } }],
      ['Bolhinhas', (v, o) => { for (let i = 0; i < 6; i++) tone(500 + Math.random() * 400, 0.05, 'sine', 0.15 * v, O(o, { delay: 0.15 + i * 0.1, slideTo: 900 })); }],
      ['Cura (brilho)', (v, o) => { tone(520, 0.3, 'sine', 0.25 * v, O(o, { delay: 0.5, slideTo: 1040 })); tone(780, 0.35, 'sine', 0.15 * v, O(o, { delay: 0.6, slideTo: 1560 })); }],
      ['Rolha + gole', (v, o) => { tone(900, 0.04, 'square', 0.12 * v, o); for (let i = 0; i < 3; i++) tone(200, 0.12, 'triangle', 0.25 * v, O(o, { delay: 0.25 + i * 0.22, slideTo: 120 })); }]
    ],
    magic: [
      ['Raio grave (vuum)', (v, o) => { tone(170, 0.22, 'triangle', 0.3 * v, O(o, { slideTo: 60 })); tone(85, 0.26, 'sine', 0.3 * v, O(o, { slideTo: 40 })); noise(0.16, 0.18 * v, O(o, { type: 'lowpass', freq: 900, sweep: 250 })); }],
      ['Trovãozinho', (v, o) => { tone(120, 0.18, 'sawtooth', 0.12 * v, O(o, { slideTo: 50 })); noise(0.2, 0.25 * v, O(o, LP(600))); }],
      ['Zap (agudo)', (v, o) => { tone(900, 0.12, 'sawtooth', 0.18 * v, O(o, { slideTo: 2400 })); noise(0.1, 0.15 * v, O(o, HP(3000))); }],
      ['Brilho', (v, o) => { tone(1300, 0.18, 'sine', 0.25 * v, O(o, { slideTo: 2600 })); tone(1950, 0.2, 'sine', 0.12 * v, O(o, { delay: 0.03, slideTo: 3900 })); }],
      ['Laser', (v, o) => tone(1800, 0.14, 'square', 0.14 * v, O(o, { slideTo: 300 }))],
      ['Mágico (swish)', (v, o) => noise(0.2, 0.28 * v, O(o, { type: 'bandpass', freq: 800, sweep: 5000, q: 3 }))]
    ],
    horn: [
      ['Buzina de metrô (forte)', (v, o) => { for (const [f, d] of [[311, 0], [370, 0], [311, 0.75], [370, 0.75]]) tone(f, 0.6, 'sawtooth', 0.16 * v, O(o, { delay: d, attack: 0.03 })); noise(1.3, 0.12 * v, O(o, BP(900, 2))); }],
      ['Buzina de trem', (v, o) => { tone(185, 0.9, 'sawtooth', 0.22 * v, o); tone(233, 0.9, 'sawtooth', 0.18 * v, o); }],
      ['Apito', (v, o) => { tone(700, 0.6, 'square', 0.12 * v, o); tone(880, 0.6, 'square', 0.1 * v, O(o, { delay: 0.05 })); }],
      ['Sino de estação', (v, o) => { for (let i = 0; i < 3; i++) tone(988, 0.25, 'sine', 0.25 * v, O(o, { delay: i * 0.3 })); }],
      ['Buzina grave', (v, o) => tone(110, 1.1, 'sawtooth', 0.28 * v, o)]
    ],
    train: [
      ['Metrô passando rápido', (v, o) => { noise(2.2, 0.45 * v, O(o, { type: 'lowpass', freq: 500, sweep: 1600, attack: 0.25 })); for (let i = 0; i < 16; i++) noise(0.05, 0.28 * v, O(o, Object.assign(BP(2400, 3), { delay: 0.1 + i * 0.13 }))); tone(62, 2.0, 'sawtooth', 0.12 * v, O(o, { attack: 0.3, slideTo: 48 })); }],
      ['Trilho (ta-dam)', (v, o) => { for (let i = 0; i < 10; i++) { noise(0.06, 0.3 * v, O(o, Object.assign(LP(1800), { delay: i * 0.2 }))); noise(0.06, 0.24 * v, O(o, Object.assign(LP(1400), { delay: i * 0.2 + 0.07 }))); } }],
      ['Vento do túnel', (v, o) => noise(2.0, 0.5 * v, O(o, { type: 'bandpass', freq: 300, sweep: 1200, q: 0.7, attack: 0.4 }))],
      ['Mudo', () => {}]
    ],
    cheer: [
      ['Torcida gritando', (v, o) => { // "êêêêh!": várias vozes (grossas e finas) passando por filtros de vogal, mais o chiado do povo
        noise(2.2, 0.22 * v, O(o, Object.assign(BP(900, 0.9), { attack: 0.35 }))); noise(2.0, 0.12 * v, O(o, Object.assign(BP(2200, 1.2), { attack: 0.4 })));
        for (let i = 0; i < 9; i++) { const f0 = (i % 2 ? 190 : 120) * (0.9 + Math.random() * 0.35), d = Math.random() * 0.35; voice(f0, 1.1 + Math.random() * 0.7, 0.05 * v, O(o, { delay: d })); }
      }],
      ['Torcida (antiga)', (v, o) => { noise(2.4, 0.3 * v, O(o, Object.assign(BP(1100, 0.8), { attack: 0.5 }))); for (let i = 0; i < 5; i++) tone(380 + Math.random() * 380, 0.5 + Math.random() * 0.5, 'sawtooth', 0.025 * v, O(o, Object.assign({ delay: Math.random() * 1.4, attack: 0.15, slideTo: 300 + Math.random() * 600 }))); }],
      ['Torcida baixinha', (v, o) => noise(2.4, 0.15 * v, O(o, Object.assign(BP(900, 0.7), { attack: 0.6 })))],
      ['Mudo', () => {}]
    ],
    wave: [
      ['Onda quebrando (grave)', (v, o) => { noise(2.4, 0.5 * v, O(o, { type: 'lowpass', freq: 150, sweep: 330, attack: 0.5 })); noise(1.8, 0.34 * v, O(o, { type: 'lowpass', freq: 560, sweep: 260, attack: 0.08, delay: 0.5 })); tone(44, 1.6, 'sine', 0.26 * v, O(o, { delay: 0.45 })); tone(70, 0.7, 'sine', 0.14 * v, O(o, { delay: 0.5 })); }], // (v0.28: sem o chiado agudo)
      ['Onda (rugido)', (v, o) => noise(1.8, 0.5 * v, O(o, { type: 'lowpass', freq: 300, sweep: 1400 }))],
      ['Mar batendo', (v, o) => { noise(1.2, 0.45 * v, O(o, LP(700))); noise(0.6, 0.3 * v, O(o, Object.assign(HP(2000), { delay: 0.8 }))); }],
      ['Trovão de água', (v, o) => { noise(1.5, 0.5 * v, O(o, LP(250))); tone(50, 1.2, 'sine', 0.3 * v, o); }],
      ['Sirene de navio', (v, o) => tone(150, 1.4, 'triangle', 0.3 * v, O(o, { slideTo: 120 }))]
    ],
    dragon: [
      ['Rugido de dragão (novo)', (v, o) => { roar(62, 2.4, 0.34 * v, o); roar(88, 1.8, 0.16 * v, O(o, { delay: 0.25 })); noise(0.6, 0.12 * v, O(o, { type: 'bandpass', freq: 2600, q: 1.5, delay: 0.5, attack: 0.2 })); }],
      ['Rugido de dragão (antigo)', (v, o) => { tone(95, 1.3, 'sawtooth', 0.22 * v, O(o, { slideTo: 55, attack: 0.15 })); tone(142, 1.1, 'sawtooth', 0.12 * v, O(o, { slideTo: 70, attack: 0.2 })); noise(1.4, 0.3 * v, O(o, { type: 'lowpass', freq: 700, sweep: 200, attack: 0.1 })); }],
      ['Rugido curto', (v, o) => { tone(120, 0.7, 'sawtooth', 0.2 * v, O(o, { slideTo: 60 })); noise(0.8, 0.25 * v, O(o, LP(600))); }],
      ['Mudo', () => {}]
    ],
    fire: [
      ['Labareda (novo)', (v, o) => { noise(3.2, 0.42 * v, O(o, { type: 'lowpass', freq: 260, sweep: 520, attack: 0.25 })); noise(3.0, 0.2 * v, O(o, { type: 'bandpass', freq: 1300, sweep: 800, q: 0.6, attack: 0.3 })); noise(0.8, 0.28 * v, O(o, { type: 'lowpass', freq: 400, sweep: 3000, attack: 0.05 })); crackle(3, 26, 0.16 * v, o); }],
      ['Fogo (vuush)', (v, o) => noise(1.6, 0.35 * v, O(o, { type: 'bandpass', freq: 900, sweep: 300, q: 0.7, attack: 0.1 }))],
      ['Mudo', () => {}]
    ],
    wash: [
      ['Água batendo no casco', (v, o) => { noise(1.6, 0.22 * v, O(o, { type: 'lowpass', freq: 380, sweep: 1400, attack: 0.35 })); noise(1.2, 0.08 * v, O(o, { type: 'highpass', freq: 1800, delay: 0.5, attack: 0.3 })); }],
      ['Mudo', () => {}]
    ],
    strike: [
      ['Raio caindo perto', (v, o) => { noise(0.09, 0.9 * v, O(o, HP(1800))); noise(0.35, 0.6 * v, O(o, { type: 'bandpass', freq: 900, q: 0.8, delay: 0.02 })); crackle(0.25, 10, 0.4 * v, o); noise(3, 0.7 * v, O(o, { type: 'lowpass', freq: 320, sweep: 60, delay: 0.08, attack: 0.05 })); tone(42, 2.4, 'sine', 0.35 * v, O(o, { delay: 0.05 })); }],
      ['Mudo', () => {}]
    ],
    thunder: [
      ['Trovão rolando longe', (v, o) => { noise(3.4, 0.42 * v, O(o, { type: 'lowpass', freq: 240, sweep: 70, attack: 0.5 })); tone(38, 2.6, 'sine', 0.12 * v, O(o, { attack: 0.6 })); }],
      ['Trovão longe (antigo)', (v, o) => { noise(2.6, 0.55 * v, O(o, { type: 'lowpass', freq: 420, sweep: 90, attack: 0.05 })); noise(0.4, 0.3 * v, O(o, LP(900))); tone(42, 2.2, 'sine', 0.25 * v, o); }],
      ['Trovão estalando', (v, o) => { noise(0.25, 0.5 * v, O(o, HP(600))); noise(2.2, 0.5 * v, O(o, { type: 'lowpass', freq: 300, sweep: 70, delay: 0.1 })); }],
      ['Mudo', () => {}]
    ],
    door: [
      ['Vuush de nave', (v, o) => noise(0.35, 0.3 * v, O(o, { type: 'bandpass', freq: 500, sweep: 1800, q: 1.2 }))],
      ['Pistão', (v, o) => { noise(0.25, 0.25 * v, O(o, LP(900))); tone(90, 0.2, 'sine', 0.2 * v, O(o, { slideTo: 60 })); }],
      ['Sci-fi', (v, o) => tone(300, 0.25, 'sine', 0.2 * v, O(o, { slideTo: 700 }))],
      ['Baixinho', (v, o) => noise(0.2, 0.1 * v, O(o, BP(700)))],
      ['Mudo', () => {}]
    ],
    splash: [
      ['Lava (blub)', (v, o) => { noise(0.35, 0.4 * v, O(o, LP(500))); tone(120, 0.3, 'sine', 0.3 * v, O(o, { slideTo: 40 })); }],
      ['Tsss', (v, o) => noise(0.5, 0.3 * v, O(o, HP(1500)))],
      ['Blub', (v, o) => tone(200, 0.25, 'sine', 0.35 * v, O(o, { slideTo: 60 }))],
      ['Fogo', (v, o) => noise(0.6, 0.45 * v, O(o, { type: 'lowpass', freq: 1400, sweep: 200 }))]
    ]
  };
  const NAMES = { strike: 'Raio caindo perto (navio)', erupt: 'Chão quebrando (vulcão)', wash: 'Água no casco (navio)', dragon: 'Dragão (castelo)', fire: 'Fogo do dragão', thunder: 'Trovão (navio)', shot: 'Tiro', hit: 'Acerto', kill: 'Abate', jump: 'Pulo', land: 'Aterrissar', knife: 'Faca', reload: 'Recarregar', throw: 'Arremesso (granada)', explode: 'Explosão', bounce: 'Ricochete na parede', portal: 'Portal', splash: 'Cair na lava', drink: 'Beber poção', door: 'Porta da nave', magic: 'Raio da varinha', horn: 'Trem chegando (buzina)', train: 'Trem passando', cheer: 'Torcida do navio', wave: 'Onda gigante' };
  return {
    init, LIB, NAMES, setBed, beds: () => beds,
    play(kind, vol, opts) {
      if (!ctx || S.mute === '1') return;
      const list = LIB[kind]; if (!list) return;
      const pick = list[Math.min(list.length - 1, Math.max(0, Number((S.sfx || {})[kind]) || 0))];
      pick[1](Math.max(0, Math.min(1, vol == null ? 1 : vol)), opts || {});
    }
  };
})();
// volume por distância até o "me" (jogadores/explosões longe tocam mais baixo)
function sfxAt(kind, x, z, opts) {
  const me = sim && sim.players.get('me');
  if (!me) { SFX.play(kind, 1, opts); return; }
  const dx = x - me.x, dz = z - me.z, dist = Math.hypot(dx, dz);
  const vol = (dist < 40 ? 1 : Math.max(0, 1 - dist / 1400)) * (opts && opts.gain != null ? opts.gain : 1);
  if (vol <= 0.02) return;
  const pan = Math.max(-1, Math.min(1, dx / 400));
  SFX.play(kind, vol, Object.assign({ pan }, opts));
}

// ---------- renderizador ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = S.shadow === '1';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
// luzes de efeito fixas na cena (explosão e erupção): o número de luzes nunca muda, então nada recompila no meio do jogo
const EXPL_LIGHT = new THREE.PointLight(0xffa640, 0, 800, 2); scene.add(EXPL_LIGHT);
const ERUPT_LIGHTS = [new THREE.PointLight(0xff7a2a, 0, 1000, 2), new THREE.PointLight(0xff7a2a, 0, 1000, 2)]; for (const l of ERUPT_LIGHTS) scene.add(l);
let eruptLightTurn = 0;
const camera = new THREE.PerspectiveCamera(S.fov, 1, 1.5, 8000);
scene.add(camera);
// arma/mãos da 1ª pessoa numa cena própria, desenhada por cima (limpa só a profundidade): a arma nunca entra no chão,
// na parede ou na escada, e a luz dela não depende do lugar (só segue a cor/força da luz do mapa)
const FP_FOV = 74; // (v0.28) a arma tem o próprio campo de visão: mudar o FOV do jogo não muda o tamanho dela
const fpScene = new THREE.Scene(), fpCam = new THREE.PerspectiveCamera(FP_FOV, 1, 1, 600); fpScene.add(fpCam);
const fpHemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.3), fpSun = new THREE.DirectionalLight(0xffffff, 1.6); fpSun.position.set(0.45, 1, 0.7); fpScene.add(fpHemi, fpSun);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1320, right: 1320, top: 950, bottom: -950, near: 10, far: 4500 }); // mapas 40% maiores
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0 }, extra || {}));
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- mapa ----------
let mapGroup = null, mapWalls = [], baseLight = { hemi: 1.3, sun: 2.3 };
let lampLights = [], lampPool = [], lavaFx = [], portalViews = [];
// informações da partida que o servidor sorteia (portais, buracos) + terreno do deserto
let mapInfo = { mapId: null, portalPairs: null, portals: [], holes: null, dunes: null };
// cores só da versão 3D (o 2D continua com as dele)
const THEME3D = {
  escuro: { wall: '#3a3d45', wallEdge: '#5b606b', border: '#2a2c32' },
  portal: { ground: '#3a3f47', ground2: '#343941', wall: '#dfe3e8', wallEdge: '#8a929c', border: '#c3c9d1' },
  nave: { ground: '#3b4250', ground2: '#353c49', wall: '#c7ccd4', wallEdge: '#5b6472', border: '#aeb5bf' },
  deserto: { ground: '#e6c68c', ground2: '#dcb877', border: '#b98552' },
  vulcao: { wall: '#34302e', wallEdge: '#1f1c1b', border: '#2a2624' }
};
const WALL_STYLE = { castelo: 'stone', navio: 'plank', deserto: 'sandstone', neve: 'ice', floresta: 'wood', nave: 'corridor', portal: 'lab', vulcao: 'basalt', metro: 'tile', mar: 'container', obra: 'concrete', fabrica: 'container' };
const groundY = (x, z) => (mapInfo.dunes ? mapInfo.dunes.at(x, z) : 0);

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function groundTexture(th, seed, style, opts) {
  return canvasTex(2048, 1280, (g, W, H) => {
    const rnd = seeded(seed);
    g.fillStyle = th.ground; g.fillRect(0, 0, W, H);
    if (style === 'deck') { // piso de nave: placas de metal com junta, parafuso e risco
      const s = 128;
      for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
        const l = 44 + Math.floor(rnd() * 10);
        g.fillStyle = `rgb(${l},${l + 5},${l + 14})`; g.fillRect(x + 2, y + 2, s - 4, s - 4);
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 2, y + 2, s - 4, 3);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 2, y + s - 5, s - 4, 3);
        g.fillStyle = '#20252e'; for (const [bx, by] of [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]]) { g.beginPath(); g.arc(x + bx, y + by, 3, 0, 7); g.fill(); }
        if (rnd() < 0.25) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let k = 16; k < s - 16; k += 10) { g.beginPath(); g.moveTo(x + 20, y + k); g.lineTo(x + s - 20, y + k); g.stroke(); } } // grade de ventilação
      }
      g.strokeStyle = 'rgba(200,210,230,.05)'; g.lineWidth = 1;
      for (let i = 0; i < 300; i++) { const x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 10); g.stroke(); }
      // faixas de aviso amarelo/preto perto das bordas
      const stripe = (x, y, w, h) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#e0b020'; g.fillRect(x, y, w, h); g.fillStyle = '#1b1b1b'; for (let k = -h; k < w + h; k += 36) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + 18, y); g.lineTo(x + k + 18 - h, y + h); g.lineTo(x + k - h, y + h); g.fill(); } g.restore(); };
      stripe(40, 40, W - 80, 16); stripe(40, H - 56, W - 80, 16);
      return;
    }
    if (style === 'lab') { // piso de laboratório: ladrilho escuro grande
      const s = 102;
      for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
        const l = 52 + Math.floor(rnd() * 8); g.fillStyle = `rgb(${l},${l + 3},${l + 8})`; g.fillRect(x + 2, y + 2, s - 4, s - 4);
      }
      g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 400; i++) { g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 5, 0, 7); g.fill(); }
      return;
    }
    if (style === 'city' && opts) { // cidade: asfalto, calçada em volta dos muros e faixas pintadas nas ruas
      const sx = W / opts.W, sz = H / opts.H;
      for (let i = 0; i < 5000; i++) { const l = 30 + Math.floor(rnd() * 22); g.fillStyle = `rgba(${l},${l + 2},${l + 6},.5)`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
      const side = opts.walls.filter((R) => !R.space).map((R) => { const m = R.border ? 36 : 30; return [(R.x - m) * sx, (R.y - m) * sz, (R.w + 2 * m) * sx, (R.h + 2 * m) * sz]; });
      for (const [x, y, w, h] of side) { g.fillStyle = '#4b4f58'; g.fillRect(x, y, w, h); g.strokeStyle = '#6b707b'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); }
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
      for (const [x, y, w, h] of side) { for (let k = x; k < x + w; k += 22) { g.beginPath(); g.moveTo(k, y); g.lineTo(k, y + h); g.stroke(); } for (let k = y; k < y + h; k += 22) { g.beginPath(); g.moveTo(x, k); g.lineTo(x + w, k); g.stroke(); } }
      const hitsSide = (x, y, w, h) => side.some(([a, b, c, d]) => x < a + c && x + w > a && y < b + d && y + h > b);
      g.fillStyle = 'rgba(235,225,170,.75)';
      for (const nz of [0.1, 0.35, 0.65, 0.9]) for (let x = 0; x < W; x += 60) { const y = nz * H - 3; if (!hitsSide(x, y, 34, 6)) g.fillRect(x, y, 34, 6); }
      for (const nx of [0.07, 0.19, 0.3, 0.7, 0.81, 0.93]) for (let y = 0; y < H; y += 60) { const x = nx * W - 3; if (!hitsSide(x, y, 6, 34)) g.fillRect(x, y, 6, 34); }
      g.fillStyle = 'rgba(240,240,240,.55)'; // faixas de pedestre
      for (const [nx, nz] of [[0.3, 0.35], [0.7, 0.35], [0.3, 0.65], [0.7, 0.65], [0.5, 0.1], [0.5, 0.9]]) for (let k = -3; k <= 3; k++) { const x = nx * W + k * 16 - 5, y = nz * H - 30; if (!hitsSide(x, y, 10, 60)) g.fillRect(x, y, 10, 60); }
      g.fillStyle = '#1f2228'; for (let i = 0; i < 14; i++) { const x = rnd() * W, y = rnd() * H; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); } // bueiros
      g.fillStyle = 'rgba(120,140,170,.12)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 50, 8 + rnd() * 20, rnd() * 3, 0, 7); g.fill(); } // poças
      return;
    }
    if (style === 'metro' && opts) { // piso de estação: concreto, faixa amarela na beira do trilho e o leito de pedra dos trilhos
      for (let i = 0; i < 6000; i++) { const l = 120 + Math.floor(rnd() * 30); g.fillStyle = `rgba(${l},${l},${l + 3},.35)`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
      const sx = W / opts.W;
      for (const lx of opts.lanes || []) { const x = lx * sx, hw = (TRAIN.half + 6) * sx;
        g.fillStyle = '#3b3632'; g.fillRect(x - hw, 0, hw * 2, H); for (let i = 0; i < 1500; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(90,85,80,.6)' : 'rgba(40,36,32,.6)'; g.fillRect(x - hw + rnd() * hw * 2, rnd() * H, 3, 3); }
        g.fillStyle = '#f2c300'; g.fillRect(x - hw - 14 * sx, 0, 6 * sx, H); g.fillRect(x + hw + 8 * sx, 0, 6 * sx, H);
        g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < H; y += 10) { g.fillRect(x - hw - 14 * sx, y, 6 * sx, 3); g.fillRect(x + hw + 8 * sx, y, 6 * sx, 3); } }
      return;
    }
    if (style === 'dirt') { // terra batida de obra, com cascalho e marca de pneu
      for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(60,45,30,.25)' : 'rgba(200,180,150,.18)'; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2 + rnd() * 3); }
      g.strokeStyle = 'rgba(50,38,26,.35)'; g.lineWidth = 10;
      for (let i = 0; i < 6; i++) { let x = rnd() * W, y = rnd() * H, a = rnd() * 6; for (const off of [0, 34]) { g.beginPath(); let xx = x + Math.cos(a + 1.57) * off, yy = y + Math.sin(a + 1.57) * off; g.moveTo(xx, yy); for (let k = 0; k < 8; k++) { a += (rnd() - 0.5) * 0.3; xx += Math.cos(a) * 90; yy += Math.sin(a) * 90; g.lineTo(xx, yy); } g.stroke(); } }
      g.fillStyle = 'rgba(90,80,70,.5)'; for (let i = 0; i < 300; i++) { g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 3, 0, 7); g.fill(); }
      return;
    }
    if (style === 'factory' && opts) { // piso de fábrica: concreto polido, faixas amarelas e listrado de aviso nos pistões
      const sx = W / opts.W, sz = H / opts.H;
      for (let i = 0; i < 6000; i++) { const l = 95 + Math.floor(rnd() * 30); g.fillStyle = `rgba(${l},${l + 2},${l + 6},.3)`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (let x = 0; x < W; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.fillStyle = 'rgba(242,195,0,.8)'; for (const B of opts.belts || []) { g.fillRect((B.x0 - 14) * sx, B.z0 * sz, 5 * sx, (B.z1 - B.z0) * sz); g.fillRect((B.x1 + 9) * sx, B.z0 * sz, 5 * sx, (B.z1 - B.z0) * sz); }
      for (const R of opts.walls) if (R.piston) { const x = (R.x - 12) * sx, y = (R.y - 12) * sz, w = (R.w + 24) * sx, h = (R.h + 24) * sz; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#e0b020'; g.fillRect(x, y, w, h); g.fillStyle = '#1b1b1b'; for (let k = -h; k < w + h; k += 30) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + 15, y); g.lineTo(x + k + 15 - h, y + h); g.lineTo(x + k - h, y + h); g.fill(); } g.restore(); }
      return;
    }
    if (style === 'castle' && opts) { // gramado do castelo com caminhos de pedra das bases até as portas do salão
      const sx = W / opts.W, sz = H / opts.H;
      for (let i = 0; i < 6000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(120,160,70,.22)' : 'rgba(40,70,30,.2)'; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2); }
      const path = (x0, z0, x1, z1, w) => { g.save(); g.strokeStyle = '#8f8a7c'; g.lineWidth = w * sx; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 * sx, z0 * sz); g.lineTo(x1 * sx, z1 * sz); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 26);
        for (let k = 0; k < n; k++) { const u = k / n, px = (x0 + (x1 - x0) * u) * sx, pz = (z0 + (z1 - z0) * u) * sz; g.strokeRect(px - 10 * sx, pz - 8 * sz, (16 + rnd() * 8) * sx, 14 * sz); } g.restore(); };
      const cz = opts.H / 2;
      path(0, cz, opts.W, cz, 110); path(opts.W / 2, 0, opts.W / 2, opts.H, 90);
      return;
    }
    if (style === 'wood') { // convés de madeira
      for (let y = 0; y < H; y += 22) { const l = 128 + Math.floor(rnd() * 26); g.fillStyle = `rgb(${l + 20},${l - 6},${l - 44})`; g.fillRect(0, y, W, 20); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 20, W, 2); for (let x = rnd() * 200; x < W; x += 180 + rnd() * 160) g.fillRect(x, y, 2, 20); }
      g.fillStyle = 'rgba(60,35,15,.12)'; for (let i = 0; i < 900; i++) g.fillRect(rnd() * W, rnd() * H, 20 + rnd() * 40, 1);
      return;
    }
    if (style === 'sand') { // areia: grãozinhos e ondinhas de vento bem fraquinhas
      for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,245,220,.16)' : 'rgba(150,100,45,.12)'; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
      g.strokeStyle = 'rgba(160,112,55,.09)'; g.lineWidth = 1.5;
      for (let y = 0; y < H; y += 9) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.01 + y * 0.3) * 4); g.stroke(); }
      return;
    }
    g.fillStyle = th.ground2;
    for (let i = 0; i < 520; i++) { g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 6 + rnd() * 30, 3 + rnd() * 12, rnd() * 3, 0, Math.PI * 2); g.fill(); }
    if (style === 'ash') { // chão de cinza vulcânica com rachaduras
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 140; i++) { let x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    }
  });
}
function wallTexture(color, style) {
  if (style === 'corridor') return canvasTex(256, 256, (g) => { // parede de corredor de nave: painel de metal claro
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#d6dbe2'); grd.addColorStop(1, '#b7bdc7');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    for (const x of [0, 128]) { // dois painéis por bloco, com chanfro
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 6, 40, 116, 3); g.fillRect(x + 6, 40, 3, 150);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 6, 188, 116, 3); g.fillRect(x + 119, 40, 3, 151);
      g.fillStyle = '#8b939e'; for (const [bx, by] of [[14, 48], [114, 48], [14, 180], [114, 180]]) { g.beginPath(); g.arc(x + bx, by, 2.5, 0, 7); g.fill(); }
    }
    // (ordem nova: a faixa preta fica em cima e a faixa cinza de metal embaixo)
    g.fillStyle = '#2d333c'; g.fillRect(0, 0, 256, 34); // faixa escura em cima
    g.fillStyle = '#e0b020'; g.fillRect(0, 34, 256, 4);
    g.fillStyle = '#9aa2ad'; g.fillRect(0, 214, 256, 42); // rodapé de metal cinza
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 214, 256, 2); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 216, 2, 40); // juntas do metal
    g.fillStyle = '#e8f7ff'; g.fillRect(0, 14, 256, 6); // fita de luz (na faixa escura)
    g.fillStyle = '#3b424c'; for (let k = 0; k < 7; k++) g.fillRect(150 + k * 12, 226, 7, 20); // grade de ventilação
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 34); g.lineTo(128, 214); g.stroke();
  }, true);
  if (style === 'lab') return canvasTex(256, 256, (g) => { // painéis brancos de sala de teste
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(5);
    for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
      const l = 218 + Math.floor(rnd() * 16); g.fillStyle = `rgb(${l},${l + 2},${l + 5})`; g.fillRect(x + 2, y + 2, 60, 60);
    }
    g.strokeStyle = 'rgba(40,45,55,.55)'; g.lineWidth = 3;
    for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
    g.fillStyle = 'rgba(60,50,40,.035)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rnd() * 256, 225 + rnd() * 31, 2 + rnd() * 6, 0, 7); g.fill(); }
  }, true);
  if (style === 'tile') return canvasTex(256, 256, (g) => { // azulejo de metrô (branquinho) com faixa colorida
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(120,110,90,.35)'; g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
    g.fillStyle = '#1e6fb8'; g.fillRect(0, 150, 256, 20); g.fillStyle = '#f2c300'; g.fillRect(0, 172, 256, 6);
    g.fillStyle = '#5a5347'; g.fillRect(0, 232, 256, 24);
  }, true);
  if (style === 'container') return canvasTex(256, 256, (g) => { // contêiner de metal ondulado
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 5, 256); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 10, 0, 4, 256); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 256, 10); g.fillRect(0, 246, 256, 10);
    g.fillStyle = 'rgba(150,80,30,.25)'; const rnd = seeded(3); for (let i = 0; i < 40; i++) g.fillRect(rnd() * 256, rnd() * 256, 3 + rnd() * 10, 2 + rnd() * 6);
  }, true);
  if (style === 'concrete') return canvasTex(256, 256, (g) => { // concreto de obra: placas, furinhos da forma e manchas
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(41);
    for (let i = 0; i < 1400; i++) { const l = 130 + Math.floor(rnd() * 50); g.fillStyle = `rgba(${l},${l},${l - 4},.25)`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    g.strokeStyle = 'rgba(40,40,40,.35)'; g.lineWidth = 2; for (let k = 0; k <= 256; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
    g.fillStyle = 'rgba(30,30,30,.55)'; for (let y = 32; y < 256; y += 64) for (let x = 32; x < 256; x += 64) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(80,70,55,.18)'; for (let i = 0; i < 10; i++) { const x = rnd() * 256; g.fillRect(x, rnd() * 100, 6 + rnd() * 10, 60 + rnd() * 120); } // escorrido
  }, true);
  if (style === 'basalt') return canvasTex(256, 256, (g) => { // pedra vulcânica escura (basalto), com rachaduras que brilham um pouco
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(66);
    for (let i = 0; i < 26; i++) { const x = rnd() * 256, y = rnd() * 256, w = 30 + rnd() * 70, h = 20 + rnd() * 40, l = 38 + Math.floor(rnd() * 22); g.fillStyle = `rgb(${l},${l - 3},${l - 5})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + rnd() * 10); g.lineTo(x + w - rnd() * 10, y + h); g.lineTo(x + rnd() * 8, y + h - rnd() * 8); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; for (let i = 0; i < 30; i++) { let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(255,110,40,.35)'; g.lineWidth = 1.2; for (let i = 0; i < 8; i++) { let x = rnd() * 256, y = 150 + rnd() * 106; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 200; i++) g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
  }, true);
  if (style === 'sandstone') return canvasTex(256, 256, (g) => { // paredão de arenito com camadas
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(21);
    for (let y = 0; y < 256; y += 6 + Math.floor(rnd() * 14)) { g.fillStyle = `rgba(${rnd() < 0.5 ? '90,55,25' : '255,230,190'},${0.08 + rnd() * 0.12})`; g.fillRect(0, y, 256, 3 + rnd() * 8); }
    g.fillStyle = 'rgba(70,40,20,.2)'; for (let i = 0; i < 90; i++) { g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 9, 1 + rnd() * 3, 0, 0, 7); g.fill(); }
  }, true);
  if (style === 'stone') return canvasTex(256, 256, (g) => { // pedra de castelo: blocos irregulares, musgo embaixo
    g.fillStyle = color; g.fillRect(0, 0, 256, 256); const rnd = seeded(71), base = new THREE.Color(color);
    for (let y = 0, row = 0; y < 256; y += 32, row++) for (let x = -(row % 2) * 30; x < 256; ) {
      const w = 40 + Math.floor(rnd() * 34), c = base.clone().multiplyScalar(0.82 + rnd() * 0.3);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x + 2, y + 2, w - 4, 28);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 2, y + 2, w - 4, 3); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 2, y + 27, w - 4, 3);
      x += w;
    }
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 160; i++) g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 2);
    const moss = g.createLinearGradient(0, 200, 0, 256); moss.addColorStop(0, 'rgba(70,100,50,0)'); moss.addColorStop(1, 'rgba(70,100,50,.35)'); g.fillStyle = moss; g.fillRect(0, 200, 256, 56);
  }, true);
  if (style === 'plank') return canvasTex(256, 128, (g) => { // tábuas de navio na horizontal (com pregos)
    const rnd = seeded(19), base = new THREE.Color(color);
    for (let y = 0; y < 128; y += 16) { const c = base.clone().multiplyScalar(0.8 + rnd() * 0.35); g.fillStyle = '#' + c.getHexString(); g.fillRect(0, y, 256, 16); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 14, 256, 2); for (let x = rnd() * 200; x < 256; x += 230 + rnd() * 120) { g.fillRect(x, y, 2, 14); g.fillStyle = 'rgba(30,20,10,.6)'; g.fillRect(x + 4, y + 6, 2, 2); g.fillStyle = 'rgba(0,0,0,.35)'; } }
    g.strokeStyle = 'rgba(40,25,10,.18)'; for (let i = 0; i < 50; i++) { const x = rnd() * 256, y = rnd() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rnd() * 40, y + (rnd() - 0.5) * 2); g.stroke(); }
  }, true);
  if (style === 'hedge') return canvasTex(128, 128, (g) => { // cerca viva (folhinhas)
    g.fillStyle = '#3f6a30'; g.fillRect(0, 0, 128, 128); const rnd = seeded(5);
    for (let i = 0; i < 700; i++) { const l = 60 + rnd() * 70; g.fillStyle = `rgba(${l * 0.55 | 0},${l | 0},${l * 0.4 | 0},.8)`; g.beginPath(); g.ellipse(rnd() * 128, rnd() * 128, 2 + rnd() * 3, 1.5 + rnd() * 2, rnd() * 3, 0, 7); g.fill(); }
  }, true);
  if (style === 'grate') return canvasTex(128, 128, (g) => { // escotilha de grade
    g.fillStyle = '#20150c'; g.fillRect(0, 0, 128, 128); g.fillStyle = color;
    for (let k = 0; k < 128; k += 21) { g.fillRect(k, 0, 8, 128); g.fillRect(0, k, 128, 8); }
  }, true);
  if (style === 'ice') return canvasTex(256, 256, (g) => { // gelo: veios brancos, bolhas e rachaduras
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#e9f6ff'); grd.addColorStop(0.5, '#a9d4f2'); grd.addColorStop(1, '#6fa6d0');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(33);
    for (let i = 0; i < 28; i++) { g.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.18})`; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 20 + rnd() * 60, 4 + rnd() * 12, rnd() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 0.6 + rnd() * 2, 0, 7); g.fill(); }
  }, true);
  return canvasTex(128, 128, (g) => {
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    if (style === 'wood') { // tábuas de madeira na vertical, com veio
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2;
      for (let x = 0; x <= 128; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
      const rnd = seeded(7);
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const x = rnd() * 128, y = rnd() * 128, len = 6 + rnd() * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke(); }
    } else { // tijolo (padrão)
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
      for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
      for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x <= 128; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
    }
  }, true);
}
// casco da base lunar: mesmo painel do corredor, mas com uma janela grande no meio (dá pra ver a Lua lá fora)
// casco da base lunar: parede alta de vidro (janelas pro espaço), igual antes
const HULL_TEX = canvasTex(256, 256, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#d6dbe2'); grd.addColorStop(1, '#b7bdc7');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#9aa2ad'; g.fillRect(0, 0, 256, 34);
  g.fillStyle = '#e8f7ff'; g.fillRect(0, 14, 256, 6);
  g.fillStyle = '#2d333c'; g.fillRect(0, 214, 256, 42); g.fillStyle = '#e0b020'; g.fillRect(0, 210, 256, 4);
  g.clearRect(12, 52, 232, 140); // vidro
  g.fillStyle = 'rgba(150,200,255,.10)'; g.fillRect(12, 52, 232, 140);
  g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(40, 52); g.lineTo(90, 52); g.lineTo(30, 192); g.lineTo(12, 192); g.lineTo(12, 110); g.fill(); // reflexo
  g.fillStyle = '#6b7280'; g.fillRect(4, 44, 248, 8); g.fillRect(4, 192, 248, 8); g.fillRect(4, 44, 8, 156); g.fillRect(244, 44, 8, 156); g.fillRect(124, 44, 8, 156); // moldura
}, true);
// fita de luz do corredor da nave (brilha sozinha)
const CORRIDOR_EMIS = canvasTex(256, 256, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#bfeaff'; g.fillRect(0, 14, 256, 6); g.fillStyle = '#34d399'; g.fillRect(20, 24, 6, 6); g.fillStyle = '#f87171'; g.fillRect(34, 24, 6, 6); }, true);
// mancha de luz macia (poste no chão, brilho de lava, portal)
const GLOW_TEX = canvasTex(128, 128, (g) => { const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); });
let iceEnv = null;
function iceEnvMap() { // reflexo pro gelo (só nele, pra não mudar a luz do resto)
  if (iceEnv) return iceEnv;
  const pm = new THREE.PMREMGenerator(renderer);
  iceEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  return iceEnv;
}

function buildTestRoom(w) {
  const W = w.W, H = w.H;
  mapGroup = new THREE.Group();
  scene.background = new THREE.Color(0x9cc7ee);
  scene.fog = new THREE.Fog(0x9cc7ee, 1800, 5200);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0x3d4a5c, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
  mapGroup.add(ground);
  // só a borda, sem muros no meio: mapa aberto pra testar mira/movimento à vontade
  mapWalls = w.walls;
  mapInfo = { mapId: 'teste', world: w, holes: null, dunes: null, W, H };
  for (const R of mapWalls) {
    const hgt = P.borderH;
    const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), mat(0x334155));
    box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2); box.castShadow = box.receiveShadow = true;
    mapGroup.add(box);
  }
  scene.add(mapGroup);
  hemi.intensity = 1.3; sun.intensity = 2.3; hemi.color.set(0xffffff); hemi.groundColor.set(0x445566); sun.color.set(0xffffff);
  baseLight = { hemi: 1.3, sun: 2.3 };
  sun.position.set(W / 2 - 600, 1500, H / 2 + 800); sun.target.position.set(W / 2, 0, H / 2);
}

// ---------- terreno: deserto (montanhas de areia) ----------
function buildDuneGround(th, D, W, H) {
  const geo = new THREE.PlaneGeometry(W, H, Math.round(W / 8), Math.round(H / 8));
  geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, H / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const lo = new THREE.Color(0xc99a5c), hi = new THREE.Color(0xf3dcaa), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = D.at(x, z);
    pos.setY(i, h);
    const [gx, gz] = D.grad(x, z), lit = Math.max(-1, Math.min(1, (-gx * 0.7 + gz * 0.4) * 1.5)); // lado virado pro sol mais claro
    c.copy(lo).lerp(hi, Math.min(1, 0.55 + h / D.maxH * 0.35 + lit * 0.2));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTexture(th, 55, 'sand'), vertexColors: true, roughness: 1 }));
  m.receiveShadow = true; m.castShadow = true;
  return m;
}
// pirâmide que dá pra subir (a altura vem do mesmo terreno da simulação); topo reto pra atirar lá de cima
const PYR_TEX = canvasTex(256, 256, (g) => { g.fillStyle = '#d7b37a'; g.fillRect(0, 0, 256, 256); const rnd = seeded(9); for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(90,60,25,.35)'; g.fillRect(0, y, 256, 2); for (let x = (y / 16) % 2 ? 0 : 20; x < 256; x += 40) g.fillRect(x, y, 2, 16); } for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,240,210' : '120,80,40'},.12)`; g.fillRect(rnd() * 256, rnd() * 256, 3, 3); } }, true);
function buildPyramid(q) {
  const t = PYR_TEX.clone(); t.needsUpdate = true; t.repeat.set(q.half / 60, q.h / 60);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(q.top * Math.SQRT2, q.half * Math.SQRT2, q.h, 4, 1), [new THREE.MeshStandardMaterial({ map: t, roughness: 1, flatShading: true }), mat(0xe6c690), mat(0xc9a064)]);
  m.rotation.y = Math.PI / 4; m.position.set(q.x, q.h / 2 + 1, q.z); m.castShadow = m.receiveShadow = true; mapGroup.add(m);
}
// deserto em volta da arena: areia até o horizonte, com dunas grandes lá longe (nenhuma entra no mapa) e pirâmides
function buildDesertOutside(W, H) {
  const far = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000), new THREE.MeshStandardMaterial({ color: 0xdcbc82, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -0.6, H / 2); far.receiveShadow = true;
  mapGroup.add(far);
  const rnd = seeded(404), sand = new THREE.MeshStandardMaterial({ color: 0xd9b57a, roughness: 1 });
  // a duna (elipse) tem que ficar longe da arena: a areia de fora não pode invadir e cobrir ninguém
  const clear = (x, z, r) => Math.hypot(Math.max(0, Math.abs(x - W / 2) - W / 2), Math.max(0, Math.abs(z - H / 2) - H / 2)) > r + 160;
  const geo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let n = 0, tries = 0; n < 72 && tries < 900; tries++) {
    const a = rnd() * Math.PI * 2, d = 1500 + rnd() * 5200;
    const x = W / 2 + Math.cos(a) * d, z = H / 2 + Math.sin(a) * d * 0.9;
    const sx = 380 + rnd() * 900, sy = 100 + rnd() * 320, sz = 240 + rnd() * 520;
    if (!clear(x, z, Math.max(sx, sz))) continue;
    const dune = new THREE.Mesh(geo, sand);
    dune.scale.set(sx, sy, sz); dune.rotation.y = rnd() * 3;
    dune.position.set(x, -2, z); dune.receiveShadow = true;
    mapGroup.add(dune); n++;
  }
  // pirâmides estilo Egito lá no horizonte
  const stone = new THREE.MeshStandardMaterial({ color: 0xd2ad72, roughness: 1, flatShading: true });
  const capM = new THREE.MeshStandardMaterial({ color: 0xf1d9a0, roughness: 0.6, metalness: 0.2, flatShading: true });
  for (const [dx, dz, sz] of [[-3300, -3900, 950], [-2150, -4500, 640], [-4300, -3100, 520], [3900, 3000, 820], [2900, 3900, 540]]) {
    const hgt = sz * 0.95, pyr = new THREE.Mesh(new THREE.ConeGeometry(sz, hgt, 4, 1), stone);
    pyr.rotation.y = Math.PI / 4 + dx * 0.0001; pyr.position.set(W / 2 + dx, hgt / 2 - 4, H / 2 + dz); pyr.castShadow = false; mapGroup.add(pyr);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.12, hgt * 0.12, 4, 1), capM); cap.rotation.y = pyr.rotation.y; cap.position.set(pyr.position.x, hgt - hgt * 0.06 - 4, pyr.position.z); mapGroup.add(cap);
  }
}

// ---------- vulcão: o mapa é uma laje de pedra flutuando em cima de um vulcão gigante ----------
// a erupção fura a laje (buraco); quem cai, cai dentro do vulcão lá embaixo
const LAVA_VERT = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// lava em coordenadas do mundo (coluna da erupção: a textura escorre de verdade)
const LAVA_VERT_W = 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = vec2(w.x + w.z * 0.7, w.y); gl_Position = projectionMatrix * viewMatrix * w; }';
const NOISE_GLSL = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
float fbm3(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 3; k++) { v += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return v * 1.14; }`;
const LAVA_FRAG = `uniform float uTime; uniform float uScale; varying vec2 vP; ${NOISE_GLSL}
void main(){
  vec2 p = vP * uScale;
  float n = fbm(p + vec2(uTime * 0.05, uTime * 0.03));
  float m = fbm(p * 2.2 - vec2(uTime * 0.08, -uTime * 0.04) + n * 1.6);
  float heat = smoothstep(0.35, 0.8, m);
  vec3 crust = vec3(0.12, 0.03, 0.01), hot = vec3(1.0, 0.36, 0.05), white = vec3(1.0, 0.85, 0.45);
  vec3 col = mix(crust, hot, heat); col = mix(col, white, smoothstep(0.72, 0.95, m));
  gl_FragColor = vec4(col * 1.7, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
let volcano = null;
// forma do chão (retângulo do mapa com os buracos); flip = vira a face pra baixo (parte de baixo da laje)
function slabShape(holes, W, H, flip) {
  const sz = flip ? 1 : -1, shape = new THREE.Shape(), N = 48;
  shape.moveTo(0, 0); shape.lineTo(W, 0); shape.lineTo(W, sz * H); shape.lineTo(0, sz * H); shape.lineTo(0, 0);
  for (const h of holes) {
    const path = new THREE.Path();
    for (let k = 0; k <= N; k++) { const a = k / N * Math.PI * 2, r = holeEdgeR(h, a), x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r; if (k === 0) path.moveTo(x, sz * z); else path.lineTo(x, sz * z); }
    shape.holes.push(path);
  }
  const geo = new THREE.ShapeGeometry(shape, 1); geo.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W, 1 - pos.getZ(i) / H);
  return geo;
}
function buildVolcanoWorld(th, W, H) {
  const T = HOLE.depth, rock = new THREE.MeshStandardMaterial({ color: 0x3a2822, roughness: 1, flatShading: true });
  volcano = { th, W, H, holeCount: -1, holeGroup: null, groundTex: groundTexture(th, 71, 'ash'), warn: [],
    lakeMat: new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 0.0035 } }, vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG, fog: false }) };
  // lateral da laje
  for (const [x, z, w, d] of [[W / 2, -4, W + 16, 16], [W / 2, H + 4, W + 16, 16], [-4, H / 2, 16, H], [W + 4, H / 2, 16, H]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), rock); b.position.set(x, -T / 2, z); mapGroup.add(b);
  }
  // borda: murinho de pedra baixo + uma barreira quase invisível (calor) até a altura da parede — assim dá pra ver
  // lá embaixo a boca do vulcão, a encosta e os rios de lava
  const parM = new THREE.MeshStandardMaterial({ map: wallTexture('#3b3431', 'basalt'), roughness: 1 });
  // vidro de verdade (dá pra ver que tem parede ali e o tiro bate): um pouco mais forte embaixo, reflexos em diagonal e friso em cima
  const HEAT_GLASS = canvasTex(128, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,196,150,.34)'); gr.addColorStop(0.5, 'rgba(255,170,120,.2)'); gr.addColorStop(1, 'rgba(255,140,90,.36)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
    g.strokeStyle = 'rgba(255,236,214,.28)'; g.lineWidth = 7; for (const x of [30, 52]) { g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 70, 0); g.stroke(); }
    g.fillStyle = 'rgba(255,226,196,.55)'; g.fillRect(0, 0, 128, 5);
  });
  HEAT_GLASS.wrapS = THREE.RepeatWrapping;
  const hazeM = new THREE.MeshBasicMaterial({ map: HEAT_GLASS, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const capM = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.7, metalness: 0.3 });
  for (const R of mapWalls) if (R.border) {
    const ph = 38, bh = (R.top != null ? R.top : P.borderH);
    const par = new THREE.Mesh(new THREE.BoxGeometry(R.w, ph, R.h), parM); par.position.set(R.x + R.w / 2, ph / 2, R.y + R.h / 2); par.castShadow = par.receiveShadow = true; mapGroup.add(par);
    const along = R.w > R.h, L = along ? R.w : R.h, hm = hazeM.clone(); hm.map = HEAT_GLASS.clone(); hm.map.repeat.set(Math.max(1, Math.round(L / 260)), 1); hm.map.needsUpdate = true;
    const hz = new THREE.Mesh(new THREE.BoxGeometry(R.w - 1, bh - ph - 1.5, R.h - 1), hm); hz.position.set(R.x + R.w / 2, ph + 1.5 + (bh - ph - 1.5) / 2, R.y + R.h / 2); mapGroup.add(hz); // (um pouco acima do murinho: não pisca)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(R.w + 4, 5, R.h + 4), capM); cap.position.set(R.x + R.w / 2, bh, R.y + R.h / 2); mapGroup.add(cap);
    for (let u = 0; u <= L + 1; u += 260) { const post = new THREE.Mesh(new THREE.BoxGeometry(7, bh - ph, 7), capM); post.position.set(along ? R.x + Math.min(u, L) : R.x + R.w / 2, ph + (bh - ph) / 2, along ? R.y + R.h / 2 : R.y + Math.min(u, L)); mapGroup.add(post); }
  }
  // pedras penduradas embaixo (ilha flutuando)
  const rnd = seeded(931);
  for (let i = 0; i < 46; i++) { // só perto da beirada (no meio ficaria na frente do buraco e tamparia a lava)
    const side = i % 4, u = rnd(), e = 20 + rnd() * 90;
    const x = side === 0 ? e : side === 1 ? W - e : u * W, z = side === 2 ? e : side === 3 ? H - e : u * H;
    const h = 70 + rnd() * 200, r = 40 + rnd() * 70; // (mais curtas: dá pra ver a boca do vulcão olhando pra baixo)
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), rock); c.rotation.x = Math.PI; c.position.set(x, -T - h / 2 + 4, z); mapGroup.add(c);
  }
  // o vulcão gigante lá embaixo: cratera ENORME (a boca), com paredes por dentro, lago de lava no fundo
  // e a encosta de fora descendo até a terra; o mapa fica bem em cima da boca
  const rug = (a, r) => 70 * Math.sin(a * 7 + r * 0.0011) + 45 * Math.sin(a * 13 - r * 0.0017) + 25 * Math.sin(a * 29 + r * 0.004);
  const CK = 0.9; // boca 10% mais estreita
  const PROF = [[1300 * CK, -1530], [1430 * CK, -1420], [1740 * CK, -1180], [2200 * CK, -930], [2600 * CK, -760], [2880 * CK, -690], [3180 * CK, -760], [4300, -1400], [6000, -2400], [8300, -3700], [11800, -5120]];
  const flankY = (r) => { for (let i = 1; i < PROF.length; i++) if (r <= PROF[i][0]) { const [r0, y0] = PROF[i - 1], [r1, y1] = PROF[i]; return y0 + (y1 - y0) * (r - r0) / (r1 - r0); } return PROF[PROF.length - 1][1]; };
  {
    const pts = []; for (let r = 1300 * CK; r <= 11800; r += r < 3500 ? 100 : 320) pts.push(new THREE.Vector2(r, flankY(r)));
    const lg = new THREE.LatheGeometry(pts, 96), lp = lg.attributes.position, cols = new Float32Array(lp.count * 3), c = new THREE.Color(), hot = new THREE.Color(0x8a2a0c), rockC = new THREE.Color(0x3d3029), dark = new THREE.Color(0x2a221e), lip = new THREE.Color(0x5a4a40);
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i), z = lp.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
      lp.setY(i, lp.getY(i) + rug(a, r) * (r < 1450 * CK ? 0.3 : 1));
      if (r < 2880 * CK) c.copy(hot).lerp(rockC, Math.min(1, (r - 1300 * CK) / 800)); // perto da lava a pedra fica avermelhada
      else if (r < 3300 * CK) c.copy(lip); else c.copy(rockC).lerp(dark, Math.min(1, (r - 3300) / 5000));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    lg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); lg.computeVertexNormals();
    // brilho da lava por dentro da boca (mais forte perto do lago, some antes da borda)
    const glowTex = canvasTex(8, 256, (g) => { const grd = g.createLinearGradient(0, 256, 0, 0); grd.addColorStop(0, 'rgba(255,140,40,1)'); grd.addColorStop(0.12, 'rgba(240,90,25,.9)'); grd.addColorStop(0.3, 'rgba(150,40,10,.5)'); grd.addColorStop(0.42, 'rgba(0,0,0,1)'); grd.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = '#000'; g.fillRect(0, 0, 8, 256); g.fillStyle = grd; g.fillRect(0, 0, 8, 256); });
    const vol = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: glowTex, emissiveIntensity: 1.5, fog: false })); vol.position.set(W / 2, 0, H / 2); mapGroup.add(vol);
  }
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1400 * CK, 72), volcano.lakeMat); lake.rotation.x = -Math.PI / 2; lake.position.set(W / 2, -1500, H / 2); mapGroup.add(lake);
  // rios de lava: fitas largas coladas na encosta (saem da borda da cratera e descendo, abrindo e fazendo curvas)
  const riverMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, fog: false,
    vertexShader: 'varying vec2 vUv; varying float vL; attribute float aL; void main(){ vUv = uv; vL = aL; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vL; ${NOISE_GLSL}
      void main(){
        float across = abs(vUv.y - 0.5) * 2.0;
        float n = fbm(vec2(vUv.y * 5.0, vL * 0.004 - uTime * 0.25)), m = fbm(vec2(vUv.y * 11.0 + 3.0, vL * 0.012 - uTime * 0.6));
        float core = 1.0 - smoothstep(0.15, 0.95, across + (n - 0.5) * 0.5);
        float crust = smoothstep(0.55, 0.75, m) * (0.4 + across * 0.6);
        vec3 c = mix(vec3(0.13, 0.05, 0.03), vec3(1.0, 0.34, 0.05), core);
        c = mix(c, vec3(1.0, 0.82, 0.35), core * core * smoothstep(0.4, 0.8, n));
        c = mix(c, vec3(0.1, 0.05, 0.04), crust * 0.8);
        c *= 1.0 + 0.8 * (1.0 - vUv.x); // mais quente perto da boca
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  volcano.riverMat = riverMat;
  for (let i = 0; i < 7; i++) {
    const a0 = i / 7 * Math.PI * 2 + rnd() * 0.5, N = 70, pos = [], uvs = [], al = [], idx = [];
    let L = 0, prev = null;
    for (let k = 0; k <= N; k++) {
      const u = k / N, r = 2800 * CK + u * 8400, a = a0 + Math.sin(u * 6 + i * 1.7) * 0.06 + Math.sin(u * 17 + i) * 0.015;
      const wdt = (40 + 150 * Math.pow(u, 0.7)) * (0.8 + 0.3 * Math.sin(u * 9 + i)); // estreito lá em cima, abre descendo
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = flankY(r) + rug(a, r) + 14;
      if (prev) L += Math.hypot(cx - prev[0], cy - prev[1], cz - prev[2]); prev = [cx, cy, cz];
      const sx = -Math.sin(a), sz = Math.cos(a); // de lado (na horizontal)
      for (const sd of [-1, 1]) { const px = cx + sx * wdt * sd, pz = cz + sz * wdt * sd, pr = Math.hypot(px, pz), pa = Math.atan2(pz, px); pos.push(px + W / 2, flankY(pr) + rug(pa, pr) + 14, pz + H / 2); uvs.push(u, sd < 0 ? 0 : 1); al.push(L); }
      if (k) { const b = (k - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('aL', new THREE.Float32BufferAttribute(al, 1)); g.setIndex(idx);
    const rv = new THREE.Mesh(g, riverMat); rv.frustumCulled = false; mapGroup.add(rv);
    rv.material.side = THREE.DoubleSide;
  }
  // lá embaixo, em volta do vulcão: terra, morros e o mar no horizonte
  const land = new THREE.Mesh(new THREE.CircleGeometry(30000, 64), new THREE.MeshStandardMaterial({ color: 0x4d5238, roughness: 1 })); land.rotation.x = -Math.PI / 2; land.position.set(W / 2, -5100, H / 2); mapGroup.add(land);
  const sea = new THREE.Mesh(new THREE.RingGeometry(20000, 60000, 64), new THREE.MeshStandardMaterial({ color: 0x2b5877, roughness: 0.3, metalness: 0.2 })); sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, -5095, H / 2); mapGroup.add(sea);
  { const hills = [], r4 = seeded(77); for (let i = 0; i < 70; i++) { const a = r4() * Math.PI * 2, d = 10500 + r4() * 9000, k = 400 + r4() * 1400; hills.push([W / 2 + Math.cos(a) * d, -5100, H / 2 + Math.sin(a) * d, k * 1.6, k * 0.7, k * 1.3, r4() * 3]); }
    instanced(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x566b3c, { roughness: 1 }), hills); }
  // céu de verdade (degradê), em vez daquele vermelho escuro
  const skyM = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {}, vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vW; void main(){ float h = vW.y; vec3 top = vec3(0.28, 0.36, 0.5), hor = vec3(0.86, 0.55, 0.36), low = vec3(0.35, 0.3, 0.28); vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.6)) : mix(hor, low, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0);\n #include <colorspace_fragment>\n }' });
  const skyS = new THREE.Mesh(new THREE.SphereGeometry(40000, 32, 16), skyM); skyS.position.set(W / 2, 0, H / 2); skyS.renderOrder = -1; mapGroup.add(skyS);
  // luz laranja vindo de baixo (a lava ilumina a laje e quem cai)
  const under = new THREE.DirectionalLight(0xff6a2a, 1.6); under.position.set(W / 2 + 300, -2200, H / 2 + 200); under.target.position.set(W / 2, 0, H / 2); mapGroup.add(under, under.target);
  // nuvens de cinza da erupção: 2 anéis de nuvem feitos no shader (fofas, se mexendo devagar, vermelhas por baixo com a luz
  // da lava) bem longe em volta, e um teto de cinza lá no alto. Ficam longe da boca, então olhando pra baixo o vulcão aparece.
  const clouds = new THREE.Group(); clouds.position.set(W / 2, 0, H / 2);
  const ashMat = (seed, dark) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uDark: { value: dark } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform float uSeed; uniform float uDark; varying vec2 vUv; ${NOISE_GLSL}
      float cl(vec2 p){ return fbm(p + vec2(uTime * 0.012, -uTime * 0.02)) * 0.65 + fbm(p * 2.3 - vec2(uTime * 0.03, 0.0)) * 0.35; }
      void main(){
        float u = vUv.x, v = vUv.y, K = 14.0;
        // sem emenda na volta: mistura as 2 pontas
        vec2 q = vec2(0.0, v * 3.2 + uSeed);
        float n = mix(cl(vec2(u * K, q.y)), cl(vec2((u - 1.0) * K, q.y)), u);
        float shape = smoothstep(0.0, 0.25, v) * (1.0 - smoothstep(0.55, 1.0, v)); // some embaixo e em cima (borda fofa)
        float a = smoothstep(0.38, 0.7, n + (shape - 0.55) * 0.9) * shape;
        float lit = smoothstep(0.45, 0.8, n); // parte de cima das nuvens mais clara, de baixo mais escura
        vec3 ash = mix(vec3(0.07, 0.06, 0.06), vec3(0.28, 0.25, 0.24), lit) * uDark;
        vec3 glow = vec3(0.85, 0.28, 0.08) * (1.0 - smoothstep(0.05, 0.45, v)) * 0.9; // lava iluminando por baixo
        gl_FragColor = vec4(ash + glow * (1.0 - lit * 0.6), a * 0.92);
        #include <colorspace_fragment>
      }` });
  volcano.ashMats = [];
  for (const [R, y0, h, seed, dk] of [[4300, -900, 2600, 1.3, 1.0], [6400, -1400, 3600, 7.1, 0.8]]) {
    const m = ashMat(seed, dk), ring = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.05, h, 72, 1, true), m);
    ring.position.y = y0 + h / 2; ring.renderOrder = 2; clouds.add(ring); volcano.ashMats.push(m);
  }
  { // teto de cinza lá no alto (bem fechado longe, aberto em cima do mapa)
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vP; ${NOISE_GLSL}
        void main(){ float r = length(vP); float n = fbm(vP * 0.00032 + vec2(uTime * 0.006, uTime * 0.004));
          float a = smoothstep(0.35, 0.75, n) * smoothstep(2600.0, 6000.0, r) * (1.0 - smoothstep(14000.0, 18000.0, r));
          gl_FragColor = vec4(mix(vec3(0.09, 0.07, 0.07), vec3(0.22, 0.19, 0.18), n), a * 0.85);
          #include <colorspace_fragment>
        }` });
    const deck = new THREE.Mesh(new THREE.CircleGeometry(18000, 64), m); deck.rotation.x = -Math.PI / 2; deck.position.y = 2600; clouds.add(deck); volcano.ashMats.push(m);
  }
  mapGroup.add(clouds); volcano.clouds = clouds;
  rebuildVolcanoHoles([]);
}
function rebuildVolcanoHoles(holes) {
  const V = volcano; if (!V) return;
  if (V.holeGroup) { mapGroup.remove(V.holeGroup); V.holeGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const g = new THREE.Group(), T = HOLE.depth, W = V.W, H = V.H;
  const top = new THREE.Mesh(slabShape(holes, W, H, false), new THREE.MeshStandardMaterial({ map: V.groundTex, roughness: 0.95 }));
  top.receiveShadow = true; g.add(top);
  const bottom = new THREE.Mesh(slabShape(holes, W, H, true), new THREE.MeshStandardMaterial({ color: 0x3a2822, roughness: 1 }));
  bottom.position.y = -T; g.add(bottom);
  lavaFx = [];
  const shaftEmis = canvasTex(8, 128, (c) => { const grd = c.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#120300'); grd.addColorStop(0.6, '#5a1400'); grd.addColorStop(1, '#ff6a18'); c.fillStyle = grd; c.fillRect(0, 0, 8, 128); });
  const N = 48;
  for (const h of holes) {
    const M = 3, verts = [], uvs = [], idx = [];
    for (let j = 0; j <= M; j++) for (let k = 0; k <= N; k++) {
      const a = k / N * Math.PI * 2, t = j / M, r = holeEdgeR(h, a) * (1 + 0.04 * Math.sin(a * 7 + j * 2.1) * t);
      verts.push(h.x + Math.cos(a) * r, -T * t, h.z + Math.sin(a) * r); uvs.push(k / N, 1 - t);
    }
    for (let j = 0; j < M; j++) for (let k = 0; k < N; k++) { const a = j * (N + 1) + k, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); sg.setIndex(idx); sg.computeVertexNormals();
    g.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x5a3a2c, roughness: 1, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: shaftEmis, emissiveIntensity: 1.4, flatShading: true })));
    // borda queimada brilhando em volta do buraco
    const glow = new THREE.Mesh(new THREE.RingGeometry(h.r * 0.98, h.r * 1.55, 40), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(h.x, 0.8, h.z); g.add(glow);
    const light = new THREE.PointLight(0xff6a1f, 22000, 360, 2); light.position.set(h.x, -40, h.z); g.add(light);
    const heat = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff5a1f, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    heat.scale.set(h.r * 2.6, h.r * 1.3, 1); heat.position.set(h.x, 14, h.z); g.add(heat);
    const rnd = seeded((h.seed || 1) + h.m * 7 + 3), rk = mat(0x3a2a24);
    for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, r = holeEdgeR(h, a) + 6 + rnd() * 16; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + rnd() * 7, 0), rk); s.position.set(h.x + Math.cos(a) * r, 2, h.z + Math.sin(a) * r); s.rotation.set(rnd() * 3, rnd() * 3, 0); s.castShadow = s.receiveShadow = true; g.add(s); }
    const NE = 30, ep = new Float32Array(NE * 3), eSeed = [];
    for (let i = 0; i < NE; i++) eSeed.push([rnd() * Math.PI * 2, Math.sqrt(rnd()) * h.r * 0.85, rnd(), 0.5 + rnd()]);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    const embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: GLOW_TEX, color: 0xffa040, size: 7, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    embers.frustumCulled = false; g.add(embers);
    lavaFx.push({ h, light, glow, embers, eSeed });
  }
  mapGroup.add(g); V.holeGroup = g; V.holeCount = holes.length;
}
// aviso de erupção: o chão racha e brilha nos 2 lugares antes do fogo furar
const CRACK_TEX = canvasTex(256, 256, (g) => {
  const rnd = seeded(61); g.strokeStyle = 'rgba(255,170,60,1)'; g.lineCap = 'round';
  for (let i = 0; i < 16; i++) { let x = 128, y = 128, a = rnd() * Math.PI * 2; g.lineWidth = 5 - i * 0.2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); } g.stroke(); }
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128); grd.addColorStop(0, 'rgba(255,120,30,.55)'); grd.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
});
function updateEruptWarn(E, now) {
  const V = volcano; if (!V) return;
  if (!E) { for (const m of V.warn) mapGroup.remove(m); V.warn = []; return; }
  if (!V.warn.length) for (const [x, z] of E.pts) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(E.r * 1.25, 32), new THREE.MeshBasicMaterial({ map: CRACK_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 1.2, z); mapGroup.add(m); V.warn.push(m);
  }
  for (const m of V.warn) { m.material.opacity = 0.55 + Math.sin(now / 70) * 0.45; m.rotation.z += 0.01; }
}
// erupção: a lava sobe de baixo pra cima atravessando o chão (quebra a laje), espirra, cai de volta e fica o buraco
const FLAME_TEX = canvasTex(64, 256, (g) => { const grd = g.createLinearGradient(0, 256, 0, 0); grd.addColorStop(0, 'rgba(255,240,180,1)'); grd.addColorStop(0.35, 'rgba(255,140,40,.95)'); grd.addColorStop(0.75, 'rgba(255,60,10,.5)'); grd.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 256); });
// (mais leve: o material da lava e a "coroa" são feitos uma vez só; pedaços e gotas são 1 desenho cada)
let _eruptMat = null; const _crownGeo = new Map(), _chunkGeo = new THREE.DodecahedronGeometry(1, 0);
function eruptCrown(r) {
  const k = Math.round(r / 5) * 5; if (_crownGeo.has(k)) return _crownGeo.get(k);
  const g = new THREE.CylinderGeometry(k * 1.45, k * 0.85, 1, 30, 6, true), cp = g.attributes.position, seedA = (k * 0.37) % 10;
  for (let i = 0; i < cp.count; i++) { // borda de cima em pontas irregulares (respingo), laterais onduladas
    const px = cp.getX(i), py = cp.getY(i) + 0.5, pz = cp.getZ(i), a = Math.atan2(pz, px);
    const spike = py > 0.99 ? 0.35 + 0.65 * Math.abs(Math.sin(a * 7 + seedA)) * (0.6 + 0.4 * Math.sin(a * 3 - seedA)) : py;
    const wob = 1 + 0.12 * Math.sin(a * 5 + py * 6 + seedA); cp.setXYZ(i, px * wob, spike - 0.5, pz * wob);
  }
  g.computeVertexNormals(); _crownGeo.set(k, g); return g;
}
function eruptFx(x, z, r, now, dur) {
  // explosão de lava: o chão estoura de baixo pra cima numa "coroa" de lava irregular (larga e baixa, cheia de pontas),
  // com gotas e pedaços do chão voando; depois tudo cai de volta e fica o buraco
  if (!_eruptMat) _eruptMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 0.025 } }, vertexShader: LAVA_VERT_W, fragmentShader: LAVA_FRAG, fog: false, side: THREE.DoubleSide });
  const lavaMat = _eruptMat, crownGeo = eruptCrown(r), crowns = [];
  for (const k of [1, 0.62]) { const c = new THREE.Mesh(crownGeo, lavaMat); c.position.set(x, 0, z); c.scale.set(k, 1, k); c.rotation.y = k * 2 + Math.random() * 3; c.visible = false; scene.add(c); crowns.push(c); }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(r * 1.02, 32), lavaMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x, -40, z); scene.add(pool);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff6a1f, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(r * 6, r * 4, 1); glow.position.set(x, 60, z); scene.add(glow);
  // luz da erupção: sempre as mesmas 2 luzes (criar luz nova travava o jogo)
  const light = ERUPT_LIGHTS[(eruptLightTurn++) % 2]; light.position.set(x, 80, z);
  // pedaços do chão (um desenho só) e gotas de lava (pontinhos que brilham, um desenho só)
  const NC = 14, ND = 40, cv = [], dv = [], o3 = new THREE.Object3D();
  const chunks = new THREE.InstancedMesh(_chunkGeo, mat(0x3a2a24), NC); chunks.visible = false; scene.add(chunks);
  for (let i = 0; i < NC; i++) { const a = Math.random() * Math.PI * 2, d = r * (0.3 + Math.random() * 0.7); cv.push({ p: [x + Math.cos(a) * d, 2, z + Math.sin(a) * d], v: [Math.cos(a) * (80 + Math.random() * 200), 300 + Math.random() * 380, Math.sin(a) * (80 + Math.random() * 200)], s: 5 + Math.random() * 11, r: 0, sp: Math.random() * 8 }); }
  const dp = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) { const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 300, q = Math.random() * r * 0.5; dv.push({ v: [Math.cos(a) * sp, 250 + Math.random() * 450, Math.sin(a) * sp], d: Math.random() * 0.25 }); dp.set([x + Math.cos(a) * q, -500, z + Math.sin(a) * q], i * 3); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const drops = new THREE.Points(dg, new THREE.PointsMaterial({ map: FIRE_TEX, size: 24, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff })); drops.frustumCulled = false; scene.add(drops);
  const dStart = dv.map((q, i) => [dp[i * 3], 0, dp[i * 3 + 2]]);
  const smoke = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0x2a1c16, transparent: true, opacity: 0, depthWrite: false })); s.position.set(x + (Math.random() - 0.5) * r, 20, z + (Math.random() - 0.5) * r); s.scale.setScalar(r * 2.4); s.userData.vy = 60 + Math.random() * 80; scene.add(s); smoke.push(s); }
  effects.push({ t0: now, d: dur || 2600, objs: [...crowns, pool, glow, chunks, drops, ...smoke], end: () => { pool.geometry.dispose(); glow.material.dispose(); chunks.material.dispose(); chunks.dispose(); dg.dispose(); drops.material.dispose(); for (const q of smoke) q.material.dispose(); }, upd: (t, dt) => {
    lavaMat.uniforms.uTime.value = now / 1000 + t * 3;
    // estoura rápido (0 -> 0,18), espirra e desaba (0,18 -> 0,6); a poça fica borbulhando e desce
    const burst = t < 0.18 ? Math.sin(t / 0.18 * Math.PI / 2) : Math.max(0, 1 - (t - 0.18) / 0.42);
    crowns.forEach((c, k) => { c.visible = burst > 0.02; const h = (k ? 190 : 120) * burst; c.scale.y = Math.max(0.5, h); c.position.y = h / 2 - 6; const w = 1 + (1 - burst) * 0.35; c.scale.x = c.scale.z = (k ? 0.62 : 1) * w; });
    pool.position.y = t < 0.15 ? -40 + t / 0.15 * 38 : -2 - Math.max(0, t - 0.5) * 120;
    glow.material.opacity = 0.85 * Math.max(0, 1 - t * 1.2); light.intensity = 80000 * Math.max(0, 1 - t * 1.4);
    if (t > 0.05) {
      chunks.visible = true;
      cv.forEach((c, i) => { c.v[1] -= 1300 * dt; c.p[0] += c.v[0] * dt; c.p[1] += c.v[1] * dt; c.p[2] += c.v[2] * dt; c.r += c.sp * dt; o3.position.set(c.p[0], c.p[1], c.p[2]); o3.rotation.set(c.r, c.r * 0.7, 0); o3.scale.setScalar(c.s); o3.updateMatrix(); chunks.setMatrixAt(i, o3.matrix); });
      chunks.instanceMatrix.needsUpdate = true;
      dv.forEach((q, i) => { if (t < 0.05 + q.d) return; if (dp[i * 3 + 1] < -400) { dp[i * 3] = dStart[i][0]; dp[i * 3 + 1] = 0; dp[i * 3 + 2] = dStart[i][2]; } q.v[1] -= 1100 * dt; dp[i * 3] += q.v[0] * dt; dp[i * 3 + 1] = Math.max(-60, dp[i * 3 + 1] + q.v[1] * dt); dp[i * 3 + 2] += q.v[2] * dt; });
      dg.attributes.position.needsUpdate = true; drops.material.opacity = Math.max(0, 1 - t);
      for (const s of smoke) { s.position.y += s.userData.vy * dt; s.material.opacity = 0.6 * Math.sin(Math.min(1, t) * Math.PI); s.scale.multiplyScalar(1 + dt * 0.6); }
    }
  } });
}

// ---------- furacão da floresta: vento girando (faixas finas), largo embaixo, afina e abre lá em cima ----------
const TW_H = 640;
const twProf = (u) => TORNADO.r * (1 - 0.55 * Math.sin(Math.min(u / 0.35, 1) * Math.PI / 2)) + TORNADO.r * 1.25 * Math.pow(Math.max(0, (u - 0.25) / 0.75), 1.6);
let tornadoFx = null;
// furacão: funil de vento feito no shader (faixas de ar girando e subindo, bem transparente, mais forte só na silhueta),
// poeira fofa girando no pé e folhas voando. Sem linhas finas (de longe ficavam riscos).
const TW_VERT = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }';
const TW_FRAG = `uniform float uTime; uniform float uOp; uniform float uSpin; uniform float uSeed; varying vec2 vUv; varying vec3 vN; varying vec3 vV; ${NOISE_GLSL}
float band(float a, float h){ float s = h * 3.0 - uTime * 0.9 + uSeed; return fbm(vec2(a * 8.0 + h * 5.0 - uTime * uSpin, s)); }
void main(){
  float a = vUv.x, h = vUv.y;
  float n = mix(band(a, h), band(a - 1.0, h), a); // sem emenda na volta
  float streak = smoothstep(0.48, 0.78, n);
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
  float fade = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.72, 1.0, h));
  float al = (0.05 + 0.68 * streak) * (0.3 + 0.7 * rim) * fade * uOp;
  vec3 col = mix(vec3(0.62, 0.6, 0.55), vec3(0.9, 0.9, 0.86), streak);
  gl_FragColor = vec4(col, al);
  #include <colorspace_fragment>
}`;
function makeTornadoFx() {
  const g = new THREE.Group(), R = TORNADO.r;
  const pts = []; for (let i = 0; i <= 32; i++) { const u = i / 32; pts.push(new THREE.Vector2(twProf(u), u * TW_H)); }
  const shells = [];
  for (const [k, spin, seed] of [[1, 2.2, 0], [0.8, 3.1, 4.3], [0.62, 4.0, 9.1]]) { // 3 camadas girando em velocidades diferentes
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: TW_VERT, fragmentShader: TW_FRAG,
      uniforms: { uTime: { value: 0 }, uOp: { value: 1 }, uSpin: { value: spin }, uSeed: { value: seed } } });
    const sh = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), m); sh.scale.set(k, 1, k); sh.renderOrder = 3; g.add(sh); shells.push(sh);
  }
  // poeira fofa girando no pé do furacão (manchas macias, não riscos)
  const ND = 46, dp = new Float32Array(ND * 3), dseed = [];
  for (let i = 0; i < ND; i++) dseed.push([Math.random() * Math.PI * 2, 0.45 + Math.random() * 0.7, Math.random() * 90, 0.6 + Math.random() * 0.8]);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: SMOKE_TEX, color: 0xb9ab8e, size: 70, transparent: true, opacity: 0.16, depthWrite: false }));
  dust.frustumCulled = false; g.add(dust);
  const NL = 60, lp = new Float32Array(NL * 3), lseed = [];
  for (let i = 0; i < NL; i++) lseed.push([Math.random() * Math.PI * 2, Math.random(), 0.6 + Math.random() * 0.8]);
  const leafG = new THREE.BufferGeometry(); leafG.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const leaves = new THREE.Points(leafG, new THREE.PointsMaterial({ color: 0x5f7f3a, size: 5, transparent: true, opacity: 0.85, depthWrite: false }));
  leaves.frustumCulled = false; g.add(leaves);
  const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.7, R * 1.02, 48), new THREE.MeshBasicMaterial({ map: SMOKE_TEX, color: 0xb8a98c, transparent: true, opacity: 0.1, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 1.2; g.add(ring);
  scene.add(g);
  return { g, shells, dust, dseed, leaves, lseed, ring };
}
function updateTornadoFx(T, now, dt) {
  if (!T) { if (tornadoFx) { scene.remove(tornadoFx.g); tornadoFx = null; } return; }
  if (!tornadoFx) tornadoFx = makeTornadoFx();
  const F = tornadoFx, grow = T.s === 2 ? 1 : 0.15 + 0.85 * T.k, ts = now / 1000, R = TORNADO.r;
  F.g.position.set(T.x, 0, T.z); F.g.scale.set(grow, grow, grow);
  // de longe fica mais fraquinho (não vira uma mancha marcando)
  const far = Math.hypot(camera.position.x - T.x, camera.position.z - T.z), op = Math.max(0.4, Math.min(1, 1 - (far - 700) / 2600)) * (T.s === 2 ? 1 : 0.5 + 0.5 * T.k);
  for (const sh of F.shells) { sh.material.uniforms.uTime.value = ts; sh.material.uniforms.uOp.value = op; }
  const dp = F.dust.geometry.attributes.position.array;
  for (let i = 0; i < F.dseed.length; i++) { const [a0, rk, y, sp] = F.dseed[i], a = a0 - ts * 4.5 * sp, r = R * rk * (0.9 + 0.1 * Math.sin(ts * 2 + i)); dp[i * 3] = Math.cos(a) * r; dp[i * 3 + 1] = 10 + (y + ts * 25 * sp) % 90; dp[i * 3 + 2] = Math.sin(a) * r; }
  F.dust.geometry.attributes.position.needsUpdate = true; F.dust.material.opacity = 0.16 * op;
  const lp = F.leaves.geometry.attributes.position.array;
  for (let i = 0; i < F.lseed.length; i++) {
    const [a, h, sp] = F.lseed[i], u = ((h + ts * 0.18 * sp) % 1) * 0.6, ang = a - ts * 5 * sp, r = twProf(u) * 0.9;
    lp[i * 3] = Math.cos(ang) * r; lp[i * 3 + 1] = u * TW_H; lp[i * 3 + 2] = Math.sin(ang) * r;
  }
  F.leaves.geometry.attributes.position.needsUpdate = true;
  F.ring.rotation.z += dt * 3;
}

// ---------- neve: tempestade congelante (faixa de vento gelado que corta o mapa de ponta a ponta) ----------
const FROST_TEX = canvasTex(128, 512, (g) => {
  const rnd = seeded(29); g.clearRect(0, 0, 128, 512);
  for (let i = 0; i < 140; i++) { const x = rnd() * 128, y = rnd() * 512, l = 20 + rnd() * 90; g.fillStyle = `rgba(230,245,255,${0.15 + rnd() * 0.5})`; g.fillRect(x, y, 1 + rnd() * 2, l); }
  g.fillStyle = 'rgba(200,230,255,.18)'; g.fillRect(0, 0, 128, 512);
}, true);
let stormFx = null;
function makeStormFx(S) {
  const H = mapInfo.H, g = new THREE.Group(), w = S.w;
  const t = FROST_TEX.clone(); t.needsUpdate = true; t.repeat.set(1, H / 400);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, H), new THREE.MeshBasicMaterial({ map: t, color: 0xdff2ff, transparent: true, opacity: 0, depthWrite: false }));
  strip.rotation.x = -Math.PI / 2; strip.position.set(0, 1.6, H / 2); g.add(strip);
  const edges = [];
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(5, H), new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, depthWrite: false })); e.rotation.x = -Math.PI / 2; e.position.set(sx * w, 1.9, H / 2); g.add(e); edges.push(e); }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 300, H), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  wall.position.set(0, 150, H / 2); g.add(wall);
  const N = 900, arr = new Float32Array(N * 6), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([(Math.random() * 2 - 1) * w, 4 + Math.random() * 270, Math.random() * H, 40 + Math.random() * 90, 900 + Math.random() * 800]);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0, depthWrite: false }));
  streaks.frustumCulled = false; g.add(streaks);
  const NF = 700, fp = new Float32Array(NF * 3), fseed = [];
  for (let i = 0; i < NF; i++) fseed.push([(Math.random() * 2 - 1) * w, 2 + Math.random() * 280, Math.random() * H, 500 + Math.random() * 600, Math.random() * 6]);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flakes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 3, transparent: true, opacity: 0, depthWrite: false }));
  flakes.frustumCulled = false; g.add(flakes);
  // rajadas de neve (nuvenzinhas bem transparentes sendo levadas pelo vento)
  const puffs = []; for (let i = 0; i < 36; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0xf4fbff, transparent: true, opacity: 0, depthWrite: false })); sp.userData.q = [(Math.random() * 2 - 1) * w * 0.8, 30 + Math.random() * 200, Math.random() * H, 700 + Math.random() * 500, 0.08 + Math.random() * 0.1]; sp.scale.set(160 + Math.random() * 140, 90 + Math.random() * 80, 1); g.add(sp); puffs.push(sp); }
  g.position.x = S.x; scene.add(g);
  return { g, strip, edges, wall, streaks, seeds, flakes, fseed, puffs, x: S.x };
}
function updateStormFx(S, now, dt) {
  if (!S) { if (stormFx) { scene.remove(stormFx.g); stormFx = null; } return; }
  if (stormFx && stormFx.x !== S.x) { scene.remove(stormFx.g); stormFx = null; }
  if (!stormFx) stormFx = makeStormFx(S);
  const F = stormFx, warn = S.s === 1, ts = now / 1000, H = mapInfo.H, dir = S.dir || 1;
  F.strip.material.opacity = warn ? 0.15 + (Math.sin(now / 110) * 0.5 + 0.5) * 0.2 : 0.12;
  for (const e of F.edges) e.material.opacity = warn ? (Math.floor(now / 160) % 2 ? 0.9 : 0.3) : 0.6;
  F.strip.material.map.offset.y -= dt * dir * (warn ? 0.3 : 2.2);
  F.wall.material.opacity = warn ? 0.01 * S.k : 0.03; // bem mais transparente: parece nevasca, não parede
  F.streaks.material.opacity = warn ? 0.1 * S.k : 0.3; F.flakes.material.opacity = warn ? 0.25 * S.k : 0.75;
  for (const sp of F.puffs) { const q = sp.userData.q; q[2] = (q[2] + dir * q[3] * dt * (warn ? 0.15 : 1) + H) % H; sp.position.set(q[0] + Math.sin(ts * 1.3 + q[1]) * 20, q[1], q[2]); sp.material.opacity = warn ? q[4] * 0.3 * S.k : q[4]; }
  const a = F.streaks.geometry.attributes.position.array;
  for (let i = 0; i < F.seeds.length; i++) {
    const q = F.seeds[i]; q[2] = (q[2] + dir * q[4] * dt * (warn ? 0.15 : 1) + H) % H;
    a[i * 6] = q[0]; a[i * 6 + 1] = q[1]; a[i * 6 + 2] = q[2]; a[i * 6 + 3] = q[0]; a[i * 6 + 4] = q[1] - 3; a[i * 6 + 5] = q[2] - dir * q[3];
  }
  F.streaks.geometry.attributes.position.needsUpdate = true;
  const fp = F.flakes.geometry.attributes.position.array;
  for (let i = 0; i < F.fseed.length; i++) {
    const q = F.fseed[i]; q[2] = (q[2] + dir * q[3] * dt * (warn ? 0.15 : 1) + H) % H;
    fp[i * 3] = q[0] + Math.sin(ts * 3 + q[4]) * 10; fp[i * 3 + 1] = q[1] + Math.sin(ts * 2 + q[4] * 2) * 12; fp[i * 3 + 2] = q[2];
  }
  F.flakes.geometry.attributes.position.needsUpdate = true;
}

// ---------- base na Lua (mapa "nave") ----------
// cidade à noite: prédios e casas em volta do mapa, com algumas janelas acesas (a maioria apagada)
function buildCityOutside(W, H) {
  // prédios: poucas janelas acesas (metade de antes); casas: poucas janelas grandes. Materiais compartilhados (leve)
  const mkTex = (p, v, house) => {
    const draw = (emis) => (g, w, h) => {
      g.fillStyle = emis ? '#000' : (house ? ['#2a2320', '#1f2226', '#26211c', '#23262b'] : ['#1a1d24', '#20232b', '#191b20', '#23201d'])[v]; g.fillRect(0, 0, w, h);
      const r2 = seeded(4400 + v * 17 + (house ? 91 : 0)), sx = house ? 128 : 28, sy = house ? 256 : 32, ww = house ? 40 : 16, wh = house ? 56 : 20;
      for (let y = house ? 100 : 10; y < h - 8; y += sy) for (let x = house ? 44 : 8; x < w - 8; x += sx) {
        const lit = r2() < p, warm = r2() < 0.75;
        g.fillStyle = lit ? (warm ? '#ffcf7a' : '#bfe3ff') : emis ? '#000' : '#0c0e13';
        if (lit && emis) g.globalAlpha = 0.6 + r2() * 0.4;
        g.fillRect(x, y, ww, wh); g.globalAlpha = 1;
      }
    };
    return new THREE.MeshStandardMaterial({ map: canvasTex(256, 512, draw(false), true), emissiveMap: canvasTex(256, 512, draw(true), true), emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.9 });
  };
  const roofM = mat(0x121418), houseRoof = mat(0x2a1c18), redM = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const bMats = [0.015, 0.04, 0.07, 0.12].map((p, v) => mkTex(p, v, false)), hMats = [0.25, 0.4, 0.15, 0.3].map((p, v) => mkTex(p, v, true));
  const rnd = seeded(707);
  const put = (x, z, w, d, h, house) => {
    const side = (house ? hMats : bMats)[Math.floor(rnd() * 4)];
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) { const sx = (f < 2 ? d : w) / 256, sy = h / 512; for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); } }
    const b = new THREE.Mesh(geo, [side, side, roofM, roofM, side, side]); b.position.set(x, h / 2, z); mapGroup.add(b);
    if (house) { const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 70, 4), houseRoof); r.position.set(x, h + 35, z); r.rotation.y = Math.PI / 4; r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); mapGroup.add(r); }
    else if (h > 500 && rnd() < 0.5) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 90, 5), roofM); ant.position.set(x, h + 45, z); mapGroup.add(ant); const l = new THREE.Mesh(new THREE.SphereGeometry(5, 6, 4), redM); l.position.set(x, h + 92, z); mapGroup.add(l); }
  };
  // casas baixas logo depois do muro e prédios cada vez mais altos lá atrás
  scatterOutside(W, H, 30, 160, 520, 91, (x, z) => put(x, z, 150 + rnd() * 120, 130 + rnd() * 100, 110 + rnd() * 90, true));
  scatterOutside(W, H, 40, 560, 1700, 92, (x, z, r2, d) => put(x, z, 220 + rnd() * 260, 200 + rnd() * 220, 260 + rnd() * 500 + d * 0.35, false));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 1 })); road.rotation.x = -Math.PI / 2; road.position.set(W / 2, -1.5, H / 2); mapGroup.add(road);
}
function buildMoonOutside(W, H) {
  const reg = canvasTex(1024, 1024, (g, w, h) => {
    const rnd = seeded(808);
    g.fillStyle = '#8d8f93'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const l = 110 + Math.floor(rnd() * 60); g.fillStyle = `rgba(${l},${l},${l + 4},.35)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 4); }
    for (let i = 0; i < 70; i++) { // crateras
      const x = rnd() * w, y = rnd() * h, r = 6 + Math.pow(rnd(), 2) * 60;
      const grd = g.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
      grd.addColorStop(0, 'rgba(60,60,64,.55)'); grd.addColorStop(0.8, 'rgba(90,90,94,.3)'); grd.addColorStop(0.92, 'rgba(200,200,205,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, true);
  reg.repeat.set(12, 12);
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshStandardMaterial({ map: reg, roughness: 1, color: 0xb9bbc0 }));
  moon.rotation.x = -Math.PI / 2; moon.position.set(W / 2, -1.2, H / 2); moon.receiveShadow = true;
  mapGroup.add(moon);
  const rnd = seeded(515), grey = mat(0x9a9ca1), dark = mat(0x6d6f74);
  for (let i = 0; i < 60; i++) { // bordas de cratera
    const a = rnd() * Math.PI * 2, d = 1100 + rnd() * 5500, R = 60 + Math.pow(rnd(), 2) * 520;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.16, 5, 22), grey);
    rim.rotation.x = -Math.PI / 2; rim.scale.z = 0.35; rim.position.set(W / 2 + Math.cos(a) * d, 0, H / 2 + Math.sin(a) * d);
    rim.receiveShadow = rim.castShadow = true; mapGroup.add(rim);
  }
  for (let i = 0; i < 80; i++) { // pedras
    const a = rnd() * Math.PI * 2, d = 950 + rnd() * 3000, s = 8 + Math.pow(rnd(), 3) * 90;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rnd() < 0.5 ? grey : dark);
    r.position.set(W / 2 + Math.cos(a) * d, s * 0.3, H / 2 + Math.sin(a) * d); r.rotation.set(rnd() * 3, rnd() * 3, 0); r.castShadow = true; mapGroup.add(r);
  }
  for (let i = 0; i < 22; i++) { // serras em volta (dá pra ver pelas janelas)
    const a = i / 22 * Math.PI * 2 + rnd() * 0.3, d = 2300 + rnd() * 2600;
    const m = new THREE.Mesh(new THREE.ConeGeometry(500 + rnd() * 900, 380 + rnd() * 700, 7), rnd() < 0.5 ? grey : dark);
    m.position.set(W / 2 + Math.cos(a) * d, 100, H / 2 + Math.sin(a) * d); m.rotation.y = rnd() * 3; mapGroup.add(m);
  }
  // a Terra no céu
  const earthTex = canvasTex(512, 256, (g, w, h) => {
    const r2 = seeded(3);
    g.fillStyle = '#1f5fa8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = r2() < 0.7 ? '#3f7d3a' : '#a58a5a'; g.beginPath(); g.ellipse(r2() * w, 40 + r2() * (h - 80), 14 + r2() * 50, 8 + r2() * 30, r2() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#eef6ff'; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 16, w, 16);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(r2() * w, r2() * h, 20 + r2() * 60, 4 + r2() * 8, r2() * 0.6, 0, 7); g.fill(); }
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(420, 40, 24), new THREE.MeshStandardMaterial({ map: earthTex, emissive: 0xffffff, emissiveMap: earthTex, emissiveIntensity: 0.35, roughness: 0.8, fog: false }));
  earth.position.set(W / 2 + 2600, 2900, H / 2 - 5400); earth.rotation.set(0.3, 2.2, 0.2); mapGroup.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 18), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.18, side: THREE.BackSide, fog: false }));
  atm.position.copy(earth.position); mapGroup.add(atm);
  // estrelas (bem longe, atrás das serras)
  const pts = [], rs = seeded(9);
  for (let i = 0; i < 3000; i++) { const a = rs() * Math.PI * 2, b = rs() * Math.PI * 0.5, r = 7600; pts.push(W / 2 + Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, H / 2 + Math.sin(a) * Math.cos(b) * r); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  mapGroup.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
  // vigas de metal segurando o teto de vidro
  const beam = mat(0x5b6472, { metalness: 0.6, roughness: 0.4 });
  for (const x of [W * 0.25, W * 0.5, W * 0.75]) { const b = new THREE.Mesh(new THREE.BoxGeometry(18, 14, H), beam); b.position.set(x, CEILING_Y.nave + 7, H / 2); b.castShadow = true; mapGroup.add(b); }
  for (const z of [H * 0.33, H * 0.66]) { const b = new THREE.Mesh(new THREE.BoxGeometry(W, 12, 14), beam); b.position.set(W / 2, CEILING_Y.nave + 6, z); b.castShadow = true; mapGroup.add(b); }
}

// ---------- floresta: árvores grandes (nas pontas das paredes e em volta do mapa) ----------
// árvore alta: tronco comprido e a copa lá em cima (não tampa a visão de quem está no chão)
function addTree(x, z, k, group) {
  const h = TREE.top + 20, trunk = new THREE.Mesh(new THREE.CylinderGeometry(7 * k, 12 * k, h * k, 9), mat(0x4a3220));
  trunk.position.set(x, h * k / 2, z);
  const leafA = mat(0x3f7d3a), leafB = mat(0x356b31), y0 = (h - 5) * k;
  const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(58 * k, 1), leafA); c1.position.set(x, y0 + 40 * k, z);
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(46 * k, 1), leafB); c2.position.set(x + 30 * k, y0 + 58 * k, z - 18 * k);
  const c3 = new THREE.Mesh(new THREE.IcosahedronGeometry(40 * k, 1), leafA); c3.position.set(x - 28 * k, y0 + 66 * k, z + 16 * k);
  for (const m of [trunk, c1, c2, c3]) { m.castShadow = m.receiveShadow = true; group.add(m); }
}
// mata fechada em volta do mapa: muitas árvores leves (instanciadas) tampando a visão de fora
function scatterOutside(W, H, n, near, far, seed, fn) {
  const rnd = seeded(seed);
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const d = near + Math.pow(rnd(), 1.4) * (far - near), side = rnd() * (W + H) * 2;
    let x, z;
    if (side < W) { x = side; z = -d; } else if (side < W * 2) { x = side - W; z = H + d; } else if (side < W * 2 + H) { x = -d; z = side - W * 2; } else { x = W + d; z = side - W * 2 - H; }
    x += (rnd() - 0.5) * 80; z += (rnd() - 0.5) * 80;
    if (x > -near && x < W + near && z > -near && z < H + near) continue;
    fn(x, z, rnd, d); i++;
  }
}
function instanced(geo, material, list, shadow) {
  const m = new THREE.InstancedMesh(geo, material, list.length), o = new THREE.Object3D();
  list.forEach((t, i) => { o.position.set(t[0], t[1], t[2]); o.scale.set(t[3], t[4], t[5]); o.rotation.set(0, t[6] || 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.castShadow = !!shadow; m.receiveShadow = true; mapGroup.add(m); return m;
}
function buildForestOutside(W, H) {
  const far = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000), new THREE.MeshStandardMaterial({ color: 0x4f7f40, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -0.6, H / 2); far.receiveShadow = true; mapGroup.add(far);
  const trunks = [], round = [], pine = [];
  scatterOutside(W, H, 620, 40, 1500, 612, (x, z, rnd) => {
    const k = 0.9 + rnd() * 0.9, h = 230 * k;
    trunks.push([x, h / 2, z, k, h, k]);
    if (rnd() < 0.5) round.push([x, h + 30 * k, z, 70 * k, 60 * k, 70 * k, rnd() * 3]);
    else pine.push([x, h * 0.55 + 90 * k, z, 62 * k, 260 * k, 62 * k, rnd() * 3]);
  });
  instanced(new THREE.CylinderGeometry(6, 10, 1, 6), mat(0x4a3220), trunks);
  instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x3a7434), round);
  instanced(new THREE.ConeGeometry(1, 1, 7), mat(0x2f5f2c), pine);
  // arbustos na beirada de fora
  const bush = []; scatterOutside(W, H, 300, 30, 400, 77, (x, z, rnd) => { const k = 30 + rnd() * 40; bush.push([x, k * 0.4, z, k, k * 0.7, k]); });
  instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x35682f), bush);
}
// neve: pinheiros cobertos de neve, pedras de gelo e montanhas brancas em volta
function buildSnowOutside(W, H) {
  const far = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000), new THREE.MeshStandardMaterial({ color: 0xeef4fa, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -0.6, H / 2); far.receiveShadow = true; mapGroup.add(far);
  const trunks = [], cones = [], caps = [], ice = [];
  scatterOutside(W, H, 560, 190, 1600, 913, (x, z, rnd) => { // pinheiros longe da borda (os galhos não entram no mapa)
    const k = 0.8 + rnd() * 0.9;
    trunks.push([x, 30 * k, z, k, 60 * k, k]);
    for (let j = 0; j < 3; j++) { const y = (80 + j * 70) * k, r = (78 - j * 20) * k; cones.push([x, y, z, r, 120 * k, r, rnd() * 3]); caps.push([x, y + 32 * k, z, r * 0.72, 62 * k, r * 0.72, rnd() * 3]); }
  });
  instanced(new THREE.CylinderGeometry(6, 9, 1, 6), mat(0x5a4030), trunks);
  instanced(new THREE.ConeGeometry(1, 1, 8), mat(0x2d5a45), cones);
  instanced(new THREE.ConeGeometry(1, 1, 8), mat(0xf4f9ff, { roughness: 1 }), caps);
  scatterOutside(W, H, 160, 90, 900, 55, (x, z, rnd, d) => { const k = Math.min(20 + rnd() * 60, (d - 30) / 1.3); ice.push([x, k * 0.3, z, k, k * 0.8, k * 1.2, rnd() * 3]); });
  instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xa9d4f2, roughness: 0.2, metalness: 0.1, flatShading: true }), ice);
  const hills = []; scatterOutside(W, H, 90, 260, 900, 31, (x, z, rnd, d) => { const k = Math.min(60 + rnd() * 120, (d - 60) / 1.7); hills.push([x, -k * 0.2, z, k * 1.6, k, k * 1.3]); }); // longe da borda: a neve de fora não entra no mapa
  instanced(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff, { roughness: 1 }), hills);
  const rnd = seeded(717), mnt = mat(0xe8eef6, { roughness: 1 });
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2 + rnd() * 0.2, d = 3200 + rnd() * 2200, m = new THREE.Mesh(new THREE.ConeGeometry(700 + rnd() * 900, 900 + rnd() * 900, 6), mnt); m.position.set(W / 2 + Math.cos(a) * d, 350, H / 2 + Math.sin(a) * d); mapGroup.add(m); }
}

// ---------- portais (oval brilhante, dá pra ver o outro lado) ----------
const PORTAL_COLORS = [[0x00e5ff, 0x00e5ff], [0xff40c8, 0xff40c8]]; // igual ao 2D: azul com azul, rosa com rosa
const PORTAL_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const PORTAL_FRAG = `uniform sampler2D uTex; uniform vec2 uRes; uniform vec3 uColor; uniform float uTime; uniform float uLive; uniform float uOpen; varying vec2 vUv; ${NOISE_GLSL}
void main(){
  vec2 q = vUv * 2.0 - 1.0; float e = length(q);
  if (e > 1.0) discard;
  float ang = atan(q.y, q.x);
  vec3 col;
  if (uLive > 0.5) col = texture2D(uTex, gl_FragCoord.xy / uRes).rgb;
  else { float s = fbm(vec2(ang * 1.2 + uTime * 0.9 - e * 5.0, e * 3.0 - uTime * 0.7)); col = mix(uColor * 0.15, uColor * 1.2, s * (0.4 + e * 0.8)); }
  float edge = smoothstep(0.78, 1.0, e);
  float n = fbm(vec2(ang * 3.0 + uTime * 1.5, e * 6.0 - uTime * 2.0));
  col = mix(col, uColor * (1.6 + n), edge * (0.55 + 0.35 * n));
  // fechado: tampa de metal escura (íris) com as lâminas girando
  float blades = smoothstep(0.02, 0.0, abs(fract((ang / 6.2832 + e * 0.35) * 8.0) - 0.5) - 0.46);
  vec3 shut = vec3(0.16, 0.17, 0.2) * (0.7 + 0.3 * vn(q * 6.0)) + vec3(0.05) * blades + vec3(0.25, 0.27, 0.3) * smoothstep(0.9, 1.0, e);
  col = mix(shut, col, uOpen);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const RIM_FRAG = `uniform vec3 uColor; uniform float uTime; uniform float uOpen; varying vec2 vUv; ${NOISE_GLSL}
void main(){
  vec2 q = (vUv * 2.0 - 1.0) * vec2(1.32, 1.24); float e = length(q), ang = atan(q.y, q.x);
  float n = fbm(vec2(ang * 2.5 + uTime * 1.8, uTime * 0.9)) * 0.65 + fbm(vec2(ang * 7.0 - uTime * 2.6, 3.1)) * 0.35;
  float outer = 1.04 + n * 0.2;
  float band = smoothstep(0.93, 1.0, e) * (1.0 - smoothstep(1.0, outer, e));
  float glow = exp(-abs(e - 1.0) * 7.0) * 0.45;
  float a = clamp(band * 1.6 + glow, 0.0, 1.0);
  gl_FragColor = vec4(uColor * (band * 2.4 + glow) , a * (0.25 + 0.75 * uOpen));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// portais: desenho do outro lado em resolução menor e no máximo 2 portais por quadro (os outros usam o quadro anterior) — tira o lag
const PORTAL_RES = 0.36, PORTAL_MAX = 2;
let portalTurn = 0;
function portalRTSize() { const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v); return v; }
function disposePortals() {
  for (const v of portalViews) { v.rt.dispose(); v.mat.dispose(); v.rimMat.dispose(); }
  portalViews = [];
}
// todas as aberturas do mapa (em baixo e em cima) ganham moldura + superfície; abrem/fecham conforme o sim
function buildPortalViews(slots, frameTex, wallH) {
  const res = portalRTSize();
  const { rx, ry, cy } = PORTAL, UP = new THREE.Vector3(0, 1, 0);
  for (const d of slots) {
    const base = d.base || 0;
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(d.tx, 0, d.tz), UP, new THREE.Vector3(d.nx, 0, d.nz)).setPosition(d.cx, base, d.cz);
    const grp = new THREE.Group(); grp.matrixAutoUpdate = false; grp.matrix.copy(basis);
    // moldura: o pedaço de parede da abertura (do chão até o teto) com um furo oval na altura certa
    const shape = new THREE.Shape(); shape.moveTo(-d.half, -base); shape.lineTo(d.half, -base); shape.lineTo(d.half, wallH - base); shape.lineTo(-d.half, wallH - base); shape.lineTo(-d.half, -base);
    const hole = new THREE.Path(); hole.absellipse(0, cy, rx, ry, 0, Math.PI * 2, true); shape.holes.push(hole);
    const t = frameTex.clone(); t.needsUpdate = true; t.repeat.set(1 / 128, 1 / 128);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d.t, bevelEnabled: false, curveSegments: 48 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    frame.position.z = -d.t; frame.castShadow = frame.receiveShadow = true; grp.add(frame);
    // tampa com a mesma textura da parede: portal fechado fica igual parede (ninguém sabe onde vai abrir)
    const coverShape = new THREE.Shape(); coverShape.absellipse(0, cy, rx + 1, ry + 1, 0, Math.PI * 2, false);
    const ct = frameTex.clone(); ct.needsUpdate = true; ct.repeat.set(1 / 128, 1 / 128);
    const cover = new THREE.Mesh(new THREE.ShapeGeometry(coverShape, 48), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.8 }));
    cover.position.z = 0.05; cover.receiveShadow = true; grp.add(cover);
    const color = new THREE.Color(0x6b7280);
    const rt = new THREE.WebGLRenderTarget(Math.max(2, Math.round(res.x * PORTAL_RES)), Math.max(2, Math.round(res.y * PORTAL_RES)), { type: THREE.HalfFloatType });
    const m = new THREE.ShaderMaterial({ uniforms: { uTex: { value: rt.texture }, uRes: { value: res.clone() }, uColor: { value: color }, uTime: { value: 0 }, uLive: { value: 0 }, uOpen: { value: 0 } }, vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG });
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, ry * 2), m); surface.position.set(0, cy, 0.3); grp.add(surface);
    const rimMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: color }, uTime: { value: 0 }, uOpen: { value: 0 } }, vertexShader: PORTAL_VERT, fragmentShader: RIM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2 * 1.32, ry * 2 * 1.24), rimMat); rim.position.set(0, cy, 0.6); grp.add(rim);
    const light = null; // (sem luz de verdade em cada portal: eram 12 luzes e deixava o mapa pesado)
    mapGroup.add(grp);
    grp.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(surface);
    portalViews.push({ data: d, basis, grp, surface, rim, rt, mat: m, rimMat, bbox, light, cover, open: 0, link: -1 });
  }
}
// liga/desliga cada portal conforme os pares abertos no sim (cor do par: azul com azul, rosa com rosa)
function updatePortalViews(dt) {
  if (!portalViews.length) return;
  const open = new Map(); for (const q of sim.portals || []) if (q.i != null) open.set(q.i, q);
  for (const v of portalViews) {
    const q = open.get(v.data.i);
    v.link = q ? q.to : -1;
    if (q) v.mat.uniforms.uColor.value.set(PORTAL_COLORS[q.pair % 2][q.end]);
    v.open += ((q ? 1 : 0) - v.open) * Math.min(1, dt * 10);
    if (!q && v.open < 0.02) v.mat.uniforms.uColor.value.set(0x6b7280);
    v.mat.uniforms.uOpen.value = v.open; v.rimMat.uniforms.uOpen.value = v.open;
    if (v.light) { v.light.intensity = 9000 * v.open; v.light.color.copy(v.mat.uniforms.uColor.value); }
    v.cover.visible = v.open < 0.08; v.surface.visible = v.rim.visible = v.open >= 0.08; // fechado = parede lisa
  }
}
window.addEventListener('resize', () => {
  const res = portalRTSize();
  for (const v of portalViews) { v.rt.setSize(Math.max(2, Math.round(res.x * PORTAL_RES)), Math.max(2, Math.round(res.y * PORTAL_RES))); v.mat.uniforms.uRes.value.copy(res); }
});
// desenha o que cada portal "vê" do outro lado (câmera virtual atrás do portal par)
const _vcam = new THREE.PerspectiveCamera(); _vcam.matrixAutoUpdate = false; _vcam.matrixWorldAutoUpdate = false;
const _pm1 = new THREE.Matrix4(), _pm2 = new THREE.Matrix4(), _rotY = new THREE.Matrix4().makeRotationY(Math.PI), _pvm = new THREE.Matrix4(), _frus = new THREE.Frustum();
const _clip = new THREE.Plane(), _cn = new THREE.Vector3();
const _blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); _blackTex.needsUpdate = true;
// prepara (compila) os shaders do desenho dentro do portal logo ao carregar o mapa — senão trava na hora que o portal abre
function warmPortals() {
  try {
    const shOn = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    _clip.set(new THREE.Vector3(1, 0, 0), 0); renderer.clippingPlanes = [_clip];
    renderer.compile(scene, camera);
    renderer.clippingPlanes = []; renderer.shadowMap.enabled = shOn;
  } catch (e) { renderer.clippingPlanes = []; }
}
function renderPortals(me, now) {
  if (!portalViews.length) return;
  const tsec = now / 1000;
  // durante os desenhos "do outro lado" nenhum portal lê textura de portal (senão o WebGL reclama de loop)
  for (const v of portalViews) { v.mat.uniforms.uLive.value = 0; v.mat.uniforms.uTex.value = _blackTex; v.mat.uniforms.uTime.value = tsec; v.rimMat.uniforms.uTime.value = tsec; }
  const visible = [];
  camera.updateMatrixWorld();
  _pvm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pvm);
  const cp = camera.position, todo = [];
  for (const v of portalViews) {
    const d = v.data;
    if (v.open < 0.5) v.hasFrame = false;
    if ((cp.x - d.cx) * d.nx + (cp.z - d.cz) * d.nz <= 0.5) continue; // atrás do portal
    if (Math.hypot(cp.x - d.cx, cp.z - d.cz) > 2800) continue;
    if (v.link < 0 || v.open < 0.5 || !_frus.intersectsBox(v.bbox) || !portalViews[v.link]) continue;
    v.dist = Math.hypot(cp.x - d.cx, cp.z - d.cz); visible.push(v);
  }
  if (!visible.length) return;
  // os mais perto primeiro; se tiver mais que PORTAL_MAX na tela, os outros revezam (usam o quadro que já tinham)
  visible.sort((a, b) => a.dist - b.dist);
  const fresh = visible.filter((v) => !v.hasFrame);
  for (const v of fresh) if (todo.length < PORTAL_MAX) todo.push(v);
  for (let i = 0; i < visible.length && todo.length < PORTAL_MAX; i++) { const v = visible[(portalTurn + i) % visible.length]; if (!todo.includes(v)) todo.push(v); }
  portalTurn++;
  const hidden = []; for (const k in VIEW) if (VIEW[k].visible) { VIEW[k].visible = false; hidden.push(VIEW[k]); }
  const meA = avatars.get('me'), meVis = meA ? meA.root.visible : false;
  if (meA) meA.root.visible = !!me.alive; // do outro lado do portal você se vê
  // lá dentro do portal desenha sem sombra (mais leve; ninguém repara)
  const shOn = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  _vcam.projectionMatrix.copy(camera.projectionMatrix); _vcam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  for (const v of todo) {
    const Q = portalViews[v.link], qd = Q.data;
    _pm1.copy(v.basis).invert();
    _pm2.multiplyMatrices(Q.basis, _rotY).multiply(_pm1).multiply(camera.matrixWorld);
    _vcam.matrixWorld.copy(_pm2); _vcam.matrixWorldInverse.copy(_pm2).invert();
    _cn.set(qd.nx, 0, qd.nz); _clip.set(_cn, -(qd.nx * qd.cx + qd.nz * qd.cz) + 0.5);
    renderer.clippingPlanes = [_clip];
    Q.surface.visible = false; Q.rim.visible = false;
    renderer.setRenderTarget(v.rt); renderer.render(scene, _vcam);
    Q.surface.visible = true; Q.rim.visible = true;
  }
  renderer.setRenderTarget(null); renderer.clippingPlanes = [];
  renderer.shadowMap.enabled = shOn;
  for (const v of todo) v.hasFrame = true;
  for (const v of visible) if (v.hasFrame) { v.mat.uniforms.uLive.value = 1; v.mat.uniforms.uTex.value = v.rt.texture; }
  for (const o of hidden) o.visible = true;
  if (meA) meA.root.visible = meVis;
}

// ---------- cidade à noite: poste de rua ----------
const LAMP_LIGHT = 42000;
function addLamp(x, z, dx, dz) {
  dx = dx == null ? 1 : dx; dz = dz || 0;
  const metal = mat(0x1f2430, { metalness: 0.5, roughness: 0.5 });
  const Hh = LAMP.h, O = LAMP.off, bx = x + dx * O, bz = z + dz * O;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, Hh + 8, 8), metal); pole.position.set(x, (Hh + 8) / 2, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 8, 8), metal); base.position.set(x, 4, z);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(O + 6, 3, 3), metal); arm.position.set(x + dx * O / 2, Hh + 8, z + dz * O / 2); arm.rotation.y = -Math.atan2(dz, dx);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(6, 13, 9, 10), metal); head.position.set(bx, Hh + 5, bz);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); bulb.position.set(bx, Hh, bz); bulb.scale.y = 0.65;
  for (const m of [pole, base, arm, head]) { m.castShadow = m.receiveShadow = true; mapGroup.add(m); }
  mapGroup.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffd58a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(75, 75, 1); halo.position.set(bx, Hh, bz); mapGroup.add(halo);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(200, 32), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xffc56a, transparent: true, opacity: 0.17, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(bx, 0.7, bz); mapGroup.add(pool);
  lampLights.push({ bulb, halo, pool, pos: new THREE.Vector3(bx, Hh - 6, bz) }); // a luz de verdade vem do "pool" (só as mais perto)
}

// teto das salas fechadas: placas com luminárias (na sala escura elas apagam junto com a luz)
let ceilLights = [], ceilPoints = [];
function buildCeiling(mapId, y, W, H) {
  const dark = mapId === 'escuro';
  const tex = canvasTex(256, 256, (g) => { g.fillStyle = dark ? '#1b1d22' : '#c9ced6'; g.fillRect(0, 0, 256, 256); g.strokeStyle = dark ? 'rgba(0,0,0,.5)' : 'rgba(60,65,75,.5)'; g.lineWidth = 4; for (let k = 0; k <= 256; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); } }, true);
  tex.repeat.set(W / 256, H / 256);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, y, H / 2); ceil.receiveShadow = true;
  mapGroup.add(ceil);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: dark ? 0xfff1d0 : 0xeef4ff, emissiveIntensity: 1.6 });
  if (dark) {
    // sala escura: 3 fileiras de lâmpadas compridas no teto que clareiam a sala (piscam e apagam no evento)
    for (const z of [H * 0.2, H * 0.5, H * 0.8]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 5, 18), lampMat); strip.position.set(W / 2, y - 3, z); mapGroup.add(strip);
      for (const x of [W * 0.27, W * 0.73]) { // (2 por fileira: mais leve)
        const l = new THREE.PointLight(0xfff1d0, 52000, 900, 2); l.position.set(x, y - 30, z); mapGroup.add(l); ceilPoints.push(l);
      }
    }
  } else {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(140, 4, 34), lampMat); m.position.set(W * (i + 0.5) / 4, y - 2, H * (j + 0.5) / 3); mapGroup.add(m);
    }
  }
  ceilLights.push(lampMat);
}
// ---------- metrô: trilhos, túneis, placas e o trem ----------
let metroFx = null;
function buildMetro(w) {
  const W = w.W, H = w.H, lanes = w.lanes || [];
  const rail = mat(0x9ca3af, { metalness: 0.8, roughness: 0.3 }), wood = mat(0x4a3322);
  const sleepers = [];
  for (const x of lanes) {
    for (const off of [-24, 24]) { const r = new THREE.Mesh(new THREE.BoxGeometry(5, 5, H + 40), rail); r.position.set(x + off, 3, H / 2); r.receiveShadow = true; mapGroup.add(r); }
    for (let z = 20; z < H; z += 44) sleepers.push([x, 1.5, z, 78, 3, 12]);
  }
  instanced(new THREE.BoxGeometry(1, 1, 1), wood, sleepers);
  // bocas de túnel nas paredes de cima e de baixo, onde o trem entra/sai
  const dark = new THREE.MeshBasicMaterial({ color: 0x050505 }), frameM = mat(0x5a5347);
  for (const x of lanes) for (const [z, ry] of [[w.t + 0.6, 0], [H - w.t - 0.6, Math.PI]]) {
    const sh = new THREE.Shape(); sh.moveTo(-80, 0); sh.lineTo(80, 0); sh.lineTo(80, 150); sh.absarc(0, 150, 80, 0, Math.PI, false); sh.lineTo(-80, 0);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 20), dark); m.position.set(x, 0, z); m.rotation.y = ry; mapGroup.add(m);
    const fr = new THREE.Mesh(new THREE.TorusGeometry(84, 7, 6, 20, Math.PI), frameM); fr.position.set(x, 150, z); fr.rotation.y = ry; mapGroup.add(fr);
  }
  // mezanino de cada base (laje presa na parede do fundo) e as escadas de degraus com faixa amarela
  const conc = mat(0xb9b4a6), concD = mat(0x8f8a7e), yel = mat(0xf2c300), metal = mat(0x6b7280, { metalness: 0.7, roughness: 0.35 });
  for (const R of w.walls) {
    if (R.mezz) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(R.w, R.top - R.y0, R.h), conc); slab.position.set(R.x + R.w / 2, (R.top + R.y0) / 2, R.y + R.h / 2); slab.castShadow = slab.receiveShadow = true; mapGroup.add(slab);
      const inner = R.x < W / 2 ? R.x + R.w : R.x; // beirada virada pro mapa
      const edge = new THREE.Mesh(new THREE.BoxGeometry(4, 3, R.h), yel); edge.position.set(inner + (R.x < W / 2 ? -2 : 2), R.top + 1.5, R.y + R.h / 2); mapGroup.add(edge);
      // (v0.28: sem as colunas embaixo — a laje fica presa na parede do fundo)
      // corrimão baixinho no fundo (só visual)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3, 3, R.h), metal); rail.position.set(R.x < W / 2 ? R.x + 4 : R.x + R.w - 4, R.top + 40, R.y + R.h / 2); mapGroup.add(rail);
    }
  }
  // rampas (a física usa degrauzinhos; aqui é uma rampa lisa) + parapeito inclinado só nela
  const side = (pts, width, x, m) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) sh.lineTo(q[0], q[1]); const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false }); const o = new THREE.Mesh(g, m); o.rotation.y = -Math.PI / 2; o.position.x = x + width; o.castShadow = o.receiveShadow = true; mapGroup.add(o); return o; };
  for (const Rp of w.ramps || []) {
    const { zf, zt, h } = Rp;
    if (!Rp.stairs) side([[zf, 0], [zt, 0], [zt, h], [zf, 0.5]], Rp.w, Rp.x, conc); // (escada: os degraus são as caixas)
    side([[zf, 0], [zt, 0], [zt, h + 44], [zf, 44]], Rp.rw, Rp.rx, concD);
    // corrimão de metal em cima do parapeito e faixas amarelas antiderrapantes
    const L = Math.hypot(zt - zf, h), ang = Math.atan2(h, Math.abs(zt - zf)), sg = zt > zf ? -1 : 1;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(Rp.rw + 2, 3, L), metal); cap.position.set(Rp.rx + Rp.rw / 2, h / 2 + 45.5, (zf + zt) / 2); cap.rotation.x = sg * ang; mapGroup.add(cap);
    if (Rp.stairs) { const nos = []; for (let k = 1; k <= Rp.stairs; k++) { const zz = zf + (zt - zf) * (k - 0.5) / Rp.stairs - (zt - zf) / Rp.stairs * 0.4; nos.push([Rp.x + Rp.w / 2, h * k / Rp.stairs + 0.7, zz, Rp.w - 6, 1.4, 4]); } instanced(new THREE.BoxGeometry(1, 1, 1), yel, nos); } // faixa amarela na beirada de cada degrau
    else for (let i = 1; i < 8; i++) { const f = i / 8, st = new THREE.Mesh(new THREE.BoxGeometry(Rp.w - 8, 1.2, 5), yel); st.position.set(Rp.x + Rp.w / 2, h * f + 0.9, zf + (zt - zf) * f); st.rotation.x = sg * ang; mapGroup.add(st); }
  }
  // placas da estação
  const sign = canvasTex(512, 96, (g) => { g.fillStyle = '#1e6fb8'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.font = '800 44px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ESTAÇÃO POINT BALL', 256, 50); g.fillStyle = '#f2c300'; g.fillRect(0, 84, 512, 12); });
  for (const [x, z, ry] of [[W * 0.25, w.t + 1, 0], [W * 0.75, w.t + 1, 0], [W * 0.25, H - w.t - 1, Math.PI], [W * 0.75, H - w.t - 1, Math.PI]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 48), new THREE.MeshBasicMaterial({ map: sign })); m.position.set(x, 230, z); m.rotation.y = ry; mapGroup.add(m); }
  // luzes de aviso no chão ao lado de cada trilho (piscam vermelho quando o trem vem)
  const warn = lanes.map((x) => { const g = []; for (let z = 60; z < H; z += 140) for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 8), new THREE.MeshBasicMaterial({ color: 0x331111 })); b.position.set(x + sx * (TRAIN.half + 22), 1.5, z); mapGroup.add(b); g.push(b); } return g; });
  // o trem (fica escondido até passar)
  const train = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.6, roughness: 0.35 }), blue = mat(0x1e6fb8), winM = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0xfff4c8, emissiveIntensity: 0.9 });
  // trem alto e comprido: quando passa, tampa a visão de um lado pro outro
  const cars = 5, carL = TRAIN.len / cars, TH = 220;
  for (let i = 0; i < cars; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(TRAIN.half * 1.7, TH, carL - 14), body); c.position.set(0, 8 + TH / 2, -carL * (i + 0.5)); c.castShadow = true; train.add(c);
    const st = new THREE.Mesh(new THREE.BoxGeometry(TRAIN.half * 1.72, 18, carL - 14), blue); st.position.set(0, 70, -carL * (i + 0.5)); train.add(st);
    for (let k = 0; k < 4; k++) for (const sx of [-1, 1]) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(40, 56), winM); wn.position.set(sx * (TRAIN.half * 0.86), 140, -carL * i - 40 - k * (carL - 60) / 3.3); wn.rotation.y = sx * Math.PI / 2; train.add(wn); }
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(TRAIN.half * 1.7, TH, 20), blue); nose.position.set(0, 8 + TH / 2, 0); train.add(nose);
  for (const sx of [-1, 1]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c8 })); hl.position.set(sx * 34, 40, 11); train.add(hl); }
  const lamp = new THREE.PointLight(0xfff0c0, 0, 900, 2); lamp.position.set(0, 60, 60); train.add(lamp);
  train.visible = false; mapGroup.add(train);
  metroFx = { train, warn, lanes, lamp, H };
}
function updateMetroFx(now) {
  if (!metroFx) return;
  const T = sim.train, F = metroFx;
  // pisca a luz vermelha do trilho onde o trem vem (e, na ida, também a do trilho da volta)
  F.warn.forEach((g, i) => { const L = F.lanes[i], on = T && T.s >= 1 && (Math.abs(L - T.x) < 1 || (T.s === 2 && T.leg === 0 && T.xb != null && Math.abs(L - T.xb) < 1)) && Math.floor(now / 180) % 2; for (const b of g) b.material.color.set(on ? 0xff2020 : 0x331111); });
  const legKey = T && T.s === 2 && T.on !== false ? T.idx + ':' + (T.leg || 0) + ':' + T.x : null;
  if (legKey && legKey !== F.legKey) { const me = sim.players.get('me'); if (me) SFX.play('train', Math.max(0.35, 1 - Math.abs(me.x - T.x) / 1500), { pan: Math.max(-1, Math.min(1, (T.x - me.x) / 600)) }); }
  F.legKey = legKey;
  if (!T || T.s !== 2 || T.t2 == null || T.on === false) { F.train.visible = false; F.lamp.intensity = 0; return; }
  const front = (T.dir > 0 ? -TRAIN.len * 0.2 : F.H + TRAIN.len * 0.2) + T.dir * TRAIN.speed * (sim.time - (T.lt != null ? T.lt : T.t2));
  F.train.visible = true; F.train.position.set(T.x, 0, front); F.train.rotation.y = T.dir > 0 ? 0 : Math.PI; F.lamp.intensity = 60000;
}
// ---------- canteiro de obras: guindaste no meio (a bola de demolição dá a volta), prédios em construção em volta ----------
let obraFx = null;
const CRANE_TOP = 640; // altura da lança do guindaste (acima do prédio em construção)
function buildObra(w) {
  const W = w.W, H = w.H, cx = W / 2, cz = H / 2, yel = mat(0xe2b33c, { roughness: 0.6 }), dk = mat(0x2b2b2b), steel = mat(0x6b7280, { metalness: 0.6, roughness: 0.4 });
  // torre treliçada
  const mastH = CRANE_TOP, mast = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(5, mastH, 5), yel); c.position.set(sx * 30, mastH / 2, sz * 30); mast.add(c); }
  { // barras da treliça: um desenho só (InstancedMesh) em vez de centenas de peças
    const bars = [], o = new THREE.Object3D();
    for (let y = 20; y < mastH; y += 40) for (const [a, b, rot] of [[0, -30, 0], [0, 30, 0], [-30, 0, 1], [30, 0, 1]]) {
      o.rotation.set(0, 0, 0); o.position.set(a, y, b); o.scale.set(rot ? 3 : 64, 3, rot ? 64 : 3); o.updateMatrix(); bars.push(o.matrix.clone());
      o.position.set(a, y + 20, b); o.scale.set(rot ? 3 : 88, 3, rot ? 88 : 3); o.rotation[rot ? 'x' : 'z'] = 0.62; o.updateMatrix(); bars.push(o.matrix.clone());
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), yel, bars.length); bars.forEach((m, i) => im.setMatrixAt(i, m)); mast.add(im);
  }
  mast.position.set(cx, 0, cz); mapGroup.add(mast);
  // lança (gira) com o carrinho, o cabo e a bola
  const jib = new THREE.Group(); jib.position.set(cx, mastH, cz); mapGroup.add(jib);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(46, 36, 46), mat(0xf3f4f6)); cabin.position.set(0, -10, 0); jib.add(cabin);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(CRANE.R + 120, 16, 18), yel); arm.position.set((CRANE.R + 120) / 2 - 20, 12, 0); jib.add(arm);
  const back = new THREE.Mesh(new THREE.BoxGeometry(200, 14, 16), yel); back.position.set(-110, 12, 0); jib.add(back);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(50, 44, 40), mat(0x9ca3af)); cw.position.set(-190, -4, 0); jib.add(cw);
  const top = new THREE.Mesh(new THREE.ConeGeometry(14, 70, 4), yel); top.position.set(0, 55, 0); jib.add(top);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 22), dk); trolley.position.set(CRANE.R, 0, 0); jib.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 5), dk); jib.add(cable);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(CRANE.ball, 20, 14), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7, roughness: 0.35 })); ball.castShadow = true; jib.add(ball);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(10, 3, 6, 12), steel); jib.add(hook);
  // círculo no chão mostrando por onde a bola vai passar (acende no aviso)
  const ringM = new THREE.MeshBasicMaterial({ color: 0xff3b1f, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(CRANE.R - CRANE.ball, CRANE.R + CRANE.ball, 96), ringM); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 1.4, cz); mapGroup.add(ring);
  // lá fora: a obra fica no meio de uma cidade (de dia) — ruas com faixa, calçadas, quarteirões com prédios de várias
  // alturas, árvores, postes e carros parados. Tudo em poucos desenhos (prédios juntos numa malha só por cor, o resto instanciado)
  buildCityAround(W, H, { seed: 303 });
  const far = new THREE.Group(); for (let y = 0; y < 900; y += 60) { const c = new THREE.Mesh(new THREE.BoxGeometry(24, 60, 24), yel); c.position.y = y + 30; far.add(c); } const fa = new THREE.Mesh(new THREE.BoxGeometry(700, 18, 20), yel); fa.position.set(200, 910, 0); far.add(fa); far.position.set(W + 2600, 0, -1600); far.rotation.y = 0.6; mapGroup.add(far);
  obraFx = { jib, trolley, cable, ball, hook, ring, ringM, a: 0 };
}
// cidade em volta de um mapa (obra): o mapa fica num quarteirão; em volta, ruas em grade com faixa e faixa de pedestre,
// calçada, e quarteirões com casas, lojas e prédios (malha única por fachada), praças, parques, lagos, árvores, postes e carros
function mergeGeos(geos) {
  let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let ov = 0, oi = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3); uv.set(g.attributes.uv.array, ov * 2); const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + ov; ov += g.attributes.position.count; oi += ix.length; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m;
}
function buildCityAround(W, H, o) {
  // (v0.27) cidade mais espaçada: quarteirões maiores, quase metade dos terrenos sem prédio (gramado ou estacionamento),
  // mais praças e parques; prédios novos (vidro, faixas brancas, painéis) em vez de concreto velho
  const rnd = seeded(o.seed || 1), RW = 150, SW = 36, BLK = 620, PITCH = BLK + RW + SW * 2, EXT = 4600;
  const size = EXT * 2 + Math.max(W, H), ox = W / 2 - size / 2, oz = H / 2 - size / 2, px = 2048 / size;
  // quarteirões em grade em volta do mapa (o mapa é um quarteirão)
  const cols = [], rows = [];
  for (let x = -SW * 2 - RW; x > -EXT; x -= PITCH) cols.unshift([x - BLK, x]); cols.push([0, W]); for (let x = W + SW * 2 + RW; x < W + EXT; x += PITCH) cols.push([x, x + BLK]);
  for (let z = -SW * 2 - RW; z > -EXT; z -= PITCH) rows.unshift([z - BLK, z]); rows.push([0, H]); for (let z = H + SW * 2 + RW; z < H + EXT; z += PITCH) rows.push([z, z + BLK]);
  // tipo de cada quarteirão (lago, parque, praça ou construído) e os terrenos dos construídos
  const blocks = []; let lakes = 0;
  for (const [x0, x1] of cols) for (const [z0, z1] of rows) {
    if (x0 === 0 && z0 === 0) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, dist = Math.hypot(cx - W / 2, cz - H / 2), r = rnd();
    const type = lakes < 2 && dist > 1900 && dist < 3400 && r < 0.12 ? (lakes++, 'lake') : r < 0.25 ? 'park' : r < 0.33 ? 'plaza' : 'built';
    const B = { x0, x1, z0, z1, cx, cz, dist, type, lots: [] };
    if (type === 'built') {
      const lotW = dist < 2200 ? 290 : 380, nx = Math.max(1, Math.round((x1 - x0) / lotW)), nz = Math.max(1, Math.round((z1 - z0) / lotW)), lw = (x1 - x0) / nx, ld = (z1 - z0) / nz;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = x0 + lw * (i + 0.5), z = z0 + ld * (j + 0.5);
        let kind = rnd() < (dist > 2800 ? 0.55 : 0.42) ? (rnd() < 0.55 ? 'lawn' : 'parking') : null;
        if (!kind) { const q = rnd(); kind = dist < 1700 ? (q < 0.55 ? 'house' : q < 0.85 ? 'shop' : 'tall') : dist < 2800 ? (q < 0.3 ? 'house' : q < 0.55 ? 'shop' : 'tall') : (q < 0.15 ? 'shop' : 'tall'); }
        // lado da rua mais perto (a frente do terreno: entrada da casa, vitrine da loja)
        const fx = i === 0 ? -1 : i === nx - 1 ? 1 : 0, fz = j === 0 ? -1 : j === nz - 1 ? 1 : 0;
        B.lots.push({ x, z, lw, ld, kind, fx, fz });
      }
    }
    blocks.push(B);
  }
  const tex = canvasTex(2048, 2048, (g) => {
    g.fillStyle = '#3d4046'; g.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.04)`; g.fillRect(rnd() * 2048, rnd() * 2048, 3, 3); }
    const R = (x, z, w, d) => [(x - ox) * px, (z - oz) * px, w * px, d * px];
    for (const B of blocks.concat([{ x0: 0, x1: W, z0: 0, z1: H, type: 'site', lots: [] }])) {
      const [X0, Z0, Wd, Hd] = R(B.x0 - SW, B.z0 - SW, B.x1 - B.x0 + SW * 2, B.z1 - B.z0 + SW * 2);
      g.fillStyle = '#b4b1aa'; g.fillRect(X0, Z0, Wd, Hd); g.strokeStyle = '#7d7a74'; g.lineWidth = 1.5; g.strokeRect(X0, Z0, Wd, Hd); // calçada com guia
      const [bx, bz, bw, bd] = R(B.x0, B.z0, B.x1 - B.x0, B.z1 - B.z0);
      if (B.type === 'park' || B.type === 'lake') {
        g.fillStyle = '#6a9a4c'; g.fillRect(bx, bz, bw, bd); g.fillStyle = 'rgba(40,80,30,.22)'; for (let i = 0; i < 40; i++) g.fillRect(bx + rnd() * bw, bz + rnd() * bd, 4, 4);
        if (B.type === 'lake') { g.fillStyle = '#d2c49c'; g.beginPath(); g.ellipse(bx + bw / 2, bz + bd / 2, bw * 0.44, bd * 0.4, 0, 0, 7); g.fill(); g.fillStyle = '#3e7f9a'; g.beginPath(); g.ellipse(bx + bw / 2, bz + bd / 2, bw * 0.4, bd * 0.36, 0, 0, 7); g.fill(); }
        else { g.strokeStyle = '#d8cdb0'; g.lineWidth = 3; g.beginPath(); g.ellipse(bx + bw / 2, bz + bd / 2, bw * 0.3, bd * 0.3, 0, 0, 7); g.moveTo(bx, bz); g.lineTo(bx + bw, bz + bd); g.moveTo(bx + bw, bz); g.lineTo(bx, bz + bd); g.stroke(); }
      } else if (B.type === 'plaza') {
        g.fillStyle = '#cbc4b5'; g.fillRect(bx, bz, bw, bd); g.strokeStyle = 'rgba(120,110,95,.35)'; g.lineWidth = 1;
        for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(bx + bw * k / 8, bz); g.lineTo(bx + bw * k / 8, bz + bd); g.moveTo(bx, bz + bd * k / 8); g.lineTo(bx + bw, bz + bd * k / 8); g.stroke(); }
        g.fillStyle = '#a89f8c'; g.beginPath(); g.arc(bx + bw / 2, bz + bd / 2, bw * 0.16, 0, 7); g.fill();
        g.fillStyle = '#6a9a4c'; for (const [a, b] of [[0.04, 0.04], [0.76, 0.04], [0.04, 0.76], [0.76, 0.76]]) g.fillRect(bx + bw * a, bz + bd * b, bw * 0.2, bd * 0.2); // canteiros nos cantos
      } else if (B.type === 'built') {
        g.fillStyle = '#6f9d50'; g.fillRect(bx, bz, bw, bd);
        for (const L of B.lots) {
          const [lx, lz, lw, ld] = R(L.x - L.lw / 2, L.z - L.ld / 2, L.lw, L.ld);
          if (L.kind === 'parking') { g.fillStyle = '#4b4e53'; g.fillRect(lx + 1, lz + 1, lw - 2, ld - 2); g.fillStyle = 'rgba(240,240,235,.8)'; for (let k = 1; k < 8; k++) { g.fillRect(lx + lw * k / 8, lz + 2, 0.7, ld * 0.3); g.fillRect(lx + lw * k / 8, lz + ld * 0.7 - 2, 0.7, ld * 0.3); } }
          else if (L.kind === 'shop') { g.fillStyle = '#c2beb4'; g.fillRect(lx + 1, lz + 1, lw - 2, ld - 2); }
          else if (L.kind === 'tall') { g.fillStyle = '#cfcac0'; g.fillRect(lx + 1, lz + 1, lw - 2, ld - 2); g.fillStyle = '#6f9d50'; g.fillRect(lx + lw * 0.08, lz + ld * 0.08, lw * 0.14, ld * 0.84); g.fillRect(lx + lw * 0.78, lz + ld * 0.08, lw * 0.14, ld * 0.84); }
          else { g.fillStyle = L.kind === 'house' ? '#75a355' : '#6c9a4d'; g.fillRect(lx + 1, lz + 1, lw - 2, ld - 2); if (L.kind === 'house') { g.fillStyle = '#bdb7ab'; const cx2 = lx + lw / 2, cz2 = lz + ld / 2; if (L.fx) g.fillRect(L.fx < 0 ? lx : cx2, cz2 - 2.5, lw / 2, 5); else g.fillRect(cx2 - 2.5, L.fz < 0 ? lz : cz2, 5, ld / 2); } }
          g.strokeStyle = 'rgba(60,90,45,.6)'; g.lineWidth = 0.8; g.strokeRect(lx + 0.5, lz + 0.5, lw - 1, ld - 1); // cerquinha/sebe entre os terrenos
        }
      }
    }
    // ruas: faixa amarela dupla no meio, tracejado branco das pistas e faixas de pedestre nos cruzamentos
    for (let i = 0; i + 1 < cols.length; i++) { const x = ((cols[i][1] + cols[i + 1][0]) / 2 - ox) * px; g.fillStyle = '#d9b43a'; g.fillRect(x - 1.2, 0, 0.9, 2048); g.fillRect(x + 0.3, 0, 0.9, 2048); g.strokeStyle = 'rgba(235,235,225,.7)'; g.lineWidth = 0.8; g.setLineDash([5, 7]); for (const d of [-RW * px / 4, RW * px / 4]) { g.beginPath(); g.moveTo(x + d, 0); g.lineTo(x + d, 2048); g.stroke(); } g.setLineDash([]); }
    for (let i = 0; i + 1 < rows.length; i++) { const z = ((rows[i][1] + rows[i + 1][0]) / 2 - oz) * px; g.fillStyle = '#d9b43a'; g.fillRect(0, z - 1.2, 2048, 0.9); g.fillRect(0, z + 0.3, 2048, 0.9); g.strokeStyle = 'rgba(235,235,225,.7)'; g.lineWidth = 0.8; g.setLineDash([5, 7]); for (const d of [-RW * px / 4, RW * px / 4]) { g.beginPath(); g.moveTo(0, z + d); g.lineTo(2048, z + d); g.stroke(); } g.setLineDash([]); }
    for (let i = 0; i + 1 < cols.length; i++) for (let j = 0; j + 1 < rows.length; j++) {
      const xa = (cols[i][1] + SW - ox) * px, xb = (cols[i + 1][0] - SW - ox) * px, za = (rows[j][1] + SW - oz) * px, zb = (rows[j + 1][0] - SW - oz) * px;
      g.fillStyle = '#3d4046'; g.fillRect(xa, za, xb - xa, zb - za); g.fillStyle = 'rgba(240,240,230,.85)'; // (cruzamento sem faixa no meio)
      for (let k = 0; k < 6; k++) { g.fillRect(xa + k * (xb - xa) / 6 + 0.6, za - 4, (xb - xa) / 12, 4); g.fillRect(xa + k * (xb - xa) / 6 + 0.6, zb, (xb - xa) / 12, 4); g.fillRect(xa - 4, za + k * (zb - za) / 6 + 0.6, 4, (zb - za) / 12); g.fillRect(xb, za + k * (zb - za) / 6 + 0.6, 4, (zb - za) / 12); }
    }
  });
  tex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -1.5, H / 2); ground.receiveShadow = true; mapGroup.add(ground);
  // fachadas modernas (1 textura = 384 unidades = 4 andares): vidro azul, faixas brancas com janela corrida,
  // painel claro com sacada de vidro, vidro grafite com grade prata e painel terracota com brise
  const glass = (g, x, y, w, h, top, bot, r2) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(x, y, w, h); if (r2 && r2() < 0.3) { g.fillStyle = `rgba(255,255,255,${0.05 + r2() * 0.1})`; g.fillRect(x, y, w, h); } };
  const facades = [
    (g, r2) => { for (let f = 0; f < 4; f++) { const y = f * 64; for (let x = 0; x < 256; x += 32) glass(g, x, y + 8, 32, 56, '#a7c6dc', '#44708f', r2); g.fillStyle = '#51606d'; g.fillRect(0, y, 256, 8); } g.fillStyle = '#d3dbe2'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 2, 256); for (let f = 0; f < 4; f++) g.fillRect(0, f * 64 + 7, 256, 1.5); },
    (g, r2) => { g.fillStyle = '#eceeec'; g.fillRect(0, 0, 256, 256); for (let f = 0; f < 4; f++) { const y = f * 64; glass(g, 0, y + 20, 256, 38, '#8fb0c2', '#2f4f63', 0); g.fillStyle = '#dfe4e4'; for (let x = 0; x < 256; x += 43) g.fillRect(x, y + 20, 3, 38); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y + 58, 256, 2); } },
    (g, r2) => { g.fillStyle = '#dcd7ce'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,.05)'; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 1, 256); for (let f = 0; f < 4; f++) { const y = f * 64; g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, 256, 1); for (let x = 10; x < 256; x += 64) { g.fillStyle = '#3a3f45'; g.fillRect(x - 2, y + 10, 48, 44); glass(g, x, y + 12, 44, 40, '#9ab9cc', '#3b5d73', r2); g.fillStyle = '#3a3f45'; g.fillRect(x + 21, y + 12, 2, 40); if ((x / 64 + f) % 2 === 0) { g.fillStyle = '#f6f4f0'; g.fillRect(x - 8, y + 52, 60, 5); g.fillStyle = 'rgba(175,205,220,.55)'; g.fillRect(x - 8, y + 40, 60, 12); } } } },
    (g, r2) => { for (let f = 0; f < 4; f++) for (let x = 0; x < 256; x += 32) glass(g, x, f * 64, 32, 64, '#6f8597', '#2c3a46', r2); g.fillStyle = '#a7b2bb'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 2.5, 256); for (let f = 0; f < 4; f++) g.fillRect(0, f * 64, 256, 3); },
    (g, r2) => { g.fillStyle = '#cfa582'; g.fillRect(0, 0, 256, 256); for (let f = 0; f < 4; f++) { const y = f * 64; g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, y, 256, 2); for (let x = 6; x < 256; x += 32) glass(g, x, y + 8, 20, 50, '#8eacbf', '#2f4655', r2); } g.fillStyle = '#8c6647'; for (let x = 28; x < 256; x += 32) g.fillRect(x, 0, 5, 256); }
  ].map((draw, v) => canvasTex(256, 256, (g) => draw(g, seeded(900 + v)), true));
  const facadeRough = [0.35, 0.6, 0.8, 0.3, 0.8];
  // térreo dos prédios altos (lobby de vidro com marquise) — a textura cobre a altura toda do térreo
  const lobbyT = canvasTex(256, 128, (g) => { g.fillStyle = '#e4e2dd'; g.fillRect(0, 0, 256, 128); glass(g, 0, 34, 256, 94, '#9fbfd2', '#34546a', 0); g.fillStyle = '#c9ced2'; for (let x = 0; x < 256; x += 42) g.fillRect(x, 34, 3, 94); g.fillStyle = '#4b5258'; g.fillRect(0, 26, 256, 8); g.fillStyle = '#2d3136'; g.fillRect(104, 70, 48, 58); glass(g, 107, 73, 42, 55, '#8fb2c6', '#2b4557', 0); });
  // casas: reboco claro, janelas grandes de caixilho escuro, porta de madeira, rodapé; 2 delas com parte em madeira (casa moderna de teto reto)
  const houseT = ['#f3f1ec', '#e8e2d6', '#dfe7ea', '#f1e6d6'].map((c, v) => canvasTex(128, 128, (g) => {
    g.fillStyle = c; g.fillRect(0, 0, 128, 128);
    if (v >= 2) { g.fillStyle = '#a4764d'; g.fillRect(0, 0, 46, 128); g.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < 46; x += 5) g.fillRect(x, 0, 1, 128); }
    g.fillStyle = '#8d8a84'; g.fillRect(0, 118, 128, 10);
    g.fillStyle = '#3c4146'; g.fillRect(v >= 2 ? 58 : 12, 30, v >= 2 ? 58 : 34, 40); glass(g, v >= 2 ? 60 : 14, 32, v >= 2 ? 54 : 30, 36, '#b3cfe0', '#4d7892', 0);
    if (v < 2) { g.fillStyle = '#3c4146'; g.fillRect(82, 30, 34, 40); glass(g, 84, 32, 30, 36, '#b3cfe0', '#4d7892', 0); }
    g.fillStyle = '#3c4146'; g.fillRect(v >= 2 ? 14 : 54, 74, 22, 44); g.fillStyle = '#8a5a33'; g.fillRect(v >= 2 ? 16 : 56, 76, 18, 42); g.fillStyle = '#e8c35a'; g.fillRect(v >= 2 ? 30 : 70, 98, 2, 3);
  }));
  // lojas: painel de cima (cor da marca e letreiro), vitrine grande embaixo com caixilho fino e toldo
  const shopT = [['#c0392b', '#ecebe7'], ['#2471a3', '#3d4247'], ['#1e8449', '#e9e4da'], ['#d68910', '#ecebe7'], ['#7d3c98', '#4a4f55']].map(([c, p]) => canvasTex(256, 128, (g) => {
    g.fillStyle = p; g.fillRect(0, 0, 256, 128); g.fillStyle = c; g.fillRect(20, 14, 216, 22); g.fillStyle = 'rgba(255,255,255,.92)'; for (let x = 34; x < 222; x += 14 + Math.floor(rnd() * 6)) g.fillRect(x, 19, 8, 12);
    glass(g, 8, 52, 240, 70, '#a9c6d6', '#3a5a6c', 0); g.fillStyle = '#2f3338'; for (let x = 8; x <= 248; x += 60) g.fillRect(x, 52, 3, 70); g.fillRect(8, 120, 243, 3);
    g.fillStyle = c; g.fillRect(0, 44, 256, 8); g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < 256; x += 16) g.fillRect(x, 44, 8, 8);
  }));
  const faceUV = (geo, rep) => { const uv = geo.attributes.uv, dims = geo.parameters; for (let f = 0; f < 6; f++) { const a = f < 2 ? dims.depth : dims.width, k = rep ? Math.max(1, Math.round(a / rep)) : 1; for (let i = f * 4; i < f * 4 + 4; i++) uv.setX(i, uv.getX(i) * k); } };
  const G = { tall: facades.map(() => []), house: houseT.map(() => []), shop: shopT.map(() => []), lobby: [[]] };
  const caps = [], capsW = [], roofs = [], roofCols = [], mech = [], trees = [], trunks = [], poles = [], cars = [], carCols = [], fountains = [], lakesM = [], hedges = [];
  const tree = (x, z, s) => { trees.push([x, 58 * s + 26, z, 30 * s, 100 * s, 30 * s]); trunks.push([x, 26, z, 6, 52, 6]); };
  const car = (x, z, alongX) => { cars.push(alongX ? [x, 16, z, 70, 26, 32] : [x, 16, z, 32, 26, 70]); carCols.push(new THREE.Color().setHSL(rnd(), 0.2 + rnd() * 0.45, 0.25 + rnd() * 0.5)); };
  const box = (list, w, h, d, x, y, z, uvf) => { const g = new THREE.BoxGeometry(w, h, d); uvf(g); g.translate(x, y + h / 2, z); list.push(g); };
  for (const B of blocks) {
    const { x0, x1, z0, z1, cx, cz, dist } = B, near = Math.max(0, Math.min(1, (dist - Math.max(W, H) * 0.6) / 3200));
    if (B.type === 'park') { for (let k = 0; k < 12; k++) { const x = x0 + 30 + rnd() * (x1 - x0 - 60), z = z0 + 30 + rnd() * (z1 - z0 - 60); if (Math.abs(x - cx) > 40 && Math.abs(z - cz) > 40) tree(x, z, 0.8 + rnd() * 0.6); } }
    else if (B.type === 'plaza') { fountains.push([cx, 14, cz]); for (const [a, b] of [[0.14, 0.14], [0.86, 0.14], [0.14, 0.86], [0.86, 0.86]]) tree(x0 + (x1 - x0) * a, z0 + (z1 - z0) * b, 1 + rnd() * 0.3); }
    else if (B.type === 'lake') { lakesM.push(B); for (let k = 0; k < 16; k++) { const a = rnd() * Math.PI * 2; tree(cx + Math.cos(a) * (x1 - x0) * 0.47, cz + Math.sin(a) * (z1 - z0) * 0.44, 0.7 + rnd() * 0.5); } }
    else for (const L of B.lots) {
      const { x, z, lw, ld, fx, fz } = L;
      if (L.kind === 'lawn') { const n = 1 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) tree(x + (rnd() - 0.5) * lw * 0.7, z + (rnd() - 0.5) * ld * 0.7, 0.8 + rnd() * 0.5); continue; }
      if (L.kind === 'parking') { if (dist < 3200) for (let k = 0; k < 7; k++) if (rnd() < 0.4) { const xx = x - lw / 2 + lw * (k + 0.5) / 8; car(xx, z - ld * 0.32, false); if (rnd() < 0.5) car(xx, z + ld * 0.32, false); } continue; }
      if (L.kind === 'house') {
        const bw = Math.min(170, lw * (0.42 + rnd() * 0.14)), bd = Math.min(160, ld * (0.4 + rnd() * 0.12)), modern = rnd() < 0.5, v = modern ? 2 + Math.floor(rnd() * 2) : Math.floor(rnd() * 2), h = modern ? 70 + rnd() * 15 : 80 + rnd() * 30;
        const hx = x - fx * lw * 0.08, hz = z - fz * ld * 0.08; // um pouco pra trás (quintal na frente)
        box(G.house[v], bw, h, bd, hx, 0, hz, (g) => faceUV(g, 0));
        if (modern) { capsW.push([hx, h + 3, hz, bw + 10, 6, bd + 10]); if (rnd() < 0.6) { const w2 = bw * 0.6, d2 = bd * 0.7, sx = (rnd() - 0.5) * (bw - w2); box(G.house[v], w2, 62, d2, hx + sx, h + 6, hz, (g) => faceUV(g, 0)); capsW.push([hx + sx, h + 71, hz, w2 + 10, 6, d2 + 10]); } }
        else { roofs.push([hx, h + 30, hz, bw * 0.76, 60, bd * 0.76, Math.PI / 4]); roofCols.push(new THREE.Color().setHSL(0.03 + rnd() * 0.05, 0.25 + rnd() * 0.2, 0.22 + rnd() * 0.14)); }
        for (let k = 0; k < 2; k++) if (rnd() < 0.7) tree(x + (rnd() - 0.5) * lw * 0.8, z + (rnd() - 0.5) * ld * 0.8, 0.7 + rnd() * 0.35);
        if (dist < 3000 && rnd() < 0.5) car(x + fx * lw * 0.32 + (fx ? 0 : lw * 0.2), z + fz * ld * 0.32 + (fz ? 0 : ld * 0.2), !!fz);
      } else if (L.kind === 'shop') {
        const bw = lw * (0.62 + rnd() * 0.16), bd = ld * (0.48 + rnd() * 0.14), h = 90 + rnd() * 50, v = Math.floor(rnd() * shopT.length);
        const sx = x - fx * lw * 0.12, sz = z - fz * ld * 0.12;
        box(G.shop[v], bw, h, bd, sx, 0, sz, (g) => faceUV(g, 180)); caps.push([sx, h + 4, sz, bw + 6, 8, bd + 6]);
        if (rnd() < 0.5) mech.push([sx + (rnd() - 0.5) * bw * 0.4, h + 8, sz + (rnd() - 0.5) * bd * 0.4, 40, 20, 30]);
        if (dist < 3000) for (let k = 0; k < 3; k++) if (rnd() < 0.5) car(sx + fx * (bw / 2 + 50) + (fx ? 0 : (k - 1) * 45), sz + fz * (bd / 2 + 50) + (fz ? 0 : (k - 1) * 45), !fx);
      } else {
        const bw = lw * (0.5 + rnd() * 0.18), bd = ld * (0.5 + rnd() * 0.18), h = 200 + rnd() * 300 + near * (250 + rnd() * 700), v = Math.floor(rnd() * facades.length), LH = 90;
        box(G.lobby[0], bw + 26, LH, bd + 26, x, 0, z, (g) => faceUV(g, 150)); capsW.push([x, LH + 3, z, bw + 40, 6, bd + 40]); // térreo com marquise
        box(G.tall[v], bw, h - LH, bd, x, LH, z, (g) => boxUV(g, bw, h - LH, bd, 1 / 384));
        let top = h;
        if (h > 420 && rnd() < 0.45) { const w2 = bw * 0.72, d2 = bd * 0.72, h2 = 96 * (1 + Math.floor(rnd() * 3)); box(G.tall[v], w2, h2, d2, x, h, z, (g) => boxUV(g, w2, h2, d2, 1 / 384)); caps.push([x, h + 4, z, bw + 6, 8, bd + 6]); top = h + h2; caps.push([x, top + 4, z, w2 + 6, 8, d2 + 6]); mech.push([x, top + 8, z, w2 * 0.4, 26, d2 * 0.4]); }
        else { caps.push([x, h + 4, z, bw + 6, 8, bd + 6]); mech.push([x + bw * 0.18, h + 8, z - bd * 0.12, bw * 0.3, 24, bd * 0.3]); if (rnd() < 0.5) mech.push([x - bw * 0.22, h + 8, z + bd * 0.2, 36, 36, 36]); }
        for (const s of [-1, 1]) if (rnd() < 0.7) tree(x + s * (bw / 2 + 40), z + (rnd() - 0.5) * bd, 0.9 + rnd() * 0.3);
      }
    }
    // árvores e postes na calçada; carros estacionados na beira da rua (só nos quarteirões mais perto)
    if (dist < 3000) {
      for (let x = x0 + 60; x < x1 - 40; x += 160) for (const z of [z0 - SW / 2, z1 + SW / 2]) { if (rnd() < 0.35) tree(x, z, 0.75 + rnd() * 0.3); else if (rnd() < 0.45) poles.push([x, 70, z, 4, 140, 4]); }
      for (let z = z0 + 60; z < z1 - 40; z += 180) for (const x of [x0 - SW / 2, x1 + SW / 2]) if (rnd() < 0.3) poles.push([x, 70, z, 4, 140, 4]);
      for (let x = x0 + 40; x < x1 - 60; x += 120) for (const z of [z0 - SW - 22, z1 + SW + 22]) if (rnd() < 0.18) car(x, z, true);
      for (let z = z0 + 40; z < z1 - 60; z += 120) for (const x of [x0 - SW - 22, x1 + SW + 22]) if (rnd() < 0.14) car(x, z, false);
    }
  }
  const add = (list, texs, rough) => list.forEach((l, v) => { if (!l.length) return; const m = new THREE.Mesh(mergeGeos(l), new THREE.MeshStandardMaterial({ map: texs[v], roughness: Array.isArray(rough) ? rough[v] : rough, metalness: Array.isArray(rough) && rough[v] < 0.5 ? 0.15 : 0 })); m.receiveShadow = true; mapGroup.add(m); });
  add(G.tall, facades, facadeRough); add(G.house, houseT, 0.9); add(G.shop, shopT, 0.7); add(G.lobby, [lobbyT], 0.5);
  instanced(new THREE.BoxGeometry(1, 1, 1), mat(0x6b7078, { roughness: 0.8 }), caps);
  if (capsW.length) instanced(new THREE.BoxGeometry(1, 1, 1), mat(0xe9e7e2, { roughness: 0.8 }), capsW); // laje/marquise branca
  if (mech.length) instanced(new THREE.BoxGeometry(1, 1, 1), mat(0x9aa0a6, { roughness: 0.6, metalness: 0.3 }), mech.map((m) => [m[0], m[1] + m[4] / 2, m[2], m[3], m[4], m[5]])); // máquinas no telhado
  if (roofs.length) { const rm = instanced(new THREE.ConeGeometry(1, 1, 4), mat(0xffffff, { roughness: 0.9 }), roofs); roofCols.forEach((c, i) => rm.setColorAt(i, c)); rm.instanceColor.needsUpdate = true; } // telhados de casa
  instanced(new THREE.ConeGeometry(1, 1, 7), mat(0x3f7d3a, { roughness: 1 }), trees); instanced(new THREE.BoxGeometry(1, 1, 1), mat(0x5a4330), trunks);
  if (poles.length) instanced(new THREE.BoxGeometry(1, 1, 1), mat(0x4b5563, { metalness: 0.5, roughness: 0.5 }), poles);
  if (cars.length) { const cm = instanced(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff, { roughness: 0.4, metalness: 0.35 }), cars); carCols.forEach((c, i) => cm.setColorAt(i, c)); cm.instanceColor.needsUpdate = true;
    instanced(new THREE.BoxGeometry(1, 1, 1), mat(0x1f2937, { roughness: 0.3, metalness: 0.5 }), cars.map((c) => [c[0], c[1] + 18, c[2], c[3] * (c[3] > c[5] ? 0.55 : 0.9), 16, c[5] * (c[5] > c[3] ? 0.55 : 0.9)])); } // vidros
  if (fountains.length) { instanced(new THREE.CylinderGeometry(52, 56, 28, 20), mat(0xd6cfbf), fountains); instanced(new THREE.CylinderGeometry(46, 46, 2, 20), mat(0x5aa0c0, { roughness: 0.2 }), fountains.map((f) => [f[0], 29, f[2], 1, 1, 1])); instanced(new THREE.CylinderGeometry(6, 9, 40, 10), mat(0xd6cfbf), fountains.map((f) => [f[0], 34, f[2], 1, 1, 1])); }
  for (const B of lakesM) { const w = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x3e7f9a, roughness: 0.2, metalness: 0.15 })); w.rotation.x = -Math.PI / 2; w.scale.set((B.x1 - B.x0) * 0.4, (B.z1 - B.z0) * 0.36, 1); w.position.set(B.cx, -0.8, B.cz); mapGroup.add(w); }
}
function updateObraFx(now, dt) {
  if (!obraFx) return;
  const F = obraFx, C = sim.crane;
  let a = F.a, y = CRANE.parkY, show = 0;
  if (C && C.s >= 1) { // (sem círculo vermelho no chão)
    if (C.s === 2 && C.t2 != null) { a = craneAngle(C, sim.time); y = CRANE.y; }
    else { a = C.a0; y = CRANE.parkY + (CRANE.y - CRANE.parkY) * Math.min(1, (C.k || 0) * 1.3); }
  } else a = C && C.rest != null ? C.rest : 0; // parada: a lança fica onde a bola parou (é de lá que ela começa a próxima volta)
  F.a = a;
  F.jib.rotation.y = -a; // o x da lança aponta pro ângulo a
  const drop = CRANE_TOP - y; F.cable.scale.y = drop - CRANE.ball; F.cable.position.set(CRANE.R, -(drop - CRANE.ball) / 2, 0);
  F.ball.position.set(CRANE.R, -drop, 0); F.hook.position.set(CRANE.R, -drop + CRANE.ball + 6, 0);
  F.ringM.opacity += (show - F.ringM.opacity) * Math.min(1, dt * 8);
}
// ---------- fábrica: pistões que sobem e descem e esteiras que andam ----------
let factoryFx = null;
function buildFactory(w) {
  const W = w.W, H = w.H, pistons = [], belts = [];
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ae, metalness: 0.75, roughness: 0.3 }), capM = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
  for (const R of w.walls) if (R.piston) {
    const g = new THREE.Group(); g.position.set(R.x + R.w / 2, 0, R.y + R.h / 2);
    const col = new THREE.Mesh(new THREE.BoxGeometry(R.w - 10, 1, R.h - 10), steel); col.castShadow = col.receiveShadow = true; g.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(R.w, 10, R.h), capM); cap.castShadow = cap.receiveShadow = true; g.add(cap);
    mapGroup.add(g); pistons.push({ R, col, cap });
  }
  const beltTex = canvasTex(128, 128, (g) => { g.fillStyle = '#23262b'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#3a3f46'; for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 6); g.fillStyle = '#e0b020'; for (let y = 0; y < 128; y += 64) { g.beginPath(); g.moveTo(40, y + 10); g.lineTo(64, y + 40); g.lineTo(88, y + 10); g.lineTo(76, y + 10); g.lineTo(64, y + 26); g.lineTo(52, y + 10); g.fill(); } }, true);
  for (const B of w.belts || []) {
    const bw = B.x1 - B.x0, bl = B.z1 - B.z0, t = beltTex.clone(); t.needsUpdate = true; t.repeat.set(1, bl / bw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); m.rotation.x = -Math.PI / 2; if (B.vz < 0) m.rotation.z = Math.PI; m.position.set((B.x0 + B.x1) / 2, 0.8, (B.z0 + B.z1) / 2); m.receiveShadow = true; mapGroup.add(m);
    for (const sx of [B.x0 - 4, B.x1 + 4]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(6, 6, bl), steel); rail.position.set(sx, 3, (B.z0 + B.z1) / 2); mapGroup.add(rail); }
    belts.push({ B, t, bw });
  }
  // pontes em Z lá em cima: piso de aço com esteira (setas pro lado que ela leva), faixa amarela nas bordas,
  // viga embaixo e tirantes presos no teto (tudo em poucos desenhos)
  const bridges = [], rods = [], edges = [], under = [], ceilY = w.ceilingY || 480;
  const bTex = canvasTex(128, 128, (g) => { g.fillStyle = '#2a2d33'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#3b4048'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 6, 128); g.fillStyle = '#e0b020'; for (const x of [16, 80]) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 30, 64); g.lineTo(x, 94); g.lineTo(x + 12, 94); g.lineTo(x + 42, 64); g.lineTo(x + 12, 34); g.fill(); } }, true);
  const deckM = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.6, roughness: 0.45 }), o3 = new THREE.Object3D();
  const push = (arr, x, y, z, sx, sy, sz, ry) => { o3.position.set(x, y, z); o3.rotation.set(0, ry, 0); o3.scale.set(sx, sy, sz); o3.updateMatrix(); arr.push(o3.matrix.clone()); };
  for (const B of w.bridges || []) {
    const dx = B.bx - B.ax, dz = B.bz - B.az, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), mx = (B.ax + B.bx) / 2, mz = (B.az + B.bz) / 2, wd = B.hw * 2;
    push(under, mx, B.top - 7, mz, len, 14, wd, ry); // o piso
    push(under, mx, B.top - 20, mz, len, 12, 14, ry); // viga embaixo
    const nx = -dz / len, nz = dx / len;
    for (const s of [-1, 1]) push(edges, mx + nx * s * (B.hw - 3), B.top + 0.8, mz + nz * s * (B.hw - 3), len, 1.6, 6, ry);
    for (let u = 60; u < len - 30; u += 260) for (const s of [-1, 1]) { const px = B.ax + dx / len * u + nx * s * (B.hw - 4), pz = B.az + dz / len * u + nz * s * (B.hw - 4); push(rods, px, (B.top + ceilY) / 2, pz, 2.4, ceilY - B.top, 2.4, 0); }
    const t = bTex.clone(); t.needsUpdate = true; t.repeat.set(len / wd, 1);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(len, wd - 14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0.2 }));
    belt.rotation.set(-Math.PI / 2, 0, ry); belt.position.set(mx, B.top + 0.6, mz); belt.receiveShadow = true; mapGroup.add(belt);
    bridges.push({ B, t, wd });
  }
  const inst = (arr, m, sh) => { if (!arr.length) return; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m, arr.length); arr.forEach((q, i) => im.setMatrixAt(i, q)); im.castShadow = !!sh; im.receiveShadow = true; mapGroup.add(im); };
  inst(under, deckM, true); inst(edges, new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })); inst(rods, steel);
  // lá no alto: vigas do telhado e lâmpadas industriais já vêm do teto
  factoryFx = { pistons, belts, bridges };
}
function updateFactoryFx(dt) {
  if (!factoryFx) return;
  for (const q of factoryFx.pistons) { const top = pistonTop(q.R.piston, sim.time); q.col.scale.y = Math.max(0.5, top - 8); q.col.position.y = Math.max(0.25, (top - 8) / 2); q.cap.position.y = Math.max(5, top - 5); }
  for (const b of factoryFx.belts) b.t.offset.y += dt * Math.abs(b.B.vz) / b.bw; // a textura anda pro mesmo lado que a esteira empurra
  for (const b of factoryFx.bridges || []) b.t.offset.x -= dt * b.B.belt / b.wd; // setas andam pro lado que a ponte leva
}
// ---------- mar: oceano, plataforma, navio com torcida, boias e gaivotas; a onda gigante ----------
let seaFx = null;
const OCEAN_VERT = `uniform float uTime; varying float vH; varying vec3 vW;
void main(){ vec3 p = position; vec4 w0 = modelMatrix * vec4(p, 1.0);
  float h = sin(w0.x * 0.004 + uTime * 1.1) * 14.0 + sin(w0.z * 0.006 - uTime * 1.4) * 10.0 + sin((w0.x + w0.z) * 0.011 + uTime * 2.1) * 5.0;
  w0.y += h; vH = h; vW = w0.xyz; gl_Position = projectionMatrix * viewMatrix * w0; }`;
const OCEAN_FRAG = `uniform float uTime; varying float vH; varying vec3 vW; ${NOISE_GLSL}
void main(){ float n = fbm(vW.xz * 0.004 + uTime * 0.05); vec3 deep = vec3(0.05, 0.26, 0.42), light = vec3(0.16, 0.52, 0.7);
  vec3 c = mix(deep, light, clamp(vH / 30.0 + 0.5 + n * 0.3, 0.0, 1.0)); c += vec3(0.9) * smoothstep(0.78, 0.95, n) * 0.35;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function buildSea(w) {
  const W = w.W, H = w.H;
  const oceanMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000, 160, 160), oceanMat); ocean.rotation.x = -Math.PI / 2; ocean.position.set(W / 2, -70, H / 2); mapGroup.add(ocean);
  // a plataforma: laje de madeira grossa em cima de pilares
  const side = mat(0x5a4330), pil = mat(0x4a3a2c);
  for (const [x, z, sw, sd] of [[W / 2, -8, W + 16, 16], [W / 2, H + 8, W + 16, 16], [-8, H / 2, 16, H + 32], [W + 8, H / 2, 16, H + 32]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sw, 60, sd), side); b.position.set(x, -30, z); mapGroup.add(b); }
  for (let x = 0; x <= W; x += W / 8) for (const z of [0, H]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 260, 10), pil); c.position.set(x, -150, z); mapGroup.add(c); }
  for (let z = H / 6; z < H; z += H / 6) for (const x of [0, W]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 260, 10), pil); c.position.set(x, -150, z); mapGroup.add(c); }
  // borda: só o murinho baixo de madeira (sem vidro) — a parede continua lá, invisível, pra ninguém cair no mar
  const parM = mat(0x5a4330);
  for (const R of w.walls) if (R.border) { const base = new THREE.Mesh(new THREE.BoxGeometry(R.w, 14, R.h), parM); base.position.set(R.x + R.w / 2, 7, R.y + R.h / 2); mapGroup.add(base); }
  // ralos na base da borda (a água da onda sai por eles)
  const drainM = new THREE.MeshBasicMaterial({ color: 0x111418 }), drains = [];
  for (let x = 120; x < W - 60; x += 160) for (const [z, ry] of [[w.t + 0.7, 0], [H - w.t - 0.7, Math.PI]]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(46, 14), drainM); d.position.set(x, 9, z); d.rotation.y = ry; mapGroup.add(d); drains.push([x, z, 0, ry === 0 ? -1 : 1]); }
  for (let z = 120; z < H - 60; z += 160) for (const [x, ry] of [[w.t + 0.7, Math.PI / 2], [W - w.t - 0.7, -Math.PI / 2]]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(46, 14), drainM); d.position.set(x, 9, z); d.rotation.y = ry; mapGroup.add(d); drains.push([x, z, ry > 0 ? -1 : 1, 0]); }
  // navio alto do lado de cima (a onda nunca vem de lá)
  const ship = new THREE.Group(), hullM = mat(0x7a1f1f), whiteM = mat(0xf3f4f6), deckM = mat(0x8a6a48);
  const hs = new THREE.Shape(); hs.moveTo(-900, 0); hs.lineTo(820, 0); hs.quadraticCurveTo(1000, 0, 1060, 120); hs.lineTo(1080, 300); hs.lineTo(-960, 300); hs.lineTo(-900, 0);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 420, bevelEnabled: false }), hullM); hull.position.set(0, -110, -210); ship.add(hull);
  const band = new THREE.Mesh(new THREE.BoxGeometry(2040, 20, 424), whiteM); band.position.set(60, 170, 0); ship.add(band);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2020, 8, 410), deckM); deck.position.set(60, 190, 0); ship.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(420, 200, 300), whiteM); cabin.position.set(-450, 294, 0); ship.add(cabin);
  for (let i = 0; i < 6; i++) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x335577 })); wn.position.set(-620 + i * 68, 320, 151); ship.add(wn); }
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(45, 55, 180, 16), mat(0x1f2937)); chim.position.set(-450, 480, 0); ship.add(chim);
  for (const [x, col] of [[250, TEAM.A], [650, TEAM.B]]) { const mast = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 320, 8), mat(0x3b2a1b)); mast.position.set(x, 350, 0); ship.add(mast); const fl = new THREE.Mesh(new THREE.PlaneGeometry(120, 70, 8, 2), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide })); fl.position.set(x + 62, 470, 0); fl.userData.flag = true; ship.add(fl); }
  ship.position.set(W / 2, 0, -560); mapGroup.add(ship);
  // torcida no convés: centenas de torcedores bem leves (pontinhos com desenho, num só desenho da placa de vídeo),
  // metade de cada time, pulando e balançando os braços
  // cada canal de cor do desenho é uma parte: vermelho = camisa, verde = pele, azul = cabelo/boné, roxo = calça
  const FAN_TEX = canvasTex(256, 128, (g) => {
    for (const [ox, up] of [[0, 0], [128, 1]]) { // 2 quadros: braços meio pra cima / lá em cima
      const cx = ox + 64;
      g.fillStyle = '#ff00ff'; g.fillRect(cx - 15, 92, 13, 36); g.fillRect(cx + 2, 92, 13, 36); // pernas (calça)
      g.fillStyle = '#ff0000'; g.beginPath(); g.moveTo(cx - 20, 96); g.lineTo(cx + 20, 96); g.lineTo(cx + 22, 58); g.quadraticCurveTo(cx + 20, 46, cx + 10, 45); g.lineTo(cx - 10, 45); g.quadraticCurveTo(cx - 20, 46, cx - 22, 58); g.closePath(); g.fill(); // camisa
      g.lineCap = 'round'; g.lineWidth = 10;
      for (const sd of [-1, 1]) { // braços (manga da camisa + mão)
        const ex = cx + sd * (up ? 22 : 30), ey = up ? 26 : 40, hx = cx + sd * (up ? 24 : 36), hy = up ? 8 : 24;
        g.strokeStyle = '#ff0000'; g.beginPath(); g.moveTo(cx + sd * 16, 52); g.lineTo(ex, ey); g.stroke();
        g.strokeStyle = '#00ff00'; g.lineWidth = 8; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx, hy); g.stroke(); g.lineWidth = 10;
        g.fillStyle = '#00ff00'; g.beginPath(); g.arc(hx, hy, 5, 0, 7); g.fill();
      }
      g.fillStyle = '#00ff00'; g.fillRect(cx - 5, 36, 10, 10); g.beginPath(); g.ellipse(cx, 28, 12, 13, 0, 0, 7); g.fill(); // pescoço e rosto
      g.fillStyle = '#0000ff'; g.beginPath(); g.ellipse(cx, 22, 13, 9, 0, Math.PI, 0); g.fill(); g.fillRect(cx - 13, 20, 4, 8); g.fillRect(cx + 9, 20, 4, 8); // cabelo/boné
    }
  });
  FAN_TEX.colorSpace = THREE.NoColorSpace;
  const NF = 420, fpos = new Float32Array(NF * 3), fcol = new Float32Array(NF * 3), fph = new Float32Array(NF), fskin = new Float32Array(NF * 3), fhair = new Float32Array(NF * 3), fpant = new Float32Array(NF * 3);
  const ca = new THREE.Color(TEAM.A), cb = new THREE.Color(TEAM.B), cc = new THREE.Color();
  const skins = [0xf6d2b3, 0xf1c9a5, 0xe0b08a, 0xd9a47a, 0xc08a5e, 0xa8714a, 0x8a5a38, 0x6b4428, 0x4e3120];
  const hairs = [0x1a1410, 0x2b1d12, 0x4a2f1a, 0x6b4423, 0xb98a4e, 0xd8b56a, 0x8a3a1c, 0x9a9a9a, 0x101010];
  const pants = [0x2a3b5c, 0x33475f, 0x1f2937, 0x3a3a3a, 0x6b5a44, 0x4b5563, 0x111827];
  for (let i = 0; i < NF; i++) {
    const row = i % 7, x = -330 + Math.random() * 1320, z = 185 - row * 52 + (Math.random() - 0.5) * 18, team = x > 330 ? cb : ca, r = Math.random();
    fpos[i * 3] = x; fpos[i * 3 + 1] = 216 + (row % 2) * 4; fpos[i * 3 + 2] = z;
    // camisa: na cor do time com tons bem variados; alguns de branco, preto ou cinza (camisa reserva)
    if (r < 0.1) cc.set(0xf1f1f1); else if (r < 0.16) cc.set(0x1c1c1c); else if (r < 0.2) cc.set(0x8a8f98);
    else cc.copy(team).offsetHSL((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.36);
    fcol.set([cc.r, cc.g, cc.b], i * 3);
    cc.set(skins[Math.floor(Math.random() * skins.length)]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06); fskin.set([cc.r, cc.g, cc.b], i * 3);
    if (Math.random() < 0.25) cc.copy(team).offsetHSL(0, 0, -0.1); else cc.set(hairs[Math.floor(Math.random() * hairs.length)]); // boné do time ou cabelo
    fhair.set([cc.r, cc.g, cc.b], i * 3);
    cc.set(pants[Math.floor(Math.random() * pants.length)]); fpant.set([cc.r, cc.g, cc.b], i * 3);
    fph[i] = Math.random() * 20;
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fg.setAttribute('aCol', new THREE.BufferAttribute(fcol, 3)); fg.setAttribute('aSkin', new THREE.BufferAttribute(fskin, 3)); fg.setAttribute('aHair', new THREE.BufferAttribute(fhair, 3)); fg.setAttribute('aPant', new THREE.BufferAttribute(fpant, 3)); fg.setAttribute('aPh', new THREE.BufferAttribute(fph, 1));
  const fanMat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: FAN_TEX }, uTime: { value: 0 }, uScale: { value: 400 } }, transparent: false,
    vertexShader: `uniform float uTime, uScale; attribute vec3 aCol, aSkin, aHair, aPant; attribute float aPh; varying vec3 vCol, vSkin, vHair, vPant; varying float vFr;
      void main(){ vCol = aCol; vSkin = aSkin; vHair = aHair; vPant = aPant; vec3 p = position; p.y += max(0.0, sin(uTime * 6.0 + aPh)) * 9.0; vFr = step(0.2, sin(uTime * 4.3 + aPh * 1.7));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = uScale * 50.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying vec3 vCol, vSkin, vHair, vPant; varying float vFr;
      void main(){ vec2 uv = vec2((gl_PointCoord.x * 0.5 + vFr * 0.5), 1.0 - gl_PointCoord.y); vec4 t = texture2D(uTex, uv);
        if (t.r < 0.45 && t.g < 0.45 && t.b < 0.45) discard;
        vec3 c = (t.r > 0.45 && t.b > 0.45) ? vPant : t.r > 0.45 ? vCol : t.g > 0.45 ? vSkin : vHair;
        c *= 0.72 + 0.4 * (1.0 - gl_PointCoord.y); gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const fans = new THREE.Points(fg, fanMat); fans.frustumCulled = false; ship.add(fans);
  const crowd = [];
  // boias e gaivotas
  const buoys = [], buoyR = mat(0xdc2626), buoyW = mat(0xf8fafc);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.3, d = 1550 + (i % 3) * 420, x = W / 2 + Math.cos(a) * d * 1.1, z = H / 2 + Math.sin(a) * d * 0.8;
    if (z < -300 && Math.abs(x - W / 2) < 1300) continue; // não em cima do navio
    const g = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.CylinderGeometry(22, 28, 40, 12), buoyR); b1.position.y = 20; const b2 = new THREE.Mesh(new THREE.ConeGeometry(18, 46, 12), buoyW); b2.position.y = 62; const lt = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066 })); lt.position.y = 90;
    g.add(b1, b2, lt); g.position.set(x, -70, z); mapGroup.add(g); buoys.push({ g, ph: i * 1.3 });
  }
  // gaivotas (menos e com cara de gaivota): corpo, cabeça, bico amarelo, rabo e asas em 2 partes (ponta preta)
  const gullM = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 }), greyM = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.8, side: THREE.DoubleSide }), tipM = new THREE.MeshStandardMaterial({ color: 0x1f2937, side: THREE.DoubleSide }), beakM = mat(0xf2b705), gulls = [];
  const wingShape = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) sh.lineTo(q[0], q[1]); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; };
  const innerG = wingShape([[0, 5], [15, 4], [16, -4], [0, -5]]), outerG = wingShape([[0, 4], [9, 2], [19, -3], [1, -4]]), outerTipG = wingShape([[9, 2], [19, -3], [13, -3.5]]);
  const mkGull = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), gullM); body.scale.set(1, 0.9, 2.6); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(3.1, 10, 8), gullM); head.position.set(0, 1.8, 10); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 6), beakM); beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.4, 14.2); g.add(beak);
    const tail = new THREE.Mesh(wingShape([[-3, 0], [3, 0], [2, 7], [-2, 7]]), greyM); tail.position.set(0, 0.4, -9); g.add(tail);
    const wl = [];
    for (const sx of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(sx * 3, 1, 1); piv.scale.x = sx; g.add(piv);
      const inner = new THREE.Mesh(innerG, greyM); piv.add(inner);
      const piv2 = new THREE.Group(); piv2.position.x = 15; piv.add(piv2);
      piv2.add(new THREE.Mesh(outerG, greyM), new THREE.Mesh(outerTipG, tipM));
      wl.push([piv, piv2, sx]);
    }
    g.userData.wings = wl; g.scale.setScalar(1.6); return g;
  };
  for (let i = 0; i < 6; i++) { const g = mkGull(); g.userData.fly = { r: 900 + Math.random() * 1400, h: 250 + Math.random() * 350, sp: 0.12 + Math.random() * 0.15, ph: Math.random() * 6 }; mapGroup.add(g); gulls.push(g); }
  buoys.slice(0, 3).forEach((b) => { const g = mkGull(); g.userData.perch = b; g.userData.wings.forEach(([p, p2, sx]) => { p.rotation.z = sx * 0.15; p2.rotation.z = -0.1; p.rotation.y = sx * 1.1; }); mapGroup.add(g); gulls.push(g); });
  // a onda gigante: parede de água com a crista enrolando, cor de mar (escura embaixo, verde-água transparente em cima),
  // espuma na crista e spray; vem lá do horizonte crescendo e atravessa o mapa
  const span = Math.max(W, H) + 60, spanW = span + 700, crestG = new THREE.PlaneGeometry(1, 1, 110, 22), cp = crestG.attributes.position, aU = new Float32Array(cp.count);
  for (let i = 0; i < cp.count; i++) {
    const u = cp.getY(i) + 0.5, xx = cp.getX(i), x = xx * spanW; // u: 0 (atrás, no chão) -> 1 (frente, no chão)
    const tp = Math.min(1, (0.5 - Math.abs(xx)) / 0.12), taper = tp * tp * (3 - 2 * tp), hv = (1 + 0.1 * Math.sin(xx * 11) + 0.05 * Math.sin(xx * 29 + 1)) * taper;
    let y, z;
    if (u < 0.55) { const k = u / 0.55; y = 240 * Math.sin(k * Math.PI / 2); z = -360 + k * 340; } // costas da onda subindo
    else { const k = (u - 0.55) / 0.45, a = k * Math.PI * 0.95; y = 240 - 120 + Math.cos(a) * 120; z = -20 + Math.sin(a) * 80; } // crista enrolando e caindo na frente
    cp.setXYZ(i, x, y * hv, z * (0.6 + 0.4 * taper)); aU[i] = u;
  }
  crestG.setAttribute('aU', new THREE.BufferAttribute(aU, 1)); crestG.computeVertexNormals();
  const waveMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOp: { value: 0.93 } }, transparent: true, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime; attribute float aU; varying float vU; varying float vX; varying vec3 vN; varying vec3 vW;
      void main(){ vU = aU; vX = position.x; vec3 p = position;
        float n = sin(p.x * 0.013 + uTime * 2.3) * 0.5 + sin(p.x * 0.031 - uTime * 3.1) * 0.3;
        p.y += n * 12.0 * sin(aU * 3.14159) * step(1.0, p.y);
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform float uOp; varying float vU; varying float vX; varying vec3 vN; varying vec3 vW; ${NOISE_GLSL}
      void main(){
        vec3 deep = vec3(0.02, 0.16, 0.30), mid = vec3(0.04, 0.40, 0.56), light = vec3(0.26, 0.74, 0.80);
        float u = vU, hf = u < 0.55 ? u / 0.55 : 1.0 - (u - 0.55) / 0.45; // altura na onda (0 no chão, 1 na crista)
        vec3 c = mix(deep, mid, smoothstep(0.0, 0.5, hf)); c = mix(c, light, smoothstep(0.45, 1.0, hf) * 0.85); // perto da crista a luz passa pela água
        float n = fbm(vec2(vX * 0.012, u * 6.0 - uTime * 1.6));
        float foam = smoothstep(0.46, 0.55, u + (n - 0.5) * 0.12) * (1.0 - smoothstep(0.6, 0.72, u + (n - 0.5) * 0.1)); // espuma só na crista
        foam = max(foam, smoothstep(0.9, 1.0, u) * 0.85);                             // espuma batendo embaixo, na frente
        float streak = smoothstep(0.62, 0.86, fbm(vec2(vX * 0.025, u * 9.0 - uTime * 0.9))) * smoothstep(0.15, 0.6, hf) * 0.45; // riscos de espuma
        c = mix(c, vec3(0.95, 0.98, 1.0), clamp(foam * 0.92 + streak, 0.0, 1.0));
        float l = 0.6 + 0.4 * max(0.0, dot(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), normalize(vec3(-0.3, 0.8, 0.4))));
        gl_FragColor = vec4(c * l, uOp * (0.82 + foam * 0.18));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const waveG = new THREE.Group(), crest = new THREE.Mesh(crestG, waveMat); crest.frustumCulled = false; waveG.add(crest);
  // spray: gotinhas saindo da crista
  const SPN = 260, spPos = new Float32Array(SPN * 3), spSeed = [];
  for (let i = 0; i < SPN; i++) spSeed.push([(Math.random() - 0.5) * span, Math.random(), 0.6 + Math.random() * 0.8]);
  const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const spray = new THREE.Points(spG, new THREE.PointsMaterial({ map: GLOW_TEX, color: 0xeaf6ff, size: 34, transparent: true, opacity: 0.75, depthWrite: false }));
  spray.frustumCulled = false; waveG.add(spray);
  waveG.visible = false; mapGroup.add(waveG);
  seaFx = { oceanMat, crowd, fanMat, buoys, gulls, waveG, waveMat, spray, spSeed, drains, W, H, wet: 0, spills: [], ship };
}
// torcida do navio: grita de tempos em tempos, mais alto quanto mais perto do navio
// torcida do navio: um murmúrio de fundo baixinho (perto do navio) e, de vez em quando e quando alguém morre, o povo grita
function cheerNear(F) { const me = sim.players.get('me'); if (!me) return 0; const d = Math.hypot(me.x - F.W / 2, me.z - (-560)); return Math.max(0, Math.min(1, 1.25 - d / 1800)); }
function cheerSound(F, dt) {
  const near = cheerNear(F);
  SFX.setBed('crowd', 0.035 * near, 'bandpass', 700, 0.8); SFX.setBed('seaAmb', 0.03, 'lowpass', 420);
  F.cheerT = (F.cheerT == null ? 3 : F.cheerT) - dt; if (F.cheerT > 0) return; F.cheerT = 7 + Math.random() * 6;
  if (near > 0.05) SFX.play('cheer', near * (sim.wave && sim.wave.s === 2 ? 0.9 : 0.55), { pan: Math.max(-1, Math.min(1, (F.W / 2 - sim.players.get('me').x) / 900)) });
}
function updateSeaFx(now, dt) {
  if (!seaFx) return;
  const F = seaFx, ts = now / 1000, W = F.W, H = F.H;
  F.oceanMat.uniforms.uTime.value = ts;
  F.fanMat.uniforms.uTime.value = ts; F.fanMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  cheerSound(F, dt);
  F.ship.traverse((o) => { if (o.userData.flag) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.08 + ts * 6) * (p.getX(i) + 60) * 0.08); p.needsUpdate = true; } });
  for (const b of F.buoys) { b.g.position.y = -70 + Math.sin(ts * 1.4 + b.ph) * 8; b.g.rotation.z = Math.sin(ts * 1.1 + b.ph) * 0.12; }
  for (const g of F.gulls) {
    if (g.userData.perch) { const b = g.userData.perch.g; g.position.set(b.position.x, b.position.y + 100, b.position.z); g.rotation.y = ts * 0.2; continue; }
    const f = g.userData.fly, a = ts * f.sp + f.ph; g.position.set(W / 2 + Math.cos(a) * f.r, f.h + Math.sin(ts * 0.7 + f.ph) * 30, H / 2 + Math.sin(a) * f.r * 0.8); g.rotation.y = -a;
    g.rotation.z = 0.25; // inclinada na curva
    // bate as asas um pouco e plana (asa em "M", com a ponta dobrando atrás)
    const flap = 0.25 + 0.75 * Math.max(0, Math.sin(ts * 0.9 + f.ph)), w8 = Math.sin(ts * 7 + f.ph);
    for (const [p, p2, sx] of g.userData.wings) { p.rotation.z = sx * (w8 * 0.55 * flap + 0.12); p2.rotation.z = Math.sin(ts * 7 + f.ph - 0.9) * 0.45 * flap - 0.15; } // (a ponta já sai espelhada pelo pai)
  }
  const Wv = sim.wave;
  F.waveG.visible = false;
  if (Wv && Wv.t2 != null) {
    const horiz = Wv.side === 'L' || Wv.side === 'R', dir = Wv.side === 'L' || Wv.side === 'T' ? 1 : -1, len = horiz ? W : H;
    let d, grow = 1, yb = 0;
    const left = Wv.t2 - sim.time; // segundos até a onda chegar na borda
    if (left > 0) { // a próxima onda já está lá longe no mar, vindo e crescendo (dá pra ver de que lado ela vem)
      const k = Math.max(0, Math.min(1, 1 - left / 18)), e = k * k * (3 - 2 * k);
      d = -WAVE.band - (1 - k) * 6500; grow = 0.18 + 0.82 * e; yb = -70 * (1 - e);
    } else { d = (sim.time - Wv.t2) * WAVE.speed - WAVE.band; F.wet = 1; }
    if (d != null) {
      const pos = dir > 0 ? d : len - d, ry = horiz ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      F.waveG.visible = true; F.waveG.rotation.set(0, ry, 0); F.waveG.scale.set(1, grow, 1);
      if (horiz) F.waveG.position.set(pos, yb, H / 2); else F.waveG.position.set(W / 2, yb, pos);
      F.waveMat.uniforms.uTime.value = ts;
      const arr = F.spray.geometry.attributes.position.array;
      for (let i = 0; i < F.spSeed.length; i++) { const [x, ph, sp] = F.spSeed[i], t = (ts * sp + ph) % 1; arr[i * 3] = x; arr[i * 3 + 1] = 200 + t * 110 - t * t * 90; arr[i * 3 + 2] = 20 + t * 150; }
      F.spray.geometry.attributes.position.needsUpdate = true; F.spray.material.opacity = 0.75 * grow;
    }
  }
  F.wet = Math.max(0, F.wet - dt * 0.35); // (sem a água cobrindo o chão)
  // depois da onda: a água escorre pelos ralos de volta pro mar
  if (F.wet > 0.2 && Math.random() < dt * 30) {
    const q = F.drains[Math.floor(Math.random() * F.drains.length)], s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0xcfeaff, transparent: true, opacity: 0.8, depthWrite: false }));
    s.scale.setScalar(26); s.position.set(q[0], 8, q[1]); s.userData.v = [q[2] * 120, -60, q[3] * 120]; scene.add(s);
    effects.push({ t0: now, d: 900, objs: [s], upd: (t, dt2) => { const v = s.userData.v; v[1] -= 500 * dt2; s.position.x += v[0] * dt2; s.position.y += v[1] * dt2; s.position.z += v[2] * dt2; s.material.opacity = 0.8 * (1 - t); } });
  }
}

// ---------- estruturas só do 3D ----------
// pedra com cantos irregulares (caverna)
function rockGeo(w, h, d, seed) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / 40)), Math.max(1, Math.round(h / 40)), Math.max(1, Math.round(d / 40)));
  const pos = g.attributes.position, rnd = seeded(seed);
  for (let i = 0; i < pos.count; i++) { const k = 7; pos.setXYZ(i, pos.getX(i) + (rnd() - 0.5) * k, pos.getY(i) + (rnd() - 0.5) * k, pos.getZ(i) + (rnd() - 0.5) * k); }
  g.computeVertexNormals(); return g;
}
// casa na árvore no meio da floresta: tronco grosso, chão redondo de tábua lá em cima (sem parapeito), 2 escadas
const PLANK_TEX = canvasTex(256, 64, (g) => { g.fillStyle = '#8a5a34'; g.fillRect(0, 0, 256, 64); const rnd = seeded(41); for (let y = 0; y < 64; y += 16) { g.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.1})`; g.fillRect(0, y, 256, 2); for (let x = rnd() * 60; x < 256; x += 60 + rnd() * 60) g.fillRect(x, y, 2, 16); } g.strokeStyle = 'rgba(60,35,15,.25)'; for (let i = 0; i < 40; i++) { const x = rnd() * 256, y = rnd() * 64; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rnd() * 30, y + (rnd() - 0.5) * 3); g.stroke(); } }, true);
const _tintTex = new Map();
// UV da caixa em tamanho de verdade (k = repetições por unidade): assim várias paredes usam o mesmo material/textura
function boxUV(geo, sx, sy, sz, k) {
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) { const a = f < 2 ? sz : sx, b = f < 2 ? sy : f < 4 ? sz : sy; for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * a * k, uv.getY(i) * b * k); }
  uv.needsUpdate = true;
}
function tintTex(col, style) { const k = col + style; if (!_tintTex.has(k)) _tintTex.set(k, wallTexture(col, style)); return _tintTex.get(k); }
function buildTreehouse(T) {
  const { r, y, th, trunk, trunkTop } = TREEHOUSE, cx = T.x, cz = T.z;
  const bark = mat(0x4a3220), leafA = mat(0x3f7d3a), leafB = mat(0x356b31);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(trunk * 0.85, trunk * 1.3, trunkTop, 14), bark); tr.position.set(cx, trunkTop / 2, cz); tr.castShadow = tr.receiveShadow = true; mapGroup.add(tr);
  for (let i = 0; i < 5; i++) { const a = (i + 0.5) / 5 * Math.PI * 2, root = new THREE.Mesh(new THREE.ConeGeometry(12, 70, 6), bark); root.position.set(cx + Math.cos(a) * trunk, 18, cz + Math.sin(a) * trunk); root.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); mapGroup.add(root); }
  const pt = PLANK_TEX.clone(); pt.needsUpdate = true; pt.repeat.set(r * 2 / 160, r * 2 / 40);
  // chão redondo com os 2 buracos das escadas (dos lados do tronco)
  const fs = new THREE.Shape(); fs.absarc(0, 0, r, 0, Math.PI * 2, false);
  for (const sd of [-1, 1]) { const hp = new THREE.Path(), x0 = sd < 0 ? -(trunk + TREEHOUSE.hole) : trunk, x1 = sd < 0 ? -trunk : trunk + TREEHOUSE.hole; hp.moveTo(x0, -TREEHOUSE.holeW); hp.lineTo(x0, TREEHOUSE.holeW); hp.lineTo(x1, TREEHOUSE.holeW); hp.lineTo(x1, -TREEHOUSE.holeW); hp.lineTo(x0, -TREEHOUSE.holeW); fs.holes.push(hp); }
  const fg = new THREE.ExtrudeGeometry(fs, { depth: th, bevelEnabled: false, curveSegments: 40 }); fg.rotateX(Math.PI / 2); // deitado: a face de cima fica em y = 0
  { const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 160, uv.getY(i) / 40); }
  const ptm = PLANK_TEX.clone(); ptm.needsUpdate = true; ptm.repeat.set(1, 1);
  const floor = new THREE.Mesh(fg, [new THREE.MeshStandardMaterial({ map: ptm, roughness: 0.9, side: THREE.DoubleSide }), mat(0x5a3a22)]);
  floor.position.set(cx, y, cz); floor.castShadow = floor.receiveShadow = true; mapGroup.add(floor);
  void pt;
  for (let i = 0; i < 8; i++) { // vigas embaixo segurando o chão (presas no tronco)
    const a = (i + 0.5) / 8 * Math.PI * 2, beam = new THREE.Mesh(new THREE.BoxGeometry(8, 8, r * 1.05), bark);
    beam.position.set(cx + Math.cos(a) * r * 0.5, y - th - 5, cz + Math.sin(a) * r * 0.5); beam.rotation.y = -a + Math.PI / 2; mapGroup.add(beam); // viga reta, logo embaixo do chão
  }
  // escadas de mão presas no tronco (uma virada pra base de cada time)
  const railM = mat(0x7a5230), rungM = mat(0x9a6b3f);
  const hatchM = mat(0x6e4526), ironM = mat(0x3a3a3a, { metalness: 0.6, roughness: 0.5 });
  for (const L of world3dLadders(T)) {
    // escada inclinada (o pé afastado do tronco, que é mais largo embaixo): o grupo gira em volta do pé
    const tilt = L.tilt || 0, h = L.top + 34, g = new THREE.Group(), ang = Math.atan2(tilt, L.top);
    g.position.set(L.x + L.nx * (5 + tilt), 0, L.z + L.nz * (5 + tilt)); g.rotation.z = L.nx * ang; // (topo vai pro lado do tronco)
    for (const sd of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(4, h, 4), railM); rail.position.set(0, h / 2, sd * 17); rail.castShadow = true; g.add(rail); }
    for (let yy = 16; yy < h - 4; yy += 20) { const rung = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 6), rungM); rung.rotation.set(Math.PI / 2, 0, 0); rung.position.set(0, yy, 0); g.add(rung); }
    mapGroup.add(g);
    // tampa do alçapão (tábuas + dobradiças de ferro) em cima do buraco
    const hw = TREEHOUSE.holeW, hl = TREEHOUSE.hole, hx = L.x + L.nx * hl / 2;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(hl - 2, 3, hw * 2 - 2), hatchM); lid.position.set(hx, L.top + 1.2, L.z); lid.receiveShadow = true; mapGroup.add(lid);
    for (const zz of [-hw * 0.55, hw * 0.55]) { const hg = new THREE.Mesh(new THREE.BoxGeometry(hl * 0.7, 1.2, 5), ironM); hg.position.set(hx, L.top + 3.1, L.z + zz); mapGroup.add(hg); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.9, 5, 10), ironM); ring.rotation.x = Math.PI / 2; ring.position.set(L.x + L.nx * (hl - 10), L.top + 3, L.z); mapGroup.add(ring);
  }
  // copa lá em cima, bem acima de quem está na casinha
  const rnd = seeded(88);
  for (let i = 0; i < 8; i++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 0.9, c = new THREE.Mesh(new THREE.IcosahedronGeometry(70 + rnd() * 45, 1), rnd() < 0.5 ? leafA : leafB); c.position.set(cx + Math.cos(a) * d, trunkTop + 20 + rnd() * 70, cz + Math.sin(a) * d); c.castShadow = true; mapGroup.add(c); }
}
const world3dLadders = (T) => (mapInfo.world && mapInfo.world.ladders) || [];
// iglu redondo e opaco (blocos de neve), com 2 entradas
const SNOWBLOCK_TEX = canvasTex(256, 128, (g) => {
  g.fillStyle = '#eef6ff'; g.fillRect(0, 0, 256, 128); const rnd = seeded(12);
  g.strokeStyle = 'rgba(120,160,200,.45)'; g.lineWidth = 3;
  for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  g.fillStyle = 'rgba(180,210,240,.25)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 128, 2 + rnd() * 8, 0, 7); g.fill(); }
}, true);
function buildIgloos(list) {
  const R = IGLOO.r, Hd = IGLOO.wall + IGLOO.roof, band = 120;
  const prof = (y) => R * Math.pow(Math.max(0, 1 - Math.pow(y / Hd, 2.6)), 0.5);
  for (const q of list) {
    const g = new THREE.Group(); g.position.set(q.x, 0, q.z);
    // cúpula inteira numa peça só, com as 3 entradas em arco recortadas nela (sem buraco nenhum em volta da porta)
    const dirs = IGLOO.doors.map((k) => q.ang + k), ar = IGLOO.open + 2;
    const archY = (th) => { let y = 0; for (const a of dirs) { const d = Math.atan2(Math.sin(th - a), Math.cos(th - a)), x = Math.abs(R * Math.sin(d)); if (Math.abs(d) < Math.PI / 2 && x < ar) y = Math.max(y, band * Math.sqrt(1 - (x / ar) ** 2)); } return y; };
    const NS = 240, NR = 26, pos = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const th = i / NS * Math.PI * 2, y0 = archY(th);
      for (let j = 0; j <= NR; j++) { const y = y0 + (Hd - y0) * j / NR, r = Math.max(0.01, prof(y)); pos.push(Math.cos(th) * r, y, Math.sin(th) * r); uv.push(th / (Math.PI * 2) * 8, y / 55); }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = i * (NR + 1) + j, b = a + NR + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); dg.setIndex(idx); dg.computeVertexNormals();
    const tex1 = SNOWBLOCK_TEX.clone(); tex1.needsUpdate = true; tex1.wrapS = tex1.wrapT = THREE.RepeatWrapping;
    const dome = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: tex1, roughness: 0.95, side: THREE.DoubleSide })); dome.castShadow = dome.receiveShadow = true; g.add(dome);
    // arco de gelo em volta de cada entrada
    for (const a of dirs) {
      const rd = R * Math.cos(Math.asin(ar / R)) - 3;
      const arch = new THREE.Mesh(new THREE.TorusGeometry(ar, 9, 8, 16, Math.PI), mat(0xd6ecff, { roughness: 0.4 }));
      arch.position.set(Math.cos(a) * rd, 0, Math.sin(a) * rd); arch.rotation.y = -a + Math.PI / 2; arch.scale.set(1, band / ar, 1.6); g.add(arch);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R - 8, 48), new THREE.MeshStandardMaterial({ color: 0xc9dced, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.6; floor.receiveShadow = true; g.add(floor);
    mapGroup.add(g);
  }
}
// nave: portas de correr (2 folhas que entram na parede)
let doorMeshes = [];
function buildDoors(list) {
  doorMeshes = [];
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xaab2bd, metalness: 0.6, roughness: 0.35 });
  const stripe = canvasTex(64, 64, (g) => { g.fillStyle = '#e0b020'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1b1b1b'; for (let k = -64; k < 128; k += 20) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 10, 0); g.lineTo(k - 54, 64); g.lineTo(k - 64, 64); g.fill(); } }, true);
  for (const d of list) {
    const hgt = P.wallH - 2, lw = d.half, th = d.t - 12, leaves = [];
    for (const sgn of [-1, 1]) {
      const g = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(th, hgt, lw), leafMat); leaf.position.y = hgt / 2; leaf.castShadow = leaf.receiveShadow = true; g.add(leaf);
      const st = stripe.clone(); st.needsUpdate = true; st.repeat.set(1, lw / 64);
      const band = new THREE.Mesh(new THREE.BoxGeometry(th + 1, 10, lw), new THREE.MeshStandardMaterial({ map: st })); band.position.y = 30; g.add(band);
      const win = new THREE.Mesh(new THREE.BoxGeometry(th + 1, 26, lw * 0.5), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x1d6fa5, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })); win.position.y = 82; g.add(win);
      if (d.axis === 'x') g.rotation.y = Math.PI / 2; // parede deitada no x: a folha corre no x
      g.position.set(d.x + (d.axis === 'x' ? sgn * lw / 2 : 0), 0, d.z + (d.axis === 'x' ? 0 : sgn * lw / 2)); mapGroup.add(g); leaves.push([g, sgn]);
    }
    // barrinha na parede do lado da porta (dos 2 lados da parede): verde = aberta, vai ficando amarela/vermelha quando vai fechar
    const fillM = new THREE.MeshBasicMaterial({ color: 0xef4444 }), fills = [];
    for (const face of [-1, 1]) {
      const along = d.half + 16, off = d.t / 2 + 0.8;
      const px = d.axis === 'x' ? d.x + along : d.x + face * off, pz = d.axis === 'x' ? d.z + face * off : d.z + along, ry = d.axis === 'x' ? (face > 0 ? 0 : Math.PI) : (face > 0 ? Math.PI / 2 : -Math.PI / 2);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 46), new THREE.MeshBasicMaterial({ color: 0x111827 })); back.position.set(px, 72, pz); back.rotation.y = ry; mapGroup.add(back);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(6, 42), fillM); fill.position.set(px + (d.axis === 'x' ? 0 : face * 0.3), 72, pz + (d.axis === 'x' ? face * 0.3 : 0)); fill.rotation.y = ry; mapGroup.add(fill); fills.push(fill);
    }
    doorMeshes.push({ d, leaves, fillM, fills });
  }
}
function updateDoors() {
  if (!doorMeshes.length) return;
  doorMeshes.forEach((D, i) => {
    const o = sim.doors && sim.doors[i] != null ? (typeof sim.doors[i] === 'number' ? sim.doors[i] : sim.doors[i].open) : 0, e = o * o * (3 - 2 * o);
    for (const [g, sgn] of D.leaves) { const v = sgn * (D.d.half / 2 + D.d.half * 0.96 * e); if (D.d.axis === 'x') g.position.x = D.d.x + v; else g.position.z = D.d.z + v; }
    // tempo que falta pra fechar (0..1): a barra desce e muda de cor em degradê (verde -> amarelo -> vermelho)
    const left = sim.doorsT ? (sim.doorsT[i] || 0) : sim.doors && sim.doors[i] && sim.doors[i].until != null ? Math.max(0, sim.doors[i].until - sim.time) : 0;
    const f = o > 0.02 ? Math.max(0, Math.min(1, left / DOOR_HOLD)) : 0;
    D.fillM.color.setHSL(f > 0 ? 0.33 * f : 0, 0.85, f > 0 ? 0.5 : 0.35);
    for (const m of D.fills) { const k = f > 0 ? Math.max(0.04, f) : 1; m.scale.y = k; m.position.y = 72 - 21 * (1 - k); }
  });
}
// portais: passarelas e pontes do andar de cima (dá pra ver de baixo)
function buildPlatforms() {
  const grate = canvasTex(128, 128, (g) => { g.fillStyle = '#9aa3ae'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#5b636e'; g.lineWidth = 3; for (let k = 0; k <= 128; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 128); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(128, k); g.stroke(); } }, true);
  const edge = mat(0xe0b020);
  for (const R of mapWalls) {
    if (R.plat) {
      const t = grate.clone(); t.needsUpdate = true; t.repeat.set(R.w / 128, R.h / 128);
      const top = new THREE.MeshStandardMaterial({ map: t, metalness: 0.5, roughness: 0.5 }), sideM = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.5, roughness: 0.5 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(R.w, PLAT.th, R.h), [sideM, sideM, top, sideM, sideM, sideM]);
      b.position.set(R.x + R.w / 2, R.y0 + PLAT.th / 2, R.y + R.h / 2); b.castShadow = b.receiveShadow = true; mapGroup.add(b);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(R.w + 2, 3, R.h + 2), edge); lip.position.set(b.position.x, R.y0 - 1, b.position.z); mapGroup.add(lip);
    }
  }
  // ponte quebrada: pontas tortas e pedaços soltos na beira do buraco
  const G2 = mapInfo.world && mapInfo.world.bridgeGap;
  if (G2) {
    const broken = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.5, roughness: 0.6, flatShading: true }), rnd = seeded(77);
    for (const [ez, dir] of [[G2.z0, 1], [G2.z1, -1]]) for (let k = 0; k < 5; k++) {
      const w = (G2.x1 - G2.x0) / 5, b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, PLAT.th * 0.7, 10 + rnd() * 16), broken);
      b.position.set(G2.x0 + w * (k + 0.5), PLAT.y - PLAT.th / 2 - rnd() * 6, ez + dir * (4 + rnd() * 6)); b.rotation.set(dir * (0.2 + rnd() * 0.5), 0, (rnd() - 0.5) * 0.4); mapGroup.add(b);
    }
    for (let k = 0; k < 7; k++) { const d = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + rnd() * 6, 0), broken); d.position.set(G2.x0 + rnd() * (G2.x1 - G2.x0), 4, (G2.z0 + G2.z1) / 2 + (rnd() - 0.5) * 120); mapGroup.add(d); } // caiu lá embaixo
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(G2.x1 - G2.x0, 8), new THREE.MeshBasicMaterial({ color: 0xe0b020 }));
    for (const ez of [G2.z0 - 6, G2.z1 + 6]) { const m2 = warn.clone(); m2.rotation.x = -Math.PI / 2; m2.position.set((G2.x0 + G2.x1) / 2, PLAT.y + 0.6, ez); mapGroup.add(m2); }
  }
  // luzes azuis embaixo das passarelas (o andar de baixo fica bonito e dá pra ver quem está em cima)
  const W = mapInfo.W, H = mapInfo.H;
  for (const [x, z] of [[W / 2, H / 2]]) { // (só 1 luz: várias luzes deixavam os portais pesados)
    const l = new THREE.PointLight(0x93c5fd, 16000, 900, 2); l.position.set(x, PLAT.y - 30, z); mapGroup.add(l);
  }
}
// nave: teto de vidro (com os furos dos meteoros)
let naveRoof = null;
function buildNaveRoof(holes) {
  const W = mapInfo.W, H = mapInfo.H, y = CEILING_Y.nave;
  if (naveRoof) { mapGroup.remove(naveRoof); naveRoof.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const g = new THREE.Group(), shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(W, 0); shape.lineTo(W, -H); shape.lineTo(0, -H); shape.lineTo(0, 0);
  for (const h of holes) {
    const path = new THREE.Path(), rnd = seeded(Math.round(h.x * 7 + h.z));
    for (let k = 0; k <= 18; k++) { const a = k / 18 * Math.PI * 2, r = h.r * (0.75 + rnd() * 0.45); const px = h.x + Math.cos(a) * r, pz = h.z + Math.sin(a) * r; if (k === 0) path.moveTo(px, -pz); else path.lineTo(px, -pz); }
    shape.holes.push(path);
    // cacos de vidro quebrado em volta do furo
    for (let i = 0; i < 10; i++) { const a = rnd() * Math.PI * 2, r = h.r * (1 + rnd() * 0.4), sh = new THREE.Mesh(new THREE.PlaneGeometry(6 + rnd() * 14, 3 + rnd() * 8), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); sh.position.set(h.x + Math.cos(a) * r, y - 2, h.z + Math.sin(a) * r); sh.rotation.set(-Math.PI / 2 + (rnd() - 0.5) * 0.6, 0, rnd() * 3); g.add(sh); }
  }
  const geo = new THREE.ShapeGeometry(shape, 1); geo.rotateX(-Math.PI / 2);
  const roof = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  roof.position.y = y; g.add(roof);
  mapGroup.add(g); naveRoof = g; naveRoof.userData.n = holes.length;
}
// nave: meteoros (caindo e os que já caíram)
let meteorFx = { falling: [], rocks: new Map(), warn: [] };
const METEOR_EMIS = canvasTex(128, 128, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); const rnd = seeded(8); g.strokeStyle = '#ff7a2a'; g.lineWidth = 3; for (let i = 0; i < 18; i++) { let x = rnd() * 128, y = rnd() * 128; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); } });
// meteoro: pedra inteira (sem buracos), com calombos suaves e umas crateras; a deformação depende só da direção,
// então os vértices repetidos das faces andam juntos (não abre fresta)
function meteorMesh(r, seed) {
  const geo = new THREE.IcosahedronGeometry(r, 3), pos = geo.attributes.position, rnd = seeded(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  const craters = []; for (let i = 0; i < 5; i++) { const a = rnd() * Math.PI * 2, b = Math.acos(rnd() * 2 - 1); craters.push([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a), 0.25 + rnd() * 0.2]); }
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    let k = 1 + 0.12 * Math.sin(v.x * 2.1 + ph[0]) * Math.sin(v.y * 2.4 + ph[1]) + 0.1 * Math.sin(v.z * 2.7 + ph[2] + v.x) + 0.05 * Math.sin(v.x * 6.3 + ph[3]) * Math.sin(v.z * 5.7 + ph[4]) + 0.03 * Math.sin(v.y * 9.1 + ph[5]);
    for (const c of craters) { const d = Math.acos(Math.max(-1, Math.min(1, v.x * c[0] + v.y * c[1] + v.z * c[2]))); if (d < c[3]) { const u = d / c[3]; k -= 0.09 * (1 - u * u) - (u > 0.7 ? 0.04 * (u - 0.7) / 0.3 : 0); } }
    pos.setXYZ(i, v.x * r * k, v.y * r * k * 0.86, v.z * r * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3b3431, roughness: 0.95, flatShading: true, emissive: 0xffffff, emissiveMap: METEOR_EMIS, emissiveIntensity: 2 }));
  m.castShadow = m.receiveShadow = true; return m;
}
function updateMeteorFx(now, dt) {
  if (mapInfo.mapId !== 'nave') return;
  // pedras que já caíram (ficam de vez; o brilho da lava esfria)
  // round novo: os meteoros somem (a pedra, a cratera e o furo no teto voltam ao normal)
  const want = new Set((sim.meteors || []).map((q) => Math.round(q.x) + ':' + Math.round(q.z)));
  for (const [key, R] of meteorFx.rocks) if (!want.has(key)) { mapGroup.remove(R.m); if (R.crater) mapGroup.remove(R.crater); meteorFx.rocks.delete(key); }
  for (const q of sim.meteors || []) {
    const key = Math.round(q.x) + ':' + Math.round(q.z);
    if (!meteorFx.rocks.has(key)) {
      const m = meteorMesh(q.r, q.seed || 1); m.position.set(q.x, q.r * 0.55, q.z); m.rotation.set(0.3, (q.seed || 0) % 6, 0.2); mapGroup.add(m);
      const crater = new THREE.Mesh(new THREE.RingGeometry(q.r * 0.9, q.r * 1.7, 24), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false })); crater.rotation.x = -Math.PI / 2; crater.position.set(q.x, 0.8, q.z); mapGroup.add(crater);
      meteorFx.rocks.set(key, { m, crater, t0: now });
    }
  }
  for (const R of meteorFx.rocks.values()) R.m.material.emissiveIntensity = 0.25 + 1.75 * Math.max(0, 1 - (now - R.t0) / 9000);
  if (naveRoof && (sim.ceilHoles || []).length !== naveRoof.userData.n) buildNaveRoof(sim.ceilHoles || []);
  // caindo: sombra no chão + a pedra pegando fogo vindo do céu
  const F = sim.meteorFall;
  if (F && !F.done) {
    if (!meteorFx.warn.length) for (const [x, z] of F.pts) {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(METEOR.hitR, 32), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(x, 1.5, z); scene.add(sh);
      const ring = new THREE.Mesh(new THREE.RingGeometry(METEOR.hitR - 5, METEOR.hitR, 40), new THREE.MeshBasicMaterial({ color: 0xff4d2e, transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 1.7, z); scene.add(ring);
      const rock = meteorMesh(METEOR.r, Math.round(x)); scene.add(rock);
      const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fire.scale.setScalar(METEOR.r * 3.2); scene.add(fire);
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(METEOR.r * 0.2, METEOR.r * 0.9, 900, 12, 1, true), new THREE.MeshBasicMaterial({ map: FLAME_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); scene.add(trail);
      meteorFx.warn.push({ x, z, sh, ring, rock, fire, trail, broke: false });
    }
    const left = (F.t1 != null ? F.t1 : sim.time + 1) - sim.time, k = Math.max(0, Math.min(1, 1 - left / (F.pre || 2.6)));
    for (const w of meteorFx.warn) {
      const sx = w.x + 1100, sy = 2800, sz = w.z - 700, ex = w.x, ey = METEOR.r * 0.55, ez = w.z, e = k * k;
      const px = sx + (ex - sx) * e, py = sy + (ey - sy) * e, pz = sz + (ez - sz) * e;
      w.rock.position.set(px, py, pz); w.rock.rotation.x += dt * 3; w.fire.position.set(px, py, pz);
      w.trail.position.set(px + 1100 / 3300 * 450, py + 2800 / 3300 * 450 * 0.95, pz - 700 / 3300 * 450); w.trail.lookAt(px + 1100, py + 2800, pz - 700); w.trail.rotateX(Math.PI / 2);
      w.sh.material.opacity = 0.2 + 0.6 * k; w.sh.scale.setScalar(0.4 + 0.6 * k); w.ring.material.opacity = Math.floor(now / 120) % 2 ? 0.9 : 0.35;
      if (!w.broke && py < CEILING_Y.nave + 40) { w.broke = true; glassShards(w.x, w.z, now); SFX.play('bounce', 1); }
    }
  } else if (meteorFx.warn.length) { for (const w of meteorFx.warn) scene.remove(w.sh, w.ring, w.rock, w.fire, w.trail); meteorFx.warn = []; }
}
function glassShards(x, z, now) {
  const objs = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(5 + Math.random() * 12, 3 + Math.random() * 8), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    s.position.set(x + (Math.random() - 0.5) * 80, CEILING_Y.nave, z + (Math.random() - 0.5) * 80);
    s.userData.v = [(Math.random() - 0.5) * 200, -50 - Math.random() * 150, (Math.random() - 0.5) * 200]; s.userData.r = [Math.random() * 8, Math.random() * 8];
    scene.add(s); objs.push(s);
  }
  effects.push({ t0: now, d: 1600, objs, upd: (t, dt) => { for (const s of objs) { const v = s.userData.v; v[1] -= 700 * dt; s.position.x += v[0] * dt; s.position.y = Math.max(1, s.position.y + v[1] * dt); s.position.z += v[2] * dt; s.rotation.x += s.userData.r[0] * dt; s.rotation.y += s.userData.r[1] * dt; s.material.opacity = 0.7 * (1 - t); } } });
}

// ---------- castelo de magia: torres redondas (rampa em espiral por dentro), sacada lá em cima, salão com terraço ----------
const WIN_TEX = canvasTex(64, 128, (g) => { // janela em arco acesa (luz de vela)
  g.clearRect(0, 0, 64, 128); g.fillStyle = '#2a2018'; g.beginPath(); g.moveTo(6, 128); g.lineTo(6, 36); g.arc(32, 36, 26, Math.PI, 0); g.lineTo(58, 128); g.fill();
  const grd = g.createLinearGradient(0, 20, 0, 128); grd.addColorStop(0, '#ffe7a8'); grd.addColorStop(1, '#f0a040');
  g.fillStyle = grd; g.beginPath(); g.moveTo(12, 124); g.lineTo(12, 38); g.arc(32, 38, 20, Math.PI, 0); g.lineTo(52, 124); g.fill();
  g.fillStyle = '#2a2018'; g.fillRect(30, 18, 4, 108); g.fillRect(12, 70, 40, 4);
}, false);
function spiralGeo(S, th) { // rampa em espiral (em cima, embaixo e as 2 beiradas)
  const N = Math.ceil(S.turns * 96), pos = [], idx = [], uv = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = S.a0 + S.dir * u * S.turns * Math.PI * 2, y = S.y0 + (S.y1 - S.y0) * u, c = Math.cos(a), s = Math.sin(a);
    for (const [r, yy] of [[S.r0, y], [S.r1, y], [S.r1, y - th], [S.r0, y - th]]) { pos.push(S.cx + c * r, yy, S.cz + s * r); uv.push(u * S.turns * 12, r / 40); }
  }
  for (let i = 0; i < N; i++) { const a = i * 4, b = a + 4; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function ringSlab(D, m) { // piso redondo (anel ou pedaço de anel) com grossura
  const sh = new THREE.Shape(), a0 = D.a1 != null ? D.a0 : 0, a1 = D.a1 != null ? D.a1 : Math.PI * 2, n = 48;
  if (D.a1 == null) { sh.absarc(0, 0, D.r1, 0, Math.PI * 2, false); if (D.r0 > 0) { const hp = new THREE.Path(); hp.absarc(0, 0, D.r0, 0, Math.PI * 2, true); sh.holes.push(hp); } }
  else { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; if (i) sh.lineTo(Math.cos(a) * D.r1, Math.sin(a) * D.r1); else sh.moveTo(Math.cos(a) * D.r1, Math.sin(a) * D.r1); } for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * D.r0, Math.sin(a) * D.r0); } }
  const g = new THREE.ExtrudeGeometry(sh, { depth: D.top - D.y0, bevelEnabled: false, curveSegments: 40 }); g.rotateX(Math.PI / 2); // (x, y) do desenho -> (x, z) do chão; a face de cima fica em y = 0
  { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 60, uv.getY(i) / 60); }
  const o = new THREE.Mesh(g, m); o.position.set(D.cx, D.top, D.cz); o.castShadow = o.receiveShadow = true;
  return o;
}
// dragão do castelo: voa de ponta a ponta bem alto e cospe fogo numa faixa (a faixa vermelha no chão avisa antes)
let dragonFx = null;
function makeDragonFx(W, H) {
  const g = new THREE.Group(), skin = mat(0x5b1f1a, { roughness: 0.7 }), belly = mat(0x9a5a2a), wingM = new THREE.MeshStandardMaterial({ color: 0x3a1414, side: THREE.DoubleSide, roughness: 0.8, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(40, 12, 8), skin); body.scale.set(1, 0.8, 2.6); g.add(body);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(36, 10, 6), belly); bl.scale.set(0.8, 0.6, 2.3); bl.position.y = -8; g.add(bl);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(14, 26, 110, 8), skin); neck.rotation.x = Math.PI / 2 - 0.35; neck.position.set(0, 26, 130); g.add(neck);
  const head = new THREE.Group(); head.position.set(0, 50, 190); g.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(34, 26, 60), skin); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(28, 8, 50), belly); jaw.position.set(0, -16, 8); head.add(jaw);
  for (const sx of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(5, 34, 6), mat(0xd8c9a0)); horn.position.set(sx * 12, 22, -20); horn.rotation.x = -0.9; head.add(horn); const eye = new THREE.Mesh(new THREE.SphereGeometry(4, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd23a })); eye.position.set(sx * 13, 6, 18); head.add(eye); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(22, 260, 8), skin); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0, -210); g.add(tail);
  const wsh = new THREE.Shape(); wsh.moveTo(0, 0); wsh.lineTo(280, 60); wsh.lineTo(330, -10); wsh.lineTo(250, -40); wsh.lineTo(180, -90); wsh.lineTo(110, -60); wsh.lineTo(40, -110); wsh.lineTo(0, -40);
  const wings = [-1, 1].map((sx) => { const piv = new THREE.Group(); piv.position.set(sx * 30, 20, 30); const m = new THREE.Mesh(new THREE.ShapeGeometry(wsh), wingM); m.rotation.x = -Math.PI / 2; m.scale.set(sx, 1, 1); piv.add(m); g.add(piv); return piv; });
  g.visible = false; scene.add(g);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0, depthWrite: false })); strip.rotation.x = -Math.PI / 2; strip.visible = false; scene.add(strip);
  const flames = []; for (let i = 0; i < 46; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); f.visible = false; f.userData.t = Math.random(); f.userData.j = [Math.random() - 0.5, Math.random() - 0.5]; scene.add(f); flames.push(f); }
  const burns = []; for (let i = 0; i < 24; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); f.visible = false; scene.add(f); burns.push({ f, t: -9, x: 0, z: 0 }); }
  return { g, wings, head, strip, flames, burns, W, H, lastBurn: 0, bi: 0 };
}
// altura de onde o fogo do dragão bate: telhado do salão, teto das torres, a ilha ou o chão
function dragonSurf(x, z) {
  const w = mapInfo.world || {}, B = w.castleBase || 0, Hh = w.hall;
  if (Hh && x > Hh.kx0 && x < Hh.kx1 && z > Hh.kz0 && z < Hh.kz1) return B + Hh.KH;
  for (const T of w.towers || []) if (Math.hypot(x - T.x, z - T.z) < TOWER.R + 10) return B + TOWER.wallTop + 12;
  if (w.moat) { const d = Math.hypot(x - w.moat.cx, z - w.moat.cz); if (d < w.moat.r0) return B; if (d < w.moat.r1) return w.moat.water; }
  return 0;
}
function updateDragonFx(now, dt) {
  const D = sim.dragon;
  if (!D || D.s === 0) { if (dragonFx) { dragonFx.g.visible = false; dragonFx.strip.visible = false; for (const f of dragonFx.flames) f.visible = false; } }
  if (!D) return;
  if (!dragonFx) dragonFx = makeDragonFx(mapInfo.W, mapInfo.H);
  const F = dragonFx, t = now / 1000, H = F.H, half = DRAGON.half;
  F.strip.visible = false; // (sem faixa vermelha: tem que olhar pro céu e se esconder)
  if (D.s !== 2) return;
  // voa fazendo curva (a mesma curva que a simulação usa pra ver quem o fogo pega)
  const dx = dragonX(D, D.z, H), ahead = dragonX(D, D.z + D.dir * 60, H);
  F.g.visible = true; F.g.position.set(dx, 1450 + Math.sin(t * 2) * 25, D.z); F.g.rotation.y = Math.atan2(ahead - dx, D.dir * 60);
  for (const [i, w] of F.wings.entries()) w.rotation.z = (i ? -1 : 1) * (0.35 * Math.sin(t * 6.5) - 0.1);
  // jato de fogo: da boca até o chão (ou o telhado), um pouco atrás
  const hx = dx + (ahead - dx) * 3, hy = F.g.position.y + 30, hz = D.z + D.dir * 180, gz = D.z - D.dir * 110, gx = dragonX(D, gz, H), gy = dragonSurf(gx, gz);
  for (const f of F.flames) {
    let u = (f.userData.t + t * 1.8) % 1; const j = f.userData.j;
    f.visible = true; f.position.set(hx + (gx - hx) * u + j[0] * 90 * u, hy + (gy - hy) * u, hz + (gz - hz) * u + j[1] * 70 * u);
    f.scale.setScalar(36 + 180 * u); f.material.opacity = 0.9 * (1 - u * 0.5);
  }
  // fogo que fica queimando no chão/telhado um pouquinho
  if (now - F.lastBurn > 80) { F.lastBurn = now; const b = F.burns[F.bi++ % F.burns.length]; b.t = now; b.z = gz + (Math.random() - 0.5) * 90; b.x = dragonX(D, b.z, H) + (Math.random() - 0.5) * half * 1.6; b.y = dragonSurf(b.x, b.z); }
  for (const b of F.burns) { const u = (now - b.t) / 1100; if (u > 1) { b.f.visible = false; continue; } b.f.visible = true; b.f.position.set(b.x, (b.y || 0) + 30 + u * 40, b.z); b.f.scale.setScalar(110 * (1 - u * 0.4)); b.f.material.opacity = 0.8 * (1 - u); }
}
function buildCastle(w) {
  const W = w.W, H = w.H, stoneT = wallTexture('#a6a6a2', 'stone');
  const stone = (rx, ry) => { const t = stoneT.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); };
  const rampM = stone(1, 1), slabM = stone(1, 1); rampM.side = THREE.DoubleSide; slabM.side = THREE.DoubleSide; const slate = mat(0x3d4658, { roughness: 0.7 }), winM = new THREE.MeshBasicMaterial({ map: WIN_TEX, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
  for (const S of w.spirals || []) { const m = new THREE.Mesh(spiralGeo(S, S.th || 10), rampM); m.castShadow = m.receiveShadow = true; mapGroup.add(m); }
  for (const D of w.discs || []) { if (D.roof || D.island) continue; mapGroup.add(ringSlab(D, slabM)); } // (a ilha é o chão de grama: sem laje por cima, senão pisca)
  const TW = TOWER, B = w.castleBase || 0, brackets = [];
  for (const T of w.towers || []) {
    // telhado em cone (ardósia azul-escura) com a ponta e uma bandeira do time daquele lado
    const roof = new THREE.Mesh(new THREE.ConeGeometry(TW.R + 18, 210, 28), slate); roof.position.set(T.x, B + TW.wallTop + 105, T.z); roof.castShadow = true; mapGroup.add(roof);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(TW.R + 12, TW.R + 12, 16, 28), stone(8, 0.3)); ring.position.set(T.x, B + TW.wallTop + 6, T.z); mapGroup.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 70, 6), mat(0x3a3a3a)); pole.position.set(T.x, B + TW.wallTop + 245, T.z); mapGroup.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(46, 26), new THREE.MeshStandardMaterial({ color: T.x < W / 2 ? TEAM.A : TEAM.B, side: THREE.DoubleSide, emissive: T.x < W / 2 ? TEAM.A : TEAM.B, emissiveIntensity: 0.25 })); flag.position.set(T.x + 23, B + TW.wallTop + 265, T.z); mapGroup.add(flag);
    // mãos-francesas embaixo da sacada
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; brackets.push([T.x + Math.cos(a) * (TW.R + TW.bal * 0.4), B + TW.top - 24, T.z + Math.sin(a) * (TW.R + TW.bal * 0.4), TW.bal * 0.8, 20, 10, -a]); }
    // janelas acesas na parede da torre (por fora e por dentro)
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(TW.pillar + 7, TW.pillar + 9, TW.wallTop, 16), stone(2, 4)); pil.position.set(T.x, B + TW.wallTop / 2, T.z); pil.castShadow = pil.receiveShadow = true; mapGroup.add(pil); // coluna redonda
    for (const [yy0, da] of [[190, 1.2], [190, -2.2], [410, 2.6], [410, -0.9], [640, 0.4], [820, -1.6]]) { const yy = B + yy0;
      const a = T.a0 + da, q = new THREE.Mesh(new THREE.PlaneGeometry(22, 44), winM); q.position.set(T.x + Math.cos(a) * (TW.R + TW.half + 0.6), yy, T.z + Math.sin(a) * (TW.R + TW.half + 0.6)); q.rotation.y = -a + Math.PI / 2; mapGroup.add(q);
    }
    // arco de pedra em cima das portas
    for (const a of T.gd) { const base = B, hgt = TW.lintel, ar = new THREE.Mesh(new THREE.TorusGeometry(TW.door * 0.9, 7, 6, 14, Math.PI), slabM); ar.position.set(T.x + Math.cos(a) * (TW.R + TW.half + 1), base + hgt - TW.door * 0.9 + 4, T.z + Math.sin(a) * (TW.R + TW.half + 1)); ar.rotation.y = -a + Math.PI / 2; mapGroup.add(ar); }
  }
  instanced(new THREE.BoxGeometry(1, 1, 1), slabM, brackets); // mãos-francesas (um desenho só)
  // ilha alta com o lago em volta: barranco de pedra, pedras na beira da água, a água e as pontes de pedra com parapeito
  if (w.moat) {
    const M = w.moat, rockT = wallTexture('#6f6a60', 'stone'); rockT.wrapS = rockT.wrapT = THREE.RepeatWrapping;
    const cl = new THREE.CylinderGeometry(M.r0 + 4, M.r0 + 46, B - M.water + 30, 72, 1, true); { const uv = cl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 1.6); }
    const cliff = new THREE.Mesh(cl, new THREE.MeshStandardMaterial({ map: rockT, roughness: 1 })); cliff.position.set(M.cx, (B + M.water - 30) / 2, M.cz); cliff.receiveShadow = true; mapGroup.add(cliff);
    const bk = new THREE.CylinderGeometry(M.r1, M.r1 - 10, -M.water + 30, 72, 1, true); { const uv = bk.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 48, uv.getY(i) * 0.5); }
    const bank = new THREE.Mesh(bk, new THREE.MeshStandardMaterial({ map: rockT, roughness: 1, side: THREE.BackSide })); bank.position.set(M.cx, (M.water - 30) / 2, M.cz); mapGroup.add(bank);
    // (v0.29) rio raso: fundo de areia/pedra e a água meio transparente por cima (dá pra ver a perna de quem está dentro)
    const bedY = M.bed != null ? M.bed : M.water - 30;
    const bedM = new THREE.Mesh(new THREE.RingGeometry(M.r0 - 10, M.r1 + 10, 96, 1), new THREE.MeshStandardMaterial({ color: 0x6d6a55, roughness: 1 })); bedM.rotation.x = -Math.PI / 2; bedM.position.set(M.cx, bedY - 0.5, M.cz); mapGroup.add(bedM);
    const water = new THREE.Mesh(new THREE.RingGeometry(M.r0 - 10, M.r1 + 10, 96, 1), new THREE.MeshStandardMaterial({ color: 0x4a8796, roughness: 0.3, metalness: 0.1, emissive: 0x16363d, transparent: true, opacity: 0.72, depthWrite: false })); water.rotation.x = -Math.PI / 2; water.position.set(M.cx, M.water, M.cz); water.renderOrder = 3; mapGroup.add(water);
    // rampas de pedra pra sair do rio (norte e sul)
    for (const S of w.slopes || []) {
      if (!S.moatRamp) continue;
      const wd = S.x1 - S.x0, sh = new THREE.Shape(); sh.moveTo(S.z0, bedY - 2); sh.lineTo(S.z1, bedY - 2); sh.lineTo(S.z1, S.h1); sh.lineTo(S.z0, S.h0); sh.lineTo(S.z0, bedY - 2);
      const g = new THREE.ExtrudeGeometry(sh, { depth: wd, bevelEnabled: false }); { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 96, uv.getY(i) / 96); }
      const rm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: rockT, roughness: 0.95 })); rm.rotation.y = -Math.PI / 2; rm.position.x = S.x0 + wd; rm.receiveShadow = true; mapGroup.add(rm);
    }
    const rnd2 = seeded(512), rocks = [];
    for (let i = 0; i < 70; i++) { const a = rnd2() * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.14) continue; const r = (rnd2() < 0.6 ? M.r0 + 30 : M.r1 - 25) + (rnd2() - 0.5) * 30, k = 14 + rnd2() * 26; rocks.push([M.cx + Math.cos(a) * r, M.water + k * 0.2, M.cz + Math.sin(a) * r, k * 1.3, k, k, rnd2() * 3]); }
    instanced(new THREE.DodecahedronGeometry(1, 0), mat(0x5e5a52, { roughness: 1 }), rocks);
    const brM = new THREE.MeshStandardMaterial({ map: rockT, roughness: 0.95 });
    for (const Br of w.bridges || []) {
      const L = Br.x1 - Br.x0, ang = Math.atan2(Br.h1 - Br.h0, L), len = Math.hypot(L, Br.h1 - Br.h0), mid = (Br.h0 + Br.h1) / 2, zc = (Br.z0 + Br.z1) / 2, wd = Br.z1 - Br.z0;
      const g = new THREE.BoxGeometry(len, 18, wd + 20); boxUV(g, len, 18, wd + 20, 1 / 96);
      const deck = new THREE.Mesh(g, brM); deck.position.set((Br.x0 + Br.x1) / 2, mid - 10.5, zc); deck.rotation.z = ang; deck.castShadow = deck.receiveShadow = true; mapGroup.add(deck); // (um tiquinho abaixo: não pisca com o chão da ilha)
      for (const sz of [-1, 1]) { const rg = new THREE.BoxGeometry(len, 36, 10); boxUV(rg, len, 36, 10, 1 / 96); const rail = new THREE.Mesh(rg, brM); rail.position.set((Br.x0 + Br.x1) / 2, mid + 18, zc + sz * (wd / 2 + 5)); rail.rotation.z = ang; mapGroup.add(rail); }
      for (const u of [0.35, 0.62]) { const x = Br.x0 + L * u, h = Br.h0 + (Br.h1 - Br.h0) * u, pg = new THREE.BoxGeometry(34, h - M.water + 10, wd); boxUV(pg, 34, h - M.water + 10, wd, 1 / 96); const pier = new THREE.Mesh(pg, brM); pier.position.set(x, (h + M.water - 10) / 2 - 9, zc); mapGroup.add(pier); } // pilares dentro d'água
    }
  }
  // salão: janelas altas acesas, estandartes dos times nas paredes da frente e tochas dentro
  const [kx0, kz0, kx1, kz1] = MAPS3D.castelo.keep.map((v, i) => v * (i % 2 ? H : W));
  for (let x = kx0 + 70; x < kx1 - 40; x += 110) for (const [z, ry] of [[kz0 - 0.6, Math.PI], [kz1 + 0.6, 0]]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(26, 56), winM); q.position.set(x, B + 230, z); q.rotation.y = ry; mapGroup.add(q); }
  for (const [x, col, ry] of [[kx0 - 0.8, TEAM.A, -Math.PI / 2], [kx1 + 0.8, TEAM.B, Math.PI / 2]]) for (const z of [kz0 + 70, kz1 - 70]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(50, 120), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.9 })); b.position.set(x, B + 190, z); b.rotation.y = ry; mapGroup.add(b);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 56), mat(0xd4af37, { metalness: 0.6 })); tr.position.set(x, B + 251, z); mapGroup.add(tr);
  }
  const torchM = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  for (const [x, z] of [[kx0 + 30, (kz0 + kz1) / 2 - 120], [kx0 + 30, (kz0 + kz1) / 2 + 120], [kx1 - 30, (kz0 + kz1) / 2 - 120], [kx1 - 30, (kz0 + kz1) / 2 + 120]]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(4, 6, 4), torchM); f.position.set(x, B + 150, z); mapGroup.add(f);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffa040, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(50); gl.position.set(x, B + 150, z); mapGroup.add(gl);
  }
  { const pl = new THREE.PointLight(0xffb070, 90000, 1000, 2); pl.position.set(W / 2, B + 230, H / 2); mapGroup.add(pl); } // luz quente dentro do salão (uma só: mais leve)
  // salão principal: tronos do rei e da rainha no tablado, tapete vermelho e o teto encantado (céu de noite com estrelas)
  if (w.hall) {
    const Hh = w.hall, HB = Hh.base || 0, darkM = mat(0x3b2616, { roughness: 0.8 });
    const goldM = mat(0xd4af37, { metalness: 0.35, roughness: 0.45, flatShading: false, emissive: 0x3a2806 }), cube = new THREE.BoxGeometry(1, 1, 1);
    const box = (m, x, y, z, sx, sy, sz, sh) => { const b = new THREE.Mesh(cube, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.castShadow = !!sh; b.receiveShadow = true; mapGroup.add(b); return b; };
    for (const R of w.walls) {
      const cx = R.x + R.w / 2, cz = R.y + R.h / 2;
      if (R.throne === 'back') {
        const hgt = R.top - R.y0;
        box(goldM, cx, R.y0 + hgt * 0.45, cz, R.w, hgt * 0.9, R.h, true);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(R.h * 0.5, hgt * 0.2, 4), goldM); tip.rotation.y = Math.PI / 4; tip.scale.set(R.w / R.h * 1.4, 1, 1.4); tip.position.set(cx, R.y0 + hgt * 0.9 + hgt * 0.1, cz); mapGroup.add(tip);
        for (const [sx, col] of [[-1, TEAM.A], [1, TEAM.B]]) box(mat(col, { roughness: 1 }), cx + sx * (R.w / 2 + 0.6), R.y0 + hgt * 0.45, cz, 1.2, hgt * 0.62, R.h - 14); // encosto estofado
        // coroas: a do rei maior (lado da base azul) e a da rainha menor (lado da base vermelha)
        for (const [sx, k] of [[-1, 1], [1, 0.72]]) {
          const y = R.y0 + hgt * 0.78, x = cx + sx * (R.w / 2 + 6 * k);
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(9 * k, 8 * k, 7 * k, 10, 1, true), goldM); ring.position.set(x, y, cz); ring.material.side = THREE.DoubleSide; mapGroup.add(ring);
          for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(2 * k, 7 * k, 4), goldM); sp.position.set(x + Math.cos(a) * 8.5 * k, y + 7 * k, cz + Math.sin(a) * 8.5 * k); mapGroup.add(sp); }
          const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.6 * k), new THREE.MeshBasicMaterial({ color: sx < 0 ? 0x60a5fa : 0xf87171 })); gem.position.set(x + sx * 9 * k, y, cz); mapGroup.add(gem);
        }
      } else if (R.throne) {
        const col = R.throne === 'king' ? TEAM.A : TEAM.B, sx = R.throne === 'king' ? -1 : 1;
        box(darkM, cx, R.y0 + (R.top - R.y0) / 2, cz, R.w, R.top - R.y0, R.h, true);
        box(mat(col, { roughness: 1 }), cx, R.top + 2, cz, R.w - 4, 4, R.h - 6); // almofada
        for (const dz of [-R.h / 2 + 3, R.h / 2 - 3]) { box(goldM, cx, R.top + 9, R.y + R.h / 2 + dz, R.w, 5, 6, true); box(goldM, cx + sx * (R.w / 2 - 3), R.top + 4, R.y + R.h / 2 + dz, 6, 10, 6); } // braços
      }
    }
    // tapete vermelho: da porta até a escada, degrau por degrau, e em cima até o trono
    const carpet = [], cw = 50, stairL = Hh.n * Hh.sd;
    for (const sd of [-1, 1]) {
      const inner = sd < 0 ? Hh.kx0 + Hh.kt : Hh.kx1 - Hh.kt, foot = Hh.cx + sd * (Hh.dx + stairL);
      carpet.push([(inner + foot) / 2, HB + 0.5, Hh.cz, Math.abs(foot - inner), 1, cw]);
      for (let k = 1; k <= Hh.n; k++) {
        const x = sd < 0 ? Hh.cx - Hh.dx - (Hh.n - k + 0.5) * Hh.sd : Hh.cx + Hh.dx + (Hh.n - k + 0.5) * Hh.sd, y = HB + Hh.DH * k / Hh.n, rh = Hh.DH / Hh.n;
        carpet.push([x, y + 0.5, Hh.cz, Hh.sd + 0.02, 1, cw]); carpet.push([x + sd * (Hh.sd / 2 + 0.4), y - rh / 2 + 0.5, Hh.cz, 1, rh + 1, cw]); // em cima e na frente do degrau
      }
      carpet.push([Hh.cx + sd * (Hh.dx + 47) / 2, HB + Hh.DH + 0.5, Hh.cz, Hh.dx - 47, 1, cw]);
    }
    instanced(cube, mat(0x8a1c22, { roughness: 1 }), carpet);
    // chão de pedra dentro do salão
    const fl0 = new THREE.Mesh(new THREE.PlaneGeometry(Hh.kx1 - Hh.kx0 - 2 * Hh.kt, Hh.kz1 - Hh.kz0 - 2 * Hh.kt), stone(7, 7)); fl0.rotation.x = -Math.PI / 2; fl0.position.set(Hh.cx, HB + 0.3, Hh.cz); fl0.receiveShadow = true; mapGroup.add(fl0);
    // teto encantado: céu de noite com estrelas e nuvens (embaixo do telhado)
    const skyT = canvasTex(512, 512, (g) => {
      const gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, '#0d1433'); gr.addColorStop(0.5, '#1c1f4a'); gr.addColorStop(1, '#2a1c42'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      const r2 = seeded(91); for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(160,170,210,${0.05 + r2() * 0.07})`; g.beginPath(); g.ellipse(r2() * 512, r2() * 512, 40 + r2() * 90, 16 + r2() * 30, r2() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 260; i++) { const a = 0.4 + r2() * 0.6, rr = r2() < 0.1 ? 1.8 : 0.9; g.fillStyle = `rgba(255,250,230,${a})`; g.beginPath(); g.arc(r2() * 512, r2() * 512, rr, 0, 7); g.fill(); }
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(Hh.kx1 - Hh.kx0 - 2 * Hh.kt, Hh.kz1 - Hh.kz0 - 2 * Hh.kt), new THREE.MeshBasicMaterial({ map: skyT }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(Hh.cx, HB + Hh.KH - 12.6, Hh.cz); mapGroup.add(ceil);
  }
  // ameias em cima da muralha de volta do mapa (só enfeite) e a paisagem: lago, montanhas e floresta escura em volta
  const BH = w.borderH || 200, merl = [];
  for (let x = 20; x < W; x += 60) for (const z of [12, H - 12]) merl.push([x, BH + 12, z, 30, 24, 24]);
  for (let z = 50; z < H - 30; z += 60) for (const x of [12, W - 12]) merl.push([x, BH + 12, z, 24, 24, 30]);
  instanced(new THREE.BoxGeometry(1, 1, 1), stone(0.3, 0.3), merl, true);
  // (v0.27: sem o lago lá longe — só a água do fosso em volta da ilha; o resto é campo até as montanhas)
  const shore = new THREE.Mesh(new THREE.RingGeometry(w.moat ? w.moat.r1 + 6 : 0, 15000, 64, 1), new THREE.MeshStandardMaterial({ color: 0x4d6a38, roughness: 1 })); shore.rotation.x = -Math.PI / 2; shore.position.set(W / 2, -5, H / 2); mapGroup.add(shore);
  const rnd = seeded(404), mts = [], trees = [];
  for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, d = 6000 + rnd() * 5000, k = 900 + rnd() * 1600; mts.push([W / 2 + Math.cos(a) * d, k * 0.5 - 40, H / 2 + Math.sin(a) * d, k * 0.9, k, k * 0.9, rnd() * 3]); }
  instanced(new THREE.ConeGeometry(1, 1, 7), mat(0x39424f, { roughness: 1 }), mts);
  for (let i = 0; i < 230; i++) { const a = rnd() * Math.PI * 2, d = Math.max(W, H) * 0.62 + rnd() * (i < 140 ? 900 : 3600), k = 60 + rnd() * 70; trees.push([W / 2 + Math.cos(a) * d, k * 1.4, H / 2 + Math.sin(a) * d, k * 0.7, k * 2.8, k * 0.7, 0]); }
  instanced(new THREE.ConeGeometry(1, 1, 6), mat(0x223a26, { roughness: 1 }), trees);
  // céu de fim de tarde (roxo/laranja) com estrelinhas aparecendo
  const skyM = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vW; ${NOISE_GLSL} void main(){ float h = vW.y; vec3 top = vec3(0.12, 0.13, 0.32), mid = vec3(0.55, 0.36, 0.52), hor = vec3(1.0, 0.62, 0.38); vec3 c = h > 0.0 ? mix(mix(hor, mid, smoothstep(0.0, 0.22, h)), top, smoothstep(0.2, 0.75, h)) : vec3(0.2, 0.2, 0.25);
      float st = step(0.9975, h21(floor(vW.xz * 420.0 / max(0.2, h)))) * smoothstep(0.35, 0.8, h); c += vec3(st);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30000, 32, 16), skyM); sky.position.set(W / 2, 0, H / 2); mapGroup.add(sky);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xfff2d6, fog: false, depthWrite: false })); moon.scale.setScalar(1600); moon.position.set(W / 2 + 9000, 7000, H / 2 - 14000); mapGroup.add(moon);
}

// ---------- navio antigo na tempestade: o mar, a chuva, a ilha e o vulcão ficam num grupo que gira ao contrário do balanço
// (a física é no "chão do navio"; quem joga vê o horizonte subir e descer) ----------
let shipFx = null;
const STORM_SEA_VERT = `uniform float uTime; varying float vH; varying vec3 vW;
void main(){ vec3 p = position; vec4 w0 = modelMatrix * vec4(p, 1.0);
  float h = sin(w0.x * 0.0022 + uTime * 0.9) * 46.0 + sin(w0.z * 0.0031 - uTime * 1.1) * 34.0 + sin((w0.x - w0.z) * 0.006 + uTime * 1.7) * 14.0 + sin((w0.x + w0.z * 0.4) * 0.013 + uTime * 2.6) * 6.0;
  w0.y += h; vH = h; vW = w0.xyz; gl_Position = projectionMatrix * viewMatrix * w0; }`;
const STORM_SEA_FRAG = `uniform float uTime; uniform float uFlash; varying float vH; varying vec3 vW; ${NOISE_GLSL}
void main(){ float n = fbm3(vW.xz * 0.003 + uTime * 0.06); vec3 deep = vec3(0.03, 0.08, 0.1), light = vec3(0.12, 0.22, 0.24);
  vec3 c = mix(deep, light, clamp(vH / 90.0 + 0.5 + n * 0.3, 0.0, 1.0));
  c += vec3(0.75, 0.8, 0.82) * smoothstep(0.72, 0.92, n + vH / 160.0) * 0.45; // espuma na crista
  c += vec3(0.5, 0.55, 0.7) * uFlash * 0.5;
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;
// água que entra no convés quando a onda grande inclina o navio (do lado mais baixo) e vai sumindo quando ele volta
const DECK_WATER_FRAG = `uniform float uWet; uniform float uSide; uniform float uTime; uniform vec2 uZ; varying vec3 vW; ${NOISE_GLSL}
void main(){ float v = (vW.z - uZ.x) / (uZ.y - uZ.x); if (uSide < 0.0) v = 1.0 - v;
  float n = fbm3(vW.xz * 0.01 + vec2(uTime * 0.4, uTime * 0.25));
  float cov = uWet * 0.42, a = smoothstep(1.0 - cov - 0.06, 1.0 - cov + 0.06, v + (n - 0.5) * 0.08);
  if (a < 0.01) discard;
  vec3 c = mix(vec3(0.16, 0.26, 0.3), vec3(0.75, 0.82, 0.85), smoothstep(0.62, 0.8, n) * 0.5);
  gl_FragColor = vec4(c, a * 0.7 * min(1.0, uWet * 1.6));
  #include <colorspace_fragment>
}`;
function buildShip(w) {
  const W = w.W, H = w.H, P = w.deck.poly, cx = W / 2, cz = H / 2, SH = SHIP;
  // casco: lados de tábua descendo até a água (vai afinando embaixo)
  const plankT = wallTexture('#6e4d33', 'plank'); // (v0.29: navio mais claro — dá pra ver os bonecos)
  { const pos = [], uv = [], idx = [], bot = P.map(([x, z]) => [cx + (x - cx) * 0.9, cz + (z - cz) * 0.62]); let L = 0;
    for (let i = 0; i <= P.length; i++) { const A = P[i % P.length], B = bot[i % P.length]; if (i) L += Math.hypot(A[0] - P[i - 1][0], A[1] - P[i - 1][1]); pos.push(A[0], 30, A[1], B[0], SH.sea - 70, B[1]); uv.push(L / 128, 1.6, L / 128, 0); }
    for (let i = 0; i < P.length; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const t = plankT.clone(); t.needsUpdate = true; const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide })); mapGroup.add(m); }
  const gold = mat(0xb8913a, { metalness: 0.5, roughness: 0.45 }), darkW = mat(0x5a3f26), mastM = mat(0x7d5835);
  for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]), s = new THREE.Mesh(new THREE.BoxGeometry(L, 5, 3), gold); s.position.set((A[0] + B[0]) / 2, 20, (A[1] + B[1]) / 2); s.rotation.y = -Math.atan2(B[1] - A[1], B[0] - A[0]); mapGroup.add(s); }
  // gurupés (a ponta que sai lá na frente): tábua inclinada em cima de um mastro deitado, e a cabeça de dragão na ponta
  for (const S of w.slopes || []) {
    if (!S.bow) continue;
    const L = S.x1 - S.x0, ang = Math.atan2(S.h1 - S.h0, L), mid = (S.h0 + S.h1) / 2, zc = (S.z0 + S.z1) / 2, wd = S.z1 - S.z0;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(L, S.h1 - S.h0), 8, wd), new THREE.MeshStandardMaterial({ map: plankT, roughness: 0.9 })); deck.position.set((S.x0 + S.x1) / 2, mid - 4, zc); deck.rotation.z = ang; deck.receiveShadow = true; mapGroup.add(deck);
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, Math.hypot(L, S.h1 - S.h0) + 60, 8), mastM); spar.rotation.z = Math.PI / 2 + ang; spar.position.set((S.x0 + S.x1) / 2, mid - 22, zc); mapGroup.add(spar);
    const tipLeft = S.h0 > S.h1, tx = tipLeft ? S.x0 : S.x1, ty = Math.max(S.h0, S.h1), dir = tipLeft ? -1 : 1, col = tipLeft ? TEAM.A : TEAM.B;
    const head = new THREE.Mesh(new THREE.ConeGeometry(16, 60, 6), darkW); head.position.set(tx + dir * 26, ty - 26, zc); head.rotation.z = -dir * Math.PI / 2; mapGroup.add(head);
    for (const sz of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(3.5, 6, 4), new THREE.MeshBasicMaterial({ color: col })); eye.position.set(tx + dir * 20, ty - 18, zc + sz * 9); mapGroup.add(eye); const horn = new THREE.Mesh(new THREE.ConeGeometry(3, 26, 5), gold); horn.position.set(tx + dir * 8, ty - 8, zc + sz * 9); horn.rotation.z = dir * 0.7; mapGroup.add(horn); }
  }
  // mastros: o de baixo termina no chão do cesto; o de cima (com as velas) começa bem mais alto, preso por cordas
  const sailT = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, 256, 256); const rnd = seeded(3);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(120,100,70,${0.08 + rnd() * 0.1})`; g.fillRect(rnd() * 220, rnd() * 220, 30 + rnd() * 50, 20 + rnd() * 40); } // remendos
    g.strokeStyle = 'rgba(90,70,40,.35)'; g.lineWidth = 2; for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    g.strokeStyle = '#5b2a86'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 56, 0, 7); g.stroke(); // símbolo de bruxo (lua e estrela)
    g.fillStyle = '#5b2a86'; g.beginPath(); g.arc(118, 122, 34, 0.9, 5.4); g.arc(134, 118, 28, 5.2, 1.1, true); g.fill();
    g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 7 : 16; g.lineTo(160 + Math.cos(a) * r, 104 + Math.sin(a) * r); } g.fill();
    g.clearRect(0, 240, 256, 16); for (let x = 0; x < 256; x += 22) g.clearRect(x, 228 + rnd() * 12, 10 + rnd() * 8, 30); // barra rasgada
  }, false);
  const sailM = new THREE.MeshStandardMaterial({ map: sailT, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3, roughness: 1 }), sails = [], rope = [];
  const basketM = new THREE.MeshStandardMaterial({ map: plankT, side: THREE.DoubleSide, roughness: 0.9 });
  for (const M of w.masts || []) {
    const lowH = M.nest - 12 - M.base, low = new THREE.Mesh(new THREE.CylinderGeometry(M.r * 0.85, M.r, lowH, 10), mastM); low.position.set(M.x, M.base + lowH / 2, M.z); low.castShadow = true; mapGroup.add(low);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(M.nr + 4, M.nr - 6, 30, 20, 1, true), basketM); basket.position.set(M.x, M.nest + 8, M.z); mapGroup.add(basket);
    const nfloor = new THREE.Mesh(new THREE.CylinderGeometry(M.nr, M.nr - 8, 12, 20), darkW); nfloor.position.set(M.x, M.nest - 6, M.z); nfloor.receiveShadow = true; mapGroup.add(nfloor);
    const u0 = M.nest - 12, u1 = M.nest + 780, up = new THREE.Mesh(new THREE.CylinderGeometry(M.r * 0.55, M.r * 0.62, u1 - u0, 8), mastM); up.position.set(M.x, (u0 + u1) / 2, M.z); mapGroup.add(up); // coluna no meio do cesto
    for (const [yy, len] of [[M.nest + 230, 560], [M.nest + 450, 440]]) { // velas bem acima do cesto (não atrapalham o pulo)
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, len, 6), mastM); yard.rotation.x = Math.PI / 2; yard.position.set(M.x, yy + 150, M.z); mapGroup.add(yard);
      const sg = new THREE.PlaneGeometry(len * 0.92, 170, 10, 4), sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / (len * 0.46); sp.setZ(i, (1 - u * u) * 26); }
      const sail = new THREE.Mesh(sg, sailM); sail.rotation.y = Math.PI / 2; sail.position.set(M.x + 10, yy + 64, M.z); mapGroup.add(sail); sails.push(sail);
    }
    for (const [dx, dz] of [[-0.2, -1], [0.2, -1], [-0.2, 1], [0.2, 1]]) rope.push(M.x, u1 - 40, M.z, M.x + dx * 300, 30, M.z + dz * (H * 0.25)); // cordas até a borda
  }
  // escadas de corda (cada uma do chão/teto até o cesto)
  for (const L of w.ladders || []) { const x = L.x + L.nx * 6; for (const sz of [-1, 1]) rope.push(x, L.base || 0, L.z + sz * 17, x, L.top + 20, L.z + sz * 17); for (let y = (L.base || 0) + 14; y < L.top; y += 22) rope.push(x, y, L.z - 17, x, y, L.z + 17); }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rope, 3)); mapGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a1d12 }))); }
  // barris (a colisão é a caixa; o desenho é redondo)
  for (const R of w.walls) {
    if (R.style !== 'barrel') continue; const c0 = mapGroup.children.length, rr = Math.min(R.w, R.h) / 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.9, R.top, 12), mat(0x6b4a2a)); b.position.set(R.x + R.w / 2, R.top / 2, R.y + R.h / 2); b.castShadow = true; mapGroup.add(b);
    for (const yy of [0.2, 0.8]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.5, 1.4, 4, 16), mat(0x2d2d2d)); hoop.rotation.x = Math.PI / 2; hoop.position.set(R.x + R.w / 2, R.top * yy, R.y + R.h / 2); mapGroup.add(hoop); }
    if (R.item != null) for (let i = c0; i < mapGroup.children.length; i++) mapGroup.children[i].userData.item = R.item;
  }
  // cabine do meio: luz quente lá dentro (uma luz só), janelas acesas e lanternas nas portas; lanternas nos castelos
  { const pl = new THREE.PointLight(0xffb45a, 30000, 620, 2); pl.position.set(cx, 150, cz); mapGroup.add(pl); }
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffc46b }), lamps = [], wins = [];
  for (const x of [0.39 * W - 5, 0.61 * W + 5]) for (const z of [cz - 70, cz + 70]) lamps.push([x, 120, z, 8, 12, 8]);
  for (const x of [0.2 * W + 6, W - 0.2 * W - 6]) lamps.push([x, SH.castle + 36, cz, 8, 12, 8]);
  if (w.captain) { const C = w.captain; for (const x of [C.x0 + 30, C.x1 - 30]) for (const z of [C.z0 + 30, C.z1 - 30]) lamps.push([x, C.y0 + 110, z, 7, 11, 7]); } // lanternas dentro da sala do capitão
  instanced(new THREE.BoxGeometry(1, 1, 1), lampM, lamps);
  for (const z of [0.38 * H - 0.8, 0.62 * H + 0.8]) for (const x of [cx - 280, cx - 140, cx + 140, cx + 280]) wins.push([x, 100, z, 40, 30, 1]);
  instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffd08a }), wins); // janelas acesas da cabine
  // sala do capitão: leme (roda) e mesa com o mapa
  if (w.captain) { const C = w.captain, wd = mat(0x5a3d22);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(22, 2.5, 6, 18), wd); wheel.position.set(cx - 110, C.y0 + 70, cz); wheel.rotation.y = Math.PI / 2; mapGroup.add(wheel);
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 56), wd); sp.rotation.x = k * Math.PI / 4; sp.position.copy(wheel.position); mapGroup.add(sp); }
    const post = new THREE.Mesh(new THREE.BoxGeometry(10, 60, 10), wd); post.position.set(cx - 114, C.y0 + 30, cz); mapGroup.add(post);
    const table = new THREE.Mesh(new THREE.BoxGeometry(90, 6, 50), wd); table.position.set(cx + 110, C.y0 + 38, cz); table.rotation.y = Math.PI / 2; mapGroup.add(table);
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(70, 36), new THREE.MeshBasicMaterial({ color: 0xd9c9a0 })); chart.rotation.x = -Math.PI / 2; chart.position.set(cx + 110, C.y0 + 41.2, cz); chart.rotation.z = Math.PI / 2; mapGroup.add(chart); }
  // tubarões rodando embaixo de cada prancha (só a barbatana aparece)
  const finM = mat(0x2b3138, { roughness: 0.6 }), sharks = [];
  for (const Pk of w.planks || []) for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(9, 34, 4), finM); f.scale.z = 0.35; mapGroup.add(f); sharks.push({ f, cx: Pk.x, cz: Pk.z + Pk.dir * (SH.plankL + 140), r: 110 + k * 55, ph: k * 2.1, sp: 0.5 + k * 0.15 }); }
  // água no convés quando a onda grande inclina o navio
  const zMin = Math.min(...P.map((q) => q[1])), zMax = Math.max(...P.map((q) => q[1]));
  const waterMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uWet: { value: 0 }, uSide: { value: 1 }, uTime: { value: 0 }, uZ: { value: new THREE.Vector2(zMin, zMax) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w0 = modelMatrix * vec4(position, 1.0); vW = w0.xyz; gl_Position = projectionMatrix * viewMatrix * w0; }', fragmentShader: DECK_WATER_FRAG });
  { const sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, waterMat); m.position.y = 2; m.renderOrder = 2; mapGroup.add(m); }
  // em volta (gira com o balanço): mar agitado, céu de tempestade, pedras soltas, chuva (mais leve que antes)
  const env = new THREE.Group(), inner = new THREE.Group(); env.position.set(cx, 0, cz); inner.position.set(-cx, 0, -cz); env.add(inner); mapGroup.add(env);
  const seaMat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uFlash: { value: 0 } }]), vertexShader: STORM_SEA_VERT.replace('void main(){', '#include <fog_pars_vertex>\nvoid main(){').replace('gl_Position = projectionMatrix * viewMatrix * w0; }', 'gl_Position = projectionMatrix * viewMatrix * w0; vec4 mvPosition = viewMatrix * w0;\n#include <fog_vertex>\n}'), fragmentShader: STORM_SEA_FRAG.replace('uniform float uTime;', '#include <fog_pars_fragment>\nuniform float uTime;'), fog: true });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000, 96, 96), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(cx, SH.sea, cz); inner.add(sea);
  const skyM = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } }, vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform float uFlash; varying vec3 vW; ${NOISE_GLSL} void main(){ float h = vW.y; float n = fbm3(vW.xz / max(0.15, h + 0.3) * 2.2 + vec2(uTime * 0.03, uTime * 0.012));
      vec3 c = mix(vec3(0.16, 0.18, 0.21), vec3(0.05, 0.06, 0.08), smoothstep(-0.05, 0.6, h)); c = mix(c, vec3(0.25, 0.27, 0.3), smoothstep(0.45, 0.8, n) * 0.6);
      c += vec3(0.6, 0.65, 0.85) * uFlash * (0.4 + n * 0.6);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 12), skyM); sky.position.set(cx, 0, cz); inner.add(sky);
  const rockM = mat(0x2f2c2a, { roughness: 1 }), rnd = seeded(66);
  for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(60 + rnd() * 140, 0), rockM); const a = rnd() * Math.PI * 2, d = 2600 + rnd() * 2400; r.position.set(cx + Math.cos(a) * d, SH.sea + 20, cz + Math.sin(a) * d); r.scale.y = 1 + rnd() * 1.5; inner.add(r); } // pedras soltas no mar
  const NR = 900, rp = new Float32Array(NR * 6), rs = []; for (let i = 0; i < NR; i++) rs.push([Math.random() * 1500 - 750, Math.random() * 900, Math.random() * 1500 - 750, 0.8 + Math.random() * 0.4]);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb2c2, transparent: true, opacity: 0.38, depthWrite: false })); rain.frustumCulled = false; inner.add(rain);
  const bolt = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(14 * 3), 3)), new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0, fog: false })); bolt.frustumCulled = false; inner.add(bolt);
  shipFx = { env, sea: seaMat, sky: skyM, sails, rain, rs, bolt, sharks, water: waterMat, wet: 0, flash: 0, nextFlash: 9, nextWash: 2, W, H, strikes: [], boltM: new THREE.MeshBasicMaterial({ color: 0xeaf3ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }) };
}
function updateShipFx(now, dt) {
  const F = shipFx; if (!F) return;
  const S = sim.swayState || { roll: 0, pitch: 0, heave: 0 }, t = now / 1000;
  // o mundo em volta gira ao contrário do navio (o horizonte balança)
  F.env.rotation.set(-S.roll, 0, S.pitch); F.env.position.y = -S.heave;
  F.sea.uniforms.uTime.value = t; F.sky.uniforms.uTime.value = t; F.water.uniforms.uTime.value = t;
  for (const s of F.sails) s.rotation.z = Math.sin(t * 1.3 + s.position.x) * 0.03;
  for (const k of F.sharks) { const a = t * k.sp + k.ph; k.f.position.set(k.cx + Math.cos(a) * k.r, SHIP.sea + 16 + Math.sin(t * 2 + k.ph) * 4, k.cz + Math.sin(a) * k.r); k.f.rotation.y = -a; }
  // chuva em volta da câmera
  const cp = camera.position, a = F.rain.geometry.attributes.position.array;
  for (let i = 0; i < F.rs.length; i++) { const r = F.rs[i]; r[1] -= 1300 * r[3] * dt; if (r[1] < -60) { r[1] += 900; r[0] = Math.random() * 1500 - 750; r[2] = Math.random() * 1500 - 750; } const x = cp.x + r[0], y = cp.y - 300 + r[1], z = cp.z + r[2]; a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - 10; a[i * 6 + 4] = y - 34; a[i * 6 + 5] = z + 4; }
  F.rain.geometry.attributes.position.needsUpdate = true;
  // onda grande inclinou demais: entra água do lado de baixo; quando volta, a água escorre (some devagar)
  const tgt = Math.max(0, Math.min(1, (Math.abs(S.roll) - 0.19) / 0.08));
  const was = F.wet; F.wet += (tgt - F.wet) * Math.min(1, dt * (tgt > F.wet ? 3 : 0.5));
  if (tgt > 0.2) F.water.uniforms.uSide.value = S.roll > 0 ? 1 : -1;
  F.water.uniforms.uWet.value = F.wet;
  if (was < 0.25 && F.wet >= 0.25) SFX.play('wave', 0.7);
  // sons de fundo: chuva e mar; de vez em quando a água bate no casco; trovão bem de vez em quando e longe
  SFX.setBed('rain', 0.028, 'bandpass', 2600, 0.6); SFX.setBed('seaAmb', 0.055, 'lowpass', 380);
  F.nextWash -= dt; if (F.nextWash <= 0) { F.nextWash = 3 + Math.random() * 3.5; SFX.play('wash', 0.35 + Math.random() * 0.3, { pan: Math.random() * 1.6 - 0.8 }); }
  F.nextFlash -= dt;
  if (F.nextFlash <= 0) {
    F.nextFlash = 14 + Math.random() * 12; F.flash = 1;
    const ang = Math.random() * Math.PI * 2, d = 5000 + Math.random() * 3000, bx = F.W / 2 + Math.cos(ang) * d, bz = F.H / 2 + Math.sin(ang) * d, bp = F.bolt.geometry.attributes.position.array;
    for (let i = 0; i < 14; i++) { bp[i * 3] = bx + (Math.random() - 0.5) * 300 * (i ? 1 : 0); bp[i * 3 + 1] = 4200 - i * 330; bp[i * 3 + 2] = bz + (Math.random() - 0.5) * 300 * (i ? 1 : 0); }
    F.bolt.geometry.attributes.position.needsUpdate = true;
    setTimeout(() => SFX.play('thunder', 0.3 + Math.random() * 0.2), 900 + Math.random() * 1800);
  }
  // raios que caem perto (no mar em volta ou no navio): some rápido piscando
  for (let i = F.strikes.length - 1; i >= 0; i--) {
    const k = F.strikes[i]; k.t += dt;
    if (k.warn) { k.m.material.opacity = Math.min(0.9, k.t * 1.2) * (0.6 + 0.4 * Math.sin(k.t * 60)); if (k.t > 1.2) { mapGroup.remove(k.m); k.m.material.dispose(); F.strikes.splice(i, 1); } continue; }
    const on = k.t < 0.08 || (k.t > 0.13 && k.t < 0.24) || (k.t > 0.3 && k.t < 0.36);
    for (const m of k.ms) m.visible = on;
    k.glow.material.opacity = Math.max(0, 1 - k.t * 1.8); k.glow.scale.setScalar(160 + k.t * 200);
    if (k.t > 0.6) { for (const m of k.ms) { mapGroup.remove(m); m.geometry.dispose(); } mapGroup.remove(k.glow); k.glow.material.dispose(); F.strikes.splice(i, 1); }
  }
  F.flash = Math.max(0, F.flash - dt * 3.2);
  const fl = F.flash > 0.6 ? 1 : F.flash * 0.9;
  F.sea.uniforms.uFlash.value = fl; F.sky.uniforms.uFlash.value = fl; F.bolt.material.opacity = F.flash > 0.4 ? 1 : 0;
  hemi.intensity = baseLight.hemi * (1 + fl * 1.6);
}

// raio caindo perto: faísca no chão antes (aviso) e depois o raio fino e torto do céu até o ponto, com clarão e trovão forte
function shipStrike(e) {
  const F = shipFx, y0 = e.sea ? SHIP.sea + 4 : 2;
  if (e.type === 'bolt_warn') {
    if (e.sea) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0x9cc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(e.x, 30, e.z); s.scale.setScalar(110); mapGroup.add(s); F.strikes.push({ warn: true, m: s, t: 0 }); return;
  }
  const path = (x0, yTop, z0, x1, yb, z1, n, jit) => { const pts = []; for (let i = 0; i <= n; i++) { const u = i / n, j = jit * (1 - u * 0.7) * (i && i < n ? 1 : 0); pts.push(new THREE.Vector3(x0 + (x1 - x0) * u + (Math.random() - 0.5) * j, yTop + (yb - yTop) * u, z0 + (z1 - z0) * u + (Math.random() - 0.5) * j)); } return pts; };
  const ms = [], main = path(e.x + (Math.random() - 0.5) * 500, 2600, e.z + (Math.random() - 0.5) * 500, e.x, y0, e.z, 14, 160);
  const tube = (pts, r) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), pts.length * 3, r, 4, false), F.boltM); m.frustumCulled = false; mapGroup.add(m); ms.push(m); };
  tube(main, 3.2);
  for (let b = 0; b < 2; b++) { const i = 3 + Math.floor(Math.random() * 6), p0 = main[i]; tube(path(p0.x, p0.y, p0.z, p0.x + (Math.random() - 0.5) * 700, p0.y - 500 - Math.random() * 500, p0.z + (Math.random() - 0.5) * 700, 6, 90), 1.6); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xcfe2ff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.position.set(e.x, y0 + 30, e.z); glow.scale.setScalar(160); mapGroup.add(glow);
  F.strikes.push({ ms, glow, t: 0 }); F.flash = 1;
  const me = sim.players.get('me'), d = me ? Math.hypot(me.x - e.x, me.z - e.z) : 2000;
  if (d < 1600) SFX.play('strike', Math.max(0.4, Math.min(1, 1.25 - d / 1600))); else SFX.play('thunder', 0.55);
}
function buildMap(mapId) {
  for (const k in SFX.beds()) SFX.setBed(k, 0); // (sons de fundo do mapa anterior param)
  setEditOverride(netMode ? null : localEdits()); applyFx(); // no multiplayer vale só o que está salvo no jogo (igual pro servidor)
  if (mapGroup) scene.remove(mapGroup);
  disposePortals(); lampLights = []; lampPool = []; lavaFx = []; volcano = null; ceilLights = []; ceilPoints = []; doorMeshes = []; naveRoof = null; metroFx = null; seaFx = null; obraFx = null; factoryFx = null; shipFx = null;
  if (dragonFx) { scene.remove(dragonFx.g, dragonFx.strip); for (const f of dragonFx.flames) scene.remove(f); for (const b of dragonFx.burns) scene.remove(b.f); dragonFx = null; }
  for (const w of meteorFx.warn) scene.remove(w.sh, w.ring, w.rock, w.fire, w.trail);
  meteorFx = { falling: [], rocks: new Map(), warn: [] };
  for (const fx of [tornadoFx, stormFx]) if (fx) scene.remove(fx.g);
  tornadoFx = null; stormFx = null;
  const world = world3D(mapId, G, MAPS, CFG);
  if (mapId === 'teste') return buildTestRoom(world);
  const map = MAPS[mapId], th = Object.assign({}, map.theme, THEME3D[mapId] || {}), W = world.W, H = world.H, T = world.t;
  mapGroup = new THREE.Group();
  const nightMap = mapId === 'cidade' || mapId === 'escuro';
  // céu/neblina de cada mapa
  const sky = mapId === 'castelo' ? 0x6b5a7a : mapId === 'navio' ? 0x1c2127 : map.space ? 0x020308 : nightMap ? 0x05060a : mapId === 'vulcao' ? 0x2a1712 : mapId === 'portal' ? 0x1b1f26 : mapId === 'metro' ? 0x0d0f12 : mapId === 'fabrica' ? 0x15171b : mapId === 'mar' ? 0x8ec9f0 : mapId === 'deserto' ? 0xb9d3e8 : 0x9cc7ee;
  scene.background = new THREE.Color(sky);
  camera.far = mapId === 'vulcao' ? 45000 : mapId === 'castelo' ? 40000 : mapId === 'navio' ? 14000 : 8000; camera.updateProjectionMatrix(); // vulcão: dá pra ver lá embaixo
  scene.fog = map.space ? null
    : mapId === 'deserto' ? new THREE.Fog(0xdcc9a2, 2000, 7600)
    : mapId === 'castelo' ? new THREE.Fog(0x8e7a8e, 3500, 17000)
    : mapId === 'navio' ? new THREE.Fog(0x283038, 650, 4200)
    : mapId === 'vulcao' ? new THREE.Fog(0x8a6048, 4000, 26000)
    : mapId === 'cidade' ? new THREE.Fog(0x05060a, 900, 3800)
    : mapId === 'mar' ? new THREE.Fog(0xa9d6f2, 2500, 9000)
    : mapId === 'obra' ? new THREE.Fog(0xb9d3e8, 2600, 9000)
    : mapId === 'metro' ? new THREE.Fog(0x0d0f12, 2200, 5000)
    : new THREE.Fog(nightMap ? 0x05060a : sky, nightMap ? 300 : 1800, nightMap ? 1700 : 5200);
  mapWalls = world.walls;
  const holes = world.holes, dunes = mapId === 'deserto' ? new DuneField(mapWalls, W, H, { pyramids: world.pyramids }) : null;
  const borderH = world.borderH || P.borderH, closed = !!world.borderH;
  mapInfo = { mapId, world, holes, dunes, borderH, W, H };
  // chão
  if (dunes) mapGroup.add(buildDuneGround(th, dunes, W, H));
  else if (holes) buildVolcanoWorld(th, W, H);
  else if (mapId === 'navio') { // convés: só dentro do casco (em volta é mar)
    const sh = new THREE.Shape(world.deck.poly.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    { const pa = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / W, 1 - pa.getZ(i) / H); }
    const deck = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: groundTexture(th, 811, 'wood', { walls: mapWalls, W, H }), roughness: 0.9 })); deck.position.y = 0.05; deck.receiveShadow = true; mapGroup.add(deck);
  }
  else {
    const gstyle = mapId === 'castelo' ? 'castle' : mapId === 'nave' ? 'deck' : mapId === 'portal' ? 'lab' : mapId === 'cidade' ? 'city' : mapId === 'metro' ? 'metro' : mapId === 'mar' ? 'wood' : mapId === 'obra' ? 'dirt' : mapId === 'fabrica' ? 'factory' : null;
    const gm = new THREE.MeshStandardMaterial({ map: groundTexture(th, mapId.length * 97, gstyle, { walls: mapWalls, W, H, lanes: world.lanes, belts: world.belts }), roughness: mapId === 'nave' ? 0.6 : 0.95, metalness: mapId === 'nave' ? 0.35 : 0 });
    if (world.moat) { // castelo: chão com o buraco do lago e a ilha lá em cima (mesmo desenho do chão)
      const M = world.moat, uvXZ = (g) => { const pa = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / W, 1 - pa.getZ(i) / H); };
      const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(W, 0), new THREE.Vector2(W, -H), new THREE.Vector2(0, -H)]);
      const hole = new THREE.Path(); hole.absarc(M.cx, -M.cz, M.r1, 0, Math.PI * 2, true); sh.holes.push(hole);
      const g = new THREE.ShapeGeometry(sh, 48); g.rotateX(-Math.PI / 2); uvXZ(g); const m = new THREE.Mesh(g, gm); m.receiveShadow = true; mapGroup.add(m);
      // ilha: com um buraco onde fica o salão (o chão de pedra do salão não briga com a grama = não pisca)
      const ish = new THREE.Shape(); ish.absarc(M.cx, -M.cz, M.r0, 0, Math.PI * 2, false);
      if (world.hall) { const Hh = world.hall, kt = Hh.kt, hp = new THREE.Path(); hp.moveTo(Hh.kx0 + kt, -(Hh.kz0 + kt)); hp.lineTo(Hh.kx0 + kt, -(Hh.kz1 - kt)); hp.lineTo(Hh.kx1 - kt, -(Hh.kz1 - kt)); hp.lineTo(Hh.kx1 - kt, -(Hh.kz0 + kt)); hp.lineTo(Hh.kx0 + kt, -(Hh.kz0 + kt)); ish.holes.push(hp); }
      const gi = new THREE.ShapeGeometry(ish, 64); gi.rotateX(-Math.PI / 2); uvXZ(gi); const mi = new THREE.Mesh(gi, gm); mi.position.y = world.castleBase || 0; mi.receiveShadow = true; mapGroup.add(mi);
    } else {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), gm);
      ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
      mapGroup.add(ground);
    }
  }
  // muros
  const style = WALL_STYLE[mapId] || 'brick';
  const wtex = wallTexture(th.wall, style), btex = wallTexture(th.border, style);
  let iceMat = null;
  // materiais das paredes compartilhados (um por textura/cor), e o UV da caixa em tamanho real
  const _side = new Map(), _top = new Map();
  const sharedSide = (base) => { if (!_side.has(base)) { base.wrapS = base.wrapT = THREE.RepeatWrapping; base.needsUpdate = true; _side.set(base, new THREE.MeshStandardMaterial({ map: base, roughness: 0.9, metalness: 0 })); } return _side.get(base); };
  const sharedTop = (tint) => { const k = tint || '_'; if (!_top.has(k)) _top.set(k, tint ? new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).multiplyScalar(0.75), roughness: 0.8 }) : mat(th.wallEdge)); return _top.get(k); };
  const drawWall = (R) => {
    if (R.pframe != null || R.plat || R.rail || R.igloo != null || R.thouse || R.door3d != null || R.mezz || R.mstep || R.mrail || R.piston || R.mast || R.smast || R.style === 'barrel' || R.style === 'cannon' || R.throne || R.shipHull || ((mapId === 'mar' || mapId === 'vulcao') && R.border)) return; // desenhados separados
    if (R.tree) { addTree(R.x + R.w / 2, R.y + R.h / 2, 1, mapGroup); return; } // árvore da floresta
    if (dunes && DuneField.isDune(R)) return; // virou montanha de areia
    if (R.space && !map.space) return;
    const hgt = R.top != null ? R.top : R.border || R.space ? borderH : P.wallH;
    if (style === 'ice' && !R.border) {
      // gelo: dá pra ver um pouco o que está atrás de UMA parede, mas bem menos que antes
      if (!iceMat) iceMat = new THREE.MeshPhysicalMaterial({ map: wtex, color: 0x86b8df, transparent: true, opacity: 0.88, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMap: iceEnvMap(), envMapIntensity: 1.2, emissive: 0x123a5c, emissiveIntensity: 0.12 });
      const t = wtex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(R.w, R.h) / 140, 1);
      const m = iceMat.clone(); m.map = t;
      const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), m);
      box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2);
      box.castShadow = false; box.receiveShadow = true;
      mapGroup.add(box);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(R.w + 2, 6, R.h + 2), mat(0xffffff, { roughness: 1, emissive: 0x9fb8cc, emissiveIntensity: 0.25 })); // neve em cima
      cap.position.set(R.x + R.w / 2, hgt + 2.5, R.y + R.h / 2); cap.castShadow = true; cap.receiveShadow = true;
      mapGroup.add(cap);
      return;
    }
    const y0 = R.y0 || 0, bh = hgt - y0;
    const hull = style === 'corridor' && (R.border || R.space);
    const base = hull ? HULL_TEX : R.tint ? tintTex(R.tint, R.style || style) : R.border || R.space ? btex : wtex; // (mar: contêineres coloridos e caixotes de madeira)
    if (!hull && style !== 'corridor') {
      // (mais leve: a textura não é copiada pra cada parede — o tamanho do desenho vai no UV da caixa e o material é o mesmo)
      const k = R.style === 'wood' ? 1 / 64 : (style === 'lab' || style === 'sandstone' || style === 'basalt' || style === 'tile' || style === 'container' || style === 'concrete') ? 1 / 128 : 1 / 64;
      const geo = new THREE.BoxGeometry(R.w, bh, R.h); boxUV(geo, R.w, bh, R.h, k);
      const box = new THREE.Mesh(geo, [sharedSide(base), sharedSide(base), sharedTop(R.tint), sharedTop(R.tint), sharedSide(base), sharedSide(base)]);
      box.position.set(R.x + R.w / 2, y0 + bh / 2, R.y + R.h / 2);
      box.castShadow = !(closed && (R.border || R.space)) && bh > 30; box.receiveShadow = true;
      mapGroup.add(box); return;
    }
    const t = base.clone(); t.needsUpdate = true;
    if (hull) t.repeat.set(Math.max(R.w, R.h) / 150, bh / 180); // 2 fileiras de janela na parede alta
    else if (style === 'corridor') t.repeat.set(Math.max(R.w, R.h) / 150, 1);
    else if (R.style === 'wood') t.repeat.set(Math.max(R.w, R.h) / 64, bh / 64);
    else if (style === 'lab' || style === 'sandstone' || style === 'basalt' || style === 'tile' || style === 'container' || style === 'concrete') t.repeat.set(Math.max(R.w, R.h) / 128, bh / 128);
    else t.repeat.set(Math.max(R.w, R.h) / 64, bh / 64);
    const sideOpts = { map: t, roughness: style === 'corridor' ? 0.45 : 0.9, metalness: style === 'corridor' ? 0.35 : 0 };
    if (hull) Object.assign(sideOpts, { transparent: true, alphaTest: 0.02, emissive: 0x000000 });
    else if (style === 'corridor') { const e = CORRIDOR_EMIS.clone(); e.needsUpdate = true; e.repeat.copy(t.repeat); Object.assign(sideOpts, { emissive: 0xffffff, emissiveMap: e, emissiveIntensity: 1.2 }); }
    const side = new THREE.MeshStandardMaterial(sideOpts), top = R.tint ? new THREE.MeshStandardMaterial({ color: new THREE.Color(R.tint).multiplyScalar(0.75), roughness: 0.8 }) : mat(th.wallEdge, style === 'corridor' ? { metalness: 0.5, roughness: 0.45 } : {});
    const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, bh, R.h), [side, side, top, top, side, side]);
    box.position.set(R.x + R.w / 2, y0 + bh / 2, R.y + R.h / 2);
    box.castShadow = !(closed && (R.border || R.space)); box.receiveShadow = true; // mapa fechado: a borda alta não faz sombra dentro
    mapGroup.add(box);
    };
  // navio: as estruturas (castelos, cabine, escadas, amurada) mais claras que antes — o chão do convés fica como está
  if (mapId === 'navio') for (const R of mapWalls) if (R.tint && !R._lit) { const c = new THREE.Color(R.tint); c.offsetHSL(0, -0.04, 0.12); R.tint = '#' + c.getHexString(); R._lit = true; }
  for (const R of mapWalls) { const c0 = mapGroup.children.length; drawWall(R); if (R.item != null) for (let i = c0; i < mapGroup.children.length; i++) mapGroup.children[i].userData.item = R.item; } // (editor 3D: cada peça sabe qual item ela é)
  // paredes em diagonal do contorno (mapas de formato irregular)
  for (const S of world.segs || []) {
    if (S.tpillar) continue; // (coluna da torre do castelo: desenhada redonda)
    const dx = S.bx - S.ax, dz = S.bz - S.az, L = Math.hypot(dx, dz) + S.t * 2, y0s = S.y0 || 0, hgt = S.top - y0s;
    const side = sharedSide(btex), topM = sharedTop(null), geo = new THREE.BoxGeometry(L, hgt, S.t * 2); boxUV(geo, L, hgt, S.t * 2, 1 / 128);
    const m = new THREE.Mesh(geo, [topM, topM, topM, topM, side, side]);
    m.position.set((S.ax + S.bx) / 2, y0s + hgt / 2, (S.az + S.bz) / 2); m.rotation.y = -Math.atan2(dz, dx); m.castShadow = m.receiveShadow = true; mapGroup.add(m); if (S.item != null) m.userData.item = S.item;
  }
  // rampas feitas no editor: cunha maciça (sobe de h0 até h1)
  for (const S of world.slopes || []) {
    if (!S.user) continue;
    const alongX = S.axis === 'x', a0 = alongX ? S.x0 : S.z0, a1 = alongX ? S.x1 : S.z1, wd = alongX ? S.z1 - S.z0 : S.x1 - S.x0;
    const sh = new THREE.Shape(); sh.moveTo(a0, 0); sh.lineTo(a1, 0); sh.lineTo(a1, Math.max(0.5, S.h1)); sh.lineTo(a0, Math.max(0.5, S.h0)); sh.lineTo(a0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: wd, bevelEnabled: false });
    { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 128, uv.getY(i) / 128); }
    const t = wtex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
    if (alongX) m.position.z = S.z0; else { m.rotation.y = -Math.PI / 2; m.position.x = S.x0 + wd; }
    m.castShadow = m.receiveShadow = true; if (S.item != null) m.userData.item = S.item; mapGroup.add(m);
  }
  if (world.treehouse) buildTreehouse(world.treehouse);
  for (const q of world.pyramids || []) { const c0 = mapGroup.children.length; buildPyramid(q); if (q.item != null) for (let i = c0; i < mapGroup.children.length; i++) mapGroup.children[i].userData.item = q.item; }
  if (world.igloos.length) buildIgloos(world.igloos);
  if (world.doors.length) buildDoors(world.doors);
  if (mapId === 'portal') buildPlatforms();
  // enfeites espalhados pelo chão
  const rnd = seeded(mapId.length * 31 + 5), cfg3 = world.cfg;
  for (let i = 0; i < 60; i++) {
    const x = 40 + rnd() * (W - 80), z = 40 + rnd() * (H - 80);
    if (!G.circleFree(x, z, 30, mapWalls.filter((R) => !(R.y0 > 100)), cfg3)) continue;
    if (holes && holes.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + 30)) continue;
    const tz = world.treehouse && world.treehouse.zone;
    if (tz && x > tz.x0 - 20 && x < tz.x1 + 20 && z > tz.z0 - 20 && z < tz.z1 + 20) continue;
    if ((world.pyramids || []).some((q) => Math.max(Math.abs(x - q.x), Math.abs(z - q.z)) < q.half + 20)) continue; // nada em cima da pirâmide
    const gy = groundY(x, z);
    let obj = null;
    if (th.deco === 'rocks') { obj = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + rnd() * 9, 0), mat(0xa47645)); obj.position.set(x, gy + 3, z); obj.rotation.set(rnd() * 3, rnd() * 3, 0); }
    else if (th.deco === 'snow') { obj = new THREE.Mesh(new THREE.SphereGeometry(14 + rnd() * 10, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff)); obj.position.set(x, 0, z); obj.scale.y = 0.5; }
    else if (th.deco === 'tree') { // plantinhas e folhas baixinhas (não tampam nem o boneco pequeno)
      const k = 0.6 + rnd() * 0.5; obj = new THREE.Group();
      for (let j = 0; j < 3; j++) { const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(6 * k, 0), mat(j % 2 ? 0x3f7d3a : 0x4f8f45)); lf.position.set((rnd() - 0.5) * 12, 3 * k, (rnd() - 0.5) * 12); lf.scale.y = 0.45; obj.add(lf); }
      obj.position.set(x, 0, z);
    }
    else if (th.deco === 'panels') { obj = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 16), mat(0x6b7280, { metalness: 0.5, roughness: 0.4 })); obj.position.set(x, 6, z); } // caixote de carga
    else if (th.deco === 'ash') { obj = new THREE.Mesh(new THREE.DodecahedronGeometry(5 + rnd() * 8, 0), mat(0x3a2a24)); obj.position.set(x, 3, z); obj.rotation.set(rnd() * 3, rnd() * 3, 0); }
    if (obj) { obj.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); mapGroup.add(obj); }
    if (mapId === 'deserto' && rnd() < 0.35) { // alguns cactos aleatórios no deserto
      const cx = 40 + rnd() * (W - 80), cz = 40 + rnd() * (H - 80);
      const onPyr = (world.pyramids || []).some((q) => Math.max(Math.abs(cx - q.x), Math.abs(cz - q.z)) < q.half + 25); // nada de cacto na pirâmide
      if (!onPyr && G.circleFree(cx, cz, 20, mapWalls, cfg3)) {
        const cg = new THREE.Group(), cactusMat = mat(0x2f7d4f);
        const hb = 48 + rnd() * 26, body = new THREE.Mesh(new THREE.CylinderGeometry(6, 7.5, hb, 8), cactusMat); body.position.y = hb / 2; // cactos mais altos
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, 20, 6), cactusMat); arm.position.set(8, hb * 0.55, 0); arm.rotation.z = -0.9;
        const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 16, 6), cactusMat); arm2.position.set(-7, hb * 0.4, 0); arm2.rotation.z = 0.9;
        cg.add(body, arm, arm2); cg.position.set(cx, groundY(cx, cz) - 1, cz);
        cg.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        mapGroup.add(cg);
      }
    }
  }
  // teto que ricocheteia tiro (folhas da floresta / vidro da nave / teto da sala escura e dos portais)
  const ceilY = CEILING_Y[mapId];
  if (ceilY && (mapId === 'escuro' || mapId === 'portal' || mapId === 'metro' || mapId === 'fabrica')) buildCeiling(mapId, ceilY, W, H);
  else if (mapId === 'mar') { // teto de vidro liso, quase transparente (o tiro ricocheteia nele) — sem estrutura nem colunas
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0xe4f4ff, transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    glass.rotation.x = -Math.PI / 2; glass.position.set(W / 2, ceilY, H / 2); mapGroup.add(glass);
  }
  else if (mapId === 'nave') buildNaveRoof([]);
  else if (ceilY) {
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x2f6b34, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    roof.rotation.x = -Math.PI / 2; roof.position.set(W / 2, ceilY, H / 2);
    mapGroup.add(roof);
  }
  // o que fica em volta de cada mapa
  if (mapId === 'deserto') buildDesertOutside(W, H);
  else if (mapId === 'floresta') buildForestOutside(W, H);
  else if (mapId === 'neve') buildSnowOutside(W, H);
  else if (map.space) buildMoonOutside(W, H);
  else if (mapId === 'cidade') buildCityOutside(W, H);
  else if (mapId === 'metro') buildMetro(world);
  else if (mapId === 'mar') buildSea(world);
  else if (mapId === 'obra') buildObra(world);
  else if (mapId === 'castelo') buildCastle(world);
  else if (mapId === 'navio') buildShip(world);
  if (mapId === 'fabrica') buildFactory(world);
  if (world.portalSlots.length) buildPortalViews(world.portalSlots, btex, borderH);
  // cidade à noite: postes que iluminam de verdade (atirar apaga por um tempo)
  if (world.lamps) { for (const [x, z, dx, dz] of world.lamps) addLamp(x, z, dx, dz); lampPool = []; for (let k = 0; k < 6; k++) { const pl = new THREE.PointLight(0xffd59a, 0, 700, 2); mapGroup.add(pl); lampPool.push(pl); } }
  // luz do ambiente de cada mapa
  hemi.color.set(0xffffff); hemi.groundColor.set(0x445566); sun.color.set(0xffffff);
  if (mapId === 'cidade') { hemi.intensity = 0.16; hemi.color.set(0x8fa6d8); sun.intensity = 0.06; }
  else if (map.space) { hemi.intensity = 0.55; hemi.color.set(0xc9d6ff); hemi.groundColor.set(0x2a2c30); sun.intensity = 3.0; }
  else if (mapId === 'vulcao') { hemi.intensity = 1.25; hemi.color.set(0xffc2a0); hemi.groundColor.set(0x4a2418); sun.intensity = 2.0; sun.color.set(0xffc8a0); }
  else if (mapId === 'portal') { hemi.intensity = 1.1; hemi.color.set(0xe8eefc); sun.intensity = 1.9; }
  else if (mapId === 'deserto') { hemi.intensity = 1.2; hemi.groundColor.set(0x8a6a44); sun.intensity = 2.6; sun.color.set(0xfff1d6); }
  else if (mapId === 'escuro') { hemi.intensity = 0.9; sun.intensity = 1.5; } // sala escura: um pouco mais escura mesmo com a luz acesa
  else if (mapId === 'metro') { hemi.intensity = 1.0; hemi.color.set(0xfff4e0); sun.intensity = 1.2; }
  else if (mapId === 'fabrica') { hemi.intensity = 0.95; hemi.color.set(0xfff0dc); sun.intensity = 1.1; }
  else if (mapId === 'obra') { hemi.intensity = 1.3; hemi.color.set(0xfff4e6); hemi.groundColor.set(0x9a8a74); sun.intensity = 2.5; sun.color.set(0xffefd6); }
  else if (mapId === 'castelo') { hemi.intensity = 1.1; hemi.color.set(0xffe6d6); hemi.groundColor.set(0x6a6478); sun.intensity = 2.1; sun.color.set(0xffc48a); }
  else if (mapId === 'navio') { hemi.intensity = 0.85; hemi.color.set(0xa9b8cc); hemi.groundColor.set(0x1d2226); sun.intensity = 0.55; sun.color.set(0xc8d4e6); }
  else if (mapId === 'mar') { hemi.intensity = 1.35; hemi.color.set(0xeaf6ff); hemi.groundColor.set(0x2a5877); sun.intensity = 2.6; sun.color.set(0xfff6e6); }
  else { hemi.intensity = 1.3; sun.intensity = 2.3; }
  baseLight = { hemi: hemi.intensity, sun: sun.intensity };
  sun.castShadow = mapId !== 'navio'; // navio: tempestade escura (quase não tem sombra) — sem sombra fica bem mais leve
  scene.add(mapGroup);
  if (portalViews.length) warmPortals();
  sun.position.set(W / 2 - 600, 1500, H / 2 + 800); sun.target.position.set(W / 2, 0, H / 2);
}

// ---------- bonecos KayKit ----------
// personagens (KayKit Adventurers, CC0): todos usam o mesmo esqueleto e as mesmas animações
const CHAR_MODELS = { hood: ['/demo3d/models/Rogue_Hooded.glb', 'Ladino (capuz)'], rogue: ['/demo3d/models/Rogue.glb', 'Ladino'], knight: ['/demo3d/models/Knight.glb', 'Cavaleiro'], barbarian: ['/demo3d/models/Barbarian.glb', 'Bárbaro'], mage: ['/demo3d/models/Mage.glb', 'Maga'] };
const CHAR_IDS = Object.keys(CHAR_MODELS);
const BASE = {};
const UPPER = new Set(['spine', 'chest', 'head', 'upperarm.l', 'upperarm.r', 'lowerarm.l', 'lowerarm.r', 'wrist.l', 'wrist.r', 'hand.l', 'hand.r', 'handslot.l', 'handslot.r', 'elbowIK.l', 'elbowIK.r', 'handIK.l', 'handIK.r']);
const CLIPS = {};
function splitClips(anims) {
  for (const clip of anims) {
    if (CLIPS[clip.name]) continue;
    const bone = (t) => t.name.split('.').slice(0, -1).join('.');
    CLIPS[clip.name] = {
      full: clip,
      upper: new THREE.AnimationClip(clip.name + '_U', clip.duration, clip.tracks.filter((t) => UPPER.has(bone(t)))),
      lower: new THREE.AnimationClip(clip.name + '_L', clip.duration, clip.tracks.filter((t) => !UPPER.has(bone(t))))
    };
    // (v0.30) facada na 3ª pessoa: corte na horizontal só com o braço e o tronco (a cabeça não mexe)
    if (clip.name === '1H_Melee_Attack_Slice_Horizontal' && !CLIPS.KnifeSlice) { const up = clip.tracks.filter((t) => UPPER.has(bone(t)) && !/^head/.test(bone(t))); CLIPS.KnifeSlice = { full: clip, upper: new THREE.AnimationClip('KnifeSlice_U', clip.duration, up), lower: CLIPS[clip.name].lower }; }
  }
}
const modelLoading = {};
function loadModel(k) {
  if (!CHAR_MODELS[k]) k = 'hood';
  if (!modelLoading[k]) modelLoading[k] = new GLTFLoader().loadAsync(CHAR_MODELS[k][0]).then((g) => { BASE[k] = g; splitClips(g.animations); return g; });
  return modelLoading[k];
}
// 1ª pessoa: a besta (crossbow) igual à que o boneco segura em 3ª pessoa, no lugar do arco
// monta a arma da 1ª pessoa a partir do item que o boneco segura (mesmo modelo da 3ª pessoa)
function itemViewMesh(name, len, flip) {
  const src = BASE.hood && BASE.hood.scene.getObjectByName(name); if (!src) return null;
  const geo = src.geometry; geo.computeBoundingBox();
  const bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const ax = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a)), L = ax[0], lo = bb.min.getComponent(L), hi = bb.max.getComponent(L);
  let sHi = 0, sLo = 0; const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const u = pos.getComponent(i, L), w = Math.abs(pos.getComponent(i, ax[1]) - ctr.getComponent(ax[1])); if (u > hi - (hi - lo) * 0.25) sHi = Math.max(sHi, w); if (u < lo + (hi - lo) * 0.25) sLo = Math.max(sLo, w); }
  let front = sHi >= sLo ? -1 : 1; if (flip) front = -front;
  const tgt = []; tgt[L] = new THREE.Vector3(0, 0, front); tgt[ax[1]] = new THREE.Vector3(1, 0, 0); tgt[ax[2]] = new THREE.Vector3(0, 1, 0);
  const M = new THREE.Matrix4().makeBasis(tgt[0], tgt[1], tgt[2]);
  if (M.determinant() < 0) { tgt[ax[1]].x = -1; M.makeBasis(tgt[0], tgt[1], tgt[2]); }
  const k = len / (hi - lo), mesh = new THREE.Mesh(geo, src.material.clone()); mesh.position.copy(ctr).multiplyScalar(-1);
  const holder = new THREE.Group(); holder.add(mesh); holder.matrixAutoUpdate = false; holder.matrix.copy(M).multiply(new THREE.Matrix4().makeScale(k, k, k));
  return holder;
}
function makeKnifeView() {
  const G2 = VIEW.knife; if (!G2 || G2.userData.real) return;
  const h = itemViewMesh('Knife', 21, false); if (!h) return;
  const kb = G2.userData.kp.userData.body; for (const o of kb.children.slice()) kb.remove(o);
  // a mesma faca da 3ª pessoa, maior e com a lâmina apontando pra frente e um pouco pra cima (dá pra ver inteira);
  // (v0.27) virada no eixo da lâmina: o fio fica pro lado de dentro
  const k = new THREE.Group(), fl = new THREE.Group(); fl.rotation.z = Math.PI; fl.add(h); k.add(fl); k.quaternion.copy(KNIFE_Q); k.position.copy(KNIFE_POS); kb.add(k); G2.userData.real = h;
}
function makeCrossbowView() {
  makeKnifeView();
  const src = BASE.hood && BASE.hood.scene.getObjectByName('2H_Crossbow'), G2 = VIEW.arco;
  if (!src || !G2 || G2.userData.cb) return;
  const geo = src.geometry; geo.computeBoundingBox();
  const bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const ax = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a)); // [comprimento, largura, altura]
  const pos = geo.attributes.position, L = ax[0], Wd = ax[1], lo = bb.min.getComponent(L), hi = bb.max.getComponent(L), len = hi - lo;
  let sHi = 0, sLo = 0; // a ponta mais larga (onde ficam os braços da besta) é a frente
  for (let i = 0; i < pos.count; i++) { const u = pos.getComponent(i, L), w = Math.abs(pos.getComponent(i, Wd) - ctr.getComponent(Wd)); if (u > hi - len * 0.25) sHi = Math.max(sHi, w); if (u < lo + len * 0.25) sLo = Math.max(sLo, w); }
  const tgt = []; tgt[L] = new THREE.Vector3(0, 0, sHi >= sLo ? -1 : 1); tgt[Wd] = new THREE.Vector3(1, 0, 0); tgt[ax[2]] = new THREE.Vector3(0, 1, 0);
  const M = new THREE.Matrix4().makeBasis(tgt[0], tgt[1], tgt[2]);
  if (M.determinant() < 0) { tgt[Wd].x = -1; M.makeBasis(tgt[0], tgt[1], tgt[2]); }
  const k = 23 / len, mesh = new THREE.Mesh(geo, src.material.clone());
  mesh.position.copy(ctr).multiplyScalar(-1);
  const holder = new THREE.Group(); holder.add(mesh); holder.matrixAutoUpdate = false;
  holder.matrix.copy(M).multiply(new THREE.Matrix4().makeScale(k, k, k));
  for (const o of G2.userData.bow) o.visible = false, G2.remove(o);
  G2.add(holder); G2.rotation.z = 0; G2.userData.cb = holder;
  G2.traverse((o) => { if (o.userData.arrow) { o.position.y = size.getComponent(ax[2]) * k * 0.5 + 0.4; o.scale.set(0.7, 0.6, 0.7); } });
}
async function loadModels() {
  await loadModel('hood'); await loadModel('rogue'); // os outros carregam por trás (aparecem quando chegarem)
  makeCrossbowView(); fpRefreshArms();
  for (const k of CHAR_IDS) loadModel(k).catch((e) => console.warn('modelo', k, e));
}
function textSprite(text, color, h = 0.04) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 30px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 128, 32);
  g.fillStyle = color; g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  // depthWrite off + desenhado por último: o retângulo invisível em volta do nome não "apaga" o vidro/fumaça atrás dele
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, sizeAttenuation: false, depthWrite: false, alphaTest: 0.01 }));
  sp.scale.set(h * 4, h, 1); sp.renderOrder = 20;
  return sp;
}
// arma na mão do boneco para cada arma do jogo
const HAND_ITEM = { lancador: '1H_Crossbow', estilingue: 'Sling3D', arco: '2H_Crossbow', mao: 'Snow3D', disco: 'Throwable', knife: 'Knife', nade: 'Throwable', smoke: 'Throwable', varinha: 'Wand3D' }; // cada arma na mão certa
const AIM_ANIM = { lancador: '1H_Ranged_Aiming', estilingue: '1H_Ranged_Aiming', arco: '2H_Ranged_Aiming', varinha: 'Spellcasting' };
const SHOOT_ANIM = { lancador: ['1H_Ranged_Shoot', 1.7], estilingue: ['1H_Ranged_Shoot', 1.7], arco: ['2H_Ranged_Shoot', 1.6], mao: ['Throw', 2.2], disco: ['Throw', 1.8], varinha: ['Spellcast_Shoot', 2.2] };
const RELOAD_ANIM = { lancador: '1H_Ranged_Reload', estilingue: '1H_Ranged_Reload', arco: '2H_Ranged_Reload', mao: 'PickUp', disco: 'PickUp', varinha: 'Spellcast_Raise' };
// varinha mágica (feita aqui): cabo de madeira e ponta que brilha na cor do time
function makeWandMesh(team, scale) {
  const g = new THREE.Group(), col = TEAM_EMIS[team] || 0xffffff;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.8 * scale, 16 * scale, 8), mat(0x6b4426)); g.add(stick);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.95 * scale, 0.95 * scale, 5 * scale, 8), mat(0x2b1d14)); grip.position.y = -5 * scale; g.add(grip);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(1.6 * scale, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2 })); tip.position.y = 9 * scale; g.add(tip);
  g.userData.tip = tip; tip.userData.tint = 3; return g;
}

class Avatar {
  constructor(p) {
    this.id = p.id; this.team = p.team;
    this.root = new THREE.Group();
    // roupa: a sua vem das configurações; bots sorteiam; no multiplayer vem do servidor
    const look = normLook(p.id === 'me' ? S.look : p.look || botLook(p.id + p.name));
    this.lookKey = JSON.stringify(look) + p.team;
    let key = look.m;
    if (!BASE[key]) { this.pending = key; loadModel(key); key = 'hood'; } // ainda carregando: usa o ladino por enquanto
    this.model = SkeletonUtils.clone(BASE[key].scene);
    dressModel(this.model, key, look, p.team, BASE);
    const box = new THREE.Box3().setFromObject(this.model);
    this.baseScale = CHAR_H / ((box.max.y - box.min.y) || 1);
    this.model.scale.setScalar(this.baseScale);
    this.items = {};
    this.model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (['1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Knife_Offhand'].includes(o.name)) { this.items[o.name] = o; o.visible = false; }
    });
    { const hr = this.model.getObjectByName('handslotr'); if (hr) {
      const k = 1 / this.baseScale, w = makeWandMesh(p.team, k); w.name = 'Wand3D'; w.rotation.x = Math.PI / 2; w.visible = false; hr.add(w); this.items.Wand3D = w;
      // estilingue (forquilha de madeira com elástico) e bolinha de neve na mão
      const sl = new THREE.Group(), wood = mat(0x8b5a2b);
      const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * k, 1.1 * k, 7 * k, 6), wood); sl.add(hdl);
      for (const sd of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * k, 0.8 * k, 6 * k, 6), wood); f.position.set(sd * 1.8 * k, 5.6 * k, 0); f.rotation.z = -sd * 0.45; sl.add(f); }
      const band = new THREE.Mesh(new THREE.BoxGeometry(5.6 * k, 0.5 * k, 0.5 * k), mat(0xef4444)); band.position.y = 8 * k; sl.add(band);
      sl.name = 'Sling3D'; sl.rotation.x = Math.PI / 2; sl.scale.setScalar(1.35); sl.visible = false; hr.add(sl); this.items.Sling3D = sl;
      const sb = new THREE.Mesh(new THREE.SphereGeometry(3.8 * k, 12, 9), new THREE.MeshStandardMaterial({ color: new THREE.Color(TEAM_EMIS[p.team] || 0xffffff).lerp(new THREE.Color(0xffffff), 0.45), roughness: 0.95 }));
      sb.name = 'Snow3D'; sb.position.set(0, 2 * k, 0); sb.visible = false; hr.add(sb); this.items.Snow3D = sb;
    } }
    this.root.add(this.model);
    // garrafinha de poção na mão direita (aparece só enquanto bebe)
    const hand = this.model.getObjectByName('handslotr') || this.model.getObjectByName('handr');
    if (hand) {
      const b = new THREE.Group(), s = 1 / this.baseScale;
      b.add(new THREE.Mesh(new THREE.SphereGeometry(4.2 * s, 10, 8), new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.8, roughness: 0.2 })));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.3 * s, 1.6 * s, 4.5 * s, 8), new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.6 })); neck.position.y = 5 * s; b.add(neck);
      b.visible = false; hand.add(b); this.bottle = b;
    }
    this.ring = new THREE.Mesh(new THREE.RingGeometry(20, 25, 28), new THREE.MeshBasicMaterial({ color: TEAM[p.team], transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.8; this.ring.visible = false; // sem círculo embaixo (pedido do Caique)
    this.root.add(this.ring);
    if (p.id !== 'me') { this.label = textSprite(p.name, p.team === 'A' ? '#93c5fd' : '#fca5a5'); this.label.position.y = CHAR_H + 18; this.root.add(this.label); }
    scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.cur = { lower: null, upper: null }; this.curName = { lower: '', upper: '' };
    this.oneShot = null; this.lowerOnce = null;
    this.play('lower', 'Idle'); this.play('upper', '1H_Ranged_Aiming');
  }
  play(layer, name, fade = 0.15, once = false, speed = 1) {
    if (this.curName[layer] === name && !once) { if (this.cur[layer]) this.cur[layer].setEffectiveTimeScale(speed); return this.cur[layer]; }
    const clip = CLIPS[name] && CLIPS[name][layer];
    if (!clip) return null;
    const a = this.mixer.clipAction(clip);
    a.enabled = true; a.setEffectiveTimeScale(speed); a.setEffectiveWeight(1);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.reset().fadeIn(fade).play();
    const old = this.cur[layer]; if (old && old !== a) old.fadeOut(fade);
    this.cur[layer] = a; this.curName[layer] = name;
    return a;
  }
  // ações rápidas nos braços (vindas dos eventos da simulação)
  trigger(name, speed, now) {
    if (!CLIPS[name]) return;
    this.play('upper', name, 0.06, true, speed);
    this.oneShot = { until: now + (CLIPS[name].full.duration / speed) * 1000 - 60, name };
  }
  legsOnce(name, speed, now) {
    if (!CLIPS[name]) return;
    this.play('lower', name, 0.06, true, speed);
    this.lowerOnce = { until: now + (CLIPS[name].full.duration / speed) * 1000 - 40 };
  }
  update(p, sim, dt, now) {
    const wkey = p.weapon === 'primary' ? p.primary : p.weapon, drinking = (p.drinkUntil || 0) > sim.time;
    for (const k in this.items) this.items[k].visible = false;
    const item = this.items[HAND_ITEM[wkey]]; if (item && !drinking) item.visible = true;
    if (this.bottle) this.bottle.visible = drinking;
    // pernas
    const sp = Math.hypot(p.vx, p.vz);
    if (this.lowerOnce && now >= this.lowerOnce.until) this.lowerOnce = null;
    if (!this.lowerOnce) {
      if (p.ladder || p.climb) this.play('lower', 'Walking_A', 0.12, false, 1.3); // subindo a escada de mão
      else if (!p.grounded) this.play('lower', p.vy > 120 ? 'Jump_Start' : 'Jump_Idle', 0.12, false, 1);
      else if (p.slip) this.play('lower', 'Jump_Idle', 0.18, false, 0.7); // navio inclinado: escorregando (braços abertos, sem dar passo)
      else if (sp > 25) {
        const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
        const fwd = (p.vx * fx + p.vz * fz) / sp, side = (p.vx * -fz + p.vz * fx) / sp, k = sp / P.speed;
        if (fwd > 0.5) this.play('lower', 'Running_A', 0.15, false, 1.1 * k);
        else if (fwd < -0.5) this.play('lower', 'Walking_Backwards', 0.15, false, 1.5 * k);
        else this.play('lower', side > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left', 0.15, false, 1.1 * k);
      } else this.play('lower', 'Idle', 0.2);
    }
    // braços
    if (this.oneShot && now >= this.oneShot.until) this.oneShot = null;
    if (!this.oneShot) {
      const w = WEAPONS[p.primary];
      if (p.weapon === 'primary' && p.reloadUntil) this.play('upper', RELOAD_ANIM[p.primary], 0.12, false, CLIPS[RELOAD_ANIM[p.primary]].full.duration / w.reload);
      else if (p.weapon === 'primary' && AIM_ANIM[p.primary] && !p.sprinting) this.play('upper', AIM_ANIM[p.primary], 0.15);
      else this.play('upper', this.curName.lower || 'Idle', 0.15, false, this.cur.lower ? this.cur.lower.getEffectiveTimeScale() : 1);
    }
    this.mixer.update(dt);
  }
  // congelado pela chuva da neve: fica azulado
  setFrozen(v) {
    if (this.frozen === v) return; this.frozen = v;
    this.model.traverse((o) => { if (o.isMesh && o.material.emissive) { o.material.emissive.set(v ? 0x3aa0ff : this.lift ? this.lift[0] : 0x000000); o.material.emissiveIntensity = v ? 0.55 : this.lift ? this.lift[1] : 1; } });
  }
  // brilho leve na cor do time (nave: os bonecos se destacam do fundo escuro/metálico)
  setLift(col, k) {
    this.lift = col != null ? [col, k] : null;
    this.model.traverse((o) => { if (o.isMesh && o.material.emissive && !o.userData.native && !o.userData.tint) { o.material.emissive.set(col != null ? col : 0x000000); o.material.emissiveIntensity = col != null ? k : 1; } });
  }
  // killcam: o boneco abatido fica cinza
  setGrey(v) {
    if (!!this.grey === v) return; this.grey = v;
    this.model.traverse((o) => {
      if (!o.isMesh || o.userData.native) return;
      if (v) { o.userData.mat0 = o.material; o.material = GREY_MAT; }
      else if (o.userData.mat0) { o.material = o.userData.mat0; o.userData.mat0 = null; }
    });
  }
  remove() { scene.remove(this.root); }
}
const GREY_MAT = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 });
const avatars = new Map();

// ---------- lápide (fica no lugar da morte; o corpo some) ----------
const tombMeshes = new Map();
function makeTomb(t) {
  const g = new THREE.Group();
  const stone = mat(0x8b939e), dark = mat(0x5b6370);
  const base = new THREE.Mesh(new THREE.BoxGeometry(34, 6, 18), dark); base.position.y = 3;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 8), stone); slab.position.y = 20;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 8, 10, 1, false, 0, Math.PI), stone);
  top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.y = 35;
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(3, 14, 1.5), dark); cross1.position.set(0, 24, 4.4);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 1.5), dark); cross2.position.set(0, 27, 4.4);
  // cruz de madeira em cima da lápide
  const wood = mat(0x6b4a2f);
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.6, 20, 2.6), wood); post.position.y = 49;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13, 2.6, 2.6), wood); beam.position.y = 53;
  for (const m of [base, slab, top, post, beam]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(base, slab, top, cross1, cross2, post, beam);
  g.position.set(t.x, t.y, t.z);
  g.rotation.y = Math.random() * 0.6 - 0.3;
  return g;
}

// ---------- fumaça realista: muitas "nuvenzinhas" macias ----------
const SMOKE_TEX = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), rnd = seeded(77);
  for (let i = 0; i < 14; i++) { // bolinhas sobrepostas = borda irregular
    const x = 64 + (rnd() - 0.5) * 40, y = 64 + (rnd() - 0.5) * 40, r = 22 + rnd() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(0.5, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
function makeSmoke(s) {
  const g = new THREE.Group(), rnd = seeded(s.id * 13 + 1), R = P.smokeRadius;
  g.userData.parts = [];
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.85;
    const h = Math.pow(rnd(), 1.6) * R * 0.85 + 15;
    const m = new THREE.SpriteMaterial({ map: SMOKE_TEX, color: new THREE.Color().setHSL(0.6, 0.05, 0.72 + rnd() * 0.16), transparent: true, depthWrite: false, opacity: 0, rotation: rnd() * Math.PI * 2 });
    const sp = new THREE.Sprite(m);
    const size = 70 + rnd() * 90;
    sp.userData = { a, d, h, size, spin: (rnd() - 0.5) * 0.3, drift: 0.4 + rnd() * 0.6, dens: 1 - d / R };
    g.add(sp); g.userData.parts.push(sp);
  }
  for (let i = 0; i < 12; i++) { // miolo: nuvens grandes e fechadas (quem está no meio some)
    const m = new THREE.SpriteMaterial({ map: SMOKE_TEX, color: new THREE.Color().setHSL(0.6, 0.04, 0.8), transparent: true, depthWrite: false, opacity: 0, rotation: rnd() * Math.PI * 2 });
    const sp = new THREE.Sprite(m);
    sp.userData = { a: rnd() * Math.PI * 2, d: rnd() * R * 0.3, h: 35 + rnd() * 70, size: 230 + rnd() * 90, spin: (rnd() - 0.5) * 0.2, drift: 0.2, dens: 1.2 };
    g.add(sp); g.userData.parts.push(sp);
  }
  g.position.set(s.x, groundY(s.x, s.z), s.z);
  return g;
}
function updateSmoke(g, s, sim, dt) {
  const k = sim.smokeK(s), grow = Math.min(1, (sim.time - s.t0) / 0.6);
  for (const sp of g.userData.parts) {
    const u = sp.userData;
    const d = u.d * (0.35 + 0.65 * grow) + (sim.time - s.t0) * u.drift * 3;
    sp.position.set(Math.cos(u.a) * d, u.h * (0.4 + 0.6 * grow), Math.sin(u.a) * d);
    const sz = u.size * (0.6 + 0.4 * grow); sp.scale.set(sz, sz, 1);
    sp.material.rotation += u.spin * dt;
    sp.material.opacity = k * Math.min(1, 0.45 + 0.75 * u.dens); // miolo fechado, borda clareando
  }
}

// ---------- tiros, granadas, efeitos ----------
const bulletMeshes = new Map(), nadeMeshes = new Map(), smokeMeshes = new Map(), pickupMeshes = new Map(), effects = [];
function makePickup(u) {
  const color = u.type === 'nade' ? 0xfacc15 : 0x4ade80;
  const geo = new THREE.CircleGeometry(u.r, 24, 0, Math.PI * 2); geo.rotateX(-Math.PI / 2);
  // no deserto a área acompanha o morro de areia
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(u.x + pos.getX(i), u.z + pos.getZ(i)) + 0.8);
  const disc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  disc.position.set(u.x, 0, u.z);
  return disc;
}
const TEAM_EMIS = { A: 0x3b82f6, B: 0xef4444 }, TEAM_BALL = { A: 0x93c5fd, B: 0xfca5a5 };
// todo tiro tem a cor do seu time (qualquer arma) e um rastrinho atrás; o formato depende da arma:
// arco = flecha, estilingue = pedrinha meio quadrada, mão = bola de neve
const BULLET_GEO = {};
function bulletGeo(kind, r) {
  const key = kind + r; if (BULLET_GEO[key]) return BULLET_GEO[key];
  let g;
  if (kind === 'estilingue') {
    g = new THREE.BoxGeometry(r * 1.9, r * 1.6, r * 1.8, 2, 2, 2); const pos = g.attributes.position, rnd = seeded(5);
    for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pos, i), l = v.length(), k = 0.78 + 0.22 * (r * 1.1 / l) + (rnd() - 0.5) * 0.12; pos.setXYZ(i, v.x * k, v.y * k, v.z * k); } // cantos arredondados, meio torto
    g.computeVertexNormals();
  } else g = new THREE.SphereGeometry(r * 1.2, 14, 10);
  return (BULLET_GEO[key] = g);
}
const BOLT_GEO = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); // pedaço do raio da varinha (esticado em y)
function makeBullet(b) {
  const team = b.team, col = TEAM_EMIS[team] || 0xffffff;
  if (b.kind === 'arco') { // flecha: haste, ponta e penas, tudo na cor do time
    const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.5 });
    const tipM = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.3 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 30, 6), body); shaft.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 8), tipM); tip.rotation.x = Math.PI / 2; tip.position.z = 17;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), tipM); ball.position.z = 14; // ponta de borracha
    g.add(shaft, tip, ball);
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 6), body); f.position.z = -12; f.rotation.z = k * Math.PI * 2 / 3; f.position.x = Math.sin(k * Math.PI * 2 / 3) * 1.6; f.position.y = Math.cos(k * Math.PI * 2 / 3) * 1.6; g.add(f); }
    g.scale.setScalar(FX.bullet.size); g.userData.orient = true; return g;
  }
  if (b.kind === 'varinha') { // raio mágico: raiozinho fino em zigue-zague que treme; forte na frente e sumindo atrás, ponta brilhando
    const g = new THREE.Group(), tail = new THREE.Group(); g.add(tail);
    const Fw = FX.wand, N = Math.max(2, Math.round(Fw.segs)), LEN = Fw.len, segs = [];
    for (let i = 0; i < N; i++) {
      const f = Math.pow(1 - i / N, Fw.fade); // degradê: forte na frente, bem transparente atrás
      const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: Fw.coreOp * f, blending: THREE.AdditiveBlending, depthWrite: false });
      const gm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: Fw.glowOp * f, blending: THREE.AdditiveBlending, depthWrite: false });
      const c = new THREE.Mesh(BOLT_GEO, cm), gl = new THREE.Mesh(BOLT_GEO, gm); c.scale.x = c.scale.z = Fw.core; gl.scale.x = gl.scale.z = Fw.glow; tail.add(c, gl); segs.push([c, gl, gm, f]);
    }
    const forkM = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const forks = []; for (let i = 0; i < Math.round(Fw.forks); i++) { const fk = new THREE.Mesh(BOLT_GEO, forkM); fk.scale.x = fk.scale.z = 0.4; tail.add(fk); forks.push(fk); }
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); head.scale.setScalar(Fw.head); g.add(head);
    const core2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); core2.scale.setScalar(Fw.headCore); g.add(core2);
    const pts = [], va = new THREE.Vector3(), vb = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const place = (m, a, b) => { va.subVectors(b, a); const L = va.length() || 1; m.position.addVectors(a, b).multiplyScalar(0.5); m.scale.y = L; m.quaternion.setFromUnitVectors(up, va.divideScalar(L)); };
    let lastJ = 0, dist = 0, lp = null;
    g.userData.bolt = (now, x, y, z) => {
      if (lp) dist += Math.hypot(x - lp[0], y - lp[1], z - lp[2]); lp = [x, y, z];
      tail.scale.z = Math.max(0.05, Math.min(1, dist / LEN)); // nasce curtinho na mão e estica
      if (now - lastJ < 45) return; lastJ = now;
      pts.length = 0;
      for (let i = 0; i <= N; i++) { const k = i / N, amp = Fw.jitter * Math.sin(Math.PI * Math.min(1, k * 1.3)) + 0.6; pts.push(new THREE.Vector3((Math.random() - 0.5) * amp * 2, (Math.random() - 0.5) * amp * 2, -k * LEN)); }
      pts[0].set(0, 0, 0);
      for (let i = 0; i < N; i++) { place(segs[i][0], pts[i], pts[i + 1]); place(segs[i][1], pts[i], pts[i + 1]); segs[i][2].opacity = (0.4 + Math.random() * 0.25) * segs[i][3] * Fw.glowOp / 0.55; }
      forks.forEach((f, j) => { const a = pts[Math.min(N - 1, 1 + j * 2)]; vb.set(a.x + (Math.random() - 0.5) * 22, a.y + (Math.random() - 0.5) * 22, a.z - 14 - Math.random() * 14); place(f, a, vb); });
    };
    g.userData.bolt(0, 0, 0, 0);
    g.userData.orient = true; return g;
  }
  const snow = b.kind === 'mao';
  const m = new THREE.MeshStandardMaterial({ color: snow ? new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35) : col, emissive: col, emissiveIntensity: snow ? 0.9 : 1.2, roughness: snow ? 0.95 : 0.55, flatShading: !snow });
  m.emissiveIntensity *= FX.bullet.glow;
  const s = new THREE.Mesh(bulletGeo(b.kind, b.r), m); s.scale.setScalar(FX.bullet.size);
  if (!snow) s.userData.tumble = true;
  return s;
}
function makeNade(g) {
  // (v0.28) as granadas são poções: frasco de fumaça e frasco comprido de pólvora com faíscas
  const grp = potionMesh(g.smoke ? 'smoke' : 'nade'); grp.scale.setScalar(g.smoke ? 2.1 : 1.7);
  return grp;
}
// textura suave (gradiente radial) pro fogo da explosão — sem serrilhado de geometria de baixo poli
const FIRE_TEX = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,235,1)'); grd.addColorStop(0.22, 'rgba(255,210,90,.98)');
  grd.addColorStop(0.5, 'rgba(255,130,35,.85)'); grd.addColorStop(0.78, 'rgba(255,70,20,.35)'); grd.addColorStop(1, 'rgba(255,60,20,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
const RING_TEX = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(255,220,150,.9)'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

function addEffect(e, now) {
  if (e.type !== 'explode') return;
  // explosão da granada: bola de fogo forte, onda de choque no chão do tamanho da área de dano, fumaça e faíscas
  const R = (e.r || (sim && sim.P.nadeRadius) || P.nadeRadius) * FX.explosion.size, objs = [];
  const fire = []; for (let i = 0; i < Math.round(FX.explosion.fire); i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.userData.o = [(Math.random() - 0.5) * R * 0.5, Math.random() * R * 0.35, (Math.random() - 0.5) * R * 0.5, 0.6 + Math.random() * 0.6]; m.position.set(e.x, e.y + 8, e.z); scene.add(m); fire.push(m); objs.push(m); }
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  wave.rotation.x = -Math.PI / 2; wave.position.set(e.x, groundY(e.x, e.z) + 1.5, e.z); scene.add(wave); objs.push(wave);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(R * 0.7, 32), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(e.x, groundY(e.x, e.z) + 1.1, e.z); scene.add(scorch); objs.push(scorch);
  // luz: uma só, sempre na cena (criar luz nova a cada explosão faz o jogo travar recompilando tudo)
  const light = EXPL_LIGHT; light.position.set(e.x, e.y + 40, e.z); light.distance = R * 6;
  // fogo correndo pelo chão até a borda da área de dano (mostra até onde a explosão pega)
  const ringFire = []; for (let i = 0; i < Math.round(FX.explosion.ringFire); i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.userData.a = i / 16 * Math.PI * 2 + Math.random() * 0.2; m.userData.s = 0.7 + Math.random() * 0.5; scene.add(m); ringFire.push(m); objs.push(m); }
  const smoke = []; for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0x3a3632, transparent: true, opacity: 0, depthWrite: false })); const a = Math.random() * Math.PI * 2, d = Math.random() * R * 0.6; s.userData.v = [Math.cos(a) * d, 30 + Math.random() * 60, Math.sin(a) * d]; s.position.set(e.x, e.y + 10, e.z); scene.add(s); smoke.push(s); objs.push(s); }
  const N = Math.max(1, Math.round(FX.explosion.sparks)), pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 320; vel.push([Math.cos(a) * sp, 160 + Math.random() * 300, Math.sin(a) * sp]); pos[i * 3] = e.x; pos[i * 3 + 1] = e.y + 8; pos[i * 3 + 2] = e.z; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffcf7a, size: 6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(sparks); objs.push(sparks);
  effects.push({ t0: now, d: 1400, objs, upd: (t, dt) => {
    const f = Math.min(1, t / 0.35);
    fire.forEach((m) => { const o = m.userData.o; m.position.set(e.x + o[0] * f, e.y + 8 + o[1] * f + t * 30, e.z + o[2] * f); m.scale.setScalar(R * o[3] * (0.4 + f * 0.9)); m.material.opacity = Math.max(0, 1 - t / 0.55); });
    wave.scale.setScalar(R * (0.2 + 0.8 * Math.min(1, t / 0.25))); wave.material.opacity = 0.9 * Math.max(0, 1 - t / 0.5);
    scorch.material.opacity = 0.55 * Math.min(1, t * 6) * (1 - Math.max(0, (t - 0.6) / 0.4));
    light.intensity = 90000 * Math.max(0, 1 - t / 0.35);
    const rr = R * Math.min(1, t / 0.22), gy = groundY(e.x, e.z);
    ringFire.forEach((m) => { const a = m.userData.a; m.position.set(e.x + Math.cos(a) * rr * 0.92, gy + 14 + t * 20, e.z + Math.sin(a) * rr * 0.92); m.scale.set(38 * m.userData.s, 48 * m.userData.s * (1 - t * 0.5), 1); m.material.opacity = Math.max(0, 1 - Math.max(0, t - 0.25) / 0.45); });
    smoke.forEach((s) => { const v = s.userData.v; s.position.x += v[0] * dt; s.position.y += v[1] * dt; s.position.z += v[2] * dt; s.scale.setScalar(R * (0.6 + t)); s.material.opacity = FX.explosion.smoke * Math.sin(Math.min(1, t) * Math.PI) * Math.min(1, t * 4); });
    for (let k = 0; k < N; k++) { const v = vel[k]; v[1] -= 700 * dt; pos[k * 3] += v[0] * dt; pos[k * 3 + 1] += v[1] * dt; pos[k * 3 + 2] += v[2] * dt; }
    sg.attributes.position.needsUpdate = true; sparks.material.opacity = Math.max(0, 1 - t * 1.3);
  } });
}

// ---------- arma na tela (1ª pessoa) ----------
const VIEW = {};
// faca na 1ª pessoa: lâmina apontando pra cima/esquerda (um pouco pra frente), de lado pra câmera; a mão no cabo
const KNIFE_DIR = new THREE.Vector3(-0.72, 0.58, -0.38).normalize(), KNIFE_HAND = [1.6, -1.6, 1.2];
const KNIFE_POS = new THREE.Vector3(...KNIFE_HAND).addScaledVector(KNIFE_DIR, 6.5);
const KNIFE_Q = (() => { const z = KNIFE_DIR.clone(), x = new THREE.Vector3().crossVectors(z, new THREE.Vector3(0, 0, 1)).normalize(), y = new THREE.Vector3().crossVectors(z, x); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); })();
// mãos e braços da 1ª pessoa (arredondados, no estilo dos bonecos): pele da sua roupa e manga na cor do time
const FPM = { skin: new THREE.MeshStandardMaterial({ color: SKIN[S.look.sk || 0], roughness: 0.62 }), sleeve: new THREE.MeshStandardMaterial({ color: 0x2c4a86, roughness: 0.9 }), cuff: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.85 }), glove: new THREE.MeshStandardMaterial({ color: 0x1c1e23, roughness: 0.5, metalness: 0.05 }), sk: S.look.sk };
const _fpSph = new THREE.SphereGeometry(1, 16, 12), _fpUp = new THREE.Vector3(0, 1, 0);
function fpLimb(a, b, r, m) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.1, L), 4, 12), m);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(_fpUp, d.normalize()); return o;
}
// (v0.29) os braços da 1ª pessoa são os braços do SEU boneco (o mesmo modelo, roupa, manga do time e mão da 3ª pessoa),
// "congelados" na pose de descanso e virados pra segurar cada arma: c = onde fica o cabo (centro da mão), grip = direção
// do cabo, elbow = pra onde vai o antebraço (fora da tela); opt.s = tamanho, opt.left = braço esquerdo
const FPA = { key: '', R: null, L: null, list: [] }, FP_HAND = 0.95;
function fpBake(model, re, slotName, sc) {
  let src = null; model.traverse((o) => { if (o.isSkinnedMesh && re.test(o.name)) src = o; });
  const slot = model.getObjectByName(slotName); if (!src || !slot) return null;
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); slot.matrixWorld.decompose(p, q, s);
  const inv = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)).invert();
  const geo = src.geometry.clone(); geo.applyMatrix4(src.matrixWorld); geo.applyMatrix4(inv); geo.scale(sc, sc, sc);
  if (geo.attributes.skinIndex) geo.deleteAttribute('skinIndex'); if (geo.attributes.skinWeight) geo.deleteAttribute('skinWeight');
  geo.computeBoundingSphere();
  const pos = geo.attributes.position, far = new THREE.Vector3(), v = new THREE.Vector3(); let best = 0; // ponta mais longe da mão = ombro
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const d = v.lengthSq(); if (d > best) { best = d; far.copy(v); } }
  return { geo, mat: src.material, axis: far.normalize() };
}
// refaz os braços quando muda a roupa, o personagem ou o time (ou quando o modelo termina de carregar)
function fpRefreshArms(lookOv) { // (lookOv: espectador em 1ª pessoa — os braços do boneco de quem você assiste)
  const look = normLook(lookOv || S.look), team = viewTeam || 'A', mk = BASE[look.m] ? look.m : BASE.hood ? 'hood' : null;
  if (!mk) return;
  const kL = Math.max(0.5, Math.min(1.8, (Number(S.armLen) || 100) / 100)), kW = Math.max(0.5, Math.min(1.8, (Number(S.armW) || 100) / 100));
  const key = JSON.stringify(look) + team + mk + '|' + kL + '|' + kW + '|' + S.armSize;
  if (FPA.key === key) return; FPA.key = key;
  const model = SkeletonUtils.clone(BASE[mk].scene); dressModel(model, mk, look, team, BASE); model.updateMatrixWorld(true); // (com as luvas do boneco, igual à 3ª pessoa)
  const box = new THREE.Box3().setFromObject(model), sc = CHAR_H / ((box.max.y - box.min.y) || 1);
  FPA.R = fpBake(model, /_ArmRight$/, 'handslotr', sc); FPA.L = fpBake(model, /_ArmLeft$/, 'handslotl', sc);
  // comprimento e grossura (configurações): estica ao longo do braço (a mão fica no lugar) e engrossa pros lados
  // (v0.30) o braço continua bem comprido depois do cotovelo (pra trás, fora da tela): o fim dele nunca aparece, nem correndo
  for (const A of [FPA.R, FPA.L]) if (A) { const a = A.axis, e = A.geo.attributes.position, v = new THREE.Vector3(); let dm = 0; for (let i = 0; i < e.count; i++) dm = Math.max(dm, v.fromBufferAttribute(e, i).dot(a)); const cut = dm * 0.5; for (let i = 0; i < e.count; i++) { v.fromBufferAttribute(e, i); const d = v.dot(a); if (d > cut) { v.addScaledVector(a, (d - cut) * 5); e.setXYZ(i, v.x, v.y, v.z); } } e.needsUpdate = true; A.geo.computeBoundingSphere(); }
  for (const A of [FPA.R, FPA.L]) if (A && (kL !== 1 || kW !== 1)) { const a = A.axis, e = A.geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < e.count; i++) { v.fromBufferAttribute(e, i); const d = v.dot(a); v.multiplyScalar(kW).addScaledVector(a, d * (kL - kW)); e.setXYZ(i, v.x, v.y, v.z); } e.needsUpdate = true; A.geo.computeVertexNormals(); A.geo.computeBoundingSphere(); }
  for (const e of FPA.list) fpBuildArm(e);
}
function fpBuildArm(e) {
  const A = e.opt.left ? FPA.L : FPA.R; for (const c of e.g.children.slice()) e.g.remove(c);
  if (!A) return;
  const m = new THREE.Mesh(A.geo, A.mat); m.frustumCulled = false;
  // gira: o eixo do braço (mão → ombro) aponta pro cotovelo e o eixo Y da mão (por onde passa o cabo) vira o "grip"
  const a = A.axis.clone(), g0 = new THREE.Vector3(0, 1, 0).addScaledVector(a, -a.y).normalize();
  const Lm = new THREE.Matrix4().makeBasis(a, g0, new THREE.Vector3().crossVectors(a, g0));
  let Y = e.grip.clone().normalize(), ta = e.toE.clone().addScaledVector(Y, -e.toE.dot(Y)).normalize();
  if (e.opt.free) { ta = e.toE.clone().normalize(); Y = e.grip.clone().normalize().addScaledVector(ta, -e.grip.clone().normalize().dot(ta)).normalize(); } // braço reto pro cotovelo (punho dobrado)
  const Tm = new THREE.Matrix4().makeBasis(ta, Y, new THREE.Vector3().crossVectors(ta, Y));
  m.quaternion.setFromRotationMatrix(Tm.multiply(Lm.transpose()));
  if (e.opt.roll) m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(Y, e.opt.roll));
  if (e.opt.bend) m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().crossVectors(ta, Y).normalize(), -e.opt.bend)); // punho dobrado: o braço vem mais de baixo (varinha/estilingue)
  m.scale.setScalar((e.opt.s || 1) * FP_HAND * Math.max(0.5, Math.min(1.8, (Number(S.armSize) || 100) / 100)));
  e.g.add(m);
}
function fpArm(c, grip, elbow, opt = {}) {
  const g = new THREE.Group(); g.position.set(...c); g.userData.fpArm = true;
  const e = { g, grip: new THREE.Vector3(...grip), toE: new THREE.Vector3(...elbow).sub(new THREE.Vector3(...c)), opt };
  FPA.list.push(e); if (FPA.R) fpBuildArm(e);
  return g;
}
// frascos (todos redondos, do mesmo tamanho): cura = líquido verde; fumaça = fumaça cinza rodando dentro e anel dourado
// no bico; explosiva = pólvora escura com faísquinhas e pavio aceso na rolha
const POT_GLASS = new THREE.MeshStandardMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false });
const POT_CORK = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.9 }), POT_BRASS = new THREE.MeshStandardMaterial({ color: 0xd4af4a, roughness: 0.3, metalness: 0.8 });
const SPARK_TEX = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.35, 'rgba(255,190,60,.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
const POWDER_TEX = canvasTex(64, 64, (g) => { g.fillStyle = '#231f1c'; g.fillRect(0, 0, 64, 64); const r = seeded(9); for (let i = 0; i < 380; i++) { const c = 30 + r() * 50; g.fillStyle = `rgb(${c},${c * 0.9},${c * 0.8})`; g.fillRect(r() * 64, r() * 64, 1.5, 1.5); } }, true);
function potionMesh(kind) {
  const g = new THREE.Group(), fx = []; g.userData.potFx = fx;
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const R = 3.6;
  if (kind === 'heal') { const lq = add(new THREE.SphereGeometry(R * 0.89, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.9, roughness: 0.2 }), 0, 0, 0); lq.userData.liquid = true; }
  else if (kind === 'smoke') {
    const sm = new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0xb9c0c8, transparent: true, opacity: 0.85, depthWrite: false });
    for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(sm.clone()); const a = i * 1.05; sp.userData.puff = [Math.cos(a) * 0.9, -0.6 + (i % 3) * 0.8, Math.sin(a) * 0.9, 3.4 + (i % 2) * 1.2, i * 1.3]; sp.renderOrder = 1; g.add(sp); fx.push(sp); }
    add(new THREE.TorusGeometry(1.15, 0.28, 8, 18), POT_BRASS, 0, R * 0.86, 0).rotation.x = Math.PI / 2; // anel dourado em volta do bico
  } else {
    const pw = new THREE.MeshStandardMaterial({ map: POWDER_TEX, roughness: 1 });
    add(new THREE.SphereGeometry(R * 0.88, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), pw, 0, 0, 0); // pólvora (metade de baixo)
    add(new THREE.CircleGeometry(R * 0.87, 18), pw, 0, R * 0.14, 0).rotation.x = -Math.PI / 2; // (tampa da pólvora)
    const sm = new THREE.SpriteMaterial({ map: SPARK_TEX, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 7; i++) { const a = i * 2.3, rr = 0.6 + (i % 3) * 0.7, sp = new THREE.Sprite(sm); sp.position.set(Math.cos(a) * rr, R * 0.14 + 0.25 + (i % 2) * 0.5, Math.sin(a) * rr); sp.userData.spark = i; sp.renderOrder = 1; g.add(sp); fx.push(sp); }
    add(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xa3202a, roughness: 0.6 }), 0, R * 1.18 + 1.9, 0); // lacre vermelho
    add(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 5), new THREE.MeshStandardMaterial({ color: 0x3a2e24 }), 0.25, R * 1.18 + 2.8, 0).rotation.z = -0.35; // pavio
    const tip = new THREE.Sprite(sm); tip.position.set(0.55, R * 1.18 + 3.5, 0); tip.userData.spark = 9; g.add(tip); fx.push(tip);
  }
  const glass = add(new THREE.SphereGeometry(R, 20, 16), POT_GLASS, 0, 0, 0); glass.renderOrder = 2;
  add(new THREE.CylinderGeometry(0.95, 1.2, 2.4, 14), POT_GLASS, 0, R + 0.7, 0).renderOrder = 2;
  const cork = add(new THREE.CylinderGeometry(1.05, 0.9, 1.6, 12), POT_CORK, 0, R + 2.3, 0); cork.userData.cork = true;
  return g;
}
// faísca piscando / fumaça rodando devagar dentro do frasco
function animPotion(g, now) {
  for (const o of g.userData.potFx || []) {
    if (o.userData.spark != null) { const k = Math.sin(now / 55 + o.userData.spark * 7.3); o.visible = k > -0.3; o.scale.setScalar(o.userData.spark === 9 ? 1.2 + 0.6 * Math.max(0, k) : 0.5 + 0.8 * Math.max(0, k)); }
    else if (o.userData.puff) { const [x, y, z, r, ph] = o.userData.puff, t = now / 1100 + ph; o.position.set(x * Math.cos(t) - z * Math.sin(t), y + Math.sin(t * 1.3) * 0.35, x * Math.sin(t) + z * Math.cos(t)); o.scale.setScalar(r * (0.9 + 0.12 * Math.sin(t * 1.7))); o.material.rotation = t * 0.6; }
  }
}

{
  const add = (name, parts) => { const g = new THREE.Group(); parts.forEach((p) => g.add(p)); g.visible = false; fpCam.add(g); VIEW[name] = g; return g; };
  const m = (geo, color, x, y, z, extra) => { const o = new THREE.Mesh(geo, mat(color, extra)); o.position.set(x, y, z); return o; };
  const sm = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, extra || {})); // liso (sem facetas)
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, emissiveIntensity: 0.6, roughness: 0.3 })); tank.position.set(0, 3.8, 1);
  const barrel = m(new THREE.CylinderGeometry(1.3, 1.3, 10, 8), 0x111827, 0, 0.8, -15, { metalness: 0.7, roughness: 0.3 }); barrel.rotation.x = Math.PI / 2;
  const grip = m(new THREE.BoxGeometry(3.2, 7, 4), 0x1f2937, 0, -4.5, 5); grip.rotation.x = 0.3;
  add('lancador', [m(new THREE.BoxGeometry(4, 4, 22), 0x374151, 0, 0, 0, { metalness: 0.5, roughness: 0.4 }), barrel, grip, tank]);
  // estilingue (arredondado): cabo e forquilha de madeira, 2 elásticos até a bolsinha com a pedra;
  // a mão segura o cabo (o elástico estica quando a pedra nova chega na bolsinha)
  {
    const wood = sm(0x8b5a2b, { roughness: 0.75 }), rubber = sm(0xe0453a, { roughness: 0.55 }), sg = new THREE.Group(); sg.scale.setScalar(0.56);
    sg.add(fpLimb(V3(0, -9, 0), V3(0, 0.5, 0), 1.3, wood));
    for (const sx of [-1, 1]) { sg.add(fpLimb(V3(0, 0.5, 0), V3(sx * 3.6, 9, -1.5), 1.0, wood)); const tp = new THREE.Mesh(_fpSph, rubber); tp.scale.setScalar(1.15); tp.position.set(sx * 3.6, 9, -1.5); sg.add(tp); }
    const bands = [-1, 1].map((sx) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1, 6), rubber); b.userData.from = V3(sx * 3.6, 9, -1.5); sg.add(b); return b; });
    const pouch = new THREE.Mesh(_fpSph, sm(0x6b4a2f, { roughness: 0.9 })); pouch.scale.set(1.9, 0.95, 0.9); sg.add(pouch);
    const sBall = new THREE.Mesh(bulletGeo('estilingue', 2.2), mat(0x93c5fd)); sBall.position.set(0, 8.6, 1.5); sBall.userData.pull = true; sBall.userData.tint = 1; sBall.scale.setScalar(0.5); sg.add(sBall);
    const rh = fpArm([0.1, -2.6, 0.3], [0, 1, 0], [9, -6, 5], { s: 0.85, bend: 0.6 });
    const g = add('estilingue', [sg, rh]); g.userData.sling = { sg, bands, pouch, ball: sBall };
  }
  // bolinha de neve em cima da mão (palma pra cima)
  {
    const snowB = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.95 })); snowB.position.set(0, 2.5, -3); snowB.userData.tint = 2; snowB.userData.snow = true;
    const bg = new THREE.Group(); bg.scale.setScalar(0.6); bg.add(snowB);
    add('mao', [bg, fpArm([0, -3.1, -1.6], [-1, 0, -0.3], [5, -17, 4], { s: 0.9 })]);
  }
  // arco antigo (antes do modelo da besta carregar) + as 2 mãos da besta: a direita no cabo (gatilho) e a esquerda embaixo da frente
  const bowArc = new THREE.Mesh(new THREE.TorusGeometry(14, 0.9, 6, 20, Math.PI), mat(0x8b5a2b)); bowArc.rotation.z = Math.PI / 2;
  const str = m(new THREE.BoxGeometry(0.4, 28, 0.4), 0xf1f5f9, 0, 0, 0); str.userData.string = true;
  const arrow = m(new THREE.CylinderGeometry(0.6, 0.6, 30, 6), 0xe5d3a1, 0, 0, -8); arrow.rotation.x = Math.PI / 2; arrow.userData.arrow = true; arrow.userData.tint = 1;
  const bowL = fpArm([-0.3, -2.0, -4.2], [0, 0.12, 1], [-8, -14, 2], { s: 0.7, left: true });
  const bowG = add('arco', [bowArc, str, arrow, fpArm([0.4, -2.3, 3.4], [0, 1, 0.4], [5, -16, 9], { s: 0.7 }), bowL]); bowG.userData.leftArm = bowL; bowL.userData.rest = bowL.position.clone();
  bowG.rotation.z = 0.25; bowG.userData.bow = [bowArc, str];
  // varinha em pé, apontando pra cima e pra frente, segura como um pincel (a gente vê as costas da mão)
  { const wv = makeWandMesh('A', 0.9); wv.rotation.set(-0.45, 0, 0.25); wv.position.set(-1, 1, -3); wv.userData.wandView = true; wv.userData.tip.userData.wandTip = true;
    add('varinha', [wv, fpArm([0.11, -2.93, -1.1], [-0.247, 0.873, -0.421], [8, -8, 3], { s: 0.85, bend: 0.75 })]); }
  add('disco', [m(new THREE.CylinderGeometry(7, 7, 1.6, 20), 0x93c5fd, 0, 0, -2), fpArm([0, 0, 4.9], [1, 0, 0], [7, -13, 18], {})]);
  // faca de lado (tipo M9 / Xerofang): lâmina pra cima e pra esquerda, a gente vê o lado dela; "kp" gira no saque
  { const kp = new THREE.Group(); kp.position.set(KNIFE_HAND[0], KNIFE_HAND[1], KNIFE_HAND[2]); kp.userData.knifePivot = true;
    const kb = new THREE.Group(); kb.position.set(-KNIFE_HAND[0], -KNIFE_HAND[1], -KNIFE_HAND[2]); kp.add(kb); kp.userData.body = kb;
    const kf = new THREE.Group(); kf.position.copy(KNIFE_POS); kf.quaternion.copy(KNIFE_Q); kf.add(m(new THREE.BoxGeometry(1, 2.6, 16), 0xd1d5db, 0, 0, 3, { metalness: 0.8, roughness: 0.25 }), m(new THREE.BoxGeometry(2.2, 3, 6), 0x1f2937, 0, 0, -6.5)); kb.add(kf);
    add('knife', [kp, fpArm(KNIFE_HAND, KNIFE_DIR.toArray(), [KNIFE_HAND[0] + 11, KNIFE_HAND[1] - 12, KNIFE_HAND[2] + 7], { s: 0.9, free: true })]).userData.kp = kp; }
  // granada e fumaça: frascos em cima da mão (palma pra cima)
  { const pn = potionMesh('nade'); pn.position.set(0, 1, -2); pn.scale.setScalar(1.03); add('nade', [pn, fpArm([0, -4.9, -2], [-1, 0, -0.3], [5, -18, 3], { s: 0.9 })]).userData.pot = pn; }
  { const ps = potionMesh('smoke'); ps.position.set(0, 1, -2); ps.scale.setScalar(1.03); add('smoke', [ps, fpArm([0, -4.9, -2], [-1, 0, -0.3], [5, -18, 3], { s: 0.9 })]).userData.pot = ps; }
  // poção de cura: o mesmo frasco redondo, em cima da mão (animação de beber em updatePotionView)
  const bottle = potionMesh('heal'); bottle.scale.setScalar(1.28);
  add('potion', [bottle, fpArm([0, -7, 0], [-1, 0, -0.3], [5, -20, 4], { s: 1.1 })]);
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
let nadeThrowAnim = null, camSmY = null, kick = 0, swing = 0, sprintFov = 0, adsK = 0, healFx = 0, caveK = 0, pendingKc = null;
let fpRunK = 0, fpWalkK = 0, fpLastKey = null, knifeDrawT = -1e9, fpDrawT = -1e9; const _slRest = new THREE.Vector3(0, 9, -0.6), _slD = new THREE.Vector3();
// munição na mão da arma (1ª pessoa) na cor do seu time
let viewTeam = null;
const _sleeveDark = new THREE.Color(0x1b2233);
function tintViewModels(team) {
  if (team === viewTeam) return; viewTeam = team;
  const col = new THREE.Color(TEAM_EMIS[team] || 0xffffff);
  for (const k in VIEW) VIEW[k].traverse((o) => {
    if (!o.userData.tint || !o.material) return;
    if (o.userData.tint === 4) { o.material.color.copy(col).lerp(_sleeveDark, 0.45); o.material.emissive.set(0); return; } // manga do braço (1ª pessoa)
    o.material.color.copy(o.userData.tint === 2 ? col.clone().lerp(new THREE.Color(0xffffff), 0.35) : col);
    if (o.material.emissive) { o.material.emissive.copy(col); o.material.emissiveIntensity = o.userData.tint === 3 ? 2.2 : 0.35; }
  });
}

// rastro do tiro: linha fininha com as últimas posições
function updateTrail(m, team, x, y, z) {
  let tr = m.userData.trail;
  if (!tr) {
    const N = 9, arr = new Float32Array(N * 3); for (let i = 0; i < N; i++) { arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: TEAM_EMIS[team] || 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    line.frustumCulled = false; scene.add(line);
    tr = m.userData.trail = { line, arr, N };
  }
  const a = tr.arr;
  if (Math.abs(a[0] - x) + Math.abs(a[2] - z) > 150) for (let i = 0; i < tr.N; i++) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; } // passou pelo portal
  a.copyWithin(3, 0, (tr.N - 1) * 3); a[0] = x; a[1] = y; a[2] = z;
  tr.line.geometry.attributes.position.needsUpdate = true;
  tr.line.visible = m.visible;
}
function removeBulletMesh(m) { scene.remove(m); if (m.userData.trail) { scene.remove(m.userData.trail.line); m.userData.trail.line.geometry.dispose(); } }

// ---------- mira (cruz, ponto, círculo de recarga, marcador de acerto) ----------
function drawCross(ctx, W, H, x, prog, hit, reloading) {
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const line = (x1, y1, x2, y2, color, w) => {
    if (x.outline === '1') { ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  ctx.lineCap = 'butt';
  if (x.ring === '1' && prog < 1) { // círculo: só aparece carregando o próximo tiro ou recarregando
    ctx.lineWidth = x.ringw;
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(cx, cy, x.ringr, 0, Math.PI * 2); ctx.stroke();
    // recarregando o pente = amarelo; esperando o próximo tiro = branco meio transparente (não atrapalha a visão)
    ctx.strokeStyle = prog >= 1 ? hexA(x.color, 0.55) : reloading ? hexA('#ffcc33', 0.9) : 'rgba(255,255,255,.38)';
    ctx.beginPath(); ctx.arc(cx, cy, x.ringr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, prog)); ctx.stroke();
  }
  if (x.len > 0) {
    const g = +x.gap, L = +x.len, t = +x.thick;
    line(cx, cy - g, cx, cy - g - L, x.color, t); line(cx, cy + g, cx, cy + g + L, x.color, t);
    line(cx - g, cy, cx - g - L, cy, x.color, t); line(cx + g, cy, cx + g + L, cy, x.color, t);
  }
  if (x.dot === '1') {
    if (x.outline === '1') { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.beginPath(); ctx.arc(cx, cy, +x.dotsize + 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = x.color; ctx.beginPath(); ctx.arc(cx, cy, +x.dotsize, 0, Math.PI * 2); ctx.fill();
  }
  if (hit && x.hit === '1') { // X na diagonal: amarelo = acerto, vermelho = abate
    const col = hit.kind === 'kill' ? '#ef4444' : '#facc15', a = hit.a;
    ctx.globalAlpha = a;
    const s = +x.gap + 6, e = s + +x.hitlen, w = +x.hitw;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) line(cx + dx * s * 0.7, cy + dy * s * 0.7, cx + dx * e * 0.7, cy + dy * e * 0.7, col, w);
    ctx.globalAlpha = 1;
  }
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
const crossCtx = $('cross').getContext('2d');
let hitMark = null; // { kind, t }

// ---------- menu (Esc) ----------
let locked = false, menuOpen = true;
function showMenu(v) { menuOpen = v; $('menu').style.display = v ? 'grid' : 'none'; if (v) drawPreview(); }
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === t.dataset.pane));
  drawPreview();
  if (t.dataset.pane === 'p-look') renderLookFields();
  if (t.dataset.pane === 'p-mp' && $('mp-view-lobby').style.display === 'none') refreshRoomList();
}));

// ---------- multiplayer: menu (criar/entrar em sala, lobby, times, dono da sala) ----------
const ROUND_TIME_OPTS = [[0, 'Sem limite'], [60, '1 minuto'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos'], [600, '10 minutos']];
function roundTimeLabel(v) { const o = ROUND_TIME_OPTS.find((x) => x[0] === v); return o ? o[1] : (v ? v + 's' : 'Sem limite'); }
function mpStatus(msg, id) { const el = $(id || 'mp-status'); if (el) el.textContent = msg || ''; }
function switchMpView(v) {
  $('mp-view-menu').style.display = v === 'lobby' ? 'none' : 'grid';
  $('mp-view-lobby').style.display = v === 'lobby' ? 'grid' : 'none';
}
function ensureSocket() {
  if (socket) return socket;
  socket = io();
  // caiu a conexão e voltou: entra de novo na mesma sala sozinho (o servidor guarda seu lugar por 2 min)
  socket.on('connect', () => {
    if (!lastJoin || !room3d) return;
    socket.emit('3d_join_room', Object.assign({ clientId: window.PB.clientId(), look: S.look }, lastJoin), (r) => {
      if (!r || !r.ok) { mpStatus('A conexão caiu e não deu pra voltar pra sala.', 'mp-status'); leaveNetRoom(true); return; }
      myPid = r.you; room3d = r.state; renderLobby();
    });
  });
  socket.on('3d_room_state', (state) => { room3d = state; renderLobby(); });
  socket.on('3d_match_start', (d) => {
    const mine = room3d && room3d.members.find((m) => m.id === myPid);
    if (!mine || mine.status !== 'team') { mpStatus('A partida começou — escolha um time para entrar na próxima.', 'mp-status2'); return; }
    enterNetMatch(d);
    netMode = true;
    netRoundTime = d.roundTime || 0;
    socket.emit('3d_action', { t: 'primary', w: S.weapon }); // começa com a arma que você escolheu (se a sala deixar)
    if (sim.allowed && !sim.allowed.includes(S.weapon)) mpStatus('Sua arma não vale nesta sala — você começa com ' + WEAPONS[sim.pickPrimary(S.weapon)].name.split(' ')[0] + '.', 'mp-status2');
    $('h-clock').style.display = 'none'; // o tempo agora aparece no placar do modo (em cima, no meio)
    lockPointer();
  });
  socket.on('3d_match_end', (result) => {
    if (locked) { try { document.exitPointerLock(); } catch (e) {} }
    $('h-clock').style.display = 'none';
    showMenu(true);
    switchMpView('lobby');
    renderLobby();
    killcam.stop(); $('banner').style.display = 'none'; $('score').style.display = 'none';
    if (result) mpStatus('🏁 ' + resultText(result).replace(/<[^>]+>/g, ''), 'mp-status2');
  });
  socket.on('3d_state', (msg) => { if (netMode) applySnapshot(msg.s, msg.e); });
  socket.on('3d_toast', (msg) => mpStatus(msg, room3d ? 'mp-status2' : 'mp-status'));
  socket.on('3d_kicked', (msg) => { mpStatus(msg || 'Você foi desconectado da sala.', 'mp-status'); leaveNetRoom(true); });
  socket.on('3d_room_closed', () => { mpStatus('A sala foi fechada.', 'mp-status'); leaveNetRoom(true); });
  return socket;
}
// sai só da partida (continua na sala de espera); o jogo local volta a rodar por trás do menu
function leaveNetMatch() {
  if (socket) socket.emit('3d_leave_match');
  netMode = false; $('h-clock').style.display = 'none';
  newGame(); showMenu(true); switchMpView('lobby'); renderLobby();
}
window.__pb3dLeaveMatch = () => { if (socket && room3d && room3d.hostId === myPid) socket.emit('3d_end_match'); };
let lastJoin = null;
function leaveNetRoom(silent) {
  lastJoin = null;
  if (!silent && socket && room3d) socket.emit('3d_leave_room');
  room3d = null; netMode = false;
  if (locked) { try { document.exitPointerLock(); } catch (e) {} }
  newGame();
  switchMpView('menu');
}
function refreshRoomList() {
  ensureSocket().emit('3d_list_rooms', null, (list) => {
    const el = $('mp-list');
    if (!el) return;
    if (!list || !list.length) { el.textContent = 'Nenhuma sala aberta agora.'; return; }
    el.innerHTML = list.map((r) => `<div class="row2" style="justify-content:space-between;padding:4px 0;border-bottom:1px solid #243044">
      <span>${r.locked ? '🔒 ' : ''}<b>${esc(r.code)}</b> · ${esc(MAPS[r.map] ? MAPS[r.map].name : r.map)} · ${r.phase === 'match' ? 'em partida' : 'na sala'} · ${r.players} jogador(es)</span>
      <button class="btn" data-code="${esc(r.code)}">Entrar</button></div>`).join('');
    el.querySelectorAll('button[data-code]').forEach((b) => b.addEventListener('click', () => { $('mp-join-code').value = b.dataset.code; joinRoom(); }));
  });
}
function createRoom() {
  const code = $('mp-create-code').value.trim(); // vazio: o servidor dá um número (Sala 1, Sala 2...)
  const pass = $('mp-create-pass').value;
  ensureSocket().emit('3d_create_room', { name: code, clientId: window.PB.clientId(), map: S.map, password: pass, hidden: S.streamer === '1' }, (r) => {
    if (!r || !r.ok) { mpStatus((r && r.error) || 'Não foi possível criar a sala.'); return; }
    $('mp-join-code').value = r.code; $('mp-join-pass').value = pass;
    joinRoom();
  });
}
const MP_ERR = { not_found: 'Sala não encontrada.', wrong_password: 'Senha errada.', need_password: 'Essa sala tem senha.', full: 'Sala cheia.', bad_client: 'Erro de conexão, recarregue a página.' };
function joinRoom() {
  const name = $('mp-name').value.trim() || 'Jogador';
  const code = $('mp-join-code').value.trim();
  const pass = $('mp-join-pass').value;
  if (!code) { mpStatus('Digite o nome da sala.'); return; }
  ensureSocket().emit('3d_join_room', { name, clientId: window.PB.clientId(), code, password: pass, look: S.look }, (r) => {
    if (!r || !r.ok) { mpStatus(MP_ERR[r && r.error] || 'Não foi possível entrar.'); return; }
    myPid = r.you; room3d = r.state; lastJoin = { name, code, password: pass };
    mpStatus('');
    switchMpView('lobby'); renderLobby();
    if (r.match) mpStatus('Partida em andamento — escolha um time para entrar na próxima.', 'mp-status2');
  });
}
// modo streamer: o nome (e a senha) da sala não aparecem na tela; "mostrar" revela por 4 s
let mpRevealUntil = 0;
function applyStreamer(init) {
  const on = S.streamer === '1';
  for (const id of ['mp-create-code', 'mp-join-code']) $(id).type = on ? 'password' : 'text';
  $('mp-streamer').checked = on; if (!init) renderLobby();
}
$('mp-streamer').addEventListener('change', () => { S.streamer = $('mp-streamer').checked ? '1' : '0'; save(); applyStreamer(); });
$('mp-reveal').addEventListener('click', () => { mpRevealUntil = performance.now() + 4000; renderLobby(); setTimeout(renderLobby, 4100); });
const WEAPON_SHORT = { arco: 'Besta', estilingue: 'Estilingue', mao: 'Bola de neve', varinha: 'Varinha' };
function renderLobby() {
  if (!room3d || $('mp-view-lobby').style.display === 'none') return;
  const hide = S.streamer === '1' && performance.now() > mpRevealUntil;
  $('mp-lobby-code').textContent = hide ? '•••••' : room3d.code;
  $('mp-lobby-lock').textContent = (room3d.hasPassword ? '🔒' : '') + (room3d.hidden ? ' 🙈 fora da lista' : '');
  $('mp-reveal').style.display = S.streamer === '1' ? '' : 'none';
  const isHost = room3d.hostId === myPid;
  const memberRow = (m) => `<div class="wdesc" style="padding:2px 0">${m.id === myPid ? '<b>' + esc(m.name) + ' (você)</b>' : esc(m.name)}${m.connected ? '' : ' (desconectado)'}${m.inMatch ? ' 🎮' : ''}</div>`;
  const botRow = (b) => `<div class="wdesc">🤖 ${esc(b.name)}</div>`;
  const bots = room3d.bots || { A: [], B: [] };
  $('mp-team-A').innerHTML = room3d.members.filter((m) => m.status === 'team' && m.team === 'A').map(memberRow).join('') + (bots.A || []).map(botRow).join('');
  $('mp-team-B').innerHTML = room3d.members.filter((m) => m.status === 'team' && m.team === 'B').map(memberRow).join('') + (bots.B || []).map(botRow).join('');
  const md = room3d.mode || 'tdm';
  if (isHost) {
    const F = (label, id, opts, val) => `<label class="field" style="grid-template-columns:130px 1fr"><span>${label}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select><span></span></label>`;
    const nums = (arr) => arr.map((n) => [n, String(n)]);
    $('mp-host-settings').innerHTML =
      F('Mapa', 'mp-set-map', Object.keys(MAPS).map((k) => [k, esc(MAPS[k].name)]), room3d.map)
      + F('Modo', 'mp-set-mode', [['tdm', MODE_NAME.tdm], ['rounds', 'Rounds (eliminação)'], ['ffa', MODE_NAME.ffa], ['koth', MODE_NAME.koth]], md)
      + (md === 'tdm' || md === 'ffa' ? F('Abates pra vencer', 'mp-set-kills', nums([20, 25, 30, 50]), room3d.killLimit) : '')
      + (md === 'rounds' ? F('Rounds', 'mp-set-rounds', nums([1, 2, 3, 5, 7]), room3d.rounds) : '')
      + (md === 'koth' ? F('Pontos na colina', 'mp-set-hill', nums([50, 75, 100, 150]), room3d.hillTarget) : '')
      + (md !== 'rounds' ? F('Tempo da partida', 'mp-set-roundtime', ROUND_TIME_OPTS, room3d.roundTime) : '')
      + F('Bots no Azul', 'mp-set-botsA', nums([0, 1, 2, 3, 4, 5]), (bots.A || []).length)
      + F('Bots no Vermelho', 'mp-set-botsB', nums([0, 1, 2, 3, 4, 5]), (bots.B || []).length)
      + F('Nível dos bots', 'mp-set-level', [['iniciante', 'Iniciante'], ['amador', 'Amador'], ['pro', 'Profissional']], room3d.botLevel)
      // armas da sala: marque só uma (todo mundo com a mesma), todas, ou tire as que não quer; faca/granada/fumaça também
      + `<div class="field" style="grid-template-columns:130px 1fr"><span>Armas da sala</span><div class="row2" style="gap:10px;flex-wrap:wrap">${WEAPON_IDS.map((w) => `<label style="cursor:pointer"><input type="checkbox" data-mpw="${w}" ${(room3d.weapons || WEAPON_IDS).includes(w) ? 'checked' : ''}> ${WEAPON_SHORT[w] || w}</label>`).join('')}<button class="btn" id="mp-w-all" style="padding:2px 8px">Todas</button></div></div>`
      + `<div class="field" style="grid-template-columns:130px 1fr"><span>Extras</span><div class="row2" style="gap:10px;flex-wrap:wrap">${[['noKnife', 'Faca'], ['noNade', 'Granada'], ['noSmoke', 'Fumaça']].map(([k, t]) => `<label style="cursor:pointer"><input type="checkbox" data-mpx="${k}" ${room3d[k] ? '' : 'checked'}> ${t}</label>`).join('')}</div></div>`
      + F('Modo magia ✨', 'mp-set-magic', [['0', 'Desligado'], ['1', 'Ligado (Q = magia, Espaço no ar = vassoura)']], room3d.magic ? '1' : '0')
      + `<label class="field" style="grid-template-columns:130px 1fr;cursor:pointer"><span>Lista de salas</span><span><input type="checkbox" id="mp-set-hidden" ${room3d.hidden ? 'checked' : ''}> esconder a sala da lista (entra só quem sabe o nome)</span></label>`;
    const send = (extra) => socket.emit('3d_update_settings', extra);
    document.querySelectorAll('[data-mpw]').forEach((c) => c.addEventListener('change', () => {
      const list = [...document.querySelectorAll('[data-mpw]')].filter((x) => x.checked).map((x) => x.dataset.mpw);
      if (!list.length) { c.checked = true; mpStatus('Deixe pelo menos 1 arma liberada.', 'mp-status2'); return; }
      send({ weapons: list });
    }));
    $('mp-w-all').addEventListener('click', (e) => { e.preventDefault(); send({ weapons: WEAPON_IDS.slice() }); });
    document.querySelectorAll('[data-mpx]').forEach((c) => c.addEventListener('change', () => send({ [c.dataset.mpx]: !c.checked })));
    $('mp-set-hidden').addEventListener('change', () => send({ hidden: $('mp-set-hidden').checked }));
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('change', () => send(fn(el.value))); };
    on('mp-set-magic', (v) => ({ magic: v === '1' }));
    on('mp-set-map', (v) => ({ map: v })); on('mp-set-mode', (v) => ({ mode: v })); on('mp-set-kills', (v) => ({ killLimit: Number(v) }));
    on('mp-set-rounds', (v) => ({ rounds: Number(v) })); on('mp-set-hill', (v) => ({ hillTarget: Number(v) })); on('mp-set-roundtime', (v) => ({ roundTime: Number(v) }));
    on('mp-set-botsA', (v) => ({ botsA: Number(v) })); on('mp-set-botsB', (v) => ({ botsB: Number(v) })); on('mp-set-level', (v) => ({ botLevel: v }));
  } else {
    const lim = md === 'rounds' ? `${room3d.rounds} rounds` : md === 'koth' ? `até ${room3d.hillTarget} pontos` : `até ${room3d.killLimit} abates`;
    const wl = room3d.weapons || WEAPON_IDS, ex = [['noKnife', 'faca'], ['noNade', 'granada'], ['noSmoke', 'fumaça']].filter(([k]) => room3d[k]).map(([, t]) => t);
    const armas = (wl.length >= WEAPON_IDS.length ? 'todas' : wl.length === 1 ? 'só ' + WEAPON_SHORT[wl[0]] : wl.map((w) => WEAPON_SHORT[w]).join(', ')) + (ex.length ? ' · sem ' + ex.join('/') : '');
    $('mp-host-settings').innerHTML = `<div class="wdesc">Mapa: ${esc(MAPS[room3d.map] ? MAPS[room3d.map].name : room3d.map)} · ${MODE_NAME[md]} (${lim}) · Bots: ${(bots.A || []).length} azul / ${(bots.B || []).length} vermelho (${room3d.botLevel})${md !== 'rounds' ? ' · Tempo: ' + roundTimeLabel(room3d.roundTime) : ''} · Armas: ${armas}${room3d.magic ? ' · ✨ Modo magia' : ''}</div>`;
  }
  const mine = room3d.members.find((m) => m.id === myPid);
  $('mp-start-row').innerHTML = room3d.phase === 'match'
    ? '<div class="row2"><span class="wdesc">⚔️ Partida em andamento...</span>'
      + (mine && mine.inMatch ? '<button class="btn" id="mp-leave-match-btn">Sair da partida</button>' : '')
      + (isHost ? '<button class="btn danger" id="mp-end-btn">⏹ Encerrar partida (todos)</button>' : '') + '</div>'
    : (isHost ? '<button class="btn primary" id="mp-start-btn">▶ Iniciar partida</button>' : '<div class="wdesc">Aguardando o dono da sala iniciar...</div>');
  if (isHost && room3d.phase !== 'match') $('mp-start-btn').addEventListener('click', () => socket.emit('3d_start_match'));
  if ($('mp-end-btn')) $('mp-end-btn').addEventListener('click', () => socket.emit('3d_end_match'));
  if ($('mp-leave-match-btn')) $('mp-leave-match-btn').addEventListener('click', leaveNetMatch);
}
$('mp-create-btn').addEventListener('click', createRoom);
applyStreamer(true);
$('mp-join-btn').addEventListener('click', joinRoom);
$('mp-refresh-btn').addEventListener('click', refreshRoomList);
$('mp-leave-btn').addEventListener('click', () => leaveNetRoom(false));
$('mp-join-A').addEventListener('click', () => ensureSocket().emit('3d_choose_team', { team: 'A' }));
$('mp-join-B').addEventListener('click', () => ensureSocket().emit('3d_choose_team', { team: 'B' }));
(() => { try { const pr = window.PB && window.PB.getProfile ? window.PB.getProfile() : null; if (pr && pr.name) $('mp-name').value = pr.name; } catch (e) {} })();
$('o-weapon').innerHTML = WEAPON_IDS.map((w) => `<option value="${w}">${WEAPONS[w].name}</option>`).join('');
const WDESC = {
  lancador: 'Rápido e reto, sem cair. 3 ricochetes. Um tiro por segundo.',
  estilingue: 'Bolinha que cai um pouco com a distância. 4 ricochetes. Atira mais rápido.',
  mao: 'Você joga a bolinha de borracha: faz curva para baixo, quica muito (5 ricochetes) e dá para jogar rápido.',
  arco: 'Besta (crossbow): segure o clique para puxar e solte. Quanto mais puxa, mais rápida e reta a flecha. 2 ricochetes.',
  disco: 'Disco de borracha que voa reto e quica até 7 vezes nas paredes. Mais lento, ótimo para acertar pela tabela.',
  varinha: 'Varinha mágica: solta um raio rápido e reto (não cai) que ricocheteia 3 vezes. 8 raios por carga.'
};
function bindSetting(id, key, obj, onChange) {
  const el = $(id), o = obj || S;
  el.value = o[key];
  const show = () => { const v = $('v-' + id); if (v) v.textContent = el.value; };
  show();
  el.addEventListener('input', () => { o[key] = el.type === 'range' ? Number(el.value) : el.value; show(); save(); if (onChange) onChange(); drawPreview(); });
}
bindSetting('o-cam', 'cam');
bindSetting('o-map', 'map', null, () => newGame());
bindSetting('o-bots', 'bots', null, () => newGame());
bindSetting('o-allies', 'allies', null, () => newGame());
// modo de jogo (igual ao 2D) e o limite de cada um
function showModeFields() {
  const m = S.mode;
  $('f-kills').style.display = m === 'tdm' || m === 'ffa' ? '' : 'none';
  $('f-rounds').style.display = m === 'rounds' ? '' : 'none';
  $('f-hill').style.display = m === 'koth' ? '' : 'none';
  $('f-mtime').style.display = m === 'rounds' || m === 'livre' ? 'none' : '';
}
bindSetting('o-mode', 'mode', null, () => { showModeFields(); newGame(); });
for (const [id, k] of [['o-kills', 'kills'], ['o-rounds', 'rounds'], ['o-hill', 'hill'], ['o-mtime', 'mtime']]) bindSetting(id, k, null, () => newGame());
showModeFields();
// ---------- personagem: roupa e cores (prévia dos 2 times girando) ----------
const lookPrev = { renderer: null, scene: null, cam: null, figs: [], key: '', last: 0 };
function lookSwatches(k, kind) {
  const cols = (tm) => kind === 'leather' ? LEATHER(tm) : kind === 'hair' ? HAIR : kind === 'skin' ? SKIN : TEAM_PAL[tm];
  const A = cols('A'), B = cols('B');
  return `<div class="swrow">${A.map((c, i) => `<button class="sw ${S.look[k] === i ? 'on' : ''}" data-lk="${k}" data-li="${i}" title="Tom ${i + 1}" style="background:linear-gradient(135deg, ${c} 50%, ${B[i]} 50%)"></button>`).join('')}</div>`;
}
// painel de ícones (em vez de lista de texto) pra escolher personagem, capa, roupa e chapéu
const LOOK_ICONS = {
  m: [['hood', '🥷', 'Ladino (capuz)'], ['rogue', '🗡️', 'Ladino'], ['knight', '🛡️', 'Cavaleiro'], ['barbarian', '🪓', 'Bárbaro'], ['mage', '🧙', 'Maga']],
  cp: [[1, '🦸', 'Com capa'], [0, '🚫', 'Sem capa']],
  o: [[0, '👕', 'Camisa e calça separadas'], [1, '🥼', 'Macacão (roupa inteira)']],
  hat: [['none', '🚫', 'Nenhum'], ['cap', '🧢', 'Boné'], ['beanie', '🧶', 'Gorro'], ['top', '🎩', 'Cartola'], ['cowboy', '🤠', 'Chapéu de caubói'], ['crown', '👑', 'Coroa'], ['band', '🎗️', 'Faixa na testa']]
};
function renderLookFields() {
  const L = S.look;
  const icons = (k) => `<div class="icrow">${LOOK_ICONS[k].map(([v, ic, t]) => `<button class="ic ${String(L[k]) === String(v) ? 'on' : ''}" data-lic="${k}" data-v="${v}" title="${t}"><span>${ic}</span><small>${t.split(' (')[0]}</small></button>`).join('')}</div>`;
  const row = (label, html) => `<div class="field" style="grid-template-columns:118px 1fr;display:grid;align-items:center"><span>${label}</span>${html}</div>`;
  const MAG_DESC = { mage: 'Escudo: bolha que segura 2 tiros', hood: 'Olho: puxa os tiros inimigos pra ele', rogue: 'Teleporte curto pra frente', knight: 'Parede de pedra na sua frente', barbarian: 'Investida que joga os inimigos longe' };
  $('look-fields').innerHTML = row('Personagem', icons('m')) + row('Magia ✨', `<div class="wdesc" style="margin:0">${MAG_DESC[L.m] || ''} <span style="opacity:.7">(modo magia, tecla Q)</span></div>`) + row('Capa', icons('cp')) + row('Roupa', icons('o')) + row('Chapéu extra', icons('hat'))
    + SLOTS.filter(([k]) => !(k === 'p' && L.o) && !(k === 'hc' && L.hat === 'none')).map(([k, label, kind]) => row(label, lookSwatches(k, kind))).join('');
  document.querySelectorAll('[data-lic]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); const k = b.dataset.lic; S.look[k] = k === 'm' || k === 'hat' ? b.dataset.v : Number(b.dataset.v); lookChanged(); }));
  document.querySelectorAll('[data-lk]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); S.look[b.dataset.lk] = Number(b.dataset.li); lookChanged(); }));
}
function lookChanged() {
  S.look = normLook(S.look); save(); renderLookFields();
  { const m = !netMode && sim && sim.players.get('me'); if (m) m.look = normLook(S.look); } // (troca a magia junto com o personagem)
  if (socket && room3d) socket.emit('3d_set_look', S.look);
  if (S.look.m) loadModel(S.look.m).then(() => { lookPrev.key = ''; }).catch(() => {});
}
$('look-random').addEventListener('click', () => { S.look = botLook('me' + Math.random()); lookChanged(); });
$('look-reset').addEventListener('click', () => { S.look = Object.assign({}, LOOK_DEFAULT); lookChanged(); });
// arrastar com o mouse em cima do boneco gira ele
{ const cv = $('lookprev'); let drag = null;
  if (cv) {
    cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => { drag = e.clientX; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => { if (drag == null) return; lookPrev.rotY = (lookPrev.rotY || 0) + (e.clientX - drag) * 0.012; drag = e.clientX; });
    const up = () => { drag = null; cv.style.cursor = 'grab'; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  } }
function drawLookPreview(now) {
  const cv = $('lookprev'); if (!cv || !BASE.hood || !$('p-look').classList.contains('on') || !menuOpen) return;
  const LP = lookPrev;
  if (!LP.renderer) {
    LP.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); LP.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    LP.renderer.setSize(cv.width, cv.height, false); LP.renderer.outputColorSpace = THREE.SRGBColorSpace; LP.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    LP.scene = new THREE.Scene(); LP.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(60, 120, 90); LP.scene.add(d);
    LP.cam = new THREE.PerspectiveCamera(32, cv.width / cv.height, 1, 2000); LP.cam.position.set(0, 58, 250); LP.cam.lookAt(0, 34, 0);
  }
  const key = JSON.stringify(S.look) + !!BASE[S.look.m];
  if (key !== LP.key) {
    LP.key = key; for (const f of LP.figs) LP.scene.remove(f.g); LP.figs = [];
    const mk = BASE[S.look.m] ? S.look.m : 'hood';
    ['A', 'B'].forEach((tm, i) => {
      const model = SkeletonUtils.clone(BASE[mk].scene); dressModel(model, mk, S.look, tm, BASE);
      const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(CHAR_H / ((box.max.y - box.min.y) || 1));
      model.traverse((o) => { if (['1H_Crossbow', 'Knife', 'Throwable', 'Knife_Offhand'].includes(o.name)) o.visible = false; });
      const g = new THREE.Group(); g.add(model); g.position.x = i ? 38 : -38; LP.scene.add(g);
      const mixer = new THREE.AnimationMixer(model); if (CLIPS.Idle) mixer.clipAction(CLIPS.Idle.full).play();
      LP.figs.push({ g, mixer });
    });
  }
  const dt = LP.last ? Math.min(0.1, (now - LP.last) / 1000) : 0; LP.last = now;
  for (const f of LP.figs) { f.mixer.update(dt); f.g.rotation.y = LP.rotY || 0; } // gira só arrastando com o mouse
  LP.renderer.render(LP.scene, LP.cam);
}
bindSetting('o-kc', 'kc');
bindSetting('o-adszoom', 'adszoom');
bindSetting('o-level', 'level', null, () => { for (const p of sim.players.values()) if (p.bot) p.level = S.level; });
bindSetting('o-shadow', 'shadow', null, () => { renderer.shadowMap.enabled = S.shadow === '1'; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); });
bindSetting('o-fov', 'fov');
bindSetting('o-camdist', 'camDist');
bindSetting('o-gundist', 'gunDist');
for (const [id, k] of [['o-armsize', 'armSize'], ['o-armlen', 'armLen'], ['o-armw', 'armW']]) bindSetting(id, k, null, () => { FPA.key = ''; }); // braços da 1ª pessoa (refaz na hora)
bindSetting('o-pause', 'pause');
bindSetting('o-magic', 'magic', null, () => { if (!netMode) newGame(); });
bindSetting('o-camside', 'camSide');
bindSetting('o-weapon', 'weapon', null, () => {
  if (netMode) { if (sim.allowed && !sim.allowed.includes(S.weapon)) mpStatus('Essa arma está bloqueada nesta sala.', 'mp-status2'); else if (socket) socket.emit('3d_action', { t: 'primary', w: S.weapon }); }
  else for (const p of sim.players.values()) if (p.id === 'me' || p.bot) sim.setPrimary(p, S.weapon); // sozinho: todo mundo com a mesma arma
  $('w-desc').textContent = WDESC[S.weapon];
});
$('w-desc').textContent = WDESC[S.weapon];
bindSetting('o-sens', 'sens');
bindSetting('o-invert', 'invert');
bindSetting('o-mute', 'mute');
// ---------- sala de teste: velocidade / pulo / cadência / recarga ajustáveis ----------
bindSetting('o-die', 'die', null, () => { if (sim && !netMode) sim.godMode = S.die === '0'; });
// sons: várias opções pra cada coisa (toca a prévia ao trocar)
$('snd-list').innerHTML = Object.keys(SFX.LIB).map((k) => `<label class="field"><span>${SFX.NAMES[k]}</span><select data-snd="${k}">${SFX.LIB[k].map((v, i) => `<option value="${i}">${esc(v[0])}</option>`).join('')}</select><button class="btn" data-sndplay="${k}" style="padding:4px 10px">▶</button></label>`).join('');
document.querySelectorAll('[data-snd]').forEach((el) => {
  el.value = String(S.sfx[el.dataset.snd] || 0);
  el.addEventListener('change', () => { S.sfx[el.dataset.snd] = Number(el.value); save(); SFX.init(); SFX.play(el.dataset.snd, 1); });
});
document.querySelectorAll('[data-sndplay]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); SFX.init(); SFX.play(b.dataset.sndplay, 1); }));
bindSetting('o-speed', 'speed', null, () => { if (sim) sim.setParam('speed', S.speed); });
bindSetting('o-jumpv', 'jumpv', null, () => { if (sim) sim.setParam('jumpV', S.jumpv); });
$('o-tweapon').innerHTML = WEAPON_IDS.map((w) => `<option value="${w}">${WEAPONS[w].name}</option>`).join('');
function loadTweaponSliders() {
  const base = WEAPONS[S.tweapon], ov = S.wtune[S.tweapon] || {};
  const cd = ov.cd != null ? ov.cd : base.cd, rl = ov.reload != null ? ov.reload : base.reload;
  $('o-tcd').value = cd; $('v-o-tcd').textContent = cd;
  $('o-treload').value = rl; $('v-o-treload').textContent = rl;
}
$('o-tweapon').value = S.tweapon;
loadTweaponSliders();
$('o-tweapon').addEventListener('change', () => { S.tweapon = $('o-tweapon').value; save(); loadTweaponSliders(); });
$('o-tcd').addEventListener('input', () => {
  const v = Number($('o-tcd').value); $('v-o-tcd').textContent = v;
  S.wtune[S.tweapon] = Object.assign({}, S.wtune[S.tweapon], { cd: v }); save();
  if (sim) sim.setWeaponParam(S.tweapon, 'cd', v);
});
$('o-treload').addEventListener('input', () => {
  const v = Number($('o-treload').value); $('v-o-treload').textContent = v;
  S.wtune[S.tweapon] = Object.assign({}, S.wtune[S.tweapon], { reload: v }); save();
  if (sim) sim.setWeaponParam(S.tweapon, 'reload', v);
});
$('o-treset').addEventListener('click', () => {
  S.speed = DEFAULTS.speed; S.jumpv = DEFAULTS.jumpv; S.wtune = {}; save();
  $('o-speed').value = S.speed; $('v-o-speed').textContent = S.speed;
  $('o-jumpv').value = S.jumpv; $('v-o-jumpv').textContent = S.jumpv;
  loadTweaponSliders();
  if (sim) {
    sim.setParam('speed', S.speed); sim.setParam('jumpV', S.jumpv);
    for (const k of WEAPON_IDS) { sim.setWeaponParam(k, 'cd', WEAPONS[k].cd); sim.setWeaponParam(k, 'reload', WEAPONS[k].reload); }
  }
});
for (const k of ['color', 'outline', 'len', 'thick', 'gap', 'dot', 'dotsize', 'ring', 'ringr', 'ringw', 'hit', 'hitlen', 'hitw']) bindSetting('x-' + k, k, S.x);
$('x-reset').addEventListener('click', () => {
  S.x = Object.assign({}, DEFAULTS.x); save();
  for (const k in S.x) { const el = $('x-' + k); if (el) { el.value = S.x[k]; const v = $('v-x-' + k); if (v) v.textContent = el.value; } }
  drawPreview();
});
function drawPreview() {
  const c = $('xprev'), ctx = c.getContext('2d');
  drawCross(ctx, c.width, c.height, S.x, 0.65, { kind: (Math.floor(performance.now() / 900) % 2) ? 'kill' : 'hit', a: 1 });
}
setInterval(() => { if (menuOpen) drawPreview(); }, 450);
$('btn-play').addEventListener('click', () => { SFX.init(); lockPointer(); });
function lockPointer() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
canvas.addEventListener('click', () => { SFX.init(); if (!locked && !EDIT3D && !hudEdit) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (EDIT3D) EDIT3D.lockChanged(locked); else showMenu(!locked); // editor 3D: Esc volta pro editor (sem menu)
  if (!locked) { netFireHeld = false; aimHeld = false; const me = sim && sim.players.get('me'); if (me) me.input.fire = false; }
});

// ---------- controles ----------
let sim = null;
const keys = {};
// ---------- multiplayer: estado de rede ----------
let socket = null, netMode = false, myPid = null, room3d = null, netRoundTime = 0;
let netYaw = 0, netPitch = 0, netFireHeld = false, netInputT = 0, netRecvT = 0, netInterval = 130;
document.addEventListener('mousemove', (e) => {
  if (!locked || !sim) return;
  const s = S.sens * 0.0012 * (adsK > 0.5 && S.adszoom === '1' ? 0.65 : 1); // mirando com zoom: mira mais fina
  if (netMode) {
    netYaw += e.movementX * s;
    netPitch = Math.max(-1.35, Math.min(1.35, netPitch - e.movementY * s * (S.invert === '1' ? -1 : 1)));
    return;
  }
  const me = sim.players.get('me'); if (!me) return;
  me.yaw += e.movementX * s;
  me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - e.movementY * s * (S.invert === '1' ? -1 : 1)));
});
let aimHeld = false;
canvas.addEventListener('mousedown', (e) => {
  if (locked && (e.button === 0 || e.button === 2) && specNext(e.button === 2 ? -1 : 1)) return; // (espectador: clique = próximo, botão direito = anterior)
  if (locked && e.button === 2) { aimHeld = true; return; }
  if (!locked || e.button !== 0) return;
  if (netMode) { netFireHeld = true; return; }
  const me = sim.players.get('me'); if (me) me.input.fire = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) { aimHeld = false; return; }
  if (e.button !== 0) return;
  if (netMode) { netFireHeld = false; return; }
  if (sim) { const me = sim.players.get('me'); if (me) me.input.fire = false; }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let wheelT = 0;
window.addEventListener('wheel', (e) => { // rodinha: troca de arma
  if (!locked) return;
  e.preventDefault();
  const now = performance.now(); if (now - wheelT < 110) return; wheelT = now;
  if (netMode) { if (socket) socket.emit('3d_action', { t: 'cycle', dir: e.deltaY > 0 ? 1 : -1 }); return; }
  sim.cycleWeapon(sim.players.get('me'), e.deltaY > 0 ? 1 : -1);
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); $('board').style.display = 'block'; renderBoard(); return; }
  if (!locked || !sim) return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  const me = sim.players.get('me'); if (!me) return;
  if (e.code === 'KeyV') { S.cam = S.cam === '1' ? '3' : '1'; $('o-cam').value = S.cam; save(); return; }
  if (e.code === 'AltLeft') { e.preventDefault(); S.camSide = S.camSide === '1' ? '-1' : '1'; $('o-camside').value = S.camSide; save(); feed(S.camSide === '1' ? '📷 Câmera no ombro direito' : '📷 Câmera no ombro esquerdo'); return; } // (3ª pessoa: troca o lado da câmera)
  if (netMode) {
    if (!socket) return;
    if (e.code === 'Space') socket.emit('3d_action', { t: 'jump' });
    else if (e.code === 'KeyQ') socket.emit('3d_action', { t: 'ability' }); // (modo magia)
    else if (e.code === 'KeyR') socket.emit('3d_action', { t: 'reload' });
    else if (e.code === 'Digit1') socket.emit('3d_action', { t: 'weapon', w: 'primary' });
    else if (e.code === 'Digit2') socket.emit('3d_action', { t: 'weapon', w: 'potion' });
    else if (e.code === 'Digit3') socket.emit('3d_action', { t: 'weapon', w: 'knife' });
    else if (e.code === 'Digit4') socket.emit('3d_action', { t: 'weapon', w: 'nade' });
    else if (e.code === 'Digit5') socket.emit('3d_action', { t: 'weapon', w: 'smoke' });
    return;
  }
  if (e.code === 'Space') sim.jump(me);
  else if (e.code === 'KeyQ') sim.ability(me); // (modo magia: a magia do seu personagem)
  else if (e.code === 'KeyR') sim.reload(me);
  else if (e.code === 'Digit1') sim.setWeapon(me, 'primary');
  else if (e.code === 'Digit2') sim.setWeapon(me, 'potion');
  else if (e.code === 'Digit3') sim.setWeapon(me, 'knife');
  else if (e.code === 'Digit4') sim.setWeapon(me, 'nade');
  else if (e.code === 'Digit5') sim.setWeapon(me, 'smoke');
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') $('board').style.display = 'none'; if (e.code === 'AltLeft' && locked) e.preventDefault(); }); // (Alt solto: o navegador não abre o menu dele)
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; $('board').style.display = 'none'; });

// ---------- placar (Tab) ----------
function renderBoard() {
  if (!sim) return;
  let html = '';
  // conexão: ping até o servidor e onde ele fica
  $('board-net').innerHTML = netMode
    ? `📶 Ping: <b>${netPing != null ? netPing + ' ms' : 'medindo...'}</b> · Servidor: <b>${esc(netLoc || 'descobrindo...')}</b>` + (netPing != null ? (netPing < 60 ? ' <span style="color:#86efac">(perto)</span>' : netPing < 130 ? ' <span style="color:#facc15">(médio)</span>' : ' <span style="color:#f87171">(longe)</span>') : '')
    : '💻 Jogando offline, no seu computador (sem ping)';
  const row = (p) => `<tr class="${p.id === 'me' ? 'me' : ''} ${p.alive ? '' : 'dead'}"><td>${esc(p.name)}${p.alive ? '' : ' 💀'}</td><td>${p.k}</td><td>${p.d}</td><td>${p.a}</td><td>${(p.k / Math.max(1, p.d)).toFixed(2)}</td></tr>`;
  const head = '<table><thead><tr><th>Jogador</th><th>Abates</th><th>Mortes</th><th>Assist.</th><th>K/D</th></tr></thead><tbody>';
  if (sim.mode === 'ffa') {
    const list = [...sim.players.values()].sort((a, b) => b.k - a.k || a.d - b.d);
    $('board-body').innerHTML = `<h3>Cada um por si — até ${sim.killLimit} abates</h3>` + head + list.map(row).join('') + '</tbody></table>';
    return;
  }
  for (const tm of ['A', 'B']) {
    const list = [...sim.players.values()].filter((p) => p.team === tm).sort((a, b) => b.k - a.k || a.d - b.d);
    const tk = list.reduce((s, p) => s + p.k, 0);
    html += `<h3 class="t${tm}">${tm === 'A' ? 'Time Azul' : 'Time Vermelho'} — ${tk} abates</h3><table><thead><tr><th>Jogador</th><th>Abates</th><th>Mortes</th><th>Assist.</th><th>K/D</th></tr></thead><tbody>`;
    for (const p of list) html += `<tr class="${p.id === 'me' ? 'me' : ''} ${p.alive ? '' : 'dead'}"><td>${esc(p.name)}${p.alive ? '' : ' 💀'}</td><td>${p.k}</td><td>${p.d}</td><td>${p.a}</td><td>${(p.k / Math.max(1, p.d)).toFixed(2)}</td></tr>`;
    html += '</tbody></table>';
  }
  $('board-body').innerHTML = html;
}

// ---------- HUD ----------
const SLOT_NAMES = { primary: '1', potion: '2', knife: '3', nade: '4', smoke: '5' };
// contador do evento do mapa no topo (igual ao 2D): "Furacão em 12s"
const HZ_TXT = { sand: ['🏜️ Tempestade de areia', 'chegando!', 'agora!'], tornado: ['🌪️ Furacão', 'nascendo!', 'solto!'], storm: ['🌬️ Tempestade congelante', 'olha a faixa!', 'soprando!'], dark: ['💡 Luz apaga', 'piscando!', 'apagou!'], lava: ['🌋 Erupção', 'o chão rachou!', 'agora!'], meteor: ['☄️ Meteoro', 'olha a sombra!', 'caiu!'], train: ['🚇 Trem', 'luz vermelha no trilho!', 'passando!'], wave: ['🌊 Onda gigante', 'vindo!', 'invadindo!'], crane: ['🏗️ Bola de demolição', 'vai girar!', 'girando!'], swell: ['🌊 Onda grande de lado', 'segura firme!', 'o navio inclinou!'], dragon: ['🐉 Dragão', 'olha pro céu!', 'cuspindo fogo!'] };
function hazardText() {
  const k = sim.hazard, T = HZ_TXT[k];
  if (k === 'portal') return sim.phase === 'playing' ? `🌀 Portais ${sim.portalPairs ? 'abertos' : 'fechados'} · ${sim.portalPairs ? 'fecham' : 'abrem'} em ${Math.max(0, Math.ceil(sim.portalN || 0))}s` : '';
  if (k === 'meteor' && (sim.meteors || []).length >= METEOR.max * 2) return '';
  if (!T || !sim.hz || !sim.hz[k]) return '';
  if (k === 'lava' && (sim.holes || []).length >= 4) return '';
  const cy = sim.cycle(k);
  return cy.s === 0 ? `${T[0]} em ${Math.ceil(cy.n)}s` : `${T[0]} — ${cy.s === 1 ? T[1] : T[2]}`;
}
// ---------- minimapa: seu time sempre; inimigo só aparece um instante onde atirou (igual COD); círculo = até onde você ouve ----------
const HEAR = 1400; // distância máxima que dá pra ouvir um tiro (é a mesma do som)
let miniBase = null; const shotSeen = new Map();
function buildMinimapBase() {
  const cv = document.createElement('canvas'), mc = $('minimap'), W = mapInfo.W, H = mapInfo.H;
  if (!W || !mc) { miniBase = null; return; }
  const k = Math.min(mc.width / W, mc.height / H); cv.width = mc.width; cv.height = mc.height;
  const g = cv.getContext('2d'), ox = (mc.width - W * k) / 2, oy = (mc.height - H * k) / 2;
  const shape = mapInfo.world && mapInfo.world.shape;
  g.fillStyle = 'rgba(160,170,190,.16)';
  if (shape) { g.beginPath(); shape.forEach(([x, z], i) => (i ? g.lineTo(ox + x * k, oy + z * k) : g.moveTo(ox + x * k, oy + z * k))); g.closePath(); g.fill(); g.strokeStyle = 'rgba(220,230,245,.5)'; g.lineWidth = 2; g.stroke(); }
  else { g.fillRect(ox, oy, W * k, H * k); g.strokeStyle = 'rgba(220,230,245,.5)'; g.lineWidth = 2; g.strokeRect(ox, oy, W * k, H * k); }
  g.fillStyle = 'rgba(225,232,245,.55)';
  for (const R of mapWalls) { if (R.border || R.space || R.tree || R.y0 > 60 || R.plat) continue; if (mapInfo.dunes && DuneField.isDune(R)) continue; g.fillRect(ox + R.x * k, oy + R.y * k, Math.max(1.5, R.w * k), Math.max(1.5, R.h * k)); }
  // pontes lá em cima (fábrica): faixa amarela clarinha
  const brs = mapInfo.world && mapInfo.world.bridges;
  if (brs) { g.strokeStyle = 'rgba(250,204,21,.45)'; g.lineCap = 'round'; for (const B of brs) { g.lineWidth = Math.max(2, B.hw * 2 * k); g.beginPath(); g.moveTo(ox + B.ax * k, oy + B.az * k); g.lineTo(ox + B.bx * k, oy + B.bz * k); g.stroke(); } }
  miniBase = { cv, k, ox, oy, key: mapInfo };
}
function drawMinimap(me, now) {
  const mc = $('minimap'); if (!mc) return;
  mc.style.display = me && !killcam.active && !menuOpen ? 'block' : 'none';
  if ((!miniBase || miniBase.key !== mapInfo) && mapInfo.W) buildMinimapBase();
  if (!miniBase || !me) return;
  const g = mc.getContext('2d'), { k, ox, oy } = miniBase, P2 = (x, z) => [ox + x * k, oy + z * k];
  g.clearRect(0, 0, mc.width, mc.height); g.drawImage(miniBase.cv, 0, 0);
  const [mx, mz] = P2(me.x, me.z);
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.arc(mx, mz, HEAR * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  for (const p of sim.players.values()) {
    if (p.id === 'me' || !p.alive) continue;
    const ally = sim.mode !== 'ffa' && p.team === me.team;
    if (ally) { const [x, z] = P2(p.x, p.z); g.fillStyle = '#60a5fa'; g.beginPath(); g.arc(x, z, 3.2, 0, 7); g.fill(); continue; }
    const sh = shotSeen.get(p.id); if (!sh) continue;
    const a = 1 - (now - sh.t) / 1600; if (a <= 0) { shotSeen.delete(p.id); continue; }
    const [x, z] = P2(sh.x, sh.z); g.fillStyle = `rgba(248,113,113,${a})`; g.beginPath(); g.arc(x, z, 4, 0, 7); g.fill();
  }
  if (me.alive) { // você: setinha pra onde está olhando
    g.save(); g.translate(mx, mz); g.rotate(me.yaw); g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, -4.5); g.lineTo(-2, 0); g.lineTo(-4, 4.5); g.closePath(); g.fill(); g.restore();
  }
}

// ---------- HUD editável: cada informação da tela pode mudar de lugar, de tamanho, ficar transparente ou sumir;
// e dá pra separar o painel de baixo (vida, tiro, arma, pulo duplo) e o aviso do evento em caixas soltas ----------
const HUD_ITEMS = [
  ['hud', 'Painel (vida, tiro, arma, pulo)', 'hud'], ['lives', 'Vida', 'hw-lives'], ['ammo', 'Tiro / munição', 'hw-ammo'], ['weapon', 'Nome da arma', 'hw-weapon'], ['jump', 'Pulo duplo', 'hw-jump'],
  ['slots', 'Barra de armas', 'slots'], ['minimap', 'Minimapa', 'minimap'], ['alive', 'Vivos de cada time', 'alive'], ['score', 'Placar / round', 'score'],
  ['feed', 'Mortes (kill feed)', 'feed'], ['top', 'FPS', 'top'], ['hz', 'Aviso do evento do mapa', 'hw-hz']
];
const HUD_SPLIT_IDS = ['lives', 'ammo', 'weapon', 'jump', 'hz'];
if (!S.hud || typeof S.hud !== 'object') S.hud = { split: false, w: {} };
if (!S.hud.w) S.hud.w = {};
let hudEdit = false, hudSel = null;
const hudEl = (id) => { const it = HUD_ITEMS.find((q) => q[0] === id); return it ? $(it[2]) : null; };
const hudActive = () => HUD_ITEMS.filter(([id]) => (S.hud.split ? id !== 'hud' : !HUD_SPLIT_IDS.includes(id))).map((q) => q[0]);
function hudSplit(on) {
  // separa: cada linha do painel de baixo (e o aviso do evento) vira uma caixa solta no mesmo lugar onde estava
  const rects = {}; for (const id of HUD_SPLIT_IDS) { const e = id === 'hz' ? $('h-hz') : hudEl(id); if (e) rects[id] = e.getBoundingClientRect(); }
  let hz = $('hw-hz');
  if (on) {
    if (!hz) { hz = document.createElement('div'); hz.id = 'hw-hz'; hz.className = 'panel hwsep'; document.body.appendChild(hz); }
    hz.appendChild($('h-hz')); $('h-hz').style.marginLeft = '0';
    for (const id of ['lives', 'ammo', 'weapon', 'jump']) { const e = hudEl(id); e.classList.add('panel', 'hwsep'); document.body.appendChild(e); }
    $('hud').style.display = 'none';
    // caixas soltas empilhadas no canto de baixo à esquerda (onde o painel ficava), sem encostar uma na outra
    let yb = innerHeight - 12;
    for (const id of ['jump', 'weapon', 'ammo', 'lives']) { const e = hudEl(id), r = e.getBoundingClientRect(); if (!S.hud.w[id]) S.hud.w[id] = { x: (12 + r.width / 2) / innerWidth, y: (yb - r.height / 2) / innerHeight }; yb -= r.height + 6; }
    if (!S.hud.w.hz && rects.hz && rects.hz.width) { const r = rects.hz; S.hud.w.hz = { x: (r.left + r.width / 2 + 10) / innerWidth, y: 76 / innerHeight }; }
  } else {
    for (const id of ['lives', 'ammo', 'weapon', 'jump']) { const e = hudEl(id); e.classList.remove('panel', 'hwsep', 'hw-nobg', 'hw-hide', 'hwx', 'hwsel'); e.style.cssText = ''; $('hud').appendChild(e); }
    $('top').appendChild($('h-hz')); $('h-hz').style.marginLeft = '10px';
    if (hz) hz.remove();
    $('hud').style.display = '';
  }
  S.hud.split = !!on;
}
function applyHud() {
  if (!!S.hud.split !== !!$('hw-hz')) hudSplit(S.hud.split);
  for (const [id, , elId] of HUD_ITEMS) {
    const e = $(elId); if (!e) continue;
    const act = hudActive().includes(id), L = S.hud.w[id] || {};
    e.classList.toggle('hwx', act && hudEdit);
    if (!act) continue;
    e.classList.toggle('hw-hide', L.show === false);
    e.classList.toggle('hw-nobg', L.bg === false);
    e.style.opacity = L.op != null ? String(L.op) : '';
    if (L.x != null) { e.style.left = (L.x * 100) + 'vw'; e.style.top = (L.y * 100) + 'vh'; e.style.right = 'auto'; e.style.bottom = 'auto'; e.style.transform = `translate(-50%, -50%) scale(${L.s || 1})`; }
    else { e.style.left = e.style.top = e.style.right = e.style.bottom = e.style.transform = ''; }
    e.dataset.hw = id;
  }
  $('hb-split').textContent = S.hud.split ? 'Juntar de novo no painel' : 'Separar vida/tiro/arma/pulo';
  $('hud-split').textContent = $('hb-split').textContent;
  renderHudList();
}
function hudSave() { save(); applyHud(); }
// antes de mudar o tamanho: guarda onde a caixa está (o tamanho cresce a partir do meio dela)
function hudPos(id) { const L = S.hud.w[id] = S.hud.w[id] || {}; if (L.x == null) { const e = hudEl(id), r = e && e.getBoundingClientRect(); if (r && r.width) { L.x = (r.left + r.width / 2) / innerWidth; L.y = (r.top + r.height / 2) / innerHeight; } } return L; }
function renderHudList() {
  const el = $('hud-list'); if (!el || !menuOpen) return;
  el.innerHTML = hudActive().map((id) => { const L = S.hud.w[id] || {}, n = HUD_ITEMS.find((q) => q[0] === id)[1];
    return `<div class="row2" style="display:grid;grid-template-columns:1.4fr 60px 1fr 1fr 60px;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #243044">
      <b style="font-size:12px">${n}</b><label style="font-size:12px"><input type="checkbox" data-hl="${id}" data-k="show" ${L.show === false ? '' : 'checked'}> mostra</label>
      <label style="font-size:12px">tamanho <input type="range" min="0.5" max="2.5" step="0.05" value="${L.s || 1}" data-hl="${id}" data-k="s" style="width:80px"></label>
      <label style="font-size:12px">visível <input type="range" min="0.15" max="1" step="0.05" value="${L.op != null ? L.op : 1}" data-hl="${id}" data-k="op" style="width:80px"></label>
      <label style="font-size:12px"><input type="checkbox" data-hl="${id}" data-k="bg" ${L.bg === false ? '' : 'checked'}> fundo</label></div>`; }).join('');
  el.querySelectorAll('[data-hl]').forEach((inp) => inp.addEventListener('input', () => { const L = inp.dataset.k === 's' ? hudPos(inp.dataset.hl) : (S.hud.w[inp.dataset.hl] = S.hud.w[inp.dataset.hl] || {}); L[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : Number(inp.value); save(); applyHud(); }));
}
function hudSelShow() {
  const box = $('hb-sel'); document.querySelectorAll('.hwsel').forEach((e) => e.classList.remove('hwsel'));
  if (!hudSel) { box.style.display = 'none'; return; }
  const e = hudEl(hudSel); if (e) e.classList.add('hwsel');
  const L = S.hud.w[hudSel] || {}, n = HUD_ITEMS.find((q) => q[0] === hudSel)[1];
  box.style.display = 'flex';
  box.innerHTML = `<b style="color:var(--acc)">${n}</b><label>tamanho <input type="range" min="0.5" max="2.5" step="0.05" value="${L.s || 1}" data-k="s"></label><label>visível <input type="range" min="0.15" max="1" step="0.05" value="${L.op != null ? L.op : 1}" data-k="op"></label><label><input type="checkbox" data-k="bg" ${L.bg === false ? '' : 'checked'}> fundo</label><label><input type="checkbox" data-k="show" ${L.show === false ? '' : 'checked'}> mostra</label>`;
  box.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', () => { const Q = inp.dataset.k === 's' ? hudPos(hudSel) : (S.hud.w[hudSel] = S.hud.w[hudSel] || {}); Q[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : Number(inp.value); hudSave(); }));
}
function hudEditMode(on) {
  hudEdit = on; document.body.classList.toggle('hudedit', on); hudSel = null;
  if (on) { showMenu(false); if (!$('score').textContent) $('score').innerHTML = 'Round 1/5 · Azul 0 x 0 Vermelho'; }
  else { save(); showMenu(true); }
  applyHud(); hudSelShow();
}
let hudDrag = null;
document.addEventListener('pointerdown', (e) => {
  if (!hudEdit) return;
  const w = e.target.closest && e.target.closest('.hwx'); if (!w) return;
  e.preventDefault(); const id = w.dataset.hw, r = w.getBoundingClientRect();
  if (!S.hud.w[id]) S.hud.w[id] = {};
  const L = S.hud.w[id]; if (L.x == null) { L.x = (r.left + r.width / 2) / innerWidth; L.y = (r.top + r.height / 2) / innerHeight; applyHud(); }
  hudDrag = { id, ox: e.clientX - L.x * innerWidth, oy: e.clientY - L.y * innerHeight, moved: false };
  hudSel = id; hudSelShow();
});
document.addEventListener('pointermove', (e) => {
  if (!hudDrag) return; const L = S.hud.w[hudDrag.id];
  L.x = Math.max(0.01, Math.min(0.99, (e.clientX - hudDrag.ox) / innerWidth)); L.y = Math.max(0.01, Math.min(0.99, (e.clientY - hudDrag.oy) / innerHeight));
  hudDrag.moved = true; applyHud();
});
document.addEventListener('pointerup', () => { if (hudDrag) { hudDrag = null; save(); } });
document.addEventListener('wheel', (e) => {
  if (!hudEdit) return; const w = e.target.closest && e.target.closest('.hwx'); if (!w) return;
  const L = hudPos(w.dataset.hw); L.s = Math.max(0.5, Math.min(2.5, (L.s || 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
  hudSel = w.dataset.hw; hudSave(); hudSelShow();
}, { passive: true });
$('hud-edit').onclick = () => hudEditMode(true);
$('hb-done').onclick = () => hudEditMode(false);
const toggleSplit = () => { hudSplit(!S.hud.split); hudSave(); hudSelShow(); };
$('hb-split').onclick = toggleSplit; $('hud-split').onclick = toggleSplit;
const resetHud = () => { if (S.hud.split) hudSplit(false); S.hud = { split: false, w: {} }; for (const [, , elId] of HUD_ITEMS) { const e = $(elId); if (e) { e.style.left = e.style.top = e.style.right = e.style.bottom = e.style.transform = e.style.opacity = e.style.transformOrigin = ''; e.classList.remove('hw-hide', 'hw-nobg'); } } hudSave(); hudSelShow(); };
$('hb-reset').onclick = resetHud; $('hud-reset').onclick = resetHud;
window.addEventListener('keydown', (e) => { if (hudEdit && e.key === 'Escape') { e.preventDefault(); hudEditMode(false); } });
document.querySelector('.tab[data-pane="p-hud"]').addEventListener('click', () => setTimeout(renderHudList, 0));
applyHud();
function hud(me) {
  { // vivos de cada time (em cima)
    let a = 0, b = 0, n = 0; for (const p of sim.players.values()) { n++; if (p.alive) { if (p.team === 'A') a++; else b++; } }
    $('alive').style.display = n > 1 && sim.mode !== 'ffa' ? 'flex' : 'none';
    $('alive').innerHTML = `<span class="tA">🔵 ${a} vivo${a === 1 ? '' : 's'}</span><span style="color:var(--muted)">×</span><span class="tB">${b} vivo${b === 1 ? '' : 's'} 🔴</span>`;
  }
  $('h-hz').textContent = hazardText();
  if ($('hw-hz')) $('hw-hz').style.display = $('h-hz').textContent || hudEdit ? '' : 'none'; // aviso solto: some quando não tem evento
  updateModeHud(me, performance.now());
  let h = ''; for (let i = 0; i < P.lives; i++) h += `<span class="${i < me.lives && me.alive ? '' : 'lost'}">❤️</span>`;
  $('h-lives').innerHTML = h;
  if (false && netMode && netRoundTime > 0) {
    const left = Math.max(0, Math.ceil(netRoundTime - sim.time));
    $('h-clock').textContent = '⏱️ ' + String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
  }
  const w = sim.WEAPONS[me.primary];
  if (me.weapon === 'primary') { $('h-ammo').textContent = me.reloadUntil ? 'recarregando...' : `${me.ammo[me.primary]}/${w.mag}`; $('h-mags').textContent = `· pentes ${me.mags[me.primary]}`; }
  else if (me.weapon === 'knife') { $('h-ammo').textContent = 'FACA'; $('h-mags').textContent = ''; }
  else if (me.weapon === 'potion') { $('h-ammo').textContent = 'POÇÃO'; $('h-mags').textContent = '· clique para beber'; }
  else { $('h-ammo').textContent = me.weapon === 'nade' ? 'GRANADA' : 'FUMAÇA'; $('h-mags').textContent = ''; }
  $('h-weapon').textContent = me.weapon === 'primary' ? w.name : '';
  const dj = sim.time >= me.djReadyAt;
  $('h-jump').innerHTML = (dj ? '🦘 Pulo duplo <b style="color:#86efac">PRONTO</b> (Espaço 2x)' : `🦘 Pulo duplo em ${Math.ceil(me.djReadyAt - sim.time)}s`)
    + (sim.magic ? (() => { const k = sim.magicOf(me), left = (me.magicReady || 0) - sim.time; return `<br>✨ Q: ${MAGIC_NAME[k]} ` + (left <= 0 ? '<b style="color:#c4b5fd">PRONTO</b>' : `em ${Math.ceil(left)}s`) + ' · 🧹 segure Espaço no ar'; })() : '');
  const slot = (k, name, off) => `<div class="slot ${me.weapon === k ? 'on' : ''} ${off ? 'off' : ''}"><b>${SLOT_NAMES[k]}</b>${name}</div>`;
  $('slots').innerHTML = slot('primary', w.name.split(' ')[0]) + slot('potion', `Poção ×${me.potions}`, !me.potions || me.lives >= P.lives) + (sim.noKnife ? '' : slot('knife', 'Faca')) + (sim.noNade ? '' : slot('nade', `Granada ×${me.nades}`, !me.nades)) + (sim.noSmoke ? '' : slot('smoke', `Fumaça ×${me.smokes}`, !me.smokes)); // (armas bloqueadas na sala somem)
  if (!me.alive) {
    const killer = [...sim.players.values()].find((p) => me.lastHitBy[p.id] && Math.abs(me.lastHitBy[p.id] - me.deadAt) < 0.05);
    $('dead').style.display = spec.id != null ? 'none' : 'block'; // (assistindo alguém: só o aviso de quem você assiste)
    $('dead').innerHTML = `Você foi eliminado${killer ? ' por <span class="t' + killer.team + '">' + esc(killer.name) + '</span>' : ''}<small>${sim.mode === 'rounds' ? 'volta no próximo round' : `renascendo em ${Math.max(0, Math.ceil(me.respawnAt - sim.time))}s`}</small>`;
  } else $('dead').style.display = 'none';
  // indicador de granada inimiga: distância em metros e seta de direção pra correr
  let nearest = null, best = 1e9;
  for (const g of sim.nades) {
    if (g.smoke || g.team === me.team) continue;
    const d = Math.hypot(g.x - me.x, g.z - me.z);
    if (d < best) { best = d; nearest = g; }
  }
  const bw = $('bombwarn');
  if (nearest && me.alive && best < 700) {
    const ang = Math.atan2(nearest.z - me.z, nearest.x - me.x) - me.yaw;
    const arrow = ['⬆️', '↖️', '⬅️', '↙️', '⬇️', '↘️', '➡️', '↗️'][Math.round((((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 8) % 8];
    bw.style.display = 'block';
    bw.innerHTML = `<span class="arrow">${arrow}</span>💣 granada a ${Math.round(best / 10)}m — corra!`;
  } else bw.style.display = 'none';
}
function feed(html) {
  const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d);
  setTimeout(() => d.remove(), 4500);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
const WICON = { bolt: '⚡', dragon: '🐉', sea: '🌊', lancador: '🔫', estilingue: '🪃', mao: '✊', arco: '🏹', disco: '🥏', knife: '🔪', nade: '💣', lava: '🌋', meteor: '☄️', varinha: '🪄', train: '🚇', crane: '🏗️', wave: '🌊' };

// ---------- jogo ----------
let prevPos = new Map(), acc = 0, last = performance.now(), fpsN = 0, fpsT = performance.now();
function newGame() {
  netMode = false;
  for (const a of avatars.values()) a.remove(); avatars.clear();
  for (const pool of [bulletMeshes, nadeMeshes, smokeMeshes, tombMeshes, pickupMeshes]) { for (const m of pool.values()) removeBulletMesh(m); pool.clear(); }
  buildMap(S.map);
  const isTestRoom = S.map === 'teste', map = MAPS[S.map];
  const wd = mapInfo.world;
  sim = new Sim3D(wd.walls, wd.W, wd.H, Object.assign(simOptions(wd), {
    godIds: S.die === '0' ? ['me'] : [], // "você pode morrer: não" = só você não morre; os bots morrem normal
    magic: S.magic === '1', // modo magia
    mode: isTestRoom ? 'livre' : S.mode, killLimit: Number(S.kills), rounds: Number(S.rounds), hillTarget: Number(S.hill), matchTime: Number(S.mtime),
    params: Object.assign({}, simOptions(wd).params || {}, S.speed !== P.speed ? { speed: S.speed } : {}, S.jumpv !== P.jumpV ? { jumpV: S.jumpv } : {}),
    weapons: (() => { const a = simOptions(wd).weapons || {}, o = {}; for (const k of WEAPON_IDS) o[k] = Object.assign({}, a[k] || {}, (S.wtune || {})[k] || {}); return o; })()
  }));
  void map;
  sim.addPlayer({ id: 'me', name: 'Você', team: 'A', primary: S.weapon, look: normLook(S.look) }); // (o personagem decide a magia)
  const n = isTestRoom ? 0 : Number(S.bots), na = isTestRoom ? 0 : Number(S.allies), names = BOTS.randomNames(n + na);
  // sozinho: os bots usam a mesma arma que você (no multiplayer cada um escolhe a sua)
  for (let i = 0; i < n; i++) sim.addPlayer({ id: 'bot' + i, name: names[i], team: 'B', bot: true, level: S.level, primary: S.weapon });
  for (let i = 0; i < na; i++) sim.addPlayer({ id: 'ally' + i, name: names[n + i], team: 'A', bot: true, level: S.level, primary: S.weapon }); // bots no seu time
  prevPos = new Map(); offlineEndAt = 0; killcam.clear(); tintViewModels('A');
}
let offlineEndAt = 0;
// editor de mapa aberto em outra aba: quando ele muda o rascunho, o mapa daqui é refeito na hora (só fora do multiplayer)
window.addEventListener('storage', (e) => {
  if ((e.key !== 'pb3d_edits' && e.key !== 'pb3d_edits_on') || netMode || !sim) return;
  const me = sim.players.get('me'), keep = me && { x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: me.pitch };
  newGame();
  if (EDIT3D) { EDIT3D.externalChange(); return; }
  const m2 = sim.players.get('me'); if (keep && m2) { Object.assign(m2, keep); m2.vx = m2.vy = m2.vz = 0; }
});
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- multiplayer: entra numa partida em rede (dados vêm do servidor, sem física local) ----------
function enterNetMatch(info) {
  for (const a of avatars.values()) a.remove(); avatars.clear();
  for (const pool of [bulletMeshes, nadeMeshes, smokeMeshes, tombMeshes, pickupMeshes]) { for (const m of pool.values()) removeBulletMesh(m); pool.clear(); }
  buildMap(info.map); // o mundo é montado igual ao do servidor; o que muda (portais, buracos...) vem nos snapshots
  const wd = mapInfo.world;
  sim = new Sim3D(wd.walls, wd.W, wd.H, Object.assign(simOptions(wd), info.rules || {})); // (armas liberadas na sala)
  killcam.clear();
  prevPos = new Map();
  netYaw = 0; netPitch = 0; netFireHeld = false;
  netRecvT = 0; netInterval = 130;
}
const netRemapId = (id) => (id != null && id === myPid ? 'me' : id);
function netRemapEvent(e) {
  const r = Object.assign({}, e);
  if (r.id != null) r.id = netRemapId(r.id);
  if (r.by != null) r.by = netRemapId(r.by);
  if (r.killer != null) r.killer = netRemapId(r.killer);
  if (r.victim != null) r.victim = netRemapId(r.victim);
  return r;
}
// aplica um snapshot do servidor no "sim" local (espelho de dados, sem calcular física aqui)
function applySnapshot(snap, evs) {
  if (!sim) return;
  const now = performance.now();
  const newPrev = new Map();
  for (const p of sim.players.values()) newPrev.set(p.id, [p.x, p.y, p.z]);
  for (const b of sim.bullets) newPrev.set('b' + b.id, [b.x, b.y, b.z]);
  for (const g of sim.nades) newPrev.set('n' + g.id, [g.x, g.y, g.z]);
  prevPos = newPrev;
  sim.time = snap.time;
  const newPlayers = new Map();
  for (const sp of snap.players) {
    const id = netRemapId(sp.id);
    const p = {
      id, name: sp.name, team: sp.team, bot: sp.bot,
      x: sp.x, y: sp.y, z: sp.z, vx: sp.vx, vy: sp.vy, vz: sp.vz,
      yaw: sp.yaw, pitch: sp.pitch, lives: sp.lives, alive: sp.alive,
      weapon: sp.weapon, primary: sp.primary, grounded: sp.grounded,
      ammo: { [sp.primary]: sp.ammo }, mags: { [sp.primary]: sp.mags },
      reloadUntil: sp.reloadUntil, nades: sp.nades, smokes: sp.smokes, potions: sp.potions,
      djReadyAt: sp.djReadyAt, k: sp.k, d: sp.d, a: sp.a, charge0: sp.charge0, nade0: sp.nade0 || 0, fireReady: sp.fireReady,
      protectUntil: sp.protectUntil, respawnAt: sp.respawnAt, deadAt: sp.deadAt, lastHitBy: sp.lastHitBy || {},
      shieldUntil: sp.shield ? snap.time + 1 : 0, shieldHits: sp.shield || 0, gliding: !!sp.gliding, magicReady: sp.magicReady || 0, dashUntil: sp.dash ? snap.time + 0.1 : 0,
      look: sp.look || null, slowUntil: sp.slowUntil || 0, spin: sp.spin, climb: !!sp.climb, sprinting: sp.sprinting, aiming: sp.aiming, aimT0: sp.aimT0 || 0, drinkUntil: sp.drinkUntil || 0, slip: !!sp.slip,
      fp: !!sp.fp, camSide: sp.cs != null ? sp.cs : 1,
      input: { fwd: 0, side: 0, fire: false }
    };
    if (id === 'me') { p.yaw = netYaw; p.pitch = netPitch; }
    newPlayers.set(id, p);
  }
  sim.players = newPlayers;
  sim.bullets = snap.bullets;
  sim.nades = snap.nades;
  sim.smokes = snap.smokes;
  sim.tombs = snap.tombs;
  sim.pickups = snap.pickups;
  sim.hazard = snap.hazard; sim.sandK = snap.sandK; sim.lightOn = snap.lightOn; sim.lightS = snap.lightS || 0;
  sim.lamps = snap.lamps; sim.tornado = snap.tornado; sim.storm = snap.storm; sim.erupt = snap.erupt; sim.train = snap.train; sim.wave = snap.wave; sim.crane = snap.crane || null; sim.dragon = snap.dragon || null; if (snap.sway) sim.swayState = snap.sway;
  if (snap.holes) sim.holes = snap.holes;
  // portais abertos, portas da nave e meteoros (o sim local só espelha)
  const pk = JSON.stringify(snap.portalPairs || null);
  if (pk !== sim._pk) { sim._pk = pk; sim.applyPortalPairs(snap.portalPairs || null); }
  sim.portalN = snap.portalN || 0;
  if (snap.doors) sim.doors.forEach((d, i) => { d.open = snap.doors[i] || 0; });
  sim.doorsT = snap.doorsT || null;
  sim.meteors = snap.meteors || []; sim.meteorFall = snap.meteorFall; sim.ceilHoles = snap.ceilHoles || [];
  sim.lastKill = snap.lastKill || null;
  sim.magic = !!snap.magic; sim.eyes = snap.eyes || []; sim.magicWalls = snap.mwalls || []; // (modo magia)
  for (const k of ['mode', 'phase', 'phaseUntil', 'hzStart', 'score', 'round', 'totalRounds', 'killLimit', 'hillTarget', 'matchTime', 'hill', 'result']) if (snap[k] !== undefined) sim[k] = snap[k];
  const prevRecvT = netRecvT; netRecvT = now;
  if (prevRecvT) netInterval = Math.max(60, Math.min(400, now - prevRecvT));
  killcam.record(sim);
  for (const e of evs || []) handleEvent(netRemapEvent(e), now);
}

// ---------- placar do modo, avisos grandes e a colina ----------
const MODE_NAME = { tdm: 'Mata-mata em equipe', rounds: 'Rounds', ffa: 'Cada um por si', koth: 'Rei da colina', livre: 'Treino livre' };
const TEAM_NAME = { A: 'Azul', B: 'Vermelho' };
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
let lastRoundEnd = null;
function resultText(r) {
  if (!r) return '';
  if (r.mode === 'ffa') {
    const w = r.players && r.players.find((p) => p.id === r.winner);
    return !r.winner ? 'Empate!' : netRemapId(r.winner) === 'me' ? 'Você venceu! 🏆' : `${esc(w ? w.name : '?')} venceu`;
  }
  const sc = r.score ? ` (${Math.floor(r.score.A)} x ${Math.floor(r.score.B)})` : '';
  return r.winner ? `Time ${TEAM_NAME[r.winner]} venceu!${sc}` : `Empate${sc}`;
}
function updateModeHud(me, now) {
  const m = sim.mode, el = sim.time - (sim.hzStart || 0), sc = sim.score || { A: 0, B: 0 };
  const box = $('score');
  if (!m || m === 'livre') box.style.display = 'none';
  else {
    let big = '', small = '';
    const tA = `<span class="tA">Azul ${Math.floor(sc.A)}</span>`, tB = `<span class="tB">${Math.floor(sc.B)} Vermelho</span>`;
    const tleft = sim.matchTime > 0 ? ` · ⏱ ${mmss(sim.matchTime - el)}` : '';
    if (m === 'tdm') { big = `${tA} x ${tB}`; small = `${MODE_NAME.tdm} · até ${sim.killLimit}${tleft}`; }
    else if (m === 'koth') {
      big = `${tA} x ${tB}`;
      const H = sim.hill; small = `${MODE_NAME.koth} · até ${sim.hillTarget}${tleft}` + (H ? (H.pv ? ` · nova colina em ${Math.ceil(H.n)}s` : ` · colina muda em ${Math.ceil(H.n)}s`) : '');
    } else if (m === 'rounds') { big = `Round ${sim.round}/${sim.totalRounds} · ${tA} x ${tB}`; small = sim.phase === 'playing' ? `⏱ ${mmss((sim.roundTime || 120) - el)}` : ''; }
    else if (m === 'ffa') {
      const ranked = [...sim.players.values()].sort((a, b) => b.k - a.k), lead = ranked[0];
      big = `Você: ${me.k} · Líder: ${lead ? (lead.id === 'me' ? 'você' : esc(lead.name)) + ' ' + lead.k : '-'}`; small = `${MODE_NAME.ffa} · até ${sim.killLimit}${tleft}`;
    }
    box.innerHTML = `${big}<small>${small}</small>`; box.style.display = 'block';
  }
  // aviso grande no meio da tela
  const ban = $('banner'); let txt = '';
  if (sim.result) txt = `${resultText(sim.result)}<small>fim da partida${netMode ? ' — voltando pra sala...' : ' — outra partida já vai começar'}</small>`;
  else if (sim.phase === 'countdown') txt = `Round ${sim.round}<small>começa em ${Math.max(1, Math.ceil(sim.phaseUntil - sim.time))}...</small>`;
  else if (sim.phase === 'roundEnd' && lastRoundEnd) txt = `${lastRoundEnd.winner ? 'Time ' + TEAM_NAME[lastRoundEnd.winner] + ' venceu o round' : lastRoundEnd.timeUp ? 'Acabou o tempo — empate' : 'Empate'}<small>Azul ${lastRoundEnd.score.A} x ${lastRoundEnd.score.B} Vermelho</small>`;
  ban.innerHTML = txt; ban.style.display = txt ? 'block' : 'none';
  updateHillFx(sim.hill, sim.hill ? (sim.hill.o !== undefined ? sim.hill.o : sim.hillOwner) : null, now);
}
let hillFx = null;
function updateHillFx(H, owner, now) {
  if (!H) { if (hillFx) { scene.remove(hillFx.g); hillFx = null; } return; }
  if (!hillFx) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(H.r - 7, H.r, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(H.r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = disc.rotation.x = -Math.PI / 2; ring.position.y = 1.4; disc.position.y = 1.2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(H.r, H.r, 160, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 80;
    g.add(ring, disc, beam); scene.add(g);
    hillFx = { g, ring, disc, beam };
  }
  const col = owner === 'A' ? TEAM.A : owner === 'B' ? TEAM.B : owner === 'X' ? 0xfacc15 : 0xffffff;
  hillFx.g.position.set(H.x, groundY(H.x, H.z), H.z);
  for (const o of [hillFx.ring, hillFx.disc, hillFx.beam]) o.material.color.set(col);
  const blink = H.pv ? (Math.floor(now / 200) % 2 ? 0.25 : 0.9) : 0.8;
  hillFx.ring.material.opacity = blink; hillFx.disc.material.opacity = H.pv ? 0.05 : 0.14;
}

// ---------- killcam final: só a última kill do round/partida, pelos olhos de quem matou ----------
// grava os últimos segundos; no fim do round/partida repete a última kill, com câmera lenta e efeito de lente
// (zoom, distorção, cor separando nas bordas, vinheta e granulado) no finalzinho, perto do tiro acertar
// pre = quanto antes do abate começa; post = quanto depois termina; chase = quanto depois do disparo a câmera sai atrás do tiro
// chaseReal = duração máxima (em segundos de verdade) da câmera seguindo o tiro em câmera lenta
const KC = { pre: 1.6, post: 0.7, slowFrom: 0.5, slowTo: 0.35, slow: 0.3, wait: 1600, lead: 1.0, chase: 0.1, chaseReal: 2.4, blend: 0.4 }; // wait = espera depois do abate antes de entrar
const killcam = {
  buf: [], active: null, pool: new Map(), lensK: 0,
  clear() { this.buf = []; this.stop(); },
  record(sim) {
    if (this.active) return; // durante o replay não grava (senão apaga o que está passando)
    const last = this.buf[this.buf.length - 1];
    if (last && sim.time - last.t < 1 / 70) return;
    if (last && sim.time < last.t) this.buf = [];
    const pl = new Map();
    for (const p of sim.players.values()) pl.set(p.id, [p.x, p.y, p.z, p.yaw, p.pitch, p.alive, sim.radius(p) / P.radius, p.primary, p.id === 'me' ? S.cam === '1' : !!p.fp]);
    this.buf.push({ t: sim.time, pl, b: sim.bullets.map((b) => [b.id, b.x, b.y, b.z, b.team, b.kind, b.vx, b.vy, b.vz, b.r]) });
    while (this.buf.length && sim.time - this.buf[0].t > 6) this.buf.shift();
  },
  // lk = { killer, victim, t, bid, bt0, fp } (última kill); só se a kill ainda estiver gravada
  startFinal(lk, now) {
    if (S.kc !== '1' || !lk || !lk.killer || this.buf.length < 6) return false;
    const killer = netRemapId(lk.killer), victim = netRemapId(lk.victim);
    if (!this.buf.some((f) => f.pl.has(killer)) || this.buf[0].t > lk.t - 0.2 || this.buf[this.buf.length - 1].t < lk.t - 0.05) return false;
    const kp = sim.players.get(killer), vp = sim.players.get(victim);
    // o tiro que matou está gravado? então a killcam começa antes dele sair e depois segue ele
    let bid = lk.bid != null && this.buf.some((f) => f.b.some((q) => q[0] === lk.bid)) ? lk.bid : null;
    const bt0 = bid != null && Number.isFinite(lk.bt0) ? lk.bt0 : null;
    if (bt0 == null) bid = null;
    const flight = bid != null ? Math.max(0.05, lk.t - bt0) : 0;
    const t0 = Math.max(this.buf[0].t, bid != null ? Math.min(lk.t - KC.pre, bt0 - KC.lead) : lk.t - KC.pre);
    // câmera de quem atirou: 1ª ou 3ª pessoa, a que ele estava usando na hora (bot = 3ª pessoa)
    const s1 = this.sample(bid != null ? bt0 : lk.t - 0.05), kr = s1.pl.get(killer);
    const fp = lk.fp != null ? !!lk.fp : !!(kr && kr[8]);
    this.active = { killer, victim, kt: lk.t, simT: t0, to: Math.min(this.buf[this.buf.length - 1].t, lk.t + KC.post), last: now,
      bid, bt0, fp, slow: bid != null ? Math.max(KC.slow, flight / KC.chaseReal) : KC.slow, blend: 0.4, chaseK: 0, bpos: null, bdir: null, shot: false, kteam: kp ? kp.team : 'A' };
    // pose do alvo na hora do tiro e de que lado veio o tiro (pra ele cair pro lado certo)
    const s0 = this.sample(lk.t - 0.03), vpos = s0.pl.get(victim), kpos = s0.pl.get(killer);
    let fdx = 0, fdz = 0;
    if (bid != null) { for (const f of this.buf) { if (f.t > lk.t + 0.02) break; const q = f.b.find((q2) => q2[0] === bid); if (q) { fdx = q[6]; fdz = q[8]; } } }
    if (!fdx && !fdz && vpos && kpos) { fdx = vpos[0] - kpos[0]; fdz = vpos[2] - kpos[2]; }
    if (vpos) { const l = Math.hypot(fdx, fdz) || 1; this.active.vpose = vpos; this.active.fall = [fdx / l, fdz / l]; }
    this.active.blend = Math.max(0.12, Math.min(KC.blend, (flight - KC.chase) / this.active.slow * 0.45)); // tiro curtinho: a câmera sai atrás dele mais rápido
    tintViewModels(this.active.kteam);
    $('kc').style.display = 'block';
    $('kc-who').innerHTML = `${kp ? `<span class="t${kp.team}">${esc(kp.name)}</span>` : '?'} ➜ ${vp ? `<span class="t${vp.team}">${esc(vp.name)}</span>` : '?'}`;
    return true;
  },
  stop() {
    if (!this.active) return;
    this.active = null; this.lensK = 0; $('kc').style.display = 'none';
    for (const m of this.pool.values()) removeBulletMesh(m); this.pool.clear();
    for (const a of avatars.values()) { a.model.scale.setScalar(a.baseScale); a.root.quaternion.identity(); a.setGrey(false); }
    const me = sim && sim.players.get('me'); if (me) tintViewModels(me.team);
  },
  // quadro no tempo t, interpolando entre 2 gravações (fica liso mesmo em câmera lenta)
  sample(t) {
    const B = this.buf; let i = 0;
    while (i < B.length - 1 && B[i + 1].t <= t) i++;
    const f0 = B[i], f1 = B[Math.min(B.length - 1, i + 1)], k = f1.t > f0.t ? Math.max(0, Math.min(1, (t - f0.t) / (f1.t - f0.t))) : 0;
    const pl = new Map();
    for (const [id, a] of f0.pl) {
      const b = f1.pl.get(id);
      if (!b || !a[5] || !b[5] || Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2]) > 150) { pl.set(id, a); continue; }
      let dy = b[3] - a[3]; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      pl.set(id, [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + dy * k, a[4] + (b[4] - a[4]) * k, a[5], a[6], a[7], a[8]]);
    }
    const nb = new Map(); for (const q of f1.b) nb.set(q[0], q);
    const bl = f0.b.map((q) => { const r = nb.get(q[0]); if (!r || Math.abs(q[1] - r[1]) + Math.abs(q[3] - r[3]) > 150) return q; return [q[0], q[1] + (r[1] - q[1]) * k, q[2] + (r[2] - q[2]) * k, q[3] + (r[3] - q[3]) * k, q[4], q[5], q[6], q[7], q[8], q[9]]; });
    return { pl, b: bl };
  },
  // aplica o replay (chamado logo antes de desenhar)
  apply(now) {
    const A = this.active; if (!A) return false;
    const dt = Math.min(0.1, (now - A.last) / 1000); A.last = now;
    // velocidade do replay: normal até o tiro sair; câmera lenta seguindo o tiro até um pouco depois de acertar
    let spd = 1;
    if (A.bid != null) { if (A.simT >= A.bt0 + KC.chase * 0.5 && A.simT < A.kt + KC.slowTo) spd = A.slow; }
    else if (A.simT > A.kt - KC.slowFrom && A.simT < A.kt + KC.slowTo) spd = KC.slow;
    A.simT += dt * spd;
    if (A.simT > A.to) { this.stop(); return false; }
    // lente: entra um pouco antes do tiro acertar, fica no ápice e sai depois
    const d = A.simT - A.kt, want = d < -0.75 ? 0 : d < -0.35 ? (d + 0.75) / 0.4 : d < 0.25 ? 1 : Math.max(0, 1 - (d - 0.25) / 0.2);
    this.lensK += (want - this.lensK) * Math.min(1, dt * 10);
    const f = this.sample(A.simT);
    const chasing = A.bid != null && A.simT >= A.bt0 + KC.chase;
    if (chasing) A.chaseK = Math.min(1, A.chaseK + dt / A.blend);
    const fpView = A.fp && A.chaseK < 0.5; // em 1ª pessoa o corpo de quem atirou não aparece (até a câmera sair atrás do tiro)
    for (const [id, a] of avatars) {
      let r = f.pl.get(id);
      const falling = id === A.victim && A.vpose && A.simT >= A.kt;
      if (falling) r = A.vpose; // o alvo não some: fica cinza e cai pro lado contrário do tiro
      if (!r) { a.root.visible = false; continue; }
      a.root.position.set(r[0], r[1], r[2]); a.model.rotation.y = Math.atan2(Math.cos(r[3]), Math.sin(r[3]));
      a.root.visible = (r[5] || falling) && !(id === A.killer && fpView); a.model.scale.setScalar(a.baseScale * r[6]);
      if (a.label) a.label.visible = false; a.ring.visible = false;
      if (falling) {
        const u = Math.min(1, (A.simT - A.kt) / 0.45), e = u * u * (3 - 2 * u);
        _kcAxis.set(A.fall[1], 0, -A.fall[0]); a.root.quaternion.setFromAxisAngle(_kcAxis, e * Math.PI / 2);
        a.root.position.y = r[1] - 4 * e; a.setGrey(true);
      } else { a.root.quaternion.identity(); a.setGrey(false); }
    }
    for (const m of tombMeshes.values()) m.visible = false; // sem lápide na killcam
    const seen = new Set();
    let kb = null;
    for (const b of f.b) {
      seen.add(b[0]);
      if (b[0] === A.bid) kb = b;
      let m = this.pool.get(b[0]); if (!m) { m = makeBullet({ team: b[4], kind: b[5], r: b[9] }); scene.add(m); this.pool.set(b[0], m); }
      m.position.set(b[1], b[2], b[3]); if (m.userData.orient) m.lookAt(b[1] + b[6], b[2] + b[7], b[3] + b[8]);
      if (m.userData.bolt) m.userData.bolt(now, b[1], b[2], b[3]);
      updateTrail(m, b[4], b[1], b[2], b[3]);
    }
    for (const [id, m] of this.pool) if (!seen.has(id)) { removeBulletMesh(m); this.pool.delete(id); }
    const k = f.pl.get(A.killer);
    // o boneco de quem atirou faz a animação do tiro quando o replay passa pelo disparo
    if (A.bid != null && !A.shot && A.simT >= A.bt0) { A.shot = true; const ka = avatars.get(A.killer), s = k && SHOOT_ANIM[k[7]]; if (ka && s) ka.trigger(s[0], s[1], now); }
    if (k) {
      const dx = Math.cos(k[4]) * Math.cos(k[3]), dy = Math.sin(k[4]), dz = Math.cos(k[4]) * Math.sin(k[3]);
      // 1) câmera de quem atirou (a mesma que ele usava)
      let cp;
      if (A.fp) cp = [k[0], k[1] + P.eye * k[6], k[2]];
      else cp = thirdCam(k[0], k[1], k[2], k[3], k[4], A.killer);
      let px = cp[0], py = cp[1], pz = cp[2], lx = px + dx * 100, ly = py + dy * 100, lz = pz + dz * 100;
      // 2) depois do disparo: sai atrás do tiro, em câmera lenta
      if (A.bid != null && A.chaseK > 0) {
        if (kb) {
          const vl = Math.hypot(kb[6], kb[7], kb[8]) || 1, nd = [kb[6] / vl, kb[7] / vl, kb[8] / vl];
          if (!A.bdir) A.bdir = nd.slice();
          else { const s = Math.min(1, dt * 7); for (let i = 0; i < 3; i++) A.bdir[i] += (nd[i] - A.bdir[i]) * s; } // curva suave quando ricocheteia
          A.bpos = [kb[1], kb[2], kb[3]]; A.bkind = kb[5];
        }
        if (A.bpos && A.bdir) {
          const bd = A.bdir, bl = Math.hypot(bd[0], bd[1], bd[2]) || 1, ux = bd[0] / bl, uy = bd[1] / bl, uz = bd[2] / bl;
          const sx = -uz, sz = ux, sl = Math.hypot(sx, sz) || 1; // lado
          const big = A.bkind === 'varinha', bk = big ? 95 : 60, sd = big ? 34 : 16, up = big ? 24 : 15; // o raio da varinha é comprido: a câmera fica mais de lado
          let cx = A.bpos[0] - ux * bk + sx / sl * sd, cy = A.bpos[1] - uy * bk + up, cz = A.bpos[2] - uz * bk + sz / sl * sd;
          let tx = A.bpos[0] + ux * 90, ty = A.bpos[1] + uy * 90, tz = A.bpos[2] + uz * 90;
          // acertou: a câmera para e olha o alvo caindo
          if (A.simT >= A.kt && A.vpose) { const u = Math.min(1, (A.simT - A.kt) / 0.3); tx = lerp(tx, A.vpose[0], u); ty = lerp(ty, A.vpose[1] + 30, u); tz = lerp(tz, A.vpose[2], u); }
          if (sim.ceilingY != null) cy = Math.min(cy, sim.ceilingY - 10);
          cy = Math.max(cy, groundY(cx, cz) + 6);
          const e = A.chaseK * A.chaseK * (3 - 2 * A.chaseK);
          px = lerp(px, cx, e); py = lerp(py, cy, e); pz = lerp(pz, cz, e); lx = lerp(lx, tx, e); ly = lerp(ly, ty, e); lz = lerp(lz, tz, e);
        }
      }
      camera.position.set(px, py, pz);
      camera.lookAt(lx, ly, lz);
      camera.fov = S.fov * (1 - 0.3 * this.lensK); // zoom da lente
      camera.updateProjectionMatrix();
    }
    // 1ª pessoa: a arma de quem atirou aparece na tela até a câmera sair atrás do tiro
    for (const k2 in VIEW) VIEW[k2].visible = !!(k && fpView && k2 === k[7]);
    if (k && fpView && VIEW[k[7]]) { const vg = VIEW[k[7]], base = k[7] === 'arco' ? [6.5, -7.5, -22] : [8, -8, -22]; vg.position.set(base[0], base[1], base[2]); vg.rotation.x = 0; }
    for (const id of ['cross', 'banner', 'dead', 'score', 'bombwarn']) $(id).style.display = 'none';
    return true;
  }
};
const _kcAxis = new THREE.Vector3();
// passada de "lente de câmera" (só na killcam final)
const lensRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
const lensMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: lensRT.texture }, uK: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uK; uniform float uTime; uniform float uAspect; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 3.7) * 43758.5453); }
  void main(){
    vec2 c = vUv - 0.5; c.x *= uAspect; float r2 = dot(c, c);
    vec2 d = c * (1.0 + uK * 0.28 * r2); d.x /= uAspect;           // distorção de lente (barril)
    vec2 uv = 0.5 + d;
    float ca = uK * 0.0035 * (0.3 + r2 * 3.0);                        // cor separando só um pouquinho nas bordas
    vec3 col = vec3(texture2D(tDiffuse, uv + d * ca * 8.0).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ca * 8.0).b);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(lum) * vec3(1.05, 1.0, 0.92), uK * 0.25);     // um pouco sem cor
    col *= 1.0 - uK * 0.8 * smoothstep(0.38, 1.05, length(c));        // borda escura, aberta e suave
    col += (h(vUv * 800.0) - 0.5) * 0.02 * uK;                          // granulado bem leve
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
  depthTest: false, depthWrite: false
});
const lensScene = new THREE.Scene(), lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
{ const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat); q.frustumCulled = false; lensScene.add(q); }
function renderFP() {
  let any = false; for (const k in VIEW) if (VIEW[k].visible) { any = true; break; }
  if (!any) return;
  if (fpCam.aspect !== camera.aspect) { fpCam.aspect = camera.aspect; fpCam.updateProjectionMatrix(); }
  // distância da arma (configuração): afasta/aproxima a arma da câmera sem mudar onde ela aparece na tela
  const gk = Math.max(0.6, Math.min(1.5, (Number(S.gunDist) || 100) / 100)), moved = [];
  for (const k in VIEW) { const g = VIEW[k]; if (g.visible) { moved.push([g, g.position.clone()]); g.position.multiplyScalar(gk); } }
  fpHemi.color.copy(hemi.color); fpHemi.groundColor.copy(hemi.groundColor); fpHemi.intensity = Math.min(1.5, Math.max(0.6, hemi.intensity));
  fpSun.color.copy(sun.color); fpSun.intensity = Math.min(1.8, Math.max(0.55, sun.intensity * 0.7));
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(fpScene, fpCam); renderer.autoClear = ac;
  for (const [g, p] of moved) g.position.copy(p);
}
function renderWithLens(k, now) {
  const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v);
  if (lensRT.width !== v.x || lensRT.height !== v.y) lensRT.setSize(v.x, v.y);
  renderer.setRenderTarget(lensRT); renderer.render(scene, camera); renderFP(); renderer.setRenderTarget(null);
  lensMat.uniforms.uK.value = k; lensMat.uniforms.uTime.value = now / 1000; lensMat.uniforms.uAspect.value = v.x / v.y;
  renderer.render(lensScene, lensCam);
}
// ping do multiplayer + onde fica o servidor (mostra no Tab)
let netPing = null, netLoc = null;
setInterval(() => {
  if (!socket || !socket.connected || !room3d) return;
  const t0 = performance.now();
  socket.emit('3d_ping', null, (r) => { netPing = Math.round(performance.now() - t0); if (r && r.loc) netLoc = r.loc; });
}, 2000);

// ---------- pulo duplo pronto: botinhas douradas brilhando + rastro curtinho de pegadas douradas (só as suas) ----------
let jumpFx = null;
const STEP_TEX = canvasTex(32, 64, (g) => { const grd = g.createRadialGradient(16, 30, 2, 16, 30, 16); grd.addColorStop(0, 'rgba(255,250,210,1)'); grd.addColorStop(0.55, 'rgba(255,214,80,1)'); grd.addColorStop(1, 'rgba(255,190,40,0)'); g.fillStyle = grd; g.beginPath(); g.ellipse(16, 38, 10, 20, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(16, 12, 8, 9, 0, 0, 7); g.fill(); });
function updateJumpGlow(me, now, dt) {
  if (!jumpFx) {
    const prints = []; for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), new THREE.MeshBasicMaterial({ map: STEP_TEX, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); prints.push({ m, t: -1e9 }); }
    const boots = [0, 1].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffcc33, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(16); scene.add(sp); return sp; });
    jumpFx = { prints, boots, k: 0, last: null, side: 1, n: 0 };
  }
  const F = jumpFx, ready = me.alive && sim.time >= (me.djReadyAt || 0) && !killcam.active;
  F.k += ((ready ? 1 : 0) - F.k) * Math.min(1, dt * 6);
  for (const sp of F.boots) sp.visible = false; // (sem brilho na bota: só as pegadas)
  // pegadas: uma a cada passo, somem rapidinho
  if (ready && me.grounded && Math.hypot(me.vx, me.vz) > 40) {
    if (!F.last || Math.hypot(me.x - F.last[0], me.z - F.last[1]) > 21) {
      const q = F.prints[F.n++ % F.prints.length], yaw = Math.atan2(me.vz, me.vx), sx = -Math.sin(yaw) * 4.5 * F.side, sz = Math.cos(yaw) * 4.5 * F.side;
      q.m.position.set(me.x + sx, me.y + 0.9, me.z + sz); q.m.rotation.z = -yaw - Math.PI / 2; q.t = now; q.m.visible = true; F.side = -F.side; F.last = [me.x, me.z];
    }
  } else if (!me.grounded) F.last = null;
  for (const q of F.prints) { if (!q.m.visible) continue; const u = (now - q.t) / 750; if (u >= 1) { q.m.visible = false; continue; } q.m.material.opacity = 1 - u * u; }
}
// quanto do corpo dá pra ver da câmera (0..1): 5 pontos do pé à cabeça; atualiza a cada 0,12 s por boneco
const _visCache = new Map();
function bodyVisible(p, now) {
  if (p.id === 'me') return 1;
  const c = _visCache.get(p.id); if (c && now - c.t < 120) return c.v;
  const cp = camera.position, h = sim.heightOf(p), n = 5; let ok = 0;
  for (let i = 0; i < n; i++) { const y = p.y + h * (0.08 + 0.84 * i / (n - 1)); if (!sim.segBlocked(cp.x, cp.y, cp.z, p.x, y, p.z)) ok++; }
  const v = ok / n; _visCache.set(p.id, { t: now, v }); return v;
}
// quem está debaixo da mira (pra mostrar o nome nos mapas escuros)
const _cdir = new THREE.Vector3();
function aimedPlayer() {
  camera.getWorldDirection(_cdir);
  const o = camera.position, dx = _cdir.x, dy = _cdir.y, dz = _cdir.z;
  const best = sim.raycast(o.x, o.y, o.z, dx, dy, dz, 4000, 'me');
  let id = null;
  for (const q of sim.players.values()) {
    if (q.id === 'me' || !q.alive) continue;
    const r = sim.radius(q), h = sim.heightOf(q), fx = o.x - q.x, fz = o.z - q.z;
    const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c;
    if (a < 1e-9 || disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a), y = o.y + dy * t;
    if (t > 0 && Math.abs(t - best) < 3 && y >= q.y && y <= q.y + h) id = q.id;
  }
  return id;
}
// está na luz? (sala escura com a luz acesa; cidade: perto de um poste aceso ou bem perto de você)
function litAt(p) {
  if (mapInfo.mapId === 'escuro') return sim.lightS === 0;
  const me = sim.players.get('me');
  if (me && Math.hypot(me.x - p.x, me.z - p.z) < 110) return true;
  for (const L of sim.lamps || []) if (sim.time >= L.offUntil && Math.hypot(L.x + (L.dx != null ? L.dx : 1) * LAMP.off - p.x, L.z + (L.dz || 0) * LAMP.off - p.z) < 230) return true;
  return false;
}
// granada/fumaça na mão: mostra o arco que ela vai fazer e a área da explosão onde ela vai parar
let nadePrev = null;
function updateNadePreview(me) {
  const show = me && me.alive && locked && !killcam.active && (me.weapon === 'nade' || me.weapon === 'smoke');
  if (!show) { if (nadePrev) nadePrev.g.visible = false; return; }
  if (!nadePrev) {
    const g = new THREE.Group(), N = 64;
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const line = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xffe066, dashSize: 10, gapSize: 7, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false }));
    line.frustumCulled = false; line.renderOrder = 5; g.add(line);
    const dots = []; for (let i = 0; i < 14; i++) { const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffe066, transparent: true, opacity: 0.45, depthWrite: false, depthTest: false })); d.scale.setScalar(6); d.renderOrder = 5; g.add(d); dots.push(d); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; g.add(disc);
    scene.add(g); nadePrev = { g, line, ring, disc, N, dots };
  }
  const smoke = me.weapon === 'smoke', pts = sim.predictNade(me, smoke, sim.nadeK(me)), F = nadePrev, arr = F.line.geometry.attributes.position.array;
  for (let i = 0; i < F.N; i++) { const q = pts[Math.min(pts.length - 1, i)]; arr[i * 3] = q[0]; arr[i * 3 + 1] = q[1]; arr[i * 3 + 2] = q[2]; }
  F.line.geometry.attributes.position.needsUpdate = true; F.line.computeLineDistances();
  F.dots.forEach((d, i) => { const q = pts[Math.min(pts.length - 1, Math.round((i + 1) / F.dots.length * (pts.length - 1)))]; d.position.set(q[0], q[1], q[2]); });
  const end = pts.end || pts[pts.length - 1], R = smoke ? P.smokeRadius * 0.55 : P.nadeRadius, col = smoke ? 0xcbd5e1 : 0xff5a3c;
  for (const m of [F.ring, F.disc]) { m.position.set(end[0], groundY(end[0], end[2]) + 1.3, end[2]); m.scale.setScalar(R); m.material.color.set(col); }
  F.g.visible = true;
}
// barra de força do tiro mirando (embaixo da mira)
function drawPowerBar(ctx, k) {
  const w = 86, h = 7, x = 120 - w / 2, y = 120 + 40;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#facc15'); g.addColorStop(1, '#f97316');
  ctx.fillStyle = g; ctx.fillRect(x, y, w * k, h);
  if (k >= 1) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2); }
  ctx.font = '700 10px Segoe UI, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.textAlign = 'center'; ctx.fillText(k >= 1 ? 'FORÇA MÁXIMA' : 'FORÇA', 120, y + h + 12);
}
// 1ª pessoa bebendo: leva a garrafa à boca, inclina, o líquido acaba e abaixa (u = 0..1; -1 = só segurando)
function updatePotionView(vg, u, now) {
  const e = (a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));
  const raise = u < 0 ? 0 : e(0, 0.22) * (1 - e(0.82, 1)), tilt = u < 0 ? 0 : e(0.15, 0.4) * (1 - e(0.8, 0.95));
  vg.position.set(lerp(7, 1.5, raise), lerp(-8, -6.5, raise) + (u < 0 ? Math.sin(now / 400) * 0.3 : 0), lerp(-20, -17, raise));
  vg.rotation.set(tilt * 1.2, 0, lerp(0.15, -0.1, raise)); vg.scale.setScalar(0.8);
  vg.traverse((o) => {
    if (o.userData.liquid) { const left = u < 0 ? 1 : 1 - e(0.3, 0.8); o.scale.set(1, Math.max(0.05, left), 1); o.visible = left > 0.06; }
    if (o.userData.cork) o.visible = u < 0 || u < 0.12;
  });
}
// tamanho que aparece na tela: vai até o tamanho de verdade com animação (não "pisca" grande/pequeno)
const _dispSc = new Map();
function dispScale(p, dt) {
  const want = sim.radius(p) / P.radius;
  let cur = _dispSc.get(p.id);
  if (cur == null || !p.alive) cur = want;
  else if (dt > 0) cur = want > cur ? Math.min(want, cur + dt * 1.15) : Math.max(want, cur - dt * 2.2); // cresce em ~0,3 s, diminui em ~0,15 s
  if (dt > 0 || !_dispSc.has(p.id)) _dispSc.set(p.id, cur);
  return cur;
}
// câmera de 3ª pessoa (atrás do ombro, sem atravessar muro nem passar do teto) — usada no jogo e na killcam
let thirdCamD = 999, camSideSm = null, camSideT = 0; // (câmera muito colada no boneco: esconde o seu boneco pra não tampar a tela)
function thirdCam(x, y, z, yaw, pitch, ignoreId, sideOv) {
  const dx = Math.cos(pitch) * Math.cos(yaw), dy = Math.sin(pitch), dz = Math.cos(pitch) * Math.sin(yaw);
  // distância e lado (ombro direito/esquerdo/meio) vêm das configurações (espectador: o ombro de quem você assiste)
  // (v0.28) com FOV maior a câmera chega mais perto: o boneco fica do mesmo tamanho na tela
  const fovK = Math.tan(40 * Math.PI / 180) / Math.tan(Math.max(50, Math.min(120, Number(S.fov) || 80)) * Math.PI / 360);
  const side = Number(sideOv != null ? sideOv : S.camSide), shT = 30 * (Number.isFinite(side) ? side : 1);
  // (v0.31) a sua câmera desliza pro outro ombro (Alt esquerdo) em vez de pular
  let sh0 = shT; if (ignoreId === 'me') { const t = performance.now(), k = Math.min(1, (t - (camSideT || t)) / 1000 * 9); camSideT = t; camSideSm = camSideSm == null ? shT : camSideSm + (shT - camSideSm) * k; sh0 = Math.abs(camSideSm - shT) < 0.3 ? shT : camSideSm; }
  const want = Math.max(50, Math.min(300, Number(S.camDist) || 150)) * fovK;
  const hx = x, hy = y + 60 + (sh0 === 0 ? 14 : 0), hz = z, rx = -Math.sin(yaw), rz = Math.cos(yaw);
  // (v0.30) encostado numa parede do lado do ombro: o ombro da câmera encolhe (senão a câmera ia pra dentro/atrás da parede e ela sumia)
  let sh = sh0; if (sh0) { const hs = sim.raycast(hx, hy, hz, rx * Math.sign(sh0), 0, rz * Math.sign(sh0), Math.abs(sh0) + 14, ignoreId); sh = Math.sign(sh0) * Math.max(0, Math.min(Math.abs(sh0), hs - 14)); }
  const bx = -dx, by = -dy * 0.9 + 0.18 + (sh0 === 0 ? 0.08 : 0), bz = -dz, bl = Math.hypot(bx, by, bz);
  const hit = sim.raycast(hx + rx * sh, hy, hz + rz * sh, bx / bl, by / bl, bz / bl, want, ignoreId);
  const d = Math.max(3, Math.min(want, hit - 10)); // (nunca atrás da parede: chega perto do boneco se precisar)
  if (ignoreId === 'me') thirdCamD = d;
  const cy2 = sim.ceilingY != null ? sim.ceilingY - 12 : 1e9;
  return [hx + rx * sh + bx / bl * d, Math.min(cy2, Math.max(10, hy + by / bl * d)), hz + rz * sh + bz / bl * d];
}
// ---------- (v0.31) espectador: morreu no modo rounds -> assiste quem ainda está vivo ----------
// bot = 3ª pessoa; jogador de verdade = a câmera que ele está usando (1ª ou 3ª pessoa, no mesmo ombro)
// Clique = próximo · Botão direito = anterior (primeiro os do seu time; se não sobrou ninguém do time, qualquer um)
const SPEC_DELAY = 1.4; // segundos vendo a própria lápide antes de ir pro espectador
const spec = { id: null, want: null, fp: false, yaw: 0, pitch: 0, lx: null, lz: null, tag: '' };
const isViewer = (id) => id === 'me' || (spec.id != null && spec.fp && id === spec.id); // de quem é a arma na tela
function specOn(me) { return !!(sim && me) && sim.mode === 'rounds' && !me.alive && sim.time - (me.deadAt || 0) > SPEC_DELAY && !killcam.active && !EDIT3D; }
function specList(me) {
  const all = [...sim.players.values()].filter((p) => p.id !== 'me' && p.alive), mine = all.filter((p) => p.team === me.team);
  return mine.length ? mine : all;
}
function specNext(dir) {
  const me = sim && sim.players.get('me'); if (!specOn(me)) return false;
  const L = specList(me); if (!L.length) return true;
  const i = L.findIndex((p) => p.id === spec.id);
  spec.want = L[((i < 0 ? 0 : i + dir) % L.length + L.length) % L.length].id;
  return true;
}
function updateSpec(me, dtR) {
  const off = () => { if (spec.id != null || spec.tag) { spec.id = null; spec.want = null; spec.fp = false; spec.tag = ''; $('spec').style.display = 'none'; } return null; };
  if (!specOn(me)) { spec.lx = spec.lz = null; return off(); }
  const L = specList(me); if (!L.length) return off();
  let t = L.find((p) => p.id === spec.want) || L.find((p) => p.id === spec.id);
  if (!t) { // começou agora (ou quem você assistia morreu): o mais perto de onde estava a câmera
    const ox = spec.lx != null ? spec.lx : me.x, oz = spec.lz != null ? spec.lz : me.z, d2 = (p) => (p.x - ox) ** 2 + (p.z - oz) ** 2;
    t = L.reduce((a, b) => (d2(b) < d2(a) ? b : a));
  }
  if (t.id !== spec.id) { spec.id = t.id; spec.yaw = t.yaw; spec.pitch = t.pitch; }
  spec.want = t.id; spec.lx = t.x; spec.lz = t.z;
  spec.fp = !t.bot && !!t.fp;
  // mira macia (no online a mira dos outros chega umas 8 vezes por segundo)
  const k = Math.min(1, dtR * (netMode ? 14 : 30)); let dy = t.yaw - spec.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  spec.yaw += dy * k; spec.pitch += (t.pitch - spec.pitch) * k;
  const n = L.length, tag = `👁 Assistindo <span class="t${t.team}">${esc(t.name)}</span>${t.bot ? ' (bot)' : ''} · ${spec.fp ? '1ª' : '3ª'} pessoa<small>${n > 1 ? `Clique = próximo · Botão direito = anterior (${n} vivos)` : 'último vivo'}</small>`;
  if (tag !== spec.tag) { spec.tag = tag; $('spec').innerHTML = tag; }
  $('spec').style.display = menuOpen ? 'none' : 'block';
  return t;
}
function frame(now) {
  drawLookPreview(now);
  const dtR = Math.min(0.1, (now - last) / 1000);
  acc += dtR; last = now;
  const me = sim.players.get('me');
  if (!me) { requestAnimationFrame(frame); return; } // multiplayer: ainda não estou numa partida (na sala de espera)
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), sd = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  me.input.fwd = locked ? f : 0; me.input.side = locked ? sd : 0;
  me.input.sprint = locked && !!(keys.ShiftLeft || keys.ShiftRight); // Shift = correr (sem atirar)
  me.input.aim = locked && aimHeld; // botão direito = mirar
  me.input.glide = locked && !!keys.Space; // (modo magia: segurando Espaço no ar = vassoura)
  me.fp = S.cam === '1'; // (killcam: começa na mesma câmera que você estava)
  if (!locked) me.input.fire = false;
  if (netMode) {
    $('paused-tag').style.display = 'none'; // online: nunca pausa
    me.yaw = netYaw; me.pitch = netPitch;
    if (locked && socket && now - netInputT > 50) {
      netInputT = now;
      socket.emit('3d_input', { fwd: me.input.fwd, side: me.input.side, fire: netFireHeld, sprint: me.input.sprint, aim: me.input.aim, glide: me.input.glide, yaw: netYaw, pitch: netPitch, fp: S.cam === '1', cs: Number(S.camSide) || 0 });
    }
  } else {
    // sozinho: com o menu (Esc) aberto o jogo fica pausado (no online nunca pausa)
    const paused = menuOpen && S.pause !== '0' && !EDIT3D && !killcam.active;
    $('paused-tag').style.display = paused ? '' : 'none';
    if (paused) { acc = 0; if (offlineEndAt) offlineEndAt += dtR * 1000; }
    while (acc >= STEP) {
      prevPos = new Map();
      for (const p of sim.players.values()) prevPos.set(p.id, [p.x, p.y, p.z]);
      for (const b of sim.bullets) prevPos.set('b' + b.id, [b.x, b.y, b.z]);
      for (const g of sim.nades) prevPos.set('n' + g.id, [g.x, g.y, g.z]);
      const evs = sim.step(STEP);
      killcam.record(sim);
      for (const e of evs) handleEvent(e, now);
      acc -= STEP;
    }
    if (offlineEndAt && now > offlineEndAt && !killcam.active) { newGame(); requestAnimationFrame(frame); return; } // acabou a partida: começa outra
  }
  const k = netMode ? Math.min(1, (now - netRecvT) / netInterval) : acc / STEP;
  // (passou por portal = pulo grande: não suaviza, senão risca o mapa)
  const ip = (id, o) => { const p0 = prevPos.get(id); return p0 && Math.abs(p0[0] - o.x) + Math.abs(p0[2] - o.z) < 150 ? [lerp(p0[0], o.x, k), lerp(p0[1], o.y, k), lerp(p0[2], o.z, k)] : [o.x, o.y, o.z]; };
  const firstPerson = S.cam === '1';
  // tempestade de areia (deserto): igual à versão antiga — a areia fecha a neblina no mapa todo (não deixa lento)
  if (sim.hazard === 'sand' && scene.fog) {
    const sk = sim.sandK || 0;
    scene.fog.color.set(sk > 0.01 ? 0xd8b878 : 0xdcc9a2);
    scene.fog.near = lerp(2000, 120, sk); scene.fog.far = lerp(7600, 700, sk);
  }
  // luz do ambiente: sala escura (pisca 1 s e apaga)
  let lk = 1;
  if (sim.hazard === 'dark') {
    const on = sim.lightS === 1 ? Math.random() < 0.45 : sim.lightS !== 2;
    lk = on ? 1 : 0.035;
    for (const m of ceilLights) m.emissiveIntensity = on ? 1.4 : 0;
    for (const l of ceilPoints) l.intensity = on ? 42000 : 0;
  }
  hemi.intensity = baseLight.hemi * lk; sun.intensity = baseLight.sun * lk;
  // furacão (floresta), tempestade congelante (neve), portais, portas e meteoros (nave)
  updateTornadoFx(sim.tornado, now, dtR);
  if (mapInfo && mapInfo.mapId === 'castelo') updateDragonFx(now, dtR);
  if (shipFx) updateShipFx(now, dtR);
  updateStormFx(sim.storm, now, dtR);
  updateMagicFx(now);
  updatePortalViews(dtR); updateDoors(); updateMeteorFx(now, dtR); updateMetroFx(now); updateSeaFx(now, dtR); updateObraFx(now, dtR); updateFactoryFx(dtR);
  // vulcão: quando a erupção abre um buraco novo, refaz o chão
  if (volcano) {
    if (sim.holes && sim.holes.length !== volcano.holeCount) rebuildVolcanoHoles(sim.holes);
    updateEruptWarn(sim.erupt, now);
    volcano.lakeMat.uniforms.uTime.value = now / 1000;
    if (volcano.clouds) volcano.clouds.rotation.y += dtR * 0.006;
    if (volcano.ashMats) for (const m of volcano.ashMats) m.uniforms.uTime.value = now / 1000;
    if (volcano.riverMat) volcano.riverMat.uniforms.uTime.value = now / 1000;
  }
  // cidade à noite: cada poste liga/desliga conforme foi atirado ou não; uns piscam sozinhos de vez em quando
  // (3 postes a cada 5 s). Só os 6 postes acesos mais perto da câmera têm luz de verdade (bem mais leve)
  if (sim.lamps && sim.lamps.length === lampLights.length) {
    const ts = now / 1000, win = Math.floor(ts / 5), n = lampLights.length, flick = new Set();
    for (let k = 0; k < 3; k++) flick.add(Math.floor(((Math.sin(win * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1 * n));
    const onList = [];
    for (let i = 0; i < n; i++) {
      let on = sim.time >= sim.lamps[i].offUntil, L = lampLights[i];
      if (on && flick.has(i)) { const u = ts - win * 5 - (i % 3) * 1.2; if (u > 0.5 && u < 1.6 && Math.sin(u * 47 + i) > 0.1) on = false; } // piscando
      L.bulb.material.color.set(on ? 0xffe2a0 : 0x33302a);
      L.halo.visible = on; L.pool.visible = on;
      if (on) onList.push(L);
    }
    const cp = camera.position; onList.sort((a, b) => a.pos.distanceToSquared(cp) - b.pos.distanceToSquared(cp));
    lampPool.forEach((pl, k) => { const L = onList[k]; if (L) { pl.position.copy(L.pos); pl.intensity = LAMP_LIGHT; } else pl.intensity = 0; });
  }
  // vulcão: lava viva lá embaixo, brasas subindo e a luz tremendo
  if (lavaFx.length) {
    const ts = now / 1000;
    for (const L of lavaFx) {
      L.light.intensity = 22000 * (0.85 + Math.sin(ts * 3.1 + L.h.x) * 0.1 + Math.sin(ts * 7.3 + L.h.z) * 0.05);
      L.glow.material.opacity = 0.3 + Math.sin(ts * 2.2 + L.h.z) * 0.06;
      const pos = L.embers.geometry.attributes.position.array;
      for (let i = 0; i < L.eSeed.length; i++) {
        const [a, d, ph, sp] = L.eSeed[i], t = (ts * 0.35 * sp + ph) % 1;
        pos[i * 3] = L.h.x + Math.cos(a + t * 2) * d; pos[i * 3 + 1] = -HOLE.depth - 160 + t * (HOLE.depth + 250); pos[i * 3 + 2] = L.h.z + Math.sin(a + t * 2) * d;
      }
      L.embers.geometry.attributes.position.needsUpdate = true;
    }
  }

  // mapas escuros: sem nome e sem círculo no chão (entregavam onde o inimigo estava);
  // o nome só aparece com a mira em cima do inimigo e se ele estiver na luz
  const darkMap = mapInfo.mapId === 'cidade' || mapInfo.mapId === 'escuro';
  const aimed = darkMap ? aimedPlayer() : null;
  const myLookKey = JSON.stringify(normLook(S.look));
  // espectador (modo rounds, morto): de quem é a câmera; vp = de quem é a visão/arma na tela (você, ou quem você assiste em 1ª pessoa)
  const specT = updateSpec(me, dtR), vp = specT && spec.fp ? specT : me;
  // bonecos (o corpo some quando morre; fica a lápide)
  for (const p of sim.players.values()) {
    let a = avatars.get(p.id);
    if (a && ((a.pending && BASE[a.pending]) || (p.id === 'me' && a.lookKey !== myLookKey + p.team) || (p.look && p.id !== 'me' && a.lookKey !== JSON.stringify(normLook(p.look)) + p.team))) { a.remove(); avatars.delete(p.id); a = null; }
    if (!a) { a = new Avatar(p); avatars.set(p.id, a); }
    const [x, y, z] = ip(p.id, p);
    a.root.position.set(x, y, z);
    a.model.rotation.y = Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw));
    { const lean = p.slip && sim.swayState ? -Math.sign(sim.swayState.roll || 0) * 0.22 : 0; a.root.rotation.x += (lean - a.root.rotation.x) * Math.min(1, dtR * 6); } // escorregando: corpo inclinado pra cima do convés
    const sc = dispScale(p, dtR); // cresce/diminui com animação (poção / levou tiro)
    a.model.scale.setScalar(a.baseScale * sc); a.ring.scale.setScalar(sc);
    a.root.visible = p.alive && !(p.id === 'me' && (firstPerson || thirdCamD < 22)) && !(vp !== me && p.id === vp.id) && !(sim.time < p.protectUntil && Math.floor(now / 100) % 2 === 0);
    a.ring.visible = false;
    if (a.label) a.label.visible = (!darkMap || (aimed === p.id && litAt(p))) && bodyVisible(p, now) >= 0.7; // nome só com 70% do corpo à vista
    a.setFrozen(sim.time < (p.slowUntil || 0));
    a.update(p, sim, dtR, now);
  }
  updateJumpGlow(me, now, dtR); // pulo duplo carregado: botas douradas e pegadas (só você vê as suas)
  // áreas de reabastecimento (granada/fumaça e poção)
  for (const u of sim.pickups) {
    let m = pickupMeshes.get(u.id);
    if (!m) { m = makePickup(u); scene.add(m); pickupMeshes.set(u.id, m); }
    const ready = sim.time >= u.cdUntil;
    m.material.opacity = ready ? 0.55 + Math.sin(now / 260) * 0.15 : 0.12;
  }
  // lápides
  const tseen = new Set();
  for (const t of sim.tombs) {
    tseen.add(t.id);
    let m = tombMeshes.get(t.id); if (!m) { m = makeTomb(t); scene.add(m); tombMeshes.set(t.id, m); }
    m.visible = true;
    const rise = Math.min(1, (sim.time - t.t0) / 0.35), sink = Math.min(1, (t.until - sim.time) / 0.8);
    m.position.y = t.y - 40 * (1 - Math.min(rise, sink));
  }
  for (const [id, m] of tombMeshes) if (!tseen.has(id)) { scene.remove(m); tombMeshes.delete(id); }
  // balas
  const bseen = new Set();
  for (const b of sim.bullets) {
    bseen.add(b.id);
    let m = bulletMeshes.get(b.id); if (!m) { m = makeBullet(b); scene.add(m); bulletMeshes.set(b.id, m); }
    const [x, y, z] = ip('b' + b.id, b); m.position.set(x, y, z); m.visible = !killcam.active;
    if (m.userData.orient) m.lookAt(x + b.vx, y + b.vy, z + b.vz);
    if (m.userData.spin) m.rotation.y += dtR * 20;
    if (m.userData.tumble) { m.rotation.x += dtR * 9; m.rotation.y += dtR * 6; }
    if (m.userData.bolt) m.userData.bolt(now, x, y, z);
    updateTrail(m, b.team, x, y, z);
  }
  for (const [id, m] of bulletMeshes) if (!bseen.has(id)) { removeBulletMesh(m); bulletMeshes.delete(id); }
  // granadas
  const nseen = new Set();
  for (const g of sim.nades) {
    nseen.add(g.id);
    let m = nadeMeshes.get(g.id); if (!m) { m = makeNade(g); scene.add(m); nadeMeshes.set(g.id, m); }
    const [x, y, z] = ip('n' + g.id, g); m.position.set(x, y, z); m.rotation.x = g.spin;
    animPotion(m, now * (sim.time - g.t0 > P.nadeFuse - 0.6 ? 2.5 : 1)); // perto de explodir: faísca mais rápida
  }
  for (const [id, m] of nadeMeshes) if (!nseen.has(id)) { scene.remove(m); nadeMeshes.delete(id); }
  // fumaça
  const sseen = new Set();
  for (const s of sim.smokes) {
    sseen.add(s.id);
    let m = smokeMeshes.get(s.id); if (!m) { m = makeSmoke(s); scene.add(m); smokeMeshes.set(s.id, m); }
    updateSmoke(m, s, sim, dtR);
  }
  for (const [id, m] of smokeMeshes) if (!sseen.has(id)) { scene.remove(m); smokeMeshes.delete(id); }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i], t = Math.max(0, (now - e.t0) / e.d);
    if (e.upd) { if (t >= 1) { for (const o of e.objs) scene.remove(o); if (e.end) e.end(); effects.splice(i, 1); } else e.upd(t, dtR); continue; }
    if (t >= 1) {
      scene.remove(e.m); scene.remove(e.light);
      if (e.ring) scene.remove(e.ring); if (e.sparks) scene.remove(e.sparks);
      effects.splice(i, 1); continue;
    }
    e.m.scale.setScalar(e.r * 0.55 * (0.35 + t * 0.9)); e.m.material.opacity = 0.95 * (1 - t) ** 1.3; e.light.intensity = 7 * (1 - t);
    if (e.ring) { e.ring.scale.setScalar(e.r * 1.4 * (0.15 + t * 1.1)); e.ring.material.opacity = 0.85 * (1 - t); }
    if (e.sparks) {
      const dt2 = 1 / 60, pos = e.sparkPos;
      for (let k = 0; k < e.sparkVel.length; k++) {
        const v = e.sparkVel[k]; v[1] -= 500 * dt2;
        pos[k * 3] += v[0] * dt2; pos[k * 3 + 1] += v[1] * dt2; pos[k * 3 + 2] += v[2] * dt2;
      }
      e.sparks.geometry.attributes.position.needsUpdate = true;
      e.sparks.material.opacity = Math.max(0, 1 - t * 1.2);
    }
  }

  // câmera
  const meA = avatars.get('me');
  const [mx, my0, mz] = ip('me', me);
  // degrau de escada: a câmera acompanha suave (não fica pulando a cada degrau)
  // (degrau: a câmera sobe/desce macia, sem dar tranco — vale pra 1ª e 3ª pessoa)
  if (me.grounded && camSmY != null && Math.abs(my0 - camSmY) < 44) camSmY += (my0 - camSmY) * Math.min(1, dtR * 6.5); else camSmY = my0;
  const my = camSmY;
  const dx = Math.cos(me.pitch) * Math.cos(me.yaw), dy = Math.sin(me.pitch), dz = Math.cos(me.pitch) * Math.sin(me.yaw);
  sprintFov += ((vp.sprinting && vp.alive ? 7 : 0) - sprintFov) * Math.min(1, dtR * 8);
  adsK += ((vp.aiming && vp.alive ? 1 : 0) - adsK) * Math.min(1, dtR * 12);
  camera.fov = (S.fov + sprintFov) * (S.adszoom === '1' ? 1 - 0.4 * adsK : 1); // mirando: zoom (dá pra desligar nas configurações)
  if (specT) { // espectador: a câmera de quem você está assistindo
    const [tx, ty, tz] = ip(specT.id, specT), cp = Math.cos(spec.pitch), ex = cp * Math.cos(spec.yaw), ey = Math.sin(spec.pitch), ez = cp * Math.sin(spec.yaw);
    if (spec.fp) camera.position.set(tx, ty + P.eye * dispScale(specT, 0), tz);
    else { const c = thirdCam(tx, ty, tz, spec.yaw, spec.pitch, specT.id, specT.bot ? null : specT.camSide); camera.position.set(c[0], c[1], c[2]); }
    camera.lookAt(camera.position.x + ex, camera.position.y + ey, camera.position.z + ez);
    me.camPos = null;
  } else if (!me.alive) { // morto: olha a própria lápide de cima
    camera.position.set(mx - dx * 160, my + 170, mz - dz * 160);
    camera.lookAt(mx, my + 20, mz);
    me.camPos = null;
  } else if (firstPerson) {
    const moving = me.grounded && Math.hypot(me.vx, me.vz) > 30;
    // a altura da câmera segue o seu tamanho: menor depois de levar tiro, cresce de novo com a poção
    camera.position.set(mx, my + P.eye * dispScale(me, 0) + (moving ? Math.sin(now / 90) * 1.4 : 0), mz);
    camera.lookAt(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz);
    me.camPos = null;
  } else { // 3ª pessoa: atrás do ombro, sem atravessar muro
    const c = thirdCam(mx, my, mz, me.yaw, me.pitch, 'me');
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz);
    me.camPos = [camera.position.x, camera.position.y, camera.position.z];
  }
  camera.updateProjectionMatrix();
  // arma na tela (bebendo: a garrafinha)
  // (espectador em 1ª pessoa: vp = quem você assiste — a arma, a cor do time e os braços são os dele)
  if (netMode || vp !== me) tintViewModels(vp.team); else if (!killcam.active && viewTeam !== me.team) tintViewModels(me.team);
  const fpShow = vp === me ? firstPerson && me.alive : true;
  const drinking = (vp.drinkUntil || 0) > sim.time;
  const throwing = nadeThrowAnim && now - nadeThrowAnim.t < 420; // mão ainda terminando de jogar a granada
  const wkey = drinking ? 'potion' : throwing ? nadeThrowAnim.kind : vp.weapon === 'primary' ? vp.primary : vp.weapon;
  for (const k2 in VIEW) VIEW[k2].visible = fpShow && k2 === wkey;
  const vg = VIEW[wkey];
  if (wkey !== fpLastKey) { if (fpLastKey != null) { if (wkey === 'knife') knifeDrawT = now; else fpDrawT = now; } fpLastKey = wkey; } // puxou a faca: gira na mão; as outras: sobem rapidinho
  if (fpShow) fpRefreshArms(vp === me ? null : vp.look); // braços do seu boneco (refaz se mudou a roupa/o time)
  { const spd = Math.hypot(vp.vx, vp.vz), k = Math.min(1, dtR * 8);
    fpRunK += ((vp.sprinting && spd > 30 ? 1 : 0) - fpRunK) * k; fpWalkK += ((vp.grounded && spd > 30 && !vp.sprinting ? 1 : 0) - fpWalkK) * k; }
  if (vg && wkey === 'potion') updatePotionView(vg, drinking ? 1 - (vp.drinkUntil - sim.time) / DRINK : -1, now);
  else if (vg && (wkey === 'nade' || wkey === 'smoke')) {
    // granada: segurando, o braço vai pra trás (mais longe = mais pra trás); soltou: arremesso pra frente e a granada sai da mão
    // clicou: puxa rápido o braço pra trás e arremessa pra frente (sempre força máxima)
    const k = 0, u = throwing ? (now - nadeThrowAnim.t) / 420 : 0, sm = (x) => x * x * (3 - 2 * x);
    const e = throwing ? sm(clamp01((u - 0.25) / 0.75)) : 0, pull = throwing ? (u < 0.25 ? sm(u / 0.25) : 1 - e) : 0;
    // (v0.29) arremesso por baixo (tipo a Sage): a mão desce e vai pra trás, depois sobe pra frente soltando o frasco
    vg.position.set(8 + 1.5 * pull - 3 * e, -7.5 - 4 * pull + 3.5 * e + Math.sin(now / 90) * 0.15 * k, -23 + 2.5 * pull - 10 * e);
    vg.rotation.set(0.55 * pull - 0.75 * e, 0.15 * pull, 0.2 * pull - 0.15 * e);
    vg.children.forEach((o, i) => { if (i < 1) o.visible = !throwing || u < 0.3; });
    if (vg.userData.pot) animPotion(vg.userData.pot, now);
  }
  else if (vg) {
    const w = sim.WEAPONS[vp.primary], reloading = vp.weapon === 'primary' && vp.reloadUntil;
    // ru = andamento da recarga do pente (0..1); cu = andamento da espera pro próximo tiro (1 = pronto)
    const ru = reloading ? Math.max(0, Math.min(1, 1 - (vp.reloadUntil - sim.time) / w.reload)) : 0;
    const cu = !reloading && vp.weapon === 'primary' && vp.fireReady > sim.time ? Math.max(0, Math.min(1, 1 - (vp.fireReady - sim.time) / w.cd)) : 1;
    const dip = reloading ? Math.sin(Math.PI * ru) : 0, sm = (a, b, u) => { const t = Math.max(0, Math.min(1, (u - a) / (b - a))); return t * t * (3 - 2 * t); };
    const base = wkey === 'arco' ? [6.5, -7.5, -22] : wkey === 'estilingue' ? [9, -9.5, -22] : wkey === 'mao' ? [8.5, -7.2, -21] : [8, -8, -22];
    let ox = 0, oy = 0, rz = 0, rx = 0;
    if (wkey === 'mao') { oy = -dip * 13; rx = dip * 0.3; } // abaixa a mão pra pegar/apertar outra bolinha
    else if (wkey === 'varinha') { rz = -dip * 0.7; oy = -dip * 3; } // gira a varinha recarregando a magia
    else if (wkey === 'estilingue') { rz = dip * 0.55; oy = -dip * 5; ox = -dip * 2; }
    else if (wkey === 'arco') { rz = dip * 0.45; oy = -dip * 6; rx = dip * 0.35; } // vira a besta pra engatilhar
    else { oy = -dip * 7; rx = dip * 0.7; }
    // mirando: só um movimento leve (a arma fica no mesmo lugar, quem aproxima é o zoom da tela)
    // correndo: a arma sobe e empina (não afunda no chão na escada/rampa) e balança no ritmo da corrida; andando: balanço leve
    const run = fpRunK * (1 - adsK), wb = fpWalkK * (1 - adsK), ph = now / (run > 0.5 ? 120 : 165);
    const bobX = Math.cos(ph) * (0.55 * wb + 0.9 * run), bobY = Math.abs(Math.sin(ph)) * (0.6 * wb + 1.1 * run);
    const throwK = wkey === 'mao' ? swing : 0; // bola de neve: joga por cima (a mão vai pra frente e desce, igual arremesso)
    const sw = throwK || wkey === 'knife' ? 0 : swing, ta = Math.sin(Math.min(1, (1 - throwK)) * Math.PI) * (throwK > 0 ? 1 : 0); // ta: meio do arremesso
    vg.position.set(base[0] - adsK * 1.2 + ox + bobX - 1.5 * run - 4 * throwK, base[1] - adsK * 0.8 + oy + sw * 5 + bobY + 3.2 * run + 3 * ta - 4 * throwK * throwK, base[2] + kick * 3 * (throwK ? 0 : 1) - sw * 6 + 2 * run - 12 * throwK);
    vg.rotation.x = kick * 0.25 * (throwK ? 0 : 1) + rx - sw * 0.6 + 0.62 * run - 1.2 * throwK;
    vg.rotation.y = 0.28 * run;
    vg.rotation.z = (wkey === 'arco' && !vg.userData.cb ? 0.25 : 0) + rz + 0.22 * run; // (arco antigo era inclinado; a besta não)
    if (wkey === 'knife' && vg.userData.kp) { // saque da faca: sobe girando 2 voltas em volta do dedo (tipo karambit) e para na mão
      const u = clamp01((now - knifeDrawT) / 650), e = 1 - Math.pow(1 - u, 3);
      vg.userData.kp.rotation.set(-(1 - e) * 0.7, (1 - e) * Math.PI * 4, (1 - e) * 0.4 - 0.85 * run); vg.position.y -= (1 - e) * 5; vg.rotation.x -= (1 - e) * 0.5; // (correndo: lâmina pra cima)
      if (swing > 0) { // (v0.30) facada na horizontal (tipo CS/Valorant): puxa pra direita, corta pra esquerda e volta
        const q = 1 - swing, sm2 = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
        const x = q < 0.25 ? 5 * sm2(q / 0.25) : q < 0.65 ? 5 - 17 * sm2((q - 0.25) / 0.4) : -12 * (1 - sm2((q - 0.65) / 0.35)), a = Math.sin(Math.PI * q);
        vg.position.x += x; vg.position.y -= a * 1.5; vg.position.z -= a * 5; vg.rotation.y += x * 0.07; vg.rotation.z -= a * 0.95; vg.rotation.x -= a * 0.25;
      }
    } else { // puxou a besta / estilingue / bola de neve / varinha: sobe de baixo girando um pouco (mais rápido que a faca)
      const u = clamp01((now - fpDrawT) / 320), e = 1 - Math.pow(1 - u, 3);
      if (e < 1) { vg.position.y -= (1 - e) * 7; vg.rotation.x -= (1 - e) * 0.7; vg.rotation.z += (1 - e) * 0.35; }
    }
    // besta correndo: solta a mão de apoio da frente (ela desce, sai da tela) e levanta a besta só com a direita
    if (vg.userData.leftArm) { const L = vg.userData.leftArm, r0 = L.userData.rest; L.position.set(r0.x + 2 * run, r0.y - 16 * run, r0.z + 8 * run); L.rotation.x = 0.6 * run; }
    const hasAmmo = (vp.ammo ? vp.ammo[vp.primary] : 1) > 0;
    vg.traverse((o) => {
      // besta: a corda puxa pra trás (engatilha) e a flecha nova desliza pro lugar
      if (o.userData.string) o.position.z = reloading ? 5 * sm(0.25, 0.7, ru) : 5 * sm(0, 0.6, cu);
      if (o.userData.arrow) {
        const u = reloading ? sm(0.55, 0.9, ru) : sm(0.35, 1, cu);
        o.position.z = -3 + (1 - u) * 16; o.visible = (reloading ? ru > 0.55 : hasAmmo && cu > 0.35);
      }
      // estilingue: pedra nova aparece e o elástico estica
      if (o.userData.pull) {
        const u = reloading ? sm(0.55, 0.95, ru) : sm(0.2, 1, cu);
        o.visible = reloading ? ru > 0.5 : hasAmmo && cu > 0.2;
        o.position.set(0, 8.6 - (1 - u) * 6, 1.5 + u * 2.5);
      }
      // mão: aperta a bolinha de neve nova (cresce e treme um pouquinho)
      if (o.userData.snow) {
        const u = reloading ? sm(0.4, 0.95, ru) : sm(0, 1, cu), shake = (reloading ? dip : 1 - cu) * Math.sin(now / 35) * 0.5;
        o.scale.setScalar(Math.max(0.05, 0.35 + 0.65 * u)); o.position.x = shake; o.visible = (reloading ? ru > 0.35 : hasAmmo) && swing < 0.3; // (saiu da mão no arremesso)
      }
      // varinha: dá uma volta na mão e a pontinha recarrega o brilho
      if (o.userData.wandView) o.rotation.y = reloading ? sm(0.1, 0.9, ru) * Math.PI * 4 : wkey === 'varinha' ? (1 - clamp01((now - fpDrawT) / 320)) * Math.PI * 2 : 0; // (puxou: dá uma volta)
      if (o.userData.wandTip) {
        const u = reloading ? sm(0.3, 1, ru) : sm(0, 1, cu);
        o.scale.setScalar(0.35 + 0.65 * u + (reloading ? Math.sin(now / 50) * 0.35 * dip : 0)); o.material.emissiveIntensity = 0.6 + 1.6 * u;
      }
    });
    if (vg.userData.sling) { // estilingue: bolsinha na pedra (ou solta) e os elásticos até ela
      const L = vg.userData.sling, P0 = L.ball.visible ? L.ball.position : _slRest;
      L.pouch.position.set(P0.x, P0.y - 0.85, P0.z + 0.7);
      for (const b of L.bands) { const a = b.userData.from, d = _slD.subVectors(L.pouch.position, a), len = d.length(); b.position.copy(a).addScaledVector(d, 0.5); b.quaternion.setFromUnitVectors(_fpUp, d.normalize()); b.scale.set(1, Math.max(0.1, len), 1); }
    }
  }
  kick = Math.max(0, kick - dtR * 7); swing = Math.max(0, swing - dtR * 4);

  // mira
  const w = sim.WEAPONS[vp.primary];
  let prog = 1;
  const reloadingMag = vp.weapon === 'primary' && !!vp.reloadUntil;
  if (reloadingMag) prog = 1 - (vp.reloadUntil - sim.time) / w.reload;
  else if (vp.fireReady > sim.time) prog = 1 - (vp.fireReady - sim.time) / (vp.weapon === 'primary' ? w.cd : vp.weapon === 'knife' ? P.knifeCd : 0.6);
  let hm = null;
  if (hitMark) { const a = 1 - (now - hitMark.t) / 280; if (a > 0) hm = { kind: hitMark.kind, a }; else hitMark = null; }
  $('cross').style.display = vp.alive && !menuOpen ? 'block' : 'none'; // (espectador em 1ª pessoa: a mira de quem você assiste)
  drawCross(crossCtx, 240, 240, S.x, Math.max(0, Math.min(1, prog)), hm, reloadingMag);
  updateNadePreview(me);
  // brilho verde de cura quando bebe a poção
  healFx = Math.max(0, healFx - dtR * 0.9);
  $('heal').style.opacity = healFx > 0 ? String(Math.min(1, healFx * 1.4) * 0.8) : '0';
  hud(me);
  drawMinimap(me, now);
  if ($('board').style.display === 'block' && Math.floor(now / 250) !== Math.floor((now - dtR * 1000) / 250)) renderBoard();
  // killcam final (última kill do round/partida): começa meio segundo depois, pra gravar o fim do tiro
  if (pendingKc && now >= pendingKc.at) { const lk = pendingKc.lk; pendingKc = null; killcam.startFinal(lk, now); }
  // fim do round (sozinho): o próximo só começa a contar depois que a killcam final terminar
  if (!netMode && sim.phase === 'roundEnd' && (pendingKc || killcam.active)) sim.phaseUntil = Math.max(sim.phaseUntil, sim.time + 0.6);
  // contagem do round: tela quase preto e branco e a cor volta aos poucos (normal 0,5 s antes de começar)
  { let sat = 1; if (sim.phase === 'countdown' && !EDIT3D) { const rem = sim.phaseUntil - sim.time, tot = Math.max(0.6, (sim.startDelay || 3) - 0.5); sat = Math.max(0.06, Math.min(1, 1 - (rem - 0.5) / tot)); }
    if (Math.abs(sat - (canvas._sat || 1)) > 0.01) { canvas._sat = sat; canvas.style.filter = sat >= 0.999 ? '' : `saturate(${sat.toFixed(2)}) brightness(${(0.85 + 0.15 * sat).toFixed(2)})`; } }
  const kcOn = killcam.apply(now);
  if (EDIT3D && EDIT3D.fly) { EDIT3D.frame(dtR, now); $('cross').style.display = 'none'; }
  renderPortals(me, now); // o que aparece dentro dos portais
  if (kcOn && killcam.lensK > 0.01) renderWithLens(killcam.lensK, now);
  else { renderer.render(scene, camera); renderFP(); }
  fpsN++;
  if (now - fpsT >= 500) { $('fps').textContent = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  requestAnimationFrame(frame);
}

// ---------- modo magia: escudo (mago), olho (capuz), teleporte (ladino), parede de pedra (cavaleiro), investida (bárbaro)
// e a vassoura de todo mundo (segurar Espaço no ar) ----------
const MAGIC_FX = { eyes: new Map(), walls: new Map() };
const _shieldGeo = new THREE.SphereGeometry(1, 24, 16);
let _wallMat = null, fpBroom = null;
function makeBroom() {
  const g = new THREE.Group(), wood = mat(0x7a4f2a), straw = mat(0xd9b36a);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 80, 8), wood); stick.rotation.x = Math.PI / 2; stick.position.z = 6; g.add(stick);
  const br = new THREE.Mesh(new THREE.ConeGeometry(8, 30, 12), straw); br.rotation.x = Math.PI / 2; br.position.z = -44; g.add(br); // vassoura (a palha fica atrás)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3.5, 10), mat(0x8b2e2e)); band.rotation.x = Math.PI / 2; band.position.z = -30; g.add(band);
  return g;
}
function makeEye(team) {
  const g = new THREE.Group(), col = TEAM_EMIS[team] || 0xffffff;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(10, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35, emissive: 0x333333 })));
  const iris = new THREE.Mesh(new THREE.SphereGeometry(5.2, 16, 10), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2 })); iris.position.z = 7; g.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), mat(0x05060a)); pupil.position.z = 10.6; g.add(pupil);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: col, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(70); g.add(glow);
  return g;
}
// brilho que abre e some (teleporte, investida, bloqueio do escudo...)
function magicPuff(x, y, z, color, size, n, now) {
  const objs = [];
  for (let i = 0; i < (n || 6); i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x + (Math.random() - 0.5) * 20, y + Math.random() * 40, z + (Math.random() - 0.5) * 20); s.scale.setScalar(size * (0.5 + Math.random() * 0.6)); s.userData.v = [(Math.random() - 0.5) * 60, 30 + Math.random() * 60, (Math.random() - 0.5) * 60]; scene.add(s); objs.push(s); }
  effects.push({ t0: now, d: 650, objs, upd: (t, dt) => { for (const s of objs) { s.position.x += s.userData.v[0] * dt; s.position.y += s.userData.v[1] * dt; s.position.z += s.userData.v[2] * dt; s.material.opacity = 0.9 * (1 - t); s.scale.multiplyScalar(1 + dt * 1.5); } }, end: () => { for (const s of objs) s.material.dispose(); } });
}
function magicEvent(e, now) {
  const p = e.id != null ? sim.players.get(e.id) : null, col = p ? (TEAM_EMIS[p.team] || 0xffffff) : 0xc4b5fd;
  if (e.type === 'magic') {
    sfxAt('magic', e.x, e.z, e.id === 'me' ? undefined : { far: true, pitch: 0.8, gain: 0.6 });
    if (e.kind === 'blink') { magicPuff(e.x0, e.y, e.z0, 0xa78bfa, 44, 8, now); magicPuff(e.x1, e.y, e.z1, 0xa78bfa, 44, 8, now); }
    else if (e.kind === 'dash') magicPuff(e.x, e.y, e.z, 0xf59e0b, 36, 6, now);
    else if (e.kind === 'shield') magicPuff(e.x, e.y + 10, e.z, col, 50, 5, now);
    else if (e.kind === 'eye') magicPuff(e.ex, e.ey - 20, e.ez, col, 40, 5, now);
    else if (e.kind === 'wall') magicPuff(e.x, e.y, e.z, 0xb8a98c, 40, 6, now);
    if (e.id === 'me') feed('✨ ' + (MAGIC_NAME[e.kind] || 'Magia') + '!');
  }
  if (e.type === 'shield_block') { magicPuff(e.x, e.y - 20, e.z, 0x93c5fd, 30, 4, now); sfxAt('bounce', e.x, e.z); }
  if (e.type === 'eye_absorb') { magicPuff(e.x, e.y - 20, e.z, 0xffffff, 22, 2, now); }
  if (e.type === 'dash_hit') { sfxAt('hit', e.x, e.z); if (e.victim === 'me') feed('💥 Levou uma investida!'); }
}
function updateMagicFx(now) {
  const on = !!(sim && sim.magic);
  for (const [id, a] of avatars) {
    const p = sim.players.get(id); if (!p) continue;
    const sh = on && p.alive && (p.shieldUntil || 0) > sim.time;
    if (sh && !a.shieldM) { a.shieldM = new THREE.Mesh(_shieldGeo, new THREE.MeshStandardMaterial({ color: TEAM_EMIS[p.team] || 0xffffff, emissive: TEAM_EMIS[p.team] || 0xffffff, emissiveIntensity: 0.6, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide })); a.root.add(a.shieldM); }
    if (a.shieldM) { a.shieldM.visible = sh; if (sh) { const k = 1 + 0.04 * Math.sin(now / 120); a.shieldM.scale.set(36 * k, 46 * k, 36 * k); a.shieldM.position.y = 32; a.shieldM.material.opacity = ((p.shieldHits || 1) > 1 ? 0.22 : 0.13) + 0.05 * Math.sin(now / 90); } }
    const gl = on && p.alive && !!p.gliding;
    if (gl && !a.broomG) { a.broomG = makeBroom(); a.root.add(a.broomG); }
    if (a.broomG) { a.broomG.visible = gl; if (gl) { a.broomG.rotation.y = a.model.rotation.y; a.broomG.position.y = 12 + Math.sin(now / 200) * 1.5; } }
  }
  const seenE = new Set();
  if (on) for (const E of sim.eyes || []) {
    seenE.add(E.id); let m = MAGIC_FX.eyes.get(E.id);
    if (!m) { m = makeEye(E.team); scene.add(m); MAGIC_FX.eyes.set(E.id, m); }
    m.position.set(E.x, E.y + Math.sin(now / 300) * 3, E.z); m.rotation.y = now / 600; const left = E.until - sim.time; m.scale.setScalar(left < 0.4 ? Math.max(0.05, left / 0.4) : 1);
  }
  for (const [id, m] of MAGIC_FX.eyes) if (!seenE.has(id)) { scene.remove(m); MAGIC_FX.eyes.delete(id); }
  const seenW = new Set();
  if (on) for (const Wd of sim.magicWalls || []) {
    seenW.add(Wd.id); let m = MAGIC_FX.walls.get(Wd.id); const b = Wd.box, h = b.top - b.y0;
    if (!m) {
      if (!_wallMat) { const t = wallTexture('#8d877c', 'stone'); t.wrapS = t.wrapT = THREE.RepeatWrapping; _wallMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); }
      const w = b.x1 - b.x0, d = b.z1 - b.z0, g = new THREE.BoxGeometry(w, h, d); boxUV(g, w, h, d, 1 / 64);
      m = new THREE.Mesh(g, _wallMat); m.position.set((b.x0 + b.x1) / 2, b.y0 + h / 2, (b.z0 + b.z1) / 2); m.castShadow = m.receiveShadow = true; m.userData.t0 = now; scene.add(m); MAGIC_FX.walls.set(Wd.id, m);
    }
    const k = Math.min(1, (now - m.userData.t0) / 220), left = Wd.until - sim.time, sy = Math.max(0.02, k * (left < 0.3 ? Math.max(0, left) / 0.3 : 1)); // sobe do chão e afunda no fim
    m.scale.y = sy; m.position.y = b.y0 + h * sy / 2;
  }
  for (const [id, m] of MAGIC_FX.walls) if (!seenW.has(id)) { scene.remove(m); m.geometry.dispose(); MAGIC_FX.walls.delete(id); }
  const me = sim.players.get('me');
  $('shieldfx').style.opacity = on && me && me.alive && (me.shieldUntil || 0) > sim.time ? '1' : '0';
  if (!fpBroom) { fpBroom = makeBroom(); fpBroom.scale.setScalar(0.35); fpBroom.position.set(2, -15, -20); fpBroom.rotation.set(0.35, 0.15, 0); fpBroom.visible = false; fpCam.add(fpBroom); } // (1ª pessoa: o cabo da vassoura embaixo)
  fpBroom.visible = on && !!me && me.alive && !!me.gliding && S.cam === '1';
}
function handleEvent(e, now) {
  addEffect(e, now);
  if (e.type === 'magic' || e.type === 'shield_block' || e.type === 'eye_absorb' || e.type === 'dash_hit') magicEvent(e, now);
  const a = avatars.get(e.id), p = e.id && sim.players.get(e.id);
  const pos = p ? [p.x, p.z] : (a ? [a.root.position.x, a.root.position.z] : null);
  if (e.type === 'shot' && p && e.id !== 'me') shotSeen.set(e.id, { t: now, x: p.x, z: p.z }); // aparece no minimapa quando atira
  if (e.type === 'shot' && a) { const s = SHOOT_ANIM[e.weapon]; a.trigger(s[0], s[1], now); if (isViewer(e.id)) { kick = 1; if (e.weapon === 'mao' || e.weapon === 'disco') swing = 1; } if (pos) sfxAt(e.weapon === 'varinha' ? 'magic' : 'shot', pos[0], pos[1], isViewer(e.id) ? undefined : { far: true, pitch: 0.62, gain: 0.5 }); } // tiro dos outros: mais baixo e mais grave (espectador em 1ª pessoa: o de quem você assiste soa como o seu)
  if (e.type === 'knife' && a) { a.trigger(CLIPS.KnifeSlice ? 'KnifeSlice' : '1H_Melee_Attack_Stab', 1.9, now); if (isViewer(e.id)) swing = 1; if (pos) sfxAt('knife', pos[0], pos[1]); }
  if ((e.type === 'nade_throw' || e.type === 'smoke_throw') && a) { a.trigger('Throw', 2.2, now); if (isViewer(e.id)) { nadeThrowAnim = { t: now, kind: e.type === 'nade_throw' ? 'nade' : 'smoke', k: e.k != null ? e.k : 0.6 }; SFX.play('throw', 1); } } // (arremesso dos outros não faz som)
  if (e.type === 'drink' && a) { a.trigger('Use_Item', 1.1, now); if (e.id === 'me') { healFx = 1.2; feed('🧪 +1 vida'); } if (pos) sfxAt('drink', pos[0], pos[1]); }
  if (e.type === 'pickup' && e.id === 'me') { feed(e.kind === 'potion' ? '🧪 Poção reabastecida' : '💣 Granada/fumaça reabastecida'); SFX.play('pickup', 1); }
  if (e.type === 'explode' && Number.isFinite(e.x)) sfxAt('explode', e.x, e.z);
  if (e.type === 'jump' && e.id === 'me') sfxAt('jump', p ? p.x : 0, p ? p.z : 0);
  if (e.type === 'land' && pos) sfxAt('land', pos[0], pos[1]);
  if (e.type === 'tornado_start') feed('🌪️ Um furacão está nascendo — foge dele!');
  if (e.type === 'caught' && e.id === 'me') feed('🌪️ O furacão te pegou!');
  if (e.type === 'storm_warn') feed('🌬️ Tempestade congelante vindo — sai da faixa azul!');
  if (e.type === 'frozen' && e.id === 'me') feed('🥶 Congelado! Você ficou devagar');
  if (e.type === 'meteor_warn') { feed('☄️ Meteoro caindo — olha a sombra no chão!'); SFX.play('splash', 0.5); }
  if (e.type === 'meteor_hit') { addEffect({ type: 'explode', x: e.x, y: 10, z: e.z }, now); sfxAt('explode', e.x, e.z); }
  if (e.type === 'door_open') sfxAt('door', e.x, e.z);
  if (e.type === 'train_warn') { feed('🚇 Trem chegando — sai do trilho com a luz vermelha!'); SFX.play('horn', 0.9); }
  if (e.type === 'crane_warn') { feed('🏗️ O guindaste vai girar — sai do círculo vermelho!'); SFX.play('horn', 0.6); }
  if (e.type === 'crane_hit') { sfxAt('explode', e.x, e.z); if (e.id === 'me') feed('🏗️ A bola de demolição te jogou longe!'); }
  if (e.type === 'train_back') { feed('🚇 O trem está voltando pelo outro trilho!'); SFX.play('horn', 0.7); }
  if (e.type === 'train_hit') { sfxAt('explode', e.x, e.z); if (e.id === 'me') feed('🚇 O trem te atropelou!'); }
  if (e.type === 'wave_warn') { feed('🌊 Onda gigante vindo ' + ({ L: 'da esquerda', R: 'da direita', T: 'de cima', B: 'de baixo' }[e.side] || '') + '!'); }
  if (e.type === 'wave_arrive') SFX.play('wave', 0.9); // só quando a onda passa pela plataforma
  if (e.type === 'wave_hit' && e.id === 'me') feed('🌊 A onda te levou!');
  if (e.type === 'portals_open' && sim.time - (sim.hzStart || 0) > 1) feed('🌀 Portais abertos');
  if (e.type === 'erupt_warn') { feed('🌋 O chão está rachando — o vulcão vai furar ali!'); SFX.play('splash', 0.6); }
  if (e.type === 'erupt') { eruptFx(e.x, e.z, e.r, now); sfxAt('erupt', e.x, e.z); }
  if (e.type === 'light_flicker') feed('💡 A luz está piscando...');
  if (e.type === 'sand_start') feed('🏜️ Tempestade de areia — visibilidade caindo');
  if (e.type === 'sand_end') feed('🏜️ A tempestade passou');
  if (e.type === 'lava_fall') { sfxAt('splash', e.x, e.z); if (e.id === 'me' && e.saved) feed('🌋 Caiu na lava! (modo teste: voltou pro início)'); }
  if (e.type === 'lava_splash') sfxAt('splash', e.x, e.z);
  if (e.type === 'drown') { sfxAt('splash', e.x, e.z); if (e.id === 'me') feed(e.saved ? '🌊 Caiu no mar! (modo teste: voltou pro início)' : '🌊 Você caiu no mar!'); }
  if (e.type === 'sea_splash') sfxAt('splash', e.x, e.z);
  if (e.type === 'swell_warn') feed('🌊 Onda grande vindo de lado — segura firme!');
  if (e.type === 'swell_start') SFX.play('wave', 0.8);
  if (e.type === 'dragon_warn') { feed('🐉 O dragão vem aí — olha pro céu e se esconde embaixo de um telhado!'); SFX.play('dragon', 0.95); setTimeout(() => SFX.play('fire', 0.75), 3000); setTimeout(() => SFX.play('fire', 0.6), 5600); }
  if (e.type === 'dragon_hit' && e.id === 'me') feed('🔥 O fogo do dragão te pegou!');
  if ((e.type === 'bolt_warn' || e.type === 'bolt') && shipFx) shipStrike(e);
  if (e.type === 'bolt_hit' && e.id === 'me') feed('⚡ Um raio te acertou!');
  // portal: no multiplayer a mira é sua, então gira ela aqui junto com o corpo
  if (e.type === 'portal') { if (e.id === 'me' && netMode && Number.isFinite(e.dyaw)) netYaw += e.dyaw; if (pos || e.id === 'me') sfxAt('portal', e.x, e.z); }
  if (e.type === 'portal_shot') sfxAt('portal', e.x, e.z, { quiet: true });
  if (e.type === 'light_off') feed('🕯️ A luz apagou...');
  if (e.type === 'light_on') feed('💡 A luz voltou');
  if (e.type === 'lamp_off') feed('💡 Um poste apagou');
  if (e.type === 'jump' && a) a.legsOnce('Jump_Start', 1.6, now);
  if (e.type === 'djump' && a) a.legsOnce('Jump_Full_Short', 1.6, now);
  if (e.type === 'land' && a) a.legsOnce('Jump_Land', 1.8, now);
  if (e.type === 'hit') { const v = avatars.get(e.victim); if (v) v.trigger('Hit_A', 1.5, now); if (e.by === 'me') hitMark = { kind: 'hit', t: now }; if (e.by === 'me' || e.victim === 'me') SFX.play('hit', 1); } // só os meus acertos
  if (e.type === 'round_end') { lastRoundEnd = e; if (sim.lastKill) pendingKc = { lk: sim.lastKill, at: now + KC.wait }; }
  if (e.type === 'round_start') { feed(`⚔️ Round ${e.round} — valendo!`); killcam.stop(); pendingKc = null; }
  if (e.type === 'hill_move' && sim.mode === 'koth' && sim.time - (sim.hzStart || 0) > 1) feed('👑 A colina mudou de lugar');
  if (e.type === 'match_end') {
    if (!netMode) offlineEndAt = now + 10500;
    if (sim.lastKill && e.mode !== 'rounds') pendingKc = { lk: sim.lastKill, at: now + KC.wait }; // killcam final da partida
  }
  if (e.type === 'kill') {
    if (e.killer === 'me') hitMark = { kind: 'kill', t: now };
    if (seaFx && cheerNear(seaFx) > 0.05) SFX.play('cheer', 0.4 + 0.5 * cheerNear(seaFx)); // a torcida grita quando alguém cai
    const k = sim.players.get(e.killer), v = sim.players.get(e.victim);
    feed(`${k ? `<span class="t${k.team}">${esc(k.name)}</span>` : ''} ${WICON[e.weapon] || '💥'} <span class="t${v ? v.team : 'B'}">${esc(v ? v.name : '?')}</span>`);
    if (e.killer === 'me' || e.victim === 'me') SFX.play('kill', 1); // só os meus abates
  }
  if (e.type === 'reload' && e.id === 'me') SFX.play('reload', 1); // recarga dos outros não faz som
  if (e.type === 'bounce' && Number.isFinite(e.x)) sfxAt('bounce', e.x, e.z);
  void p;
}

showMenu(true);
loadModels().then(() => {
  $('loading').textContent = 'Pronto! Clique em Jogar';
  newGame();
  requestAnimationFrame(frame);
  if (EDIT3D_MAP) { // editor de mapa em 3D: sem menu, câmera voando
    showMenu(false);
    import('/demo3d/edit3d.js').then((m) => {
      EDIT3D = m.createEdit3D({ THREE, scene, camera, canvas, VIEW, mapId: S.map,
        mapGroup: () => mapGroup, mapInfo: () => mapInfo, me: () => sim && sim.players.get('me'),
        ceilingY: () => (mapInfo && CEILING_Y[mapInfo.mapId] != null ? CEILING_Y[mapInfo.mapId] : null),
        rebuild: () => newGame(),
        play: (x, z, yaw) => { const me = sim.players.get('me'); if (me) { me.x = Math.max(40, Math.min(mapInfo.W - 40, x)); me.z = Math.max(40, Math.min(mapInfo.H - 40, z)); me.y = 400; me.vx = me.vz = me.vy = 0; me.yaw = yaw; me.pitch = 0; me.grounded = false; } SFX.init(); lockPointer(); } });
    }).catch((e) => console.error('editor 3D', e));
  }
}).catch((e) => { $('loading').textContent = 'Erro ao carregar os bonecos: ' + e.message; console.error(e); });
window.__pb3d = { get sim() { return sim; }, get camD() { return thirdCamD; }, spec, get mapInfo() { return mapInfo; }, killcam, lock: (v) => { locked = v; showMenu(!v); }, keys,
  get BASE() { return BASE; }, get scene() { return scene; }, get camera() { return camera; }, get edit3d() { return EDIT3D; },
  fx: { eruptFx: (x, z, d) => eruptFx(x, z, 84, performance.now(), d) },
  step: (sec) => { const now = performance.now(); for (let i = 0; i < Math.round(sec * 60); i++) { const evs = sim.step(STEP); killcam.record(sim); for (const e of evs) handleEvent(e, now); } } }; // testes
