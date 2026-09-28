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
3. Pronto: o instalador fica em `desktop\dist\Point-Ball-Setup.exe` — sempre com esse **mesmo nome** (sem o número
   da versão), pra o link do site e a atualização automática nunca precisarem mudar. Junto com ele saem mais 2
   arquivos pequenos: `Point-Ball-Setup.exe.blockmap` e `latest.yml` (metadados de quem já tem o jogo instalado
   saber que tem versão nova).

> Pra só testar sem gerar instalador: `cd desktop` → `npm start`. (Nesse modo a atualização automática fica
> desligada — só funciona no `.exe` instalado de verdade.)

## 2. Publicar a versão nova (site sempre atualizado + o app se atualiza sozinho)
Isso usa o **GitHub Releases** do seu repositório: um lugar pra guardar arquivo grande (o `.exe` não cabe no
repositório normal) com um link fixo que sempre aponta pra versão mais nova.

1. Acesse **https://github.com/ocaique73/point-ball/releases** → **"Draft a new release"**.
2. Em **"Choose a tag"**, digite `vX.Y.Z` igual à versão do jogo (ex: `v0.32.0`) → **"Create new tag"**.
3. **Target**: a branch `main` (a que está publicada).
4. **Título**: `Point Ball vX.Y.Z` (pode colar as novidades da versão na descrição).
5. Arraste pra caixa **"Attach binaries"** os **3 arquivos** que saíram em `desktop\dist`:
   `Point-Ball-Setup.exe`, `Point-Ball-Setup.exe.blockmap` e `latest.yml`.
6. Clique em **"Publish release"**.

Pronto — e isso sozinho já resolve as duas coisas:
- **Botão "⬇️ Baixar app (Windows)" no site**: sempre baixa esse `.exe` que você acabou de subir (o link é fixo,
  `.../releases/latest/download/Point-Ball-Setup.exe`, não precisa mexer em nada no site a cada versão).
- **Quem já tem o app instalado**: ele mesmo verifica ao abrir (e tem um botão **"Verificar atualização"** dentro do
  app também) e mostra uma barra verde no topo — **"Baixar atualização"** e depois **"Reiniciar e atualizar"**.
  Como é o próprio programa que manda instalar (você não clica duas vezes no arquivo), normalmente nem aparece
  aquele aviso do Windows de novo.

> Isso só funciona pra quem já instalou uma versão que já tinha essa atualização automática (a partir da v0.32.0).
> Quem ainda está numa versão bem antiga precisa baixar o instalador manualmente essa **última** vez.

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
