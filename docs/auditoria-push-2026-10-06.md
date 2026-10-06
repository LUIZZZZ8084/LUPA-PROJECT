# Auditoria adversarial — notificações push e service worker (06/10/2026)

Sexta frente da revisão de segurança: Web Push (#48) — chaves VAPID,
inscrição de aparelho, envio, e o service worker. Análise sobre o código,
sem tocar produção.

**Resumo:** um ponto acionável de impacto **baixo-a-médio** — o `endpoint`
da inscrição push vem do cliente e não é restrito aos serviços de push
conhecidos, o que deixa o servidor fazer uma requisição de saída para um host
arbitrário (SSRF cego, TLS-only). O resto resistiu.

---

## 🟡 SSRF cego pelo `endpoint` da inscrição push

**Onde:** `src/server/notificacoes/schemas.ts` (`schemaInscricao`) →
`inscreverAparelho` → `enviarPush` (`push.ts`).

**O que é.** O aparelho se inscreve mandando `{ endpoint, p256dh, auth }`. O
único filtro do `endpoint` é:

```ts
endpoint: z.url("Endereço de inscrição inválido.").max(1000),
```

`z.url()` aceita **qualquer** URL — inclusive `http://169.254.169.254/…`,
`http://localhost:9200/…` ou um IP interno. O valor é guardado (amarrado ao
usuário da sessão) e, quando uma vaga casa com a preferência da pessoa, o
servidor faz `webpush.sendNotification({ endpoint, … })`, que é um **POST**
para esse endereço. Não há allowlist dos serviços de push legítimos (FCM,
Mozilla autopush, WNS, Apple).

**Como se dispara.** Qualquer conta com sessão (o `inscreverAparelho` exige
só `perfil:editar_proprio`): registra o endpoint malicioso, liga a preferência
de aviso (cidade + categoria) e espera uma vaga casar. Como "ninguém é avisado
da própria vaga", um segundo cadastro publica a vaga que casa e dispara o envio
na hora — controlável.

**O alcance real, com honestidade — por isso é 🟡 e não 🔴:**

- **É cego.** O envio roda em `after()`, fire-and-forget; a resposta nunca
  volta para quem chamou. O único efeito observável é a inscrição ser apagada
  num 404/410 — um oráculo booleano fraquíssimo, e só se o alvo responder
  exatamente esses códigos.
- **É TLS-only.** A `web-push` usa sempre `https.request` (confirmado em
  `node_modules/web-push/src/web-push-lib.js:369`), ignorando o esquema do
  endpoint. Então `http://` interno (metadados de nuvem, a maioria dos
  serviços internos) falha no handshake — sobram só alvos que falam HTTPS.
- **O corpo é cifrado** (aes128gcm) e não é texto que o atacante controle.

O que sobra: forçar o servidor a abrir conexões HTTPS para hosts arbitrários
(internos que falem TLS, ou externos), sem ler resposta. É defesa em
profundidade que falta, não um vazamento pronto — mas é barato de fechar e
tira o servidor de iniciar requisição para onde um cliente mandar.

**Correção sugerida.** Restringir o `endpoint` aos hosts dos serviços de push
conhecidos, no schema ou no serviço, antes de guardar:

- `fcm.googleapis.com`, `android.googleapis.com` (FCM/GCM)
- `*.push.services.mozilla.com` (Firefox)
- `*.notify.windows.com`, `*.wns.windows.com` (WNS)
- `web.push.apple.com` (Safari/iOS)

Exigir `https:` e recusar host que não bata com a lista. É a mesma ideia do
`connect-src` da CSP — dizer de onde/para onde o tráfego pode ir, em vez de
confiar no formato. Teste que alimenta `http://169.254.169.254/` e um host
fora da lista e exige recusa.

---

## O que resistiu à análise (verificado, sem brecha)

- **Chave VAPID privada protegida.** `VAPID_PRIVATE_KEY` **sem** prefixo
  `NEXT_PUBLIC_`; só a pública leva o prefixo. Sem as duas, o push não existe
  e a tela diz isso — mesma degradação do Storage sem Supabase.
- **O dono da inscrição vem da sessão**, nunca do cliente (`inscreverAparelho`
  injeta `usuarioId` da sessão por cima do que chegou).
- **Service worker não faz cache.** `public/sw.js` só trata `install`,
  `activate`, `push` e `notificationclick` — nenhum handler de `fetch`. Cache
  mal desenhado num app atrás de login mostraria a vaga de ontem ou o conteúdo
  de outra sessão; a ausência é proposital.
- **Aparelho morto sai da tabela** só em 404/410 (desinstalou, trocou de
  telefone); qualquer outra falha não apaga — sumir com quem estava sem sinal
  seria pior que não avisar uma vez. A URL do aviso é **caminho relativo**, o
  SW abre no próprio domínio.
- **Privacidade da preferência.** Guarda cidade e categoria porque a pessoa
  pediu, e **não** guarda histórico de envio — o que reconstruiria o que a
  tabela de buscas sem resultado evita. Nenhuma das tabelas tem grant para
  `anon`/`authenticated` (o teste de schema varre as duas).

---

## Panorama das frentes

| Frente | Resultado |
|---|---|
| Superfícies gerais | 2 corrigidos (#345, #346) — merged |
| Pagamentos / idempotência | 1 endurecido (#348) — merged |
| Arquivos + headers | HSTS corrigido (#350) — merged |
| RBAC / autorização | sem achados |
| E-mail e tokens | sem achados |
| Push / service worker | **SSRF cego no endpoint** 🟡 (este) |
