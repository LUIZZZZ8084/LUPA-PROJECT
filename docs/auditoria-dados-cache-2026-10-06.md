# Auditoria adversarial — camada de dados, cache e métricas (06/10/2026)

Oitava frente da revisão de segurança: o cache das listagens (risco de servir
a lista de uma pessoa para outra) e a agregação de pressão nos tetos (risco de
e-mail cruzar do banco para a aplicação). Análise sobre o código, sem tocar
produção.

**Resumo: nenhum achado.** O cache é pessoal-seguro por construção e o e-mail
é projetado fora da métrica em SQL. Registro o que foi verificado.

---

## O que resistiu à análise (verificado, sem brecha)

- **A chave do cache carrega só os filtros, nunca quem pergunta.**
  `["vagas", city, uf, category, contract_type, q]` e o equivalente de
  prestadores — sem sessão e sem `perto`. O `perto` (quem está olhando) entra
  **depois** do cache, na ordenação por proximidade (`ordenarVagas(itens,
  filters.perto)`), então a resposta guardada é a mesma para todos e só a
  ordem é personalizada. Pôr sessão na chave seria "economia de consulta
  virando lista de uma pessoa servida a outra" — e isso é travado por um teste
  que **lê o código-fonte** (`cache-de-listagem.test.ts`) e reprova qualquer
  bloco `const chave = [` que contenha `perto`, `usuarioId`, `usuario` ou
  sessão.
- **Read-your-own-writes garantido.** As escritas chamam `updateTag` (não
  `revalidateTag`), então quem acabou de publicar/encerrar/reativar vê o
  resultado na própria resposta, sem esperar o cache de 60s vencer — fecha o
  sintoma da #76 (empresa publica e não se acha na busca).
- **O cliente cacheado não tem cookie.** A consulta usa a chave anônima por
  `grant`, não por sessão — é o que torna seguro guardar a resposta, e não só
  possível (#206).
- **O e-mail não cruza para a métrica de pressão.** `tentativas_de_acesso.chave`
  é `login:<email>`, `cadastro:<ip>`, `recuperacao:<ip>`,
  `acao:<nome>:u:<id>` — tem e-mail, IP e id dentro. A view `metricas_pressao`
  projeta isso para `rotulo` via `split_part` (o prefixo, ou o nome da ação),
  e seleciona só `rotulo`/`chaves`/`chamadas`/`bloqueadas`/`pico`. **Não há
  coluna `chave`** na view, de propósito — nenhuma consulta desta camada
  consegue trazer e-mail de volta, e `select("*")` é seguro porque o "tudo" já
  é contagem. A lista de colunas é travada por teste de schema, e a mesma
  agregação em TypeScript (modo demonstração) é comparada linha a linha com a
  do SQL.
- **Injeção no filtro do PostgREST** (reconfirmada): o termo de busca passa por
  `termoParaFiltro` antes do `.or()`/`.ilike()`, que envolve em aspas e escapa
  `\` e `"` — já auditado na primeira frente, continua certo.

---

## Panorama das frentes

| Frente | Resultado |
|---|---|
| Superfícies gerais | 2 corrigidos (#345, #346) — merged |
| Pagamentos / idempotência | 1 endurecido (#348) — merged |
| Arquivos + headers | HSTS corrigido (#350) — merged |
| RBAC / autorização | sem achados |
| E-mail e tokens | sem achados |
| Push / service worker | SSRF cego no endpoint 🟡 (P1) |
| Observabilidade / scrubbing | e-mail fora da máscara 🟢 (P2) |
| Dados / cache / métricas | sem achados |

Pendências abertas continuam sendo só **P1** e **P2** —
`auditoria-pendencias.md`.
