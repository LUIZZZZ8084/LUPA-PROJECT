# Auditoria adversarial — observabilidade e scrubbing (06/10/2026)

Sétima frente da revisão de segurança: o que sai para o Sentry — a máscara
de dado pessoal (`scrubSensitiveData`) e a configuração do SDK. Análise sobre
o código, sem tocar produção.

**Resumo:** um ponto de defesa em profundidade — a máscara **não cobre
e-mail**. **Não há vazamento ativo hoje** (os dois caminhos de captura estão
fechados), mas a lacuna é inconsistente com o modelo de ameaça do próprio app
e é frágil. O resto do scrubbing é notavelmente cuidadoso.

---

## 🟢 A máscara não cobre e-mail (defesa em profundidade)

**Onde:** `src/lib/observability.ts` → `scrubSensitiveData`.

A máscara remove por **nome de campo**
(`phone|telefone|whatsapp|cpf|cnpj|documento|…|token|secret|resume|curriculo`)
e por **regex de valor** (CNPJ, CPF, telefone). **`email` não está em
nenhum dos dois** — nem como nome de campo, nem como regex de valor.

Isso contradiz o modelo de ameaça que o próprio app repete: a lista de
e-mails é a lista de quem está procurando emprego, e numa cidade do tamanho
de Sinop isso pode custar o emprego atual de alguém — é por isso que o fluxo
de recuperação de senha toma o cuidado explícito de **não** logar o endereço.
Esse cuidado ad-hoc existe justamente porque a máscara não cobre e-mail.

**Por que é 🟢 (sem vazamento ativo hoje), com honestidade:**

- `sendDefaultPii: false` nos dois SDKs (servidor e cliente) — o Sentry **não**
  captura automaticamente corpo de requisição, cookie nem IP. O corpo do POST
  de login/cadastro/recuperação (que tem e-mail) não é anexado sozinho.
- `criarAcao` loga, em erro de validação, só os **nomes** dos campos
  (`campos: [...]`), nunca os valores; em erro de execução, só
  `requestId`/`acao`/`ms`. O e-mail de entrada não é logado.

Então, para um e-mail chegar ao Sentry hoje, seria preciso código que o
coloque **à mão** numa mensagem de exceção ou num contexto de log — e aí a
máscara não o pegaria. É o defeito esperando acontecer: um `log.erro(e, {
usuario })` ou um `throw new Error(\`conta \${email} já existe\`)` num fluxo
novo vaza em silêncio, porque a máscara o deixa passar.

**Correção sugerida.** Acrescentar `email` ao regex de nome de campo
(`CAMPOS_SENSIVEIS`) e um regex conservador de endereço de e-mail para
strings soltas (`[\w.+-]+@[\w.-]+\.\w+` → `[email]`). Mascarar e-mail de um
texto de erro é sempre seguro — some a necessidade do cuidado ad-hoc. Teste
que alimenta `{ email: "x@y.com" }` e uma mensagem com e-mail e exige a
máscara.

---

## O que resistiu à análise (verificado, sem brecha)

- **`sendDefaultPii: false`** nos dois SDKs — sem IP, sem cabeçalho de
  identificação, sem corpo de requisição automático.
- **Máscara robusta para telefone, CPF e CNPJ** (inclusive CNPJ alfanumérico
  com pontuação, #297), com a ordem do mais específico para o mais genérico —
  "mascarar a mais é seguro; a menos, não".
- **Identificadores de rastreio preservados** (`trace_id`, `span_id`,
  `release`, …) por **duas** condições juntas — o nome do campo **e** o
  formato hexadecimal —, o que conserta as transações descartadas da #275 e
  da #277 sem abrir buraco: um texto com telefone numa chave `trace_id`
  continua mascarado.
- **Ciclo não derruba a máscara** (#273): referência circular vira
  `"[circular]"` em vez de estourar a pilha — e uma exceção aqui produziria
  o único evento que sai **sem** máscara, então a robustez importa.
- **O erro inesperado vai ao Sentry pelo logger**, e o evento ainda passa por
  `scrubSensitiveData` no `beforeSend`/`beforeSendTransaction` — segunda
  camada sobre o que o logger já limpou.

---

## Panorama das frentes

| Frente | Resultado |
|---|---|
| Superfícies gerais | 2 corrigidos (#345, #346) — merged |
| Pagamentos / idempotência | 1 endurecido (#348) — merged |
| Arquivos + headers | HSTS corrigido (#350) — merged |
| RBAC / autorização | sem achados |
| E-mail e tokens | sem achados |
| Push / service worker | SSRF cego no endpoint 🟡 (a corrigir) |
| Observabilidade / scrubbing | e-mail fora da máscara 🟢 (a corrigir) |
