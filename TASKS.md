# Point Ball — Lista de tarefas

> Documento de controle do projeto. **Sempre ler antes de continuar o trabalho** e marcar `[x]` no que for concluído.
> Legenda: `[x]` feito · `[ ]` a fazer · `[~]` feito mas precisa de ajuste/validação do Caique

Última atualização: 25/09/2026 — v0.17.0 (Three.js): **tempo limite de round** no multiplayer (dono escolhe: sem limite/2/3/5/10 min; acaba a partida quando zera, ganha quem tem mais abates, empate se empatar) e **sons** sintetizados (tiro, faca, acerto, abate, pulo, aterrissagem, ricochete, recarga, explosão, arremesso, pickup — com volume/direção por distância e botão de mudo em Controles). Godot pausado por ora. https://point-ball.onrender.com

---

## 1. Estrutura / Deploy
- [x] Projeto Node.js (Express + Socket.IO) — `server.js`
- [x] `package.json` com `npm start` e porta via `process.env.PORT` (Render)
- [x] `render.yaml` (web service free, health check em `/healthz`)
- [x] `.gitignore`
- [x] Repositório no GitHub: https://github.com/ocaique73/point-ball (branch main)
- [x] Serviço no Render (free, Virginia, auto-deploy da main): https://point-ball.onrender.com
- [ ] Testar o jogo online no Render com 2+ pessoas

## 2. Perfil (sem cadastro)
- [x] Menu **Perfil** na página inicial e dentro da sala
- [x] Nick até 20 caracteres
- [x] URL da foto (exibida arredondada na sala, na vitória e dentro do personagem)
- [x] Cor do personagem
- [x] Perfil salvo no navegador (localStorage)

## 3. Salas
- [x] Botão **Criar sala** → vai para `/sala/CODIGO`
- [x] Nome da sala = código, 1 a 5 letras/números (maiúsculas)
- [x] Não permite criar sala com nome repetido
- [x] Senha opcional (mín. 3, máx. 6) — sem a senha não entra pela URL
- [x] Link com senha também funciona: `/sala/CODIGO?senha=xxx`
- [x] Lista de salas abertas na página inicial (🔒 quando tem senha)
- [x] Sala vazia fecha depois de **2 min** (tempo para reconectar)
- [x] Reconexão: recarregar/fechar e abrir o Chrome volta para o mesmo lugar (mesmo time, mesmos pontos) em até 2 min
- [x] Abrir a mesma sala em outra aba derruba a aba antiga
- [x] Dono da sala (👑) escolhe mapa e rounds e inicia; se sair, passa para outro
- [x] Botão copiar link

## 4. Sala de espera e fila
- [x] Escolher time antes de entrar (Azul / Vermelho), máx. 5 por time, 10 no total
- [x] Trocar de time na sala de espera (se tiver vaga)
- [x] Fila de até 10 pessoas quando a sala está cheia
- [x] Quando abre vaga, o primeiro da fila entra automaticamente
- [x] Quem entra durante a partida espera a próxima (pode **assistir**)
- [x] Precisa de pelo menos 1 jogador em cada time para iniciar

## 5. Jogo (2D visto de cima)
- [x] Personagem com arma, cor do jogador, anel da cor do time e foto
- [x] Movimento WASD ou setas
- [x] Tiro com **Espaço**, 1 tiro por segundo
- [x] 20 balas por pente, 4 pentes extras, recarga automática quando acaba (ou **R**)
- [x] Bala de borracha: bate na parede **3 vezes** e some; desenhada com 3 partes, cada batida clareia uma parte
- [x] Sem fogo amigo
- [x] 2 vidas; ao perder 1 vida pisca e fica **50% menor**
- [x] Faca: tecla **2** (tecla **1** volta para a arma), infinita, 1 golpe a cada 0,65 s, tira 1 vida
- [x] Sem balas → troca automaticamente para a faca
- [x] Super pulo (**Shift** ou **E**): ganha 1 a cada 25 s, máximo 1 guardado; a contagem só começa depois de gastar
- [x] Pulo atravessa parede e cai do outro lado (se não couber, cai no lugar livre mais perto)
- [x] Invulnerável enquanto está no ar
- [x] 3 mapas: Deserto, Neve, Floresta (espelhados, iguais para os dois times)
- [x] Predição local do movimento (resposta imediata) + interpolação dos outros jogadores

