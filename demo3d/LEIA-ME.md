# Point Ball 3D — duas demos FPS para comparar

As duas demos são **FPS** (1ª pessoa, com opção de **3ª pessoa** por trás do ombro — tecla **V**), com a **mira sempre no meio da tela**
e bonecos humanos animados **KayKit Adventurers** (Kay Lousberg, licença CC0: pode usar até em jogo comercial).

Animações: parado, correndo, andando de lado e de costas, pulando, mirando, atirando, recarregando, facada,
jogando bomba e fumaça, levando tiro e morrendo. As pernas e os braços são animados separados
(dá para correr atirando, recarregando ou jogando bomba ao mesmo tempo).

Controles: clique em **Jogar** (o mouse fica preso; **Esc** abre o menu) · WASD andar · **Shift correr** (correndo não atira) · mouse olhar/mirar · clique atirar/usar ·
Espaço pular (sem limite) · Espaço de novo no ar = **pulo duplo** (carrega a cada 15 s, passa por cima dos muros) ·
1 arma · **2 poção** (bebe e recupera 1 vida) · 3 faca · 4 granada · 5 fumaça (pega e usa/joga com o clique) · rodinha troca de arma ·
R recarregar · V 1ª/3ª pessoa · **Tab** placar (com ping e onde fica o servidor).

Armas: **arco** (padrão), estilingue e bolinha na mão. Modos (iguais ao 2D): Rounds, Mata-mata em equipe, Cada um por si, Rei da colina e Treino livre. Quando alguém te mata aparece a **killcam** (replay pelos olhos dele).

Uma granada inimiga lançada mostra a distância e a direção no topo da tela pra você correr. Os eventos de cada mapa
(furacão, tempestade, chuva congelante, erupção, luz apagando) só começam 25 s depois do início e repetem a cada 25 s.

Mapas: Deserto (**montanhas de areia** que dá pra subir, tempestade de areia), Neve (paredes de gelo: dá pra ver através de
uma, a segunda já escurece), Floresta (paredes de madeira com árvore grande em cada ponta + furacão + ricochete na copa das
árvores), Nave espacial (uma **base na Lua**: corredor de nave, janelas pra superfície da Lua e a Terra no céu, teto de vidro
que também ricocheteia tiro), Portais (portais ovais que dá pra **ver através** — gente, tiro e granada passam e saem no
par), Vulcão (**buracos no chão com lava** — caiu, morreu), Sala escura (a luz apaga e acende sozinha), Cidade à noite
(só os postes iluminam — atirar num poste apaga ele) e **Sala de teste**.

Menu do **Esc**: câmera, mapa (inclui **Sala de teste**, um mapa aberto sem bots e sem morrer, feito pra treinar),
bots, nível, sombras, FOV, arma principal (lançador, estilingue, bolinha na mão, arco, disco), sensibilidade do mouse,
**editor de mira** (cor, tamanho, espessura, espaço, ponto, círculo de recarga e marcador de acerto em X) e a aba
**Sala de teste**, que deixa ajustar ao vivo (sem reiniciar) a velocidade do personagem, a altura do pulo e a
cadência/recarga de cada arma — ligar/desligar "você pode morrer" (os bots sempre morrem) e escolher o som de cada coisa (4 a 7 opções cada).

## Demo A — Three.js (web + PC)

Tem física 3D própria (`public/demo3d/sim3d.js`): tiro e granada seguem a mira, ricochete no muro e no chão, pulo duplo. 8 mapas e bots com 3 níveis.

**Novidades da v0.23** (só no 3D): obra em octógono e fábrica em hexágono, minimapa, contador de vivos, sons por distância, granada segurando pra jogar longe, pulo duplo com botas douradas, editor com ícones e cor da pele, portais e cidade mais leves.

**Novidades da v0.22** (só no 3D): mapas novos Canteiro de obras (bola de demolição) e Fábrica (pistões e esteiras), killcam seguindo o tiro, pirâmide gigante, casa na árvore com escadas de mão, trem de ida e volta, onda vindo do horizonte, prédios em volta da cidade e cratera enorme no vulcão.

**Novidades da v0.21** (só no 3D): mapas novos Estação de metrô (trem passando) e Plataforma no mar (onda gigante, navio com torcida), varinha mágica, casa na árvore, pirâmides no deserto, mira reta, granada com arco de alcance e killcam com o boneco caindo.

**Novidades da v0.20** (só no 3D): mapas 40% maiores e redesenhados (`public/demo3d/world3d.js`), portais que abrem/fecham sozinhos com andar de cima, meteoros e portas na nave, caverna na floresta, iglus na neve, tempestade congelante, lava furando o chão, mira com botão direito (zoom + barra de força), besta na 1ª pessoa, killcam final com efeito de lente, animação da poção e a aba **Personagem** (5 personagens, roupas e cores por tons do time — `public/demo3d/looks3d.js`). Os bonecos são do KayKit Adventurers (Kay Lousberg, CC0).

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
