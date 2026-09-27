# Point Ball instalável (modo LAN)

Um app de PC (Electron) com o jogo dentro. Dá pra jogar **sozinho sem internet** ou **em rede com os amigos**:
um PC **hospeda** (o servidor do jogo roda nele) e os outros **entram** — todo mundo na mesma rede (Wi-Fi ou cabo).
É o mesmo jogo do site (2D e 3D), com salas, times e bots.

## 1. Gerar o instalador (uma vez, no seu PC)
1. Instale o **Node.js LTS**: https://nodejs.org (baixar e avançar).
2. No terminal do Antigravity, dentro da pasta do projeto:
   ```
   cd desktop
   npm install
   npm run dist
   ```
3. Pronto: o instalador fica em `desktop\dist\Point Ball Setup 0.30.0.exe`.

> Pra só testar sem gerar instalador: `cd desktop` → `npm start`.

## 2. Instalar nos PCs dos amigos
- Mande o `Point Ball Setup ... .exe` (pendrive, Google Drive, WhatsApp...).
- Cada um instala (avançar → concluir). Cria o atalho **Point Ball** na área de trabalho.
- O Windows pode avisar "O Windows protegeu o computador" (o app não tem assinatura paga): clique em
  **Mais informações → Executar assim mesmo**.

## 3. Jogar juntos
1. **Quem hospeda** abre o Point Ball e clica em **Hospedar partida**.
   Na primeira vez o Windows pergunta do firewall: marque **Redes privadas** e clique em **Permitir**.
2. O jogo abre. No menu (Esc) → **Multiplayer** → crie a sala.
3. **Os amigos** abrem o Point Ball: a partida aparece em **Partidas na rede** → **Entrar**.
   Se não aparecer, digite o IP que aparece na tela de quem hospeda (ex: `192.168.0.15`) e clique em **Entrar**.
4. Dentro do jogo: Esc → **Multiplayer** → entra na sala e escolhe o time.

## Dicas
- Todos precisam estar na **mesma rede**. Amigo longe? Usem um programa de "LAN virtual" (ex: **Radmin VPN** ou
  **ZeroTier**): todo mundo entra na mesma rede virtual e o amigo digita o IP da rede virtual de quem hospeda.
- F11 = tela cheia. Pra voltar pra tela de início, feche e abra o app de novo.
- Jogando sozinho (sem sala online), o Esc pausa o jogo. No multiplayer nunca pausa.
- Quando sair uma versão nova do jogo: rode `npm run dist` de novo e mande o instalador novo.