## 6. Rounds e vitória
- [x] Rounds: 1, 2, 3, 5 ou 7
- [x] Ganha o round o time que eliminar o outro
- [x] Ganha a partida quem tiver **mais de 50%** dos rounds (2 rounds pode dar empate 1x1)
- [x] Contagem de 3 s antes de cada round
- [x] Tela de vitória: time vencedor, nomes, abates / mortes / assistências de todos
- [x] Assistência = acertou alguém mas ele não morreu (perdeu só 1 vida)

## 7. HUD
- [x] Vidas (corações)
- [x] Arma atual, balas no pente / pentes, barra de recarga e de próximo tiro
- [x] Super pulo: PRONTO ou tempo restante + barra
- [x] Abates, mortes, assistências
- [x] Placar e round atual
- [x] Feed de abates

## 8. Página `/teste`
- [x] Ajuste ao vivo de: tamanho do personagem, tamanho do mapa, tamanho do mapa na tela, grossura do muro, tamanho e velocidade do tiro, velocidade do personagem, HUD, tempos (tiro, faca, pulo, recarga), vidas, etc.
- [x] Treino contra bots (quantidade, andar, atirar)
- [x] Botão **Baixar config** (`game-config.json`), copiar e importar JSON
- [~] **Caique:** ajustar os valores e me mandar o `game-config.json`
- [ ] Aplicar o `game-config.json` do Caique (basta colocar o arquivo na raiz do projeto — o servidor carrega sozinho)

## 8.1 v0.2.0 — pedidos de 24/09 (testar no localhost antes de subir)
- [x] Preview do mapa escolhido na criação de sala
- [x] Preview do mapa também na sala de espera (muda quando o dono troca)
- [x] Novo mapa **Sala escura** (lugar fechado, chão escuro)
- [x] Luz apaga a cada 30 s: contador no topo ("Luz apaga em Xs"), pisca rápido por 1 s, fica apagada 1 s e acende de novo
- [x] No escuro só o tiro aparece, fraquinho, com rastro de fogo (brilho ajustável)
- [x] Tempos da luz ajustáveis no `/teste` (grupo "Sala escura")
- [x] Rastro leve nas balas em todos os mapas
- [x] Mira pelo **mouse** (arma aponta para o mouse em volta do personagem)
- [x] WASD/setas só movimentam
- [x] Tiro/facada no **clique esquerdo** (segurar = atira a cada 1 s)
- [x] Super pulo no **Espaço** (E também funciona)
- [~] **Caique:** testar no localhost (`npm start`) e no `/teste`
- [x] Subir v0.2.0 para o GitHub/Render

## 8.2 v0.2.0 — efeitos de mapa + tempo de round (pedido de 24/09)
- [x] Cada mapa tem **um** efeito só
- [x] ~~Deserto: cactos~~ (removido a pedido do Caique — ficou ruim)
- [x] **Floresta:** furacão a cada 30 s — 1 s antes aparece nascendo (sem efeito, só crescendo), depois gira e anda pelo mapa por 3 s; quem ele toca é jogado para o alto (como super pulo) para outro ponto do mapa
- [x] **Neve:** tempestade fria a cada 30 s descendo de cima para baixo (agora no mapa inteiro); quem pega fica congelado (45% da velocidade por 1,5 s)
- [x] **Sala escura:** luz apagando (já existia)
- [x] HUD mostra o contador de cada efeito
- [x] Tudo ajustável no `/teste` (grupos Deserto, Floresta, Neve, Sala escura)
- [x] Tempo máximo do round: **2 min** (relógio no topo); acabou o tempo com os dois times vivos = empate
- [~] **Caique:** testar no localhost
- [x] Subir v0.2.0 para o GitHub/Render

## 8.3 v0.2.0 — HUD novo (pedido de 24/09)
- [x] Corações ao lado direito da munição (uma caixa só, mais baixa)
- [x] Topo: Abates/Mortes/Assist. à esquerda do placar, Super pulo à direita
- [x] Contador do efeito do mapa (luz/furacão/tempestade) menor, embaixo do placar
- [x] Mapa desce um pouco: espaço reservado em cima para o HUD não cobrir o mapa
- [~] **Caique:** testar no localhost

