# Point Ball — Lista de tarefas

> Documento de controle do projeto. **Sempre ler antes de continuar o trabalho** e marcar `[x]` no que for concluído.
> Legenda: `[x]` feito · `[ ]` a fazer · `[~]` feito mas precisa de ajuste/validação do Caique

Última atualização: 24/09/2026 — v0.1.0 (primeira versão jogável)

---

## 1. Estrutura / Deploy
- [x] Projeto Node.js (Express + Socket.IO) — `server.js`
- [x] `package.json` com `npm start` e porta via `process.env.PORT` (Render)
- [x] `render.yaml` (web service free, health check em `/healthz`)
- [x] `.gitignore`
- [ ] Criar repositório no GitHub e dar push (Caique)
- [ ] Criar serviço no Render apontando para o repositório (Caique)
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

## 9. Próximas ideias (não pedidas ainda — confirmar com o Caique)
- [ ] Sons (tiro, batida na parede, acerto, faca, pulo)
- [ ] Controles para celular (joystick na tela)
- [ ] Tempo limite por round
- [ ] Chat na sala de espera
- [ ] Mira com o mouse (hoje a arma aponta para onde o personagem anda)
- [ ] Botão do dono para expulsar jogador

---

## Decisões tomadas (pode mudar se o Caique quiser)
- Tecla do super pulo: **Shift** ou **E** (não foi especificada).
- Recarregar manual: **R**.
- A arma aponta na direção do último movimento (não usa mouse).
- Cada round começa **sem** pulo (conta 25 s). Dá para mudar em `/teste` → "Começa o round com pulo".
- Invulnerável por 0,4 s depois de levar um acerto (evita perder 2 vidas com 1 rajada). Ajustável.
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
