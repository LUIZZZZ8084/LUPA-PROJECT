# Roadmap da auditoria — frentes a verificar

Índice de todas as frentes da auditoria do Lupa: o que já foi varrido, o que
falta, e a rodada de correção. Cada frente feita aponta para o seu relatório;
cada pendência aponta para `auditoria-pendencias.md`.

**Legenda:** ✅ feita · 🔜 a fazer · 🟠🟡🟢 severidade do achado em aberto.

Base: auditoria de 06/10/2026. Atualize este arquivo ao fechar uma frente —
ele é o único lugar que responde "o que já foi auditado e o que falta" sem
reconstruir a história pelos commits.

---

## Fase 1 — Frentes verificadas (9)

| # | Frente | Resultado | Relatório |
|---|---|---|---|
| 1 | Superfícies gerais (webhook, sessão/JWT, injeção PostgREST, uploads, proxy) | ✅ 2 corrigidos (#345, #346) | `auditoria-ataques-2026-10-06.md` |
| 2 | Pagamentos / estorno / idempotência | ✅ 1 endurecido (#348) | `auditoria-pagamentos-2026-10-06.md` |
| 3 | Arquivos privados + cabeçalhos | ✅ IDOR ok; HSTS corrigido (#350) | `auditoria-arquivos-headers-2026-10-06.md` |
| 4 | RBAC / autorização / IDOR | ✅ sem achados | `auditoria-rbac-2026-10-06.md` |
| 5 | E-mail e tokens (recuperação/verificação) | ✅ sem achados | `auditoria-email-tokens-2026-10-06.md` |
| 6 | Push / service worker | 🟡 SSRF cego no endpoint (P1) | `auditoria-push-2026-10-06.md` |
| 7 | Observabilidade / scrubbing do Sentry | 🟢 e-mail fora da máscara (P2) | `auditoria-observabilidade-2026-10-06.md` |
| 8 | Dados / cache / métricas | ✅ sem achados | `auditoria-dados-cache-2026-10-06.md` |
| 9 | Escala (10 mil usuários) | 🟠 fan-out de push (P3) | `auditoria-escala-2026-10-06.md` |

---

## Fase 2 — Frentes a verificar (🔜)

Ordenadas por risco e por valor para o requisito de 10 mil usuários.

### A. Resiliência de dependências externas 🔜 — **prioridade alta**
O que acontece quando Mercado Pago, BrasilAPI, Resend ou Supabase ficam
lentos ou fora do ar.
- Timeout em toda chamada de rede (a `cnpj.ts` e a `mercadopago.ts` já usam
  `AbortSignal.timeout`; conferir Resend e as demais).
- Degradação graciosa: a falha vira erro de usuário, fila para varredura, ou
  queda silenciosa? Mapear cada uma e confirmar que nenhuma trava o caminho
  crítico (cadastro/login não podem depender de terceiro).
- Retry/back-off onde faz sentido; e onde **não** retentar (webhook, cobrança).
- Circuit breaking / o efeito de um terceiro lento somar latência ao `after()`.

### B. Admin, fila de verificação e moderação 🔜 — **prioridade média**
- A tela `/admin` e as actions de decisão de verificação (`admin:decidir_
  verificacao`, `admin:moderar`) — autorização, IDOR, e o que o admin **não**
  pode (escrita com dono).
- Impersonação registrada em log (o `AGENTS.md` cita como caminho futuro) —
  existe? É auditável?
- Bucket privado `verificacao` (documento/selfie) — RLS, apagamento na
  decisão, e o teste que trava.

### C. Validação de entrada / mass-assignment 🔜 — **prioridade média**
- Varredura de todos os schemas Zod das actions: campos que não deviam ser
  aceitos (papel, usuarioId, preço, status) são descartados? (Parcialmente
  visto em RBAC e perfil — fechar o resto: vagas, candidaturas, publicações,
  avisos, pagamentos.)
- Coerção de tipo e limites (tamanho de string, número negativo, unicode,
  normalização) nos campos que viram chave ou valor monetário.

### D. Storage e políticas RLS 🔜 — **prioridade média**
- `storage.sql`: limites de bucket e `allowed_mime_types` (já citados na #332)
  — conferir que os quatro buckets batem com `REGRAS` e que o teste cobre.
- RLS de todas as tabelas: o teste de grants varre `anon`/`authenticated`;
  confirmar que nenhuma policy nova abriu brecha, e que o `revoke` está escrito
  para cada tabela sensível (a lição de `pedidos_verificacao`).

### E. Cliente / React / XSS 🔜 — **prioridade média**
- `dangerouslySetInnerHTML`, `eval`, injeção em `href`/`src` montados de dado
  de usuário (o open redirect do #345 foi um caso; procurar os irmãos).
- Fronteira `"use client"`: Server Component não pode vazar segredo/PII para o
  bundle do cliente (o telefone do prestador na home pública foi um quase-caso).
- O gerador de currículo em PDF (`@react-pdf/renderer`) — injeção via dado de
  perfil no documento.

### F. Ciclo de vida de dados / LGPD 🔜 — **prioridade média**
- Exclusão de conta: existe? O `on delete cascade` cobre os dados derivados
  (candidaturas, avaliações, inscrições push, pagamentos, arquivos no bucket)?
- Retenção: `buscas_sem_resultado`, `visualizacoes_vaga`, `tentativas_de_acesso`
  — o que é apagado e quando (parte já visto na escala).
- Direito de acesso/portabilidade — fora do escopo do piloto, registrar como
  decisão.

### G. Concorrência fora de pagamentos 🔜 — **prioridade média-baixa**
- Troca de papel (`virarPrestador`) sob corrida; limite de publicações
  (trigger em `publicacoes` — já citado, confirmar); consumo de crédito de
  vaga (atômico — reconfirmar end-to-end).
- Duplo clique / reenvio em cada action que cria registro com efeito colateral.

### H. Abuso de regra de negócio 🔜 — **prioridade média-baixa**
- Manipulação de reputação (avaliação) além da trava "uma por pessoa".
- Inflação de visualização de vaga (já mitigado por não contar o dono e por
  contagem por dia — reconfirmar).
- O buraco teste-grátis + devolução (já documentado e aceito no `AGENTS.md` —
  só confirmar que os números batem).

### I. Carga real / perf sob 10 mil 🔜 — **prioridade alta (requer ambiente)**
- Teste de carga de verdade (k6/Artillery) contra um preview: `/vagas`,
  `/servicos`, login, publicar — medir p95, saturação das 3 conexões, e a
  cota de invocação da Vercel (o teto que chega primeiro).
- Validar na prática as observações de capacidade da frente de escala.
- **Nota:** é a única frente que exige rodar contra infraestrutura, não só ler
  código.

### J. Segredos e cadeia de suprimentos 🔜 — **prioridade média-baixa**
- Nenhum segredo versionado (há teste que trava `NEXT_PUBLIC_` em chave de
  serviço — confirmar cobertura para todos os segredos).
- `npm audit` na CI (já roda; confirmar que cobre o que precisa).
- Permissões do GitHub Actions / Vercel; superfície do webhook e do cron.

---

## Fase 3 — Rodada de correção (pendências abertas)

Ver `auditoria-pendencias.md` para o detalhe. Ordem sugerida por impacto:

1. **P3 — fan-out de push** 🟠 (escala): caixa de saída + cron em lotes.
2. **P1 — SSRF do endpoint push** 🟡: allowlist de host + `https`.
3. **P2 — e-mail no scrubber** 🟢: `email` no regex + regex de endereço.

E a pendência operacional: rodar
`supabase/aplica-mensalidade-prestador-atomica.sql` antes do próximo deploy.

---

## Como fechar uma frente

1. Varrer o código da frente, de forma adversarial.
2. Escrever `docs/auditoria-<frente>-YYYY-MM-DD.md`: achados (com severidade
   honesta e exploração concreta) **e** o que resistiu.
3. Achado acionável → linha em `auditoria-pendencias.md`.
4. Marcar ✅/🟠 aqui, nesta tabela.
