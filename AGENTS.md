# Lupa — notas para agentes

Plataforma hiperlocal de emprego e serviços. Cidade-piloto: Sinop-MT.
O brief completo do produto está em `docs/brief-tecnico.md`.

**Leia a seção "Fluxo de trabalho obrigatório" antes de escrever a primeira
linha de código.** Ela vale para qualquer agente, de qualquer modelo.

## Comandos

```bash
npm run dev      # desenvolvimento em http://localhost:3000
npm run build    # build de produção
npm run verify   # tipos + lint + código morto + arquitetura + cobertura
npm run e2e      # Playwright (sobe um build de produção)
```

`npm run verify` é o mesmo conjunto que roda na CI. Detalhes de cada
ferramenta em `docs/qualidade.md`.

Scripts operacionais:

```bash
node scripts/criar-admin.mjs      # cria ou promove a conta de admin
node scripts/gerar-avatares.mjs   # regenera os avatares de demonstração
```

---

## Fluxo de trabalho obrigatório

Combinado com o Luiz e válido para todo mundo, humano ou agente.

**1. Uma Issue antes de cada tarefa.** Correção, melhoria ou funcionalidade
nova — abra a Issue primeiro, descrevendo o problema e o critério de aceite.
Sem Issue não se começa. O motivo é rastreabilidade: seis meses depois, a
pergunta "por que isto está assim?" precisa de resposta.

**2. Nada direto na `main`.** Todo trabalho vai em branch e chega por Pull
Request. É assim que o deploy é controlado — cada merge na `main` publica
na Vercel.

**3. O PR referencia a Issue.** Use `Closes #N` no corpo, para a Issue
fechar sozinha no merge. Um PR pode fechar mais de uma Issue relacionada.

**4. Commits pequenos, no padrão do Commitlint.** Tipo em inglês
(`feat`, `fix`, `docs`, `refactor`, `test`, `chore`), assunto em português,
cabeçalho de até 72 caracteres. O hook do husky recusa o que não bater.

**5. O corpo do commit e a descrição do PR explicam o *porquê*.** O que
mudou já está no diff. O que se perde com o tempo é a razão da escolha e o
que foi descartado no caminho.

**6. `npm run verify` passa antes de abrir o PR.** Se a cobertura cair
abaixo do piso, escreva o teste — não baixe o piso.

Nomes de branch: `feat/`, `fix/`, `docs/`, `refactor/` seguidos de um
descritor curto em português com hífens.

---

## Como o app está montado

- **Next.js 16 (App Router) + TypeScript + Tailwind v4.** Sem
  `tailwind.config` — os tokens de design vivem em `@theme` dentro de
  `src/app/globals.css`.
- **Modo demonstração.** Sem as variáveis do Supabase no ambiente, a camada
  de dados cai para dados de Sinop e o app roda completo, inclusive criar
  conta e entrar. É o que permite demonstrar antes de existir
  infraestrutura, e é requisito de negócio, não atalho técnico.
- **Banco.** `supabase/schema.sql` é a fonte da verdade e roda de uma vez num
  banco limpo. Ele é **executado por teste** contra um Postgres real
  (`tests/unit/schema.test.ts`, via PGlite) — schema não executado é schema
  que ninguém sabe se funciona. Passo a passo em `docs/supabase.md`.
- **Duas chaves do Supabase.** A anônima vai para o navegador e só lê o que é
  público. A de serviço fica no servidor, ignora RLS e é a única que alcança
  `usuarios`, que guarda hash de senha. `SUPABASE_SERVICE_ROLE_KEY` nunca
  leva prefixo `NEXT_PUBLIC_`; há teste que trava isso.
- **Sem chat interno.** O contato com prestador acontece por deep link
  `wa.me` (`src/lib/format.ts` → `whatsappLink`). Decisão de produto do V0,
  não pendência.

### Camadas do servidor

```
src/app/**/actions.ts    server actions: leem a sessão, chamam o serviço
        ↓
src/server/*/servico.ts  regra de negócio: decide, não conhece cookie
        ↓
src/server/*/            repositório: memória (demo) ou Postgres
```

Cada camada tem um motivo:

- **A action é fina.** Envelopada por `criarAcao()`, que valida a entrada
  com Zod, captura qualquer exceção e registra a chamada. Exceção nunca
  chega à interface como tela de erro do Next.
