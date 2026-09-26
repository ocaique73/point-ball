// Point Ball 3D — API do Editor de mapa (public/demo3d/editor.html).
// "Salvar" no editor manda os ajustes pra cá; se a senha bater, o servidor grava o arquivo public/demo3d/edits3d.js
// numa branch separada do GitHub (padrão: "editor"), sem mexer no jogo que está no ar. Depois o Claude pega de lá
// (git fetch) e coloca no código de verdade.
//
// Configuração (variáveis de ambiente no Render):
//   EDITOR_KEY    = a senha do editor (só quem sabe consegue salvar). Sem ela o salvar fica desligado.
//   GITHUB_TOKEN  = token do GitHub com permissão "Contents: Read and write" só no repositório do jogo.
//   GITHUB_REPO   = (opcional) dono/repositório — padrão ocaique73/point-ball
//   EDITOR_BRANCH = (opcional) branch onde grava — padrão editor
const crypto = require('crypto');
const express = require('express');

const FILE = 'public/demo3d/edits3d.js';
const HEADER = '// Ajustes feitos no Editor de mapa (public/demo3d/editor.html) — este arquivo é gerado pelo botão "Salvar" do editor.\n' +
  '// maps: itens de cada mapa (posição/tamanho normalizados 0..1); weapons/player/nade: números do tiro e do boneco;\n' +
  '// fx: efeitos visuais (rastro da varinha, tamanho do tiro, explosão). Vazio = tudo no padrão do jogo.\n';

// limpa o que chegou: só objetos/listas/números/textos curtos, sem nada estranho
function clean(v, depth) {
  if (depth > 8) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : undefined;
  if (typeof v === 'string') return v.slice(0, 24).replace(/[^\w#.\- ]/g, '');
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.slice(0, 600).map((x) => clean(x, depth + 1)).filter((x) => x !== undefined);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 80)) { if (!/^[\w]{1,24}$/.test(k)) continue; const c = clean(v[k], depth + 1); if (c !== undefined) o[k] = c; }
    return o;
  }
  return undefined;
}
function toFile(edits) { return HEADER + 'export default ' + JSON.stringify(edits, null, 1) + ';\n'; }
function fromFile(txt) { const i = txt.indexOf('export default'); if (i < 0) return null; const j = txt.lastIndexOf('}'); return JSON.parse(txt.slice(i + 14, j + 1)); }

function setupEditor(app) {
  const KEY = process.env.EDITOR_KEY || '', TOKEN = process.env.GITHUB_TOKEN || '';
  const REPO = process.env.GITHUB_REPO || 'ocaique73/point-ball', BRANCH = process.env.EDITOR_BRANCH || 'editor';
  let lastSaved = null, lastAt = 0;
  const fails = new Map(); // ip -> { n, until }
  const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  function okKey(req) {
    const ip = ipOf(req), f = fails.get(ip);
    if (f && f.until > Date.now()) return 'locked';
    const k = String(req.headers['x-editor-key'] || '');
    const good = KEY && k.length === KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(KEY));
    if (!good) { const g = f && f.until <= Date.now() ? { n: 0, until: 0 } : f || { n: 0, until: 0 }; g.n++; if (g.n >= 8) { g.until = Date.now() + 10 * 60 * 1000; g.n = 0; } fails.set(ip, g); return false; }
    fails.delete(ip); return true;
  }
  const gh = async (method, url, body) => {
    const r = await fetch('https://api.github.com' + url, { method, headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'point-ball-editor', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    return { status: r.status, j };
  };
  async function ensureBranch() {
    const b = await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
    if (b.status === 200) return;
    const repo = await gh('GET', `/repos/${REPO}`); if (repo.status !== 200) throw new Error('repositório não encontrado (' + repo.status + ')');
    const base = await gh('GET', `/repos/${REPO}/git/ref/heads/${repo.j.default_branch}`); if (base.status !== 200) throw new Error('branch principal não encontrada');
    const c = await gh('POST', `/repos/${REPO}/git/refs`, { ref: 'refs/heads/' + BRANCH, sha: base.j.object.sha }); if (c.status >= 300) throw new Error('não deu pra criar a branch (' + c.status + ')');
  }
  async function saveGitHub(edits, note) {
    await ensureBranch();
    const cur = await gh('GET', `/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`);
    const maps = Object.keys(edits.maps || {}).join(', ') || 'nenhum';
    const msg = 'Editor de mapa: ajustes salvos (mapas: ' + maps + ')' + (note ? ' — ' + String(note).slice(0, 80) : '');
    const r = await gh('PUT', `/repos/${REPO}/contents/${FILE}`, { message: msg, content: Buffer.from(toFile(edits)).toString('base64'), branch: BRANCH, sha: cur.status === 200 ? cur.j.sha : undefined });
    if (r.status >= 300) throw new Error('o GitHub recusou (' + r.status + (r.j && r.j.message ? ': ' + r.j.message : '') + ')');
    return r.j && r.j.commit ? r.j.commit.html_url : null;
  }
  async function loadGitHub() {
    const cur = await gh('GET', `/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`);
    if (cur.status !== 200) return null;
    return fromFile(Buffer.from(cur.j.content, 'base64').toString('utf8'));
  }

  app.use('/api/editor', express.json({ limit: '600kb' }));
  app.get('/api/editor/status', (req, res) => res.json({ enabled: !!KEY, github: !!TOKEN, repo: REPO, branch: BRANCH, lastAt }));
  app.post('/api/editor/check', (req, res) => { const ok = okKey(req); res.status(ok === true ? 200 : 401).json({ ok: ok === true, locked: ok === 'locked' }); });
  app.post('/api/editor/save', async (req, res) => {
    if (!KEY) return res.status(503).json({ ok: false, error: 'O salvar ainda não foi ligado no servidor (falta a senha EDITOR_KEY).' });
    const ok = okKey(req); if (ok !== true) return res.status(401).json({ ok: false, error: ok === 'locked' ? 'Muitas senhas erradas: espere 10 minutos.' : 'Senha errada.' });
    const edits = clean(req.body && req.body.edits, 0);
    if (!edits || typeof edits !== 'object') return res.status(400).json({ ok: false, error: 'Ajustes inválidos.' });
    edits.v = 1; edits.savedAt = new Date().toISOString();
    lastSaved = edits; lastAt = Date.now();
    if (!TOKEN) return res.json({ ok: true, github: false, msg: 'Salvo só na memória do servidor (falta o GITHUB_TOKEN): some se o servidor reiniciar.' });
    try { const url = await saveGitHub(edits, req.body && req.body.note); res.json({ ok: true, github: true, url, branch: BRANCH }); }
    catch (e) { res.status(502).json({ ok: false, error: 'Não deu pra salvar no GitHub: ' + e.message }); }
  });
  app.get('/api/editor/load', async (req, res) => {
    const ok = okKey(req); if (ok !== true) return res.status(401).json({ ok: false, error: 'Senha errada.' });
    try { const e = TOKEN ? await loadGitHub() : lastSaved; res.json({ ok: true, edits: e || lastSaved || null }); }
    catch (e) { res.status(502).json({ ok: false, error: e.message }); }
  });
}

module.exports = { setupEditor, clean, toFile, fromFile };
