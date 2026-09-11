# Lupa — notas para agentes

Plataforma hiperlocal de emprego e serviços. Cidade-piloto: Sinop-MT.
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
node scripts/gerar-cidades.mjs    # baixa a lista de municípios de MT (IBGE)
node scripts/gerar-regioes.mjs    # baixa a região de cada município (IBGE)
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
  entra.
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

## Decisões de arquitetura, com o porquê

### Virar prestador troca o papel, e a pessoa é avisada

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

### Avaliar um prestador: quem pode, e o que o banco garante

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
tela lista sem consultar `usuarios`, que é fechada para `anon` — e porque
a avaliação é o registro do que aconteceu naquele dia.

**A confirmação é renderizada pelo servidor.** A action revalida a rota,
e a revalidação desmonta o formulário levando junto o "enviado" que ele
mostrava: quem avaliava via o formulário sumir, sem confirmação nenhuma.
Mesma armadilha do 404 depois de virar prestador — estado de cliente não
sobrevive à revalidação da própria rota.

### O perfil em duas abas, e o bairro que sobrou

Desenho do Luiz em 03/09/2026: "Sobre mim" e "Serviços", com as fotos do
trabalho em grade de três por linha; o toque expande com a legenda.

**A razão de ser aba, e não mais uma seção rolando para baixo:** no
celular, o que decide a contratação são as fotos, e elas ficavam embaixo
de descrição, bairros e redes sociais — longe de quem abriu o perfil
justamente para ver trabalho.

**O dono edita dentro da própria aba.** O atalho "Meus trabalhos" no
perfil levava a uma tela separada só para isso — uma tela a mais entre a
pessoa e a foto do trabalho dela, estando ela já olhando para o lugar onde
a foto vai aparecer. O atalho saiu; sobrou "Como você aparece na busca".

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

**"Bairros atendidos" saiu junto.** Era lista curada por cidade, e não
existe lista pronta de bairro para os 142 municípios de MT — a mesma razão
que já tinha derrubado o enum de bairro antes. O bairro que vale é o que a
pessoa informou no cadastro, e ele já aparece na linha de localização.

A grade e a expansão são travadas em teste de componente, não no e2e: no
modo demonstração a vitrine é estática, e o prestador criado durante o
teste não tem perfil público para visitar.

### O feed é de quem vende o próprio trabalho

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

### O feed do prestador, e por que "remover" não apaga

O backend de publicações existia inteiro — serviço, repositório, actions,
tabela e trigger de limite — e **nenhuma tela o consumia**. O atalho do
perfil apontava para `/servicos`, a busca pública, prometendo "edite
categoria, preço e publicações": a pessoa clicava para mexer no próprio
anúncio e caía na vitrine de todo mundo. Hoje o atalho leva a
`/perfil/publicacoes`, que é a tela que aquela descrição sempre prometeu.

Cada item é uma foto do trabalho com um texto. **Dez ativos**, o limite
que já morava no banco — mantido por decisão do Luiz em 03/09/2026,
depois de ele ter cogitado cinco.

**"Remover" arquiva, não apaga.** O texto do botão diz o que a pessoa
quer fazer; por baixo, o registro fica e volta pelo botão ao lado.
Apagar de verdade tiraria dela um trabalho que ela teve — e arquivar já
libera a vaga no feed, que é o efeito que ela procurava.

**A foto tem caminho próprio, ao contrário do avatar.** `caminhoDoArquivo`
usa caminho fixo por pessoa para avatar, logo e currículo, e é de
propósito: trocar substitui, e o bucket não vira depósito de versões
pagas. Aqui são até dez arquivos ao mesmo tempo, então a regra
`publicacao` ganha um sufixo sorteado no servidor. Continua sem nada
vindo do cliente: o id é da sessão, o sufixo é gerado aqui.

O bucket é o `portfolio`, que já existia no `storage.sql` com leitura
pública — criado para isto e nunca usado.

### A aba Empresa deixou de ser só de PJ

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

### Duas portas para contratar, uma implementação só (#189)

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
mesma estrutura. A visualização de candidatos (`/candidatos`) continua
sendo **a mesma para os dois** — já era, e não muda.

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

### O CNPJ é conferido na Receita, e o que isso prova

O cadastro validava o CNPJ por **dígito verificador**, o que prova que o
número é bem formado — não que a empresa existe. E não era hipótese:
`11222333000181`, o exemplo da nossa própria suíte, passa no dígito e é uma
empresa real no Rio Grande do Sul. Qualquer número inventado com o dígito
certo chegava à fila do admin como se fosse empresa.

