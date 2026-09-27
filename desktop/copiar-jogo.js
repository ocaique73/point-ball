// Copia o jogo (servidor + páginas) pra dentro de desktop/jogo, que é o que vai junto no instalador.
// Rode sempre antes de testar/gerar o instalador (o "npm start" e o "npm run dist" já rodam sozinhos).
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DEST = path.join(__dirname, 'jogo');
const PULAR = new Set(['_fp.html', '.env']); // arquivos que não vão no instalador (testes e chaves)

function copiar(de, para) {
  const st = fs.statSync(de);
  if (st.isDirectory()) {
    fs.mkdirSync(para, { recursive: true });
    for (const n of fs.readdirSync(de)) if (!PULAR.has(n) && !n.startsWith('.env')) copiar(path.join(de, n), path.join(para, n));
  } else fs.copyFileSync(de, para);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
for (const f of ['server.js', 'server3d.js', 'editor3d.js', 'package.json']) copiar(path.join(RAIZ, f), path.join(DEST, f));
for (const d of ['shared', 'public']) copiar(path.join(RAIZ, d), path.join(DEST, d));
if (fs.existsSync(path.join(RAIZ, 'game-config.json'))) copiar(path.join(RAIZ, 'game-config.json'), path.join(DEST, 'game-config.json'));
// o servidor procura o three.js em jogo/node_modules/three (build e examples/jsm)
const three = [path.join(__dirname, 'node_modules', 'three'), path.join(RAIZ, 'node_modules', 'three')].find((d) => fs.existsSync(path.join(d, 'build')));
if (!three) throw new Error('three.js não encontrado: rode "npm install" dentro da pasta desktop');
for (const sub of ['build', path.join('examples', 'jsm')]) copiar(path.join(three, sub), path.join(DEST, 'node_modules', 'three', sub));
copiar(path.join(three, 'package.json'), path.join(DEST, 'node_modules', 'three', 'package.json'));
console.log('Jogo copiado para', DEST);
