// ponte segura entre a tela de início e o app (sem dar acesso ao Node pra página do jogo)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pbApp', {
  ips: () => ipcRenderer.invoke('ips'),
  hospedar: (modo) => ipcRenderer.invoke('hospedar', modo),
  entrar: (ip, modo) => ipcRenderer.invoke('entrar', ip, modo),
  inicio: () => ipcRenderer.invoke('inicio'),
  aoAcharPartidas: (cb) => ipcRenderer.on('partidas', (_e, lista) => cb(lista))
});
