# Point Ball 3D — duas demos FPS para comparar

As duas demos são **FPS** (1ª pessoa, com opção de **3ª pessoa** por trás do ombro — tecla **V**), com a **mira sempre no meio da tela**
e bonecos humanos animados **KayKit Adventurers** (Kay Lousberg, licença CC0: pode usar até em jogo comercial).

Animações: parado, correndo, andando de lado e de costas, pulando, mirando, atirando, recarregando, facada,
jogando bomba e fumaça, levando tiro e morrendo. As pernas e os braços são animados separados
(dá para correr atirando, recarregando ou jogando bomba ao mesmo tempo).

Controles: clique em **Jogar** (o mouse fica preso; **Esc** abre o menu) · WASD andar · mouse olhar/mirar · clique atirar/usar ·
Espaço pular (sem limite) · Espaço de novo no ar = **pulo duplo** (carrega a cada 15 s, passa por cima dos muros) ·
1 arma · 3 faca · 4 granada · 5 fumaça (pega e joga com o clique) · rodinha troca de arma · R recarregar · V 1ª/3ª pessoa · **Tab** placar.

Menu do **Esc**: câmera, mapa, bots, nível, sombras, FOV, arma principal (lançador, estilingue, bolinha na mão, arco, disco),
sensibilidade do mouse e **editor de mira** (cor, tamanho, espessura, espaço, ponto, círculo de recarga e marcador de acerto em X).

## Demo A — Three.js (web + PC)

Tem física 3D própria (`public/demo3d/sim3d.js`): tiro e granada seguem a mira, ricochete no muro e no chão, pulo duplo. 4 mapas e bots com 3 níveis.

**No navegador**
1. Na pasta do projeto: `npm install` e `npm start`
2. Abra http://localhost:3000/demo3d/ (online: https://point-ball.onrender.com/demo3d/)

**Como programa de PC (Electron)**
1. Na pasta do projeto: `npm install` (só na primeira vez)
2. `cd demo3d/threejs-pc`, `npm install` (baixa o Electron, ~100 MB, só na primeira vez) e `npm start`
3. `npm run start:sem-limite` abre com FPS sem limite. F11 = tela cheia.

## Demo B — Godot 4.7 (PC)

Refeita em GDScript (`main.gd`) com as mesmas regras da demo A: 5 armas, faca, granada, fumaça, pulo duplo, lápide, menu, mira e placar. 3 mapas.

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
