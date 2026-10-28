# Documentos: CPF, CNPJ e o que a verificação prova

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## O CNPJ é conferido na Receita, e o que isso prova

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

**Sem chave, mas com nome (#318).** A BrasilAPI recusa com 403 o
`User-Agent` padrão do `fetch` do Node, e a conferência falhou para todo
mundo, dizendo "Receita fora do ar", sem nada ficar vermelho: o teste
injeta um `fetch` falso, que não liga para cabeçalho. Hoje a consulta se
apresenta como `Lupa/1.0`, e resposta inesperada deixa o status no log.
*Duble de API de terceiro prova o que o código faz com a resposta, não se
o terceiro aceita o pedido — isso só se confere batendo nele de verdade.*

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

## CNPJ com letras, e o valor que a Lupa guarda (#297)

Desde julho de 2026 a Receita emite CNPJ alfanumérico (IN RFB 2.229/2024).
A adoção é gradual, e vale para empresa nova **e para filial nova de
empresa antiga**: uma raiz numérica pode ter, na ordem do estabelecimento,
letras. O que já existe não muda. São 14 caracteres — 12 de letra ou
número e 2 dígitos verificadores, sempre numéricos.

Até 29/09/2026 a Lupa apagava toda letra antes de validar (`onlyDigits`), e
o exemplo oficial, `12.ABC.345/01DE-35`, voltava "CNPJ inválido" com o
dígito certo. A empresa que abriu depois de julho seria barrada e leria
uma mensagem que a faz achar que errou o número.

**O valor guardado é um só: maiúscula, sem pontuação** (`normalizarCnpj`,
em `src/lib/format.ts`). É o que a checagem de duplicidade compara e o que
a BrasilAPI espera — ela não converte minúscula e responde "não
encontrado" para o CNPJ certo. Sem normalizar, `12abc…` e `12ABC…` seriam
duas empresas e abririam duas contas.

**A conta do dígito é a de sempre, e por isso o CNPJ numérico não ganhou
caminho à parte.** O valor de cada caractere é o código ASCII menos 48: para
número dá o próprio número, para a letra A dá 17. Conferido contra o
exemplo da documentação da Receita e contra a validação da BrasilAPI, que
aceita o dígito calculado. A letra O digitada no lugar do zero também
reprova: o dígito não fecha.

**O teclado do campo é de texto, não numérico.** `inputMode="numeric"` faz
o celular oferecer só números — o servidor aceitando e o campo não deixando
digitar seria o mesmo defeito por outra porta. O preço, aceito: quem tem
CNPJ numérico, que é quase todo mundo hoje, digita num teclado completo em
vez do teclado de números. Há teste que lê o código-fonte dos dois
formulários e reprova a volta do `numeric`.

**O que a Lupa não sabe:** se a BrasilAPI já devolve os dados de uma empresa
real com letras. Ela entende o formato — 404 para o válido que não existe,
400 para o dígito errado —, mas não foi possível testar com uma empresa de
verdade. O cadastro não depende disso (só confere o dígito); o botão
"Conferir CNPJ" pode dizer "não encontrado" para uma empresa recém-aberta
até ela entrar na base pública, e essa mensagem já existe.

**O filtro do Sentry só mascara a forma com pontuação.** Sem ponto, barra e
traço, o CNPJ alfanumérico são 14 caracteres iguais a um `trace_id` ou a um
hash de commit, e máscara larga já corrompeu os dois (#275, #277). O CNPJ é
registro público, e o campo chamado `cnpj` já é mascarado pelo nome da
chave.

## Nem todo prestador é só CPF, nem toda empresa é CNPJ

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

## A vitrine só mostra prestador verificado

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

## CPF mora em `usuarios`, não em `perfis_prestador`

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
