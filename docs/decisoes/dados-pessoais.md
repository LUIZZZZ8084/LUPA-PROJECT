# Arquivos, dados pessoais e moderação

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## Arquivos: o caminho vem da sessão, nunca do nome enviado

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

**A foto é reduzida antes de gravar, não só na entrega (#283).** A #268
passou a foto pelo otimizador do Next, e o celular passou a receber WebP do
tamanho da tela — mas o bucket continuava guardando o original de 1 a 2 MB.
Hoje o servidor decodifica, aplica a orientação do celular, reduz (512 px
para perfil e logo, 1600 para o feed) e grava WebP **sem metadado**. O
metadado era o problema maior: foto de celular leva o GPS de onde foi
tirada, os buckets de foto são públicos, e a URL do original aparece no
HTML como parâmetro do otimizador. Decodificar também é o que prova que o
arquivo é imagem — `conferirArquivo` só confere o tipo declarado. O
currículo em PDF passa como veio.

**E foto grande é reduzida no celular, antes de sair (#325).** A redução
acima só acontecia depois de a foto chegar, e a foto de celular — de 3 a 8
MB — nem chegava: o limite de 2 MB a recusava antes. A pessoa precisava
diminuir a foto por conta própria. Hoje todo `<input type="file">` passa
por `ajustarAoLimite`: foto acima do limite vira WebP de 1600 px no próprio
aparelho (o que ainda poupa o dado móvel), e o que não dá para reduzir é
recusado ao lado do campo com a mesma mensagem do servidor. O servidor
continua conferindo e reduzindo tudo, porque nada que vem do navegador é
garantia — o formato e a retirada do GPS são dele. Há teste que varre
`src` e reprova campo de arquivo sem a conferência.

O texto do limite embaixo de cada campo vem de `REGRAS[especie].aviso`, e o
`accept` de `tiposAceitos`. O currículo dizia "até 5 MB" escrito à mão na
tela — a mesma divergência da senha (#290) esperando acontecer.

Como tudo virou `.webp`, a foto de perfil antiga em `.jpg` ficaria órfã no
caminho fixo. `removerVersoesAnteriores` a apaga — **depois** de o banco
apontar para a nova, pela mesma ordem de sempre.

**O currículo precisa ser PDF de verdade (#332).** `conferirArquivo` olha o
tipo que o navegador declara, e qualquer um declara o que quiser: a foto
era provada ao ser decodificada, e o PDF passava como veio. Hoje o servidor
recusa o que não começa com `%PDF-`. Não abre o documento — só recusa o
que nem finge ser.

**E o bucket também tem limite (#332).** Até 05/10/2026 os quatro aceitavam
qualquer arquivo de qualquer tamanho, e só a aplicação conferia. Hoje
`file_size_limit` e `allowed_mime_types` estão no `storage.sql`, com os
números de `REGRAS`, e há teste comparando os três lugares. É a segunda
camada, como o `revoke` em cima da RLS: o caminho de envio novo que
esquecer a conferência é recusado pelo próprio Storage. Em produção, quem
aplica é `supabase/aplica-limites-dos-buckets.sql`, rodado à mão.

**Sem Supabase não há Storage.** A tela diz isso em vez de aceitar o envio
e perder o arquivo — aceitar em silêncio faria a pessoa achar que salvou.

## Excluir a própria conta, e o que fica depois (#423)

Direito do titular na LGPD (art. 18, VI), e até 12/10/2026 não havia como
— nem pela tela, nem por uma página que dissesse a quem pedir. Decisão do
Luiz nesse dia: botão no perfil. Ele mora abaixo dos dois "sair", fechado
até a pessoa pedir, e diz o que sai e o que fica **antes** do botão.

**A conta é anonimizada, não apagada.** Apagar a linha de `usuarios`
levaria junto, em cascata, `pagamentos` e `assinaturas` — o histórico do
caixa que a #179 passou a registrar. A linha fica sem nada que identifique
a pessoa: nome "Conta excluída", e-mail num domínio `.invalid` que ninguém
recebe, telefone zerado, CPF nulo, uma senha que nenhum hash produz, e as
sessões cortadas. E-mail e CPF ficam livres para uma conta nova.

**Sai tudo o que é da pessoa**: perfis, currículo, candidaturas,
publicações, avaliações recebidas, vagas (com as candidaturas a elas),
avisos, aparelhos, tokens, créditos e pedidos de verificação. **Fica, sem
nome, o que é de outra pessoa**: a avaliação que ela escreveu é reputação
de quem foi avaliado, e continua com "Conta excluída" no lugar do nome —
a mesma razão do `on delete set null` em `avaliador_id`.

**Uma função só no banco** (`excluir_conta`), numa transação: metade
excluída e metade não é o pior estado possível — a pessoa não entra mais
e os dados continuam aqui. `mensagens_suporte` existe em produção e não
no `schema.sql`, e por isso entra por `execute` condicionado à tabela
existir.

**A ordem é a que deixa a pior falha recuperável**, em
`src/server/conta/servico.ts`: a senha primeiro (a sessão pode ser de um
aparelho esquecido aberto), com o limite do login **pela mesma chave**
(`login:<e-mail>`, #425) — um limite próprio daria a quem tem o cookie
cinco tentativas de senha a mais por janela; depois a assinatura,
cancelada no Mercado Pago — e, se o cancelamento falhar, **nada é
excluído**, porque a cobrança continuaria para alguém sem conta para
cancelá-la; depois o banco; e os arquivos por último, como em toda
remoção do app. Arquivo que sobra é dado pessoal sem dono, e a falha vai
ao Sentry.

**O admin não se exclui pela tela** (`conta:excluir` não está no papel
dele): a conta de administração é a que opera a ferramenta, e tirá-la do
ar é caso de suporte. Em demonstração, o repositório em memória anonimiza
a conta e o que ele mesmo guarda; o caminho que apaga tudo é o do banco, e
é ele que o `schema.test.ts` exercita num Postgres de verdade.

## Termos, Privacidade e Suporte, e quem responde pela Lupa (#235)

Os três documentos nasceram em setembro e ficaram fora do ar até a PALU
existir: documento legal sem responsável identificado dá aparência de
conformidade sem entregar nenhuma, e promete um canal de direitos do
titular sem dizer a quem se dirigir. `PRONTO_PARA_PUBLICAR`, em
`src/lib/controlador.ts`, decide — sem razão social, CNPJ e e-mail as três
páginas respondem 404 —, e há teste que trava.

**O responsável mora num arquivo só**, porque aparece nos três documentos
e no rodapé, e documento legal com a identidade escrita em três lugares é
documento que um dia diverge. Os dados são os do comprovante de inscrição
da Receita (24/10/2026), letra por letra: razão social, CNPJ e o endereço
da sede. O telefone do registro fica de fora; o canal do titular é o
e-mail de suporte da Lupa. O teste confere o CNPJ contra o próprio
validador do app, porque um dígito trocado publicaria um número que não
existe.

**O foro é Curitiba/PR, a sede**, e não Sinop, onde a Lupa começou — era o
valor provisório antes de a empresa existir. O texto ressalva o foro do
domicílio do consumidor quando a lei o garantir.

**Documento legal se escreve a partir do banco, não do que o produto diz
de si.** Foi escrevendo estes textos que a #233 apareceu, e foi
conferindo-os de novo na publicação, três semanas depois, que apareceram
cinco frases que tinham deixado de ser verdade: exclusão de conta "pelo
suporte" (hoje é pelo perfil, #423), nenhuma palavra sobre denúncia
(#435), a busca de candidatos sem a trava da empresa conferida (#433),
"vaga a partir de R$ 19,90" (no pacote de 10 ela sai por R$ 9,99) e
tentativa de acesso que "se apaga em algumas horas" (até um dia, desde a
#407). *Texto de setembro sobre o produto de outubro é texto sobre outro
produto: a data de revisão só vale se a revisão aconteceu.*

**E não é parecer jurídico.** O texto foi escrito com cuidado, a partir
do código, e cita os artigos para quem lê poder conferir. Um advogado
ainda precisa lê-lo — junto com a pergunta da vaga por sexo, na seção do
PCD.

## Denunciar vaga e avaliação, e só o admin decide (#435)

A Lupa não tinha como alguém avisar "esta vaga pede pix para marcar
entrevista" nem "esta avaliação é de quem nunca foi atendido". Golpe de
taxa é o risco que o CNPJ obrigatório existe para conter, e nada dentro
do app levava o aviso até o admin. Decisão do Luiz em 13/10/2026:
denúncia por qualquer conta com sessão, e um painel em `/admin`.

**Nada sai do ar sozinho.** Ocultar depois de N denúncias seria mais
rápido contra golpe, e daria a um concorrente o botão de derrubar o
anúncio de outro — três contas bastariam. Quem decide é o admin, por
`decidir_denuncia`, numa transação: tirar do ar **encerra** a vaga (o
mesmo estado de quando o dono encerra) ou **apaga** a avaliação (a nota
sai da média pelo trigger de sempre), e fecha as denúncias daquele alvo.

**O denunciante nunca aparece para o denunciado.** A tabela é fechada
para `anon` e `authenticated`, e só o painel do admin a lê, com a chave de
serviço. A tela diz isso depois do envio, porque é o que faz alguém
denunciar o patrão da cidade pequena.

**Uma aberta por pessoa e alvo, no banco.** O índice único parcial é o
que impede dez cliques da mesma pessoa de parecerem dez pessoas — a
checagem da aplicação não segura dois envios simultâneos. Depois da
decisão a pessoa pode denunciar de novo: a vaga pode ter mudado.

**O dono não denuncia o que é dele, e o admin não denuncia.** O admin
decide; denunciar a própria vaga não faz sentido, porque encerrá-la é um
botão. O prestador denuncia avaliação do próprio perfil — avaliação
falsa contra ele é o caso mais provável.

**O alvo que some leva a denúncia aberta.** Quando a conta do dono é
excluída (#423), a vaga e as avaliações do perfil vão junto; um trigger
apaga as denúncias **abertas** delas, senão o painel mostraria algo que
ninguém abre. As decididas ficam, como registro — e por isso
`decidir_denuncia` fecha as denúncias **antes** de apagar a avaliação.

**O botão é discreto, e fechado até a pessoa pedir.** Um botão vermelho em
toda vaga ensinaria a desconfiar de todas. É um link pequeno ao fim da
vaga e de cada avaliação; o formulário só abre no clique.

**E a foto de trabalho também (#452).** Decisão do Luiz em 13/10/2026.
Foto é o conteúdo que pode exigir retirada rápida — imagem íntima, foto de
outra pessoa sem autorização —, e nada no admin apagava uma. O link fica na
foto ampliada, para quem olha o perfil de outra pessoa; o painel mostra a
miniatura, porque decidir sobre imagem pela legenda é decidir às cegas.

**Tirar a foto do ar apaga, não arquiva.** Arquivada, a publicação sai do
perfil mas o arquivo continua no bucket público, acessível pelo endereço,
e o dono pode trazê-la de volta. `decidir_denuncia` apaga a linha, e a
aplicação apaga o arquivo depois, por `apagarFotoDeTrabalho` — só se o
endereço for do nosso bucket e da pasta do próprio autor, com o nome que o
servidor sorteia. Apagar o arquivo errado é pior que deixar um órfão; se o
Storage recusar, a falha vai ao Sentry. O dono do perfil vem da
publicação, nunca do formulário.

**A função de decisão mora em três arquivos** — o schema e os dois
`aplica-*.sql` —, e um teste exige que sejam iguais: um script velho rodado
de novo desfaria a foto sem ninguém ver.
