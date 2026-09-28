# Point Ball instalável (LAN e internet)

Um app de PC (Electron) com o jogo dentro. Dá pra jogar **sozinho sem internet**, **em rede com os amigos** (mesma
Wi-Fi/cabo) ou **pela internet com um link** (amigo em outro lugar): um PC **hospeda** (o servidor do jogo roda nele)
e os outros **entram**. É o mesmo jogo do site (2D e 3D), com salas, times e bots.

## 1. Gerar o instalador (uma vez, no seu PC)
1. Instale o **Node.js LTS**: https://nodejs.org (baixar e avançar).
2. No terminal do Antigravity, dentro da pasta do projeto:
   ```
   cd desktop
   npm install
   npm run dist
   ```
3. Pronto: o instalador fica em `desktop\dist\Point Ball Setup 0.32.0.exe`.

> Pra só testar sem gerar instalador: `cd desktop` → `npm start`.

## 2. Mandar o instalador pros amigos
O `.exe` tem uns 80 a 100 MB (grande demais pro Discord/WhatsApp grátis), então o jeito mais fácil é o **Google Drive**:
1. Abra https://drive.google.com → **Novo → Upload de arquivo** → escolha o `Point Ball Setup 0.32.0.exe`.
2. Clique com o botão direito no arquivo → **Compartilhar** → em "Acesso geral" escolha
   **Qualquer pessoa com o link** → **Copiar link**.
3. Mande o link pros amigos. Eles baixam e instalam (avançar → concluir); cria o atalho **Point Ball** na área de trabalho.
   - O Windows pode avisar "O Windows protegeu o computador" (o app não tem assinatura paga): clique em
     **Mais informações → Executar assim mesmo**.
   - O Chrome pode dizer que o arquivo "não é baixado com frequência": clique em **Manter**.

> Versão nova do jogo: **quem hospeda** é quem precisa atualizar. Quem entra na partida de alguém joga com o jogo
> que vem do PC de quem hospeda (o app só guarda a tela de início). Mesmo assim, de vez em quando mande o instalador
> novo pra todo mundo ter a tela de início mais nova.

## 3. Jogar juntos na mesma rede (LAN)
1. **Quem hospeda** abre o Point Ball e clica em **Hospedar partida**.
   Na primeira vez o Windows pergunta do firewall: marque **Redes privadas** e clique em **Permitir**.
2. O jogo abre. No menu (Esc) → **Multiplayer** → crie a sala.
3. **Os amigos** abrem o Point Ball: a partida aparece em **Partidas na rede** → **Entrar**.
   Se não aparecer, digite o IP que aparece na tela de quem hospeda (ex: `192.168.0.15`) e clique em **Entrar**.
4. Dentro do jogo: Esc → **Multiplayer** → entra na sala e escolhe o time.

## 4. Jogar pela internet (amigo em outro lugar) — sem Radmin, sem abrir porta
1. **Quem hospeda** abre o Point Ball → **Hospedar pela internet → Criar link**.
   - Na primeira vez o app baixa o **cloudflared** (o programa oficial de túnel da Cloudflare, uns 40 MB) — só uma vez.
   - Em alguns segundos aparece o link (tipo `https://palavras-aleatorias.trycloudflare.com/demo3d/`) e ele **já é copiado**.
2. Mande o link pros amigos (WhatsApp, Discord...). Clique em **Abrir o jogo** → Esc → **Multiplayer** → crie a sala.
   No 3D o link também aparece no topo do menu **Multiplayer**, com o botão **Copiar**.
3. **Os amigos** entram de 2 jeitos (os dois jogam juntos):
   - **pelo navegador**: abrem o link no Chrome/Edge (não precisa instalar nada), ou
   - **pelo app**: colam o link no campo **Entrar** e clicam em **Entrar**.
   Depois é igual: Esc → **Multiplayer** → entra na sala.
4. Se o link não abrir na hora, esperem uns 10 segundos e tentem de novo (o link novo demora um pouquinho pra "espalhar").

Coisas boas de saber:
- **Quem hospeda joga com ping zero**; os outros jogam com o ping até o PC de quem hospeda (passando pela Cloudflare,
  que tem servidor em São Paulo) — normalmente bem melhor que o servidor grátis do site (que fica nos EUA).
- O link **muda cada vez** que você cria e **para de funcionar quando você fecha o app**.
- O PC de quem hospeda precisa ficar ligado e com internet boa (de preferência no cabo).
- Quem tem o link consegue abrir o jogo no seu PC (só o jogo, nada mais do computador). Mande só pros amigos.
- É o túnel grátis e sem conta da Cloudflare ("Quick Tunnel"): ótimo pra jogar e testar, mas sem garantia de ficar no
  ar pra sempre. Se um dia parar de funcionar, o plano B é o **Radmin VPN** ou **ZeroTier** (todo mundo entra na mesma
  rede virtual e o amigo digita o IP da rede virtual de quem hospeda no campo **Entrar**).

## 5. Site x app: quem joga com quem?
Cada **servidor** é um "mundo" separado, com as suas salas:
- **Site** (`point-ball.onrender.com`): quem joga pelo navegador no site e quem clica em **Abrir o servidor do site**
  no app jogam juntos.
- **PC de quem hospeda** (LAN ou link da internet): quem entrou pelo IP/link — pelo app **ou** pelo navegador — joga junto.
- Uma sala do site **não aparece** no PC de quem hospeda (e vice-versa). Combinem todos no mesmo lugar.

## Dicas
- F11 = tela cheia. Pra voltar pra tela de início, feche e abra o app de novo.
- Jogando sozinho (sem sala online), o Esc pausa o jogo. No multiplayer nunca pausa.
- Ctrl+Shift+I abre o console (pra ver erros).
