# Painel do admin

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## O painel do admin responde de onde vem a conta e se o Lupa se paga (#471)

Pedido do Luiz em 15/10/2026: contas por região, separadas por papel, e,
na conversa antes, "precisamos que o Lupa se pague pelo menos o
Supabase". O painel já existia em `/admin/painel` — quem entra com a conta
de admin cai direto nele —, e o Luiz nunca o tinha visto porque usa outra
conta no dia a dia.

**Contas por estado e por cidade, cada uma com os três papéis.** Trocaram
`metricas_por_local`, que somava por cidade **e bairro** (o bairro de pessoa
saiu na #321) e não dizia o papel. O estado sai do próprio valor gravado
("Sinop - MT"); o que não tem esse formato aparece como "sem estado", em vez
de sumir. Os estados vêm todos e as cidades, as quinze maiores: a soma do
estado não pode sair das cidades recortadas.

**O funil é por papel, e a porcentagem é sobre o primeiro passo da
coluna.** Candidato: conta, visível para empresas, candidatou-se. Prestador:
conta, na vitrine (a regra de `getProviders`), assinante. Empresa: conta,
conferida, publicou vaga, comprou. "20% das empresas compraram" se lê sem
conta; a porcentagem sobre o passo anterior obrigaria a lembrar o número de
cima.

**"O Lupa já se paga?" compara a receita que se repete com o custo
mensal.** A receita é a soma das assinaturas ativas pelo valor de cada uma
— quem assinou antes de uma mudança de preço continua pagando o que
assinou —, com o teste grátis incluído. O que entrou nos últimos 30 dias
aparece à parte, pela mesma razão que o caixa separa recorrente de compra
única. Os custos são uma lista, e a receita cobre o primeiro antes do
segundo, porque a pergunta era "pelo menos o Supabase". A tela diz que o
valor é bruto, antes da taxa do Mercado Pago e do imposto.

**E os custos se editam no próprio bloco (#473).** Nasceram como constante
no código; no mesmo dia o Luiz pediu para acrescentar contador, aluguel e o
que mais vier sem depender de deploy. Moram em `custos_mensais`, fechada
para as duas chaves públicas, e só `admin:custos` lê e mexe. A lista nasce
com as estimativas do Supabase Pro e do Vercel Pro (`CUSTOS_INICIAIS`, a
mesma no `schema.sql` e no script de produção). A ordem de cobertura é a de
cadastro, pela coluna `ordem`, e não pelo `criado_em`: dois custos gravados
no mesmo instante empatariam. O valor é digitado como se escreve no Brasil
("1.234,56") e guardado em centavos; sem vírgula, "1.500" é milhar, mas
"133.50" é R$ 133,50, porque ler o ponto como milhar ali multiplicaria o
custo por cem. Depois de salvar, a tela pede as métricas de novo, e a conta
é refeita no servidor com a lista nova. O formulário é controlado e usa
`onSubmit`, sem `action` no `<form>`, para o React 19 não apagar o que foi
digitado quando o valor vem errado. Em demonstração a lista mora em
`globalThis`, porque a ação que salva e a rota que o painel consulta são
bundles diferentes.

**Conta excluída não é conta.** A linha anonimizada da #423 fica em
`usuarios`, marcada por `senha_hash = '!conta-excluida'`, e
`metricas_totais` a somava como gente; também somava a vaga vencida como
aberta. As views novas e a corrigida conferem as duas coisas, e o teste
exclui a conta pela própria `excluir_conta`, para provar que a marca que a
view lê é a que a função grava.

**As mesmas contas existem duas vezes, e um teste prova que concordam.**
O modo demonstração não tem banco, então `agregarContasPorLugar` e
`montarFunil` repetem as views em TypeScript; o `schema.test.ts` roda as
duas sobre as mesmas linhas, lidas de um Postgres de verdade. E o
`aplica-painel-admin.sql` é aplicado por cima do schema no teste: o que o
banco guarda de cada view não pode mudar, senão os dois arquivos divergem.

**A conta de admin é criada por quem vai usá-la.** `npm run admin:criar`
imprime a senha uma vez no terminal de quem roda; criá-la por um agente
poria a senha numa conversa, que é o que a #69 registra como garantia
perdida.

## Parceiros: a Lupa de graça, autorizada pelo e-mail (#505)

Pedido do Luiz em 27/10/2026: ele vai fechar parcerias com quem vai usar a
Lupa sem pagar, e precisava liberar isso pelo painel, com tempo de uso
ilimitado. A tela é `/admin/parceiros` (capacidade `admin:parceiros`): nome,
e-mail e prazo — **sem prazo** é o padrão, ou até uma data.

**O benefício mora onde o pagamento já mora.** A parceria não abre caminho
novo na vitrine, na publicação nem no painel: ela grava a validade nas mesmas
colunas que a cobrança aprovada grava — a mensalidade do prestador e o plano
de vagas da carteira, ilimitado —, e o resto do app funciona sem saber que ela
existe. A alternativa, perguntar "é parceiro?" em cada lugar que cobra, mexia
na view da vitrine, no funil do painel e na publicação, e cada lugar esquecido
seria um parceiro cobrado. **Sem prazo é a validade em 2100**
(`VALIDADE_SEM_PRAZO`, em `src/lib/parceria.ts`), e as duas telas que mostram
validade — planos da empresa e assinatura do prestador — a reconhecem por
`ehSemPrazo`, dizem "parceria" no lugar da data e não oferecem pagar.

**Tudo o que é pago fica grátis, e a matriz decide o quê:** quem publica vaga
ganha o plano ilimitado; o prestador, a mensalidade que o põe na vitrine;
quem gera currículo, o gerador.

**Só vale com o e-mail confirmado.** O cadastro não confere e-mail (#227), e
sem esta trava quem se cadastrasse antes com o endereço do parceiro levaria o
benefício dele. A concessão (`concederBeneficioDeParceiro`) roda quando o
admin autoriza — a conta pode já existir e já ter confirmado —, quando a
pessoa confirma o e-mail (`confirmarEmail`) e quando vira prestador, que é
quando ganha a vitrine para ligar. Nas duas últimas, falhar não desfaz o que a
pessoa fez: vai ao Sentry, e a próxima concessão refaz.

**Conceder de novo não estende de novo.** As funções do banco somam dias a
`max(agora, validade atual)` (#348); a parceria quer "pelo menos até tal
data", e `diasParaChegarA` traduz uma na outra — a segunda concessão pede zero
dias. Usar as mesmas funções, e não uma nova, evitou SQL de função em
produção e manteve a conta atômica num lugar só.

**Encerrar tira o que a parceria deu, e só isso.** A parceria guarda a
validade que gravou (`concedido_ate`); se a conta vale além dela, a diferença
foi paga, e fica (`aindaEDaParceria`). O gerador de currículo, compra única
sem validade, fica com quem o ganhou. O registro encerrado continua na tabela,
e o e-mail pode ganhar outra parceria — uma aberta por e-mail, garantida por
índice único parcial no banco.

**O que isto não resolve:** prova que a conta controla o e-mail, não que o
e-mail é mesmo do parceiro — o admin digita o endereço que o parceiro passou.
E a parceria com prazo não avisa ninguém quando vence: o benefício expira
sozinho, pela própria data, como uma mensalidade que não renovou.

## Testes de compra: o produto liberado sem o Mercado Pago (#516)

Pedido do Paulinho em 28/10/2026: conferir se a compra do currículo e a de
vagas funcionam sem configurar as credenciais de teste do Mercado Pago. A tela
é `/admin/testes` (capacidade `admin:testar_compras`), com um botão por
produto — o gerador de currículo, a vaga avulsa e os três planos.

**O que se testa é o que vem depois do "aprovado".** Cada botão chama
`aplicarCompraSemCobranca`, que roda o mesmo `aplicarEfeito` do webhook e da
varredura: é ele que libera o gerador, credita a vaga e grava o plano com o
limite certo. O que fica de fora é só a ida e a volta do Mercado Pago —
preferência, checkout e a confirmação —, que aqui é sempre "aprovado". O
currículo sai pelo mesmo `curriculoEmPdf` do candidato, separado de
`gerarCurriculoDoCandidato` só para tirar a checagem de papel, que o admin
não tem.

**Não grava cobrança.** O caixa soma as cobranças aprovadas (#179), e cada
teste viraria receita que não entrou. Marcar a linha como teste pediria
migração e um filtro em toda soma do painel, para guardar o que o log já
guarda (`pagamentos.testar_compra`).

**Só na conta de quem testa.** Dar produto pago a outra conta é o que a
parceria faz, com e-mail confirmado e prazo; esta porta não é atalho para
aquela. O preço, aceito: o admin não tem perfil de candidato, e
`liberarGeradorCurriculo` recusa quem não tem — com razão, numa compra de
verdade. O teste cria um perfil vazio antes de liberar, com "quero ser
encontrado" desligado, e a view `candidatos_disponiveis` só lê
`candidato_clt`, então ele não aparece em busca nenhuma. O PDF sai com o
nome, o e-mail, o telefone e a cidade do admin — o que um candidato recém
cadastrado também teria.

Os planos testados estendem a carteira do admin por 30 dias, como uma
parcela paga, sem criar assinatura: não há o que o Mercado Pago renove, e o
plano vence sozinho. A mensalidade do prestador ficou de fora porque o pedido
foi só currículo e vagas.

## A visão geral do painel, em cards (#507)

Pedido do Luiz em 27/10/2026, com um modelo de "bento" com gráficos em SVG
como inspiração — "livre para editar e remover o que achar desnecessário".
O topo do painel virou quatro cards (`visao-geral.tsx`), todos com o dado que
o polling já traz, sem consulta nova nem SQL: **receita que se repete** com o
medidor de quanto ela cobre dos custos; **contas**, com o ritmo da semana
contra a anterior e os 30 dias em ondas (quem procura acima da linha, quem
contrata abaixo); **onde estão as contas**, um mapa de área por estado
colorido pela região do IBGE, com troca de papel; e **onde o funil vaza**, um
radar da fração de cada papel que chega a cada passo, com os dois passos que
mais perdem gente escritos embaixo.

Saíram os cartões de totais e as barras de cadastros, que os cards
substituem; o resto ficou — o caixa, "O Lupa já se paga?" com a edição de
custos, o funil em números, as listas de lugares e a pressão. Do modelo
saíram também o selo do autor, as fontes buscadas no Google (a CSP não deixa,
e a Lupa tem as dela), a animação contínua das ondas — um laço de quadros num
painel que fica aberto o dia todo — e as cores fixas: as superfícies e as
cores são os tokens do tema, nos dois modos.

**As contas são funções puras** (`visao-geral-dados.ts`), testadas sem
desenhar nada, e nenhuma desenha zero como medida: sem custo cadastrado o
medidor diz "—", não "100%"; sem cadastro na semana anterior não há variação;
papel sem conta diz isso em vez de um mapa vazio. **A curva das ondas não
passa do ponto**: os pontos de controle ficam presos entre os dois pontos do
trecho, porque a linha do meio separa quem procura de quem contrata, e um
pico de candidatos desenhava um vale do lado das empresas.

**O medidor faz a conta do bloco de custos (#523).** Ele arredondava a
porcentagem e o "faltam" ao real; "O Lupa já se paga?", logo abaixo, trunca
e mostra centavos. Com R$ 179,80 contra R$ 240,00, a tela dizia 75% e "faltam
R$ 60" num card e 74% e "faltam R$ 60,20" no outro. Hoje os dois truncam e
os dois mostram centavos: arredondar também diria "100%" com a conta ainda
não paga. *Dois números para a mesma pergunta na mesma tela: a pessoa
acredita no pior e desconfia dos dois.*

## Polling, não websocket, no painel do admin

Conexão aberta em serverless exige um serviço à parte, com custo e mais uma
peça para quebrar. 15 segundos num painel que uma pessoa olha é
indistinguível de tempo real. A aba em segundo plano para de pedir.