- **O serviço não conhece requisição.** Nem cookie, nem `next/headers`. É o
  que permite testar cadastro, login e limites inteiros sem subir servidor.
- **O repositório tem duas implementações e um contrato.** O que os testes
  exercitam é o mesmo caminho que roda em produção.

Os contratos entre camadas são verificados pelo `dependency-cruiser`
(`npm run arch`) e falham o build. Em particular: `src/lib/mock-data.ts` só
pode ser lido por `src/lib/data.ts` — importar direto de uma tela faria a
tela mostrar dados falsos mesmo com o banco ligado.

---

## Decisões de arquitetura, com o porquê

### Autenticação própria, não Supabase Auth

Migração `0001` substituiu `auth.users` por uma tabela `usuarios` nossa.

**Ganhos:** o hash de senha é testável e auditável; o app roda em qualquer
Postgres; cadastro e login são exercitáveis sem infraestrutura, o que mantém
o modo demonstração vivo.

**Perdas, que precisam ser construídas antes de abrir o cadastro ao
público:** verificação de e-mail e recuperação de senha. Vinham de graça.

### Argon2id com parâmetros da OWASP

19 MiB, `t=2`, `p=1`. Dimensionados para caber na memória de uma função
serverless — parâmetro que derruba a função em produção não protege
ninguém. `precisaRehash()` permite subir o custo depois sem pedir troca de
senha a ninguém.

### Sessão em JWT, não em banco

Serverless não tem processo de longa duração, e cada consulta a mais é
latência para quem está em 3G. O preço é não revogar antes de expirar; por
isso a validade é de 7 dias com renovação silenciosa faltando 2. O payload
carrega **só id e papel** — cookie é legível por quem tem o aparelho.

Sem `SESSION_SECRET`, produção recusa subir. Segredo padrão versionado
significa sessão de admin forjável por qualquer um que leia o repositório.

### RBAC como matriz declarativa

`src/server/auth/rbac.ts` é a fonte da verdade e cabe numa tela. Permissão
espalhada em `if` é como se descobre, meses depois, que uma empresa vê a
candidatura de outra.

**Admin não pode tudo.** Administra, mas não publica vaga nem se candidata.
Admin com todas as capacidades transforma um acesso comprometido em perda
total.

**Duas perguntas em cada operação:** o papel pode fazer isto
(`exigirCapacidade`) e este registro é desta pessoa (`exigirDono`). Só a
primeira deixaria qualquer empresa autenticada alcançar a vaga de outra
trocando o id na URL.

### 404 em vez de 403 quando faz sentido

Registro de outro dono e área administrativa respondem "não encontrado". Um
403 confirma que o recurso existe — informação de graça para quem sonda ids
ou procura o painel de admin.

### Enumeração de contas

O cadastro avisa que o e-mail já existe; o login, não. No cadastro o aviso é
necessário, senão a pessoa tenta de novo sem entender. No login, o mesmo
aviso seria uma lista de quem tem conta — que aqui significa **quem está
procurando emprego**, informação que pode custar o emprego atual de alguém.
O tempo de resposta também é igualado (`gastarTempoDeVerificacao`).

### Polling, não websocket, no painel do admin

Conexão aberta em serverless exige um serviço à parte, com custo e mais uma
peça para quebrar. 15 segundos num painel que uma pessoa olha é
indistinguível de tempo real. A aba em segundo plano para de pedir.

### O limite de publicações mora no banco

Trigger em `publicacoes`, não só checagem na aplicação. A aplicação também
confere, para dar mensagem decente antes de gravar — mas duas requisições
simultâneas passariam pela checagem e criariam a décima primeira. O banco é
o único lugar onde essa corrida não existe.

---

## Decisões de produto por papel

O que cada papel informa no cadastro foi decidido assim:

**Trabalhador comum — sete campos, um passo.** É o público mais numeroso e o
menos paciente com formulário. Quem procura emprego pelo celular, muitas
vezes com dado móvel contado, abandona uma tela de quinze campos. Currículo,
experiência e formação vão para a edição de perfil, depois que a pessoa já
viu que existem vagas de verdade aqui.

**Prestador — categoria e descrição já no cadastro.** O perfil dele nasce
sendo o anúncio. Sem esses campos ele não aparece na busca, ninguém o
encontra, e a conclusão dele é que a plataforma não funciona.

