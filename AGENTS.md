# Lupa — notas para agentes

Plataforma de emprego e serviços para o Brasil inteiro, com o que está mais
perto de quem procura primeiro. Começou em Sinop-MT, abriu para Mato Grosso
e, desde a #301, aceita qualquer município do país.
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
node scripts/gerar-cidades.mjs    # baixa a lista de municípios do Brasil (IBGE)
node scripts/gerar-regioes.mjs    # baixa a região de cada município (IBGE)
node scripts/gerar-favicon.mjs    # regenera o ícone da aba a partir da logo
```

```bash
npm run roadmap   # confere se o ROADMAP.md ainda diz a verdade
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

**7. O PR que entrega um item do roadmap atualiza o `ROADMAP.md` no mesmo
PR.** Não no próximo, não depois. O roadmap é o único lugar que responde "o
que está pronto e o que falta" sem obrigar ninguém a reconstruir a história
a partir de PRs mergeados — e é o que o Paulinho abre para saber onde
estamos. Ele já ficou errado uma vez, listando como pendentes três coisas
entregues; documento que erra uma vez deixa de ser consultado. A CI cobra
(`npm run roadmap`): item pendente sem Issue reprova, Issue fechada ainda
listada como pendente reprova, e PR que fecha item do roadmap sem tocar no
arquivo reprova.

