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

**De fora desta rodada:** os erros do Sentry, porque a extensão do navegador
logado estava desconectada.

**O que não é código e continua aberto:** os planos pagos que a meta de 10
mil pessoas exige (Resend, Vercel Pro, Supabase Pro). O aviso de vaga nova
chega a até 500 pessoas por vaga; passar disso pede fila de envio.

## Como foi feito

- Leitura de código. Nada do app foi executado e nada foi enviado a produção.
- Antes de corrigir, cada ponto que virou PR foi relido no código.
- Custo: perto de 3 milhões de tokens nos agentes, fora as tentativas perdidas
  por limite de uso. As correções foram feitas direto, sem agentes.
