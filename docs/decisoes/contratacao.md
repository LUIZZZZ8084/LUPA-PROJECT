# Contratar: a área de empresa, as vagas e as candidaturas

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## A aba Empresa deixou de ser só de PJ

Ela era fechada no proxy por `vaga:ver_candidaturas_proprias`, que só a
empresa tinha — e a barra inferior mostrava o item para toda conta com
sessão. Tocar nele como candidato dava 404: link que aparece e devolve
erro, a armadilha que este documento já registra duas vezes.

Decisão do Luiz em 03/09/2026: **prestador passa a alcançar o painel**,
porque quem contrata não é só pessoa jurídica — produtor rural e autônomo
contratam ajudante. E **candidato recebe a explicação**, não o 404.

`/empresa` saiu de `AREAS_FECHADAS` e quem decide passou a ser a página.
Isso é diferente de `/admin`, que continua no proxy: lá, confirmar que a
rota existe já é informação para quem sonda. Aqui não há segredo — que
exista um painel de quem contrata é evidente pela própria navegação.

**E o prestador passou a publicar vaga (#129).** Este parágrafo dizia que
publicar continuava fechado, porque `perfis_empresa.cnpj` era `not null` e
"vaga de pessoa física precisa de outro selo antes de existir". As duas
coisas mudaram: a coluna virou opcional junto com a #138, e o selo passou a
existir — desde a #133, CPF válido e único é a verificação do prestador.

**O selo que faltava já estava lá, e ninguém tinha percebido.** A Issue
pedia uma migração que já tinha entrado de carona noutra. Vale como aviso:
Issue que descreve trabalho de banco envelhece rápido, e o schema é a fonte
da verdade — confira a coluna antes de escrever a migração.

**São quatro capacidades, não uma.** `vaga:publicar` sozinha deixaria a
pessoa recebendo currículo sem poder mover a candidatura — a mesma tela sem
saída que a #122 tinha criado ao abrir só a leitura do painel.

**O perfil de contratante nasce na primeira vaga.** `job_listings` faz
*inner join* com `perfis_empresa`: sem essa linha a vaga é gravada e some
da busca, e a pessoa vê "publicada", não se acha em `/vagas` e conclui que
o app engoliu o anúncio dela. A razão social é o nome da pessoa e o CNPJ
fica nulo — o formato do produtor rural da #139. Criar ali, e não numa tela
à parte, é decisão de atrito: uma tela a mais não perguntaria nada que a
sessão já não responda.

A criação é feita **só para `prestador_servico`**. A conta de empresa ganha
o perfil no cadastro, e consultar o banco para os dois papéis seria uma
consulta a mais em toda publicação para responder o que já se sabe.

**A vaga diz se quem contrata é pessoa ou empresa**, e a view carrega o
booleano derivado de `cnpj is null` — nunca o documento. `job_listings` é
lida pela chave anônima; o CPF de quem contrata como pessoa física fica em
`usuarios` e não sai de lá. Quem procura emprego tem direito de saber com
quem está tratando: muda o que dá para conferir antes de ir a uma
entrevista. Não é aviso de risco — produtor rural e autônomo contratam de
verdade —, é a informação que faltava.

## Duas portas para contratar, uma implementação só (#189)

Empresa e prestador contratam **do mesmo jeito** desde a #129: as quatro
capacidades de vaga estão nos dois papéis, e a carteira é por
`usuario_id`, não por empresa. O que não funcionava era o prestador ser
jogado dentro de `/empresa`, uma área escrita inteira para quem tem CNPJ.

**E não era só vocabulário.** `garantirPerfilDeContratante` só cria o
`perfis_empresa` do prestador **na primeira vaga publicada**. O painel
roda antes disso, `getCompany()` volta vazio, e a tela oferecia
"Cadastrar empresa" apontando para `/cadastro?tipo=empresa` — o formulário
de **conta nova**. Como comprar vaga já funcionava para ele, o caminho
provável era o pior: compra dez vagas, vai publicar, e o app manda criar
outra conta. O saldo fica preso na primeira, e ele paga duas vezes.

Decisão do Luiz em 10/09/2026: o prestador ganha `/contratar`, com a
mesma estrutura.

**A busca de candidatos (`/candidatos`) não é do prestador** (#251). Este
parágrafo dizia que ela era "a mesma para os dois — já era, e não muda", e
estava errado nas duas metades: `candidato:buscar_disponiveis` nunca foi do
`prestador_servico`, e o painel compartilhado mostrava a ele dois links
que davam 404. Achado na varredura de lançamento de 22/09/2026.

O conserto foi esconder os links, e não dar a capacidade, por uma razão
de consentimento: quem liga a opção lê "Quero que **empresas** me
encontrem". O prestador contrata como pessoa física, e abrir a busca a ele
ampliaria, sem aviso, quem vê o contato de gente que pediu discrição. Se um
dia a busca for dele, **o texto da caixa muda antes** — quem já marcou,
marcou sob a redação antiga. Os links são decididos por `pode()`, então
voltam sozinhos no dia em que a matriz mudar.

**Duas rotas, uma implementação.** Os corpos das telas moram em
`src/app/(app)/_contratacao/` e recebem a área por parâmetro; `/empresa/**`
e `/contratar/**` são arquivos finos que só dizem qual renderizar.
Duplicar as ~990 linhas daria o gêmeo que diverge na primeira vez que
alguém mexe num lado só — foi o que aconteceu com `perfis_empresa.plano`,
que apareceu em três telas e precisou de três correções (#172, #179,
#182). A pasta começa com `_` porque o App Router tira do roteamento tudo
que é prefixado assim.

**O `revalidatePath` revalida as duas bases**, por `BASES_DE_CONTRATACAO`.
A action não sabe de qual porta veio o clique e não precisa saber:
revalidar um caminho que a pessoa não está vendo não custa nada, e deixar
de revalidar o certo faz a tela mentir sobre o que acabou de acontecer.
Escrever `/empresa` à mão ali era o defeito silencioso que esta mudança
quase deixou passar.

**Cada porta atende o próprio papel**, com `redirect` quando erra — uma
empresa em `/contratar` leria "Contratar" no lugar do nome dela. E **o
título da página é `area.nome`, não um literal**: a primeira versão
renderizava o painel certo com o cabeçalho dizendo "Minha Empresa" na
área do prestador, e foi o e2e que pegou. *Tela compartilhada tem que ter
todo texto de identidade parametrizado, não só os links.*

**O perfil do prestador perde "Minha Empresa" e "Minhas candidaturas"**
(#191). A segunda é a que exige cuidado: a capacidade
`candidatura:ver_propria` **continua no papel**, porque tirá-la faria
`/perfil/candidaturas` responder 404 — o dano que este arquivo registra
desde a troca de papel. O que sai é o **atalho**, não o acesso, e há teste
e2e conferindo que a rota segue respondendo 200.

## O endereço da vaga, e o bairro que ficou nela

A vaga informa endereço — rua, número, ponto de referência, texto livre.
Quem depende de ônibus ou de andar precisa saber onde é **antes** de se
candidatar, não depois, no contato com a empresa.

**Ele não entra no ranking de proximidade**, que olha só cidade, região
e estado. Comparar endereço livre não é confiável o bastante para decidir
ordem: "Rua X, 123" e "Rua X 123" são a mesma rua e strings diferentes. O
bairro da vaga, que mora ao lado do endereço, tem o mesmo estatuto — texto
livre e opcional, informativo, nunca filtro nem ordem (#321).

A coluna é opcional no banco, para não quebrar vaga publicada antes do
campo existir; a tela de publicação é que exige preenchido em vaga nova.

## Modalidade da vaga: obrigatória na tela, opcional no banco (#300)

Presencial, home office ou híbrido. Com o app aberto ao Brasil inteiro,
isso deixou de ser detalhe: uma vaga home office em outra cidade interessa
a quem está longe, e uma presencial não — sem o campo, as duas pareciam
iguais no card.

**É enum no banco (`modalidade_vaga`), não texto livre**, porque o valor
gravado é o que a tela traduz (`WORK_MODE_LABELS`): "Home office",
"home-office" e "remoto" seriam três valores para a mesma coisa. A coluna
é opcional pelo mesmo motivo do endereço — vaga publicada antes dela
continua válida e só não ganha selo —, e a tela de publicação exige.

**Ela não mexe na ordenação por proximidade.** A localização da vaga
continua sendo a da vaga; quem procura trabalho remoto vê o selo no card.
Tratar home office como "perto de todo mundo" encheria a busca local de
qualquer cidade com vagas remotas do país inteiro — decisão de produto
que, se vier, vem com filtro próprio, e não escondida na ordem.

**A coluna vai por último em `job_listings`.** `create or replace view` só
aceita coluna nova no fim, e é assim que `aplica-modalidade-vaga.sql`
chega a um banco vivo sem derrubar a view. **Rode a migração antes do
deploy**: o `insert` de vaga passa a mandar `modalidade`, e sem a coluna
publicar vaga falha.

## Áreas de vaga e profissões de prestador (#457)

Pedido do Luiz em 13/10/2026: mais áreas e mais profissões. Com o app
aberto ao Brasil inteiro, a lista de dezessete profissões e a de vinte e
uma áreas deixavam de fora quem é marceneiro, soldador, babá ou tratorista,
e a vaga de atendimento ou de recursos humanos.

**As duas listas são coisas diferentes, e crescem de jeitos diferentes.**
`JOB_CATEGORIES` é só uma constante: a área gravada numa vaga ou num perfil
é o próprio texto, e adicionar item é mudar o arquivo. `SERVICE_CATEGORIES`
tem chave estrangeira — o id de cada profissão é o `categoria_id` de
`perfis_prestador` —, então cada profissão nova entra por SQL
(`aplica-mais-profissoes.sql`) com o **id fixo**, igual ao da constante, e
não o que a sequência daria. Um teste (`categorias.test.ts`) compara a
constante, o `schema.sql` e o script: divergir não quebra nada na hora, a
profissão aparece na tela e falha por chave estrangeira quando alguém a
escolhe.

**Só se acrescenta; não se renomeia nem se reordena.** O nome gravado é o
que a busca por categoria compara: trocar "Comércio e Vendas" por outra
grafia esconderia do filtro tudo que já foi publicado sob a antiga.

## Vaga para PCD, e a vaga por sexo que não existe (#456)

Pedido do Luiz em 13/10/2026: a empresa informa ao publicar se a vaga é para
pessoa com deficiência (PCD), e a busca filtra por isso. Quem tem a vaga —
inclusive para cumprir a cota da Lei 8.213/91, art. 93 — não tinha onde
dizer, e quem procura não tinha como achar.

**A resposta é obrigatória e não tem valor marcado de antemão.** Dois
rádios, "Sim, é para PCD" e "Não é para PCD", como a modalidade (#300): um
padrão marcado faria a resposta sair sem ninguém ter respondido, e o filtro
passaria a prometer o que ninguém conferiu. Chega do formulário como `"sim"`
ou `"nao"`, porque checkbox desmarcado é ausência, e ausência não é
resposta.

**No banco é `boolean not null default false`**, ao contrário da modalidade,
que é opcional. Aqui o valor neutro existe e é verdadeiro para tudo que já
foi publicado — vaga antiga não era para PCD —, então não há linha "sem
resposta" para tratar. A coluna entra por último em `job_listings`, pela
regra do `create or replace view`, e `aplica-vaga-pcd.sql` roda **antes do
deploy**: o `insert` passa a mandar `para_pcd`.

**O filtro entra na chave do cache da listagem.** É do que se pergunta, e
ficar de fora serviria a lista de todas as vagas a quem pediu só as de PCD —
pelo cache, sem erro nenhum.

**Mora dentro de "Tipo", como `?tipo=pcd` (#463).** Decisão do Luiz em
14/10/2026: ele não precisa de um filtro separado na barra. A página traduz
o valor para o booleano que a camada de dados já recebia, e não o repassa à
consulta como tipo de contrato — o banco compara `contract_type` com o
texto, e "pcd" nunca casaria. O custo, que ele aceitou ao pedir: é uma
escolha só, dá para filtrar por "CLT" **ou** por "Vaga para PCD", não pelos
dois juntos, e PCD não é tipo de contrato. O endereço antigo, `?pcd=sim`,
viveu um dia e hoje é "todas as vagas".

**A barra de filtros não esconde nenhum chip (#460).** O filtro de PCD
nasceu como o quarto chip de uma fileira que rolava para o lado, sem barra:
num celular de 412 px ficava cortado na borda ("Todas a…"), e o rótulo não
dizia PCD. Quem abriu a busca no dia do deploy não o achou e concluiu que a
atualização não tinha subido, quando tinha. Hoje os chips quebram de linha, e
a #463 tirou o chip de PCD de vez. A spec da #458 achava o filtro pelo
`<select>` escondido, que existe mesmo com o chip fora da tela; a nova
confere que cada filtro cabe inteiro na largura do aparelho, com um estado
escolhido (são quatro chips, e é aí que a fileira antiga cortava). *Teste que
encontra o controle por baixo da tela não prova que a pessoa o encontra por
cima.*

**E a lista que o filtro abre era branca no tema escuro (#462).** O preflight do Tailwind deixa o `select` sem fundo e com a cor do texto herdada, e a lista que o navegador desenha pegava o texto claro do tema sobre o branco padrão: só se lia o item sob o mouse. `color-scheme: dark` já estava no `<html>` e não resolvia, porque a cor do texto é a do tema. Hoje `option` tem fundo e cor dos tokens em `globals.css`, e o e2e (`lista-dos-filtros.spec.ts`) confere fundo opaco e contraste de 4,5:1 nos dois temas pelo estilo calculado — o popup nativo não sai em captura de tela. *Controle nativo herda a cor do tema, mas não o fundo: confira os dois.*

**A Lupa não guarda se o candidato é PCD.** É dado de saúde, e o filtro
funciona sem isso: quem procura filtra, quem tem a vaga responde. Se um dia
o perfil do candidato pedir isso, é decisão nova, com a LGPD à frente.

**Vaga só para mulher ou só para homem não existe, de propósito.** O pedido
veio junto, e o Luiz decidiu deixar tudo geral depois de ver o risco: a CLT
(art. 373-A) proíbe anúncio de emprego com referência a sexo, salvo quando a
natureza da atividade exigir isso pública e notoriamente — e abre exceção
para medidas que corrijam a desigualdade de acesso da mulher —, e a Lei
9.029/95 pune a discriminação na contratação. Uma plataforma que oferece o
campo oferece a infração. Não é parecer jurídico: se a pergunta voltar,
**um advogado lê junto com os Termos de Uso (#235)** antes de qualquer
campo. A alternativa que se avaliou foi "só mulheres e geral", com o motivo
escrito, para a vaga afirmativa.

## Estágio da candidatura: o nome depende de quem lê

Os cinco estágios (`enviada`, `visualizada`, `entrevista`, `aprovada`,
`rejeitada`) são um campo só, e **`enviada` tem dois nomes** porque os
dois lados fazem perguntas diferentes:

| Quem olha | Pergunta | Lê |
|---|---|---|
| Empresa | "o que ainda não olhei?" | **Nova** |
| Candidato | "alguém já olhou o meu?" | **Não visualizado** |

"Nova" não responde nada para o candidato — a candidatura dele nasceu
nova e ele sabe disso. E "Não visualizado" pode ser categórico porque o
estágio sai de `enviada` **sozinho** quando alguém da empresa abre a
ficha (`marcarComoVisualizada`), sem depender de ninguém lembrar de
marcar. Os outros quatro são iguais nos dois lados: nome diferente para o
mesmo estado, sem pergunta diferente por trás, seria só duas pessoas
falando de coisas distintas.

Os rótulos vivem em `APPLICATION_LABELS` e `APPLICATION_LABELS_CANDIDATO`,
com teste que trava a divergência. O valor no banco não muda: renomear o
enum custaria migração e apagaria histórico sem ganhar nada.

## O resultado da vaga, o chamado no WhatsApp e quem já se candidatou (#492, #493, #494)

Três pedidos do Luiz em 26/10/2026, todos do lado de quem contrata, e todos
respondendo à mesma pergunta: o que a Lupa dá à empresa que o Instagram e o
grupo de WhatsApp não dão.

**O resultado fica na linha de cada vaga (#492).** Visualizações,
candidaturas e quantas combinam com o que a vaga pede, juntos, no fim da
linha dela. A empresa publicava e esperava sem ver o que a Lupa fez por
ela, e sem prova de resultado não renova. `visualizacoesPorVaga` soma desde
a publicação (a tela da série continua sendo de 30 dias), e a conta mora
numa função pura (`src/lib/resultado-da-vaga.ts`), testável. **"Muito
compatível" é a partir de 70%** — o mesmo corte que pinta o selo da lista de
currículos de verde (`LIMIAR_MUITO_COMPATIVEL`): o resumo da vaga e o selo da
linha precisam dizer a mesma coisa, ou a empresa soma os verdes da lista e
não acha o número do resumo. **E "zero" é uma afirmação**, a mesma lição do
casamento: o número só aparece quando dá para comparar. Vaga que não declara
habilidade, ou candidato que não declarou nenhuma, ficam fora da conta, e a
linha não menciona "muito compatíveis" em vez de mentir com um zero.
**A tela diz o que a visualização é**, uma vez, antes dos números: serve para
comparar uma vaga com outra, não para contar pessoas — a Lupa não guarda quem
viu (a decisão de privacidade das visualizações), então quem abre de novo
conta de novo, e o robô de prévia do link não conta (#490).

**Vaga encerrada ou vencida mostra o "Resumo final" e o caminho para
continuar:** "Publicar outra parecida" abre o formulário **preenchido** com o
texto dela (`?modelo=<id>`). Só preenche: a revisão antes de ir ao ar
continua, a vaga nova gasta uma vaga do saldo como qualquer outra, e as
perguntas de triagem não vão junto. O id vem da URL, e por isso só se lê **a
vaga da própria empresa** (`modeloDeVaga`): vaga alheia ou inexistente abre o
formulário vazio, sem dizer qual dos dois foi. Reativar (que também custa uma
vaga) continua ao lado, para a vencida.

**O chamado no WhatsApp já era um link `wa.me` com texto, e a mensagem só
ganhou o que faltava (#493).** O texto traz o nome da pessoa, o cargo da vaga
**e o nome de quem chama** — sem o nome da empresa, quem recebe lê um número
desconhecido falando de uma vaga, e desconfia. Mora em `mensagemParaCandidato`
(`src/lib/chamada.ts`) porque a ficha e a lista mandam a mesma mensagem, e
duas cópias do texto divergem. **"A empresa edita antes de enviar" é do
próprio WhatsApp**: `wa.me/?text=` abre a conversa com o texto no campo de
escrita, sem enviar. Um campo de edição dentro da Lupa seria atrito sem ganho,
e a ficha só diz isso ("Edite antes de enviar"). O consentimento é o de
sempre: a ficha só abre para a empresa dona da vaga a que a pessoa se
candidatou.

**"Quem já se candidatou" (#494) não é um banco de talentos aberto, e a
diferença é a decisão.** A busca livre continua fora do escopo, pela mesma
razão de sempre: numa cidade pequena o patrão atual de alguém pode estar entre
as empresas cadastradas. A lista (`/empresa/talentos` e `/contratar/talentos`)
nasce **só das candidaturas da própria empresa da sessão**: a empresa vê a
pessoa porque ela se candidatou a uma vaga dela, e outra empresa nunca alcança
aquela candidatura. O que muda é o alcance **dentro da mesma empresa** — a
candidatura a uma vaga passa a valer para as outras vagas dela, que era a
queixa ("ao abrir outra vaga parecida a empresa começa do zero"). **Uma linha
por pessoa, e não por candidatura:** quem se candidatou a três vagas aparece
uma vez, com a mais recente e a contagem; a linha abre a ficha dessa
candidatura, que é por onde a empresa tem direito a currículo e contato. Os
filtros (habilidade e área) são os da busca de candidatos, e a habilidade passa
pela mesma tabela de sinônimos. **Quem exclui a conta sai da lista**, e não
por um filtro: a candidatura é apagada em cascata, e a lista é feita delas. O
teto é o das candidaturas do painel (200, das mais recentes), e a tela diz
isso, para ninguém concluir que uma pessoa antiga sumiu. A Política de
Privacidade diz que a candidatura continua disponível à empresa em outras
vagas dela — a lição da #235: texto legal sai do que o produto faz.

## Perguntas de triagem: separar sem esconder (#491)

A triagem de quem se candidata acontecia no WhatsApp pessoal do dono, lendo
currículo por currículo; o InfoJobs cobra à parte por perguntas de triagem, e o
grupo de WhatsApp nunca faz. Ao publicar, a empresa acrescenta até três
perguntas de sim ou não ("Tem CNH D?", "Pode trabalhar à noite?"), e marca cada
uma como eliminatória ou só informativa. Quem se candidata responde na hora, e
sem responder todas não envia.

**"Eliminatória" separa e não bloqueia, e isto é a decisão central.** A
resposta esperada é Sim; quem responde Não **envia a candidatura do mesmo
jeito** e aparece na lista da empresa num grupo à parte ("Não responderam o que
a vaga exigia"), com o motivo escrito na linha (`Respondeu Não: Tem CNH D?`) e
as respostas na ficha. Barrar quem respondeu Não esconderia gente por uma
pergunta que talvez tenha sido entendida de outro jeito, sem a empresa nunca
saber que a pessoa existiu — e a candidatura é o que a pessoa fez, não uma
fase eliminatória que a Lupa decide por ela. A decisão de olhar continua da
empresa; a pergunta informativa só informa e nunca muda o grupo de ninguém. A
tela de quem se candidata **diz qual pergunta a empresa considera
indispensável**, antes da resposta: dizer ajuda quem responde honestamente, e
quem mente mentiria de qualquer forma.

**Nenhuma resposta vem marcada de antemão.** "Não" como padrão faria uma pessoa
distraída se candidatar dizendo que não tem a CNH que tem; o envio só se
habilita com todas respondidas, e a tela diz quantas faltam.

**As perguntas moram na linha da vaga (`vagas.perguntas`, jsonb), e as
respostas na da candidatura (`candidaturas.respostas`)**, e não em tabelas à
parte: publicar é uma instrução só, e a vaga não pode ficar no ar sem as
perguntas que a empresa escreveu — nem a candidatura sem as respostas. O banco
repete o que a aplicação confere (`candidaturas_confere_triagem`): vaga com
perguntas não recebe candidatura sem respostas completas (`23514`, que o
repositório traduz em "responda a todas as perguntas"), e vaga **sem** pergunta
descarta o que vier. O teto de três também é do banco. A comparação `atende` é
uma função só (`src/lib/triagem.ts`), compartilhada entre a tela de quem se
candidata, a lista da empresa e a ficha: três cópias divergiriam no primeiro
que mudasse. Resposta que falta, numa vaga com pergunta eliminatória, conta
como "não atende" — "não sabemos" não é "atende".

**A pergunta não aceita link** (a mesma regra do cargo, #447: é texto de
terceiro que a Lupa mostra a quem tem conta), nem repetida, e **não se edita
depois de publicada**, como o resto da vaga (#173). A vaga continua
denunciável. O que isto não é: filtro de candidato, ou triagem automática —
continua fora do escopo por decisão. A Política de Privacidade diz que as
respostas ficam na candidatura, chegam à empresa dona da vaga junto do
currículo e somem com a candidatura (excluir a conta a apaga em cascata); os
Termos dizem o que "eliminatória" faz e que quem pergunta não pode discriminar
por critério vedado em lei.

## A área de contratação como mini CRM: abas, funil e o resumo do dia (#511)

Pedido do Luiz em 27/10/2026: o painel da empresa era "simples e sem graça"
para quem recruta todo mês — e as agências de emprego são o público que a
Lupa quer atrair. Ele virou abas, nas duas portas (`/empresa` e
`/contratar`): **Painel, Vagas, Candidatos e Talentos**. É a fase 1, só
tela, com o que o banco já guarda; anotações, entrevista com hora, etiquetas
(fase 2) e vaga em nome de cliente ou vários usuários por empresa (fase 3)
ficam para Issues próprias.

**Candidatos é a aba que faz do painel um CRM** — o funil, no endereço
`/funil`. As candidaturas em colunas
pelos cinco estágios que já existiam, cada card com nome, vaga, % de
casamento, o motivo da triagem, há quanto tempo, WhatsApp e o seletor de
estágio. No computador o card se arrasta entre colunas; **o arrastar é um
atalho por cima do seletor**, e é o seletor que vale para teclado, leitor de
tela e celular, onde arrastar com o dedo numa página que rola é briga com a
rolagem. No celular aparece uma coluna por vez, escolhida por botões de
estágio que quebram de linha (#460) — cinco colunas lado a lado em 360 px
seriam cinco tiras ilegíveis. A mudança aparece na hora e volta se o servidor
recusar: o estado local é só o que foi movido ali, por cima do que veio do
servidor, sem efeito sincronizando nada. Quem não respondeu o que a vaga
exigia fica à parte dentro de cada coluna (#491). O card leva só o que a tela
mostra; o currículo continua chegando pela ficha.

**O Painel virou o resumo do dia**: "para hoje" (novas para olhar, em
entrevista, vagas que vencem em 3 dias, cada uma um clique para onde se
resolve), o cartão da empresa com a série de 30 dias, o funil em números
("do currículo à contratação": recebidas, olhadas, entrevistas e
selecionados, cada um como fração das recebidas, a conta do painel do admin)
e as cinco candidaturas mais recentes. **O alcance conta até onde cada um
chegou, não o estágio de agora**: quem foi selecionado passou pela
entrevista, mesmo que a empresa tenha pulado o estágio. As listas inteiras
saíram do painel — as vagas para a aba Vagas, as candidaturas para Candidatos.

**As abas cabem no celular sem rolar para o lado**: colunas iguais,
ícone em cima e nome embaixo, o desenho da barra inferior. A fileira que
rola já escondeu um filtro inteiro (#460).

**Os cards de atalho viraram um tutorial de primeira visita (#513).** O
painel tinha três cards abaixo do resumo — o plano, "Quem já se candidatou"
e "Buscar candidatos" —, e desde as abas eles só repetiam o caminho. O Luiz
leu um deles e não entendeu o que era. Pedido dele em 28/10/2026: tirar os
três e explicar uma vez, como um tutorial rápido. São quatro passos, um por
vez (publicar com o plano de quem olha, o funil, os talentos e a busca, que
só entra para quem a matriz deixa buscar, #251), e "Pular", o X ou o último
passo fecham. **"Visto" mora no aparelho** (`localStorage`), não na conta:
guardar na conta pediria coluna nova e SQL em produção para uma explicação
de quatro passos, e o preço — aparecer de novo num aparelho novo — não custa
nada a ninguém. Sem storage, fechar vale para a visita. O servidor não
desenha o tutorial, porque não sabe se já foi visto: aparecer depois da
hidratação é melhor que piscar e sumir.

O card da busca existia porque o botão pequeno do topo passava despercebido
(#83). O botão "Candidatos" continua no topo, e quem chega pela primeira vez
lê no tutorial o que ele faz; quem fechou o tutorial sem ler fica com o
botão. Nenhum caminho perdeu a porta: as abas levam a Talentos, e Planos
abre pelo cartão da empresa.

**A aba Funil virou Candidatos, e Planos saiu das abas (#515).** Pedido do
Luiz em 28/10/2026. A #511 nasceu com cinco abas, com "Funil" e "Planos"
entre elas. A aba passou a se chamar pelo que mostra, as pessoas que se
candidataram; o endereço `/funil` ficou, porque trocar link não muda nada
para quem clica. Com isso, o botão do topo que abre a
busca (`/candidatos`) passou a dizer "Buscar candidatos": duas coisas
chamadas "Candidatos" na mesma tela seriam a mesma palavra para lugares
diferentes. **Planos é página à parte**, sem as abas e com o caminho de
volta ao painel, como era antes da #511: é o que se abre de vez em quando,
não o dia a dia de contratar. A porta dela no painel é "Ver planos", ao lado
do selo do plano no cartão da empresa; o perfil tem o atalho "Planos e
vagas", e o formulário de vaga leva até ela quando falta saldo.

## O contador de vagas para publicar (#518)

Pedido do Paulinho em 28/10/2026: a empresa precisa ver quantas vagas ainda
pode publicar. O painel dizia o plano num selo curto ("Plano de 5 ativo") e a
tela de planos, numa frase; a soma não aparecia em lugar nenhum, e a empresa
descobria que tinha acabado só ao tentar publicar.

O contador (`contador-de-vagas.tsx`) fica no painel, logo abaixo das abas, e
no topo da tela de planos: o número grande, de onde vem cada vaga ("3 do
plano · 1 avulsa · 1 grátis") e, no plano com limite, a barra de quantas
estão no ar de quantas cabem.

**A conta soma as três fontes, na ordem de `gastarParaPublicar`** — o lugar
no plano, a primeira grátis e o saldo avulso —, e mora em
`vagasParaPublicar`, ao lado de `resumoDoDireito`, para o número e a frase
não divergirem quando a regra mudar. Mostrar só uma das fontes faria o
número mentir para quem tem duas: o plano cheio com saldo guardado ainda
publica, e um "0" ali mandaria a empresa comprar o que já tem.

**O ilimitado não vira número.** Plano ilimitado e parceria dizem
"Ilimitado"; um 999 seria um limite inventado, e o ∞ sozinho não se lê em
voz alta. **Zero é o único estado que pede ação**: a borda vira aviso, a
frase diz o que fazer — plano cheio e saldo acabado são frases diferentes,
porque a saída é diferente — e o link leva aos planos. Nos outros, o
contador só informa: o botão de publicar já está no topo do painel.

## Na % de casamento, zero é uma afirmação

A lista de currículos recebidos mostra quanto o candidato casa com a
vaga, pelo mesmo `casar()` do bloco de recomendados — um segundo cálculo
daria dois números para a mesma pergunta na mesma tela.

**"0%" diz à empresa "comparei, e esta pessoa não tem nada do que vocês
pedem"**, e isso basta para alguém não ser chamado. Por isso só sai
quando é verdade. Fica fora do mapa, e a tela não desenha selo nenhum,
quando:

- a vaga não declara habilidade e o título não dá pista; **ou**
- o candidato não declarou habilidade nenhuma.

A segunda metade é o caso **comum**, não o raro: o cadastro não pede
habilidade, ela entra depois no perfil. Sem ela, todo recém-cadastrado
apareceria com 0% ao lado do nome — e a empresa aprenderia a ignorar o
selo, ou descartaria quem só não preencheu um campo. Achado testando na
tela, não lendo o código.

## Vaga expira em 30 dias, e reativar custa o mesmo que publicar

Vaga publicada ficava aberta para sempre. Numa plataforma de emprego isso
sustenta falsa esperança: candidatar-se a uma vaga de meses atrás, que pode
nem existir mais, sem nenhum sinal de que ficou velha —
[#157](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/157).

**"Expirada" nunca é guardada.** É sempre calculada a partir de
`vagas.expira_em` (`vagaExpirada`, em `src/lib/format.ts`), nunca um
terceiro valor de `status` — que continua só `aberta`/`fechada`, o dono de
sempre. Guardar como estado próprio exigiria um job agendado para o valor
ficar certo; calculando na hora, a correção mora na própria consulta e
nunca atrasa. `getJobs` filtra `expira_em > now()` do mesmo jeito que já
filtra `status = 'aberta'`; `candidatarSe` recusa vaga expirada mesmo
chamada direto, sem passar pela tela — o botão já some, mas "botão que só
recusa depois do clique" é a armadilha que este arquivo já registrou, e a
action não podia ficar de fora dela.

**Reativar custa uma vaga do saldo, como publicar** — decisão do Luiz em
09/09/2026 (#172), revertendo o "gratuito e sem limite de vezes" com que
a #157 nasceu. Este parágrafo afirmou o contrário por um dia, e a
diferença não é de detalhe: a #157 foi decidida quando publicar não
custava nada, e mantê-la depois da cobrança abriria o caminho óbvio para
nunca mais pagar — publica uma vaga e renova para sempre. **Vaga fantasma
paga uma vez.**

O que continua valendo da #157 é o **estado**: reativar não é "publicar
de novo" no sentido de `status`, só estende `expira_em`. É diferente de
"encerrar", que é decisão do dono e continua sem volta — `reativarVaga`
exige `status = 'aberta'` e o prazo já vencido, nunca uma vaga que o
dono fechou.

Vale como aviso sobre este arquivo: **quando uma decisão nova reverte uma
antiga, o parágrafo da antiga é o que precisa ser reescrito** — não basta
descrever a nova noutra seção. Aqui a seção de cobrança já dizia o certo
enquanto esta dizia o contrário, e as duas eram lidas como verdade.

Vaga publicada antes desta migração ganha 30 dias a partir do deploy —
`aplica-prazo-vaga.sql` faz isso com o `default` da coluna, avaliado uma
vez, no momento da migração. Ninguém perde o anúncio no dia da mudança.
