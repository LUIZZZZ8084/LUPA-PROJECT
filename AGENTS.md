# Lupa — notas para agentes

Plataforma hiperlocal de emprego e serviços. Cidade-piloto: Sinop-MT.
O brief completo do produto está em `docs/brief-tecnico.md`.

## Comandos

```bash
npm run dev      # desenvolvimento em http://localhost:3000
npm run build    # build de produção (roda type-check)
npm run lint     # ESLint
npx tsc --noEmit # só o type-check
```

## Como o app está montado

- **Next.js 16 (App Router) + TypeScript + Tailwind v4.** Sem `tailwind.config` —
  os tokens de design vivem em `@theme` dentro de `src/app/globals.css`.
- **Modo demonstração.** Sem as variáveis do Supabase no ambiente, toda a
  camada de dados (`src/lib/data.ts`) cai para `src/lib/mock-data.ts` e o app
  roda completo com dados de Sinop. É o que permite demonstrar antes de
  existir infraestrutura. Cada função de dados tenta o Supabase primeiro.
- **Banco.** `supabase/schema.sql` é a fonte da verdade — tabelas, RLS,
  triggers e as views que a aplicação consulta (`job_listings`,
  `provider_listings`, `company_applications`, `verification_queue`).
  `src/lib/types.ts` espelha esse schema; altere os dois juntos.
- **Sem chat interno.** O contato com prestador acontece por deep link
  `wa.me` (`src/lib/format.ts` → `whatsappLink`). Isso é decisão de produto
  do V0, não uma pendência.

## Convenções

- **Idioma:** interface, comentários e mensagens de commit em português.
  Identificadores de código em inglês, exceto termos do domínio que já são
  do schema (`candidato_clt`, `prestador_servico`, `empresa`).
- **Cores por vertical:** verde `vagas` = emprego, azul `servicos` =
  prestadores, roxo `empresas` = painel da empresa. Use as classes de token
  (`text-vagas`, `bg-servicos/12`), nunca hex solto.
- **Multi-cidade:** toda entidade tem `city`. A UI trava em Sinop através de
  `PILOT_CITY` em `src/lib/constants.ts`; abrir outra cidade não deve exigir
  migração de schema.
- **Dados sensíveis:** documento e selfie vão para o bucket privado
  `verificacao` e são apagados na decisão do admin. Não afrouxe isso.