## 8.4 v0.2.0 — ajustes após teste do Caique (24/09)
- [x] Furacão com os valores do Caique: a cada 7 s, nasce em 2 s, anda 4,5 s, tamanho 115, velocidade 330, joga a 450, 0,9 s no ar
- [x] Desenho novo do furacão: visto de cima, braços de vento em espiral, meio transparentes
- [x] Tempestade fria no mapa inteiro (largura padrão = 1)
- [x] **Deserto:** tempestade de areia a cada 30 s — junta no meio (aviso 1 s) e duas paredes de areia vão do meio até as laterais em 4 s; bordas tampam um pouco a visão, o miolo tampa tudo, depois clareia
- [~] **Caique:** testar no localhost

## 8.5 v0.2.0 — ajustes 2 (24/09)
- [x] Todos os efeitos de mapa a cada **30 s** (furacão voltou de 7 s para 30 s)
- [x] Areia: aviso 2 s, 4 s até as laterais, largura 0,58 (print +15%); bordas mais escuras mantendo o degradê
- [x] Furacão 15% maior (132) e sem a linha amarela tracejada
- [x] Furacão pega o jogador, ele **gira dentro** do furacão (0,7 s, ajustável) e depois é lançado
- [x] Tempestade fria já pega a largura inteira do mapa
- [x] **Bots na sala:** o dono escolhe 0 a 5 bots e o time deles; nomes aleatórios; ocupam vagas do time
- [x] Bots miram, atiram, usam faca quando acaba a bala, desviam e usam super pulo
- [x] /teste usa os mesmos bots (opção "Bots inteligentes")
- [~] **Caique:** testar no localhost

## 8.6 v0.2.0 — HUD 3 (24/09)
- [x] Arma, munição e vida no canto superior esquerdo, uma em cada linha
- [x] Embaixo do mapa fica livre (só a linha de ajuda dos controles)
- [x] Nevasca agora é **sempre** o mapa inteiro (tirei a opção de largura)
- [x] /teste descarta valores salvos de versões antigas (`cfgVersion`) — era isso que deixava a nevasca só no meio
- [~] **Caique:** testar no localhost

## 8.7 v0.2.0 — valores do Caique + faca (24/09)
- [x] Valores do print: bala tamanho 5 e velocidade 700; faca a cada 0,4 s, alcance 50, abertura 100° (mesmas unidades da tela)
- [x] **Faca corrigida:** o risco balançava junto com a lâmina (até ~50° para os lados) e o acerto usava só o centro do inimigo
  - agora o risco é a área real do golpe, parada na direção do golpe
  - conta o corpo inteiro do inimigo (se o risco encosta no corpo, acerta)
  - o acerto é calculado no seu navegador com o que você vê (sem atraso da rede) e o servidor só confere se é possível
- [x] Subir v0.2.0 para GitHub/Render

## 8.8 v0.2.1 — cores de time (24/09)
- [x] Tirei a escolha de cor do Perfil: boneco azul no time Azul e vermelho no time Vermelho
- [x] Corações em cima do personagem removidos (vida só no HUD)
- [x] Seu próprio nome aparece em amarelo
- [x] Efeitos de mapa a cada 25 s (antes 30 s)
- [x] Rastro do tiro na cor do time (no claro e no escuro)
- [x] Avatares sem foto na sala/vitória usam a cor do time
- [x] Subido para GitHub/Render

## 8.9 v0.3.0 — bomba, níveis de bot e modos mata-mata (pedido em casa)
- [x] Super pulo carrega em **15 s**
- [x] Borda do personagem = **carregamento do próximo tiro** (fecha o círculo = pronto); azul forte / vermelho forte; também mostra a recarga do pente
- [x] Removida a borda branca do próprio personagem (o nome amarelo já diferencia)
- [x] **Bomba** no botão direito: segurar mostra o círculo de alcance e onde vai cair; soltar fora do círculo = vai no limite naquela direção; dentro = cai onde soltou
  - 1 bomba por round (no mata-mata, 1 por vida); voa por cima dos muros, explode depois de 0,6 s no chão, tira 1 vida de inimigos no raio (muro protege, sem fogo amigo)
  - ajustes no /teste (grupo "Bomba")
