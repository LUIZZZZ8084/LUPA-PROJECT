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

O desenho do sistema — o que roda onde, os limites de confiança, por onde
passa dado sensível e o que cai quando cada peça cai — está em
`docs/arquitetura.md`, com diagramas.

Scripts operacionais:

```bash
node scripts/criar-admin.mjs      # cria ou promove a conta de admin
node scripts/gerar-avatares.mjs   # regenera os avatares de demonstração
node scripts/gerar-cidades.mjs    # baixa a lista de municípios de MT (IBGE)
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
- **Dois layouts, por grupo de rota.** `(app)` tem cabeçalho e barra
  inferior; `(auth)` — entrar e cadastro — não tem nenhum dos dois. A
  separação é por pasta e não por `if` no cabeçalho, para que "tela de
  autenticação não tem menu" seja fato do arranjo: quem criar a próxima
  herda o comportamento sem precisar saber disso.
- **App fechado por login.** Sem sessão, toda rota redireciona para
  `/entrar`. Só `/entrar` e `/cadastro` ficam abertas, e a lista mora em
  `src/proxy.ts` — o padrão é fechado, abrir é explícito.
- **Modo demonstração.** Sem as variáveis do Supabase no ambiente, a camada
  de dados cai para dados de Sinop e o app roda completo, inclusive criar
  conta e entrar. É o que permite demonstrar antes de existir
  infraestrutura, e é requisito de negócio, não atalho técnico. O login
  continua obrigatório aqui: o que muda é de onde vêm os dados, não quem
  entra.
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

### Arquivos: o caminho vem da sessão, nunca do nome enviado

Foto, currículo e logo passam pelo servidor com a chave de serviço; o
navegador nunca fala com o Storage direto. Fosse assim, quem pode enviar e
para onde viraria responsabilidade de uma policy — e policy errada é
silenciosa até alguém sobrescrever o arquivo de outra pessoa.

O caminho é derivado do id de quem envia e de uma tabela fechada de
extensões. Nome vindo do cliente permitiria `../` para escapar da pasta, ou
o id de outra pessoa. Caminho fixo por pessoa também faz a troca substituir
o anterior, em vez de o bucket virar depósito de versões pagas.

**Currículo é privado**, pela mesma razão do currículo em texto. O banco
guarda o caminho, não a URL; o link nasce a cada visita e expira em um
minuto.

**Ordem entre bucket e banco.** No envio, arquivo primeiro: se o banco
falhar depois, sobra um objeto órfão — invisível e substituído no próximo
envio. Na ordem inversa, o banco apontaria para arquivo inexistente e a
tela mostraria imagem quebrada. Na remoção a ordem se inverte, pelo mesmo
raciocínio.

**Sem Supabase não há Storage.** A tela diz isso em vez de aceitar o envio
e perder o arquivo — aceitar em silêncio faria a pessoa achar que salvou.

### O que se edita depois, e o que nunca

O cadastro pede o mínimo para a conta existir e a pessoa ser encontrada;
o resto vive em `/perfil/editar`, preenchido quando ela já viu que a
plataforma tem gente de verdade.

**O CNPJ não é editável.** É a âncora de identidade da empresa e o que
separa vaga real de anúncio falso. Poder trocar depois permitiria
cadastrar com um CNPJ válido, passar pela verificação e então virar outra
empresa. Correção é caso de suporte, com gente olhando.

**Um formulário por assunto, cada um com o próprio botão.** Um formulário
só obrigaria a reenviar o currículo inteiro para corrigir o telefone, e um
erro em qualquer campo bloquearia todos. Em conexão ruim isso é a
diferença entre corrigir e desistir.

**O papel vem da sessão, nunca do formulário.** Um formulário é palpite do
cliente sobre o que existe. Aceitar o papel dali deixaria um candidato
postar campos de prestador e ganhar um anúncio na busca sem nunca ter
passado pelo cadastro de prestador.

**A tela de perfil lê pelo serviço, não por `src/lib/data.ts`.** A camada
de dados serve o que é público, e o currículo fica fora de qualquer view
por decisão de privacidade — lendo por lá, a pessoa salvava e a tela
continuava dizendo que estava vazio.

### Navegação pública, revertida

O V0 nasceu com vagas e prestadores abertos a qualquer visitante. A razão
era boa: buscador indexando "vaga de operador em Sinop" traz gente que
nunca ouviu falar da Lupa, de graça e sem esforço de divulgação.

Em 21/08/2026 isso foi revertido a pedido do Luiz. O raciocínio: só quem
tem perfil se candidata, vê dado de empresa ou entra em contato — e é o
cadastro que vira lead. Vitrine aberta gera visita; visita não é lead.

**O preço, aceito de olhos abertos:** o app sai da busca do Google. Não
existe mais quem chegue sozinho; todo mundo entra por link recebido. Se um
dia a origem do tráfego virar problema, é aqui que se olha primeiro.

O que sobreviveu: o modo demonstração. Ele responde por *de onde vêm os
dados*, não por *quem pode entrar*, e continua sendo o que permite mostrar
o produto sem infraestrutura.

### Segurança: o que já vale, e o que se decidiu não fazer

Auditoria completa dos vinte pontos está na Issue #55, com o estado de
cada um. Três coisas que vale ter na cabeça ao mexer:

**Nada de entrada de usuário concatenada em filtro do PostgREST.** O
`or()` recebe uma string numa linguagem onde a vírgula separa condições:
interpolar termo de busca ali é injeção, num dialeto diferente do SQL.
Use `termoParaFiltro()` em `src/lib/data.ts`, que envolve o valor em
aspas. Já vazou: `zzzznaoexiste,full_name.ilike.*a*` devolvia a base
inteira.

**A CSP é a última linha.** Se algum escape falhar em qualquer lugar, é
ela que impede o script injetado de rodar ou de exfiltrar. `script-src`
ainda precisa de `'unsafe-inline'` porque o Next injeta hidratação inline
sem nonce no App Router; o resto da política vale, e `connect-src`
limita para onde os dados podem sair. Há teste e2e conferindo a resposta
HTTP de verdade, não o `next.config`.

**Limite de tentativa no cadastro é por origem, não por e-mail.** Quem
cria conta em massa troca de e-mail a cada tentativa. E o sucesso conta
para o limite — no login sucesso zera o contador, porque lá o que se
contém é adivinhação de senha; aqui o que se contém é a criação em si.

**Proteção contra bot ficou de fora de propósito.** Captcha atrapalha
exatamente o público deste produto: aparelho antigo, dado móvel contado,
pouca familiaridade digital. A hora de reavaliar é quando aparecer abuso
real, não antes.

### Mato Grosso inteiro, começando por Sinop

Os 142 municípios do estado são aceitos no cadastro, na publicação de vaga
e nos filtros. `CIDADE_INICIAL` é Sinop e significa só uma coisa: é o valor
que já vem escolhido. Atender Sinop primeiro é estratégia de divulgação;
*recusar* quem é de Sorriso era um formulário dizendo que o app não é dele.

**A lista vem do IBGE, por script.** 142 nomes com acento e com "do/da/de"
no meio, digitados à mão, dão um "Vila Bela da Santíssima Trindade" errado
que ninguém revisa — e alguém de lá não acha a própria cidade. O arquivo
gerado é versionado: em execução o app não fala com o IBGE, porque
cadastro não pode depender de API de terceiro estar no ar.

**Bairro deixou de ser enum.** Era `z.enum` dos 14 bairros de Sinop, usado
no cadastro, no perfil e na vaga. Não existe lista de bairros de 142
municípios pronta em lugar nenhum, e enum recusaria loteamento novo até em
Sinop, onde a cidade cresce todo ano. A curadoria ficou na tela — lista
onde existe, texto onde não existe —, e o servidor garante só o que evita
lixo: tamanho mínimo e máximo.

O preço, aceito: sem enum, "Jd. Botânico" e "Jardim Botânico" podem
coexistir onde não há lista. Vale menos que travar o cadastro.

**A cidade da vaga é da vaga, não da empresa.** Transportadora de Sinop
contrata motorista em Sorriso; herdar a cidade da empresa esconderia a
vaga de quem ela interessa. O formulário já vem com a cidade da empresa
preenchida, e ela pode trocar.

**A cidade não se edita no perfil.** Mudar de cidade muda quem encontra a
pessoa e onde os anúncios dela aparecem — é troca de contexto inteiro, não
correção de campo. Por ora é caso de suporte, como o CNPJ.

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

### Visualização de vaga é contagem, não histórico

`visualizacoes_vaga` guarda uma linha por vaga por dia, e o incremento
passa por `registrar_visualizacao()` — `on conflict do update` no banco,
porque ler-somar-gravar na aplicação perde contagem quando duas pessoas
abrem a vaga ao mesmo tempo.

**Não se guarda quem viu.** Deduplicar por pessoa daria um número melhor,
mas ao preço de armazenar qual candidato olhou qual vaga: histórico de quem
está procurando trabalho, a mesma informação que mantém o currículo fora de
qualquer view pública. O preço aceito é que recarga infla o número, e por
isso a tela diz, com todas as letras, que a métrica serve para comparar
dias e vagas entre si — não para contar pessoas.

A empresa não conta as próprias aberturas: ela abre a vaga para conferir o
texto, e métrica que sobe quando o dono recarrega mede o dono.

O registro sai por `after()`, depois da resposta. Quem abriu a vaga quer
ler a vaga; se a contagem falhar, vai para o log e a página segue.

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
| Métricas próprias: visualizações e candidaturas por dia, 30 dias | Pronto |
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
- **Multi-cidade:** toda entidade tem `city`, e o app aceita os 142
  municípios de Mato Grosso — lista gerada do IBGE por
  `scripts/gerar-cidades.mjs`. `CIDADE_INICIAL` é Sinop, e é só isso: o
  valor que já vem escolhido. Bairro tem lista curada onde alguém conferiu
  (`BAIRROS_POR_CIDADE`) e é texto livre no resto.
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
- **`loading.tsx` num segmento faz todo `notFound()` daquele ramo
  responder 200.** O arquivo cria um limite de Suspense; o shell é
  transmitido antes de a página decidir, e o status já não pode mudar.
  Havia um na raiz, então valia para o app inteiro — e um segundo em
  `/servicos` e `/vagas`, cobrindo os detalhes filhos. Hoje os esqueletos
  vivem em grupos de rota (`(inicio)`, `(lista)`), que os escopam sem mudar
  a URL. Rota que chama `notFound()` não pode ter `loading.tsx` acima dela.
- **Opacidade sobre texto derruba o contraste** abaixo do mínimo legível.
  Para estado desabilitado, use cor explícita.

Os dois do meio têm contrato automático em `tests/unit/cards.test.tsx`, que
varre o código-fonte.

- **Suíte e2e não pode falar com banco de verdade.** `npm start` carrega o
  `.env.local`, e quem tem credenciais reais ali roda o e2e contra
  produção sem aviso. Aconteceu: o ajudante de login criou 213 contas na
  base real antes de alguém notar. O `playwright.config.ts` agora zera as
  variáveis do Supabase à força, e `tests/e2e/demo-obrigatorio.spec.ts`
  falha barulhento se o modo demonstração não estiver ativo.

### Sobre verificação

**Verifique o que você diz que verificou.** Três episódios reais aqui:

1. Declarei "filtro funcionando" tendo conferido só a contagem de resultados
   via URL, sem nunca ter clicado no filtro.
2. Declarei "a busca nunca funcionou em produção" com base num inspetor de
   navegador que removia comentários HTML — e os comentários são justamente
   como o React marca os limites de Suspense. A conclusão estava errada.
3. Declarei o painel da empresa "preso no esqueleto de carregamento" lendo o
   DOM de uma aba oculta. O React 19 revela o conteúdo do Suspense num
   quadro de animação, e aba escondida não pinta quadro: o conteúdo fica
   num `<div hidden>` para sempre. Cheguei a mexer na CSP atrás de um
   defeito que não existia.

A lição das três: confirme num navegador de verdade, pelo caminho que o
usuário percorre. O Playwright existe para isso. Antes de concluir que a
tela está quebrada, verifique se o ambiente de medição está inteiro —
`requestAnimationFrame` que nunca dispara é sinal de que quem está errado é
a medição.
