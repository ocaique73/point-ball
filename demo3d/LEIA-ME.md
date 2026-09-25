# Point Ball 3D — duas demos FPS para comparar

As duas demos são **FPS** (1ª pessoa, com opção de **3ª pessoa** por trás do ombro — tecla **V**), com a **mira sempre no meio da tela**
e bonecos humanos animados **KayKit Adventurers** (Kay Lousberg, licença CC0: pode usar até em jogo comercial).

Animações: parado, correndo, andando de lado e de costas, pulando, mirando, atirando, recarregando, facada,
jogando bomba e fumaça, levando tiro e morrendo. As pernas e os braços são animados separados
(dá para correr atirando, recarregando ou jogando bomba ao mesmo tempo).

Controles: clique em **Jogar** (o mouse fica preso; **Esc** abre o menu) · WASD andar · mouse olhar/mirar · clique atirar/usar ·
Espaço pular (sem limite) · Espaço de novo no ar = **pulo duplo** (carrega a cada 15 s, passa por cima dos muros) ·
1 arma · **2 poção** (bebe e recupera 1 vida) · 3 faca · 4 granada · 5 fumaça (pega e usa/joga com o clique) · rodinha troca de arma ·
R recarregar · V 1ª/3ª pessoa · **Tab** placar.

Áreas no chão reabastecem granada/fumaça (amarela) e poção (verde) sozinhas quando você fica em cima. Uma granada
inimiga lançada mostra a distância e a direção no topo da tela pra você correr.

Mapas: Deserto (dunas + cactos + tempestade de areia), Neve (paredes de gelo semi-transparentes), Floresta (paredes de
madeira com árvore em cada ponta + furacão + ricochete na copa das árvores), Nave espacial (agora é uma base na Lua,
com painéis de nave e teto de vidro que também ricocheteia tiro), Portais (atravesse um portal aberto e saia no par
dele), Vulcão (poças de lava que sobem e descem sozinhas), Sala escura (a luz apaga e acende sozinha), Cidade à noite
(só os postes iluminam — atirar num poste apaga ele) e **Sala de teste**.

Menu do **Esc**: câmera, mapa (inclui **Sala de teste**, um mapa aberto sem bots e sem morrer, feito pra treinar),
bots, nível, sombras, FOV, arma principal (lançador, estilingue, bolinha na mão, arco, disco), sensibilidade do mouse,
**editor de mira** (cor, tamanho, espessura, espaço, ponto, círculo de recarga e marcador de acerto em X) e a aba
**Sala de teste**, que deixa ajustar ao vivo (sem reiniciar) a velocidade do personagem, a altura do pulo e a
cadência/recarga de cada arma — e ligar o "modo teste" (não morre) em qualquer mapa, não só no de teste.

## Demo A — Three.js (web + PC)

Tem física 3D própria (`public/demo3d/sim3d.js`): tiro e granada seguem a mira, ricochete no muro e no chão, pulo duplo. 8 mapas e bots com 3 níveis.

**Multiplayer** (aba "Multiplayer" do menu Esc): crie uma sala (código de 1 a 5 letras/números + senha opcional) ou entre numa sala existente pela lista ou pelo código. Escolha um time (Azul ou Vermelho); o dono da sala escolhe o mapa, os bots e o nível deles, e aperta "Iniciar partida". É igual ao multiplayer do jogo 2D. O servidor é quem manda no jogo (todo mundo vê o mesmo estado); só a mira/câmera do mouse responde na hora, o resto do corpo segue o que o servidor manda.

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
