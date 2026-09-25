# Point Ball 3D — duas demos para comparar

As duas demos têm a mesma ideia: arena 3D low-poly vista de cima (câmera inclinada), você contra bots, tiro que ricocheteia 3 vezes, 2 vidas (encolhe ao perder uma), super pulo e contador de FPS.

## Demo A — Three.js (web + PC)

Usa **a mesma lógica do jogo 2D** (`shared/game.js` e `shared/bots.js`): só o desenho mudou para 3D.
Por isso já tem tudo: bomba (botão direito), fumaça (rodinha), faca (tecla 2), bots com os 3 níveis e 4 mapas.

**No navegador**
1. Na pasta do projeto: `npm install` (instala o `three`) e `npm start`
2. Abra http://localhost:3000/demo3d/ (online: https://point-ball.onrender.com/demo3d/)

**Como programa de PC (Electron)**
1. Na pasta do projeto: `npm install` (só na primeira vez)
2. `cd demo3d/threejs-pc`, `npm install` (baixa o Electron, ~100 MB, só na primeira vez) e `npm start`
3. `npm run start:sem-limite` abre com FPS sem limite (para ver o máximo do seu PC). F11 = tela cheia.

## Demo B — Godot 4.7 (PC)

Jogo refeito do zero em GDScript (`main.gd`, parecido com Python). Tem menos coisas que a demo A
(sem bomba, fumaça e faca), porque no Godot a lógica precisa ser escrita de novo — esse é o "custo" dessa opção.

1. Baixe o Godot 4.7 (versão padrão, não a .NET): https://godotengine.org/download
2. Abra o Godot → **Importar** → escolha `demo3d/godot/project.godot`
3. Aperte **F5** (ou o botão ▶) para jogar
4. Teclas extras: **V** liga/desliga o V-Sync (desligado = FPS sem limite), **M** troca o mapa, **C** troca a câmera, **F11** tela cheia
5. Para gerar um `.exe`: menu Projeto → Exportar → Windows (a primeira vez ele pede para baixar os "export templates")

A física roda 60 vezes por segundo com **interpolação** ligada, então a imagem fica lisa em 120/144/240 Hz.

## O que comparar

- Qual ficou mais bonito e mais "gostoso" de jogar
- FPS no seu PC (com e sem limite)
- Tempo para abrir e tamanho do programa
- Se você se imagina mexendo no editor do Godot ou prefere continuar no código JavaScript