**8. A decisão nova vai em `docs/decisoes/`, no arquivo do tema, e o índice
deste arquivo ganha a linha dela.** Não aqui. Este arquivo é lido inteiro por
todo agente em toda sessão, e tem limite: em 27/10/2026 ele tinha 228 mil
caracteres para um limite de 150 mil, e as seções do fim — as mais novas —
não eram lidas (#509). O que fica aqui é o que vale para qualquer tarefa:
comandos, este fluxo, como o app está montado, convenções e armadilhas.

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
  entra. **No domínio de produção isso não vale** (#279): sem
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` ou
  `SUPABASE_SERVICE_ROLE_KEY`, o deploy recusa subir. Cair em demonstração
  ali seria servir dado de exemplo como real, com conta criada numa
  memória que some no próximo deploy, e sem nada ficar vermelho.
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

## Decisões de arquitetura e de produto

Cada decisão do projeto, com o porquê, mora em `docs/decisoes/`, um arquivo
por tema. **Antes de mexer numa área, abra o arquivo dela** — é ali que está
o que já foi tentado, o que foi descartado e por quê. O texto é o mesmo que
morava aqui até a #509, quando este arquivo passou do limite de leitura dos
agentes (150 mil caracteres) e as seções do fim, as mais novas, deixaram de
ser lidas.

**Decisão nova vai no arquivo do tema, e este índice ganha a linha dela.**
Tema novo, arquivo novo, e também a linha aqui. Há teste que cobra as duas
coisas: o tamanho deste arquivo e que todo arquivo da pasta esteja no índice.

### [Contas, papéis e perfis](docs/decisoes/contas-e-perfis.md)

Como uma conta muda de papel, o que se edita depois do cadastro, o perfil, o feed de trabalhos e as avaliações.

- Virar prestador troca o papel, e a pessoa é avisada
- Avaliar um prestador: quem pode, e o que o banco garante
- O perfil em duas abas
- O feed é de quem vende o próprio trabalho
- O feed do prestador, e por que "remover" não apaga
- O que se edita depois, e o que nunca
- O nome é definido no cadastro, e a empresa assina com o dela (#315)
- O limite de publicações mora no banco

### [Documentos: CPF, CNPJ e o que a verificação prova](docs/decisoes/documentos.md)

CNPJ conferido na Receita, CNPJ com letras, CPF do prestador e quem aparece na vitrine.

- O CNPJ é conferido na Receita, e o que isso prova
- CNPJ com letras, e o valor que a Lupa guarda (#297)
- Nem todo prestador é só CPF, nem toda empresa é CNPJ
- A vitrine só mostra prestador verificado
- CPF mora em `usuarios`, não em `perfis_prestador`

### [Autenticação, sessão e permissão](docs/decisoes/autenticacao.md)

Senha, recuperação, confirmação de e-mail, sessão em JWT, a matriz de RBAC e o que se responde a quem sonda.

- Autenticação própria, não Supabase Auth
- Esqueci minha senha, e os três cuidados que a fazem segura (#174)
- Confirmar o e-mail, e o que isso resolve de verdade (#227)
- Argon2id com parâmetros da OWASP
- Senha de 6 caracteres, e o número num lugar só (#290)
- Sessão em JWT, não em banco
- RBAC como matriz declarativa
- 404 em vez de 403 quando faz sentido
- Enumeração de contas

### [Arquivos, dados pessoais e moderação](docs/decisoes/dados-pessoais.md)

Como arquivo entra e sai, excluir a conta, os documentos legais e as denúncias.

- Arquivos: o caminho vem da sessão, nunca do nome enviado
- Excluir a própria conta, e o que fica depois (#423)
- Termos, Privacidade e Suporte, e quem responde pela Lupa (#235)
- Denunciar vaga e avaliação, e só o admin decide (#435)

### [Contratar: a área de empresa, as vagas e as candidaturas](docs/decisoes/contratacao.md)

As duas portas de contratação, os campos da vaga, a triagem, o funil de candidaturas, o resultado da vaga e o prazo de 30 dias.

- A aba Empresa deixou de ser só de PJ
- Duas portas para contratar, uma implementação só (#189)
- O endereço da vaga, e o bairro que ficou nela
- Modalidade da vaga: obrigatória na tela, opcional no banco (#300)
- Áreas de vaga e profissões de prestador (#457)
- Vaga para PCD, e a vaga por sexo que não existe (#456)
- Estágio da candidatura: o nome depende de quem lê
- O resultado da vaga, o chamado no WhatsApp e quem já se candidatou (#492, #493, #494)
- Perguntas de triagem: separar sem esconder (#491)
- A área de contratação como mini CRM: abas, funil e o resumo do dia (#511)
- Na % de casamento, zero é uma afirmação
- Vaga expira em 30 dias, e reativar custa o mesmo que publicar

### [Quem vê o quê, e onde: navegação, lugar e avisos](docs/decisoes/alcance.md)

O que é público, o Brasil inteiro, a ordem por proximidade, o aviso de vaga, o convite para instalar e as contagens sem dono.

- Navegação pública, revertida — e parcialmente revertida de novo
- A vitrine de produção mostra só quem existe (#302)
- O Brasil inteiro, e não mais só Mato Grosso (#301)
- Perto se mede por região do IBGE, não por quilômetro
- O aviso de vaga guarda o que a pessoa pediu, e nada mais
- O convite para instalar, e o que cada aparelho deixa (#475)
- Busca sem resultado é vocabulário, não histórico de pessoa
- Visualização de vaga é contagem, não histórico

### [Segurança: o que já vale, e o que se decidiu não fazer](docs/decisoes/seguranca.md)

Filtros do PostgREST, CSP, tetos por ação e por listagem, cache, região das funções, limites de cadastro e login, e o captcha que não vai existir.

- Segurança: o que já vale, e o que se decidiu não fazer

### [Painel do admin](docs/decisoes/painel-admin.md)

As métricas, a visão geral em cards, os custos e as parcerias.

- O painel do admin responde de onde vem a conta e se o Lupa se paga (#471)
- Parceiros: a Lupa de graça, autorizada pelo e-mail (#505)
- Testes de compra: o produto liberado sem o Mercado Pago (#516)
- A visão geral do painel, em cards (#507)
- Polling, não websocket, no painel do admin

### [Cobrança: planos, mensalidade, caixa e Mercado Pago](docs/decisoes/cobranca.md)

Preços, planos de vaga, mensalidade e teste grátis do prestador, estorno, webhook, varredura, caixa e o gerador de currículo.

- Cobrança: a espera por demanda acabou, mensalidade de prestador é o primeiro uso real
- O caixa: todo valor que entra é registrado, e o que sai também (#179)
- Sem carência: cartão logo depois do cadastro, com teste grátis (#170)
- Gerador de currículo pago, sem Storage nenhum
- O plano vira o último passo do cadastro, não uma descoberta depois

### [Decisões de produto por papel](docs/decisoes/produto-por-papel.md)

O que cada papel informa no cadastro, e o que a empresa tem no painel — inclusive o que ficou de fora de propósito.

- O que a empresa tem no painel

---

## Convenções

- **Idioma:** interface, comentários e mensagens de commit em português.
  Identificadores de código em inglês, exceto termos do domínio que já são
  do schema (`candidato_clt`, `prestador_servico`, `empresa`). O código do
  servidor em `src/server/` usa português também, por ser onde a regra de
  negócio vive e ser lida por quem conhece o domínio.
- **Cores por vertical:** verde-limão `vagas` = emprego, laranja `servicos`
  = prestadores, azul `empresas` = painel da empresa — paleta "Sinalização"
  desde 02/09/2026 (Issue #106); os nomes dos tokens são por vertical, não
  por cor, e sobreviveram à troca. Use as classes de token (`text-vagas`,
  `bg-servicos/12`), nunca hex solto.
- **Contraste:** todo par de cor e fundo precisa passar em WCAG AA (4,5:1).
  Há teste de acessibilidade cobrindo todas as rotas. Boa parte do público
  abre o app na rua, sob sol forte e em tela barata.
- **Cor de marca de terceiro é exceção ao token por vertical.** WhatsApp,
  Instagram e Facebook têm `--color-whatsapp`, `--color-instagram` e
  `--color-facebook` próprios — identificam a rede, não uma vertical da
  Lupa. As duas de rede social são a cor oficial clareada até passar no
  contraste (#133): a original reprovava em WCAG AA contra `panel-3`,
  do mesmo jeito que `--color-empresas` já tinha precisado de ajuste.
- **Multi-cidade:** toda entidade tem `city`, gravada com o estado
  (`"Sinop - MT"`), e o app aceita os 5.571 municípios do Brasil — lista
  gerada do IBGE por `scripts/gerar-cidades.mjs` (#301). Nenhuma cidade vem
  escolhida por padrão. Bairro de pessoa não existe (#321); só a vaga
  tem bairro, texto livre e opcional.
- **Dados sensíveis:** documento e selfie vão para o bucket privado
  `verificacao` e são apagados na decisão do admin. Erros enviados ao Sentry
  passam por `scrubSensitiveData`. Senha nunca é logada. São obrigações de
  LGPD, com teste que trava.
- **Imagens de perfil:** só avatares gerados (DiceBear, CC0). Nunca foto de
  pessoa real sem direito de uso. Ver `scripts/gerar-avatares.mjs`.

---

## Armadilhas que já custaram caro

Bugs reais deste projeto, cada um com um teste que impede a volta:

- **`revalidatePath` re-renderiza a rota em que você ainda está, e o portão
  dela pode ter acabado de fechar.** A tela de virar prestador troca o
  papel e revalida o layout — o papel decide o menu inteiro. Só que a
  revalidação re-renderiza *aquela mesma rota*, cujo portão agora recusa
  quem acabou de passar por ele: quem ativava com sucesso terminava
  olhando para "Não encontramos essa página". A navegação no cliente
  (`router.replace`) perdia a corrida contra a revalidação. A saída foi a
  própria página redirecionar quem já é prestador, que é determinístico e
  roda no servidor.

  **Este parágrafo dizia também que não dava para redirecionar de dentro
  da action, porque `criarAcao` engoliria o `NEXT_REDIRECT`. Era falso**
  (#334): `criarAcao` repassa `redirect()` e `notFound()` desde 21/08
  (`e36fdf4`, `ehControleDeFluxoDoNext` em `src/server/action.ts`) — um
  dia antes de a frase ser escrita pela primeira vez, num comentário do
  login. A saída escolhida continua certa pelo motivo de cima; o motivo de
  baixo nunca existiu. *Premissa sobre o próprio código se confere no
  código, não no comentário que a repete.* **Ação que muda o papel e revalida precisa responder o que a
  rota de origem faz depois** — e a resposta não pode ser 404 na cara de
  quem acabou de acertar.

- **Botão que só recusa depois do clique.** "Candidatar-se" aparecia em
  toda vaga aberta para qualquer papel — prestador, empresa —, e a recusa
  só vinha da action, depois do clique. O próprio código já condenava isso
  nos atalhos do perfil ("mostrar um link que devolve sem permissão ao ser
  clicado é pior do que não mostrar"), mas a regra não tinha atravessado
  para a tela da vaga. Ficou pior quando a tela de virar prestador passou
  a prometer, por escrito, que o botão some. **Promessa na tela é contrato:
  quem escreve o aviso confere se ele é verdade.**

- **Uma promessa sem o outro lado nunca construído.** Duas telas — o
  perfil do prestador e o perfil público dele — diziam "envie documento e
  selfie em Editar perfil", e uma terceira, no rodapé de `/perfil`,
  descrevia como esses arquivos eram guardados e apagados. Nenhuma tela de
  envio jamais existiu: `Especie` nunca teve `"documento"` nem `"selfie"`,
  e nada além do seed escrevia em `pedidos_verificacao`. Fora da
  demonstração, todo prestador ficava para sempre atrás de uma promessa
  que não levava a lugar nenhum — e passou batido porque o texto lia bem,
  a fila do admin existia de verdade (só sem remetente), e ninguém tinha
  testado o caminho de ponta a ponta com uma conta que não fosse
  semeada. Corrigido na #133, trocando a promessa por CPF válido e único
  como a própria verificação. **Documentar como um dado sensível é
  guardado não prova que existe tela para enviá-lo — confira as duas
  pontas, não só o texto que soa responsável.**

- **`npm run dev` fala com o banco de produção.** O `.env.local` tem as
  credenciais reais, e `next dev` as carrega. Conferir uma tela "no
  navegador" criando conta ali escreve em produção — foi assim que uma
  conta de teste (`teste-sorriso@teste.lupa`) foi parar na base real e
  precisou ser apagada à mão. O `playwright.config.ts` zera as variáveis à
  força justamente por isso; o dev server não. **Para conferir fluxo que
  escreve, use a suíte e2e, que roda em demonstração por construção** — e
  ela ainda deixa o teste para trás, em vez de um clique que ninguém
  repete.

- **O React 19 apaga o formulário depois de toda action, até da que
  devolveu erro.** Para ele, `<form action={...}>` que terminou é
  formulário enviado, e ele chama `form.reset()`. O servidor apontava o
  CPF errado, e a mensagem chegava num cadastro já em branco: a pessoa
  preenchia tudo de novo por causa de um campo (#291). No login, errar a
  senha apagava também o e-mail. Hoje todo formulário com
  `useActionState` passa por `useEnvioQueNaoApaga`
  (`src/components/ui/formulario.ts`): o `onSubmit` chama a action dentro
  de uma transição, caminho em que o React não limpa, e a tela rola até o
  primeiro campo com erro. O `action` continua no `<form>` para o envio
  funcionar antes de o JavaScript carregar. Há teste que varre
  `src/app` e `src/components` e reprova formulário novo sem a proteção,
  com as exceções e o porquê de cada uma escritos no próprio teste.
  **Erro de validação é resposta normal para o usuário, e o framework não
  sabe disso: quem sabe é a aplicação.**
- **`useSearchParams()` exige `<Suspense>`, e esse boundary pode nunca
  resolver.** A barra de filtros ficou invisível e inerte: o conteúdo era
  transmitido mas ficava preso num `<template>`. Hoje os valores descem por
  prop do Server Component, que já leu os `searchParams`.
- **`truncate` num elemento que também é `flex` não corta o texto** — o
  ellipsis não se aplica e o `nowrap` trava a largura, empurrando a página
  para fora da tela. O truncate vai num `<span>` de texto dentro do flex.
- **No Tailwind v4, `row-span-N` e `col-span-N` apagam o início da linha e
  da coluna.** Eles geram o atalho `grid-row: span N / span N`, que reescreve
  o `grid-row-start` posto por `row-start-1`. No hero da home (#465) o fundo do
  banner, que devia ocupar as três primeiras linhas, foi parar depois do
  conteúdo, com altura zero, e a foto sumiu. Para pôr um item numa área fixa
  da grade, use início e fim juntos: `row-[1/4]`, `col-[1/-1]`. E coluna
  flexível que guarda campo de formulário é `minmax(0,1fr)`, não `1fr`: o
  `1fr` não encolhe abaixo da largura mínima do campo, e o botão ao lado vaza
  pela borda do cartão.
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
- **Server Action recusa corpo acima de 1 MB, e o erro não passa pelo
  `try/catch`.** É o padrão do Next quando
  `experimental.serverActions.bodySizeLimit` não está configurado — e as
  regras de arquivo prometiam 2 MB de imagem e 5 MB de currículo. Foto de
  celular cai bem nessa faixa: o upload morria com "This page couldn't
  load", porque a recusa acontece na camada do framework, antes de
  `criarAcao` existir, e não vira mensagem de campo. Hoje o limite está em
  `6mb` no `next.config.ts`, cobrindo a maior regra com folga para o
  envelope do multipart. **Limite anunciado pela aplicação precisa caber
  no limite do framework.**

  **E no da plataforma, que vem antes (#324).** O conserto acima subiu o
  limite do Next para 6 MB, e o currículo continuou prometendo 5 — só que a
  Vercel corta o corpo de uma função em 4,5 MB, antes de o Next existir. O
  PDF entre 4,5 e 5 MB era recusado com erro genérico em inglês. Hoje o
  currículo vai até 4 MB, há teste que reprova qualquer regra acima de
  4,5 MB, e o navegador confere o tamanho antes de mandar
  (`src/components/ui/arquivo-que-cabe.ts`). *O limite que vale é o menor
  da corrente — aplicação, framework e plataforma —, e o da plataforma não
  aparece em nenhum arquivo do projeto.*
- **Página que lê a sessão e nunca consulta a matriz.** `/empresa` e
  `/empresa/vagas/nova` chamavam `sessaoAtual()` — uma para saber de quem
  era o painel, a outra só para preencher a cidade — e nenhuma das duas
  perguntava se aquele papel podia estar ali. Qualquer conta autenticada,
  candidato ou prestador, abria as duas. Não vazou dado: em produção
  `empresaDoPainel()` devolve o id de quem está pedindo, então as consultas
  voltam vazias, e publicar já barrava dentro da action. É justamente por
  isso que durou — **portão que falta não quebra tela nenhuma**, e o que se
  perde é a garantia de que a matriz do RBAC é a fonte da verdade. A prova
  de que fazia falta estava na própria suíte: três specs alcançavam
  `/empresa` com sessão de candidato e passavam. Ler a sessão numa página
  não é checar permissão; quem lê `sessaoAtual()` decide alguma coisa com
  ela, e essa decisão passa por `pode()`.

- **Lista de rotas escrita à mão envelhece em silêncio.** As varreduras de
  contraste e de rolagem horizontal liam uma lista fixa de 13 rotas, num
  app que já tinha 17. `/candidatos`, `/candidatos/[id]` e
  `/perfil/candidaturas` nasceram depois e nunca passaram por nenhuma das
  duas. Nada ficou vermelho — a suíte seguiu verde com 304 testes enquanto
  quatro telas cresciam sem cobertura. Hoje `tests/unit/rotas-varridas.test.ts`
  varre `src/app` e reprova rota fora de toda varredura; excluir continua
  valendo, mas a razão tem que estar escrita em `ROTAS_NAO_VARRIDAS`.
  **Quando a cobertura de um teste é uma lista, alguém precisa cobrar a
  lista.**

- **O matcher do proxy é onde um item esquecido não quebra nada e ninguém
  vê.** `manifest.webmanifest` ficou de fora da lista de exclusões,
  embora `icon` e `apple-icon` — gerados por rota do mesmo jeito —
  estivessem lá. O manifesto passou a responder 307 para o login, e o
  navegador não lê HTML de login como manifesto: o PWA deixou de ser
  instalável para quem ainda não tem conta, que é justamente quem acabou
  de receber o link. Nenhuma tela quebrou. Arquivo gerado por rota vai no
  matcher, não em `ABERTAS`, que é lista de rota de navegação.
- **Ter a logo declarada não é a aba mostrar a logo.** `icon.tsx` e
  `apple-icon.tsx` desenhavam a lupa desde o começo, e o `favicon.ico` de
  fábrica do Next continuava em `src/app`. O HTML declarava os dois, e o
  Chrome escolhia o `.ico`: a aba mostrou o triângulo do Next desde o
  primeiro commit, sem nada quebrar (#303). Hoje o `.ico` sai de
  `scripts/gerar-favicon.mjs`, com o mesmo desenho, e
  `tests/unit/favicon.test.ts` decodifica o arquivo e procura o verde da
  marca. **Arquivo de fábrica de framework é o que ninguém lembra de
  trocar, porque nunca foi escrito por ninguém.**
- **Valor padrão de filtro na tela vira filtro invisível.** `/vagas` lia
  `single("cidade") ?? "Sinop"` — sobra do tempo em que Sinop era a única
  cidade. Aberto o estado inteiro, toda vaga publicada fora de Sinop sumia
  da busca enquanto continuava aparecendo na home, que consulta `getJobs()`
  sem filtro. A empresa via a vaga no painel, não via em `/vagas` e
  concluía que não tinha publicado. O chip da tela já dizia "Todo o MT": o
  padrão contradizia o que a interface prometia, e ninguém o via porque ele
  não estava na URL. **Quando o alcance de uma listagem muda, procure os
  padrões deixados nas telas** — a camada de dados estava certa o tempo
  todo, e teste sobre ela passava verde com o bug em pé.

- **`z.url()` do Zod 4 aceita qualquer esquema.** `javascript:alert(1)` e
  `data:text/html,…` passam como "endereço válido" — o nome sugere web, e a
  função só confere que é uma URL. Site, Instagram, Facebook e a imagem de
  publicação usavam `z.url()` e acabam num `<a href>` ou `<img src>` que
  qualquer conta logada vê (#354). Hoje o cadastro e a edição usam
  `z.httpUrl()`, e a tela passa o que lê por `linkExterno` (`src/lib/format.ts`):
  o que foi gravado antes da validação não vira `javascript:` num link.
  *Validar na entrada não limpa o que já está no banco; a tela é a última
  porta.*

Os dois do meio têm contrato automático em `tests/unit/cards.test.tsx`, e o
último em `tests/unit/cidades.test.ts` — os três varrem o código-fonte.

- **Teste que passa porque o ambiente de teste é mais limpo que a
  produção não está testando nada.** A varredura de grants perguntava ao
  banco `has_table_privilege('anon', tabela, 'SELECT')` e passava — no
  PGlite, que é um Postgres limpo onde ninguém concedeu nada. O
  **Supabase concede `select` a `anon` e `authenticated` por padrão** nas
  tabelas do schema público, então a pergunta certa nunca era "o banco de
  teste nega?" e sim "o `revoke` está escrito?". `preferencias_notificacao`
  e `inscricoes_push` (#48) nasceram com o `select` aberto em produção,
  com a suíte verde — e a mesma varredura, uma vez consertada, achou
  `pedidos_verificacao` na mesma situação **desde sempre**, guardando
  documento e selfie de gente real. Nenhuma das três vazou, porque RLS
  ligada sem policy nega tudo; o que faltava era a segunda camada, que
  existe justamente para o dia em que alguém criar uma policy por engano.
  Hoje há um teste que lê o texto do `schema.sql` e exige o `revoke`
  escrito para cada tabela da lista. **Quando um teste faz uma pergunta ao
  ambiente, pergunte se o ambiente de teste responde igual ao de
  produção** — e, quando a resposta é "não", teste o artefato que viaja
  para produção, não o comportamento local.

  **E a escrita ficou de fora por um mês (#421).** O mesmo padrão do
  Supabase concede `insert`, `update`, `delete` e `truncate` a `anon` e
  `authenticated` em toda tabela e view, e o schema só revogava o
  `select`: em produção eram 32 relações graváveis pela chave anônima,
  barradas só pelo RLS sem policy de escrita. A aplicação nunca escreve
  com essa chave, então o `revoke` no fim do `schema.sql` não muda nada
  para ela — é a segunda camada que já existia para a leitura. O teste
  concede tudo, como o Supabase, roda `aplica-anon-sem-escrita.sql` por
  cima numa transação e confere que sobrou só o `select` público.

  **E a execução de funções (#449).** O Supabase publica toda função do
  schema público pela API e concede execução às duas chaves. Nenhuma das
  nossas roda com o privilégio do dono, e as chaves não escrevem em nada,
  então isso não alcançava coisa alguma — mas a garantia morava numa
  propriedade de cada função. Hoje só a chave de serviço executa função:
  o fim do `schema.sql` revoga das duas, e `aplica-funcoes-so-servico.sql`
  faz o mesmo em banco existente. **Rode-o de novo depois de qualquer
  `aplica-*.sql` que crie função**, porque o `revoke ... on all functions`
  só alcança as que já existem.

- **Repositório em memória numa variável de módulo não atravessa
  bundles.** Server action e route handler viram bundles diferentes no
  build de produção, e cada um recebe a própria cópia do módulo — logo, o
  próprio `Map`. Em demonstração, a cobrança criada e aprovada pela action
  não existia para `/api/pagamentos/[id]`, que a tela de retorno consulta
  em laço: o efeito era aplicado, a mensalidade estendia, e a tela girava
  em "Confirmando o pagamento" até desistir (#164). É a mesma família do
  contador de limite que "valia por instância", logo acima — só que ali a
  saída foi o banco, e aqui não pode ser, porque o ponto da demonstração é
  não ter banco. A saída é `globalThis`, que os dois bundles compartilham
  dentro do mesmo processo. **Repositório em memória alcançado por mais de
  um tipo de entrada — action e rota — precisa de estado compartilhado
  explicitamente**; os outros deste projeto nunca precisaram porque só
  actions e páginas os leem.

- **Rota que a varredura pula fica sem qualquer cobertura, e a razão da
  exclusão não diz isso.** `/perfil/assinatura` e `/pagamento/retorno`
  entraram em `ROTAS_NAO_VARRIDAS` com uma razão verdadeira — exigem
  sessão de prestador, e as contas compartilhadas da suíte são candidata e
  empresa. Só que "não é varrida por contraste" foi lido como "está
  coberta em outro lugar", e não estava: o fluxo de cobrança inteiro
  nasceu sem nenhum teste de ponta a ponta, e o defeito acima passou. A
  lista de exclusões responde por *varredura*, não por *cobertura* —
  quando excluir uma rota, diga onde ela é exercitada, ou admita que não
  é.

  **E aconteceu de novo, pior: com a razão apontando para um arquivo que
  não cobria nada** (#217). `/admin/painel` dizia ter "cobertura própria
  em `metricas-empresa.spec.ts`" — spec que exercita as métricas da
  *empresa* e **não menciona `/admin` em lugar nenhum**. As únicas três
  referências ao painel na suíte e2e conferem o contrário: que a rota
  responde 404 para quem não é admin. Nenhum teste jamais o renderizou, e
  a #207 pôs um bloco novo lá dentro sem nada que o desenhasse.

  Descoberto conferindo se dava para *afirmar* que havia cobertura — a
  razão escrita dizia que sim. *Razão de exclusão envelhece como código e
  ninguém a executa: quando ela cita um arquivo, abra o arquivo.* Hoje a
  razão nomeia o que cobre cada camada e diz, com todas as letras, que
  não há e2e — e o painel ganhou teste de componente.

- **Suíte e2e não pode falar com banco de verdade.** `npm start` carrega o
  `.env.local`, e quem tem credenciais reais ali roda o e2e contra
  produção sem aviso. Aconteceu: o ajudante de login criou 213 contas na
  base real antes de alguém notar. O `playwright.config.ts` agora zera as
  variáveis do Supabase à força, e `tests/e2e/demo-obrigatorio.spec.ts`
  falha barulhento se o modo demonstração não estiver ativo.

- **Uma regra escrita olhando para um caso só reprova todos os outros.**
  A conferência de CNPJ do prestador comparava a razão social da Receita
  com o nome da pessoa. Funciona para MEI — onde a razão social *é* o
  nome de quem abriu — e reprova ME, EIRELI e LTDA, que são prestadores
  igualmente legítimos. O código estava certo para o exemplo que eu tinha
  na cabeça, e errado para o resto do mundo; passou porque os testes que
  escrevi usavam o mesmo exemplo. Foi o Luiz quem viu, lendo o PR: "o
  CNPJ do prestador não precisa ser obrigatoriamente MEI". **Antes de
  comparar dois campos, pergunte de quantos jeitos diferentes eles podem
  ser preenchidos por gente que está certa** — e desconfie quando o
  teste e a implementação partirem do mesmo exemplo.

- **Uma variável lida antes de uma gravação continua com o valor de
  antes, mesmo depois da gravação acontecer.** `cadastrar()` criava a
  empresa via CPF e, na sequência, marcava `doc_verificado = true` no
  banco — mas devolvia o `usuario` capturado *antes* dessa gravação, que
  continuava com `docVerificado: false`. A conta nascia verificada de
  verdade; só a resposta da própria função de cadastro mentia sobre isso
  por uma requisição. Foi um teste que pegou — `expect(criado
  .docVerificado).toBe(true)` — não uma inspeção manual, que teria visto
  o perfil certo na tela seguinte e concluído que estava tudo bem.
  **Depois de gravar algo que muda um dado que uma variável local já
  capturou, atualize a variável antes de devolvê-la** — ou releia do
  repositório.

- **O rótulo de um rádio que contém o nome de outro campo quebra
  `getByLabel` por ambiguidade — e derruba a suíte inteira, não só o
  teste daquele campo.** O rádio "Empresa registrada (CNPJ)" continha a
  palavra "CNPJ", e o `getByLabel("CNPJ")` do ajudante de login passou a
  casar com dois elementos: o rádio e o campo de texto. Como o
  `auth.setup.ts` roda antes de tudo, os outros 408 testes da suíte nem
  chegaram a rodar. A correção foi tirar o parêntese do rótulo do rádio
  ("Empresa registrada", sem "(CNPJ)") — o campo que aparece embaixo já
  diz qual documento é. **Rótulo de opção não deve conter o nome de um
  campo que pode aparecer na mesma tela.**

- **Uma regra corrigida num caminho e esquecida no outro que leva ao
  mesmo lugar.** A #133 trocou "documento e selfie" por "CPF válido e
  único" como a verificação do prestador — mas só dentro de
  `virarPrestador()`, o caminho de quem converte uma conta já existente.
  Quem se cadastra **direto** como prestador passa por `cadastrar()`, uma
  função irmã que grava o mesmo CPF na mesma tabela e nunca chamava
  `definirDocVerificado`. As duas funções faziam a mesma promessa — CPF
  válido e único libera a busca — e só uma das duas cumpria. Ninguém viu
  porque o comentário que explicava a regra, em
  `perfil-profissional.tsx`, presumia que "hoje `virarPrestador` confirma
  o CPF" cobria os dois jeitos de alguém se tornar prestador; cobria só
  um. Corrigido na #142, replicando em `cadastrar()` a mesma chamada que
  `empresaViaCpf` já fazia logo abaixo, no mesmo arquivo — o exemplo
  estava a poucas linhas de distância e não foi seguido. **Quando duas
  funções produzem o mesmo tipo de conta por caminhos diferentes, uma
  regra de negócio corrigida numa delas provavelmente falta na outra —
  procure a irmã antes de fechar a Issue.**

- **Passar 4,5:1 contra branco não prova que passa contra o próprio
  fundo tingido.** `--color-empresas` e `--color-danger`, no tema claro,
  foram escurecidos até o texto valer como link sobre branco — e
  passavam, com folga (5,85:1 e 6,05:1). Mas `Badge` e o variant
  `danger` de `Button` pintam esse mesmo texto sobre a mesma cor a 15%
  de opacidade (`bg-empresas/15`, `bg-danger/15`), e essa mistura é mais
  clara que o branco puro contra o qual a cor tinha sido calibrada —
  4,45:1 e 4,34:1, abaixo do mínimo. As outras três cores da paleta
  (`vagas`, `servicos`, `warn`) passavam nos dois testes por
  coincidência de quanto já tinham sido escurecidas antes, não porque
  alguém tivesse checado o par certo. Pego pela varredura de
  acessibilidade em `/empresa`, que é a única rota com selo `tone`
  colorido e botão `danger` na mesma tela (#144). **Toda cor que serve de
  texto E de fundo tingido de si mesma precisa ser conferida contra as
  duas combinações — a mais clara das duas é a que decide.**

  **E contra o fundo do quadro onde ela mora (#435).** `--color-danger`
  passava sobre o selo em branco e reprovava com o mesmo selo sobre
  `panel-2` (4,30:1): o botão de perigo dos formulários de excluir conta e
  de denunciar mora num quadro `bg-panel-2`, e os dois ficam fechados até
  o clique — a varredura das rotas nunca os via abertos. Hoje os dois
  specs rodam o axe com o formulário aberto. *Formulário que só abre no
  clique precisa ser varrido aberto.*

- **`setState` no corpo de um efeito é reprovado mesmo quando o motivo é
  legítimo.** `AlternarTema` nascia com estado `null` porque o servidor
  não tem `document`, e um `useEffect([])` lia `data-theme` do DOM e
  chamava `setEscuro` para corrigir isso no cliente — a razão estava
  certa, o `useEffect` não. `react-hooks/set-state-in-effect` reprova o
  padrão de qualquer forma, porque de fora não dá para distinguir "estou
  sincronizando com algo externo no mount" de "estou usando o efeito
  como se fosse um construtor". A troca foi `useSyncExternalStore`, que
  existe exatamente para ler um valor externo ao React (aqui, um
  atributo do DOM) sem manter cópia própria em estado: sem `setState`,
  sem efeito, e o valor já correto na primeira renderização do cliente,
  porque o script anti-flash já tinha ajustado o atributo antes da
  hidratação. Ganho de brinde: como o valor deixou de morar num
  `useState` local, duas instâncias do componente passaram a ficar
  sincronizadas de graça — o `Set` de ouvintes do módulo é compartilhado
  entre todas —, o que a versão antiga nunca fazia (#146). **Quando um
  efeito só existe para ler algo do DOM/ambiente uma vez no mount e
  gravar em estado, é sinal de que o valor deveria vir de
  `useSyncExternalStore`, não de um efeito.**

- **A primeira venda de verdade sumiu, e o diagnóstico errado durou um
  dia.** Em 10/09/2026 entraram R$ 29,90 aprovados no Mercado Pago e a
  cobrança ficou `pendente` para sempre; quem pagou não recebeu a vaga.
  Duas coisas estavam erradas ao mesmo tempo, e confundir uma com a outra
  custou um dia:

  **O que de fato impediu o crédito foi um 401 nosso.** O Mercado Pago
  *entregou* a notificação, na URL certa (`lupapp.com.br`), com o evento
  certo — e `validarAssinaturaWebhook` recusou, porque o deploy no ar
  carregava um `MERCADO_PAGO_WEBHOOK_SECRET` divergente do que ele usava
  para assinar. A recusa está **certa**: notificação que não se pode
  provar não confirma pagamento. O que faltava era barulho — a única
  pista era um `log.warn` por notificação, e ninguém lê log de produção
  todo dia num projeto de duas pessoas. Hoje `src/server/config-obrigatoria.ts`
  confere a configuração quando o processo sobe e derruba antes de
  atender ninguém (#196). **Falha fechada correta e silenciosa faz o
  mesmo estrago que falha aberta** — a diferença entre "estão forjando
  webhook" e "este deploy subiu sem variável" é conhecida na hora de
  subir, não no meio de um pagamento.

  **E o `urlBase()` era um segundo defeito, de verdade, mas não este.**
  Duplicado em `pagamentos/servico.ts` e `esqueci-senha/actions.ts`, ele
  caía em `VERCEL_URL` sem `NEXT_PUBLIC_APP_URL` — e `VERCEL_URL` **nunca
  é o domínio próprio**: é a URL gerada do deploy, diferente a cada
  publicação. Isso mandava os `back_urls` para um hostname descartável,
  então quem pagava voltava para fora do app. Corrigido na #195, e hoje
  a falta da variável derruba produção. Mas ele **não** era a causa do
  crédito perdido, e eu afirmei que era, com confiança, antes de abrir o
  histórico de entregas do painel do Mercado Pago — que dizia `401 - Com
  erro` em letras garrafais. **Quando um sistema externo tem um registro
  do que ele tentou, leia esse registro antes de teorizar sobre o que
  aconteceu**; a resposta estava a dois cliques o tempo todo.

  Um detalhe que atrasou mais: o id da aplicação foi lido de um print e
  um `5` virou `6`. O painel do Mercado Pago responde 5xx genérico para
  aplicação inexistente, o que passa por instabilidade deles. **Número de
  identificação se copia da fonte, não se transcreve de imagem.**

  O que continua valendo dos dois: **valor deduzido em silêncio é
  aceitável enquanto o pior caso for uma tela feia; deixa de ser no
  momento em que o caminho move dinheiro ou sai por e-mail.**

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
