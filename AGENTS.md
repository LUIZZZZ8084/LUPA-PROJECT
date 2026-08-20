# Lupa — notas para agentes

Plataforma hiperlocal de emprego e serviços. Cidade-piloto: Sinop-MT.
O brief completo do produto está em `docs/brief-tecnico.md`.

## Comandos

```bash
npm run dev      # desenvolvimento em http://localhost:3000
npm run build    # build de produção
npm run verify   # tipos + lint + código morto + arquitetura + cobertura
npm run e2e      # Playwright (sobe um build de produção)
```

`npm run verify` é o mesmo conjunto que roda na CI. Detalhes de cada
ferramenta em `docs/qualidade.md`.

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
  Erros enviados ao Sentry passam por `scrubSensitiveData`, que remove
  telefone, CPF, CNPJ e afins — é obrigação de LGPD, com teste que trava.

## Armadilhas que já custaram caro

Três bugs reais deste projeto, cada um com um teste que impede a volta:

- **`useSearchParams()` exige `<Suspense>`, e esse boundary pode nunca
  resolver.** A barra de filtros ficou invisível e inerte em produção: o
  conteúdo era transmitido mas ficava preso num `<template>`. A busca não
  funcionou para ninguém. Hoje os valores descem por prop do Server
  Component, que já leu os `searchParams`.
- **`truncate` num elemento que também é `flex` não corta o texto** — o
  ellipsis não se aplica e o `nowrap` trava a largura, empurrando a página
  para fora da tela. O truncate vai num `<span>` de texto dentro do flex.
- **Grade responsiva sem `grid-cols-1` explícito** dimensiona a coluna
  implícita por `min-content`, e o card impõe largura maior que a tela.

Os dois últimos têm contrato automático em `tests/unit/cards.test.tsx`, que
varre o código-fonte. O primeiro é coberto pelo Playwright.

- **Verifique o que você diz que verificou.** Eu já declarei "filtro
  funcionando" tendo conferido só a contagem de resultados via URL, sem
  nunca ter clicado no filtro. Ele estava quebrado havia dias.
