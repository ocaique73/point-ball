// Point Ball 3D (Three.js) como programa de PC.
// Liga o mesmo servidor do jogo aqui dentro e abre a demo 3D numa janela própria.
//   npm start              -> segue o Hz do monitor (V-Sync, sem "rasgar" a imagem)
//   npm run start:sem-limite -> FPS sem limite (para testar o máximo do PC)
const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

const semLimite = process.argv.includes('--sem-limite');
if (semLimite) {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}
app.commandLine.appendSwitch('force_high_performance_gpu'); // notebooks: usa a placa de vídeo dedicada

const PORT = process.env.PORT || 3457;
process.env.PORT = String(PORT);
require(path.join(__dirname, '..', '..', 'server.js')); // o servidor do Point Ball (precisa do npm install na pasta raiz)

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, backgroundColor: '#0b0f17', title: 'Point Ball 3D (Three.js)',
    autoHideMenuBar: true, webPreferences: { backgroundThrottling: false }
  });
  win.loadURL(`http://localhost:${PORT}/demo3d/`);
  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
}
app.whenReady().then(() => setTimeout(createWindow, 400));
app.on('window-all-closed', () => app.quit());
