# Decisões de produto por papel

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

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

## O que a empresa tem no painel

Decidido com base em plataformas de recrutamento, e o que **não** entrou é
tão importante quanto o que entrou:

| Recurso | Estado |
|---|---|
| Perfil público: razão social, setor, porte, site, redes, descrição, logo | Pronto |
| Publicar e encerrar vaga | Pronto — **editar não existe**: a vaga é revisada antes de publicar, e a tela de compra diz isso |
| Ver candidaturas por estágio, e mover entre eles | Pronto |
| Ficha do candidato, com currículo e contato | Pronto |
| % de casamento com a vaga, na lista de currículos | Pronto |
| Buscar entre quem pediu para ser encontrado | Pronto |
| Publicações no perfil | **Não é da empresa** — o feed é de prestador e candidato desde 03/09/2026; quem representa a empresa é a logo e o cartão |
| Métricas próprias: visualizações e candidaturas por dia, 30 dias | Pronto |
| Plano e cobrança | Pronto — Mercado Pago, vaga avulsa e três planos mensais (5, 10 e ilimitado) pelo limite de vagas no ar, com a primeira vaga grátis para CNPJ conferido (#172, #179, #489) |

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

**E só para empresa conferida, com teto por dia (#433).** Decisão do Luiz
em 13/10/2026. Até ali, qualquer conta de empresa abria a busca e o
WhatsApp de cada pessoa: a cadastrada por CPF nasce verificada na hora, e
a de CNPJ chegava à busca só com o dígito verificador. Criar uma conta e
colher o telefone de todo mundo que pediu para ser encontrado levava
minutos — o primeiro passo do golpe da vaga com taxa, o mais comum contra
quem procura emprego. Hoje `acessoABuscaDeCandidatos` libera a busca só
para empresa com CNPJ conferido na Receita, e cada uma abre até 30 perfis
por dia (`ORCAMENTO_DE_PERFIS_DE_CANDIDATO`); o 31º mostra que o teto foi
atingido, sem o contato.

A empresa por CPF fica de fora pela mesma razão que a #251 deu ao
prestador: quem liga a caixa consente ser encontrado por **empresas**, e
ela é pessoa física. Quem não está conferido lê o que falta, em vez de um
404 — a capacidade continua no papel, e o link no painel também. O perfil
de quem se candidatou à empresa **não** conta no teto: candidatura é outro
consentimento, e continua chegando como sempre. O admin passa direto, sem
o teto, porque enxerga tudo — mesmo tendo a empresa dele (#499).

O que isto não resolve: conferir o CNPJ prova que a empresa existe, não
que quem a cadastrou é dono dela. O teto é o que limita quem usa o CNPJ de
outra empresa.

**Fora do escopo por decisão, não por esquecimento:** testes e triagem
automática, e múltiplos usuários por empresa. Os dois fazem sentido num
produto maduro; num piloto de uma cidade, cada um é uma superfície a mais
para manter sem ninguém pedindo ainda.
