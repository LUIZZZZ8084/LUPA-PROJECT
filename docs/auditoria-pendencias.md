# Auditoria de segurança — pendências a corrigir

Registro vivo dos itens **acionáveis** levantados pela auditoria de 06/10 que
ainda **não** foram corrigidos. Quando um for resolvido, mova-o para "Feito"
com o PR, para este arquivo não virar mentira (como o ROADMAP já foi uma vez).

Cada item aponta para o relatório da frente onde o achado está detalhado.

---

## Em aberto

| # | Item | Severidade | Onde | Relatório |
|---|---|---|---|---|
| P1 | **SSRF cego no `endpoint` da inscrição push.** O endpoint vem do cliente, validado só como `z.url()`; o servidor faz POST para ele sem allowlist dos serviços de push conhecidos. Cego e TLS-only, mas o servidor inicia requisição para onde o cliente mandar. **Fix:** restringir o host (FCM/Mozilla/WNS/Apple) + exigir `https`, com teste. | 🟡 baixa-a-média | `src/server/notificacoes/schemas.ts`, `push.ts` | `auditoria-push-2026-10-06.md` |
| P2 | **`scrubSensitiveData` não cobre e-mail.** Nem nome de campo nem regex de valor. Sem vazamento ativo hoje (`sendDefaultPii: false` + `criarAcao` não loga valores de entrada), mas frágil e inconsistente com o modelo de ameaça (lista de e-mails = quem procura emprego). **Fix:** `email` no regex de nome + regex de endereço de e-mail para strings, com teste. | 🟢 baixa (defesa em profundidade) | `src/lib/observability.ts` | `auditoria-observabilidade-2026-10-06.md` |

## Observações menores, sem ação decidida (registro, não dívida)

- `img-src 'self' data: blob: https:` aceita imagem de qualquer host HTTPS —
  canal teórico de exfiltração, mitigado pelo `script-src` trancado. Apertar
  para os domínios do Supabase seria mais puro; ganho pequeno.
  (`auditoria-arquivos-headers-2026-10-06.md`)
- `Permissions-Policy: geolocation=(self)` — o app não usa GPS; `geolocation=()`
  seria o mais justo. Risco nulo. (idem)
- Divergência de redação entre `X-Frame-Options: SAMEORIGIN` e CSP
  `frame-ancestors 'none'` — o mais estrito vence; no máximo alinhar o
  comentário. (idem)

---

## Feito (corrigido e mergeado)

| Item | Severidade | PR |
|---|---|---|
| Open redirect no `?destino=` por barra invertida | 🟠 média | #347 (Closes #345) |
| Origem do rate-limit lia posição forjável do `X-Forwarded-For` | 🟠 (condicional) | #347 (Closes #346) |
| `source-map-js` com advisory de alta (GHSA-68fv-2mgg-jv7q) | 🟠 alta | #347 |
| Mensalidade do prestador estendida em JS (corrida latente) → SQL atômico | 🟡 endurecimento | #349 (Closes #348) |
| Falta do cabeçalho HSTS | 🟠 baixa-a-média | #351 (Closes #350) |

## Frentes sem achados (registro)

- **RBAC / autorização** — `auditoria-rbac-2026-10-06.md`
- **E-mail e tokens** (recuperação/verificação) — `auditoria-email-tokens-2026-10-06.md`
- **Arquivos privados** (URL assinada do currículo, sem IDOR) — `auditoria-arquivos-headers-2026-10-06.md`

---

## Pendência operacional (não é de código)

- Rodar `supabase/aplica-mensalidade-prestador-atomica.sql` no SQL Editor de
  produção **antes do próximo deploy** (migração do #348, já na `main`). Já
  registrada na tabela de migrações de `docs/supabase.md`.
