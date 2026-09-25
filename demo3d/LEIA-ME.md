# Point Ball 3D — duas demos FPS para comparar

As duas demos são **FPS** (1ª pessoa, com opção de **3ª pessoa** por trás do ombro — tecla **V**), com a **mira sempre no meio da tela**
e bonecos humanos animados **KayKit Adventurers** (Kay Lousberg, licença CC0: pode usar até em jogo comercial).

Animações: parado, correndo, andando de lado e de costas, pulando, mirando, atirando, recarregando, facada,
jogando bomba e fumaça, levando tiro e morrendo. As pernas e os braços são animados separados
(dá para correr atirando, recarregando ou jogando bomba ao mesmo tempo).

Controles: clique para prender o mouse (Esc solta) · WASD andar · mouse olhar/mirar · clique atirar · botão direito bomba ·
rodinha fumaça · Espaço super pulo · 1/2 arma/faca · R recarregar · V 1ª/3ª pessoa.
A bomba e a fumaça caem onde a mira encosta no chão (olhe para baixo para jogar mais perto).

## Demo A — Three.js (web + PC)

Usa **a mesma lógica do jogo 2D** (`shared/game.js` e `shared/bots.js`); só a câmera, os controles e o desenho mudaram.
Tem bots com os 3 níveis e 4 mapas.

**No navegador**
1. Na pasta do projeto: `npm install` e `npm start`
2. Abra http://localhost:3000/demo3d/ (online: https://point-ball.onrender.com/demo3d/)

**Como programa de PC (Electron)**
1. Na pasta do projeto: `npm install` (só na primeira vez)
2. `cd demo3d/threejs-pc`, `npm install` (baixa o Electron, ~100 MB, só na primeira vez) e `npm start`
3. `npm run start:sem-limite` abre com FPS sem limite. F11 = tela cheia.

## Demo B — Godot 4.7 (PC)

Refeita do zero em GDScript (`main.gd`). Tem arma, faca, bomba, fumaça, pulo, 2 bots e 3 mapas.

1. Abra o `Godot_v4.7-stable_win64.exe` (não precisa instalar)
2. **Importar** → escolha `demo3d/godot/project.godot` → **Importar e editar** (na 1ª vez ele prepara os bonecos, leva alguns segundos)
3. Aperte **F5** (ou o botão ▶) para jogar
4. Teclas extras: **F2** liga/desliga o V-Sync (desligado = FPS sem limite), **M** troca o mapa, **F11** tela cheia
5. Para gerar um `.exe`: Projeto → Exportar → Windows (na 1ª vez ele pede para baixar os "export templates")

A física roda 60 vezes por segundo com **interpolação**, então a imagem fica lisa em 120/144/240 Hz.

## O que comparar

- Qual ficou mais bonito e mais gostoso de jogar (mira, movimento, animações)
- FPS no seu PC (com e sem limite)
- Tempo para abrir e tamanho do programa
- Se você prefere mexer no editor do Godot ou continuar no código JavaScript
