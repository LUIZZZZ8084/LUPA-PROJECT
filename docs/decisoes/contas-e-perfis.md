# Contas, papéis e perfis

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## Virar prestador troca o papel, e a pessoa é avisada

O card "Oferecer serviço" mandava para `/cadastro?tipo=prestador_servico`
— a tela de criar conta. Ninguém vê aquela home sem sessão, então isso era
pedir uma segunda conta a quem já tinha uma. Hoje leva para
`/perfil/virar-prestador`, que completa o perfil que já existe.

**A conta troca de papel, não acumula.** Decisão do Luiz em 02/09/2026,
tomada de olhos abertos sobre o custo: `candidato_clt` vira
`prestador_servico` e **deixa de poder se candidatar a vagas**. A
alternativa — papel acumulado — foi apresentada e recusada; o que ele
exigiu junto foi o aviso, e por isso ele está antes do formulário, não
depois do botão.

O que sobrevive à troca é o histórico: `candidatura:ver_propria` vale para
os dois papéis. A pessoa não se candidata mais, mas o que ela já fez
continua dela — sem isso, `/perfil/candidaturas` responderia 404 no dia
seguinte e ela concluiria que o app perdeu tudo.

**A sessão é reemitida na mesma ação.** O papel viaja dentro do JWT, com 7
dias de validade: gravar no banco sem reemitir deixaria a pessoa com as
capacidades de candidato até o token vencer — podendo se candidatar depois
de ter virado prestador, que é exatamente o que a troca encerrou.

**Voltar atrás é caso de suporte**, como a cidade e o CNPJ, e pela mesma
razão: é troca de identidade dentro da plataforma, não correção de campo.

## Avaliar um prestador: quem pode, e o que o banco garante

O painel do perfil convidava — "foi atendido por ele? sua avaliação ajuda
a próxima pessoa" — e não havia nada para clicar. A tabela `avaliacoes`
existe desde o começo, com o trigger que mantém `nota_media` e
`total_avaliacoes` do prestador, e nunca ninguém escreveu nela pela
aplicação: as linhas de hoje vieram do seed.

**Qualquer conta com sessão avalia.** Decisão do Luiz em 03/09/2026:
entrar já é pré-requisito para usar o app inteiro, então não há portão a
mais. O admin fica de fora pela regra da casa — ele enxerga tudo e não age
no lugar de ninguém, e reputação é ação com autor.

**Duas travas moram no banco, não na tela:** ninguém avalia a si mesmo
(`check`) e cada pessoa avalia uma vez (índice único parcial). A checagem
na aplicação existe para dar mensagem decente antes de tentar — dois
envios simultâneos passariam os dois por ela.

`avaliador_id` entrou por migração. Antes só havia `nome_avaliador`, texto
solto: servia para popular o seed, não para receber gente autenticada —
sem dono, a mesma pessoa avalia dez vezes e ninguém consegue mostrar a ela
a própria avaliação depois. O nome continua sendo gravado junto, porque a
tela lista sem consultar `usuarios`, que é fechada para `anon`.