- [x] **Níveis de bot:** Fácil, Média, Semi-pro (o de antes, um pouco mais difícil) e Profissional (mira mais precisa, prevê o movimento, usa bomba)
- [x] **Modo mata-mata em equipe:** placar = abates do time; renasce em 2 s no seu lado do mapa
- [x] **Modo cada um por si:** todo mundo é inimigo (você azul, os outros vermelhos); ranking por abates
- [x] Tempo 1/2/3/5 min e limite 20/25/30/50 abates (acaba no que vier primeiro)
- [x] Renascer: longe dos inimigos, 1 s piscando mais claro, sem tomar dano e sem poder atirar (vale nos dois mata-matas)
- [x] Tela de vitória por modo (time vencedor / ranking)
- [x] Enviado para a branch `dev` do GitHub (não afeta o site até juntar na `main`)
- [x] Caique aprovou
- [x] `dev` juntada na `main` (PR #1) e publicada no Render

## 8.10 v0.4.0 — mapa Portais + cor do anel
- [x] Novo mapa **Portais**: 2 pares de portais nas laterais (ciano em cima, rosa embaixo); entra de um lado e sai do outro na mesma altura
- [x] Tiro também atravessa o portal e **não conta** como uma das 3 batidas
- [x] Ciclo: fechado 7 s no começo → aberto 10 s → fechado 5 s → aberto 10 s … (ajustável no /teste, grupo "Portais")
- [x] Portal pisca antes de fechar; contador no topo ("Portais abrem em Xs" / "fecham em Xs")
- [x] Anel de recarga do tiro: parte que falta agora é quase preta (#111827) — dá pra ver bem quanto falta para fechar
- [x] Enviado para a branch `dev` (site não mudou)
- [x] Publicada junto com a v0.5.0

## 8.11 v0.5.0 — modo Rei da colina
- [x] Novo modo **Rei da colina** (times Azul x Vermelho)
  - área redonda (👑) no meio do mapa; o time que estiver sozinho dentro ganha 1 ponto por segundo
  - os dois times dentro = **disputada** (ninguém pontua, pisca amarelo)
  - a colina muda de lugar a cada 40 s (meio → topo → baixo, sempre no centro, justo para os dois lados); 5 s antes aparece o próximo lugar tracejado
  - renasce em 2 s no seu lado, com 1 s de proteção (igual ao mata-mata)
  - tempo 1/2/3/5 min e **pontos para vencer** 50/75/100/150 (acaba no que vier primeiro)
  - HUD mostra quem domina a colina e quando ela muda; vitória mostra os pontos
  - bots vão para a colina e ficam rondando nela
  - ajustes no /teste (grupo "Rei da colina")
- [x] v0.4.0 + v0.5.0 publicadas (PR #2 → `main` → Render)

## 8.12 v0.5.1 — criar sala em modal
- [x] Página inicial mais limpa: botão "➕ Criar sala" abre um modal com nome, senha, mapa, modo, tempo/pontos/abates/rounds e o preview do mapa
- [x] Fecha com ✕, Cancelar, Esc ou clicando fora; Enter cria a sala
- [x] Funciona no celular
- [~] **Caique:** testar

## 8.13 v0.6.0 — portais sorteados, colina equilibrada, 3 níveis de bot
- [x] Mapa Portais: 8 aberturas (2 na esquerda, 2 na direita, 2 em cima, 2 em baixo)
- [x] A cada abertura sorteia **4 portais = 2 pares** (cores ciano e rosa), nunca repete o sorteio anterior; entrar num sai no par da mesma cor, já andando para dentro do mapa (bala gira junto e não conta batida)
- [x] Rei da colina: lugar sorteado **só quando a área atual acaba** (não mostra mais o próximo lugar)
- [x] Sorteio equilibrado: perto do meio entre os times (1x1 = meio entre os dois; 2x2+ = meio entre o centro das duplas), puxado para o centro do mapa, sempre entre 32% e 68% da largura, escolhendo o candidato com distância parecida dos dois times e dos dois lados de nascimento; nunca repete o mesmo lugar
- [x] Bots: só 3 níveis — **Iniciante** (bem mais fácil: mira tremida, demora ~1 s para reagir, fica parado às vezes, sem bomba), **Amador** (meio-termo, padrão) e **Profissional** (mais forte que o antigo)
- [x] Simulação 1x1 (10 partidas de 2 min, abates): Pro 66 x 28 Amador · Amador 65 x 14 Iniciante · Pro 90 x 7 Iniciante
- [x] Salas antigas com fácil/média/semi-pro viram iniciante/amador
- [x] +40 nomes de bot (70 no total)
- [x] Anel de carregamento: trilho **branco com contorno preto fino** (aparece no deserto, na neve e nos mapas escuros)
- [~] **Caique:** testar; mandar a lista de nomes de bot que você criou para eu colocar

## 8.14 v0.7.0 — fumaça, pulo guardado, novos valores
- [x] Pulo carregado não reseta ao morrer (renascer no mata-mata e troca de round); se estava carregando, continua de onde parou
- [x] Personagem raio 25 (era 22); ao perder 1 vida fica 35% menor (era 50%)
- [x] Velocidade do tiro 660 (era 700) · raio da bomba 105 (era 95)
- [x] **Fumaça** na rodinha do mouse: voa igual à bomba (mesmo alcance/tempo), ao cair abre uma cortina de 5 s, raio 150
- [x] Miolo (55% do raio) totalmente fechado; daí até a borda vai clareando até sumir — só dá para se esconder no meio
- [x] Não machuca ninguém; 1 fumaça por vida/round (igual bomba); HUD mostra 💨×1
- [x] Bots não enxergam através do miolo da fumaça
- [x] Tudo ajustável no /teste (grupo "Fumaça"); cfgVersion 10 (valores antigos salvos no /teste são descartados)
- [~] **Caique:** testar

## 8.15 v0.8.0 — 3 mapas novos (em teste — o Caique decide se ficam)
- [x] **Cidade à noite:** escuro o tempo todo; inimigo só aparece na luz dos 14 postes, perto de você (110) ou no clarão do tiro; aliados aparecem apagadinhos
- [x] Tiro no poste apaga a luz por 8 s (anel mostra quanto falta para acender); bots também não enxergam no escuro
- [x] **Vulcão:** a cada 25 s o chão racha (2 s de aviso) e sobem 3 pares de poças de lava espelhadas em lugares sorteados, por 7 s; encostar tira 1 vida
- [x] Paredes do meio trocam entre 2 desenhos a cada erupção (o aviso mostra onde vão aparecer); quem fica dentro é empurrado para fora
- [x] **Nave espacial:** espaço estrelado em volta e cantos do casco cortados; a cada 25 s caem 2 meteoros, um de cada lado em pontos espelhados e sorteados (2 s de aviso com o meteoro chegando)
- [x] O meteoro abre um buraco para o espaço (dá para ver as estrelas)
- [x] Cair no buraco: a beira segura por ~1,1 s e puxa devagar (dá tempo de sair); no meio cai em ~0,4 s. Tiro que passa por cima é sugado, com qualquer número de batidas
- [x] Bots desviam de lava e buracos; nascimento evita lava/buraco
- [x] Tudo ajustável no /teste (grupos Cidade à noite, Vulcão, Nave espacial); cfgVersion 11
- [~] **Caique:** testar e decidir quais mapas ficam

## 8.16 v0.8.1 — fumaça maior, portais mais justos
- [x] Raio da fumaça 200 (era 150); dentro da fumaça nem você se vê
- [x] Portais: nunca os 2 pares na mesma parede — pelo menos um par liga paredes diferentes
- [x] Início do round no mapa Portais: abrem 3 s ligando cima ↔ baixo, fecham 6 s, depois ciclo normal sorteado (abre 10 s / fecha 5 s)
- [~] **Caique:** testar

## 8.17 v0.8.2 — ajustes finais do 2D
- [x] Cidade: o personagem passa por baixo dos postes (não bate); só o tiro bate e apaga a luz
- [x] Nave: buracos ficam até o fim do round; meteoros caem só 2 vezes por round (4 meteoros), aos 25 s e 50 s, longe do meio
- [x] Nave: beira do buraco segura de leve (indo para dentro anda a 45%, para fora anda normal); passou da beira, cai sem volta
- [x] Nave: bomba e fumaça que caem no buraco somem sem estourar
- [x] Vulcão: 2 pares de poças (era 3), cada uma com formato irregular diferente (a do outro lado é espelhada); lava nova com correntes quentes, crosta boiando, veios escorrendo e bolhas
- [x] Portais: abertura inicial nas paredes verticais (esquerda ↔ direita na mesma altura)
- [x] Fumaça dura 6 s (era 5)
- [~] **Caique:** testar

## 8.18 v0.8.3 — queda no buraco animada
- [x] Nave: quem cai no buraco é puxado girando até o meio, encolhe e escurece até sumir no espaço (0,9 s); não deixa marca de morto
- [x] Durante a queda não controla nem leva tiro
- [~] **Caique:** testar

## 8.19 v0.8.4 — Rei da colina com prévia
- [x] Cada área vale 30 s (era 40)
- [x] Quando a área fecha: 3 s mostrando onde vai ser a próxima (contorno piscando + contagem), sem pontuar; só então passa a valer
- [x] A próxima só é sorteada quando a atual fecha (nunca aparecem duas juntas)
- [~] **Caique:** testar

## 10. 3D (demos para comparar)
- [x] Demo A: Three.js — `/demo3d/` (web) e `demo3d/threejs-pc` (Electron, PC). Reaproveita shared/game.js e bots.js: bomba, fumaça, faca, bots, 4 mapas
- [x] Demo B: Godot 4.7 — `demo3d/godot` (abrir project.godot e F5). Refeito em GDScript: arena, tiro com 3 ricochetes, 2 vidas, pulo, 2 bots, 3 mapas, V-Sync liga/desliga, física interpolada
- [x] Modelos low-poly feitos com formas simples (dá para trocar por modelos do Kenney depois)
- [x] Como rodar: `demo3d/LEIA-ME.md`
- [x] v0.10.0: as duas viraram **FPS** (1ª pessoa + 3ª pessoa por trás do ombro, tecla V), mira sempre no meio, mouse preso na tela
- [x] Bonecos humanos KayKit Adventurers (CC0) com animações em 2 camadas (pernas: parado/correr/lado/costas/pulo/morte; braços: mirar/atirar/recarregar/facada/jogar bomba e fumaça/levar tiro)
- [x] Godot ganhou bomba, fumaça e faca; câmera de 3ª pessoa não atravessa parede nas duas
- [x] Tiro continua reto na altura do peito (igual ao 2D); olhar para cima/baixo só muda a visão e onde a bomba cai
- [x] v0.11.0 (Three.js): física 3D própria (`public/demo3d/sim3d.js`), sem mexer no 2D
  - [x] Pulo normal sem limite (vai para onde você anda) + **pulo duplo** carregado a cada 15 s (Espaço 2x) para passar por cima dos muros
  - [x] Tiro e granada vão para onde a mira aponta (sobe/desce); ricochete no muro e no chão
  - [x] Teclas: 1 arma · 3 faca · 4 granada · 5 fumaça (pega e joga com o clique) · rodinha troca de arma
  - [x] 5 armas de borracha: lançador, estilingue, bolinha na mão, arco (segura e solta), disco
  - [x] Morreu: não atira mais, corpo some e fica uma **lápide com o nome** por 8 s
  - [x] Fumaça com ~160 nuvenzinhas macias (miolo fechado, borda clareando)
  - [x] Menu no **Esc**: câmera, mapa, bots, nível, sombras, FOV, arma, sensibilidade, inverter Y
  - [x] **Mira editável**: cor, contorno, tamanho, espessura, espaço, ponto, círculo de recarga, marcador de acerto em X (amarelo = acerto, vermelho = abate)
  - [x] **Tab** (segurar): placar com abates, mortes, assistências e K/D
- [x] v0.12.0 (Godot): as mesmas mudanças (física com CharacterBody3D/RigidBody3D, menu com abas, mira editável, placar, lápide, 5 armas, fumaça macia)
- [x] v0.13.0 (Three.js — foco só nesta demo por enquanto pra economizar, Godot fica pausado): "bloco 1" de ajustes
  - [x] **Sala de teste**: opção "Sala de teste" no mapa (arena aberta, sem bots, sem morrer) + aba **Sala de teste** no menu Esc pra ajustar velocidade, altura do pulo, cadência e recarga de cada arma ao vivo (sem precisar reiniciar)
  - [x] Pulo normal mais alto (jumpV 330→400)
  - [x] Velocidade e cadência/recarga de cada arma agora são valores por partida (`Sim3D` aceita overrides), ajustáveis pela sala de teste
  - [x] Poção de vida na tecla **2**: pega, bebe (animação `Use_Item`) e recupera 1 vida — uma poção por vida
  - [x] Áreas no mapa que reabastecem granada/fumaça (amarela) e poção (verde) sozinhas
  - [x] Indicador de granada inimiga: seta de direção + distância em metros no topo da tela
  - [x] Explosão da bomba com visual mais suave (textura de fogo em gradiente + anel de onda de choque + faíscas), sem mais o icosaedro de baixo poli serrilhado
  - [x] Lápide ganhou uma cruz de madeira em cima
- [x] v0.14.0 (Three.js): "bloco 2" — mais mapas e temas visuais
  - [x] Mapa **Portais**: os 8 portais do 2D, 2 pares sorteados abertos (sem ciclo abre/fecha, pra simplificar) — atravessa um e sai no par dele
  - [x] **Furacão da floresta**: nasce em um ponto aleatório a cada ~16s, puxa/gira quem estiver perto por 6s e no fim joga todo mundo longe
  - [x] **Tempestade de areia do deserto**: liga/desliga sozinha, reduz a visão de verdade (fog mais perto) e deixa mais devagar enquanto ativa
  - [x] Reskin **Floresta**: paredes viraram madeira (com veio) e cada ponta de parede ganhou uma árvore; tiros ricocheteiam na copa (teto invisível acima das árvores)
  - [x] Reskin **Neve**: paredes de gelo semi-transparentes de verdade — dá pra ver uma, mas quanto mais empilhadas atrás menos dá pra ver (efeito natural da transparência em camadas)
  - [x] Reskin **Deserto**: paredes viraram dunas de areia arredondadas + cactos espalhados aleatoriamente (a colisão continua sendo a caixa, só o visual mudou)
  - [x] Reskin **Nave**: paredes de "tijolo" viraram painéis/computadores de nave; virou uma base na Lua com teto de vidro (dá pra ver as estrelas) e tiro ricocheteia nele
- [x] v0.15.0 (Three.js): "bloco 3" — os últimos 3 mapas do 2D
  - [x] Mapa **Vulcão**: poças de lava (sorteadas uma vez por partida, sempre espelhadas) que sobem e descem sozinhas — dói quando estão "ativas" (a troca de parede na erupção do 2D ficou de fora, pra simplificar)
  - [x] Mapa **Sala escura**: a luz apaga e acende sozinha de tempos em tempos
  - [x] Mapa **Cidade à noite**: escuro o tempo todo, só os postes iluminam — atirar num poste apaga ele por um tempo
- [x] v0.16.0 (Three.js): **multiplayer completo, igual ao 2D** — salas com código e senha, lista de salas abertas, escolha de time (azul/vermelho), dono da sala controla mapa/bots/nível, "Iniciar partida", reconexão se cair a conexão. Servidor autoritativo (`server3d.js`) roda o `Sim3D` como o 2D roda o `Game`, manda o estado pela rede a cada tick; o cliente só desenha o que o servidor manda (sem prever localmente — só a mira/câmera do mouse é instantânea, a posição do corpo segue o servidor com uma leve suavização). Sem previsão do lado do cliente foi decisão consciente pra simplificar.
- [x] v0.17.0 (Three.js): **tempo limite de round** — o dono da sala escolhe (sem limite/2/3/5/10 min) na aba Multiplayer do lobby; o servidor conta pelo `sim.time` e, ao zerar, encerra a partida, soma os abates de cada time e manda o resultado (vitória/empate) pro lobby; HUD mostra o relógio no canto superior. **Sons** sintetizados via Web Audio (sem arquivo de áudio pra baixar): tiro, faca, acerto, abate, pulo, aterrissagem, ricochete na parede, recarga, explosão, arremesso de granada/fumaça e pickup — volume mais baixo e panorâmico conforme a distância até você; botão "Som: Ligado/Mudo" na aba Controles.
- [~] **Caique:** testar os blocos 1, 2, 3, o multiplayer (v0.16.0) e o tempo de round + sons (v0.17.0)
- [x] Godot (`demo3d/godot`): os 8 mapas agora existem (geometria+cores portadas do `shared/maps.js`), incluindo Nave, Portais, Vulcão, Sala escura e Cidade à noite no menu de mapa.
- [x] Godot: mecânica da **Sala escura** (luz apaga/acende sozinha, com lanterna fraca pra dar pra jogar) e do **Vulcão** (4 poças de lava espelhadas que alternam ativa/inativa e doem quando ativas).
- [ ] Godot: falta a mecânica de **Portais** (teletransporte — é a mais complexa, precisa abrir buracos na parede e sincronizar posição/velocidade) e da **Cidade à noite** (postes que acendem/apagam ao levar tiro; hoje o mapa não é permanentemente escuro ainda).
- [ ] Godot: **multiplayer do zero** (o Godot não usa o servidor Node/Socket.IO da versão web — precisa de servidor dedicado ENet, salas, times, dono da sala). Fase grande, ainda não iniciada.

## 9. Próximas ideias (não pedidas ainda — confirmar com o Caique)
- [x] Sons (tiro, ricochete, acerto, faca, pulo, recarga, explosão) + botão de mudo — v0.17.0
- [x] Tempo limite por round — v0.17.0
- [ ] Controles para celular (joystick na tela)
- [ ] Chat na sala de espera
- [ ] Botão do dono para expulsar jogador
- [ ] Minimapa/indicador de onde veio o tiro que te acertou
- [ ] Itens que aparecem no mapa (escudo, munição extra, bomba extra, velocidade por 5 s)
- [ ] Modo "Capture a bandeira"
- [ ] Ranking/histórico de partidas (salvo no servidor)
- [ ] Chat rápido na partida (mensagens prontas: "cuidado!", "vem comigo")
- [ ] Emotes / skins simples (chapéu, óculos) desbloqueados por abates
- [ ] Replay do último abate (killcam)
- [ ] Mapa editor: você desenha paredes no /teste e salva como mapa novo

---

## Decisões tomadas (pode mudar se o Caique quiser)
- Super pulo: **Espaço** (ou E). Pula para onde está andando; parado, pula para onde o mouse aponta.
- Recarregar manual: **R**.
- A arma aponta para o mouse. Tiro/facada no clique esquerdo.
- Sala escura: no escuro nada aparece (nem você), só as balas com brilho fraco e rastro. O HUD continua visível.
- Cada round começa **sem** pulo (conta 25 s). Dá para mudar em `/teste` → "Começa o round com pulo".
- Invulnerável por 0,4 s depois de levar um acerto (evita perder 2 vidas com 1 rajada). Ajustável.
- Rei da colina: quando um time empurra o outro, a colina tende a nascer mais perto do time que está recuado (que também renasce desse lado) — isso equilibra sozinho. O limite de 32%–68% da largura evita que caia perto de um nascimento.
- Jogador desconectado no meio da partida fica parado no mapa até voltar (ou até 2 min).
- Para testar vários jogadores no mesmo navegador: `/sala/CODIGO?p=2`, `?p=3`… (cada `p` vira um jogador diferente). Ou use janela anônima.

## Mapa dos arquivos
| Arquivo | O que tem |
|---|---|
| `server.js` | Servidor, salas, senha, fila, reconexão, loop da partida |
| `shared/config.js` | Valores padrão e limites (usado pelo servidor e pelo `/teste`) |
| `shared/maps.js` | Os 3 mapas (paredes em coordenadas 0..1) |
| `shared/game.js` | Regras e física do jogo (tiro, ricochete, faca, pulo, rounds) |
| `public/index.html` | Página inicial: perfil, criar/entrar em sala |
| `public/room.html` + `public/js/room.js` | Sala: senha, time, espera, fila, jogo, vitória |
| `public/js/render.js` | Desenho no canvas |
| `public/js/hud.js` | HUD e teclado |
| `public/teste.html` + `public/js/teste.js` | Página de ajustes `/teste` |
| `game-config.json` (opcional) | Ajustes vindos do `/teste`; sobrescreve os padrões |
