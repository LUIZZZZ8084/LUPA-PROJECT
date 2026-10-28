# Segurança: o que já vale, e o que se decidiu não fazer

> Parte das decisões do projeto, com o porquê de cada uma. Mora fora do
> `AGENTS.md` desde a #509, para ele caber no limite de leitura dos agentes;
> o índice está lá. Quando um texto daqui diz "mais abaixo" ou "acima", a
> seção citada pode estar em outro arquivo desta pasta — o índice diz onde.
> Comentário no código que cita "o AGENTS.md" aponta para o conjunto.

## Segurança: o que já vale, e o que se decidiu não fazer

Auditoria completa dos vinte pontos está na Issue #55, com o estado de
cada um. Três coisas que vale ter na cabeça ao mexer:

**Nada de entrada de usuário concatenada em filtro do PostgREST.** O
`or()` recebe uma string numa linguagem onde a vírgula separa condições:
interpolar termo de busca ali é injeção, num dialeto diferente do SQL.
Use `termoParaFiltro()` em `src/lib/data.ts`, que envolve o valor em
aspas. Já vazou: `zzzznaoexiste,full_name.ilike.*a*` devolvia a base
inteira.

**E o termo tem teto (#439).** A URL não tem limite, e o `?q=` entrava
inteiro no `ilike` e na chave do cache das listagens: cada variação de um
termo de vários KB era uma consulta e uma entrada de cache novas.
`termoDeBusca` (`src/lib/limites-de-lista.ts`) apara, colapsa espaço e
corta em 100 caracteres na entrada de `getJobs` e `getProviders` — antes
do escape, para nunca partir uma sequência de escape ao meio.

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

**E "abuso medido" passou a ter onde ser lido (#207).** A frase acima
existia desde sempre pressupondo alguém medindo, e ninguém media: em
12/09/2026 a pergunta "estamos perto de cair?" foi respondida abrindo o
painel do Supabase e contando conexão à mão. *Gatilho de decisão que
ninguém sabe onde consultar é decisão que nunca é tomada.*

A Issue nasceu pedindo tabela nova — contagem por rota e por dia, no
padrão de `buscas_sem_resultado`. Decisão do Luiz em 14/09/2026: **não se
cria a tabela.** Duas razões, e a segunda é a que decide:

- **Volume por rota a Vercel já conta**, e é o medidor da fatura dela —
  justamente o teto que chega primeiro, porque o que acaba não é o banco
  e sim a cota do plano. Uma cópia nossa seria dois números para a mesma
  pergunta, e o nosso seria o pior dos dois.
- **O sinal que faltava já estava no banco.** `tentativas_de_acesso` tem
  chave, contagem e `bloqueado_ate`. O que não se tem é histórico — e
  histórico é exatamente a parte que guarda dado. Criar tabela para ter
  gráfico de tendência é abrir superfície de privacidade nova em troca de
  um número que já dá para ler.

O que entrou no lugar é a view `metricas_pressao` e um bloco no painel do
admin: recusa agrupada **por ação**, ao vivo, sem tabela nova e sem
histórico. Ele responde "está subindo?", que é a pergunta que destrava a
decisão da borda.

**A agregação mora no banco, e não é preferência de estilo.**
`tentativas_de_acesso.chave` é `login:<e-mail>`, `cadastro:<ip>`,
`recuperacao:<ip>` e `acao:<nome>:u:<usuarioId>` — *aquela tabela tem
endereço de e-mail dentro*. Agregar em JavaScript traria a coluna para
dentro do processo e deixaria a garantia em "ninguém vai renderizar isso",
que é o tipo de promessa que este arquivo registra falhando. Na view, a
chave não atravessa a fronteira: o que chega à aplicação já é contagem, e
há teste que lista as colunas e reprova qualquer uma a mais.

O segundo motivo é o de `metricas_caixa`: agregar na aplicação funciona
hoje, com poucas linhas, e para de funcionar **exatamente sob abuso** — o
único momento em que alguém abre este bloco.

**E a mesma agregação existe duas vezes, porque a demonstração não tem
banco.** Regra de agregação escrita em SQL e em TypeScript diverge sem
ninguém ver; a defesa é o `schema.test.ts` rodar as duas sobre a mesma
entrada e comparar linha a linha. *Quando não dá para ter uma
implementação só, tenha um teste que prove que as duas concordam.*

**Toda escrita tem teto, e ele é declarativo (#202).** Até 13/09/2026 só
autenticação tinha limite; candidatar-se, publicar, avaliar, comprar
crédito e mexer no perfil não tinham nenhum. O que acaba nesse caso não é
o banco — são 3 conexões de PostgREST servindo consulta indexada, e elas
aguentam. O que acaba é a **cota da Vercel**: "cai tudo" por esgotamento
de plano, não por sobrecarga.

O teto mora em `src/server/limites.ts`, numa tabela por nome de ação, e é
cobrado dentro de `criarAcao` — o ponto por onde as 31 actions passam.
Espalhar isso pelas actions seria o que a matriz de RBAC já evita: teto
esquecido na trigésima segunda. Há teste que varre `src/app`, e action
nova sem entrada em `ORCAMENTOS` **ou** em `SEM_ORCAMENTO` — com a razão
escrita — reprova.

**A chave é a sessão, não o IP**, e a diferença aqui não é técnica, é de
público. Em Sinop, lan house, escritório e provedor de rádio põem dezenas
de pessoas atrás do mesmo endereço: limitar por IP puniria todas por causa
de uma, e quem usa conexão compartilhada é justamente o público deste app.
Como tudo é fechado por login, todo abuso carrega sessão — e quem não tem
sessão cai no IP, que é o certo nas três de autenticação, onde a conta
ainda não existe.

**E o `GET` que mais gasta CPU também tem teto (#425).** `/api/curriculo`
monta o PDF do zero a cada chamada, e o teto de `criarAcao` não alcança
rota. `ORCAMENTO_DO_CURRICULO_PDF` mora fora de `ORCAMENTOS` porque lá só
entra nome de action — há teste cobrando isso —, e é cobrado na rota antes
de montar o documento, com a mesma chave que uma action teria.

**A cobrança vem antes da validação**, e antes de qualquer trabalho: o que
garante que a ação recusada não teve efeito nenhum, nem parcial. Teto que
recusa depois de executar não é teto, é mensagem.

**A suíte e2e precisou de um multiplicador, e isso ensina o limite do
modelo.** Um teto por pessoa presume que uma conta é uma pessoa. A suíte
compartilha login entre os specs, roda em dois navegadores e, na CI,
repete o que falha até duas vezes — então ela é uma conta fazendo o
trabalho de muitas, e `vaga.publicar` estourou. **Passou local e reprovou
na CI**, porque local roda sem retentativa: retentativa não é neutra
quando existe estado que sobrevive a ela.

O conserto foi `LIMITE_MULTIPLICADOR`, declarado no `playwright.config.ts`
junto do segredo de sessão e da URL pública — e **recusado em produção**,
onde seria uma variável de ambiente desligando a proteção sem ninguém
conferir. Multiplicar e não desligar: a suíte continua exercitando todo o
caminho do limite a cada ação, e o que muda é só onde ele morde. *Não se
afrouxa produção para caber um teste — se o teste não representa gente, é
o ambiente dele que se declara diferente.*
**`chamadas` quer dizer quantas passam.** A função SQL bloqueia em
`>= max`, então quem chama soma 1 — sem isso, um orçamento escrito como 15
deixaria passar 14, e a tabela mentiria sobre si mesma por uma unidade que
ninguém confere.
**E toda listagem tem teto de linhas (#203).** Nenhuma consulta de lista
tinha — eram 23. Com 8 vagas isso é indistinguível de ter; com 5.000,
toda abertura de `/vagas` puxa a tabela inteira, e o custo cresce por
volume de dado, não por número de gente. É o teto que chega primeiro de
verdade, e chega em silêncio: nada quebra, só fica mais caro e mais lento
até parar.

Os números moram em `src/lib/limites-de-lista.ts`, com o porquê de cada
um, e há teste que varre `src/lib` e `src/server` reprovando consulta de
lista nova sem `.limit()`.

**Por que teto e não paginação de verdade.** `/vagas` e `/servicos`
buscam e **reordenam por proximidade em JavaScript**. Paginar no banco do
jeito ingênuo quebraria isso: a página 1 viria pelas mais recentes e a
proximidade valeria só dentro daquelas — alguém de Sinop deixaria de ver
a vaga de Sinop porque ela é a 30ª mais recente. Seria recriar a #76. O
teto preserva o sinal que o banco já ordena (recência para vaga, nota
para prestador) e a proximidade reordena dentro do recorte. Paginação de
verdade exige a escada de proximidade em SQL, e isso exige o mapa de
regiões do IBGE no banco — hoje é arquivo versionado.

**O recorte é dito na tela**, pela mesma razão que a ordenação já era:
recorte que não se anuncia é filtro invisível. E o total da home virou
"mais de N" quando há corte — número que para de crescer e continua se
apresentando como total é a mesma mentira do "faturamento estimado" que
somava zero, e **ninguém desconfia de número**, que é o que os torna
caros.

Efeito colateral que vale registrar: **seis testes de repositório
reprovaram porque o duble de consulta não tinha `.limit()`**. Não era
defeito, era falta de espelho — e falso vermelho é o que ensina a
ignorar teste. Quem acrescentar um método de consulta precisa
acrescentá-lo aos dubles junto.
**A consulta das listagens é cacheada; a página, nunca (#206).** O app era
100% dinâmico — zero `revalidate`, zero `unstable_cache`, oito
`force-dynamic` — e toda abertura de tela consultava o Postgres. Com 26
contas isso não aparece; o que ele decide é o formato da conta quando
aparecer, porque o que a Vercel cobra é invocação de função.

**Cachear a página seria errado, e perigoso.** Ela é pessoal: `/vagas` e
`/servicos` reordenam por proximidade de quem olha, e o app é todo atrás
de login. A consulta, essa não é pessoal — depende dos filtros e de mais
nada. A costura já existia no código, e foi a sorte do desenho:

```
consulta ao banco  →  recorte  →  ordenarVagas(itens, perto)
   igual para todos                    personalizado
```

Então **a chave do cache carrega os filtros e nada de sessão** — inclusive
não carrega `perto`, que chega junto dos filtros em `JobFilters` e parece
mais um deles, mas é quem está olhando. Há teste lendo o código-fonte que
reprova sessão na chave: o erro aqui não falha, ele funciona rápido
mostrando a lista de alguém para outra pessoa.

**O cliente cacheado é outro, e sem cookie.** `supabase/server.ts` chama
`cookies()`, que é dado de requisição — e dado de requisição não existe
dentro de um cache; usá-lo ali é erro em execução, não ineficiência. O
cookie nunca decidiu nada nestas consultas: a Lupa não usa Supabase Auth,
e a chave anônima alcança as views por `grant`, não por sessão. Isso é o
que torna o cache **seguro**, não só possível.

**Quem escreve derruba a tag, e é uma chamada só.** `revalidarBuscaDeVagas()`
faz o `revalidatePath` e o `updateTag` juntos, porque este projeto já
esqueceu essa dupla duas vezes (#189 e #193, em arquivos irmãos) — e
esquecer agora custa o sintoma da #76: a empresa publica, vê a vaga no
painel revalidado por path e **não se acha na busca**, servida do cache.
Há teste que reprova `revalidatePath("/vagas")` solto.

**`updateTag`, não `revalidateTag`:** o primeiro dá *read-your-own-writes*
dentro da própria server action, que é exatamente o caso — quem acabou de
publicar não pode ser quem espera o cache vencer.

E a janela é de 60 segundos porque a home promete "novas vagas entram todo
dia": cache que atrasa a vaga nova quebra a promessa da própria tela.
**As funções rodam onde o banco está (#213).** O Supabase da Lupa é
`sa-east-1` (São Paulo) e o padrão da Vercel é `iad1` (Washington) — o
log de invocação dizia isso em texto. Toda consulta atravessava o
continente duas vezes: ~110–180 ms de ida e volta **por consulta**, antes
de o Postgres fazer qualquer trabalho, e uma tela faz várias.

Vale como aviso sobre onde procurar: a varredura media o lado do banco e
encontrava tudo certo — 3 conexões, 12 MB indexados, consulta em fração
de milissegundo. **O tempo não estava sendo gasto consultando, estava
sendo gasto viajando**, e nenhum índice, teto ou cache conserta latência
de rota. Isso também não aparece em teste local nem no `verify`: aparece
no celular de quem está em Sinop.

`gru1` fica em `vercel.json`, e **sem comentário junto**: a primeira
tentativa pôs a explicação numa chave `$comentario-regions` e o deploy
reprovou — o schema do `vercel.json` recusa propriedade que ele não
conhece, e JSON não tem comentário. O porquê mora aqui e no PR; o arquivo
guarda só o valor.
**Limite de tentativa no cadastro é por origem, não por e-mail.** Quem
cria conta em massa troca de e-mail a cada tentativa. E o sucesso conta
para o limite — no login sucesso zera o contador, porque lá o que se
contém é adivinhação de senha; aqui o que se contém é a criação em si.

**E o número é do cadastro, não da senha (#415).** Eram os mesmos 5 a
cada 15 minutos da tentativa de senha, e o IP do cadastro pode ser uma
sala inteira: posto do SINE ou RH cadastrando gente no mesmo computador,
feira de emprego no Wi-Fi do local, 4G atrás de CGNAT num pico de
divulgação. A sexta pessoa lia "muitas tentativas" e desistia — o
primeiro teto que um lançamento encontraria. Hoje são 20
(`LIMITE_DE_CADASTROS_POR_ORIGEM`). O que segura o abuso que o número
maior deixaria passar é o IPv6 agrupado pela rede /64
(`agruparOrigem`, em `origem-da-requisicao.ts`): quem tem IPv6 escolhe
qualquer endereço da própria rede, e pelo endereço cada troca era um teto
novo — em todo teto por origem, não só no cadastro. Endereço que não se
reconhece passa como veio: uma chave estranha limita uma pessoa, e um
erro ali derrubaria o cadastro de todo mundo.

**O limite de login reserva a tentativa antes do Argon2 (#386).** Ele
conferia o bloqueio, gastava o Argon2 e só então registrava a falha:
requisições simultâneas passavam todas pela conferência antes de a
primeira falha ser registrada, e o teto de 5 virava uma rajada do tamanho
da concorrência. Hoje `reservarTentativa` soma e responde na mesma
instrução, pelo passo único que o resto do app já usava
(`consumirOrcamento`), e com 20 tentativas simultâneas 5 chegam à
verificação. `conferirLimite` continua vindo antes, para quem já está
bloqueado ser recusado **sem somar** — senão insistir prolongaria o
bloqueio da vítima. Vale para o login, a recuperação de senha e a
confirmação de e-mail; o cadastro ficou de fora de propósito, porque
contar toda tentativa dele muda a regra de produto (a pergunta do T2 no
roadmap). *Dois `await` seguidos, conferir e depois registrar, é a forma
de corrida mais comum que existe: a pergunta e a escrita têm de ser a
mesma instrução.*

**Captcha não vai existir, e isto é decisão, não espera.** Este parágrafo
dizia "a hora de reavaliar é quando aparecer abuso real" — soava prudente e
era adiamento. Decisão do Luiz em 14/09/2026: *"colocar captcha para
público leigo e uma simples plataforma de consulta como a nossa é
desnecessário."*

O argumento é mais forte do que o que estava escrito aqui. Captcha cobra
seu preço de **todo mundo** — aparelho antigo, dado móvel contado, pouca
familiaridade digital — para conter um abuso que ainda não existe, e quem
paga é justamente quem está procurando emprego. Custo certo contra
benefício hipotético, e o custo recai sobre o público que o produto existe
para atender.

O que contém abuso aqui é o teto por ação (#202), que não pede nada a
ninguém.
