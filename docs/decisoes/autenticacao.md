# Autenticação, sessão e permissão

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## Autenticação própria, não Supabase Auth

Migração `0001` substituiu `auth.users` por uma tabela `usuarios` nossa.

**Ganhos:** o hash de senha é testável e auditável; o app roda em qualquer
Postgres; cadastro e login são exercitáveis sem infraestrutura, o que mantém
o modo demonstração vivo.

**Perdas.** Verificação de e-mail e recuperação de senha vinham de graça
e passaram a ter de ser construídas. A segunda foi na #174, e **a
primeira na #227** — as duas seções abaixo.

## Esqueci minha senha, e os três cuidados que a fazem segura (#174)

Até 09/09/2026, quem esquecia a senha perdia a conta — e o suporte também
não tinha o que fazer, porque não existe como trocar a senha de alguém sem
a antiga.

**A resposta é a mesma exista a conta ou não.** É a mesma regra do login,
e pela mesma razão registrada acima: a lista de quem tem conta é a lista
de quem está procurando emprego, e numa cidade do tamanho de Sinop isso
pode custar o emprego atual de alguém. A tela diz "se existe uma conta com
esse e-mail" — informa sem confirmar. O log também não recebe o endereço:
um log que reconstrói a lista desfaz o cuidado da tela.

**O token é guardado em hash, nunca em claro.** Quem lesse
`tokens_recuperacao` — um backup exposto, um acesso de leitura mal
concedido — poderia trocar a senha de qualquer conta do app. O valor
original só existe no e-mail que a pessoa recebeu.

É SHA-256, e não Argon2, de propósito: Argon2 é caro justamente para
resistir a força bruta contra senha de gente, que tem pouca entropia. Aqui
o segredo é aleatório de 256 bits — não há o que adivinhar, e o custo por
tentativa não compra nada.

**O token é gasto na mesma instrução que o valida.** As duas condições
(`usado_em is null` e `expira_em > now()`) moram no `update`, não numa
leitura anterior: dois cliques no mesmo link, ou um link vazado sendo
usado em paralelo, passariam os dois por um `select` e trocariam a senha
duas vezes. Mesma família da aprovação de pagamento e do consumo de
crédito de vaga.

**O limite é por origem, e conta toda tentativa** — como no cadastro, e ao
contrário do login. O que se contém aqui não é adivinhação de senha: é o
envio em si. Sem isso a tela vira um canal para mandar e-mail em nome da
Lupa a qualquer endereço, quantas vezes se quiser, e quem paga a
reputação do domínio somos nós.