**Quem assina é quem age, e o nome não muda depois (#315).** A avaliação
de uma empresa grava o nome da empresa, não o do responsável — a seção
"O nome é definido no cadastro", mais abaixo. A cópia gravada não
envelhece porque o nome deixou de ser editável; a única troca que sobrou,
a da Receita, leva junto as avaliações já feitas (`renomearAvaliacoesDe`).

**E quem exclui a conta sai do comentário (#235, #423).** A avaliação
continua no perfil do prestador — é informação dele —, com "Conta excluída"
no lugar do nome. Quem troca o nome é `excluir_conta`, o caminho do botão no
perfil; o gatilho `usuarios_anonimizam_avaliacoes` cobre o que não passa por
ela — uma linha de `usuarios` apagada à mão no banco. É o que a Política de
Privacidade promete, e a promessa vale pelos dois caminhos.

**Só se avalia quem é prestador (#439).** A chave estrangeira aponta para
`usuarios`, não para `perfis_prestador`, e o serviço não conferia: dava
para gravar avaliação na conta de um candidato, que não aparecia em lugar
nenhum até ele virar prestador — e aí passava a contar na nota dele. Hoje
o caminho com banco confere o perfil antes de gravar. Na demonstração não
há essa conferência, porque os prestadores de exemplo não estão no
repositório de contas.

**Até 3 avaliações do mesmo prestador por rede a cada 24 horas (#441).**
Decisão do Luiz em 13/10/2026. Criar conta é barato — 20 por rede a cada
15 minutos, sem confirmar e-mail —, e cada conta avalia uma vez: de uma
conexão só, um concorrente afundava a nota de alguém com uma rajada de
contas novas, e a denúncia (#435) só desfazia uma por uma, depois do
estrago. A chave é o prestador e a rede (`avaliacao-rede:<id>:<origem>`),
não quem avalia, porque cada conta falsa tem a própria sessão. O teto vem
depois de toda validação, para que um envio inválido não gaste a cota da
rede de ninguém, e a mensagem fala em "amanhã", não em segundos.

Descartadas: exigir e-mail confirmado para avaliar (atrito em quem avalia
e gasto da cota de e-mail) e deixar só com a denúncia. O que isto não
fecha: quem usa várias redes. Encarece, não impede.

**A confirmação é renderizada pelo servidor.** A action revalida a rota,
e a revalidação desmonta o formulário levando junto o "enviado" que ele
mostrava: quem avaliava via o formulário sumir, sem confirmação nenhuma.
Mesma armadilha do 404 depois de virar prestador — estado de cliente não
sobrevive à revalidação da própria rota.

## O perfil em duas abas

Desenho do Luiz em 03/09/2026: "Sobre mim" e "Serviços", com as fotos do
trabalho em grade de três por linha; o toque expande com a legenda.

**A razão de ser aba, e não mais uma seção rolando para baixo:** no
celular, o que decide a contratação são as fotos, e elas ficavam embaixo
de descrição e redes sociais — longe de quem abriu o perfil justamente
para ver trabalho.

**O dono edita dentro da própria aba.** O atalho "Meus trabalhos" no
perfil levava a uma tela separada só para isso — uma tela a mais entre a
pessoa e a foto do trabalho dela, estando ela já olhando para o lugar onde
a foto vai aparecer. O atalho saiu; sobrou "Como você aparece na busca".

**A tela separada continua, e a aba leva a ela (#333).** Ela é a única que
traz de volta um trabalho tirado do perfil — e o "Remover" do cartão
promete exatamente isso ("nada é apagado"). Com o atalho fora, a promessa
ficou sem porta por um mês: a auditoria de 29/09 achou a tela órfã e
sugeriu removê-la, e removê-la teria tornado a promessa falsa. Hoje a aba
"Serviços" do próprio perfil tem o link "Trabalhos que você tirou do
perfil ficam guardados aqui". *Antes de apagar uma tela sem link, procure
o que só ela faz.*

**Editar e remover moram dentro da própria foto, não numa lista abaixo da
grade.** A primeira versão desenhava as duas coisas: a grade de miniaturas
e, embaixo, uma lista de títulos com uma lixeira — o mesmo item duas
vezes, a segunda sem foto e sem graça nenhuma. Reclamação do Luiz em
03/09/2026, com print: "que coisa horrível é esse teste aí". A correção
foi levar editar, remover e a confirmação para dentro do card ampliado,
que é onde a pessoa já está olhando quando decide mexer.

**"Remover" pede confirmação, e a frase diz que arquiva.** Um segundo
clique sem aviso teria feito alguém tirar do ar sem querer; a frase
("nada é apagado") é a mesma garantia que já vale para arquivar em
qualquer lugar do app — só que agora repetida no lugar onde a decisão é
tomada.

**A exclusão fecha o card sozinho, e isso não veio de graça.** Um
`<form action={excluir}>` puro deixava o card aberto depois do clique: o
item saía da grade por trás — o contador de espaços já mostrava o número
novo —, mas o card ampliado guarda o próprio trabalho num estado do
componente pai, que uma revalidação não recalcula. É a mesma família de
armadilha que a troca de papel e a confirmação de avaliação já
registraram neste arquivo, só que ao contrário: em vez de um estado que
some antes da hora, um estado que sobrevive além da hora. A saída foi
`useTransition` chamando `fechar()` explicitamente depois do `await` —
fechar o que a lista já reflete, em vez de confiar que o React vai
perceber sozinho.

**"Bairros atendidos" saiu junto, e o bairro de pessoa também.** A
primeira rodada (#119) tirou a lista de bairros atendidos; a segunda
(#321, 01/10/2026) tirou o resto — ver "Bairro de pessoa não existe", na
seção sobre Mato Grosso inteiro. A localização do perfil é a cidade.

A grade e a expansão são travadas em teste de componente, não no e2e: no
modo demonstração a vitrine é estática, e o prestador criado durante o
teste não tem perfil público para visitar.

## O feed é de quem vende o próprio trabalho

Decisão do Luiz em 03/09/2026: publicar trabalho é do **prestador e do
candidato**. A empresa perdeu as três capacidades de publicação.

**Por que o candidato ganhou.** Quem faz obra, faxina ou instalação sem ter
aberto CNPJ está cadastrado como candidato — o papel mais numeroso do app.
A foto do serviço já feito é justamente o que convence quem contrata, e era
exatamente o que ela não tinha onde pôr.

**Por que a empresa perdeu.** Tinha as capacidades e nenhuma tela que as
usasse. Quem representa a empresa na busca é a logo e o cartão dela, que têm
campo próprio; o que ela publica são vagas.

Publicar trabalho **não** põe ninguém na vitrine de `/servicos`, que
continua sendo de quem ativou o perfil de prestador e teve o documento
aprovado. São coisas separadas de propósito.

**A prévia do candidato abre mesmo sem consentimento.** O perfil dele mora
em `/candidatos/[id]`, a mesma rota que a empresa usa — e é lá que ele
adiciona e remove as fotos, como o prestador faz no dele. Se a prévia
dependesse de `visivel_para_empresas`, ela responderia 404 justamente para
quem acabou de se cadastrar, já que a opção nasce desligada. Em vez disso a
tela diz, com todas as letras, que só ele vê aquilo — e oferece onde ligar.

**A busca continua fechada; o perfil, não.** `/candidatos` ganhou `exato` no
`src/proxy.ts`: a lista exige `candidato:buscar_disponiveis`, e o detalhe é
decidido por `perfilDoCandidato`, que responde `null` igual para "não
existe", "não consentiu" e "você não pode". É a mesma separação que
`/empresa` já fazia — quem decide o detalhe é a página, não o prefixo.

## O feed do prestador, e por que "remover" não apaga

O backend de publicações existia inteiro — serviço, repositório, actions,
tabela e trigger de limite — e **nenhuma tela o consumia**. O atalho do
perfil apontava para `/servicos`, a busca pública, prometendo "edite
categoria, preço e publicações": a pessoa clicava para mexer no próprio
anúncio e caía na vitrine de todo mundo. O atalho passou a levar a
`/perfil/publicacoes`, que é a tela que aquela descrição sempre prometeu
— e depois saiu do perfil, quando a publicação foi para a aba
"Serviços" (ver "O perfil em duas abas"). A tela ficou como o lugar dos
trabalhos guardados, com link a partir da aba.

Cada item é uma foto do trabalho com um texto. **Dez ativos**, o limite
que já morava no banco — mantido por decisão do Luiz em 03/09/2026,
depois de ele ter cogitado cinco.

**"Remover" arquiva, não apaga.** O texto do botão diz o que a pessoa
quer fazer; por baixo, o registro fica e volta pelo botão ao lado.
Apagar de verdade tiraria dela um trabalho que ela teve — e arquivar já
libera a vaga no feed, que é o efeito que ela procurava.

**E o guardado pode ser apagado de vez (#454).** Arquivado, o trabalho sai
do perfil, mas o arquivo continua no bucket público, acessível pelo
endereço — e às vezes a foto precisa deixar de existir: a foto errada, a
casa de um cliente que pediu para tirar. Decisão do Luiz em 13/10/2026:
"Apagar de vez", só no que já está fora do feed. Os dois passos seguram o
clique errado, a confirmação diz que não tem volta, e o servidor confere o
estado além do dono. O registro sai primeiro e o arquivo depois, pela
mesma conferência de caminho da denúncia de foto (#452); arquivo que fica
vai ao Sentry.

O cartão guardado usava `opacity-70` para parecer apagado, e a varredura
de contraste nunca o via, porque rodava com tudo no feed. Saiu a
opacidade — o selo "Fora do feed" já diz o estado —, e o e2e agora varre
a tela com um trabalho guardado aberto.

**A foto tem caminho próprio, ao contrário do avatar.** `caminhoDoArquivo`
usa caminho fixo por pessoa para avatar, logo e currículo, e é de
propósito: trocar substitui, e o bucket não vira depósito de versões
pagas. Aqui são até dez arquivos ao mesmo tempo, então a regra
`publicacao` ganha um sufixo sorteado no servidor. Continua sem nada
vindo do cliente: o id é da sessão, o sufixo é gerado aqui.

O bucket é o `portfolio`, que já existia no `storage.sql` com leitura
pública — criado para isto e nunca usado.

## O que se edita depois, e o que nunca

O cadastro pede o mínimo para a conta existir e a pessoa ser encontrada;
o resto vive em `/perfil/editar`, preenchido quando ela já viu que a
plataforma tem gente de verdade.

**O CNPJ não é editável.** É a âncora de identidade da empresa e o que
separa vaga real de anúncio falso. Poder trocar depois permitiria
cadastrar com um CNPJ válido, passar pela verificação e então virar outra
empresa. Correção é caso de suporte, com gente olhando.

**O nome também não (#315)** — nem o da pessoa, nem o da empresa. A
seção logo abaixo explica.

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

**Empresa não tem foto de perfil.** Quem representa a empresa na busca e
nas vagas é a logo, que tem campo próprio. O campo de foto pessoal
aparecia para os três papéis porque ficava fora de qualquer checagem —
a intenção de mostrar só o bloco do papel de quem entrou já estava
escrita no comentário da função, mas nunca chegou a valer para ele.

**Site, Instagram e Facebook, para empresa e prestador.** Prestador
autônomo aqui divulga mais pelo Instagram do que por site próprio, e não
tinha onde pôr. Os três são opcionais e informativos: não entram em
ranking nenhum, só dão o link para quem já decidiu olhar.

`perfis_empresa.site` existia desde o começo e **nunca apareceu em lugar
nenhum** — nem na tela pública, nem na prévia do próprio perfil. Campo
que se edita e cujo resultado ninguém vê é campo que a pessoa preenche
uma vez e conclui que não funciona.

## O nome é definido no cadastro, e a empresa assina com o dela (#315)

Pedido do Paulinho em 01/10/2026. Dois defeitos que se somavam:

- **A avaliação da empresa mostrava o responsável.** A conta de empresa
  tem dois nomes — o de quem a abriu e o da empresa —, e a avaliação
  gravava o primeiro. Quem contratou o serviço foi a empresa; o
  responsável é uma pessoa que não pediu para aparecer.
- **Todo nome se editava a qualquer hora.** Como a avaliação grava o nome
  do momento, dava para trocar de nome entre um comentário e outro e
  avaliar cada prestador com uma identidade diferente. A trava de "uma
  avaliação por pessoa" continuava valendo, mas ninguém de fora conseguia
  ligar os comentários a quem os escreveu.

**O nome da empresa — fantasia ou razão social, como ela preferir — é o
que assina tudo o que ela faz**: vaga e avaliação. O do responsável fica
como registro da conta, e a tela de edição diz que nas vagas e avaliações
quem aparece é a empresa.

**Nenhum nome se edita no perfil**, de nenhum papel. Decisão do Paulinho,
escolhendo entre travar só a empresa e travar todos: o mesmo abuso cabe
no "Nome completo" de candidato e prestador. O campo aparece desabilitado
e sem `name`, e os schemas nem conhecem a chave — um `nomeCompleto` ou
`razaoSocial` forjado no formulário é descartado pelo Zod. Correção é
caso de suporte, como a cidade e o CNPJ, e o cadastro avisa antes de a
pessoa digitar.

**A Receita continua trocando o nome da empresa (#130)**, também por
decisão do Paulinho. É a única troca que sobrou, e não é a pessoa quem
escolhe: ao conferir o CNPJ, a razão social oficial entra no lugar do que
foi digitado. Ela grava por `definirRazaoSocialDaReceita`, que só mexe no
nome, e leva junto as avaliações já feitas pela empresa — sem isso, a vaga
diria o nome oficial e o comentário da mesma empresa, o digitado.

**Isto resolve a #304 por outro caminho.** A Issue pedia que o nome no
comentário acompanhasse a troca de nome da conta, e a proposta foi um
trigger no banco (#308, fechado). Com o nome travado, não há troca para
acompanhar — exceto a da Receita, que a aplicação já trata no mesmo passo.

As avaliações que empresas fizeram antes disto passam a levar o nome da
empresa por `supabase/aplica-avaliacao-assinada-pela-empresa.sql`.

## O limite de publicações mora no banco

Trigger em `publicacoes`, não só checagem na aplicação. A aplicação também
confere, para dar mensagem decente antes de gravar — mas duas requisições
simultâneas passariam pela checagem e criariam a décima primeira. O banco é
o único lugar onde essa corrida não existe.