**Empresa — CNPJ obrigatório e validado por dígito verificador.** É o que
separa empresa real de vaga falsa, e vaga falsa em plataforma de emprego
costuma virar golpe de taxa de cadastro cobrada de quem está desempregado.

### O que a empresa tem no painel

Decidido com base em plataformas de recrutamento, e o que **não** entrou é
tão importante quanto o que entrou:

| Recurso | Estado |
|---|---|
| Perfil público: razão social, setor, porte, site, descrição, logo | Modelado (`perfis_empresa`) |
| Publicar, editar e encerrar vaga | Tela existe; ações no servidor pendentes |
| Ver candidaturas por estágio | Tela existe; mover estágio pendente |
| Publicações no perfil, até 10 ativas | Pronto |
| Métricas próprias: visualizações, candidaturas | Parcial (contagem, não série) |
| Plano e cobrança | `trial`/`mensal` no schema; sem integração |

**Fora do escopo por decisão, não por esquecimento:** banco de talentos com
busca ativa de candidatos, testes e triagem automática, e múltiplos usuários
por empresa. Os três fazem sentido num produto maduro; num piloto de uma
cidade, cada um deles é uma superfície a mais para manter sem ninguém
pedindo ainda.

---

## Convenções

- **Idioma:** interface, comentários e mensagens de commit em português.
  Identificadores de código em inglês, exceto termos do domínio que já são
  do schema (`candidato_clt`, `prestador_servico`, `empresa`). O código do
  servidor em `src/server/` usa português também, por ser onde a regra de
  negócio vive e ser lida por quem conhece o domínio.
- **Cores por vertical:** verde `vagas` = emprego, azul `servicos` =
  prestadores, roxo `empresas` = painel da empresa. Use as classes de token
  (`text-vagas`, `bg-servicos/12`), nunca hex solto.
- **Contraste:** todo par de cor e fundo precisa passar em WCAG AA (4,5:1).
  Há teste de acessibilidade cobrindo todas as rotas. Boa parte do público
  abre o app na rua, sob sol forte e em tela barata.
- **Multi-cidade:** toda entidade tem `city`. A UI trava em Sinop por
  `PILOT_CITY`; abrir outra cidade não deve exigir migração de schema.
- **Dados sensíveis:** documento e selfie vão para o bucket privado
  `verificacao` e são apagados na decisão do admin. Erros enviados ao Sentry
  passam por `scrubSensitiveData`. Senha nunca é logada. São obrigações de
  LGPD, com teste que trava.
- **Imagens de perfil:** só avatares gerados (DiceBear, CC0). Nunca foto de
  pessoa real sem direito de uso. Ver `scripts/gerar-avatares.mjs`.

---

## Armadilhas que já custaram caro

Bugs reais deste projeto, cada um com um teste que impede a volta:

- **`useSearchParams()` exige `<Suspense>`, e esse boundary pode nunca
  resolver.** A barra de filtros ficou invisível e inerte: o conteúdo era
  transmitido mas ficava preso num `<template>`. Hoje os valores descem por
  prop do Server Component, que já leu os `searchParams`.
- **`truncate` num elemento que também é `flex` não corta o texto** — o
  ellipsis não se aplica e o `nowrap` trava a largura, empurrando a página
  para fora da tela. O truncate vai num `<span>` de texto dentro do flex.
- **Grade responsiva sem `grid-cols-1` explícito** dimensiona a coluna
  implícita por `min-content`, e o card impõe largura maior que a tela.
- **Opacidade sobre texto derruba o contraste** abaixo do mínimo legível.
  Para estado desabilitado, use cor explícita.

Os dois do meio têm contrato automático em `tests/unit/cards.test.tsx`, que
varre o código-fonte.

### Sobre verificação

**Verifique o que você diz que verificou.** Dois episódios reais aqui:

1. Declarei "filtro funcionando" tendo conferido só a contagem de resultados
   via URL, sem nunca ter clicado no filtro.
2. Declarei "a busca nunca funcionou em produção" com base num inspetor de
   navegador que removia comentários HTML — e os comentários são justamente
   como o React marca os limites de Suspense. A conclusão estava errada.

A lição das duas: confirme num navegador de verdade, pelo caminho que o
usuário percorre. O Playwright existe para isso.
