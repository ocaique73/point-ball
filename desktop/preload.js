// ponte segura entre a tela de início e o app (sem dar acesso ao Node pra página do jogo)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pbApp', {
  ips: () => ipcRenderer.invoke('ips'),
  hospedar: (modo, mp) => ipcRenderer.invoke('hospedar', modo, mp), // mp = abre direto na aba Multiplayer
  hospedarInternet: () => ipcRenderer.invoke('hospedar-internet'), // cria o link público (túnel da Cloudflare)
  link: () => ipcRenderer.invoke('link'), // link público atual (ou null)
  copiar: (texto) => ipcRenderer.invoke('copiar', texto),
  entrar: (ip, modo, mp) => ipcRenderer.invoke('entrar', ip, modo, mp),
  inicio: () => ipcRenderer.invoke('inicio'),
  aoAcharPartidas: (cb) => ipcRenderer.on('partidas', (_e, lista) => cb(lista)),
  aoTunel: (cb) => ipcRenderer.on('tunel', (_e, s) => cb(s)),
  versao: () => ipcRenderer.invoke('versao'),
  verificarUpdate: () => ipcRenderer.invoke('verificar-update'), // atualização automática (GitHub Releases)
  baixarUpdate: () => ipcRenderer.invoke('baixar-update'),
  instalarUpdate: () => ipcRenderer.invoke('instalar-update'),
  aoUpdate: (cb) => ipcRenderer.on('update', (_e, s) => cb(s))
});
