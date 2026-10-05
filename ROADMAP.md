# Roadmap

Visão geral do que está pronto e do que falta, para quem chega no
projeto sem ter acompanhado a conversa. Mantido por quem mexe no
código — humano ou agente — a cada mudança relevante. Para o
passo a passo de como contribuir, veja o [CONTRIBUTING.md](CONTRIBUTING.md).
Detalhe de arquitetura e o porquê de cada decisão está no
[AGENTS.md](AGENTS.md); o desenho do sistema, com diagramas, em
[docs/arquitetura.md](docs/arquitetura.md).

**Última atualização: 05/10/2026.**

## Concluído

Em 05/10/2026:

- Logo nova: lupa de aro grosso em degradê de verde com uma pessoa no
  centro, e o nome "Lupa" desenhado em vetor (Outfit Bold, sem carregar a
  fonte). Troca o *check* da logo antiga, que prometia "verificado". Vale
  para o cabeçalho, o login, o 404 e a tela de erro, nos dois temas; para o
  ícone do app e do iPhone, a imagem do link no WhatsApp e o favicon —
  [#343](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/343)
- Busca no hero da home, no lugar dos cards de ação: alternador Vagas |
  Serviços, campo de busca, estado e atalhos de categoria, que levam à lista
  já filtrada. As listas ganharam o mesmo alternador no topo, que leva o
  termo e o lugar de uma para a outra. Sem conta, o hero avisa que a busca
  termina no login (o muro de `/vagas` e `/servicos` continua) —
  [#341](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/341)
- Os quatro buckets do Storage têm limite de tamanho e de tipo no próprio
  Supabase — imagem até 2 MB, currículo e verificação até 4 MB —, como
  segunda camada atrás da conferência da aplicação. Aplicado em produção
  em 05/10/2026, e os arquivos que já existiam cabem nos limites.
  Currículo agora também precisa ser PDF de verdade —
  [#332](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/332)
- Os achados baixos da auditoria de 29/09: sessão revogada vai ao login
  em vez de "página não encontrada", regravar o hash no login não derruba
  os outros aparelhos, ponto literal no muro de login, valor pago
  diferente avisa o Sentry, currículo precisa ser PDF de verdade,
  trabalho tirado do perfil tem caminho de volta, textos, documentação
  que contradizia o código e dependências de desenvolvimento —
  [#330](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/330),
  [#331](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/331),
  [#333](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/333),
  [#334](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/334)

- Quem usa o app não é mais deslogado a cada sete dias: a sessão renova
  sozinha na navegação, sai depois de sete dias sem uso e, em qualquer
  caso, trinta dias depois do login. A renovação guarda a hora do login,
  e trocar a senha continua derrubando as outras sessões —
  [#323](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/323)
- E-mail que não sai chega ao Sentry, com o fluxo e o status, e o limite
  do plano grátis do Resend (429) diz que é cota. Sem o endereço de
  ninguém no registro —
  [#326](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/326)
- Foto do celular entra: acima de 2 MB, ela é reduzida no próprio
  aparelho antes de enviar, em vez de recusada —
  [#325](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/325)
- Currículo em PDF até 4 MB, o que cabe na Vercel, e o tamanho é
  conferido antes de enviar, com mensagem em português —
  [#324](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/324)

Em 01/10/2026:

- Cadastro e perfil pedem só a cidade: o bairro de pessoa saiu de tudo —
  formulários, ordem da busca, selo "Perto de você", currículo e painel do
  admin. Só a vaga mantém o bairro, texto livre e opcional, só
  informativo. O banco não mudou —
  [#321](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/321)
- O app atende o Brasil inteiro: os 5.571 municípios do IBGE, estado e
  cidade em dois passos, filtro de estado na busca e o degrau "mesmo
  estado" na ordem por proximidade. Nenhuma cidade vem escolhida por
  padrão — [#301](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/301)
- Modalidade da vaga — presencial, home office ou híbrido — no cadastro da
  vaga e como selo no card e no detalhe —
  [#300](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/300)
- Tela de plano depois do cadastro da empresa: o grátis vem primeiro, a
  confirmação diz que nada foi cobrado, e tudo cabe no celular sem rolar —
  [#299](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/299)
- Script para tirar os dados de exemplo da vitrine de produção, e frase
  própria para home e busca vazias. Reverte a #245; o script roda à mão,
  ver "Depende de decisão" —
  [#302](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/302)
- "Conferir CNPJ" voltou a funcionar: a BrasilAPI recusava o pedido do
  servidor por causa do `User-Agent` padrão do Node —
  [#318](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/318)
- A empresa assina vaga e avaliação com o nome dela, não o do responsável,
  e nenhum nome se edita depois do cadastro — só a conferência do CNPJ
  troca o da empresa, pelo da Receita. Resolve também a
  [#304](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/304) —
  [#315](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/315)
- A aba do navegador mostra a logo da Lupa, e não mais o triângulo do
  Next. Página inexistente, erro e cada tipo de cadastro ganharam título
  próprio — [#303](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/303)

Preparação para o lançamento, de 15 a 25/09/2026:

- Celular sem zoom no iPhone e com alvos de toque de 44 px: campos de
  formulário com 16 px abaixo de `md`, e "Ver todas", "Entrar",
  "Esqueci minha senha", "Criar conta gratuita" e os links do rodapé com
  altura mínima de 44 px —
  [#314](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/314)
- Avisos de vaga a um toque: sininho no cabeçalho, para quem pode se
  candidatar, em vez de escondidos no fim de "Editar perfil" —
  [#288](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/288)
- Erro num campo não apaga mais o formulário: o que foi digitado fica, e a
  tela leva ao campo errado, com borda vermelha. Vale para todo formulário
  do app, com teste que cobra o próximo —
  [#291](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/291)
- Senha mínima de 6 caracteres, decisão do Luiz. O servidor exigia 10 e as
  telas diziam 8; hoje o número vem de uma constante só —
  [#290](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/290)
- Foto entregue no tamanho da tela, e gravada já reduzida, em WebP e sem o
  GPS do celular — [#267](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/267), [#283](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/283)
- Envio de foto bloqueado em produção pelo WAF do Cloudflare, antes de
  chegar à Vercel. Resolvido com o domínio em DNS only —
  [#287](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/287)
- Sentry recebendo de verdade: os erros que o `criarAcao` captura, os de
  quem não está logado, e as transações que a máscara de dados corrompia
  ou descartava — [#247](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/247), [#269](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/269), [#273](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/273), [#275](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/275), [#277](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/277),
  [#281](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/281), [#255](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/255)
- Produção não sobe sem `SESSION_SECRET` válido nem sem as três variáveis
  do Supabase. Sem elas, o site subia com todo mundo deslogado, ou servia
  dado de demonstração como real — [#271](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/271), [#279](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/279)
- Página de erro em português, com caminho de volta, no lugar da tela
  preta do Next — [#249](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/249)
- A tela para de prometer o que não entrega: verificação que o produto não
  faz ([#237](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/237), [#243](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/243)), filtro por bairro ([#285](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/285)), "emprego
  formal" num app que aceita freela e vaga de pessoa física ([#257](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/257)),
  "Documento não verificado" para sempre no perfil do candidato
  ([#253](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/253)), e prestador sem assinatura lendo "como você aparece na
  busca" sem aparecer ([#256](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/256))
- Currículos recebidos legíveis no celular, e o painel do prestador sem os
  links de busca de candidatos que davam 404 — [#252](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/252), [#251](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/251)
- Canal de contato (Instagram e e-mail) visível antes do login, e link da
  Lupa com imagem de prévia no WhatsApp — [#239](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/239), [#259](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/259)
- As vagas e os prestadores de demonstração não vencem mais, e o seed
  passou a reproduzi-los — [#245](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/245)

Em 15/09/2026:

- Home pública, sem exigir login — o resto do app continua fechado
  ([#241](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/241)).
  `robots.txt` e `sitemap.xml` junto, para o Google indexar.

Segurança, na semana de 13→14/09/2026:

- Teto de volume em toda escrita e teto de linhas em toda listagem
  ([#202](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/202),
  [#203](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/203))
- Cache das listagens e funções na mesma região do banco
  ([#206](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/206),
  [#213](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/213))
- Pressão nos tetos visível no painel, sem guardar quem
  ([#207](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/207))
- `search_path` fixo nas funções do banco
  ([#219](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/219))
- A chave anônima deixou de se chamar publicável
  ([#221](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/221),
  [#231](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/231))
- CSP com nonce por requisição
  ([#223](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/223))
- Trocar a senha derruba as sessões antigas, inclusive pelo script de
  admin ([#225](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/225),
  [#230](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/230))
- Confirmação de e-mail
  ([#227](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/227))
- Senha de admin trocada em produção
  ([#69](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/69)) — a
  troca só passou a derrubar as sessões antigas com a #230, que entrou
  antes de o script rodar

Base:

- Autenticação própria (cadastro, login, sessão em JWT, RBAC por papel)
- App fechado por login — a home é a única exceção, desde a #241 — com
  404 de verdade em vez de 403 onde faz sentido
- Perfil por papel (candidato CLT, prestador, empresa) com edição em
  `/perfil/editar`
- Envio de foto de perfil, currículo em PDF e logo de empresa, com
  caminho derivado da sessão
- Busca de vagas e de prestadores, com filtro por cidade e categoria (e
  tipo de contrato, nas vagas). Bairro não filtra nem ordena: o de pessoa
  saiu na #321, e a promessa de filtro saiu das telas na #285
- Candidatura a vaga, e acompanhamento em "Minhas candidaturas"
- Aviso de vaga nova por cidade e categoria, via Web Push (#48)
- Publicações no perfil do prestador, com limite de 10 ativas
- Painel administrativo: métricas, caixa (#179) e pressão nos tetos
  (#207). A fila de verificação manual existe no banco, mas nunca teve
  tela de envio; a verificação do prestador é o CPF desde a #133
- Schema único (`supabase/schema.sql`), executado por teste contra
  Postgres real
- Modo demonstração (roda sem Supabase configurado)
- Contraste WCAG AA em todas as rotas, com teste automático

Painel da empresa:

- Busca entre quem pediu para ser encontrado, com filtro por habilidade e
  área, e perfil do candidato —
  [#96](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/96),
  PR [#99](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/99)
- Estágio com o nome de quem lê ("Não visualizado" para o candidato,
  "Nova" para a empresa) e % de casamento na lista de currículos —
  [#95](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/95),
  PR [#97](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/97)
- "Quero que empresas me encontrem": consentimento do candidato, desligado
  por padrão, e proximidade no bloco de recomendados —
  [#83](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/83),
  PR [#84](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/84)
- Habilidades viram skills e o painel recomenda candidatos —
  [#73](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/73),
  PR [#74](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/74)
- Ficha do candidato e contato direto nos currículos recebidos —
  [#71](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/71),
  PR [#72](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/72)

- Publicar e encerrar vaga. Editar existiu até a #173, que trocou a
  edição pela revisão antes de publicar —
  [#43](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/43),
  PR [#51](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/51)
- Mover candidatura entre estágios —
  [#44](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/44),
  PR [#58](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/58)
- Métricas por dia, com dado real —
  [#45](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/45),
  PR [#59](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/59)

Alcance:

- Mato Grosso inteiro, começando por Sinop: os 142 municípios valem no
  cadastro, na vaga e nos filtros —
  [#62](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/62),
  PR [#63](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/63)
- Vaga publicada fora de Sinop sumia da busca: a tela chutava a cidade
  quando a URL não trazia nenhuma —
  [#76](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/76),
  PR [#77](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/77)
- O mais perto de quem está olhando aparece primeiro, por região do IBGE —
  [#79](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/79)
- Título e descrição de `/vagas` e `/servicos` acompanham a cidade
  filtrada, em vez de dizer Sinop sempre —
  [#78](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/78)

Prestador:

- Virar prestador completa o perfil que já existe, em vez de pedir conta
  nova — com aviso do que a troca de papel custa —
  [#112](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/112)
- A busca de serviços só mostra quem passou pela verificação; o perfil
  continua alcançável e diz por que ainda não aparece —
  [#114](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/114)
- O feed de trabalhos do prestador, que tinha backend e nenhuma tela — e
  o atalho do perfil que apontava para a busca pública —
  [#115](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/115)
- Avaliar um prestador com nota e comentário — o convite que estava na
  tela desde o começo e não tinha botão —
  [#116](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/116)
- Quem entrava direto como prestador pelo cadastro nunca tinha o CPF
  confirmado e ficava fora de `/servicos` sem aviso de como corrigir —
  a mesma verificação por CPF já valia para quem convertia a conta pela
  ativação (#133), só faltava no cadastro direto —
  [#142](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/142)

Perfil e vaga, o que cada um informa:

- Endereço na vaga, fora do ranking de proximidade —
  [#86](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/86),
  PR [#87](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/87)
- Instagram e Facebook para empresa e prestador; o `site`, que existia e
  nunca aparecia, passa a aparecer —
  [#92](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/92),
  PR [#94](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/94)
- "Local" da vaga dizia só o bairro, sem a cidade — ambíguo com o estado
  inteiro aberto —
  [#88](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/88),
  PR [#89](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/89)
- Empresa via campo de foto pessoal que não usa, e o envio morria acima de
  1 MB — o limite do framework era menor que o anunciado —
  [#90](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/90),
  PR [#91](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/91)

Segurança (auditoria dos 20 pontos, em duas passadas):

- Views sensíveis vazavam pela chave anônima —
  [#52](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/52),
  PR [#53](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/53)
- Termo de busca injetava condição no filtro do PostgREST —
  [#54](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/54),
  PR [#56](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/56)
- CSP, limite no cadastro e varredura de dependências na CI —
  [#55](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/55),
  PR [#57](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/57)
- View faltando derrubava "Minhas candidaturas" em produção; tabelas
  sensíveis sem `revoke` —
  [#64](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/64),
  PR [#65](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/65)

Decisões futuras, com dado em vez de palpite:

- Limite de tentativa durável no Postgres —
  [#67](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/67),
  PR [#86](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/86)
- Registrar busca sem resultado, para decidir sobre busca semântica —
  [#66](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/66),
  PR [#85](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/85)

Qualidade:

- Score de mutação de 59,4% para 71,6%, com o piso onde estava —
  [#60](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/60),
  PR [#61](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/61)
- Arquitetura desenhada em `docs/arquitetura.md`
- Envio de foto, currículo e logo conferido em produção, com conta real —
  [#70](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/70). A
  conferência achou o caminho quebrado acima de 1 MB, corrigido em
  PR [#91](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/91)
- Manifesto do PWA era barrado pelo muro de login, e o app deixava de ser
  instalável para quem ainda não tem conta —
  [#98](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/98),
  PR [#100](https://github.com/LUIZZZZ8084/LUPA-PROJECT/pull/100)
- Varredura de rotas e de autorização: toda rota do app passa por
  contraste e por largura de tela, com a sessão do papel certo, e um
  contrato varre `src/app` para a lista não envelhecer de novo. A
  investigação achou `/empresa` e `/empresa/vagas/nova` sem checagem de
  papel — qualquer conta autenticada abria as duas —
  [#104](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/104)
- `--color-empresas` e `--color-danger`, no tema claro, passavam 4,5:1
  contra branco e reprovavam contra o próprio selo e botão — que pintam
  o texto na cor cheia sobre a mesma cor a 15% de opacidade, mistura
  mais clara que branco puro. Pego pela varredura de acessibilidade em
  `/empresa` —
  [#144](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/144)
- `AlternarTema` chamava `setState` no corpo de um efeito para ler
  `data-theme` no mount — legítimo (o componente roda no servidor sem
  `document`), mas reprovado pela regra `react-hooks/set-state-in-effect`
  e vermelho na CI desde o tema virar padrão claro. Reescrito com
  `useSyncExternalStore`, sem estado próprio —
  [#146](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/146)
- Vaga expira 30 dias após publicada, e some de `/vagas` e da home; a
  empresa reativa pelo painel. Reativar era gratuito enquanto publicar
  também era; desde a #172 gasta uma vaga do saldo, como publicar —
  [#157](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/157)
- Infraestrutura de cobrança via Mercado Pago (tabela `pagamentos`,
  webhook com assinatura validada, modo demonstração sem credencial) e
  mensalidade de prestador como primeiro uso real — sem ela, o perfil
  some da vitrine de `/servicos`. A espera por demanda antes de cobrar
  (decidida em 25/08) foi revertida em 08/09/2026 —
  [#159](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/159)
- A mensalidade renova sozinha: assinatura recorrente (`preapproval`),
  cancelamento que mantém os dias já pagos, e devolução integral só na
  primeira cobrança, em até 30 dias. Antes disto era pagamento avulso —
  o perfil sumia da vitrine no dia 31, sem cobrança nova e sem aviso —
  [#170](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/170)
- Publicar vaga passou a ser pago: avulsa, pacotes de 5 e 10, e plano
  mensal ilimitado. Publicar **e reativar** gastam do saldo, para não
  sobrar o caminho de renovar a mesma vaga para sempre. A tela fala em
  "vagas" e "saldo", nunca em crédito: a palavra sugeria recarga mensal,
  e não há —
  [#172](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/172)
- Revisão obrigatória antes de publicar, e vaga que não se edita depois.
  As duas metades da mesma decisão: sem edição, editar deixa de ser o
  caminho para não pagar; com revisão, o erro de digitação não custa outro
  crédito — [#173](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/173)
- "Esqueci minha senha", com token de uso único guardado em hash. Fecha
  metade da dívida que a migração 0001 abriu ao trocar o Supabase Auth por
  autenticação própria; a outra metade, a confirmação de e-mail, veio
  na #227 —
  [#174](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/174)
- A busca de candidatos ficou alcançável pelo painel da empresa: existia
  desde a #83 e só tinha um botão pequeno no cabeçalho —
  [#175](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/175)
- Sem carência: virar prestador não dá mais 30 dias de vitrine de graça
  sem cartão. O cartão é autorizado logo depois do cadastro, com 15 dias
  de teste grátis antes da primeira cobrança de verdade —
  [#170](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/170)
- O prestador ganhou área própria de contratação em `/contratar`, com a
  mesma implementação de `/empresa` e rotas separadas. O painel deixou de
  oferecer "Cadastrar empresa" a quem já tem conta — era o caminho para
  uma segunda conta, com o saldo de vagas preso na primeira —
  [#189](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/189)
- A aba de contratação passou a ser a do papel de quem entrou: "Empresa"
  para empresa, "Contratar" para prestador, nunca as duas —
  [#190](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/190)
- O perfil do prestador perdeu "Minha Empresa" e "Minhas candidaturas".
  A capacidade de ver o próprio histórico fica: o que sai é o atalho, não
  o acesso —
  [#191](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/191)
- O caixa do painel passou a sair de `pagamentos`: o que entrou, o que
  foi devolvido e o que foi contestado no cartão, com as duas saídas
  separadas. Antes era projeção sobre `perfis_empresa.plano`, coluna sem
  produtor — o número era sempre zero e se anunciava como receita —
  [#179](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/179)
- Gerador de currículo pago: compra única de R$ 14,90 que libera, para
  sempre, gerar e baixar o currículo em PDF a partir do perfil. O PDF não
  fica em Storage nenhum — é remontado a cada download, então editar o
  perfil depois da compra não custa de novo —
  [#47](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/47)
- Seleção de plano como último passo do cadastro de prestador e de
  empresa: o plano pago aparece em destaque ao lado do trial, em vez de
  quem assina precisar achar o caminho sozinho depois. Reaproveita
  `assinar()`/`comprar()` e os mesmos botões de `/perfil/assinatura` e
  `/empresa/creditos` — nenhuma regra de cobrança nova —
  [#184](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/184)
- Cobrança via Mercado Pago, provada de ponta a ponta em produção: vaga
  avulsa, pacotes de 5 e 10, plano mensal da empresa e mensalidade do
  prestador. A primeira venda de verdade entrou em 10/09/2026 (R$ 29,90)
  e foi conciliada em 11/09 — cobrança criada, paga, notificada por
  webhook e creditada na carteira, pelo mesmo caminho que qualquer
  compra percorre —
  [#46](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/46)
- Produção não sobe sem o que produção precisa: `instrumentation.ts`
  confere a configuração obrigatória antes de atender qualquer
  requisição e derruba com a lista do que falta. Nasceu do 401 que
  engoliu a primeira venda — falha fechada estava certa, silenciosa é
  que não —
  [#196](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/196)
- Varredura que resgata cobrança presa: uma vez por dia, o que ficou
  `pendente` além da carência é relido no Mercado Pago e reconciliado.
  A aprovada tem precedência entre as tentativas, e o que ainda pode
  virar dinheiro não é tocado —
  [#198](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/198)
- Teto de volume em toda escrita, não só em autenticação: cada server
  action tem orçamento declarado por nome, cobrado dentro de `criarAcao`,
  e contado por sessão — nunca por IP, que puniria a lan house inteira —
  [#202](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/202)
- Teto de linhas em toda listagem: nenhuma consulta traz tabela inteira,
  os números moram num arquivo só com o porquê de cada um, e onde o
  recorte pode esconder resultado a tela avisa —
  [#203](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/203)
- Cache nas leituras de listagem, com a chave sem nada de sessão: a
  consulta é guardada por 60s, a ordenação por proximidade continua por
  requisição, e quem publica derruba a tag na hora —
  [#206](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/206)

## Pendente

A cobrança saiu daqui em 11/09/2026, provada em produção, e com ela as
duas redes de proteção que o episódio da primeira venda expôs.

**Tudo o que sobrou vai junto com o empacotamento em APK** — decisão do
Luiz em 01/09/2026, que reúne numa etapa só o que antes estava
espalhado.

Antes do lançamento, fora disso:

- [ ] Termos de Uso, Política de Privacidade e página de suporte —
      [#235](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/235)

      O texto está pronto no PR #236. Espera o CNPJ da PALU, a empresa por
      trás da Lupa, para ter quem assina como controladora dos dados. É o
      item mais sério da lista: o cadastro já diz "ao criar a conta você
      concorda com os termos de uso", e a página ainda não existe.

      **O SQL do #236 já está em produção**, antes do merge: a tabela
      `mensagens_suporte` existe lá e não existe no `schema.sql` da `main`
      (achado B10 da auditoria, #334). Está fechada — RLS ligada, sem
      acesso para a chave anônima —, e o `aplica-suporte.sql` do PR usa
      `if not exists`, então rodá-lo de novo no merge não quebra nada.

## Depende de decisão, não de código

| O que | Quem decide | Por que está parado |
|---|---|---|
| Verificação por SMS e CPF (#120) | Luiz | Depende de provedor pago |
| Plano Pro da Vercel | Luiz | O Hobby não permite uso comercial, e a Lupa cobra. O Luiz já concluiu que é o passo certo; falta assinar. O Pro também destrava o 2FA da #229, porque permite convidar o Paulinho como membro |
| Backup do banco (plano pago do Supabase) | Luiz | Nada pago por enquanto, decisão de 23/09. O gratuito não tem backup automático |
| Proxy e WAF do Cloudflare | Luiz | O domínio está no Cloudflare em DNS only desde a #287: a regra gratuita do WAF bloqueava envio de foto. Religar só com abuso medido, e com a exceção da regra feita antes. **E conferir antes a origem que chega ao app** (#334): o limite de cadastro e de "esqueci minha senha" lê o primeiro item do `x-forwarded-for`, e com o proxy ligado ele pode passar a ser um IP do Cloudflare, o mesmo para muita gente — todo mundo dividiria o mesmo limite de 5 tentativas. Se for o caso, ler o `CF-Connecting-IP` |
| Busca vetorial | Luiz | Só com o dado do #66 na mão |
| Rodar `aplica-remove-dados-de-exemplo.sql` em produção (#302) | Luiz e Paulinho | Reverte a #245, que manteve os exemplos no ar para demonstrar a clientes. O script está pronto e testado; falta os dois concordarem e alguém rodar no SQL Editor |

## Depende de uma ação manual

Trabalho que não é código: alguém precisa fazer com a mão, em produção.

- [ ] Ligar o 2FA na conta da Vercel —
      [#229](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/229)

      **Segurado em 14/09/2026**, e com motivo: o Paulinho usa a mesma
      conta, e o plano Hobby não tem convite de membro — ligar hoje
      barraria o acesso dele. A Issue traz o caminho que destrava sem
      custo (semente TOTP compartilhada, que os dois escaneiam).

      Continua sendo o maior risco aberto: aquela conta guarda o token do
      Mercado Pago, a chave de serviço do Supabase e o `SESSION_SECRET`.

## Fora do escopo por decisão, não por esquecimento

Testes e triagem automática, múltiplos usuários por empresa, chat interno
e proteção por captcha. O porquê de cada um está no AGENTS.md.

Sincronizar os componentes com o Claude Design —
[#75](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/75), fechada em
01/09/2026 sem fazer. O `.gitignore` continua ignorando `.ds-sync/`,
`.design-sync/`, `dist/` e `ds-bundle/`, que é o rastro da ferramenta ter
rodado uma vez.

Busca de candidatos saiu desta lista em 31/08/2026: `/candidatos` existe,
e o que a sustenta é o consentimento do candidato, não o afrouxamento da
razão que a mantinha fora.
