# Auditoria adversarial — arquivos privados e cabeçalhos (06/10/2026)

Terceira frente da revisão de segurança: **controle de acesso a arquivos
privados** (URL assinada do currículo) e os **cabeçalhos de segurança** da
resposta HTTP. Análise sobre o código, sem tocar produção.

**Resumo:** o acesso a arquivos privados está correto — nenhum IDOR. Nos
cabeçalhos há **um ponto acionável** (falta o HSTS) e algumas observações
menores. O resto resistiu à análise.

---

## 🟠 Falta o cabeçalho `Strict-Transport-Security` (HSTS)

**Onde:** `next.config.ts` → `async headers()`.

O bloco de cabeçalhos define `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy` — mas **não**
define `Strict-Transport-Security`. Não há menção a HSTS em nenhum arquivo do
projeto, então é omissão, não decisão.

**O risco.** Sem HSTS, a primeira visita de um navegador pode sair como HTTP
antes do redirecionamento para HTTPS, e um atacante na rede (wi-fi público,
ponto de acesso falso) pode interceptar essa requisição inicial e fazer
*SSL-stripping* — servir uma versão HTTP e capturar o que a pessoa digita. Num
app que recebe **senha no login, CPF/CNPJ e currículo** (dado pessoal sob
LGPD), é a classe de proteção que fecha o ataque de downgrade. A Vercel serve
HTTPS, mas **não adiciona HSTS sozinha** — o app precisa declará-lo.

**Severidade:** baixa-a-média. Não é explorável por qualquer um a qualquer
hora — exige um atacante na rede da vítima no momento certo —, mas é um
cabeçalho padrão de endurecimento para app com login e PII, e a ausência é
exatamente o tipo de coisa que passa batido porque "o site abre em HTTPS".

**Correção:**

```ts
{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }
```

Dois anos de `max-age` e `includeSubDomains` é o valor usual. **`preload` fica
de fora por ora, de propósito:** entrar na lista de preload dos navegadores é
um compromisso difícil de desfazer (força HTTPS em todos os subdomínios por
meses, mesmo que um subdomínio precise de HTTP um dia). Dá para adicionar
depois, quando houver certeza de que todo subdomínio de `lupapp.com.br` fala
HTTPS. O e2e de cabeçalhos (`tests/e2e/cabecalhos-de-seguranca.spec.ts`) ganha
uma asserção para travar a presença.

---

## Observações menores (não acionáveis)

- **`img-src 'self' data: blob: https:`** aceita imagem de qualquer host
  HTTPS. É um canal teórico de exfiltração (uma `<img>` injetada beaconando
  para fora), mas o `script-src` trancado por nonce impede o JS que montaria
  isso, o React escapa o HTML, e o `connect-src` fecha o canal principal. O
  comentário justifica: o domínio do Storage do Supabase muda por projeto.
  Apertar para os domínios do Supabase seria mais puro; o ganho é pequeno.
- **`Permissions-Policy: ... geolocation=(self)`** permite a própria origem
  pedir geolocalização. O app não usa GPS (a localização é a cidade escolhida
  à mão), então `geolocation=()` seria o mais justo — mas `(self)` só libera o
  código de primeira parte, que já é confiável. Risco nulo.
- **`X-Frame-Options: SAMEORIGIN` vs `frame-ancestors 'none'`** divergem: o
  primeiro permite emolduramento pela própria origem, o segundo proíbe
  qualquer um. O comentário em `csp.ts` diz que um "repete" o outro, e não é
  exato — mas o `frame-ancestors 'none'`, mais estrito, vence nos navegadores
  modernos, e o app não se emoldura. Inofensivo; no máximo, alinhar o
  comentário.

---

## O que resistiu à análise (verificado, sem brecha)

- **Acesso ao currículo de outra pessoa (IDOR): fechado.** `urlAssinada` /
  `linkDoCurriculo` geram o link para o `caminho` que recebem — sem checagem
  própria, de propósito: a autorização mora em quem chama, e os dois
  chamadores a fazem certo:
  - `fichaDaCandidatura` (empresa vê o currículo de quem se candidatou) busca
    **só as candidaturas desta empresa** (`getCompanyApplications(empresaId)`,
    com `empresaId` da sessão) e o id da URL apenas escolhe uma dentro dessa
    lista. Id de candidatura de outra empresa → não está na lista → 404. O
    `resume_url` passado ao link nunca é arbitrário. O código ainda comenta
    por que filtra pela empresa antes em vez de "buscar e conferir o dono
    depois" — evita o esquecimento futuro da segunda metade.
  - `perfil/editar` passa o caminho do currículo **do próprio dono** (da
    sessão).
- **TTL da URL assinada: 60 segundos.** Curto — a janela de um link vazado é
  mínima, e ele nasce a cada visita, nunca é guardado no banco.
- **Bucket do currículo é privado** (`publico: false` em `regras.ts`); avatar,
  logo e feed são públicos por decisão, e não guardam dado sensível.
- **CSP efetiva.** `script-src 'self' 'nonce-…' 'unsafe-inline'`: o nonce faz o
  navegador que o entende **ignorar** `'unsafe-inline'` (comportamento da
  especificação), então a primeira linha de defesa vale; `'unsafe-inline'`
  fica só como degradação para navegador velho demais, decisão consciente
  sobre o público. `connect-src` limita a exfiltração a `self`, Supabase e
  Sentry; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'` fecham o resto. Nonce novo por requisição.
- **Cabeçalhos presentes e travados por e2e.** `cabecalhos-de-seguranca.spec.ts`
  confere, na resposta HTTP de verdade, nosniff / X-Frame-Options /
  Referrer-Policy / Permissions-Policy, a CSP em toda rota, o nonce presente e
  **único entre requisições**, `connect-src` não-curinga, e a ausência de
  `X-Powered-By`.

---

## Sugestão

Um item acionável: adicionar o HSTS (uma linha em `next.config.ts` + uma
asserção no e2e). Baixo risco, fecha o ataque de downgrade. Posso implementar
seguindo o fluxo Issue → PR, ou deixar registrado.