Hoje a empresa aperta um botão no perfil e a Lupa consulta a BrasilAPI
(pública, sem credencial e sem custo). Batendo as três condições — existe,
situação **ATIVA**, razão social igual à da Receita —, ela é verificada na
hora, sem fila.

**O que isso prova:** a empresa existe e está ativa. É o que mata o anúncio
de empresa inventada, o risco concreto por trás do CNPJ obrigatório.

**O que isso não prova:** que quem se cadastrou é dono dela. Razão social é
dado público, e alguém pode digitar o CNPJ de uma empresa de verdade que
não é sua. Provar posse é outro problema — e não valia travar este por
causa dele, porque até agora não se provava nem a existência.

**A consulta não entra no caminho do cadastro.** API de terceiro fora do ar
não pode impedir ninguém de criar conta — a mesma razão que faz a lista de
municípios ser versionada em vez de buscada no IBGE em execução. É ação de
quem já tem conta, e uma falha aqui não tira o CNPJ do perfil nem derruba
o que já verifica a conta.

**O prestador tem CPF, não CNPJ**, e não há consulta pública gratuita de
CPF — é a [#120](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/120),
presa a provedor pago. O que verifica o prestador é o CPF em si, válido e
único (#133) — quem também é MEI pode acrescentar o CNPJ depois, como
selo extra (#138).

**Não se compara razão social: preenche-se com a da Receita.** Decisão do
Luiz em 05/09/2026 (#130), fechando o degrau que a #127 tinha deixado em
aberto — e fechando-o para baixo, tirando a comparação em vez de somar uma
prova de posse.

Havia uma comparação tolerante a acento, caixa e pontuação, e ela existia
para pegar quem digitasse o CNPJ de uma empresa que não é sua. **Nunca
pegou ninguém, e não podia pegar:** CNPJ e razão social são os dois
públicos, então quem copia o número copia o nome junto. O que ela pegava
era quem estava certo e escreveu "Ltda." com ponto.

Hoje o nome **vem** da Receita e substitui o digitado no perfil. Erro de
digitação deixa de ser uma categoria de falha, e o nome que aparece na
vaga é o do registro — que é o que interessa a quem vai se candidatar.

A mesma lição vale duas vezes neste arquivo, e é a mesma da #140 no CNPJ
do prestador: **antes de comparar dois campos, pergunte o que a comparação
realmente pega.** Se ela só reprova quem errou a grafia, ela não é uma
verificação — é um obstáculo com aparência de rigor.

O que continua não provado é a **posse**: alguém pode digitar o CNPJ de
uma empresa alheia e sair verificado com o nome dela. Isso não piorou com
a mudança — era exatamente assim antes, só que com uma etapa a mais que
dava impressão de estar barrando algo.

### Nem todo prestador é só CPF, nem toda empresa é CNPJ

Pedido do Luiz em 03/09/2026 (#138): "alguns prestadores são PF, outros
MEI e etc", e na aba Empresa "às vezes a pessoa é um produtor rural". Duas
mudanças, cada uma reaproveitando a verificação que já existia para o
documento certo.

**Prestador ganha CNPJ opcional, além do CPF.** O CPF continua sendo a
verificação de base — obrigatório desde `c79ad63`, e é ele que libera a
busca (#133). Quem trabalha por uma empresa acrescenta o CNPJ depois, em
`/perfil/editar`, num campo e botão próprios, separados do formulário do
anúncio. Salvar e conferir cabem no mesmo clique — ao contrário do CNPJ
de empresa, que é fixo no cadastro e só *confirmável* depois, este é
editável a qualquer momento, então cada tentativa já é a chance de
corrigir o número. Uma falha não tira ninguém da busca, porque o CPF já
cobre isso: o número fica salvo, sem conferência, pronto para tentar de
novo.

**E não é só de MEI.** O primeiro desenho (#138) comparava a razão
social da Receita com o **nome da pessoa** — o que só bate para MEI,
onde a razão social registrada *é* o nome de quem abriu. Um eletricista
com "Silva Elétrica e Manutenção Ltda" era reprovado por estar certo,
que é exatamente o que este documento já condena: *verificação que
reprova quem está certo ensina todo mundo a ignorá-la*. A #140 tirou a
comparação.

**O que sobrou é divulgação, não selo de confiança.** Conferimos que o
CNPJ existe e está ativa, guardamos a razão social **que a Receita
devolveu** e mostramos esse nome ao lado do número. Quem vai contratar lê
"SILVA ELETRICA LTDA" e julga se combina com o serviço anunciado — um
número solto não informaria nada. Não prova posse, e a tela não diz que
prova.

Nada de pedir a razão social digitada: para um campo opcional, exigir que
a pessoa acerte a grafia exata do próprio registro é atrito que não se
paga, e a comparação tolerante não perdoa "Silva Elétrica" contra
"SILVA ELETRICA E MANUTENCAO LTDA".

**Empresa pode nascer com CPF em vez de CNPJ.** Produtor rural e
autônomo contratam sem ter aberto empresa — decisão já registrada na
[#129](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/129). Um rádio
no cadastro escolhe o documento; escolhendo CPF, ele é gravado em
`usuarios` (nunca em `perfis_empresa`, que a chave anônima lê) e a conta
nasce **verificada na hora**, sem chamada de rede — a mesma regra do
prestador, e sem os riscos que justificam adiar a checagem de CNPJ para
um botão à parte. A tela mostra "Pessoa física — CPF confirmado.", sem
exibir documento nenhum.

**CNPJ e razão social moram em tabelas que a chave anônima lê — de
propósito, e com o mesmo cuidado.** `perfis_prestador.cnpj`,
`perfis_prestador.razao_social` e `perfis_empresa.cnpj` podem ser
públicos porque são registro público; nenhum deles pode virar `cpf`, e o
teste de schema que varre toda tabela e view lida por `anon` continua
sendo o que garante isso.

**Um CNPJ não serve para dois perfis.** `cnpjEmUso` varre `perfis_empresa`
*e* `perfis_prestador` — o mesmo número não pode ser ao mesmo tempo o
CNPJ de uma empresa e o de outro prestador. Postgres não tem constraint
de unicidade entre tabelas diferentes; a garantia mora na camada de
aplicação, checada nos dois pontos de entrada (cadastro de empresa e o
campo de CNPJ do prestador).

### A vitrine só mostra prestador verificado

Virar prestador não coloca ninguém na busca sem verificação — só que a
verificação, desde 03/09/2026, não é mais fila de admin: é o CPF, válido
e único, confirmado na mesma ação que ativa o papel (#133). Numa
plataforma onde alguém abre a porta de casa para um desconhecido, anúncio
não conferido na vitrine é o começo do golpe.

**A fila do admin existe no banco e nunca teve porta de entrada.**
`pedidos_verificacao` e a tela de decisão em `/admin` foram construídas
para receber documento e selfie — mas nenhuma tela do app jamais teve
campo para enviar os dois. `Especie` em `src/server/arquivos/regras.ts`
só conhece `avatar`, `logo`, `curriculo` e `publicacao`; documento e
selfie nunca foram um deles. Fora da demonstração, que usa dado semeado,
todo prestador ficava para sempre atrás de uma tela que prometia "envie
documento e selfie em Editar perfil" e não levava a lugar nenhum — a
mesma classe de bug que a lista abaixo já registra duas vezes. A correção
foi trocar a promessa quebrada pelo que já era exigido de qualquer forma:
CPF válido e único vira a verificação em si, com o mesmo limite que já
vale para CNPJ — prova que o documento existe e é único, não que é de
quem digitou.

**O filtro é da busca, não da view.** `provider_listings` serve a lista e
o perfil individual; filtrar lá esconderia o prestador do próprio perfil —
a mesma armadilha do 404 que já derrubou quem acabava de ativar. Por isso
`getProviders` filtra e `getProviderById` não.

Isso é o oposto do que vale para `candidatos_disponiveis`, e de propósito:
lá o `where` mora na view porque o risco é revelar quem não consentiu —
esquecer o filtro numa tela exporia uma pessoa. Aqui o não verificado não
é segredo, é um anúncio ainda não conferido, e a tela dele diz isso com
todas as letras — para o visitante, que merece saber, e para o dono, que
de outro modo não entenderia por que não se acha na busca.

### CPF mora em `usuarios`, não em `perfis_prestador`

Parece que o lugar simétrico ao CNPJ da empresa seria `perfis_prestador`.
Não é, e a diferença não é de arrumação — é de privacidade:

- `perfis_prestador` tem policy `for select using (true)` e `grant select`
  para `anon`, a chave que vai para o navegador. Documento ali é documento
  publicado.
- `usuarios` não tem grant nenhum para `anon`: só a chave de serviço a
  alcança, e é onde já mora o hash de senha.

**E CNPJ pode ser público porque é registro público. CPF não é.** O teste
de schema recusa a coluna `cpf` em qualquer tabela ou view que `anon`
leia — foi escrito depois de eu ter posto o campo no lugar errado e o
teste ter pego.

A coluna é opcional no banco: conta criada antes do campo existir continua
funcionando, e a esmagadora maioria das contas nunca vai ter CPF, porque
não é prestador. O índice único é parcial pelo mesmo motivo — nulo não
colide com nulo. Quem ativa hoje preenche, e a tela é que exige.

### Autenticação própria, não Supabase Auth

Migração `0001` substituiu `auth.users` por uma tabela `usuarios` nossa.

**Ganhos:** o hash de senha é testável e auditável; o app roda em qualquer
Postgres; cadastro e login são exercitáveis sem infraestrutura, o que mantém
o modo demonstração vivo.

**Perdas.** Verificação de e-mail e recuperação de senha vinham de graça
e passaram a ter de ser construídas. **A segunda foi, na #174**; a
primeira continua em aberto.

### Esqueci minha senha, e os três cuidados que a fazem segura (#174)

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

**Trocar a senha não derruba as sessões antigas, e a tela diz isso.** A
sessão é um JWT de 7 dias e não há como invalidá-la antes de expirar — o
preço registrado logo abaixo, em "Sessão em JWT, não em banco". Quem está
trocando a senha porque desconfia de acesso indevido precisa saber, e o
lugar de dizer é a própria tela de troca. O que se faz é emitir uma sessão
nova para quem acabou de trocar: sem isso ela provaria quem é pelo link e
cairia num login para digitar a senha que criou trinta segundos antes.

**Sem provedor de e-mail, o recurso não existe e a tela explica.** Mesma
degradação do Storage sem Supabase e do push sem VAPID. Fingir que enviou
deixaria a pessoa esperando um e-mail que nunca sai, e concluindo que a
conta sumiu. `RESEND_API_KEY` e `EMAIL_REMETENTE` são o que liga —
nenhuma das duas leva prefixo `NEXT_PUBLIC_`.

**O e-mail é texto puro, sem HTML.** O público daqui abre e-mail no
celular, e template com imagem e botão colorido é o formato que os
provedores mais pontuam como promoção — justamente o e-mail que precisa
chegar na caixa de entrada, e rápido.

### Argon2id com parâmetros da OWASP

19 MiB, `t=2`, `p=1`. Dimensionados para caber na memória de uma função
serverless — parâmetro que derruba a função em produção não protege
ninguém. `precisaRehash()` permite subir o custo depois sem pedir troca de
senha a ninguém.

### Sessão em JWT, não em banco

Serverless não tem processo de longa duração, e cada consulta a mais é
latência para quem está em 3G. O preço é não revogar antes de expirar; por
isso a validade é de 7 dias com renovação silenciosa faltando 2. O payload
carrega **só id e papel** — cookie é legível por quem tem o aparelho.

Sem `SESSION_SECRET`, produção recusa subir. Segredo padrão versionado
significa sessão de admin forjável por qualquer um que leia o repositório.

### RBAC como matriz declarativa

`src/server/auth/rbac.ts` é a fonte da verdade e cabe numa tela. Permissão
espalhada em `if` é como se descobre, meses depois, que uma empresa vê a
candidatura de outra.

**O admin enxerga tudo, e não age no lugar de ninguém.** Quem administra a
ferramenta é o responsável por ela e precisa alcançar o que existe lá
dentro para dar suporte — painel, métricas, fila de verificação, lista de
candidatos disponíveis. Decisão do Luiz em 31/08/2026, que afrouxou de
propósito o corte anterior, mais fechado.

O que continua fora é **escrita com dono**: publicar vaga, se candidatar,
mover a candidatura de uma empresa. A razão não é desconfiar de quem
administra — é que essas ações têm autor, e uma vaga publicada por um
acesso comprometido não deixa rastro de que não foi a empresa. Quando for
preciso agir como outro papel, que seja por personificação registrada em
log, onde a ação continua tendo dono.

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

### Arquivos: o caminho vem da sessão, nunca do nome enviado

Foto, currículo e logo passam pelo servidor com a chave de serviço; o
navegador nunca fala com o Storage direto. Fosse assim, quem pode enviar e
para onde viraria responsabilidade de uma policy — e policy errada é
silenciosa até alguém sobrescrever o arquivo de outra pessoa.

O caminho é derivado do id de quem envia e de uma tabela fechada de
extensões. Nome vindo do cliente permitiria `../` para escapar da pasta, ou
o id de outra pessoa. Caminho fixo por pessoa também faz a troca substituir
o anterior, em vez de o bucket virar depósito de versões pagas.

**Currículo é privado**, pela mesma razão do currículo em texto. O banco
guarda o caminho, não a URL; o link nasce a cada visita e expira em um
minuto.

**Ordem entre bucket e banco.** No envio, arquivo primeiro: se o banco
falhar depois, sobra um objeto órfão — invisível e substituído no próximo
envio. Na ordem inversa, o banco apontaria para arquivo inexistente e a
tela mostraria imagem quebrada. Na remoção a ordem se inverte, pelo mesmo
raciocínio.

**Sem Supabase não há Storage.** A tela diz isso em vez de aceitar o envio
e perder o arquivo — aceitar em silêncio faria a pessoa achar que salvou.

### O que se edita depois, e o que nunca

O cadastro pede o mínimo para a conta existir e a pessoa ser encontrada;
o resto vive em `/perfil/editar`, preenchido quando ela já viu que a
plataforma tem gente de verdade.

**O CNPJ não é editável.** É a âncora de identidade da empresa e o que
separa vaga real de anúncio falso. Poder trocar depois permitiria
cadastrar com um CNPJ válido, passar pela verificação e então virar outra
empresa. Correção é caso de suporte, com gente olhando.

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

### O endereço da vaga é aditivo ao bairro, não substituto

A vaga informa endereço — rua, número, ponto de referência, texto livre.
Quem depende de ônibus ou de andar precisa saber onde é **antes** de se
candidatar, não depois, no contato com a empresa.

**Ele não entra no ranking de proximidade**, que continua olhando só
bairro e cidade. Comparar endereço livre não é confiável o bastante para
decidir ordem: "Rua X, 123" e "Rua X 123" são a mesma rua e strings
diferentes. Bairro é curado onde existe lista, e é isso que o torna
comparável.

A coluna é opcional no banco, para não quebrar vaga publicada antes do
campo existir; a tela de publicação é que exige preenchido em vaga nova.

### Estágio da candidatura: o nome depende de quem lê

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

### Na % de casamento, zero é uma afirmação

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

### Navegação pública, revertida

O V0 nasceu com vagas e prestadores abertos a qualquer visitante. A razão
era boa: buscador indexando "vaga de operador em Sinop" traz gente que
nunca ouviu falar da Lupa, de graça e sem esforço de divulgação.

Em 21/08/2026 isso foi revertido a pedido do Luiz. O raciocínio: só quem
tem perfil se candidata, vê dado de empresa ou entra em contato — e é o
cadastro que vira lead. Vitrine aberta gera visita; visita não é lead.

**O preço, aceito de olhos abertos:** o app sai da busca do Google. Não
existe mais quem chegue sozinho; todo mundo entra por link recebido. Se um
dia a origem do tráfego virar problema, é aqui que se olha primeiro.

O que sobreviveu: o modo demonstração. Ele responde por *de onde vêm os
dados*, não por *quem pode entrar*, e continua sendo o que permite mostrar
o produto sem infraestrutura.

### Segurança: o que já vale, e o que se decidiu não fazer

Auditoria completa dos vinte pontos está na Issue #55, com o estado de
cada um. Três coisas que vale ter na cabeça ao mexer:

**Nada de entrada de usuário concatenada em filtro do PostgREST.** O
`or()` recebe uma string numa linguagem onde a vírgula separa condições:
interpolar termo de busca ali é injeção, num dialeto diferente do SQL.
Use `termoParaFiltro()` em `src/lib/data.ts`, que envolve o valor em
aspas. Já vazou: `zzzznaoexiste,full_name.ilike.*a*` devolvia a base
inteira.

**A CSP é a última linha.** Se algum escape falhar em qualquer lugar, é
ela que impede o script injetado de rodar ou de exfiltrar. `script-src`
ainda precisa de `'unsafe-inline'` porque o Next injeta hidratação inline
sem nonce no App Router; o resto da política vale, e `connect-src`
limita para onde os dados podem sair. Há teste e2e conferindo a resposta
HTTP de verdade, não o `next.config`.

**O contador do limite mora no banco.** Vivia num `Map` em memória de
função serverless: sumia a cada deploy — e a Vercel publica a cada merge —
e valia por instância, então quem caísse noutra começava do zero. O
registro é uma instrução SQL só, com `on conflict do update`: pelo caminho
ler-somar-gravar, duas tentativas simultâneas leem "4" e escrevem "5" as
duas, e a sexta passa.

Contra atacante distribuído continua não bastando. O passo seguinte é rate
limit na borda, e vale quando aparecer abuso medido — não antes.

**Limite de tentativa no cadastro é por origem, não por e-mail.** Quem
cria conta em massa troca de e-mail a cada tentativa. E o sucesso conta
para o limite — no login sucesso zera o contador, porque lá o que se
contém é adivinhação de senha; aqui o que se contém é a criação em si.

**Proteção contra bot ficou de fora de propósito.** Captcha atrapalha
exatamente o público deste produto: aparelho antigo, dado móvel contado,
pouca familiaridade digital. A hora de reavaliar é quando aparecer abuso
real, não antes.

### Mato Grosso inteiro, começando por Sinop

Os 142 municípios do estado são aceitos no cadastro, na publicação de vaga
e nos filtros. `CIDADE_INICIAL` é Sinop e significa só uma coisa: é o valor
que já vem escolhido. Atender Sinop primeiro é estratégia de divulgação;
*recusar* quem é de Sorriso era um formulário dizendo que o app não é dele.

**A lista vem do IBGE, por script.** 142 nomes com acento e com "do/da/de"
no meio, digitados à mão, dão um "Vila Bela da Santíssima Trindade" errado
que ninguém revisa — e alguém de lá não acha a própria cidade. O arquivo
gerado é versionado: em execução o app não fala com o IBGE, porque
cadastro não pode depender de API de terceiro estar no ar.

**Bairro deixou de ser enum.** Era `z.enum` dos 14 bairros de Sinop, usado
no cadastro, no perfil e na vaga. Não existe lista de bairros de 142
municípios pronta em lugar nenhum, e enum recusaria loteamento novo até em
Sinop, onde a cidade cresce todo ano. A curadoria ficou na tela — lista
onde existe, texto onde não existe —, e o servidor garante só o que evita
lixo: tamanho mínimo e máximo.

O preço, aceito: sem enum, "Jd. Botânico" e "Jardim Botânico" podem
coexistir onde não há lista. Vale menos que travar o cadastro.

**A cidade da vaga é da vaga, não da empresa.** Transportadora de Sinop
contrata motorista em Sorriso; herdar a cidade da empresa esconderia a
vaga de quem ela interessa. O formulário já vem com a cidade da empresa
preenchida, e ela pode trocar.

**A cidade não se edita no perfil.** Mudar de cidade muda quem encontra a
pessoa e onde os anúncios dela aparecem — é troca de contexto inteiro, não
correção de campo. Por ora é caso de suporte, como o CNPJ.

### Perto se mede por região do IBGE, não por quilômetro

A busca cobre Mato Grosso inteiro e o estado tem 903 mil km². Ordenar só
por data faz a primeira coisa que alguém de Sinop vê ser uma vaga em
Cuiabá, a 500km — o oposto do que "hiperlocal" promete. Por isso a
listagem ordena pelo mais perto de quem está olhando, numa escada de cinco
degraus (`src/lib/proximidade.ts`): mesmo bairro, mesma cidade, mesma
região imediata, mesma região intermediária, resto do estado.

**Por que região e não distância.** A região imediata do IBGE agrupa
municípios pelo deslocamento real das pessoas para bens e serviços — é a
pergunta certa aqui: até onde alguém daqui viaja para trabalhar. Linha reta
seria pior e ainda exigiria outra fonte de dados, porque em MT quem decide
o tempo de viagem é a estrada: 200km de asfalto e 200km de terra não são a
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

**Para prestador, perto é onde ele atende**, não onde mora: o eletricista
do Jacarandá que atende o Centro está perto de quem é do Centro. O endereço
dele responderia a pergunta errada.

### 404 em vez de 403 quando faz sentido

Registro de outro dono e área administrativa respondem "não encontrado". Um
403 confirma que o recurso existe — informação de graça para quem sonda ids
ou procura o painel de admin.

### Enumeração de contas

O cadastro avisa que o e-mail já existe; o login, não. No cadastro o aviso é
necessário, senão a pessoa tenta de novo sem entender. No login, o mesmo
aviso seria uma lista de quem tem conta — que aqui significa **quem está
procurando emprego**, informação que pode custar o emprego atual de alguém.
O tempo de resposta também é igualado (`gastarTempoDeVerificacao`).

### Polling, não websocket, no painel do admin

Conexão aberta em serverless exige um serviço à parte, com custo e mais uma
peça para quebrar. 15 segundos num painel que uma pessoa olha é
indistinguível de tempo real. A aba em segundo plano para de pedir.

### O limite de publicações mora no banco

Trigger em `publicacoes`, não só checagem na aplicação. A aplicação também
confere, para dar mensagem decente antes de gravar — mas duas requisições
simultâneas passariam pela checagem e criariam a décima primeira. O banco é
o único lugar onde essa corrida não existe.

### O aviso de vaga guarda o que a pessoa pediu, e nada mais

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

**Bairro ficou fora**, decisão de 26/08/2026: não existe catálogo de bairro
para os 142 municípios, só para Sinop. Notificar por bairro funcionaria bem
numa cidade e mal nas outras 141.

**O envio sai por `after()`**, depois da resposta — quem publicou quer a
vaga no ar, e o aviso é consequência. Mesma disciplina do registro de
visualização.

**O service worker não faz cache**, e isso é escolha. O app é todo atrás de
login: cache mal desenhado aqui mostra a vaga de ontem como se fosse a de
hoje, ou o conteúdo da sessão de outra pessoa no mesmo aparelho. Ele existe
para receber push e para ser o requisito de instalação no iPhone, que é do
que o APK/TWA depende.

### Busca sem resultado é vocabulário, não histórico de pessoa

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

### Visualização de vaga é contagem, não histórico

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

### Vaga expira em 30 dias, e reativar custa o mesmo que publicar

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

### Cobrança: a espera por demanda acabou, mensalidade de prestador é o primeiro uso real

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

### O caixa: todo valor que entra é registrado, e o que sai também (#179)

Decisão do Luiz em 10/09/2026. O painel do admin mostrava "faturamento
estimado" a partir de `perfis_empresa.plano` — a coluna que este arquivo
já cita como exemplo de estado declarado sem produtor. Nada nunca escreveu
nela, então "assinaturas ativas" era sempre zero, "em teste" contava todas
as empresas, e a receita era zero vezes um preço de tabela que também
estava errado (R$ 149, quando o plano mensal custa R$ 199,90).

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
no mês que vem; pacote de vagas e vaga avulsa não voltam sem alguém
comprar de novo. Somados, um mês bom de pacotes parece receita previsível.

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

**A aprovação é condicional na própria instrução do banco — `update ...
where status = 'pendente'`** —, não "lê o status, decide, grava" em dois
passos. O Mercado Pago reenvia webhook; duas notificações chegando quase
juntas não podem aplicar o efeito duas vezes, a mesma família de corrida
que o limite de publicações já resolve com `pg_advisory_xact_lock`. Aqui
a trava é mais simples porque a chave já é única por pagamento: a segunda
tentativa não encontra mais nada "pendente" e a função devolve `null`,
que o chamador lê como "nada a fazer".

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

### Sem carência: cartão logo depois do cadastro, com teste grátis (#170)

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

**A vitrine só mostra quem está com a mensalidade em dia**, mesma família
de regra que `doc_verified`: o filtro mora em `getProviders`
(`subscription_valid_until > now()`), não na view `provider_listings` —
filtrar na view esconderia o prestador do próprio perfil, a mesma
armadilha do 404 que já derrubou quem tinha acabado de ativar. Por isso
`getProviderById` não filtra: os dados continuam salvos, só o anúncio
some, e reativar é assinar de novo.

### Gerador de currículo pago, sem Storage nenhum

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

### O plano vira o último passo do cadastro, não uma descoberta depois

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
de um texto pequeno. O que muda é o peso visual — o plano pago tem borda
e fundo destacados, badge "Recomendado", e vem primeiro; o trial fica
discreto, mas continua sendo uma opção completa, com a mesma lista de
benefícios que os planos pagos.

---

## Decisões de produto por papel

O que cada papel informa no cadastro foi decidido assim:

**Trabalhador comum — sete campos, um passo.** É o público mais numeroso e o
menos paciente com formulário. Quem procura emprego pelo celular, muitas
vezes com dado móvel contado, abandona uma tela de quinze campos. Currículo,
experiência e formação vão para a edição de perfil, depois que a pessoa já
viu que existem vagas de verdade aqui.

**Prestador — categoria e descrição já no cadastro.** O perfil dele nasce
sendo o anúncio. Sem esses campos ele não aparece na busca, ninguém o
encontra, e a conclusão dele é que a plataforma não funciona.

**Empresa — CNPJ obrigatório e validado por dígito verificador.** É o que
separa empresa real de vaga falsa, e vaga falsa em plataforma de emprego
costuma virar golpe de taxa de cadastro cobrada de quem está desempregado.

### O que a empresa tem no painel

Decidido com base em plataformas de recrutamento, e o que **não** entrou é
tão importante quanto o que entrou:

| Recurso | Estado |
|---|---|
| Perfil público: razão social, setor, porte, site, redes, descrição, logo | Pronto |
| Publicar, editar e encerrar vaga | Pronto |
| Ver candidaturas por estágio, e mover entre eles | Pronto |
| Ficha do candidato, com currículo e contato | Pronto |
| % de casamento com a vaga, na lista de currículos | Pronto |
| Buscar entre quem pediu para ser encontrado | Pronto |
| Publicações no perfil, até 10 ativas | Pronto |
| Métricas próprias: visualizações e candidaturas por dia, 30 dias | Pronto |
| Plano e cobrança | `trial`/`mensal` no schema; sem integração |

**"Recomendados para você" é ordenação, não descoberta.** O painel põe na
frente, entre **quem já se candidatou**, quem tem as habilidades que a vaga
pede — e diz quais casaram, porque recomendação sem motivo é adivinhação e
quem discorda dela em silêncio para de olhar o bloco.

O casamento vive em `src/lib/skills.ts`: normalização mais uma tabela de
sinônimos do vocabulário daqui ("CNH D" e "carteira D"; "colheitadeira" e
"colhedora"). Tabela, e não modelo: numa cidade com dezenas de vagas, uma
lista que qualquer um lê e corrige acerta mais do que algo que ninguém
depura — e não põe chamada de rede no caminho de uma tela que abre em 3G.

A vaga declara o que pede em `vagas.habilidades`; vazio, o casamento lê o
título e a descrição. Sem essa reserva o bloco nasceria vazio para toda
vaga já publicada, e ninguém preenche campo cujo resultado nunca viu.

**Ser encontrado é escolha do candidato, desligada por padrão.**
`perfis_candidato.visivel_para_empresas` é o que separa "quem se candidatou"
de "quem pediu para ser procurado", e o bloco de recomendados mostra os dois
em listas separadas.

A fechadura mora no `where` da view `candidatos_disponiveis`, não na
aplicação: assim nenhum esquecimento de filtro numa tela revela quem não
consentiu, e desligar tira a pessoa na mesma consulta.

**São dois consentimentos diferentes, e não se misturam.** Quem se candidata
entrega o currículo junto com a candidatura; quem só está visível entregou
contato. Por isso a view não traz currículo nem resumo — "pode me procurar"
não pode significar "leia meu histórico inteiro".

O padrão desligado é a parte que importa: numa cidade do tamanho de Sinop,
quem está empregado e procurando outra coisa pode ter o patrão atual entre
as empresas cadastradas.

**A busca de candidatos existe, e não é livre.** `/candidatos` lista quem
ligou `visivel_para_empresas`, com filtro por habilidade e por área
desejada; `/candidatos/[id]` abre o perfil. Decisão do Luiz em 31/08/2026,
que afrouxou o corte anterior — até ali, "busca livre de candidatos"
estava aqui como fora do escopo.

O que sustenta o afrouxamento é o consentimento ter passado a existir. A
razão do corte antigo não mudou: continua sendo o patrão atual entre as
empresas cadastradas. Por isso quem não ligou a opção segue invisível, e
o que a busca alcança é **contato, não currículo** — a view que responde
a essa tela não traz currículo nem resumo.

`candidato:buscar_disponiveis` é capacidade própria, e não uma das de
vaga, porque o alcance é outro: as de vaga terminam em quem se candidatou
àquela vaga, e esta começa em quem nunca se candidatou a nada.

**Fora do escopo por decisão, não por esquecimento:** testes e triagem
automática, e múltiplos usuários por empresa. Os dois fazem sentido num
produto maduro; num piloto de uma cidade, cada um é uma superfície a mais
para manter sem ninguém pedindo ainda.

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
- **Multi-cidade:** toda entidade tem `city`, e o app aceita os 142
  municípios de Mato Grosso — lista gerada do IBGE por
  `scripts/gerar-cidades.mjs`. `CIDADE_INICIAL` é Sinop, e é só isso: o
  valor que já vem escolhido. Bairro tem lista curada onde alguém conferiu
  (`BAIRROS_POR_CIDADE`) e é texto livre no resto.
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
  (`router.replace`) perdia a corrida contra a revalidação, e não dava
  para redirecionar de dentro da action porque `criarAcao` captura toda
  exceção — inclusive o `NEXT_REDIRECT`. A saída foi a própria página
  redirecionar quem já é prestador, que é determinístico e roda no
  servidor. **Ação que muda o papel e revalida precisa responder o que a
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

- **`useSearchParams()` exige `<Suspense>`, e esse boundary pode nunca
  resolver.** A barra de filtros ficou invisível e inerte: o conteúdo era
  transmitido mas ficava preso num `<template>`. Hoje os valores descem por
  prop do Server Component, que já leu os `searchParams`.
- **`truncate` num elemento que também é `flex` não corta o texto** — o
  ellipsis não se aplica e o `nowrap` trava a largura, empurrando a página
  para fora da tela. O truncate vai num `<span>` de texto dentro do flex.
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
