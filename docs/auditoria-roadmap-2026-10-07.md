# Roadmap da auditoria de código (06/10/2026, estado de 12/10)

Leitura de código da Lupa com o roteiro da skill de auditoria da Cloudflare:
quatro agentes de reconhecimento e caçadores por área. Esta página junta o que
saiu dela, o que virou PR e o que ainda não foi lido. Os relatórios da outra
frente da auditoria (`docs/auditoria-*-2026-10-06.md`) cobrem arquivos e
cabeçalhos, RBAC, e-mail e tokens, pagamentos e ataques.

**Atualização de 08/10.** Os dez PRs foram mergeados na ordem sugerida
abaixo, depois de rodarem juntos num branch local (`verify` e e2e inteiros
verdes), e o SQL do #393 rodou antes. As seis áreas que tinham ficado sem
leitura foram lidas: o resultado está em "Segunda leitura", no fim, e as
correções na #396.

**Atualização de 12/10.** Terceira rodada, em "Terceira rodada", antes de
"Como foi feito": revisão dos PRs que entraram desde 08/10, prontidão para
receber mais de 10 mil pessoas, logs de produção e mais nove correções, todas
mergeadas e no ar. Nada desta página está esperando decisão.

**Resumo.** Treze pontos viraram correção, em dez pull requests, todos com
teste. Nada ficou esperando
decisão: o T2 e o T5 foram decididos pelo Luiz em 07/10 e estão em PR. O que a
leitura achou são candidatos que ninguém reproduziu contra o app; o que os
testes provam é que cada correção muda o comportamento (nos de pagamento,
cron, login, cadastro e teste grátis, os testes novos falham sem a correção,
conferido tirando o código e rodando de novo).

## Corrigido e mergeado em 08/10

| PR | Issue | O que corrige | Severidade |
|---|---|---|---|
| #357 | #356 | Push: o endereço de inscrição só vale se for dos serviços dos navegadores (FCM, Mozilla, Apple, WNS), com prazo de 10 s no envio. | Média |
| #359 | #358 | Pagamentos: aprovar depois de uma recusa na mesma preferência, e segredo do cron em qualquer deploy da Vercel. | Média |
| #385 | #384 | Pagamentos: efeito que falha reabre a cobrança (parte da branch do #359). | Média |
| #387 | #386 | Login, recuperação de senha e confirmação de e-mail reservam a tentativa antes do Argon2. | Média |
| #391 | #390 | Cadastro: conflitos de e-mail, CPF e CNPJ têm teto por origem (parte da branch do #387). | Média |
| #353 | #352 | Sessão: lista de revogação com teto próprio, e corte ao trocar o papel. | Baixa |
| #355 | #354 | Links do usuário (site, Instagram, Facebook, imagem de publicação) só valem como http(s). | Baixa |
| #361 | #360 | Token na URL fora do Sentry, e checagem na ação de verificação do admin. | Baixa |
| #389 | #388 | Varredura de cobranças: a fila de pendentes gira. | Baixa |
| #393 | #392 | Teste grátis: um por conta, gravado. **Exige SQL antes do merge.** | Baixa |

Detalhe de cada decisão, o que foi descartado e o porquê: corpo do commit e
AGENTS.md de cada PR.

### Pontos de atenção

- **#393 só depois de rodar `supabase/aplica-teste-gratis-usado.sql`** no
  Supabase. É uma linha (`add column if not exists`), segura de repetir. O
  código novo lê a coluna ao assinar, e sem ela assinar a mensalidade falha.
  SQL em produção é com o Luiz.
- **#359:** conferir que `CRON_SECRET` está definido em Production, e depois do
  deploy que o cron das 11h responde 200.
- **#357:** depois do merge, ligar o aviso de vaga no Chrome, no Firefox e no
  Safari. Navegador com serviço de push fora da lista não consegue ligar o
  aviso, e isso é esperado.
- **#387** mexe no fluxo de login e merece a leitura mais atenta.
- **#385 e #391 são empilhados:** incluem os commits da base. Se a base entrar
  antes, o diff deles encolhe para o commit novo.
- **Conflito esperado:** #393 com #353, em
  `tests/unit/server/repositorio-postgres.test.ts` (os dois acrescentam ao fim
  do arquivo). Quem entrar depois mantém os dois lados.

