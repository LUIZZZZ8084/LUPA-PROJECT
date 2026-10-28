# Cobrança: planos, mensalidade, caixa e Mercado Pago

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## Cobrança: a espera por demanda acabou, mensalidade de prestador é o primeiro uso real

Luiz tinha decidido em 25/08/2026 esperar demanda validada antes de cobrar
— pagamento como última etapa, issue
[#46](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/46) parada de
propósito. **Ele reverteu essa espera em 08/09/2026, e fixou a mensalidade
do prestador em R$ 19,90.** A decisão foi atualizada, não ignorada, e fica
registrada aqui pela mesma razão que toda decisão deste arquivo fica —
para que "por que isto está assim?" tenha resposta seis meses depois.

O preço mora num lugar só, `PRECO_CENTAVOS` em
`src/server/pagamentos/planos.ts`, e a tela de assinatura lê de lá. Preço
repetido na tela e no servidor é como se cobra um valor e se anuncia
outro.

**A tabela das vagas de empresa virou plano em 26/10/2026 (#489), e os
pacotes saíram de venda.** Decisão do Luiz: vaga avulsa R$ 19,90 (compra
única), Plano 5 R$ 49,90/mês, Plano 10 R$ 79,90/mês e Ilimitado R$ 99,90/mês.
Em 14/10 (#469) a tabela era avulsa 19,90, pacote de 5 por 79,90, pacote de
10 por 99,90 e mensal 149,90 — e este parágrafo descrevia isso, com o pacote
como unidade de compra. **Pacote era compra única de crédito que não
expira**: quem comprava dez vagas não tinha motivo para voltar, e o mensal
custava 50% mais que o pacote de 10 sem ser a escolha óbvia de ninguém.
Plano é receita que se repete, e o preço por vaga cai a cada degrau (9,98 no
Plano 5, 7,99 no Plano 10).

**O limite do plano é de vagas no ar ao mesmo tempo, não de vagas por mês.**
O Plano 5 deixa cinco abertas e dentro dos 30 dias; encerrar ou vencer uma
abre o lugar na hora (`contarNoAr`, em `RepositorioVagas`). A alternativa —
cinco por mês — obrigaria a guardar o que foi publicado em cada ciclo de
cobrança, e puniria quem encerra a vaga porque contratou. O número vive na
carteira (`carteiras_vaga.plano_vagas_no_ar`, nulo é ilimitado) e não é
deduzido do tipo da assinatura, porque o estorno e a expiração agem sobre a
carteira, e a carteira não conhece assinatura. A tabela de limites é
`VAGAS_NO_AR_POR_PLANO`, ao lado dos preços.

**Plano cheio não trava quem tem saldo avulso.** A ordem de
`gastarParaPublicar` é plano com lugar, primeira vaga grátis, crédito
avulso. A sexta vaga ocasional de quem tem o Plano 5 sai por R$ 19,90, mais
barato que subir de plano; a partir da sétima o Plano 10 já compensa — e o
`tabela-de-precos.test.ts` cobra exatamente isso, junto com o ilimitado como
teto. Quando o plano está cheio e não há saldo, a mensagem diz que o plano
**funciona** e falta lugar. Dizer "assine um plano" a quem já assinou é a
mensagem que faz a pessoa concluir que o app não sabe que ela existe.

**Na tela, a vaga avulsa vem primeiro (#501).** Pedido do Luiz em
27/10/2026: quem tem uma vaga só achava a opção dela depois de rolar por
três planos mensais. Ela continua num bloco separado dos planos — não
renova, não vira plano —, e a tela de depois do cadastro usa a mesma
ordem, porque as duas leem a mesma lista e divergir é como uma passa a
dizer o que a outra não diz.

**E as quatro opções são cards num carrossel, não uma lista (#503).**
Pedido do Luiz em 27/10/2026: no celular a pessoa comparava preço rolando
por quatro painéis altos e perdia de vista o anterior ao chegar no próximo.
É rolagem nativa com `scroll-snap` (`src/components/carrossel.tsx`), sem
biblioteca: toque, inércia e encaixe são do navegador. Um card quase inteiro
no celular e 60% da faixa no desktop, com o vizinho à vista; pontos mostram
a posição, e as setas só existem onde há mouse. Os pontos não são botões
porque quatro alvos de 44 px numa fileira não cabem, e o toque já tem o
gesto de arrastar. A faixa recebe foco (`tabIndex`), e é isso que deixa o
teclado rolá-la. A avulsa diz "compra única" no lugar de "por mês", porque
no mesmo carrossel misturá-la faria parecer "o plano de 1". A tela de depois
do cadastro não virou carrossel: ela é compacta de propósito, para caber
sem rolar.

**O ponto aceso errou por um `position`, e só o navegador viu.** O card
ativo é o que está mais perto do meio da faixa, medido por `offsetLeft`, que
conta a partir do `offsetParent` — e uma faixa sem `position: relative` não
é o `offsetParent` dos cards, então a conta erra por quanto a faixa está
longe da borda da página (no desktop, o terceiro card acendia o segundo
ponto). O teste unitário usa medidas inventadas e passa com o defeito; o
e2e de `planos-de-vaga.spec.ts` rola a faixa até o fim num navegador de
verdade e reprova sem o `relative`. *Conta que depende de geometria se
confere onde há geometria.*

**Um plano por vez, e trocar é cancelar a renovação do atual.** Dois planos
vivos seriam duas cobranças por mês para um benefício só, que só aparece na
fatura de quem pagou. A regra mora na aplicação (`recusarSegundoPlanoDeVaga`)
e não num índice único: uma violação de unicidade aconteceria dentro do
webhook, e webhook que responde 500 é webhook que o Mercado Pago reenvia
para sempre. Checkout pendente ou suspenso de outro plano é encerrado sem
perguntar (nada foi pago); plano **ativo** recusa, com a mensagem dizendo o
caminho, e a tela nem oferece o botão de assinar outro — "botão que só
recusa depois do clique". **Cancelar não tira os dias pagos**, e quem troca
soma a validade do plano antigo à do novo: aceito, porque o custo é alguns
dias com um limite diferente.

**A primeira vaga é grátis, só com CNPJ conferido na Receita, uma por conta.**
A conta de empresa por CPF nasce verificada sem consulta nenhuma (o CPF é
conferido só pelo dígito), então vaga grátis atrás disso seria porta de
abuso: criar conta e publicar de graça, quantas vezes quisesse. O CNPJ
conferido prova que a empresa existe e está ativa, e `cnpjEmUso` garante
uma conta por CNPJ. O que isto não impede: excluir a conta e abrir outra com
o mesmo CNPJ dá outra vaga grátis — custa o histórico todo da empresa e, no
pior caso, R$ 19,90. A reivindicação é uma instrução só no banco
(`reivindicar_primeira_vaga_gratis`, `where ... is null`), pela mesma razão
do consumo de crédito: duas publicações simultâneas não ganham duas. Se a
gravação da vaga falhar depois, a primeira volta (`devolverCobranca`) — o
mesmo caminho do crédito devolvido.

**A empresa vê para quantas pessoas a vaga vai, e só com gente suficiente.**
Na tela de planos, "N pessoas em {cidade} pediram para ser avisadas de vaga
nova" — de `pessoas_com_aviso_na_cidade`, que conta preferência **com
aparelho inscrito** (preferência sem aparelho não avisa ninguém) e devolve
só o número. Abaixo de dez (`MINIMO_DO_PUBLICO`) a tela não diz nada: "3
pessoas" numa cidade pequena seria rastreável a alguém, e quem pede aviso de
vaga pode estar procurando sair do emprego atual — a regra de privacidade
dos avisos —, e um público de três não convence ninguém. A Política de
Privacidade diz isso (a lição da #235: texto legal sai do banco, não do
produto).

**Quem comprou pacote não perde nada.** `empresa_pacote_5` e
`empresa_pacote_10` continuam no enum (o Postgres não tira valor), e o
histórico das compras antigas fica. Os créditos que sobraram valem como
avulsa. As views do painel comparam `tipo::text`, e não o enum, por um
detalhe do Postgres: valor de enum acrescentado na mesma transação não pode
ser usado nela, e a migração (`aplica-planos-de-vaga.sql`) acrescenta os
valores e redefine as views junto. Quem já tinha o mensal ilimitado
continua ilimitado: limite nulo é exatamente isso, e nenhuma linha antiga
precisa ser tocada.

**Descartado, e por quê.** *Destaque* (vaga no topo da lista): conflita com a
ordenação por proximidade, que é a promessa do produto, e dar posição por
dinheiro é o que os Termos dizem que a Lupa não faz ("nenhum pagamento na
Lupa compra colocação"). *Plano anual com desconto*: precisa de teste real no
Mercado Pago antes de existir, e não há demanda medida. *Limite de busca de
candidatos por plano*: o teto de 30 perfis por dia (#433) já faz esse
trabalho, e diferenciá-lo por plano é outra decisão de produto.

Um teste (`tabela-de-precos.test.ts`) trava os valores e cobra a **escada**:
cada plano maior custa mais e cada vaga dele custa menos, o Plano 5 passa a
valer a pena na terceira vaga e o ilimitado custa pouco mais que o Plano 10.
A conferência no banco antes de mudar achou **nenhuma assinatura de empresa**
e só uma compra aprovada, então ninguém em andamento muda de preço — e, em
geral, a cobrança aberta guarda o valor de quando foi criada, e o Mercado
Pago o da assinatura.

**A infraestrutura nasceu com um tipo de cobrança só, não seis.** O brief
já previa vaga avulsa, planos de empresa, mensalidade de prestador e
currículo pago — mas declarar um `tipo_pagamento` com valores para coisas
que nenhuma tela ainda vende seria a mesma promessa sem a outra ponta
construída que já derrubou a fila de verificação manual (`Especie` sem
`"documento"` nem `"selfie"`, registrado mais acima). `tipo_pagamento`
nasce só com `'prestador_mensalidade'`
([#159](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/159)); cada
cobrança nova ganha o próprio valor, por `alter type ... add value`,
quando tiver uma tela de verdade.

**A devolução se pede pela Lupa, não pelo Mercado Pago.** Decisão do Luiz
em 08/09/2026 (#168): automático e devolve tudo. A pessoa assinou aqui;
mandá-la a um serviço que ela não escolheu, e onde não tem conta, é
empurrar o problema para fora.

**E vale só na primeira cobrança, em até 30 dias.** Revisão do Luiz em
09/09/2026 (#170), quando a cobrança virou recorrente — os sete dias
originais eram do modelo avulso, onde não havia mês seguinte. Assinatura
mensal com devolução sempre aberta é serviço de graça: assina, usa 29
dias, pede o dinheiro de volta, repete. A primeira cobrança é a porta de
entrada, e quem experimentou e não gostou tem um mês para desistir; da
segunda em diante a pessoa já sabia o que estava contratando, e o que ela
precisa é de uma saída para o **futuro** — `cancelarRenovacao` —, não do
dinheiro do mês corrente de volta.

**"Primeira" conta aprovadas e estornadas**, não só as aprovadas
(`STATUS_LIQUIDADOS`). Contando só as aprovadas, quem pedisse devolução
voltaria à casa de partida: assinar de novo daria outra "primeira
cobrança", e o buraco que a regra fecha continuaria aberto — só com um
passo a mais.

**A devolução cancela a renovação antes de mover o dinheiro, nunca
depois.** Se a ordem fosse a inversa e o cancelamento falhasse, a pessoa
ficaria com o dinheiro de volta e uma cobrança nova programada para o mês
seguinte — e não há como desfazer um estorno para consertar. Cancelando
primeiro, a pior falha possível é uma assinatura encerrada sem devolução:
recuperável, porque assinar de novo está a um clique, e os dias já pagos
não são tocados. **Quando duas operações irreversíveis precisam acontecer
juntas, faça primeiro a que dá para desfazer.**

O circuito fecha com o que já existia: o botão chama
`POST /v1/payments/{id}/refunds`, o Mercado Pago devolve e manda o webhook
`refunded`, e o `refunded` revoga a mensalidade. **O efeito é aplicado na
hora, sem esperar o webhook** — quem apertou precisa ver o resultado —, e o
webhook que chega depois encontra a cobrança já `estornado`, com `estornar`
devolvendo `null`. A idempotência é o que permite as duas portas.

**Falha do Mercado Pago não revoga nada.** Se o estorno não aconteceu, o
dinheiro não voltou: tirar a vitrine ali seria o pior dos dois mundos, e do
jeito mais difícil de perceber, porque a tela diria que deu certo. É o caso
que decide se a funcionalidade está certa ou perigosa, e tem teste próprio
em `pagamentos-estorno-que-falha.test.ts` — em arquivo separado porque
`temMercadoPagoConfigurado` é constante de importação.

**A janela é decidida no servidor, e o botão só aparece dentro dela.**
Mostrar a opção fora dos 30 dias — ou fora da primeira cobrança — e
recusar depois do clique é o "botão que só recusa depois do clique" que
este arquivo já registra duas vezes. E o serviço recusa de qualquer
forma: tela não é portão.

**Cancelar e estornar são coisas diferentes, e agora as duas existem.**
Cancelar interrompe as cobranças **futuras** e não devolve nada — os dias
já pagos continuam valendo até o fim do período, e `cancelarRenovacao`
não toca em `mensalidade_valida_ate` de propósito. Estornar quer o
dinheiro de volta, e aí a mensalidade cai na hora.

Sem esse botão, uma cobrança recorrente vira armadilha: a pessoa autoriza
uma vez e só sai indo procurar o Mercado Pago, onde não escolheu ter
conta. É a mesma razão que trouxe a devolução para dentro da Lupa, e é por
isso que a #170 não podia entregar a recorrência sem entregar o
cancelamento junto.

**Estorno e chargeback tiram a mensalidade na hora.** Decisão do Luiz em
08/09/2026, escolhendo entre isso e encurtar a validade até a data do
estorno. O caso que manda é o chargeback fraudulento: quem contesta a
cobrança e continua anunciando fica com o serviço de graça, e a vitrine
passa a ter alguém que o app não consegue cobrar. O preço aceito é que
quem pede estorno legítimo no dia 29 de 30 perde o dia que faltava.

**`estornar` parte de `aprovado`, não de `pendente`** — e é a única das
quatro transições que faz isso. As outras resolvem uma cobrança ainda em
aberto; estorno chega depois de o dinheiro ter entrado. Usar a guarda de
`pendente` ali recusaria a transição em silêncio e devolveria `null`, que
quem chama lê como "outra notificação já resolveu".

## O caixa: todo valor que entra é registrado, e o que sai também (#179)

Decisão do Luiz em 10/09/2026. O painel do admin mostrava "faturamento
estimado" a partir de `perfis_empresa.plano` — a coluna que este arquivo
já cita como exemplo de estado declarado sem produtor. Nada nunca escreveu
nela, então "assinaturas ativas" era sempre zero, "em teste" contava todas
as empresas, e a receita era zero vezes um preço de tabela que também
estava errado (R$ 149, quando o plano mensal custava R$ 199,90).

Hoje a fonte é `pagamentos`, na view `metricas_caixa`, e o bloco deixou de
se chamar "estimado" — não é projeção, é o que entrou e o que saiu.

**As duas saídas são registros diferentes, e isso é o que a #179 mudou no
banco.** Até aqui `refunded` e `charged_back` caíam os dois em
`estornado`, porque o efeito no app é idêntico: a mensalidade cai, os
créditos voltam. Mas **o efeito é o que eles têm em comum, não o que eles
são** — chargeback é o cliente abrindo disputa no cartão, custa taxa do
Mercado Pago, é sinal de fraude e dá para contestar de volta. O enum
ganhou `contestado`, e o webhook decide qual gravar.

A janela para decidir isso é única: a distinção existe só no corpo da
notificação, e depois de gravado "saiu dinheiro" não há como recuperá-la.
Por isso a separação entrou **antes** de existir qualquer estorno em
produção — reclassificar depois seria chute.

**`recorrente` é medido à parte do total** porque são as duas metades de
qualquer projeção: mensalidade de prestador e plano mensal voltam sozinhos
no mês que vem; vaga avulsa não volta sem alguém comprar de novo. Somados,
um mês bom de avulsas parece receita previsível. Os três planos de vaga
entram no recorrente.

**O líquido é calculado na aplicação, não na view.** A view entrega as
parcelas; a subtração mora num lugar só, porque escrevê-la em SQL e de
novo em TypeScript é uma chance a mais de as duas divergirem.

**Os cinco valores de `status_pagamento` agora têm produtor.** `estornado`
e `cancelado` existiam no enum e no tipo do TypeScript sem que nada no
código os gravasse: `refunded` e `charged_back` caíam num ramo de "nada
muda ainda", e `cancelled` virava `rejeitado`. Estado declarado sem
produtor é a mesma armadilha do `pedidos_verificacao` sem tela de envio —
**parece tratado, e o teste que existe passa, porque ninguém escreveu o
caso que nunca acontece.** Foi achado lendo a tabela de cartões de teste do
Mercado Pago para montar a matriz de testes: os cartões cobrem aprovado,
pendente e cinco recusas, e nenhum cobre estorno, que só acontece depois da
compra. **Quando um enum tem valor que nenhum caminho produz, ou falta
código ou sobra valor** — as duas respostas são aceitáveis, fingir que está
resolvido não é.

**A renovação é `preapproval`, não Checkout Pro repetido.** O modelo
antigo era pagamento avulso: pagava R$ 19,90, ganhava 30 dias, e no dia 31
o perfil sumia da vitrine **sem cobrança nova e sem aviso**. Ninguém
renovava sozinho — nem o app, nem a pessoa, que não tinha motivo para
lembrar de uma data que nada avisava. Hoje o Mercado Pago guarda uma
autorização mensal e cobra sozinho (#170). O Checkout Pro avulso saiu
junto com a coluna `mp_preference_id`: código e coluna que nenhum caminho
mais escreve são a mesma armadilha do enum sem produtor, e vaga avulsa os
traz de volta quando tiver tela.

**Clicar duas vezes não pode criar duas assinaturas.** Quem começou e não
terminou volta ao **mesmo** `init_point`, guardado em
`assinaturas.checkout_url`. Um `preapproval` novo a cada clique deixaria
autorizações órfãs lá — e duas autorizadas seriam duas cobranças por mês
na mesma pessoa, erro que só aparece na fatura de quem pagou. A garantia é
da aplicação, e não de um índice único por pessoa, de propósito: uma
violação de unicidade aconteceria **dentro do webhook**, e webhook que
responde 500 é webhook que o Mercado Pago reenvia para sempre.

**São três tópicos de webhook, e o `data.id` de cada um aponta para um
recurso diferente.** `payment` traz um pagamento;
`subscription_preapproval`, uma assinatura;
`subscription_authorized_payment`, uma **fatura** da assinatura, que
carrega o pagamento por dentro — consultar `/v1/payments/{id}` com o id
dela responde 404, e a renovação nunca é registrada. Cada um tem a própria
rota de leitura, e o despacho está no route handler.

**A fatura só diz qual é o pagamento (#405).** A parcela decidia pelo
`payment.status` embutido nela — um resumo, e o único caminho de
confirmação que não relia o registro do dinheiro. Lida depois de um
estorno, ela ainda dizia `approved`. Hoje a fatura serve para achar a
assinatura e o id do pagamento; status e valor vêm de `/v1/payments/{id}`,
e o valor passa pela conferência da #331. Se o pagamento não volta da
API, é erro: o webhook responde 5xx e o Mercado Pago reenvia.

**A parcela é registrada por dois caminhos, e isso é deliberado.** Os
tópicos são marcados **à mão** no painel do Mercado Pago, e uma renovação
que só funciona se alguém lembrou de marcar a caixa certa falha em
silêncio — meses depois, com prestadores saindo da vitrine sem entender
por quê. Por isso `confirmarPagamento` também reconhece quando o
`external_reference` aponta para uma **assinatura**: o `preapproval` passa
a própria referência a todos os pagamentos que gera. A redundância só é
segura porque `registrarLiquidada` é idempotente pelo `mp_payment_id`,
com a garantia no índice único — não numa leitura antes da escrita, que
duas notificações simultâneas atravessariam. O teste que sustenta tudo
isso é "o mesmo pagamento pelos dois tópicos estende uma vez só".

**`cancelada` é terminal.** `definirStatusAssinatura` recusa sair dela na
própria instrução. Sem essa guarda, um aviso atrasado de "autorizada"
chegando depois do cancelamento ressuscitaria uma assinatura que a pessoa
encerrou — e ela voltaria a ser cobrada.

**Sem `MERCADO_PAGO_ACCESS_TOKEN`, a assinatura nasce ativa e já
cobrada.** Mesmo padrão do resto do app sem Supabase configurado:
`assinar` grava a assinatura, grava a primeira parcela aprovada e aplica o
efeito no mesmo passo, sem checkout nenhum para redirecionar. É o que
mantém a suíte e2e (sempre em demonstração) e o `npm run dev` sem
credencial exercitando o fluxo inteiro, do clique ao efeito — e é
diferente de "sem Storage", que recusa e avisa: aqui não há nada para a
pessoa perder por a cobrança não ter sido real.

**A tela de retorno acompanha a assinatura, não a cobrança.** Quem volta
do Mercado Pago volta **antes** de existir qualquer linha em `pagamentos`:
a primeira parcela só é registrada quando o webhook avisa. O polling
antigo, sobre o id do pagamento, giraria em "Confirmando" com tudo certo.
A pergunta que a pessoa tem ali é outra — "a renovação começou?" —, e quem
a responde é `/api/assinaturas/[id]`.

**O webhook relê da API do Mercado Pago — nunca confia no corpo do
POST.** A assinatura (`x-signature`, HMAC contra
`MERCADO_PAGO_WEBHOOK_SECRET`) prova que a notificação veio de lá, não o
que ela diz; `confirmarPagamento` usa o corpo só para saber qual
`payment_id` consultar de volta. Sem o segredo configurado, a rota recusa
toda notificação — falha fechada, não aberta: melhor não confirmar
pagamento nenhum sozinho do que confirmar um que ninguém pode provar que
veio do Mercado Pago.

**A assinatura não tem prazo, de propósito (#331).** A auditoria de 29/09
sugeriu recusar `ts` com mais de dez minutos, contra o reenvio de uma
notificação capturada. Não se fez: o Mercado Pago **reenvia sozinho**, por
horas, a notificação que falhou, e não está documentado se a retentativa
assina de novo. Um prazo podia recusar a retentativa legítima — e foi um
401 nosso que perdeu a primeira venda (#196). O reenvio malicioso, do
outro lado, não ganha nada: a rota relê o pagamento no Mercado Pago, e a
aprovação é condicional na própria instrução do banco.

**E o valor pago é conferido, mas não barra (#331).** `confirmarPagamento`
compara o `transaction_amount` relido com o valor da cobrança, e a
divergência vai ao Sentry com os dois números. A aprovação segue: hoje o
valor sai da preferência que o próprio servidor cria, e barrar seria
segurar o crédito de quem pagou por uma diferença que talvez nem seja
fraude — o defeito mais caro deste caminho. Quem opera decide, e o estorno
está a um botão.

**A aprovação é condicional na própria instrução do banco — `update ...
where status = 'pendente'`** —, não "lê o status, decide, grava" em dois
passos. O Mercado Pago reenvia webhook; duas notificações chegando quase
juntas não podem aplicar o efeito duas vezes, a mesma família de corrida
que o limite de publicações já resolve com `pg_advisory_xact_lock`. Aqui
a trava é mais simples porque a chave já é única por pagamento: a segunda
tentativa não encontra mais nada "pendente" e a função devolve `null`,
que o chamador lê como "nada a fazer".

**E quando o aviso não chega, a varredura vai buscar (#198).** Todo o
circuito acima depende de o webhook chegar naquela janela de segundos. Em
10/09/2026 ele não chegou — foi entregue e **recusado com 401**, por
segredo divergente —, e não havia caminho nenhum para o app descobrir
sozinho: o dinheiro entrou e a cobrança ficou `pendente` para sempre. Hoje
`reconciliarPagamentosPendentes` relê no Mercado Pago o que ficou preso,
disparada por cron.

A cobrança presa **não sabe o id do pagamento** — enquanto está
`pendente`, `mp_payment_id` é nulo, porque era o webhook que ia
preenchê-lo. O que se tem é o nosso id, que viaja como
`external_reference`; por isso a volta é por busca
(`/v1/payments/search`), e não por consulta direta.

**Entre várias tentativas, a aprovada tem precedência explícita.** Uma
preferência gera mais de um pagamento: cartão recusado, depois PIX
aprovado. Processar a recusada primeiro marcaria a cobrança como
`rejeitado` — e a aprovada chegaria depois sem encontrar nada `pendente`
para aprovar, porque a guarda mora na própria instrução do banco. **O
crédito sumiria de vez, por causa da ordem em que uma lista voltou.**
Ordem que decide dinheiro não pode ser herdada da resposta de terceiro.

**A mesma precedência vale no webhook, e não só na varredura (#358).** A
varredura enxerga todas as tentativas de uma preferência de uma vez e
escolhe a aprovada. O webhook recebe uma por notificação, e a recusada
costuma chegar antes: `rejeitar` e `cancelar` fechavam a cobrança, e
`aprovar` só partia de `pendente`, então a aprovação seguinte era
descartada em silêncio — quem pagou ficava sem o que comprou. Hoje
`aprovar` parte de `pendente`, `rejeitado` e `cancelado`, e as duas
outras continuam partindo só de `pendente`, para que uma notícia atrasada
de recusa não desfaça uma aprovação. O dinheiro entrou, então a
aprovação é a que manda. *Máquina de estados com estado terminal precisa
perguntar se o terminal pode ser ultrapassado por uma prova melhor.*

**Efeito que falha devolve a cobrança a `pendente` (#384).** O status
muda antes do efeito, e é essa ordem que impede dois webhooks simultâneos
de aplicarem o efeito duas vezes. O outro lado: se o efeito falhasse
depois — o banco soluçou, o perfil não existia —, o reenvio do Mercado
Pago achava a cobrança já `aprovado` e pulava o efeito, e a varredura só
olha pendentes. Quem pagou ficava sem o que comprou, sem erro visível.
Hoje `aplicarEfeitoOuReabrir` desfaz a aprovação (`reabrir`) antes de
propagar o erro, que vai ao Sentry com o tipo e o id da cobrança; o
reenvio e a varredura refazem. Vale também para a parcela da assinatura,
que bate no índice único do `mp_payment_id` e agora, se a encontra
reaberta, aprova de novo. O preço, aceito: se o efeito chegou a gravar e só
a resposta se perdeu, a nova tentativa aplica de novo — erro para o lado de
quem pagou, e visível, em vez de para o lado de quem não recebeu e não
tem como saber. O teste grátis (`confirmarAssinatura`) tinha o mesmo
buraco, fechado na #406 — ver "O teste grátis é um por conta".

**O cron recusa sem segredo em qualquer deploy da Vercel (#358).** Só
`VERCEL_ENV === "production"` recusava; num preview a rota rodava aberta
para qualquer GET, e um preview pode carregar a chave de serviço e o
token do Mercado Pago. Agora é `VERCEL` (qualquer deploy), e a comparação
do segredo é em tempo constante. Fora da Vercel — dev local e suíte —
continua rodando solta.

**O que ainda pode virar dinheiro não se toca:** boleto em aberto e PIX
não pago são `pending` lá também, e encerrar a cobrança ali tiraria de
alguém uma compra que ele ainda pode concluir. E há janela dos dois lados
— dez minutos de carência, para não competir com o webhook, e sete dias
de alcance, porque perguntar para sempre sobre checkout abandonado é
gastar chamada por algo que nunca vai mudar.

A rota que dispara (`/api/cron/reconciliar-pagamentos`) precisou entrar
no matcher do `proxy.ts`, como `api/webhooks` já tinha entrado: o cron da
Vercel faz um GET sem cookie, e o muro responderia 401 antes de a
varredura existir. Seria o defeito do webhook de novo, e pior — **rede de
proteção que nunca roda não deixa rastro de que não está rodando.**
**A fila da varredura gira, e "não deu para perguntar" não conta como
conferida (#388).** Ela pegava as 50 pendentes mais antigas. Checkout
abandonado nunca sai de pendente e voltava às mesmas 50 vagas em toda
varredura; com 50 dessas na frente, uma cobrança presa de verdade, criada
depois, nunca era conferida. Hoje a ordem é por `atualizado_em` — que o
banco já move por trigger, então sem coluna nova —, e uma cobrança
conferida que continua pendente é marcada (`marcarConferida`) e vai para o
fim. Para isso `pagamentosPorReferencia` passou a distinguir `null` (não
deu para perguntar: rede, timeout, resposta torta) de `[]` (perguntei e
não há nada): antes os dois eram lista vazia, e era seguro enquanto só
importava o que fazer com o dinheiro, mas com a fila girando uma queda do
Mercado Pago mandaria as cobranças examinadas para o fim sem ninguém tê-las
conferido. Em erro nada se mexe, e a próxima varredura tenta de novo.
*Quando a resposta ganha um segundo uso, confira se as duas causas que ela
juntava ainda podem ser juntas.*

**Cada domínio aplica o próprio efeito; `pagamentos` só aciona.**
`aplicarEfeito`, em `src/server/pagamentos/servico.ts`, despacha por tipo
para uma função do domínio certo — `estenderMensalidade`, em
`src/server/prestadores/servico.ts` — em vez de `pagamentos` conhecer
como `perfis_prestador` funciona. O `switch` tem uma trava de
exaustividade (`never` no `default`): se `TipoPagamento` crescer sem que
este arquivo ganhe um `case`, o build quebra ali — não em produção, com
uma cobrança aprovada e nenhum efeito aplicado.

**A mensalidade estende a partir do maior entre "agora" e o que já
valia**, nunca de "agora" sozinho — quem renova antes de vencer não perde
os dias já pagos. `estenderMensalidade(usuarioId, dias)` recebe esse
`dias` de dois lugares com sentidos diferentes: 30, a cada parcela
aprovada; e `DIAS_TESTE_GRATIS`, no início do teste — os dois parágrafos
abaixo.

## Sem carência: cartão logo depois do cadastro, com teste grátis (#170)

Virar prestador dava 30 dias de vitrine **sem pedir cartão nenhum** —
carência de verdade, para montar o perfil antes de decidir se valia
assinar. Revisão do Luiz em 09/09/2026: essa carência sem cartão saiu, e
foi exatamente o que permitia empilhar com a devolução da primeira
cobrança e ficar até 60 dias na vitrine sem pagar nada, repetidamente por
conta (ver a seção de estorno, acima). Hoje `virarPrestador()` e o
cadastro direto como prestador (a irmã em `src/server/auth/servico.ts`,
mesma lição da #142: duas funções que produzem o mesmo tipo de conta
precisam da mesma regra) gravam `mensalidadeValidaAte: null` — sem
assinatura, sem vitrine, ponto final.

**O que substitui a carência é um teste grátis de verdade, com o cartão
já autorizado.** `criarAssinaturaRecorrente` manda `free_trial` dentro de
`auto_recurring` — `{ frequency: DIAS_TESTE_GRATIS, frequency_type:
"days" }` — que é como o `preapproval` autoriza o cartão na hora e adia a
cobrança de verdade por esse tanto de dias. A diferença que importa
contra a carência antiga: **quem cancela dentro do teste nunca chegou a
ser cobrado**. Não há dinheiro para devolver, e por isso não é a mesma
categoria de risco que a devolução da primeira cobrança — ali o dinheiro
já tinha entrado.

**A vitrine libera no aviso de autorização, não na cobrança.** O webhook
`subscription_preapproval` chegando com `authorized` é só "o cartão foi
aceito" — a primeira cobrança de verdade só sai `DIAS_TESTE_GRATIS`
depois. Se a vitrine esperasse a cobrança, o teste grátis não seria
grátis coisa nenhuma: a pessoa pagaria para só então aparecer. Por isso
`confirmarAssinatura` concede `DIAS_TESTE_GRATIS` de mensalidade **na
primeira vez** que a assinatura vira `ativa` — checado comparando o
status antes e depois de `definirStatusAssinatura`, porque uma
reautorização depois de `pausada` (cartão recusado, arrumado depois) não
é um teste novo. Sem essa guarda, cada soluço de cartão devolveria mais
dias de graça.

**A ativação redireciona para `/perfil/assinatura`, não para `/perfil`.**
Sem carência, ir para o perfil deixaria a pessoa sem saber que falta um
passo — o perfil existe, mas não aparece em lugar nenhum até o cartão ser
autorizado.

**O buraco que sobrou, de olhos abertos:** o teste grátis (sem risco de
dinheiro) mais a devolução da primeira cobrança (com risco, até 30 dias)
somam até 45 dias de graça — uma vez por conta, porque devolução não
volta a valer numa segunda cobrança (`STATUS_LIQUIDADOS`). Menor que os
60 dias de antes, e a metade que restou não envolve dinheiro indo e
voltando; ainda assim é uma decisão consciente, não uma lacuna
despercebida.

**O teste grátis é um por conta, gravado (#392).** Ele era concedido a
cada assinatura que passava de pendente a ativa. Cancelar é terminal, então
assinar de novo criava outra assinatura e outra concessão, e nada registrava
que a pessoa já usara o dela: quem repetisse o ciclo a cada 15 dias ficava na
vitrine sem nunca pagar. Decisão do Luiz em 07/10/2026, entre três opções.

`usuarios.teste_gratis_usado_em` guarda a data, preenchida na primeira
concessão por uma instrução só (`where teste_gratis_usado_em is null`), para
duas ativações simultâneas não concederem o teste duas vezes. Quem já usou
assina **sem `free_trial`**: o Mercado Pago cobra na hora, e a assinatura
nunca concede dias de teste. A tela diz isso antes do botão — texto e rótulo
("Assinar por R$ 19,90") acompanham a situação —, porque promessa na tela é
contrato. A coluna mora em `usuarios` e não em `perfis_prestador`, que a
chave anônima lê: é informação de cobrança.

**Sem preenchimento retroativo, de propósito.** Quem tinha mensalidade antes
recebeu acesso por outro caminho — a carência sem cartão, que acabou —, não
pelo teste; marcá-las como "já usou" cobraria na hora de quem nunca viu a
regra. Cada conta existente mantém o direito a um teste. E o arquivo
`aplica-teste-gratis-usado.sql` roda **antes do deploy**: o código novo lê a
coluna ao assinar, e sem ela assinar falha.

Descartadas. *Deduzir de `mensalidade_valida_ate`* (sem coluna, sem SQL em
produção): o estorno zera a validade, então quem pediu devolução ganharia
outro teste — um ciclo a mais, já que o estorno só vale uma vez —, e a regra
ficaria implícita, dependente do que "zerar a validade" significar amanhã.
*Aceitar e acompanhar*: custo zero e sem assinante hoje, mas o dia em que
houver o primeiro o buraco já estará aberto.

**Extensão que falha devolve o teste (#406).** A reivindicação vem antes
dos dias, e é essa ordem que barra a concessão dupla. O outro lado era o
buraco da #384: se `estenderMensalidade` falhasse depois, a assinatura
ficava ativa e o teste gasto, e o reenvio do webhook não refazia nada.
Hoje `concederTesteOuDesfazer` libera o teste
(`liberarTesteGratis`) e devolve a assinatura a `pendente` antes de
subir o erro; o reenvio passa pela transição *pendente → ativa* de novo.

O que continua aberto: não sabemos se o Mercado Pago barra teste repetido
no mesmo cartão. Isso não está no nosso código.

**A vitrine só mostra quem está com a mensalidade em dia**, mesma família
de regra que `doc_verified`: o filtro mora em `getProviders`
(`subscription_valid_until > now()`), não na view `provider_listings` —
filtrar na view esconderia o prestador do próprio perfil, a mesma
armadilha do 404 que já derrubou quem tinha acabado de ativar. Por isso
`getProviderById` não filtra: os dados continuam salvos, só o anúncio
some, e reativar é assinar de novo.

## Gerador de currículo pago, sem Storage nenhum

Compra única de R$ 14,90 (`curriculo_pdf`) que libera, para sempre,
gerar e baixar o currículo em PDF — não é assinatura, não tem data de
validade para guardar, só um interruptor
(`perfis_candidato.gerador_curriculo_liberado`).

**O PDF nunca é gravado.** Todo outro arquivo do app — avatar, logo,
currículo em texto que a pessoa envia pronta — passa pelo bucket privado
com caminho fixo por pessoa (`src/server/arquivos/regras.ts`). Este é
diferente de propósito: `src/app/api/curriculo/route.ts` monta o PDF na
hora, a cada `GET`, a partir do que está salvo no perfil naquele
momento, e devolve os bytes direto — sem Storage, sem `Especie` nova, sem
o modo demonstração precisar fingir upload. A consequência é a que
importa: editar o perfil depois de comprar não exige comprar de novo, e
o download de ontem nunca fica desatualizado, porque não existe "o
download de ontem" — cada um é remontado.

**A geração em si não usa JSX.** `src/server/curriculo/gerar.ts` monta o
documento do `@react-pdf/renderer` com `React.createElement`, não com
marcação — `src/server/**` só entra na métrica de cobertura como `.ts`
(`vitest.config.mts`), e este seria o único `.tsx` da pasta. Trocar de
JSX para `createElement` manteve o arquivo dentro do que a suíte mede, em
vez de criar um ponto cego novo.

**Duas perguntas, não uma**, em `gerarCurriculoDoCandidato`
(`src/server/curriculo/servico.ts`): o papel pode chegar aqui
(`candidato:gerar_curriculo`, só `candidato_clt`) e já pagou
(`geradorCurriculoLiberado`). A capacidade sozinha deixaria qualquer
candidato gerar de graça; o pagamento sozinho não impediria outro papel
de tentar pelo id certo.

**O tipo de pagamento entrou na mesma trava de exaustividade que os
outros** — `aplicarEfeito` e `desfazerEfeitoDoTipo`, em
`src/server/pagamentos/servico.ts` — despachando para
`liberarGeradorCurriculo`/`revogarGeradorCurriculo` em
`src/server/candidatos/servico.ts`, no mesmo padrão de `estenderMensalidade`
para o prestador: `pagamentos` aciona, o domínio decide.

## O plano vira o último passo do cadastro, não uma descoberta depois

Pedido do Paulinho (#184): quem se cadastrava como prestador ou como
empresa só descobria que existia cobrança bem depois — o prestador,
abrindo `/perfil/assinatura` por conta própria; a empresa, sendo barrada
na hora de publicar a primeira vaga (a #182 já tinha dado um atalho no
perfil para isso, mas o atalho ainda vinha depois, não junto).

**Nenhuma regra de cobrança nova.** A tela que aparece depois de "Conta
criada" reaproveita `AssinarButton` (`/perfil/assinatura`) e
`ComprarButton` (`/empresa/creditos`) tal como são — os mesmos
componentes, importados por caminho absoluto de dentro de
`src/app/(auth)/cadastro/`. O clique cai exatamente na mesma server
action de sempre (`assinarMensalidade`, `comprarCreditos`), que já sabe
redirecionar para o Checkout Pro ou aprovar na hora em demonstração. A
sessão já existe nesse ponto — `cadastrarConta` chama `criarSessao` antes
de a tela renderizar —, então os componentes não recebem `usuarioId`
nenhum; leem a sessão do cookie, como qualquer outra tela do app.

**Candidato não passa por nenhuma tela de plano.** Não tem o que
escolher: quem paga é o gerador de currículo pago (#47), noutro momento
e noutra tela, não a barreira de entrada logo depois de criar a conta.

**A lista de opções de vaga saiu de `/empresa/creditos` para
`src/lib/planos-empresa.ts`.** As duas telas mostram as mesmas três
compras avulsas com o mesmo texto; antes de existir a segunda tela, uma
cópia colada seria a próxima a ficar para trás no dia em que o texto
mudasse numa e não na outra — a mesma lição do preço, que já vinha de
`PRECO_CENTAVOS` numa fonte só.

**O trial ganhou card com benefícios, não só um link "pular".** Pedido
explícito: mostrar os dois lados, não esconder a alternativa grátis atrás
de um texto pequeno.

**Na empresa, o grátis passou a vir primeiro (#299).** A #184 nasceu com
o pago em cima, destacado, e o grátis por último — e quem acabava de criar
a conta lia quatro preços seguidos como "o app já está me cobrando para
usar". O "Conta criada" era pequeno perto da lista, e a saída grátis só
aparecia depois de rolar: no celular, o que fica abaixo da dobra é o que a
pessoa não vê. Hoje a confirmação diz com todas as letras que **nada foi
cobrado**, o grátis vem logo abaixo e em destaque, e as quatro compras
viram linhas compactas, marcadas como opcionais. A tela inteira cabe num
celular comum sem rolar, e há teste e2e medindo isso.

**O prestador continua com o pago primeiro, de propósito.** Para ele,
"continuar sem assinar" não é um plano grátis: sem mensalidade ele não
aparece na busca (ver "Sem carência", acima). Pôr essa opção em destaque
seria oferecer como equivalente um caminho em que ninguém o encontra. Na
empresa, o grátis é uso de verdade — perfil no ar e busca de candidatos —
e a compra só faz sentido quando existe a primeira vaga.

**O título "Leva menos de dois minutos" some depois de a conta existir.**
Ele era renderizado pela página, acima do formulário, e continuava ali em
cima do "Conta criada" — ocupando o topo da tela e dizendo algo que já não
era verdade. Mora agora dentro de `SignUpForm`, que só o mostra antes do
envio.
