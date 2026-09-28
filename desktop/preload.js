// ponte segura entre a tela de início e o app (sem dar acesso ao Node pra página do jogo)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pbApp', {
  ips: () => ipcRenderer.invoke('ips'),
  hospedar: (modo) => ipcRenderer.invoke('hospedar', modo),
  hospedarInternet: () => ipcRenderer.invoke('hospedar-internet'), // cria o link público (túnel da Cloudflare)
  link: () => ipcRenderer.invoke('link'), // link público atual (ou null)
  copiar: (texto) => ipcRenderer.invoke('copiar', texto),
  entrar: (ip, modo) => ipcRenderer.invoke('entrar', ip, modo),
  inicio: () => ipcRenderer.invoke('inicio'),
  aoAcharPartidas: (cb) => ipcRenderer.on('partidas', (_e, lista) => cb(lista)),
  aoTunel: (cb) => ipcRenderer.on('tunel', (_e, s) => cb(s))
});