## Já resolvido pela outra frente

A auditoria adversarial de 06/10 corrigiu e mergeou enquanto a leitura rodava.
Conferi na `main` e não dupliquei:

- Redirecionamento do login com `/\` (#345).
- Origem do limite por IP vinda de cabeçalho confiável (#346).
- Mensalidade do prestador estendida em SQL atômico (#348).
- HSTS (#350).
- Aviso do `sharp`: atualização para a 0.35.5 (#367), conferência dos bytes da
  foto antes de ela chegar ao `sharp` (#369) e o teste que fixa isso (#371).

## Endurecimento, sem urgência

Nada disto virou PR. São pontos sem exploração conhecida, para agrupar quando
alguém mexer nos módulos.

- ~~O `connect-src` da CSP aceita `*.supabase.co`; estreitar para o host do projeto.~~
  Corrigido na #400, e mais que estreitado: o navegador não fala com o
  Supabase, então o host saiu.
- O cookie de sessão não tem o prefixo `__Host-`, e o logout só limpa o cookie.
  Uma ação "sair de todos os aparelhos" fecha isso. **A segunda metade entrou
  na #402** ("Sair dos outros aparelhos", no perfil), e o `__Host-` na #408,
  com o custo de deslogar todo mundo uma vez.
- ~~O matcher do `proxy.ts` tem prefixos sem âncora (`icon`, `avatares`,
  `api/cron`) e exclui por extensão de arquivo.~~ Corrigido na #404: cada
  item vale para o caminho exato ou depois de `/`, e o estático entra por pasta.
- ~~`confirmarParcelaDaAssinatura` confia no status embutido na fatura em vez de
  reler o pagamento.~~ Corrigido na #405: status e valor vêm de
  `/v1/payments/{id}`.
- ~~Um token de recuperação antigo continua válido por uma hora quando se pede
  outro, e `/verificar-email` consome o token no GET, o que um antivírus de
  e-mail pode gastar.~~ Corrigido na #398: o token novo aposenta os
  anteriores, e a confirmação é um botão.
- ~~A cota de 100 e-mails por dia do Resend tem limite só por origem: uma origem
  esgota a cota de todo mundo.~~ Corrigido na #407: por dia, 20 confirmações e
  10 recuperações por origem, e 3 por conta e origem, 10 por conta.
- `SESSION_SECRET` igual em preview e produção aceitaria token de um no outro.
  Desde a #408 a audiência do token carrega o ambiente, e o de preview não vale
  em produção mesmo com o segredo igual. Conferir na Vercel continua sendo o
  certo.
- ~~A chave anônima tem `insert`, `update`, `delete` e `truncate` em todas as
  32 relações do schema público~~ (varredura de 12/10, no banco de produção).
  Corrigido na #421: o RLS já barrava, e o `revoke` é a segunda camada.
- `CRON_SECRET` não está na lista de variáveis obrigatórias da subida, de
  propósito: exigir derrubaria o deploy se faltasse. A rota responde 503.
- ~~Se `estenderMensalidade` falhar depois de a reivindicação do teste grátis ser
  gravada, o teste é gasto sem dar os dias.~~ Corrigido na #406: a falha devolve
  o teste e a assinatura a `pendente`. Segue sem resposta se o Mercado Pago
  barra teste repetido no mesmo cartão.

## Ordem de merge (seguida em 08/10)

1. #357 e #359, depois que a CI ficar verde. Mexem com rede e com dinheiro.
2. #385, que parte do #359.
3. #353, #355, #361 e #387.
4. #391, depois do #387.
5. #389, sem pressa.
6. #393, **só depois de rodar o SQL**.

## O que não foi lido em 06/10

Quatro dos quatorze caçadores devolveram resultado: sessão, cadastro e
recuperação, ações e CSRF, pagamentos e webhook. Os outros dez foram
interrompidos por limite de uso e pela decisão de reduzir o gasto. A outra
frente cobriu arquivos e cabeçalhos, RBAC, e-mail e tokens, e pagamentos.

Pelo que se sabe, **seguem sem leitura dedicada:** schema e RLS, views e ciclo
de vida, busca e injeção, links e CSP, push, e configuração e CI. Isso não quer
dizer que estejam limpos.

## Segunda leitura (08/10, #396)

As seis áreas acima, lidas direto no código, sem agentes. Nada foi enviado a
produção para conferir; o que a leitura afirma está dito com o caminho do
arquivo, e as correções têm teste.

**Corrigido na #396:**

- **Buckets públicos listáveis.** `avatares` e `portfolio` tinham policy de
  `select` em `storage.objects`, que não serve para entregar a URL pública e
  servia para listar o bucket com a chave anônima — e o caminho começa pelo id
  da conta. Saíram do `storage.sql`; `aplica-storage-sem-listagem.sql` tira
  do banco que já existe. Baixa.
- **Actions mortas que aceitavam endereço de imagem.** `publicar` e
  `editar`, em `perfil/publicacoes/actions.ts`, recebiam qualquer `https`
  como foto e nenhuma tela as chamava. Removidas. Baixa.
- **Permissões do workflow no arquivo.** `permissions: contents: read` no
  topo do `ci.yml`; o padrão do repositório já era leitura. Endurecimento.

**Registrado, sem correção:**

- ~~**A `main` não tem proteção de branch.** Push direto e force-push são
  aceitos, e cada push publica em produção; "tudo por PR com CI verde" é só
  combinação.~~ Ligada em 12/10, com o OK do Luiz: PR obrigatório, com
  tipos, testes, Playwright e roadmap verdes, sem aprovação obrigatória,
  sem force-push, valendo também para admin.
- ~~**Não há exclusão de conta pela tela.** Direito do titular na LGPD (art.
  18).~~ Corrigido na #423: botão no perfil, que anonimiza a conta.
- ~~**A decisão do admin apaga documento de `verificacao` com a chave
  anônima**, que não tem policy de `delete` — a remoção falharia em
  silêncio. Sem efeito hoje: nenhum documento chega à fila (#133).~~
  Corrigido na #419, e era maior: com a chave anônima a ação nem lia o
  pedido. Usa a de serviço, e falha ao apagar vai ao Sentry.
- ~~**`tokens_recuperacao` nunca é limpa.** Hash, usados ou vencidos; só
  ocupam espaço.~~ Corrigido na #419: o token novo apaga os anteriores, e
  a tabela guarda no máximo um por pessoa e finalidade.
- ~~Falta `Cross-Origin-Opener-Policy`~~ (varredura de 12/10). Corrigido na
  #419: `same-origin`.

**Sem achado:** RLS das tabelas (todas ligadas, só policies de leitura),
escrita por view (nenhuma é atualizável: todas têm `join` ou agregação),
funções (nenhuma é `security definer`, então RPC com a chave anônima
esbarra no RLS), busca (termo entre aspas com escape, estado validado
contra a lista de siglas, termo gravado com 2 a 80 caracteres), CSP (nonce,
`frame-ancestors`, `object-src`, `base-uri` e `form-action` travados;
imagem remota só do host do Supabase no otimizador), push (inscrição por
`endpoint`, que só o navegador conhece) e segredos no repositório.

## Terceira rodada (12/10)

Leitura direta, sem agentes. Nada foi enviado a produção para testar: a
varredura de páginas rodou num servidor local em modo demonstração, e no
banco de produção só se leu (a não ser os quatro SQL abaixo, rodados com o
OK do Luiz).

**Corrigido e mergeado:**

| PR | Issue | O que corrige |
|---|---|---|
| #414 | #413 | Reemitir a sessão sem senha não recomeça os 30 dias do teto. |
| #416 | #415 | Cadastro aceita 20 contas por IP a cada 15 minutos (era 5: um posto de atendimento travava na sexta pessoa), e IPv6 é agrupado pela rede /64 em todo teto por origem. |
| #418 | #417 | Cota estourada do Resend avisa o Sentry uma vez por janela, em vez de gastar a cota dele num dia de lançamento. |
| #411 | #407 | Cota diária de e-mail (do Paulinho), ajustada: por origem e por fluxo, e por conta e origem, para ninguém gastar a cota de outra pessoa. SQL rodado. |
| #420 | #419 | Decisão do admin com a chave de serviço; tokens antigos apagados; `Cross-Origin-Opener-Policy`. |
| #422 | #421 | A chave anônima perde a escrita que o Supabase concede por padrão (32 relações). SQL rodado. |
| #424 | #423 | Excluir a própria conta pelo perfil (LGPD). SQL rodado. |
| #426 | #425 | A senha de excluir conta gasta o limite do login; o PDF do currículo tem teto. |
| #428 | #427 | Teto de pixels na foto. Medido antes: o pior caso não derrubava a função (0,4 s, 190 MB); é endurecimento. |

**Configuração:** a `main` passou a exigir PR com tipos, testes, Playwright e
roadmap verdes, sem force-push (12/10, com o OK do Luiz).

**Conferido sem achado:**
- e2e inteiro na `main`: 578 passaram, nenhuma falha.
- Varredura logada, como candidato e como empresa: nenhuma página carrega
  hash, chave, CPF ou token; vaga com HTML e script no texto não executa.
- Rotas de API conferem o dono antes de responder.
- Logs de produção do Supabase, 24 horas: nenhum erro na borda nem no
  Postgres.
- `npm audit`: as oito vulnerabilidades são de ferramentas de
  desenvolvimento; as dependências de produção estão limpas.
- Não há caminho para tomar a conta de alguém só com o cookie: a senha só
  muda pelo link do e-mail, o e-mail não se edita, e excluir pede a senha.

**Sentry**, conferido no fim do dia, depois de a extensão do navegador
reconectar: nenhum problema em aberto, e 7 erros em 30 dias, todos
resolvidos, o último de 23/09. A integração está viva (chegaram registros de
desempenho nas últimas 24 horas), e o erro de servidor do teste manual de
23/09 chegou com o CPF mascarado — a falta de erro não é o Sentry desligado.

**O que não é código e continua aberto:** os planos pagos que a meta de 10
mil pessoas exige (Resend, Vercel Pro, Supabase Pro). O aviso de vaga nova
chega a até 500 pessoas por vaga; passar disso pede fila de envio.

## Quarta rodada (13/10)

Leitura direta, sem agentes. Abuso de regra de negócio e as últimas portas
de redirecionamento. Os SQL foram rodados com o OK do Luiz.

| PR | Issue | O que corrige |
|---|---|---|
| #434 | #433 | A busca de candidatos fica só para empresa com CNPJ conferido, com teto de 30 perfis abertos por dia: ninguém colhe em série o WhatsApp de quem pediu para ser encontrado. |
| #436 | #435 | Denúncia de vaga e de avaliação, com decisão do admin; nada sai do ar sozinho. A cor de perigo reprovava o contraste sobre `panel-2`, inclusive no excluir conta. SQL rodado. |
| #438 | #437 | O destino do login conferia a URL que entrava e não o caminho que devolvia: uma forma passava e, relida pelo navegador, levava para outro domínio depois do login. Confirmado no navegador antes da correção. |
| #440 | #439 | Endurecimento: o termo de busca chega à consulta e ao cache com no máximo 100 caracteres; só se avalia quem é prestador; o `robots.txt` deixa de anunciar `/admin`. |
| #442 | #441 | Até 3 avaliações do mesmo prestador por rede a cada 24 horas: a rajada de contas falsas de uma conexão para. Decisão do Luiz. |
| #446 | #445 | A saudação dos e-mails de confirmação e de recuperação levava o nome cadastrado quase cru: um estranho, criando conta com o e-mail de outra pessoa, punha uma frase com link num e-mail legítimo da Lupa. Hoje só o primeiro nome, só letras; o cadastro recusa caractere invisível. |
| #448 | #447 | O título da vaga, que vai no aviso por push para até 500 pessoas, recusa link. |
| #450 | #449 | Funções do banco só executáveis pela chave de serviço: a segunda camada para o dia em que uma `security definer` aparecer. SQL rodado. |
| #453 | #452 | Denúncia de foto de trabalho; tirar do ar apaga a publicação e o arquivo (arquivada, a foto seguiria no ar pelo endereço). SQL rodado. |
| #455 | #454 | "Apagar de vez" um trabalho guardado, com a foto; o cartão guardado deixa a opacidade que reprovava o contraste. |

**Configuração (13/10, com o OK do Luiz):** o monitor de disponibilidade do
Sentry consultava a home a cada minuto — cerca de 80% das chamadas de
função da Vercel, e a maior parte da CPU do mês. A CPU é o teto que chega
primeiro no plano grátis: 1h37m de 4h usadas em 30 dias, e ao estourar a
Vercel pausa o site. O monitor passou a consultar a cada 10 minutos. O
resto do uso estava longe do teto: 84,5 mil de 1 milhão de chamadas,
1,92 GB de 100 GB de tráfego, 112 de 5.000 transformações de imagem.

E o login próprio do Supabase estava com o cadastro aberto, embora a Lupa
não o use (a autenticação é a tabela `usuarios`, desde a migração 0001).
Não vazava dado — quem se cadastrasse ganharia o papel `authenticated`,
que lê exatamente as 8 relações públicas que a chave anônima já lê —, mas
qualquer um conseguiria fazer o Supabase mandar e-mail de confirmação a
qualquer endereço usando o projeto. Ninguém tinha usado (zero usuários em
`auth.users`). Cadastro desligado no painel em 13/10, com o OK do Luiz, e
conferido pela API pública (`disable_signup: true`).

**E o GitHub (13/10, com o OK do Luiz):** o repositório é público e estava
com a varredura de segredos, o bloqueio de push com segredo e os alertas do
Dependabot desligados — os três são gratuitos em repositório público. Ligados
e conferidos pela API. Antes, uma varredura local no histórico inteiro
(todos os branches) atrás de chave de serviço do Supabase, token do Mercado
Pago, chave do Resend, token do Sentry, chave VAPID, segredo de sessão e
senha de banco não achou nada; o mesmo método acha o segredo de teste do
Playwright, que está versionado de propósito, e o único JWT do histórico é
um token falso de teste (`{"papel": "admin"}`).

**Pendente com o Luiz:** a `RESEND_API_KEY` está em produção **e em
preview** na Vercel. No preview ela não é usada (o envio exige também o
remetente, que só existe em produção), mas fica ao alcance do código de
qualquer branch. Tirá-la do preview é uma edição no painel; a variável é do
tipo Secret, e a documentação da Vercel não garante que salvar sem
reescrever o valor o mantém — por isso não foi feito por mim, que não tenho a
chave para repor.

**Conferido sem achado:**
- O JSON-LD da home e o script do tema são texto fixo, sem dado de quem usa.
- Funções do banco: nenhuma `security definer`; Storage sem política que
  deixe a chave anônima enviar arquivo, e os quatro buckets com limite de
  tamanho e de tipo; Realtime sem tabela publicada.
- Vercel: previews exigem login da Vercel e ser da equipe; PR de fork só
  ganha preview com autorização de alguém da equipe; logs, código-fonte e
  sourcemaps protegidos; segredos de Supabase, Mercado Pago, Sentry e cron só
  em produção; `SESSION_SECRET` com valor diferente em preview.
- O workflow do GitHub roda em `pull_request` (PR de fork sem segredo e com
  token só de leitura), e o corpo do PR entra por variável, não no script.
- A sessão é conferida com algoritmo fixo (HS256), e o link de redefinir
  senha não vaza para outros sites (`strict-origin-when-cross-origin`).
- As rotas de API que recebem id (`/api/pagamentos/[id]`,
  `/api/assinaturas/[id]`) conferem o dono e respondem 404 a quem não é;
  `/api/admin/metricas` responde 404 a quem não é admin.
- **Advisor do Supabase**, de segurança e de desempenho. As duas views
  `security definer` (`job_listings`, `provider_listings`) são o desenho: a
  janela pública e controlada sobre tabelas fechadas, com o teste de schema
  cobrando as colunas. As 15 tabelas com RLS e sem policy são as fechadas, de
  propósito. Os 11 índices sem uso servem caminhos raros (exclusão de conta,
  fila do admin, avisos).
- O boletim de outubro do Supabase não pede ação. A cobrança de logs por uso
  tem carência garantida até o começo de 2027 para a organização, criada
  antes de 25/09/2026.

## Como foi feito

- Leitura de código. Nada do app foi executado e nada foi enviado a produção.
- Antes de corrigir, cada ponto que virou PR foi relido no código.
- Custo: perto de 3 milhões de tokens nos agentes, fora as tentativas perdidas
  por limite de uso. As correções foram feitas direto, sem agentes.
