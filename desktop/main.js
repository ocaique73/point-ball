// Point Ball instalável (Electron).
// Abre uma tela de início com 3 opções:
//  - "Hospedar": liga o servidor do jogo AQUI neste PC (o mesmo do site) e avisa a rede local que tem partida aqui;
//    os amigos na mesma rede (Wi-Fi/cabo) entram por este PC. Também serve pra jogar sozinho sem internet.
//  - "Hospedar pela internet": liga o mesmo servidor e cria um link público (túnel grátis da Cloudflare, sem conta e
//    sem abrir porta no roteador) que aponta pra este PC; o amigo de outro lugar abre o link no navegador ou no app.
//  - "Entrar": mostra as partidas achadas na rede (ou digita o IP / cola o link de quem hospeda) e abre o jogo de lá.
const { app, BrowserWindow, ipcMain, shell, Menu, clipboard, net, utilityProcess } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dgram = require('dgram');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const PORTA = 3000; // porta do jogo (a mesma do site em casa)
const PORTA_AVISO = 41999; // porta UDP onde quem hospeda avisa "tem partida aqui"
let janela = null, servidorLigado = false, aviso = null, ouvinte = null, servidor = null, servidorPronto = null;
const achados = new Map(); // ip -> { ip, nome, porta, visto }

function meusIPs() {
  const out = [];
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) for (const a of lista || []) if (a.family === 'IPv4' && !a.internal) out.push({ ip: a.address, rede: nome });
  return out;
}
// (v0.35) o servidor do jogo roda num processo SÓ DELE (antes rodava junto com a janela do app e deixava o jogo lento
// pra quem hospedava: a física da partida e a janela brigavam pelo mesmo processo)
function esperarServidor(ms = 15000) {
  const t0 = Date.now();
  return new Promise((ok) => {
    const tenta = () => {
      const r = require('http').get({ host: '127.0.0.1', port: PORTA, path: '/demo3d/', timeout: 1000 }, (resp) => { resp.resume(); ok(true); });
      r.on('timeout', () => r.destroy());
      r.on('error', () => { if (Date.now() - t0 > ms || !servidorLigado) ok(false); else setTimeout(tenta, 150); });
    };
    tenta();
  });
}
function ligarServidor() {
  if (servidorLigado) return servidorPronto;
  servidorLigado = true;
  const env = Object.assign({}, process.env, { PORT: String(PORTA), SERVER_LOCATION: process.env.SERVER_LOCATION || 'LAN (PC de ' + os.hostname() + ')' });
  servidor = utilityProcess.fork(path.join(__dirname, 'jogo', 'server.js'), [], { env, serviceName: 'Point Ball - servidor do jogo', stdio: 'pipe' });
  if (servidor.stdout) servidor.stdout.on('data', (d) => process.stdout.write('[servidor] ' + d));
  if (servidor.stderr) servidor.stderr.on('data', (d) => process.stderr.write('[servidor] ' + d));
  servidor.on('exit', (code) => { console.log('[servidor] saiu', code); servidorLigado = false; servidor = null; servidorPronto = null; });
  servidorPronto = esperarServidor();
  // avisa a rede a cada 1,5 s (os outros PCs com o app aberto veem na lista "Partidas na rede")
  if (!aviso) {
    aviso = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    aviso.bind(() => {
      aviso.setBroadcast(true);
      setInterval(() => {
        if (!servidorLigado) return;
        const msg = Buffer.from(JSON.stringify({ pb: 1, nome: os.hostname(), porta: PORTA }));
        for (const { ip } of meusIPs()) { const p = ip.split('.'); p[3] = '255'; aviso.send(msg, PORTA_AVISO, p.join('.')); }
        aviso.send(msg, PORTA_AVISO, '255.255.255.255');
      }, 1500);
    });
  }
  return servidorPronto;
}
function desligarServidor() { if (servidor) { try { servidor.kill(); } catch (e) {} servidor = null; } servidorLigado = false; }
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

