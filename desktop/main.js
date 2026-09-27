// Point Ball instalável (Electron).
// Abre uma tela de início com 2 opções:
//  - "Hospedar": liga o servidor do jogo AQUI neste PC (o mesmo do site) e avisa a rede local que tem partida aqui;
//    os amigos na mesma rede (Wi-Fi/cabo) entram por este PC. Também serve pra jogar sozinho sem internet.
//  - "Entrar": mostra as partidas achadas na rede (ou digita o IP do PC de quem hospeda) e abre o jogo de lá.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const os = require('os');
const dgram = require('dgram');

const PORTA = 3000; // porta do jogo (a mesma do site em casa)
const PORTA_AVISO = 41999; // porta UDP onde quem hospeda avisa "tem partida aqui"
let janela = null, servidorLigado = false, aviso = null, ouvinte = null;
const achados = new Map(); // ip -> { ip, nome, porta, visto }

function meusIPs() {
  const out = [];
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) for (const a of lista || []) if (a.family === 'IPv4' && !a.internal) out.push({ ip: a.address, rede: nome });
  return out;
}
function ligarServidor() {
  if (servidorLigado) return;
  process.env.PORT = String(PORTA);
  process.env.SERVER_LOCATION = process.env.SERVER_LOCATION || 'LAN (PC de ' + os.hostname() + ')';
  require(path.join(__dirname, 'jogo', 'server.js')); // o servidor do jogo (2D e 3D) roda dentro do app
  servidorLigado = true;
  // avisa a rede a cada 1,5 s (os outros PCs com o app aberto veem na lista "Partidas na rede")
  aviso = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  aviso.bind(() => {
    aviso.setBroadcast(true);
    setInterval(() => {
      const msg = Buffer.from(JSON.stringify({ pb: 1, nome: os.hostname(), porta: PORTA }));
      for (const { ip } of meusIPs()) { const p = ip.split('.'); p[3] = '255'; aviso.send(msg, PORTA_AVISO, p.join('.')); }
      aviso.send(msg, PORTA_AVISO, '255.255.255.255');
    }, 1500);
  });
}
function ouvirRede() {
  ouvinte = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  ouvinte.on('message', (buf, rinfo) => {
    try { const m = JSON.parse(buf.toString()); if (m.pb !== 1) return; achados.set(rinfo.address, { ip: rinfo.address, nome: m.nome, porta: m.porta, visto: Date.now() }); } catch (e) { /* não é do jogo */ }
  });
  ouvinte.on('error', () => {});
  ouvinte.bind(PORTA_AVISO);
  setInterval(() => {
    const agora = Date.now(); for (const [k, v] of achados) if (agora - v.visto > 5000) achados.delete(k);
    if (janela && !janela.isDestroyed()) janela.webContents.send('partidas', [...achados.values()]);
  }, 1000);
}
function abrirJogo(url) {
  janela.loadURL(url);
  janela.setTitle('Point Ball');
}
function criarJanela() {
  janela = new BrowserWindow({
    width: 1280, height: 760, minWidth: 900, minHeight: 560, title: 'Point Ball', backgroundColor: '#0b1220', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icone.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  janela.loadFile(path.join(__dirname, 'launcher.html'));
  // F11 = tela cheia; Esc dentro do jogo continua sendo o menu do jogo; Ctrl+Shift+I abre o console (pra testes)
  janela.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { janela.setFullScreen(!janela.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F5') { janela.webContents.reload(); e.preventDefault(); }
    if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') { janela.webContents.toggleDevTools(); e.preventDefault(); }
  });
  // links externos abrem no navegador
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\/(localhost|\d+\.\d+\.\d+\.\d+)/.test(url)) return { action: 'allow' }; shell.openExternal(url); return { action: 'deny' }; });
}

ipcMain.handle('ips', () => meusIPs());
ipcMain.handle('hospedar', (e, modo) => { ligarServidor(); setTimeout(() => abrirJogo(`http://localhost:${PORTA}/${modo === '2d' ? '' : 'demo3d/'}`), 700); return { ips: meusIPs(), porta: PORTA }; });
ipcMain.handle('entrar', (e, ip, modo) => { const alvo = String(ip || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); if (!alvo) return false; const host = alvo.includes(':') ? alvo : alvo + ':' + PORTA; abrirJogo(`http://${host}/${modo === '2d' ? '' : 'demo3d/'}`); return true; });
ipcMain.handle('inicio', () => { janela.loadFile(path.join(__dirname, 'launcher.html')); return true; });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // sem barra de menu: o Alt esquerdo fica só pro jogo (troca o ombro da câmera)
  criarJanela(); ouvirRede();
  // teste automático (PB_TESTE=1): hospeda, espera o jogo abrir, tira um print e fecha
  if (process.env.PB_TESTE === '1') {
    janela.webContents.on('console-message', (e, level, msg) => { if (level >= 3) console.log('[erro na página]', msg); });
    setTimeout(async () => { const img = await janela.webContents.capturePage(); require('fs').writeFileSync(path.join(__dirname, 'teste-launcher.png'), img.toPNG()); ligarServidor(); abrirJogo(`http://localhost:${PORTA}/demo3d/`); }, 2500);
    setTimeout(async () => { const img = await janela.webContents.capturePage(); require('fs').writeFileSync(path.join(__dirname, 'teste-jogo.png'), img.toPNG()); console.log('partidas achadas:', JSON.stringify([...achados.values()])); app.quit(); }, 25000);
  }
});
app.on('window-all-closed', () => app.quit());
