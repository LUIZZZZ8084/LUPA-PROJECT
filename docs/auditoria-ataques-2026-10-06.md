# Auditoria adversarial — simulação de ataques (06/10/2026)

Revisão de segurança feita "do ponto de vista de quem ataca": para cada
superfície que decide acesso, dinheiro ou identidade, a pergunta foi *como eu
quebraria isto?*. Análise sobre o código-fonte da branch, sem tocar em produção
e sem disparar nada contra o site no ar.

**Resumo:** dois pontos corrigidos — um open redirect real (impacto médio) e um
endurecimento da origem do rate-limit (impacto condicional: só explorável com um
proxy na frente da Vercel). A maioria das superfícies sensíveis resistiu à
análise — está listada no fim, porque "o que já aguenta" também é resultado de
auditoria.

> **Estado:** corrigido nas Issues
> [#345](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/345) (open redirect)
> e [#346](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/346) (origem do
> rate-limit), com testes que travam a volta.

---

> **Atualização pós-verificação (06/10, tarde).** A documentação da Vercel
> confirma que ela **sobrescreve** `x-forwarded-for` e não repassa IP externo —
> então, em Vercel pura, esta falha **não é explorável** e o comentário original
> do código estava certo. Ela volta a valer apenas com um proxy na frente da
> Vercel (um CDN/WAF como o Cloudflare), o caso que o próprio comentário admitia
> precisar reavaliar. O item fica como **endurecimento** (impacto condicional),
> não como falha explorável hoje. **Corrigido** nas Issues #346/#345.

## 🟠 1. O teto por ação depende de um header que um proxy externo torna forjável

**Onde:** `src/server/action.ts` (`chaveDoPedido`),
`src/app/(auth)/esqueci-senha/actions.ts`, e o mesmo trecho no cadastro.

**O código:**

```ts
const origem =
  cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecida";
```

**O ataque.** Para os fluxos **sem sessão** — criar conta e "esqueci minha
senha" — a chave do teto é o IP, tirado do **primeiro** valor de
`X-Forwarded-For`. Esse cabeçalho é mandado pelo cliente. Quando há um proxy na
frente (a Vercel), o padrão comum é o proxy **acrescentar** o IP real ao que já
veio, produzindo `X-Forwarded-For: <valor-do-atacante>, <IP-real>`. Pegando
`split(",")[0]`, o que fica é o valor que o atacante escolheu.

Resultado: o atacante troca o header a cada requisição

```
X-Forwarded-For: 1.1.1.1
X-Forwarded-For: 1.1.1.2
X-Forwarded-For: 1.1.1.3   ...
```

e cada tentativa cai numa chave de teto diferente. **O limite por ação deixa de
limitar.**

**Por que importa aqui, e não é teórico.** O `AGENTS.md` registra, de olhos
abertos, que o teto por ação (#202) é *a única* defesa contra abuso — captcha
foi recusado por decisão (#202, 14/09/2026: "o que contém abuso aqui é o teto
por ação, que não pede nada a ninguém"). Os dois fluvos que esta falha destrava
são exatamente os que mais doem:

- **Criação de conta em massa.** `cadastro:<origem>` some como limite. É o
  cenário que a própria decisão de recusar captcha presumia estar coberto.
- **Bombardeio de e-mail em nome da Lupa.** `recuperacao:<origem>` some. O
  `AGENTS.md` diz, na seção da #174: *"quem paga a reputação do domínio somos
  nós"*. Com a chave contornável, a tela vira um canal para disparar e-mail de
  recuperação a qualquer endereço, quantas vezes quiser — e no plano grátis do
  Resend (100/dia, #326) isso também **esgota a cota** e derruba os e-mails
  legítimos de confirmação e recuperação de todo mundo no dia.

A ironia: o comentário em `esqueci-senha/actions.ts` justifica ler do cabeçalho
dizendo *"um valor que o cliente escolhe não limita ninguém"*. O primeiro valor
do `X-Forwarded-For` **é** um valor que o cliente escolhe. A intenção correta
foi derrotada pela posição lida.

**Login não é afetado** (a chave é `login:<email>`, #), e os fluxos com sessão
usam `acao:<nome>:u:<usuarioId>`, que vem do JWT assinado — esses estão bem.

**Verdicto:** PLAUSÍVEL no nível de infra (CONFIRMADO no nível de código: a
posição lida é definitivamente a spoofável). O que falta confirmar é o
comportamento exato da borda da Vercel — se ela **sobrescreve** ou **acrescenta**
o `X-Forwarded-For`. A correção abaixo não depende de saber isso.

**Como verificar em 2 minutos.** Num deploy de preview, mande duas requisições
ao `POST` de "esqueci-senha" com `X-Forwarded-For: 9.9.9.9` e observe a chave
gravada em `tentativas_de_acesso` (ou o `metricas_pressao` do painel). Se a
contagem aparecer agrupada sob `9.9.9.9`, está spoofável.

**Correção (robusta, independente da borda):** na Vercel, o IP real do cliente
chega em `x-real-ip` (ela mesma define, e o cliente não controla essa posição),
ou via `ipAddress()` de `@vercel/functions`. Prefira isso ao `x-forwarded-for`
leftmost. Se mantiver o `x-forwarded-for`, pegue o **último** elemento (o que o
proxy confiável acrescentou), não o primeiro. E centralize a extração num único
helper — hoje o mesmo trecho está copiado em três lugares, exatamente o tipo de
duplicação que o `AGENTS.md` condena (divergem na primeira mudança). Um único
`origemDaRequisicao()` em `src/server/` fecha os três de uma vez.

---

## 🟠 2. Open redirect no `?destino=` via barra invertida

**Onde:** `src/app/(auth)/entrar/form.tsx` (`destinoSeguro`).

**O código:**

```ts
function destinoSeguro(bruto: string | undefined): string | null {
  if (!bruto) return null;
  if (!bruto.startsWith("/") || bruto.startsWith("//")) return null;
  return bruto;
}
```

depois usado em `router.replace(destinoSeguro(pretendido) ?? ...)`.

**O ataque.** A checagem barra `//evil.com` (protocolo relativo) — mas não a
**barra invertida**. O parser de URL dos navegadores trata `\` como `/` em
esquemas http(s). Então:

```
/entrar?destino=/\evil.com
```

passa em `destinoSeguro` (começa com `/`, não começa com `//`), e o navegador
resolve `/\evil.com` como `https://evil.com/`. Confirmado localmente:

```
"/\evil.com"   passa destinoSeguro: true   -> resolve: https://evil.com/
"/\/evil.com"  passa destinoSeguro: true   -> resolve: https://evil.com/
```

**Por que importa.** É exatamente o cenário que o próprio comentário da função
diz estar defendendo: *"transformaria a tela de login num trampolim: o golpista
manda o link, a pessoa entra de verdade na Lupa e é despejada num site que imita
a Lupa pedindo a senha de novo"*. O link `lupa.com.br/entrar?destino=/\...`
parece legítimo (domínio certo), a pessoa faz login de verdade, e é jogada no
site falso. Para um público menos familiarizado com phishing — o público-alvo do
app — é uma isca eficaz.

**Verdicto:** PLAUSÍVEL. O guard é definitivamente insuficiente; o grau de
exploração depende de o `router.replace` do Next 16 executar a navegação
cross-origin para um href começando com `/\`. Vale validar no navegador real
(Playwright) se o `router.replace("/\\evil.com")` de fato sai do domínio ou se o
Next o trata como rota interna e dá 404 — mas a correção é a mesma e trivial nos
dois casos.

**Correção:** validar resolvendo a URL contra a própria origem e exigir que o
resultado continue na origem, em vez de inspecionar prefixos à mão:

```ts
function destinoSeguro(bruto: string | undefined): string | null {
  if (!bruto) return null;
  try {
    const u = new URL(bruto, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}
```

Isso rejeita `//evil.com`, `/\evil.com`, `https://evil.com` e qualquer variante
futura de uma vez, porque pergunta a coisa certa ("isto continua sendo nós?") em
vez de enumerar formas de escapar.

---

## O que resistiu à análise (defesas que já aguentam)

Auditado e sem brecha encontrada — registrado para a próxima auditoria não
refazer o caminho:

- **Assinatura do webhook do Mercado Pago** (`validarAssinaturaWebhook`):
  HMAC-SHA256, `timingSafeEqual` com checagem de comprimento antes (evita o
  throw), e toda confirmação relê o estado na API deles. Forjar o corpo não
  confirma pagamento.
- **Rota do cron** (`/api/cron/reconciliar-pagamentos`): `CRON_SECRET` por
  `Authorization: Bearer`, recusa fechada e barulhenta em produção sem o
  segredo.
- **Injeção no filtro do PostgREST** (`termoParaFiltro`): escapa `\` antes de
  `"` (ordem correta) e envolve em aspas; vírgula e aspas viram literais. O
  vazamento histórico (`zzz,full_name.ilike.*`) está fechado, e é usado nos dois
  únicos pontos de `.or(` com entrada de usuário.
- **Sessão/JWT** (`session.ts`): algoritmo fixado (`HS256`, barra `alg:none`),
  `issuer`/`audience` conferidos, segredo mínimo exigido em produção, payload só
  com id e papel. Renovação preserva o `iat` do login — token revogado continua
  revogado depois de renovado; o teto de 30 dias casa com o alcance da lista de
  revogação.
- **Upload de arquivos** (`regras.ts` + `servico.ts`): caminho derivado do id da
  sessão + tabela fechada de extensões (sem `../`, sem nome do cliente). Imagem
  é decodificada e reencodada para WebP (prova que é imagem, remove GPS, elimina
  SVG/XSS). PDF checa magic bytes `%PDF-`. Tipo gravado vem do conteúdo, não do
  declarado.
- **IDOR nas rotas de status** (`/api/pagamentos/[id]`, `/api/assinaturas/[id]`):
  conferem `recurso.usuarioId === sessao.usuarioId` e respondem 404 (não 403)
  para alheio e para anônimo.
- **Portão do proxy** (`proxy.ts`): default fechado, matcher com `\\.` escapado,
  rotas de webhook/cron fora do muro mas autenticadas por assinatura/segredo. As
  rotas admin (`/admin`, `/admin/painel`, `/api/admin/metricas`) **também** se
  autoprotegem com `pode()` no próprio handler — defesa em profundidade real, o
  bypass por extensão não as alcança.

---

## Sugestão de próximos passos

1. Confirmar a falha #1 num preview (2 min, acima) e corrigir com `x-real-ip` +
   helper único. É a de maior impacto no modelo de abuso adotado.
2. Corrigir a #2 com validação por `URL` — trivial e definitiva.
3. Cada correção acompanhada de um teste que trava a volta (o padrão do projeto):
   para a #1, um teste que prove que a origem não vem de posição spoofável; para
   a #2, um que alimente `/\evil.com` e exija `null`.
