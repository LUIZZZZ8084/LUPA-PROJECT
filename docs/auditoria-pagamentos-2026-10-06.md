# Auditoria adversarial — pagamentos, estorno e reconciliação (06/10/2026)

Segunda frente da revisão de segurança, focada em **corridas e
idempotência** no caminho que move dinheiro: confirmação de cobrança,
parcela de assinatura, estorno/chargeback, cancelamento e a varredura de
reconciliação. Análise sobre o código, sem tocar produção.

**Resumo honesto: nenhuma corrida ou falha de idempotência explorável foi
encontrada.** A camada é sólida e visivelmente pensada para reenvio de
webhook. Há **uma fragilidade latente** (não explorável hoje) que vale
endurecer por consistência. O resto deste documento registra o que foi
verificado — porque "o que já aguenta" é resultado de auditoria, e a
próxima não precisa refazer o caminho.

---

## 🟡 Único ponto: a mensalidade do prestador estende em JS, não no SQL

**Onde:** `src/server/prestadores/servico.ts` → `estenderMensalidade`.

```ts
const baseMs = perfil.mensalidadeValidaAte
  ? Math.max(Date.now(), new Date(perfil.mensalidadeValidaAte).getTime())
  : Date.now();
const novaValidade = new Date(baseMs + dias * 86_400_000).toISOString();
await repo.definirMensalidadeValidaAte(usuarioId, novaValidade);
```

Isto é um **ler-modificar-gravar na aplicação**: lê a validade atual,
calcula `max(agora, atual) + dias` em JS, grava. Duas chamadas concorrentes
para o mesmo prestador leriam a mesma base e uma extensão se perderia.

**Contraste:** o equivalente do plano de vaga (`estender_mensalidade_vaga`,
em `supabase/schema.sql`) faz exatamente a mesma conta **dentro de uma
instrução SQL**, onde a corrida não existe:

```sql
set mensalidade_valida_ate =
  greatest(now(), coalesce(carteiras_vaga.mensalidade_valida_ate, now()))
  + make_interval(days => p_dias)
```

**Por que NÃO é explorável hoje** (e por isso é 🟡, não 🔴): toda chamada a
`estenderMensalidade` é serializada a montante pela idempotência do estado.
Uma renovação vira no máximo **uma** chamada porque `registrarLiquidada`
insere com índice único em `mp_payment_id` — o `payment` e o
`subscription_authorized_payment` da mesma parcela, ou um reenvio, esbarram
no `23505` e só um corpo roda. E duas cobranças *distintas* do mesmo
prestador são mensais (a concessão do teste grátis acontece 30 dias antes da
primeira parcela). Não há, no código atual, dois `estenderMensalidade`
concorrentes para o mesmo usuário.

**O risco é de regressão, não de agora.** O dia em que alguém adicionar um
caminho que estenda a mensalidade fora da máquina de estado de pagamento —
ou o Mercado Pago mudar a semântica dos tópicos — a perda de escrita
aparece, silenciosa, na validade de quem pagou. O plano de vaga é imune por
construção; o do prestador depende de um invariante externo que nada no
arquivo garante.

**Correção sugerida (endurecimento):** mover o `max(agora, atual) + dias`
para dentro de uma função SQL, no mesmo molde de `estender_mensalidade_vaga`
(upsert com `greatest(now(), coalesce(...)) + make_interval`). `revogar`
já é um `set ... = null` simples e está correto. É uma mudança de banco
(migração) com teste no `schema.test.ts`, no padrão do projeto.

---

## O que resistiu à análise (verificado, sem brecha)

- **Idempotência da parcela de assinatura** (`registrarLiquidada`): o
  `insert` com índice único em `mp_payment_id` é a trava, aplicada **antes**
  de `aplicarEfeito`. Dois avisos da mesma parcela (tópicos `payment` e
  `subscription_authorized_payment`, ou reenvio) → o segundo vira `23505` →
  `null` → nenhum efeito dobrado. Estender 60 dias por uma cobrança é
  impossível.
- **Confirmação de pagamento único** (`aprovar`/`rejeitar`/`cancelar`):
  `update ... where status = 'pendente'` — condicional na própria
  instrução. Duas notificações concorrentes → só uma pega a linha, a outra
  recebe `null`. `aplicarEfeito` roda uma vez.
- **Estorno e chargeback** (`estornar`): parte de `aprovado` (não de
  `pendente`, correto — o dinheiro já entrou), condicional na instrução.
  Reenvio do `refunded` → segundo recebe `null`, `desfazerEfeito` não roda
  duas vezes. A distinção `estornado`/`contestado` é gravada no único
  momento em que existe (corpo do webhook).
- **Ordem estorno → cancelar assinatura:** no webhook, estorna a cobrança e
  só então encerra e cancela a assinatura — a autorização não fica viva
  cobrando de novo quem contestou. `definirStatusAssinatura` recusa sair de
  `cancelada` (terminal), então um "autorizada" atrasado não ressuscita.
- **Concessão do teste grátis** (`confirmarAssinatura`): mesmo com a leitura
  de `eraPendente` feita antes do `update`, o portão real é o
  `definirStatusAssinatura` condicional (`neq status`) devolver a linha —
  só o vencedor da transição `pendente → ativa` concede os dias. Reautorização
  após `pausada` não re-concede (eraPendente = false).
- **Carteira de vagas** (`creditar`/`consumir`/`debitar`): funções SQL
  atômicas. `creditar_vaga` usa `greatest(0, saldo + q)` e há CHECK
  `creditos_vaga >= 0` — estorno de pacote "para em zero", como documentado,
  sem saldo negativo. `consumir_credito_vaga` é `update ... where
  creditos_vaga > 0`, condicional.
- **Reconciliação** (`reconciliarPagamentosPendentes`): precedência
  explícita do pagamento `approved` entre as tentativas (não herda a ordem
  do Mercado Pago), não toca o que ainda pode virar dinheiro (`pending`),
  conta pelo que mudou no banco (não por tentativa), e uma cobrança que
  estoura não derruba a varredura. Tudo passa por `confirmarPagamento`, que
  é idempotente.
- **Valor pago** (`conferirValorPago`): confere o `transaction_amount`
  relido contra a cobrança e avisa ao Sentry na divergência, sem barrar —
  postura declarada e coerente (barrar seguraria crédito de quem pagou).

---

## Sugestão

O único item acionável é o endurecimento da mensalidade do prestador para
SQL atômico. É baixo risco e baixo esforço, e alinha o caminho do prestador
ao do plano de vaga — que já é o jeito certo e está ali do lado como molde.
Posso implementar (migração + teste) se você quiser, ou deixar registrado
como melhoria para quando mexerem nessa área.