**Trocar a senha derruba as sessões antigas (#225), e a tela diz isso.**
Este parágrafo dizia o contrário, e era verdade: sem estado no banco não
havia como invalidar um JWT antes de expirar, então quem trocava a senha
desconfiando de invasão continuava com o invasor dentro por até sete dias.
A tela avisava — honesto, e inútil para quem está sendo invadido agora.

O que mudou não foi a sessão, que continua fora do banco. Foi entrar uma
data por pessoa, `usuarios.sessoes_validas_desde`, que corta todo token
emitido antes dela. Detalhes na seção "Sessão em JWT, não em banco", logo
abaixo.

**A revogação mora no `update` da senha**, e não numa chamada à parte.
`atualizarSenhaHash` grava as duas coisas na mesma instrução, porque um
segundo passo é o que alguém esquece no terceiro caminho de troca de
senha — o defeito exato da #142, onde `virarPrestador` e `cadastrar`
produziam o mesmo tipo de conta e só uma tinha a regra.

A sessão nova continua sendo emitida para quem acabou de trocar, e agora
a **ordem importa**: o corte primeiro, a sessão depois. Invertida, a
pessoa seria deslogada do aparelho onde acabou de trocar a senha.

**Sem provedor de e-mail, o recurso não existe e a tela explica.** Mesma
degradação do Storage sem Supabase e do push sem VAPID. Fingir que enviou
deixaria a pessoa esperando um e-mail que nunca sai, e concluindo que a
conta sumiu. `RESEND_API_KEY` e `EMAIL_REMETENTE` são o que liga —
nenhuma das duas leva prefixo `NEXT_PUBLIC_`.

**E com provedor, a falha chega ao Sentry (#326).** Até 05/10/2026 quem
chamava `enviarEmail` registrava a falha como `warn`, e `warn` não sai da
Vercel. O plano grátis do Resend manda no máximo 100 e-mails por dia: num
dia de lançamento, confirmação e recuperação podiam parar de sair sem
ninguém saber, até alguém não conseguir entrar. Hoje a própria
`enviarEmail` registra por `log.erro` com `indisponivel` — o caminho que
vai ao Sentry —, com o fluxo e o status, e o 429 diz que é cota. **Sem o
endereço e sem o corpo da resposta do Resend**, que pode ecoar o
destinatário: a regra do log de recuperação vale em dobro no momento em
que mais se lê log.

**E a cota do dia é dividida (#407).** Os 100 e-mails por dia do Resend
são uma cota só para o app inteiro, e o limite de 5 em 15 minutos por
origem deixava um mesmo IP mandar 480 por dia. Hoje há tetos diários por
cima dele, em `src/server/auth/cota-de-email.ts`: por origem, **separado
por fluxo** (20 confirmações e 10 recuperações), e por conta de destino. O
da origem conta todo pedido, exista a conta ou não — contando só os que
enviam, o bloqueio chegaria mais cedo para quem testa e-mails com conta, e
diria quais têm. O da conta, na recuperação, não muda a resposta: passa do
teto, não envia, e responde o mesmo "se existe uma conta". Na confirmação a
pessoa tem sessão, e a tela diz que passou da cota. Nos dois casos nenhum
token novo é emitido, e o último link enviado continua valendo.

**A cota é de quem recebe, e quem pede não pode gastá-la toda.** A
primeira versão contava 5 por conta, de qualquer lugar: cinco pedidos com o
e-mail de alguém deixavam essa pessoa um dia sem recuperar a senha, lendo
"enviamos" sem receber nada. Hoje são 3 por conta **e** origem, e 10 por
conta somando as origens — o par vem antes, então o que passa dele não
gasta o total. Travar a caixa de alguém de propósito passa a pedir quatro
origens. E os dois fluxos não dividem o balde da origem porque um IP de
operadora móvel, num dia de divulgação, gastava a cota com confirmações de
cadastro, e a recuperação passava a recusar quem nunca tinha pedido nada.
*Teto que protege uma pessoa não pode ser gasto por outra: confira quem
paga a conta antes de escolher a chave.*

O bloqueio dura até a janela vencer, contada do primeiro pedido, porque
quem decide é só `consumirOrcamento`. Conferir antes, como o login faz,
seria pior aqui: `conferirLimite` lê `bloqueado_ate`, que cada pedido
acima do teto empurra para frente.

Para a janela de um dia existir, o banco precisou guardar a janela de cada
chave (`tentativas_de_acesso.janela_segundos`): a limpeza apagava toda
linha com mais de uma hora que não estivesse bloqueada, e o contador
diário recomeçava do zero. *Quando um mecanismo ganha uma janela mais
longa, confira quem apaga as linhas dele.*

**Mas a cota avisa uma vez por janela, não a cada e-mail (#417).** Cota
estourada é o mesmo fato repetido em todo cadastro dali em diante, e cada
repetição virava um evento: um dia de lançamento acima dos 100 do Resend
gastava a cota do Sentry, e o erro de pagamento que viesse depois não
chegava a ninguém. O primeiro 429 vai ao Sentry; os seguintes, por 15
minutos, ficam no log comum. É por instância — cada função fria avisa de
novo —, e basta: o que importa é saber, não contar. O que não é cota
continua indo toda vez, porque cada um é um defeito. *Alarme que dispara a
cada repetição do mesmo fato gasta o canal por onde chegaria o próximo
fato.*

**O token na URL não vai ao Sentry (#360).** O link leva o token na
query, e a URL entra no evento (`request.url`, `query_string`, atributos
de span). A máscara por nome de chave não alcançava: a chave ali é `url`,
e o segredo está dentro do valor. Hoje `scrubSensitiveData` também mascara
`token=`, `senha=` e parecidos dentro de qualquer texto. O token é de uso
único e vale uma hora, o que limita o dano, mas um evento que sai com ele
é uma credencial num serviço de terceiro.

**O e-mail é texto puro, sem HTML.** O público daqui abre e-mail no
celular, e template com imagem e botão colorido é o formato que os
provedores mais pontuam como promoção — justamente o e-mail que precisa
chegar na caixa de entrada, e rápido.

**E o nome de quem se cadastrou não entra cru nele (#445).** A saudação
cortava o nome no espaço comum e levava o resto como veio. Com outro
espaço Unicode entre as palavras, uma frase inteira com link cabia ali, e
como a conta pode ser criada com o e-mail de outra pessoa — a confirmação
sai sozinha no cadastro —, a Lupa entregava o texto de um estranho, com o
remetente dela, na caixa de quem não pediu nada. Hoje `saudacao`
(`src/server/email/saudacao.ts`) leva só o primeiro nome, só letras,
apóstrofo e hífen, com teto; sem nada aproveitável, "Olá.". Mora no
e-mail, e não só no cadastro, para valer também para as contas que já
existem. O cadastro, por sua vez, normaliza espaços e recusa caractere de
controle e invisível no nome (`zNome`). *Texto que sai com o nome da Lupa
não leva nada que um estranho escreveu sem passar por um filtro de
saída.*

## Confirmar o e-mail, e o que isso resolve de verdade (#227)

`usuarios.email_verificado` existia desde o começo, era lido pelos
repositórios, e **nada nunca escreveu nele**. É a armadilha que este
arquivo já registra três vezes: estado declarado sem produtor — parece
tratado, e o teste que existe passa, porque ninguém escreveu o caso que
nunca acontece.

**O dano foi medido antes de a solução ser dimensionada**, e vale registrar
porque a resposta encolheu o escopo:

- **Não é spam.** O único e-mail que a Lupa manda é o de recuperação de
  senha, e ele só sai quando alguém digita aquele endereço em "esqueci
  minha senha". Endereço não confirmado não recebe nada que ninguém pediu.
- **Não é tomar conta alheia.** Quem se cadastra com o e-mail de outra
  pessoa fica com uma conta sob um endereço que não controla — e o dono de
  verdade a retoma pela recuperação, que cai na caixa dele.
- **É o erro de digitação.** Quem erra o próprio e-mail fica com uma conta
  que **não tem como ser recuperada**, e descobre no dia em que esquecer a
  senha. Nesse dia não há suporte possível: não existe como provar que a
  conta é dele, nem como trocar a senha de alguém sem a antiga.

**Por isso não bloqueia nada.** Nem login, nem candidatar-se, nem publicar.
Bloquear puniria as contas que já existem por uma verificação que não
existia quando foram criadas, e puniria quem procura emprego por causa de
um provedor de e-mail fora do ar. O valor está em a conta ser recuperável,
não em barrar. *Quando a proteção não é contra um atacante, e sim contra
um engano, ela informa — não fecha a porta.*

**O token é o mesmo material da recuperação, na mesma tabela** — segredo
aleatório, guardado em hash, uso único, com prazo. Tabela gêmea divergiria
na primeira vez que alguém mexesse num lado só.

**O que ele não pode ser é um token que serve para as duas coisas.** O de
verificação sai com muito mais liberdade — no cadastro e a cada
"reenviar" —, e se ele também redefinisse senha, cada reenvio seria mais um
link de redefinição circulando, sem a pessoa ter pedido nenhum. Por isso
`finalidade` entra na **instrução que consome** o token, junto do hash, e
não numa checagem antes: é a mesma família de corrida que a aprovação de
pagamento e o consumo de crédito de vaga já resolvem assim.

**O prazo é de 24 horas, e não de uma como na recuperação.** Os dois links
respondem a urgências diferentes: quem pede para redefinir a senha está com
o navegador aberto agora, e o prazo curto limita a janela de um link
vazado. A confirmação chega junto com o cadastro, e é comum a pessoa
terminar no celular e só abrir a caixa de entrada à noite — uma hora
transformaria o link num link morto, e quem clicasse concluiria que o app
está quebrado.

**O envio sai por `after()`**, depois da resposta, como o aviso de vaga e o
registro de visualização. Quem acabou de se cadastrar quer entrar no app; e
nenhum provedor de terceiro pode decidir se alguém consegue criar conta
aqui — a mesma razão que mantém a lista de municípios versionada em vez de
buscada no IBGE em execução.

**Um token vivo por pessoa e finalidade (#398).** Emitir um token apaga os
anteriores, em `criarTokenDeRecuperacao`, nos dois repositórios. Quem pede
outro link é porque o primeiro se perdeu, ou foi parar onde não devia: o de
recuperação de uma hora atrás não pode continuar trocando a senha. Até a
#419 eles eram marcados como usados e ficavam na tabela para sempre;
apagando, ela guarda no máximo um por pessoa e finalidade, sem rotina de
limpeza.

**Abrir o link não confirma nada (#398).** A página mostra um botão, e só
a action gasta o token. Filtro de e-mail corporativo e prévia de link
abrem os endereços da mensagem antes da pessoa, e com o consumo na
renderização o primeiro deles gastava o token — quem clicava depois lia
"Este link não vale mais". Esta seção já defendeu o contrário ("pedir mais
um clique seria cerimônia"), e estava errada sobre quem abre o link.

**A tela de confirmação é aberta**, em `(auth)`, e isso não é descuido: a
pessoa quase sempre clica no link do celular, que pode não ser o aparelho
onde ela está logada. Exigir sessão mandaria quem confirmou para um login —
e o token, que é de uso único, já teria sido gasto ou nem chegaria a ser
lido.

**O perfil só mostra o aviso para quem não confirmou.** Selo verde
permanente seria ruído: a pessoa não tem o que fazer com ele. É a mesma
lição do selo de telefone, que saiu na #209 por dizer a mesma coisa para
sempre — e o texto não dramatiza, porque nada deixa de funcionar sem a
confirmação. *Aviso que exagera ensina a ignorar aviso.*

## Argon2id com parâmetros da OWASP

19 MiB, `t=2`, `p=1`. Dimensionados para caber na memória de uma função
serverless — parâmetro que derruba a função em produção não protege
ninguém. `precisaRehash()` permite subir o custo depois sem pedir troca de
senha a ninguém — e sem derrubar os outros aparelhos de quem entra: a
regravação vai por `regravarHash`, que não corta sessão, e não por
`atualizarSenhaHash`, que corta (#330). A senha é a mesma; ninguém está
sendo expulso.

## Senha de 6 caracteres, e o número num lugar só (#290)

O servidor exigia 10 caracteres desde 20/08, e as duas telas que pedem
senha diziam 8 desde 22/08. Durante um mês, quem seguia a dica levava
erro, e o formulário ainda apagava tudo (#291). **Decisão do Luiz em
25/09/2026: o mínimo é 6.** Dez era demais para quem digita no celular.

O NIST recomenda 8, e isso fica registrado de olhos abertos. O que segura
a senha curta aqui é o resto da proteção: limite de tentativas de login
por e-mail, Argon2id no hash e a mesma resposta de login exista a conta ou
não. Continua sem regra de composição.

**O número mora em `SENHA_MINIMA`, em `src/lib/constants.ts`**, e dali o
leem o schema do servidor, as dicas das telas e o `minLength` dos campos.
A divergência de um mês foi possível porque a regra morava no servidor e a
dica era texto solto na tela. *Número que aparece na tela e é cobrado no
servidor precisa vir da mesma constante.*

## Sessão em JWT, não em banco

Serverless não tem processo de longa duração, e cada consulta a mais é
latência para quem está em 3G. O payload carrega **só id e papel** —
cookie é legível por quem tem o aparelho.

**Sete dias sem abrir o app, ou trinta desde o login (#323).** Cada token
vale 7 dias, e o `proxy.ts` o renova em silêncio quando ele passa de um
dia — então os 7 dias funcionam como janela de inatividade. Mas nenhuma
sessão passa de 30 dias desde o login, renovada ou não, e aí a pessoa
entra de novo.

**Esta frase dizia "renovação silenciosa faltando 2", e era falsa.**
`renovarSeNecessario` existia desde 20/08 e nada a chamava: todo mundo era
deslogado aos 7 dias, usando o app todo dia ou não. O teste que havia
testava a função, não o lugar que deveria chamá-la. E o limiar de dois
dias também não servia: quem abrisse o app a cada quatro dias chegava no
quarto com três faltando, não renovava, e no oitavo estava fora. Achado na
auditoria de 29/09. *Função que existe e ninguém chama é a versão de
código do estado sem produtor: o teste dela passa, porque ninguém
escreveu o teste de quem devia chamá-la.*

**A renovação preserva o `iat` do login**, e é isso que a torna segura no
proxy, que não tem banco para conferir a revogação. A revogação compara o
`iat` com o corte de quem trocou a senha; um token renovado com `iat` de
agora nasceria depois do corte e escaparia dele — o ladrão do cookie
renovaria a própria sessão para sempre. Com o `iat` do login, o token
revogado continua revogado depois de renovado.

**Só em GET.** Entrar, sair, virar prestador e trocar a senha gravam o
cookie em server action, que é POST. Renovar na mesma resposta poria dois
`Set-Cookie` com o mesmo nome, e o que valesse por último decidiria —
podendo desfazer a troca de papel, ou deslogar quem acabou de trocar a
senha. Navegação é GET, e renovar só nela não perde nada.

**O preço de não revogar deixou de ser total (#225).** Era: token válido
por até uma semana, sem volta, mesmo depois de a pessoa trocar a senha
desconfiando de invasão. Hoje `usuarios.sessoes_validas_desde` marca um
corte por pessoa, e `sessaoAtual()` descarta token emitido antes dele.

**E isto não é "sessão no banco", que é a alternativa que se recusou.**
Sessão no banco significa perguntar, a cada requisição, se aquela sessão
vale — uma consulta por navegação, para todo mundo, o tempo todo. Aqui a
pergunta é outra: o app lê a lista de **quem cortou nos últimos 30 dias** e
a guarda em cache por 60 segundos. No caminho comum não há consulta
nenhuma.

A lista é curta por construção e **não cresce com o tempo**: nenhuma
sessão vive mais de 30 dias desde o login, então quem trocou a senha há
mais tempo que isso sai dela. Ela cresce com o número de trocas de senha
do último mês — num app de 30 contas, é quase sempre vazia. **O alcance
da lista e a vida máxima da sessão são o mesmo número**: `revogacao.ts` o
lê de `CONFIG_SESSAO.DURACAO_MAXIMA_SEGUNDOS`. Eram 7 e 7 até a #323; com
a renovação, uma lista que olhasse só 7 dias deixaria o corte sumir antes
de o token renovado morrer. *Quando revogar exige
estado, procure o estado que responde a todos de uma vez, não o que
responde a um por requisição.*

O preço novo, aceito: uma sessão revogada pode sobreviver até 60 segundos.

**E o corte tem botão próprio (#402).** "Sair dos outros aparelhos", no
perfil, grava o mesmo corte sem trocar a senha — para quem esqueceu a conta
aberta numa lan house e não desconfia de que alguém saiba a senha. A ordem
é a da troca de senha: corte, cache derrubado, sessão nova para o aparelho
onde se clicou. O outro aparelho não é mandado para `/entrar`: o proxy só
vê que há cookie, e é a página, por `sessaoAtual()`, que o trata como
deslogado.

**Reemitir sem senha não recomeça os trinta dias (#413).** A sessão nova
desse botão precisa de `iat` novo — é o que a tira do corte gravado no
mesmo clique —, e o teto contava do `iat`. Sem pedir senha, repetir o
clique a cada poucas semanas mantinha o mesmo cookie vivo para sempre,
que é o que o teto existe para impedir. Hoje o token guarda o login à
parte (`lg`, lido como `Sessao.entrouEm`) sempre que ele difere do `iat`,
e o teto conta dali; a renovação do proxy e a troca de papel o preservam.
Quem prova a senha — entrar, cadastrar, redefinir — começa a contagem de
novo. Token sem `lg` conta do `iat`, como sempre contou. *Dois relógios
num token só: o que a revogação compara e o que o teto conta não precisam
ser o mesmo, e confundi-los é o que fazia um dos dois mentir.*

**A lista tem teto próprio, e o teto avisa (#352).** Ela lia com o teto
genérico das listas do dono, 200, sem ordem. Passando disso, quem ficou
de fora era lido como "não revogado" — o erro silencioso de sempre. Hoje
`TETO_DE_CORTES_DE_SESSAO` (5.000) é só contra crescimento sem fim, a
consulta vem do corte mais novo para o mais velho, e atingir o teto
registra erro no Sentry: passar dele pede paginar, não subir o número.

**Trocar o papel também corta (#352).** O papel viaja no token, e
`atualizarPapel` não gravava o corte: quem virava prestador ficava com o
cookie de candidato válido nos outros aparelhos até vencer. Agora o corte
vai na mesma instrução da troca, e a ação derruba o cache de revogações
antes de reemitir a sessão — a ordem de sempre, o corte primeiro.

**A leitura falha aberta**, e é o oposto do webhook de pagamento, de
propósito. Lá, deixar passar confirmaria dinheiro que ninguém provou;
aqui, recusar derrubaria **todo mundo** do app por causa de uma consulta
que não respondeu. Errar para o lado permissivo custa uma janela a mais
numa revogação; errar para o fechado é o app inteiro fora do ar.

**A checagem mora em `sessaoAtual()`, não no `proxy.ts`.** O proxy roda no
runtime de borda, sem banco e sem o cache de dados do Next. E não faz
falta: toda rota que decide alguma coisa sobre uma pessoa lê a sessão por
ali — as duas que não leem, o cron e o webhook, se autenticam por segredo
e por assinatura.

**E por isso a tela sem sessão manda ao login, não ao 404 (#330).** O
muro deixa passar o token assinado mesmo depois de revogado, e as telas de
produto que contavam com ele chamavam `notFound()` quando `sessaoAtual()`
voltava `null`: quem trocou a senha num aparelho abria o outro e lia "Não
encontramos essa página". Hoje elas usam `sessaoOuEntrar(destino)`, e um
teste varre `src/app/(app)` reprovando `if (!sessao) … notFound()`. A área
administrativa fica de fora: lá o 404 vale para todo mundo.

**A comparação é estritamente `<`, e isso não é detalhe.** Corte e `iat`
são epoch de **segundos**, e a troca de senha grava um e emite o outro
quase no mesmo instante. Com `<=`, a sessão recém-emitida cairia no
próprio corte sempre que os dois caíssem no mesmo segundo — a pessoa
trocaria a senha e seria deslogada, de forma intermitente e impossível de
reproduzir.

Sem `SESSION_SECRET`, produção recusa subir. Segredo padrão versionado
significa sessão de admin forjável por qualquer um que leia o repositório.

**O token diz de qual ambiente veio, e o cookie é `__Host-` (#408).** A
audiência era `lupa-app` em todo lugar: com o mesmo segredo em preview e
produção, um token assinado num preview — que pode rodar em demonstração,
onde qualquer um cria conta — valia em produção. Hoje ela é
`lupa-app:<VERCEL_ENV>` (`local` fora da Vercel). E o cookie se chama
`__Host-lupa_sessao` em produção: o navegador só aceita esse nome com
`Secure`, `Path=/` e sem `Domain`, então nenhum subdomínio nem resposta em
http grava uma sessão por cima da da pessoa. Fora de produção o nome fica
sem prefixo, porque o cookie não é `Secure` e o navegador o recusaria. O
custo, aceito em 09/10/2026: todo mundo entrou de novo uma vez.

**Até a #271 esta frase era falsa.** A recusa morava só em `segredo()`,
que roda quando alguém lê ou assina uma sessão — e `lerSessao` a chama
dentro de um `try` que devolve `null`. Sem a variável o site subia, todo
mundo aparecia deslogado e o login dava erro interno, sem nada vermelho.
Hoje quem recusa é `conferirConfiguracaoDeProducao()`, na subida, com o
mesmo mínimo de 32 caracteres. Achado ao trocar a variável para o tipo
Secret na Vercel, em 23/09/2026 — e eu tinha acabado de repetir a frase ao
Luiz sem abrir o código. *Afirmação sobre modo de falha se confere no
caminho que falha, não no comentário que o descreve.*

## RBAC como matriz declarativa

`src/server/auth/rbac.ts` é a fonte da verdade e cabe numa tela. Permissão
espalhada em `if` é como se descobre, meses depois, que uma empresa vê a
candidatura de outra.

**O admin enxerga tudo, e não age no lugar de ninguém.** Quem administra a
ferramenta é o responsável por ela e precisa alcançar o que existe lá
dentro para dar suporte — painel, métricas, fila de verificação, lista de
candidatos disponíveis. Decisão do Luiz em 31/08/2026, que afrouxou de
propósito o corte anterior, mais fechado.

O que continua fora é **escrita com dono**: se candidatar, mover a
candidatura de uma empresa, publicar ou encerrar a vaga dela. A razão não é
desconfiar de quem administra — é que essas ações têm autor, e uma vaga
publicada por um acesso comprometido não deixa rastro de que não foi a
empresa. Quando for preciso agir como outro papel, que seja por
personificação registrada em log, onde a ação continua tendo dono.

**O admin tem a empresa dele, e só a dele (#499).** Pedido do Luiz em
27/10/2026: a conta de administração abre `/empresa` — painel, planos e
vagas, quem já se candidatou, publicar vaga — para olhar a área de
contratação inteira com a conta que ele usa. Antes, o admin tocava em
"Empresa" e lia "Sua conta ainda não contrata", e as telas de dentro
respondiam 404. São as cinco capacidades de contratar na matriz, e a área
dele é a da empresa (`areaDoPapel`); a visão geral da Lupa continua sendo o
`/admin/painel`, e o menu da conta dele ganhou os dois atalhos.

**O que mantém de pé a regra de cima é `exigirDono` sem o atalho do admin.**
Ele passava por ali em qualquer registro, e era inofensivo enquanto nenhuma
capacidade de escrita com dono era dele. Com a empresa própria, o atalho
viraria a porta para encerrar, reativar — gastando o saldo do admin — e
mover candidatura de qualquer empresa, só trocando o id. Hoje o admin
alcança o registro que é dele e lê "não encontrado" no resto, como qualquer
empresa. A leitura que ele tem de tudo vem das capacidades `admin:*`, não
desta função.

**O painel abre completo mesmo sem perfil de empresa.** A conta do admin é
criada por script, sem o perfil, que nasce na primeira vaga que ele publica
(`garantirPerfilDeContratante`, a mesma passada do prestador). O estado
vazio dessa tela esconde os planos e os atalhos, e o pedido era justamente
olhar tudo; então o painel monta a empresa com o nome da conta, sem gravar
nada. É exceção do admin: conta de empresa sem perfil continua lendo o erro,
porque para ela é estado quebrado de verdade.

**Admin que publica vaga publica para o público.** Não há "vaga de teste"
escondida: ela entra na busca como qualquer outra e gasta o saldo do admin.
Quem quiser olhar sem publicar tem o painel, os planos e o formulário.

**Não há senha de admin no repositório, e nunca houve.**
`scripts/criar-admin.mjs` lê `ADMIN_SENHA` do ambiente ou gera uma senha
forte e a imprime uma única vez. Este parágrafo já afirmou o contrário —
que existia uma "senha padrão" e que o alcance do admin era o de quem
lesse o repositório. Era falso, e foi escrito sem abrir o script.

O que a [#69](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/69)
trata é outra coisa: duas senhas de admin passaram por conversa de chat
em 25/08/2026. Não há indício de vazamento — o que se perdeu foi a
garantia. Trocar é higiene, e o Luiz decidiu em 01/09 que não é urgente,
porque só ele e o Paulinho operam a conta.

**Duas perguntas em cada operação:** o papel pode fazer isto
(`exigirCapacidade`) e este registro é desta pessoa (`exigirDono`). Só a
primeira deixaria qualquer empresa autenticada alcançar a vaga de outra
trocando o id na URL.

**Server action exportada é endpoint, e o muro não a guarda (#360).**
`decideVerification` mora em `/admin` e não conferia quem chamava: o
`proxy.ts` guarda a rota, não a chamada. Em produção ela não alcançava
nada — usa a chave anônima, e a tabela está fechada para ela —, mas era
a única ação que mudava dado sem checar a capacidade, e ficava a uma
mudança de chave de ser a porta aberta. Hoje confere `admin:decidir_verificacao`
antes de abrir qualquer cliente de banco. *Toda action confere a
capacidade dentro dela, mesmo quando "só o admin vê a tela".*

**E ela usa a chave de serviço (#419).** Usava o cliente da chave
anônima, que não lê `pedidos_verificacao` nem grava em `usuarios`: toda
decisão respondia "Pedido não encontrado", e ninguém viu porque nenhum
pedido chegou à fila. A página que lista a fila já lia com a chave de
serviço — a ação ao lado ficou para trás. Falha ao apagar documento e
selfie, que é a obrigação de retenção, vai ao Sentry sem os caminhos.
*Leitura e escrita da mesma tabela, em arquivos vizinhos, precisam da
mesma chave; conferir uma não confere a outra.*

## 404 em vez de 403 quando faz sentido

Registro de outro dono e área administrativa respondem "não encontrado". Um
403 confirma que o recurso existe — informação de graça para quem sonda ids
ou procura o painel de admin.

**E o `robots.txt` não a anuncia (#439).** Ele listava `/admin` entre as
áreas bloqueadas — o arquivo mais público do site dizendo o que o 404
existe para não dizer. Nenhum crawler chega lá sem sessão de qualquer
forma: o muro do login responde antes.

## Enumeração de contas

O cadastro avisa que o e-mail já existe; o login, não. No cadastro o aviso é
necessário, senão a pessoa tenta de novo sem entender. No login, o mesmo
aviso seria uma lista de quem tem conta — que aqui significa **quem está
procurando emprego**, informação que pode custar o emprego atual de alguém.
O tempo de resposta também é igualado (`gastarTempoDeVerificacao`).

**O cadastro revela o conflito, e o volume de conflitos tem teto (#390).**
A revelação do e-mail é decisão antiga; CPF e CNPJ vão na mesma linha: a
pessoa que esqueceu que tinha conta precisa saber qual dado bateu. O que
faltava era limite: o de criação (`cadastro:<origem>`, 5 por 15 minutos)
só soma conta criada, e quem testa se um dado está cadastrado precisa de
volume, não de contas. Decisão do Luiz em 07/10/2026, entre quatro opções:
conflito de e-mail, CPF ou CNPJ conta num teto próprio por origem
(`cadastro-conflito:<origem>`, 10 por 15 minutos). Passado o teto a resposta
é "muitas tentativas" em vez do conflito, e origem já bloqueada é recusada
**antes** de qualquer consulta — senão continuaria perguntando e sendo
respondida. Quem cria conta com sucesso não gasta esse teto.

Recusadas, e por quê. *Mensagem única para CPF e CNPJ:* não esconde nada,
porque quem varia só o documento sabe qual bateu, e piora a mensagem para
quem só esqueceu. *Confirmar por e-mail antes de criar, com resposta
igual:* fecha a enumeração de verdade, mas o cadastro deixa de ser
imediato, passa a depender do provedor de e-mail (100 por dia no plano
grátis do Resend) e contradiz a decisão de que o e-mail não bloqueia nada
(#227) — reconsiderar só se o problema aparecer medido.

O que este teto **não** faz: não impede quem usa muitos IPs, só encarece, e
não resolve o CPF ser conferido só pelo dígito — qualquer CPF válido pode
ser ocupado por quem não é o dono, e a correção disso é a verificação paga
da #120. A chave aparece como linha própria no painel de pressão (a view
agrupa pelo texto antes do primeiro `:`), sem mudança de SQL.
