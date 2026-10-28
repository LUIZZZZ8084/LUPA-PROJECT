# Quem vê o quê, e onde: navegação, lugar e avisos

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## Navegação pública, revertida — e parcialmente revertida de novo

O V0 nasceu com vagas e prestadores abertos a qualquer visitante. A razão
era boa: buscador indexando "vaga de operador em Sinop" traz gente que
nunca ouviu falar da Lupa, de graça e sem esforço de divulgação.

Em 21/08/2026 isso foi revertido a pedido do Luiz. O raciocínio: só quem
tem perfil se candidata, vê dado de empresa ou entra em contato — e é o
cadastro que vira lead. Vitrine aberta gera visita; visita não é lead. O
preço, aceito de olhos abertos: o app saiu da busca do Google, e ninguém
mais chegava sozinho — todo mundo entrava por link recebido.

**Em 15/09/2026 a home saiu de novo do muro (#241), e o resto continua
fechado.** O preço de 21/08 tinha um custo que só ficou visível depois de
o app estar no ar: quem recebia o link caía direto num formulário de
cadastro, sem ver uma vaga, um prestador ou uma linha sequer do que a Lupa
é. A barreira de conversão da primeira tela custava mais do que o
fechamento total rendia — e o app inteiro atrás de login também não existe
para o Google, que é exatamente o "chegar sozinho" que a decisão de 21/08
tinha desistido de ter.

**O que mudou é só `/`.** `/vagas`, `/servicos`, `/perfil`, `/empresa`,
candidatar-se, ver contato — continuam exigindo login, e isso é automático
pelo `proxy.ts`: só a home saiu de `AREAS_FECHADAS`/entrou em `ABERTAS`, o
resto da navegação cai na regra padrão de sempre. O raciocínio de 21/08
sobre *funcionalidade* continua valendo integralmente; o que se reconsiderou
foi só a *vitrine*.

**A home pública não podia vazar o que o resto do app protege**, e quase
vazou: o card de prestador ali mostra um botão de WhatsApp que, autenticado,
carrega o telefone de verdade no HTML. `ProviderCard` ganhou a prop
`autenticado` — falsa só nesta home, sem sessão —, e nesse caso o telefone
não é lido em JSX nenhum, então não sai no HTML; o que aparece no lugar do
botão é um convite para entrar. O componente é de servidor, então "não
renderizar" aqui é "nunca existir na resposta", não CSS escondendo algo que
o inspetor do navegador ainda revelaria.

**Atualização (#372).** A home deixou de renderizar o `ProviderCard`: mostra
`ProfissionaisEmLinha`, que não lê telefone nem monta `wa.me`, e o teste do
muro de login continua cobrando que o HTML da home não tenha `wa.me`. A prop
`autenticado` ficou, de propósito: o padrão é `true`, então ela é o único
caminho seguro para quem puser o card numa página pública. Tirá-la deixaria
só o caminho que vaza o telefone.

O que sobreviveu das duas decisões: o modo demonstração. Ele responde por
*de onde vêm os dados*, não por *quem pode entrar*, e continua sendo o que
permite mostrar o produto sem infraestrutura.

**SEO básico entrou junto**, porque uma home pública sem `robots.txt`,
`sitemap.xml` e dado estruturado ainda não existe para o Google — só existe
para quem já tem o link. `src/app/robots.ts` e `src/app/sitemap.ts` seguem
o mesmo padrão de rota gerada que `manifest.ts`, `icon.tsx` e `apple-icon.tsx`
já usavam, e precisaram da mesma exceção no matcher do proxy que o manifesto
já tinha exigido: um crawler não tem sessão, e sem a exceção o muro
responderia com um redirecionamento para `/entrar` que nenhum crawler segue
para descobrir a política — a mesma armadilha do item esquecido no matcher,
registrada mais abaixo neste arquivo.

**E a vaga individual abriu em 26/10/2026 (#490) — a terceira mudança desta
decisão.** As duas anteriores abriram ou fecharam a *vitrine*; esta abre uma
*página*, e o motivo é de canal: as vagas da cidade circulam em perfis de
Instagram e grupos de WhatsApp, e é por eles que a empresa já tem alcance. O
link da vaga mandava quem clicava para uma tela de entrar — e o robô que monta
a prévia do link, que não tem sessão, junto —, então a Lupa não era o destino
do que a empresa postava.

**O recorte é `/vagas/<id>` e a miniatura dela, e nada em volta** (`VAGA_PUBLICA`
em `src/proxy.ts`, com âncora nas duas pontas). A lista `/vagas`, os perfis, o
contato e a candidatura continuam fechados; `/vagas/<id>/qualquer-coisa`
também. Sem sessão a página mostra cargo, empresa, local, salário, endereço e
descrição — **e nenhum contato**: nem telefone, nem e-mail, nem WhatsApp, nem
as **redes da empresa**, que a página já mostrava a quem tem conta e que
passaram a depender de sessão. Não é desconfiança de quem lê: é o argumento de
21/08 aplicado ao que sobrou — contato é o que faz o cadastro virar lead. O
botão "Candidatar-se" vira "Entrar para se candidatar" e "Criar conta grátis",
os dois com `destino` de volta à vaga (o cadastro também passou a carregá-lo; o
valor é validado por `destinoSeguro` antes de virar o botão "Voltar para a
vaga"). Vaga encerrada ou vencida abre dizendo que não recebe candidaturas, com
o caminho das vagas da cidade, e sai do índice dos buscadores (`robots`).

**A prévia do link tem miniatura própria** (`opengraph-image.tsx` ao lado da
página, 1200 × 630, com cargo, empresa, cidade e salário) e a rota dela entra
na lista de abertas pelo mesmo motivo do `opengraph-image` da home (#259): quem
a busca é o servidor da rede social. **O `robots.txt` deixou de bloquear
`/vagas` por prefixo**: o rastreador do Facebook e do Instagram obedece a ele,
e a vaga compartilhada sairia sem miniatura. Fecha-se só a lista (`/vagas$` e
`/vagas?`, extensões do Google e do Bing). Não entrou no `sitemap.xml`: a Issue
é de compartilhar, e indexar a vaga pelo Google é outra decisão, com o custo de
uma consulta por rastreio.

**A visita do robô de prévia não conta como visualização** (`ehRastreador`, em
`src/lib/rastreador.ts`): colar o link numa conversa manda um servidor buscar a
página, e contar isso faria o número da empresa subir quando ela divulga. O
`User-Agent` é declaratório, então robô que finge ser navegador passa — erro
para o lado de contar a mais, o mesmo que a recarga já provoca.

**A empresa dona divulga:** WhatsApp (o `wa.me/?text=` abre o aplicativo com a
mensagem pronta, e a pessoa edita na própria conversa — um campo a mais seria
atrito), copiar link e **baixar a arte de story** (1080 × 1920). O painel de
divulgação aparece na página da vaga para o dono e logo depois de publicar, que
é quando ela mais quer espalhar. A arte é uma rota de dono
(`/api/vagas/[id]/arte`): o que está na imagem é público, mas uma imagem de
1080 × 1920 renderizada a cada chamada não se oferece a anônimo, e vaga de
outra empresa responde 404 igual a "não existe". Tem teto por pessoa
(`ORCAMENTO_DA_ARTE_DA_VAGA`), pela mesma razão do currículo em PDF — é um
`GET`, e o teto de `criarAcao` não alcança. A imagem não leva emoji (o
renderizador o busca numa CDN a cada imagem) nem contato, e o download é um `<a>`
comum: o `Link` do Next pré-busca o destino, e este endpoint renderiza uma
imagem a cada chamada. Os Termos e a Política de Privacidade dizem que a vaga é
visível sem conta (a lição da #235: texto legal sai do que o produto faz).

## A vitrine de produção mostra só quem existe (#302)

As contas de exemplo do `seed.sql` — 9 prestadores, 3 empresas e as vagas
de Sinop — estavam no banco de produção e apareciam para visitante real
como ofertas de verdade. Com a home pública desde a #241, eram a primeira
coisa que alguém via.

**Isto reverte a #245.** Em 22/09/2026 a decisão foi o contrário: manter
esse conteúdo no ar com vitrine até 2099 (`aplica-demo-vitalicia.sql`),
porque era o que se usava para demonstrar a Lupa a clientes em Sinop. Em
01/10/2026 o pedido do Paulinho foi tirar: anúncio que não existe, numa
plataforma de emprego, é exatamente o que o produto promete não ter.

**Demonstrar continua possível, só que no lugar certo.** O modo
demonstração — o app sem Supabase, lendo `src/lib/mock-data.ts` — não
muda nada e não toca banco. O que muda é o banco de produção, por
`supabase/aplica-remove-dados-de-exemplo.sql`, que precisa ser rodado à
mão no SQL Editor.

**O script apaga por id, nunca por "o que está visível".** O seed usa ids
fixos, e só eles saem; o resto vai junto pelas chaves estrangeiras com
`on delete cascade`. Conta de gente de verdade — inclusive as que o
`aplica-demo-vitalicia.sql` pôs na vitrine para sempre — não é tocada: o
que fazer com elas é decisão de quem é dono delas, não de um script
versionado. Há teste em `schema.test.ts` rodando seed, conta real e
limpeza num Postgres de verdade.

**E a tela passou a dizer quando está vazia.** Sem os exemplos, a home e
as buscas podem ficar sem nada nos primeiros dias. Seção só com o título
parece tela quebrada; "Nenhuma vaga com esses filtros" sem filtro nenhum
manda a pessoa mexer no que não existe. As duas situações agora têm frase
própria.

## O Brasil inteiro, e não mais só Mato Grosso (#301)

O app começou aceitando só Sinop, abriu para os 142 municípios de Mato
Grosso, e desde 01/10/2026 aceita **os 5.571 municípios do país** — pedido
do Paulinho: o app deixa de se apresentar como de um estado só. Recusar
quem é de outro lugar era um formulário dizendo que o app não é dele, e
foi esse o argumento que já tinha aberto MT inteiro.

**Não existe mais cidade inicial.** `CIDADE_INICIAL` (Sinop), `ESTADO` e
`ESTADO_NOME` saíram de `src/lib/constants.ts`. O cadastro vinha com Sinop
escolhida, e quem não mexia no campo virava morador de Sinop sem saber —
com o país inteiro aberto, esse palpite erra para quase todo mundo. A
coluna também perdeu o `default 'Sinop'`: padrão de cidade é a cidade de
quem não escolheu nenhuma.

**A cidade é gravada com o estado: `"Sinop - MT"`.** 232 nomes de
município se repetem entre estados — "Bom Jesus" existe em cinco —, e o
nome sozinho deixou de identificar a cidade. O formato é o mesmo que a
tela já mostrava (`rotuloDaCidade` montava "Sinop - MT"), então o valor
gravado passou a ser o próprio rótulo, e o passo de "formatar a cidade"
que alguém esqueceria numa tela nova deixou de existir. Os ajudantes
(`cidadeComUf`, `ufDaCidade`, `nomeDaCidade`) moram em
`src/lib/cidades/index.ts`. O dado antigo é convertido por
`supabase/aplica-cidades-do-brasil.sql` — que precisa rodar **antes** do
deploy, porque depois dele "Sinop" sem estado é recusado.

**A lista vem do IBGE, por script, em três formas.** Mais de 5.500 nomes
com acento e com "do/da/de" no meio, digitados à mão, dão um "Vila Bela da
Santíssima Trindade" errado que ninguém revisa. `scripts/gerar-cidades.mjs`
grava:

- `src/lib/cidades/dados/<UF>.ts` — um arquivo por estado;
- `src/lib/cidades/indice.ts` — a lista de estados e um `import()` por
  estado, escrito um a um para qualquer bundler separar cada estado no
  próprio pedaço;
- `src/lib/cidades/todas.ts` — tudo junto, com `server-only`, para a
  validação.

O formulário escolhe **estado e depois cidade**, e o celular baixa só as
cidades do estado escolhido: 5.571 nomes numa lista só seriam impossíveis
de percorrer e caros de baixar em 3G. O `server-only` é a trava do outro
lado: se um componente de cliente importar a lista inteira, o build quebra
em vez de mandá-la ao celular. Em execução o app não fala com o IBGE,
porque cadastro não pode depender de API de terceiro estar no ar.

**O filtro de busca segue a mesma ideia.** `/vagas` e `/servicos` têm
filtro de estado, e o de cidade só aparece com o estado escolhido —
`filtrosDeLugar`, em `src/lib/busca.ts`. Sem isso a página levaria 5.571
opções dentro do HTML a cada abertura. Trocar o estado solta a cidade
(`limpa`, no `FilterBar`): "Sinop - MT" com SP escolhido é um filtro que
nunca casa, e a tela diria "nenhuma vaga" sem dizer por quê.

**Bairro de pessoa não existe (#321).** Decisão do Luiz em 01/10/2026: o cadastro e o perfil pedem só a cidade. O
bairro tinha sido tirado em pedaços — o enum dos 14 bairros de Sinop caiu
com a abertura para o estado, a lista de "bairros atendidos" na #119 — e
sobreviveu em outro canto: o campo no cadastro e na edição, o degrau
"mesmo bairro" da escada de proximidade, o selo "Perto de você" nos
cards. Não existe lista de bairros do país, então o campo só funcionava
bem em Sinop; e nenhuma tela filtra por ele (#285). Pedir um dado que não
decide nada é custo de formulário sem retorno.

**O que sobrou é o bairro da vaga:** texto livre, opcional, escrito por
quem publica e mostrado no card e no detalhe, para quem decide se vai até
lá. Não entra em filtro nem em ordem — o mesmo estatuto do endereço.

**O banco não mudou, de propósito.** `usuarios.bairro` e
`perfis_prestador.bairros_atendidos` continuam lá, comentadas como legado
no schema, e a aplicação não lê nem grava. Apagar dado de produção é
decisão do Luiz, e a coluna é inofensiva — `usuarios` é fechada para
`anon`. O preço aceito: `provider_listings`, lida pela chave anônima,
ainda devolve o bairro das contas antigas, que a Lupa não mostra mais. A
limpeza (`update ... set bairro = null`) fica para quando ele decidir. A
view `metricas_por_local` segue agrupando por cidade e bairro, e o painel
soma por cidade (`somarPorCidade`).

**A trava é um teste que lê o código-fonte** —
`tests/unit/sem-bairro-de-pessoa.test.ts`: só os arquivos que falam da
vaga podem mencionar bairro, e os nomes que o carregavam
(`bairrosAtendidos`, `MESMO_BAIRRO`, `BAIRROS_POR_CIDADE`…) não existem em
lugar nenhum. *Remover um campo em etapas deixa sempre um resto que o
próximo pedido encontra; o teste cobra o resto, não só a etapa.*

**A cidade da vaga é da vaga, não da empresa.** Transportadora de Sinop
contrata motorista em Sorriso; herdar a cidade da empresa esconderia a
vaga de quem ela interessa. O formulário já vem com a cidade da empresa
preenchida, e ela pode trocar.

**A cidade não se edita no perfil.** Mudar de cidade muda quem encontra a
pessoa e onde os anúncios dela aparecem — é troca de contexto inteiro, não
correção de campo. Por ora é caso de suporte, como o CNPJ.

## Perto se mede por região do IBGE, não por quilômetro

A busca cobre o Brasil inteiro. Ordenar só por data faz a primeira coisa
que alguém de Sinop vê ser uma vaga em Porto Alegre — o oposto do que
"perto de você" promete. Por isso a listagem ordena pelo mais perto de
quem está olhando, numa escada de cinco degraus (`src/lib/proximidade.ts`):
mesma cidade, mesma região imediata, mesma região intermediária,
**mesmo estado**, resto do país. Já houve um sexto, "mesmo bairro", e
saiu na #321 com o bairro de pessoa.

**O degrau do estado entrou com a #301** e não precisa de mapa: o estado
está no próprio valor gravado ("Sinop - MT"). É o que separa "longe, mas
no mesmo estado" de "outro canto do país". As regiões vão pelo **id** do
IBGE, não pelo nome, porque nome de região também se repete entre estados.
O mapa (`src/lib/regioes.ts`, 5.571 entradas) é `server-only`: a busca
ordena antes de a página sair, e mandá-lo ao celular seria centenas de kB
para nada.

**Por que região e não distância.** A região imediata do IBGE agrupa
municípios pelo deslocamento real das pessoas para bens e serviços — é a
pergunta certa aqui: até onde alguém daqui viaja para trabalhar. Linha reta
seria pior e ainda exigiria outra fonte de dados, porque quem decide o
tempo de viagem é a estrada: 200km de asfalto e 200km de terra não são a
mesma distância. O mapa vem do mesmo IBGE que já gera a lista de cidades,
por `scripts/gerar-regioes.mjs`, e é versionado — busca não pode depender
de API de terceiro estar no ar.

**Ordenar não é filtrar.** Nada sai da lista por estar longe, e o filtro de
cidade continua sendo a forma de restringir. É a lição da #76 aplicada de
propósito: lá um padrão posto na tela virou filtro invisível e escondeu
vaga de quem tinha acabado de publicar.

**E a ordem é dita na tela** ("mais perto de você primeiro"), pelo mesmo
motivo. Ordenação que muda o resultado sem aparecer em lugar nenhum é a
mesma armadilha, só que mais difícil de perceber.

**Para prestador, perto é a cidade dele**, como para a vaga. Havia uma
regra mais fina — "onde ele atende, não onde mora", pelos bairros
atendidos —, e saiu junto com o bairro (#321).

## O aviso de vaga guarda o que a pessoa pediu, e nada mais

Push por cidade e categoria (#48). Numa plataforma que saiu da busca do
Google, ninguém chega sozinho: uma vaga só é vista por quem resolver abrir
o app naquele dia, e vaga boa em Sinop some em dois dias. O aviso é o que
devolve a pessoa ao app sem ela ter de lembrar.

**É Web Push, com chaves VAPID — de graça.** Ao contrário do SMS da #120,
não depende de provedor pago. `scripts/gerar-vapid.mjs` gera o par e
imprime uma vez, como o `criar-admin.mjs`: a privada é credencial e nunca
leva prefixo `NEXT_PUBLIC_`. Sem as chaves o recurso não existe e a tela
diz isso — mesma degradação do Storage sem Supabase.

**Guardar preferência é o oposto do que a tabela de buscas decidiu, e é
deliberado.** `buscas_sem_resultado` não liga termo a pessoa porque, em
Sinop, saber que alguém pesquisou "vaga de motorista" três vezes diz que
ela quer sair do emprego atual. A preferência de aviso é essa mesma
informação — com a diferença de que a pessoa **pediu**, e ela é o mínimo
necessário para cumprir o pedido.

O que se recusa guardar junto é o **histórico de envio**. "Avisamos fulano
sobre estas doze vagas" reconstruiria exatamente o que a outra tabela
evita. Nenhuma das duas tabelas tem grant para `anon` nem para
`authenticated`, e o teste de schema varre as duas.

**Desligar apaga tudo** — preferência e aparelhos. Meia desativação, que
para de avisar e guarda o que a pessoa procurava, seria manter justamente
o dado que este bloco existe para limitar.

**A permissão do navegador só se pede uma vez.** Negada, não há como
perguntar de novo — nem no mesmo aparelho, nem depois de a pessoa mudar de
ideia. Por isso o pedido vem *depois* de ela escolher cidade e área e
apertar o botão, quando já sabe o que está aceitando; e por isso a
preferência é gravada **antes** do pedido, para que negar não custe a
escolha. Pedir ao abrir a tela queimaria a única chance com quem ainda não
entendeu a oferta.

**A porta de entrada é o sininho do cabeçalho (#288).** Os avisos
nasceram no fim de "Editar perfil", depois de nome, telefone, anúncio e
CNPJ — e ninguém abre "Editar perfil" para pedir aviso de vaga. Enquanto
não havia chave VAPID em produção, o esconderijo não custava nada; no dia
em que as chaves entraram (24/09/2026), passou a custar o recurso inteiro.
Hoje moram em `/avisos`, a um toque de qualquer tela, e saíram do perfil:
dois lugares para a mesma escolha divergiriam na primeira mudança.

**O sininho aparece para quem pode se candidatar**, e só. Aviso de vaga
nova para quem não pode se candidatar levaria a uma vaga sem botão — a
armadilha do "botão que só recusa depois do clique". A rota continua
aberta a qualquer conta com sessão, como o serviço já permitia: quem
decide mostrar o atalho é o cabeçalho, não o portão, e quem chega por
link não cai num 404.

**O título da vaga não aceita link (#447).** Ele é o texto da notificação,
para até 500 pessoas, e a notificação aparece como sendo da Lupa: um link
ali é texto de um estranho com o nome dela. Publicar exige crédito pago e
documento, e a denúncia tira a vaga do ar — mas a notificação já saiu
quando alguém denuncia. Cargo nunca precisa de link; o lugar dele é a
descrição.

**Ninguém é avisado da própria vaga.** Parece óbvio e não é: quem publica
está na mesma cidade e quase sempre na mesma categoria, então sem essa
linha a primeira notificação que a pessoa recebe é a dela mesma — e a
conclusão dela é que o aviso está quebrado.

**Vaga sem categoria alcança só quem pediu a cidade inteira.** O campo é
opcional em `vagas`, e nesse caso não há como saber se ela interessa a quem
escolheu "Agronegócio". Avisar mesmo assim ensinaria a ignorar o balão — e
aviso ignorado não entrega nem a vaga certa.

**Aparelho que responde 404 ou 410 sai da tabela.** É a única forma de
saber que alguém desinstalou ou trocou de telefone; o navegador não avisa
ninguém. Qualquer outra falha não apaga nada: sumir com a inscrição de quem
estava sem sinal é pior que deixar de avisar uma vez.

**O endereço da inscrição só vale se for de um serviço de push (#356).**
Ele vem do navegador de quem se inscreveu, e a cada vaga publicada o
servidor faz uma requisição HTTPS para ele. Validar só que era uma URL
deixava a pessoa escolher o destino. Hoje `endpointDePushPermitido`
aceita FCM, Mozilla, Apple e WNS, só em `https`, sem usuário, senha ou
porta — na inscrição e de novo no envio, porque linha gravada antes da
regra não passou pela primeira. O que falha na segunda sai da tabela pelo
mesmo caminho do 404/410, e o envio tem prazo de 10 s. O preço da lista
fechada: um navegador com serviço fora dela não liga o aviso. *Lista de
quem pode, e não de quem não pode: a segunda sempre deixa passar a
próxima forma.*

**Bairro ficou fora**, decisão de 26/08/2026: não existe catálogo de bairro
para os municípios do país. Notificar por bairro funcionaria bem numa cidade
e mal em todas as outras — e desde a #321 a Lupa nem guarda o bairro de uma
pessoa.

**O envio sai por `after()`**, depois da resposta — quem publicou quer a
vaga no ar, e o aviso é consequência. Mesma disciplina do registro de
visualização.

**O service worker não faz cache**, e isso é escolha. O app é todo atrás de
login: cache mal desenhado aqui mostra a vaga de ontem como se fosse a de
hoje, ou o conteúdo da sessão de outra pessoa no mesmo aparelho. Ele existe
para receber push e para ser o requisito de instalação no iPhone, que é do
que o APK/TWA depende.

## O convite para instalar, e o que cada aparelho deixa (#475)

Pedido do Luiz em 20/10/2026: um botão para instalar na hora, no iPhone e
no Android, só para quem está no navegador do celular. O iPhone nunca
mostrou botão de instalar — o Safari não tem um para site nenhum —, e quem
não conhece o caminho do Compartilhar não instala.

**O botão diz a verdade sobre o que o toque faz.** No Android que já
entregou o pedido de instalação (`beforeinstallprompt`), o toque abre a
janela do navegador. A Apple não dá a site nenhum um jeito de instalar, e
no iPhone o toque troca a frase da faixa por uma dica: o desenho do botão
Compartilhar e "Adicionar à Tela de Início". Dentro do Instagram e do
Facebook nada instala, e a dica é abrir no navegador. No Android antes de
o pedido chegar — o Chrome só o entrega depois de a pessoa interagir com a
página —, a dica é o menu ⋮.

**A dica cabe na faixa, e a faixa não cresce (#477).** A primeira versão
abria embaixo dela uma caixa com três passos e uma nota, e no iPhone isso
ocupava quase metade da tela. O Luiz achou que poluía e pediu só o botão.
Só o botão não basta onde ele não instala, então ficou o mínimo, no lugar
da frase: um desenho e o nome da opção. O caso raro — o iPhone que esconde
o Compartilhar atrás do ⋯, a opção que não aparece dentro de um app — saiu
junto: explicá-lo custava a tela de todo mundo.

**O aparelho sai do que o navegador diz de si** (`aparelhoDoNavegador`, em
`src/lib/instalacao.ts`), e não da largura da tela: o pedido era "no
celular sim, no PC não", e janela estreita no PC não é celular. O iPad, que
se apresenta como Mac, é separado pela tela de toque.

**O pedido é guardado por um script no `<head>`**, assinado com o nonce da
CSP, porque o Chrome o entrega uma vez por carregamento e pode entregá-lo
antes de o React montar a página. O e2e do Android só passa se esse script
rodou: sem o nonce, ele morreria em silêncio e o botão nunca instalaria
direto.

**Não aparece dentro do app instalado**, nem quando o Android diz que o app
já está no aparelho (`related_applications` no manifesto, lido por
`getInstalledRelatedApps`). O iPhone não diz; ali, quem já instalou e voltou
pelo Safari fecha com "Agora não".

**"Agora não" vale para a visita, e só para ela.** Trocar de tela não traz
o convite de volta; abrir a Lupa de novo, sim. Nasceu escondendo por 30
dias, gravado no aparelho, e o Luiz achou tempo demais no mesmo dia
(20/10/2026): quem tocou "Agora não" não disse "nunca". Por isso a
dispensa mora no módulo do componente, e não no `localStorage`.

**O preço, aceito:** o `preventDefault` no pedido tira a barrinha do próprio
Chrome, para a mesma oferta não aparecer duas vezes. Quem tocou "Agora não"
continua tendo o "Instalar app" no menu do Chrome.

**O projeto `mobile` do e2e vê a faixa em toda tela**, porque o Pixel 7 se
apresenta como Android. A varredura de contraste das rotas a mede sem a dica;
a dica, nos dois temas, fica em `instalar-app.spec.ts`.

## Busca sem resultado é vocabulário, não histórico de pessoa

`buscas_sem_resultado` guarda termo, dia, tela e contagem — quatro colunas,
nenhuma ligando o termo a alguém. Existe para responder uma pergunta que
hoje seria palpite: basta ampliar a tabela de sinônimos em
`src/lib/skills.ts`, ou o vocabulário é variado demais e a busca precisa
virar semântica?

Cauda curta e repetitiva pede sinônimo — barato, previsível, sem chamada de
rede. Cauda longa e variada é o que justificaria busca vetorial, que custa
dinheiro por consulta e põe dependência externa no caminho de uma tela que
abre em 3G.

**Não se guarda quem buscou.** Histórico de busca de quem procura emprego é
a mesma classe de informação que o currículo: numa cidade do tamanho de
Sinop, saber que alguém pesquisou "vaga de motorista" três vezes esta
semana diz que essa pessoa quer sair do emprego atual. O teste de schema
lista as colunas e recusa qualquer uma que identifique.

O termo é gravado normalizado, porque o que interessa é agrupar — e o
registro sai por `after()`: quem buscou quer ver a tela, mesmo que ela diga
"nada encontrado".

## Visualização de vaga é contagem, não histórico

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
