# Lupa — Especificação Técnica para Implementação

> Este documento é o brief técnico completo do projeto "Lupa". Use-o como contexto inicial para gerar a estrutura do projeto, o schema de banco de dados e a implementação dos fluxos descritos, na ordem sugerida na seção 12.

> **Este é o brief original, não o estado atual.** Ele é mantido como está
> de propósito: é o ponto de partida, e reescrevê-lo apagaria a razão de
> várias decisões. Onde o produto já andou além dele, o item aparece
> riscado com a nota do que mudou. Para saber o que existe hoje, veja o
> [ROADMAP.md](../ROADMAP.md); para o porquê de cada decisão de
> arquitetura, o [AGENTS.md](../AGENTS.md).

## 0. Identidade de marca

- **Nome:** Lupa. Origem dupla e intencional: (1) combinação de Luiz (fundador) + Paulinho (cofundador técnico) — "LU" + "PA"; (2) "lupa" é uma palavra real do português (instrumento de busca/aumento), o que já comunica a proposta do produto — ajudar a pessoa a encontrar a vaga, o profissional ou o candidato certo.
- **Ícone/logo:** referência visual de lupa (ícone de busca), reforça a metáfora de "encontrar" em qualquer tela.
- **Tom:** direto, local, sem enrolação — "Encontre trabalho e profissionais perto de você."
- **Tema visual:** dark theme, com três cores de destaque por vertical. ~~(verde = vagas/emprego, azul = serviços, roxo = empresas), conforme conceito visual já validado pelo fundador.~~ **Trocado.** Paleta "Sinalização" desde a [#106](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/106): verde-limão = vagas/emprego, laranja = serviços, azul = empresas. Comparada contra três outras opções — contraste calculado e um protótipo navegável do app inteiro — antes de decidir.
- **Cidade-piloto:** Sinop-MT (~300 mil habitantes). Arquitetura e dados já são multi-cidade desde o V0 (campo `city` em todas as entidades relevantes) para permitir expansão para outras cidades do interior sem retrabalho estrutural.

## 1. Visão geral do produto

Lupa é uma plataforma hiperlocal de emprego e serviços que conecta três públicos: candidatos a vaga formal (CLT), prestadores de serviço avulso (autônomos) e empresas contratantes. O objetivo é substituir os grupos de WhatsApp de "vagas Sinop" — hoje o canal dominante, mas desorganizado, sem filtro, onde a informação se perde em minutos — por um produto com busca segmentada por categoria e bairro, perfis verificados e avaliações. O lançamento é em Sinop-MT, com expansão planejada para outras cidades do interior assim que o modelo for validado.

## 2. Personas e papéis de usuário

| Papel | Quem é | O que faz na plataforma |
|---|---|---|
| `candidato_clt` | Pessoa buscando emprego formal | Busca vagas por cidade/categoria/tipo, envia currículo, acompanha candidaturas |
| `prestador_servico` | Autônomo (eletricista, diarista, pintor, encanador, pedreiro etc.) | Cria perfil com fotos, categoria, preço "a partir de", área de atendimento; é encontrado via busca e contatado direto pelo WhatsApp |
| `empresa` | Pessoa jurídica contratando | Publica vagas CLT, recebe e gerencia candidaturas, tem painel próprio ("Minha Empresa") |

Quem contrata um prestador de serviço (ex.: família procurando diarista) **não precisa ter conta nem publicar pedido** — apenas busca, filtra e clica em "Conversar no WhatsApp". Isso elimina a necessidade de um sistema de mensagens interno e de um fluxo de "pedido de serviço" — reduz o escopo do V0. O contato acontece fora da plataforma, via `wa.me` deep link.

## 3. Diferencial central (não pode faltar no V0)

1. Busca com filtro real por **cidade + categoria + bairro/tipo** (isso é o que o grupo de WhatsApp não tem).
2. Perfil de prestador com prova social: foto, avaliação (nota + nº de avaliações), anos de experiência, "a partir de R$X".
3. Selo de verificação (telefone verificado, documento verificado) visível no perfil e nos cards de busca — principal fator de confiança pra alguém contratar um estranho pra ir à sua casa.
4. Contato direto via WhatsApp (`wa.me/<telefone>?text=<mensagem pré-preenchida>`) — sem chat interno no V0.

## 4. Escopo do MVP (V0)

Incluir:
- Cadastro/login (e-mail + telefone) para as 3 personas, com seleção de tipo de conta.
- Perfil de candidato CLT: dados básicos, área desejada, experiências, formação, habilidades, upload de currículo em PDF (sem gerador automático ainda).
- Perfil de prestador de serviço: categoria (lista fixa inicial: eletricista, diarista, pintor, encanador, pedreiro, jardineiro, cuidador — expansível), descrição, fotos (até 5), preço "a partir de", bairros/região atendida, telefone de contato.
- Verificação **manual** no V0: upload de foto de documento + selfie, revisão manual pelo próprio fundador via painel admin simples (sem integração de KYC automatizado ainda — ver seção 8).
- Empresa: cadastro com CNPJ, painel "Minha Empresa" com vagas ativas, contagem de currículos recebidos e visualizações, botão "Publicar nova vaga".
- Vaga CLT: título, descrição, categoria, cidade/bairro, faixa salarial, tipo de contrato; candidatura in-app (o candidato "aplica" e a empresa vê lista de currículos).
- Busca/listagem de vagas com filtro por cidade, categoria, tipo.
- Busca/listagem de prestadores com filtro por cidade, categoria, avaliação; botão de contato via WhatsApp em cada card e no perfil.
- Sistema de avaliação (nota 1-5 + comentário) para prestadores, exibido em card e em tela de avaliações.
- Painel admin simples (para o fundador aprovar verificações e moderar denúncias).

Fora do escopo do V0 (adiar para V1/V2):
- Gerador automático de currículo (upsell pago).
- Verificação facial/documental automatizada via provedor de KYC.
- Chat interno (contato continua via WhatsApp).
- App nativo (o V0 é web responsivo / PWA — ver seção 9).
- Cobrança/assinatura automatizada (validar demanda antes de cobrar; ligar pagamento assim que houver tração real).
- Boost/impulsionamento pago de perfil de prestador.
- Notificação push segmentada (V0 pode usar e-mail; push fica pro V1).
- ~~Multi-cidade ativo na UI (o schema já suporta, mas o V0 só abre busca/cadastro para Sinop — outras cidades entram em V1+ conforme demanda).~~ **Superado.** Os 142 municípios de MT valem no cadastro, na vaga e nos filtros desde a [#62](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/62); a busca sem cidade escolhida mostra o estado inteiro desde a [#76](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/76). Sinop continua sendo onde a divulgação começa, não o limite de quem entra.

## 5. Modelo de dados (Postgres / Supabase)

```sql
-- Usuário base (Supabase Auth cobre autenticação; esta tabela é o perfil público)
create table profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  phone text not null,
  role text not null check (role in ('candidato_clt', 'prestador_servico', 'empresa')),
  city text not null default 'Sinop', -- cidade-piloto; campo já multi-cidade por design
  neighborhood text,
  phone_verified boolean not null default false,
  doc_verified boolean not null default false,
  verification_status text not null default 'pendente' check (verification_status in ('pendente','em_analise','aprovado','reprovado')),
  created_at timestamptz not null default now()
);

create table clt_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  desired_area text,
  experiences jsonb default '[]',
  education text,
  skills text[],
  resume_url text,
  availability text
);

create table service_categories (
  id serial primary key,
  name text not null unique -- eletricista, diarista, pintor, encanador, pedreiro...
);

create table provider_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  category_id int references service_categories(id),
  description text,
  starting_price numeric(10,2),
  years_experience int,
  service_area text[], -- bairros atendidos
  photo_urls text[],
  video_urls text[],
  avg_rating numeric(2,1) default 0,
  review_count int default 0
);

create table companies (
  profile_id uuid primary key references profiles(id) on delete cascade,
  company_name text not null,
  cnpj text unique,
  logo_url text,
  plan text not null default 'trial' check (plan in ('trial','mensal'))
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(profile_id) on delete cascade,
  title text not null,
  description text not null,
  category text,
  city text not null default 'Sinop',
  neighborhood text,
  contract_type text, -- CLT, estágio, temporário
  salary_min numeric(10,2),
  salary_max numeric(10,2),
  status text not null default 'aberta' check (status in ('aberta','fechada')),
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  candidate_id uuid references profiles(id) on delete cascade,
  status text not null default 'enviada' check (status in ('enviada','visualizada','entrevista','aprovada','rejeitada')),
  created_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references profiles(id) on delete cascade,
  reviewer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
```

Habilitar Row Level Security em todas as tabelas: cada perfil só edita o próprio registro; vagas e prestadores são públicos para leitura; candidaturas só visíveis para o candidato dono e para a empresa dona da vaga.

## 6. Fluxos principais

**Cadastro:** usuário escolhe papel (candidato CLT / prestador / empresa) → formulário específico do papel → verificação de telefone (SMS/WhatsApp OTP) → status `pendente` até revisão manual de documento.

**Prestador sendo encontrado:** usuário navega tela "Serviços" → filtra por cidade/categoria/avaliação → vê cards com foto, nome, nota, "a partir de R$X" → toca em "Conversar no WhatsApp" → abre `https://wa.me/55<telefone>?text=Olá,%20vi%20seu%20perfil%20na%20Lupa...` em nova aba/app.

**Candidato aplicando a vaga CLT:** navega "Vagas" → filtra → abre vaga → clica "Candidatar-se" → sistema anexa perfil/currículo → status vira `enviada` → empresa vê no painel.

**Empresa publicando vaga:** painel "Minha Empresa" → "Publicar nova vaga" → formulário → vaga fica `aberta` e aparece na busca pública.

**Avaliação:** após contato (ou manualmente pelo fundador no início, via link enviado por WhatsApp), quem contratou avalia o prestador (nota + comentário) — no V0 isso pode ser um formulário público simples vinculado ao perfil, sem exigir login de quem avalia.

## 7. Stack técnica recomendada

- **Frontend + Backend:** Next.js (App Router) + TypeScript. Framework único cobre frontend e API routes, reduz a superfície de coisas novas a aprender, e é o stack com melhor suporte de ferramentas de IA de código.
- **Banco de dados + Auth + Storage:** Supabase (Postgres gerenciado, autenticação pronta, storage de arquivos para fotos/currículos, Row Level Security nativa).
- **UI:** Tailwind CSS + shadcn/ui — componentes prontos, acelera a construção de telas com pouco tempo disponível.
- **Hospedagem:** Vercel (deploy do Next.js) + Supabase Cloud (banco/storage).
- **Formato do app no V0:** aplicação web responsiva com PWA (manifest + service worker básico para "adicionar à tela inicial"). Evita loja de app, revisão da Apple/Google, e permite um único código-fonte. Migrar para app nativo (via Capacitor, reaproveitando o mesmo código web) é decisão de V2.
- **Pagamentos (quando ativar cobrança):** Mercado Pago (Checkout Pro/Assinaturas) — suporte nativo a PIX e boleto.
- **Notificação (V0):** e-mail transacional (Resend ou SMTP do Supabase). Push notification segmentada por bairro/categoria fica para V1.

## 8. Requisitos não-funcionais

- **LGPD:** dados de documento de identidade e foto/selfie são dados pessoais sensíveis. Implementar: tela de consentimento explícito no upload, política de retenção (recomendação: deletar a imagem do documento após validação, mantendo apenas o status `aprovado`), e storage com acesso restrito (bucket privado no Supabase Storage, nunca público).
- **Verificação (V0 → V2):** V0 = revisão manual (fundador aprova/reprova via painel admin). V1/V2 = integrar provedor de KYC automatizado (ex.: Idwall, Unico Check, Validra) quando o volume justificar o custo por verificação — orçar como custo variável, não fixo.
- **Segurança:** rate limiting no cadastro/login, validação de CPF/CNPJ no backend, RLS no banco (não confiar em validação só no frontend).

## 9. Monetização a implementar

- Empresa: primeira vaga grátis (trial), depois assinatura mensal para publicar vagas ilimitadas.
- Prestador de serviço: uso da plataforma sempre gratuito. Nenhuma cobrança de quem contrata.
- Upsell pago (V1): gerador automático de currículo (candidato CLT e, em versão simplificada, "bio profissional" para prestador) — cobrança avulsa via PIX/Mercado Pago.
- Upsell pago (V2, opcional): "impulsionar perfil" do prestador para aparecer em destaque na busca.

## 10. Fases seguintes

- **V1:** gerador de currículo automático (upsell), notificação push segmentada por bairro/categoria, cobrança automatizada de assinatura de empresa, abertura de segunda cidade-piloto.
- **V2:** verificação de identidade automatizada (KYC), boost pago de perfil, app nativo (wrap via Capacitor), expansão de categorias de serviço, expansão multi-cidade ativa na UI.

## 12. Instruções de execução (ordem sugerida)

1. Inicializar projeto Next.js + TypeScript + Tailwind + shadcn/ui. Nome do projeto/repositório: `lupa`.
2. Configurar projeto Supabase, aplicar o schema SQL da seção 5, ativar RLS.
3. Implementar autenticação (cadastro/login) com seleção de papel (`candidato_clt` / `prestador_servico` / `empresa`).
4. Implementar formulários de perfil específicos por papel (seção 4).
5. Implementar upload de documento/selfie + tela admin simples de aprovação manual.
6. Implementar listagem/busca de vagas com filtros (cidade, categoria, tipo).
7. Implementar listagem/busca de prestadores com filtros (cidade, categoria, avaliação) + botão de contato WhatsApp (deep link `wa.me`).
8. Implementar fluxo de candidatura a vaga (candidato) e painel "Minha Empresa" (publicar vaga, ver candidaturas).
9. Implementar sistema de avaliação de prestadores.
10. Configurar PWA (manifest + service worker básico), com ícone e nome "Lupa".
11. Deploy inicial (Vercel + Supabase) em ambiente de produção para testar com usuários reais em Sinop.
