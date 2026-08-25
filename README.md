# Lupa

Plataforma hiperlocal de emprego e serviços. Conecta três públicos —
candidatos a vaga CLT, prestadores de serviço autônomos e empresas
contratando — com busca filtrada por cidade, bairro e categoria, perfis
verificados e contato direto no WhatsApp.

Cidade-piloto: **Sinop-MT**. O objetivo é substituir os grupos de WhatsApp de
"vagas Sinop" por algo que se possa filtrar e no qual se possa confiar.

O nome vem de **Lu**iz + **Pa**ulinho — e de "lupa", o instrumento de quem
procura.

---

## Rodando o projeto

```bash
npm install
npm run dev
```

Abre em <http://localhost:3000>.

**Não precisa de banco para começar.** Sem as variáveis do Supabase, o app
sobe em *modo demonstração* com dados reais de Sinop: 10 vagas, 9 prestadores,
avaliações, candidaturas e o painel da empresa. É o suficiente para mostrar o
produto para alguém.

## Ligando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode `supabase/schema.sql` (tabelas, RLS, triggers,
   views e buckets).
3. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`
   e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API).
4. Reinicie o `npm run dev`. A camada de dados passa a ler do banco sozinha.

Para dados de desenvolvimento em ambiente **local**, rode também
`supabase/seed.sql` (só funciona no `supabase start` ou em instância própria —
ele insere direto em `auth.users`).

## Estrutura

```
src/
  app/
    page.tsx              Home — três verticais + destaques
    vagas/                Busca de vagas e detalhe com candidatura
    servicos/             Busca de prestadores e perfil público
    empresa/              Painel "Minha Empresa" e publicação de vaga
    cadastro/  entrar/    Autenticação com seleção de papel
    admin/                Fila de verificação manual (fundador)
    icon.tsx  manifest.ts Ícones e PWA gerados em build
  components/             UI, cards, filtros, selos, botão WhatsApp
  lib/
    data.ts               Camada de dados (Supabase → fallback demo)
    mock-data.ts          Dados de demonstração de Sinop
    types.ts              Tipos espelhando o schema
    constants.ts          Cidade-piloto, bairros, categorias
supabase/
  schema.sql              Schema, RLS, triggers, views, buckets
  seed.sql                Dados de desenvolvimento (local)
docs/
  brief-tecnico.md        Brief de produto completo
  esboco-visual.html      Esboço original de identidade visual
```

## Decisões de produto que estão no código

- **Sem chat interno.** O contato com prestador vai por deep link `wa.me`
  com mensagem pré-preenchida. O público-alvo já vive no WhatsApp, e isso
  tira um sistema inteiro do escopo do V0.
- **Quem contrata serviço não precisa de conta.** Busca, filtra e chama no
  WhatsApp. Conta só é necessária para candidatar-se a vaga, ter perfil de
  prestador ou publicar vaga.
- **Verificação é manual no V0.** O fundador aprova em `/admin`. A imagem do
  documento é apagada do storage na decisão — fica só o status no perfil,
  conforme a política de retenção da LGPD.
- **Multi-cidade desde o começo.** Toda entidade tem `city`; a UI trava em
  Sinop via `PILOT_CITY`. Abrir Sorriso ou Lucas do Rio Verde é mudar uma
  flag, não migrar banco.
- **PWA, não app de loja.** Manifest e ícones gerados em build; "adicionar à
  tela inicial" sem revisão da Apple ou do Google.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase
(Postgres + Auth + Storage) · Vercel

## O que falta

Veja o [ROADMAP.md](ROADMAP.md) — é mantido atualizado a cada mudança
relevante, em vez de duplicado aqui.

## Contribuindo

Duas pessoas trabalham neste projeto. O fluxo de trabalho (Issue → branch
→ PR) está em [CONTRIBUTING.md](CONTRIBUTING.md), com o porquê de cada
regra em [AGENTS.md](AGENTS.md).