// ---------- hospedar pela internet: túnel rápido da Cloudflare (cloudflared) ----------
// Na 1ª vez baixa o cloudflared oficial (GitHub da Cloudflare) pra pasta do app; depois é só abrir.
// O link muda cada vez que abre (xxxx.trycloudflare.com) e fecha junto com o app.
const CF_BAIXAR = {
  win32: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  linux: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64'
};
let tunel = null, linkPublico = null, abrindoTunel = null;
const caminhoCF = () => process.env.PB_CLOUDFLARED || path.join(app.getPath('userData'), process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
function statusTunel(s) { if (janela && !janela.isDestroyed()) janela.webContents.send('tunel', s); }
// baixa um arquivo (segue os redirecionamentos do GitHub) mostrando a porcentagem
function baixar(url, destino, progresso) {
  return new Promise((ok, falhou) => {
    const tmp = destino + '.baixando';
    const req = net.request({ url, redirect: 'follow' });
    req.on('response', (res) => {
      if (res.statusCode !== 200) { falhou(new Error('download respondeu ' + res.statusCode)); return; }
      const total = Number(res.headers['content-length']) || 0; let feito = 0, ult = -1;
      const arq = fs.createWriteStream(tmp);
      res.on('data', (c) => { arq.write(c); feito += c.length; const pct = total ? Math.floor(feito / total * 100) : 0; if (pct !== ult) { ult = pct; progresso(pct); } });
      res.on('end', () => arq.end(() => { try { fs.renameSync(tmp, destino); ok(); } catch (e) { falhou(e); } }));
      res.on('error', (e) => { arq.destroy(); falhou(e); });
    });
    req.on('error', falhou);
    req.end();
  });
}
function fecharTunel() { if (tunel) { try { tunel.kill(); } catch (e) { /* já fechou */ } } tunel = null; linkPublico = null; }
async function abrirTunel() {
  if (linkPublico) return linkPublico;
  if (abrindoTunel) return abrindoTunel;
  abrindoTunel = (async () => {
    if (!servidorLigado) process.env.SERVER_LOCATION = process.env.SERVER_LOCATION || 'PC de ' + os.hostname() + ' (pela internet)';
    await ligarServidor();
    const cf = caminhoCF();
    if (!fs.existsSync(cf)) {
      const url = CF_BAIXAR[process.platform];
      if (!url) throw new Error('hospedar pela internet só funciona no Windows (e no Linux)');
      fs.mkdirSync(path.dirname(cf), { recursive: true });
      statusTunel({ etapa: 'baixando', pct: 0 });
      await baixar(url, cf, (pct) => statusTunel({ etapa: 'baixando', pct }));
      if (process.platform !== 'win32') fs.chmodSync(cf, 0o755);
    }
    statusTunel({ etapa: 'conectando' });
    return await new Promise((ok, falhou) => {
      let log = '', achou = null, pronto = false, espera = null, limite = null;
      const fim = (erro) => { if (pronto) return; pronto = true; clearTimeout(limite); clearTimeout(espera); if (erro) { fecharTunel(); falhou(erro); } else { linkPublico = achou; ok(achou); } };
      const p = spawn(cf, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:' + PORTA], { windowsHide: true });
      tunel = p;
      const ler = (d) => {
        log = (log + d.toString()).slice(-20000);
        if (!achou) { const m = log.match(/https:\/\/(?!api\.)[-a-z0-9]+\.trycloudflare\.com/); if (m) { achou = m[0]; espera = setTimeout(() => fim(), 6000); } } // (achou o link: espera conectar)
        if (achou && /Registered tunnel connection|Connection [0-9a-f-]+ registered/i.test(log)) fim();
      };
      p.stdout.on('data', ler); p.stderr.on('data', ler);
      p.on('error', (e) => fim(e));
      p.on('exit', (code) => {
        if (tunel === p) { tunel = null; linkPublico = null; }
        if (!pronto) fim(new Error('o túnel fechou sozinho (código ' + code + '). ' + ((log.split('\n').filter((l) => /ERR|error|fail/i.test(l)).slice(-1)[0] || log.trim().split('\n').slice(-1)[0] || '').replace(/^\S+Z\s+/, '').slice(0, 200))));
        else statusTunel({ etapa: 'caiu' });
      });
      limite = setTimeout(() => fim(new Error('demorou demais pra criar o link (a internet está bloqueando?)')), 60000);
    });
  })();
  try { return await abrindoTunel; } finally { abrindoTunel = null; }
}

// ---------- atualização automática (pega a versão mais nova do GitHub Releases sozinho) ----------
// baixa só quando o jogador clicar (nunca no meio de uma partida sem avisar); instala quando ele fechar o app
// ou clicar em "Reiniciar e atualizar". Não funciona rodando "npm start" (só no instalado de verdade).
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
// gancho só pra teste (PB_UPDATE_TEST=1): lê desktop/dev-app-update.yml em vez do config real, pra testar
// o fluxo de atualização sem precisar do instalador do Windows de verdade. Nunca ativa no app publicado.
if (process.env.PB_UPDATE_TEST === '1') autoUpdater.forceDevUpdateConfig = true;
function statusUpdate(s) { if (janela && !janela.isDestroyed()) janela.webContents.send('update', s); }
autoUpdater.on('checking-for-update', () => statusUpdate({ etapa: 'verificando' }));
autoUpdater.on('update-available', (info) => statusUpdate({ etapa: 'disponivel', versao: info.version }));
autoUpdater.on('update-not-available', () => statusUpdate({ etapa: 'atualizado' }));
autoUpdater.on('download-progress', (p) => statusUpdate({ etapa: 'baixando', pct: Math.floor(p.percent) }));
autoUpdater.on('update-downloaded', (info) => statusUpdate({ etapa: 'pronto', versao: info.version }));
autoUpdater.on('error', (err) => statusUpdate({ etapa: 'erro', msg: String((err && err.message) || err).slice(0, 200) }));
function verificarUpdate() {
  if (!app.isPackaged && process.env.PB_UPDATE_TEST !== '1') { statusUpdate({ etapa: 'erro', msg: 'atualização automática só funciona no instalado (não no "npm start")' }); return; }
  autoUpdater.checkForUpdates().catch((err) => statusUpdate({ etapa: 'erro', msg: String((err && err.message) || err).slice(0, 200) }));
}

function abrirJogo(url) {
  janela.loadURL(url);
  janela.setTitle('Point Ball');
}
// só a tela de início (ou o jogo deste PC) pode ligar servidor/túnel — a página de outro PC (quando você entra
// na partida de alguém) não
function daqui(e) { const u = (e.senderFrame && e.senderFrame.url) || ''; return u.startsWith('file:') || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u); }
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
  // botão direito num campo de texto: Recortar/Copiar/Colar (pra colar o link do amigo no "Entrar")
  janela.webContents.on('context-menu', (e, p) => {
    if (p.isEditable) Menu.buildFromTemplate([{ role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { type: 'separator' }, { role: 'selectAll', label: 'Selecionar tudo' }]).popup();
    else if (p.selectionText) Menu.buildFromTemplate([{ role: 'copy', label: 'Copiar' }]).popup();
  });
  // links externos abrem no navegador
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\/(localhost|\d+\.\d+\.\d+\.\d+)/.test(url)) return { action: 'allow' }; shell.openExternal(url); return { action: 'deny' }; });
}
// endereço digitado no "Entrar": IP da rede (192.168.0.15 / 192.168.0.15:3000) ou o link de quem hospeda pela internet
function enderecoDoJogo(texto, modo) {
  const alvo = String(texto || '').trim(), sub = modo === '2d' ? '' : 'demo3d/';
  if (!alvo) return null;
  const semPorta = alvo.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (/^https?:\/\//i.test(alvo) || (/[a-z]/i.test(semPorta) && semPorta.includes('.'))) { // link (ex: https://abc-def.trycloudflare.com/demo3d/)
    try { return new URL(/^https?:\/\//i.test(alvo) ? alvo : 'https://' + alvo).origin + '/' + sub; } catch (e) { return null; }
  }
  const host = alvo.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return `http://${host.includes(':') ? host : host + ':' + PORTA}/${sub}`;
}

ipcMain.handle('ips', () => meusIPs());
const comMp = (url, modo, mp) => url + (mp && modo !== '2d' ? '?mp=1' : ''); // (3D: já abre na aba Multiplayer)
ipcMain.handle('hospedar', async (e, modo, mp) => {
  if (!daqui(e)) return false;
  const ok = await ligarServidor();
  if (!ok) return { erro: 'O servidor não ligou (a porta ' + PORTA + ' já está em uso por outro programa?).' };
  abrirJogo(comMp(`http://localhost:${PORTA}/${modo === '2d' ? '' : 'demo3d/'}`, modo, mp));
  return { ips: meusIPs(), porta: PORTA };
});
// só liga o servidor (pra "Criar sala na rede": o jogo abre direto na aba Multiplayer)
ipcMain.handle('ligar', async (e) => { if (!daqui(e)) return false; return !!(await ligarServidor()); });
ipcMain.handle('hospedar-internet', async (e) => { if (!daqui(e)) return { erro: 'não permitido' }; try { return { link: await abrirTunel() }; } catch (err) { return { erro: String((err && err.message) || err) }; } });
ipcMain.handle('link', (e) => (daqui(e) ? linkPublico : null));
ipcMain.handle('copiar', (e, texto) => { if (!daqui(e)) return false; clipboard.writeText(String(texto || '').slice(0, 500)); return true; });
ipcMain.handle('entrar', (e, ip, modo, mp) => { if (!daqui(e)) return false; const url = enderecoDoJogo(ip, modo); if (!url) return false; abrirJogo(comMp(url, modo, mp)); return true; });
ipcMain.handle('inicio', () => { janela.loadFile(path.join(__dirname, 'launcher.html')); return true; });
ipcMain.handle('versao', () => app.getVersion());
ipcMain.handle('verificar-update', (e) => { if (!daqui(e)) return false; verificarUpdate(); return true; });
ipcMain.handle('baixar-update', (e) => { if (!daqui(e)) return false; autoUpdater.downloadUpdate().catch((err) => statusUpdate({ etapa: 'erro', msg: String((err && err.message) || err).slice(0, 200) })); return true; });
ipcMain.handle('instalar-update', (e) => { if (!daqui(e)) return false; autoUpdater.quitAndInstall(); return true; });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // sem barra de menu: o Alt esquerdo fica só pro jogo (troca o ombro da câmera)
  criarJanela(); ouvirRede();
  setTimeout(verificarUpdate, 2500); // já avisa sozinho ao abrir, sem precisar clicar em nada
  // teste automático (PB_TESTE=1): hospeda, espera o jogo abrir, tira um print e fecha
  if (process.env.PB_TESTE === '1') {
    janela.webContents.on('console-message', (e, level, msg) => { if (level >= 3) console.log('[erro na página]', msg); });
    setTimeout(async () => { const img = await janela.webContents.capturePage(); require('fs').writeFileSync(path.join(__dirname, 'teste-launcher.png'), img.toPNG()); console.log('servidor ligou:', await ligarServidor()); abrirJogo(`http://localhost:${PORTA}/demo3d/`); }, 2500);
    setTimeout(async () => { const img = await janela.webContents.capturePage(); require('fs').writeFileSync(path.join(__dirname, 'teste-jogo.png'), img.toPNG()); console.log('partidas achadas:', JSON.stringify([...achados.values()])); app.quit(); }, 25000);
  }
  // teste do túnel (PB_TESTE=net): cria o link, abre o jogo e mostra o link no console
  if (process.env.PB_TESTE === 'net') {
    janela.webContents.on('console-message', (e, level, msg) => { if (level >= 3) console.log('[erro na página]', msg); });
    setTimeout(async () => {
      try { console.log('LINK:', await abrirTunel()); } catch (err) { console.log('ERRO DO TÚNEL:', err.message); }
      abrirJogo(`http://localhost:${PORTA}/demo3d/`);
      setTimeout(async () => { const img = await janela.webContents.capturePage(); fs.writeFileSync(path.join(__dirname, 'teste-net.png'), img.toPNG()); console.log('entrar(link):', enderecoDoJogo('abc-def.trycloudflare.com', '3d'), enderecoDoJogo('https://abc.trycloudflare.com/demo3d/', '2d'), enderecoDoJogo('192.168.0.15', '3d'), enderecoDoJogo('localhost:3001', '3d')); app.quit(); }, 15000);
    }, 2000);
  }
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { fecharTunel(); desligarServidor(); }); // fechou o app: o link e o servidor param
