# Auditoria de escala — suportar 10 mil usuários (06/10/2026)

Nona frente, com foco diferente das anteriores: **capacidade e requisições**,
não segurança. A pergunta é "o que quebra primeiro quando o app passar de
algumas dezenas de contas para 10 mil?". Análise sobre o código, sem tocar
produção.

**Resumo:** um ponto concreto de escala — o **fan-out de notificação push**
não escala limpo para segmentos populares. O resto da arquitetura aguenta
10 mil contas sem mudança de código (índices, limpeza de tabelas, tetos de
lista, sem N+1), com uma ressalva de capacidade e uma de produto já
conhecida.

---

## 🟠 O fan-out de push não escala para segmentos populares

**Onde:** `src/server/notificacoes/servico.ts` (`avisarVagaNova`),
`postgres.ts` (`inscricoesInteressadas`).

Ao publicar uma vaga, `avisarVagaNova` roda em `after()` e:

1. Busca as inscrições que casam com cidade + categoria
   (`inscricoesInteressadas`), **limitado a `TETO_ENVIO_DE_AVISO = 500`**.
2. Dispara `Promise.all` de um `enviarPush` (TLS + POST para o serviço de
   push) por aparelho — até ~500 requisições **concorrentes**.
3. Para os que responderam 404/410, `Promise.all` de um `removerInscricao`
   (DELETE) por aparelho morto.

**Dois problemas em 10 mil usuários:**

- **Acima de 500, o aviso some em silêncio.** Uma vaga numa cidade grande numa
  categoria quente ("Agronegócio", "Construção") passa de 500 interessados.
  O `.limit(500)` corta, e do 501º em diante ninguém é avisado — sem fila, sem
  continuação, sem rastro. Num piloto de uma cidade isso nunca acontece; com
  10 mil contas espalhadas, acontece nos segmentos que mais importam.
- **Até 500 envios concorrentes dentro do `after()` da publicação.** Cada
  `enviarPush` é um round-trip de rede (~100–300 ms). 500 em paralelo é muito
  socket e memória numa função só, e se o serviço de push responder devagar, o
  `after()` pode encostar na `maxDuration` — truncando os envios, de novo em
  silêncio. Somam-se até 500 DELETEs concorrentes de aparelho morto, na mesma
  invocação, contra o pool de 3 conexões.

**Por que importa agora.** É o único caminho do app que faz trabalho
proporcional ao **número de usuários** dentro de uma única requisição. Todo o
resto é proporcional aos dados de uma pessoa (perfil, candidaturas) ou está
cacheado. É o primeiro a quebrar com o crescimento, e quebra do jeito pior:
sem erro visível.

**Correção sugerida (arquitetura, não uma linha).** Trocar o fan-out
em-requisição por uma **caixa de saída + cron em lotes**: `avisarVagaNova`
grava a intenção (vaga + público-alvo) numa tabela; um job agendado envia em
lotes com concorrência controlada (ex.: 50 por vez) e continuação entre
execuções, removendo o teto de 500 e tirando os 500 envios de dentro da
publicação. É o mesmo padrão que a reconciliação de pagamentos (#198) já usa:
quando o trabalho é grande e pode falhar no meio, ele sai do caminho da
resposta e vira varredura. Enquanto não vier, subir o teto sem subir a
`maxDuration` só move o ponto de ruptura.

---

## Observações de capacidade (não são bugs)

- **Pool de 3 conexões PostgREST.** As leituras quentes são cacheadas (60 s) e
  indexadas, então o caminho comum não encosta no pool. O que grava —
  rate-limit, visualização, orçamento, e os DELETEs de push acima — compete
  por essas 3 conexões. Em 10 mil contas vale **medir** saturação de conexão
  (o painel de pressão nos tetos, #207, já dá o sinal de abuso; a saturação de
  conexão é a métrica vizinha a acompanhar). O teto de verdade, como o
  `AGENTS.md` registra, costuma ser a **cota de invocação da Vercel**, não o
  banco.
- **Teto de lista vs. proximidade (já conhecido).** `/vagas` e `/servicos`
  puxam no máximo o teto de linhas (#203) e reordenam por proximidade em JS
  **dentro** desse recorte. Com milhares de vagas, uma vaga perto que não está
  nas N mais recentes não sobe. O `AGENTS.md` já documenta isso: paginação de
  verdade exige a escada de proximidade em SQL, com o mapa de regiões do IBGE
  no banco (hoje é arquivo versionado). É tradeoff de produto, não defeito — e
  fica mais visível em 10 mil contas.
- **Latência de rota já resolvida (#213).** As funções rodam em `gru1` (São
  Paulo), colado no Supabase `sa-east-1` — sem isso, cada consulta atravessava
  o continente duas vezes. Continua certo e é o que mais importa para o
  celular em Sinop.

---

## O que aguenta 10 mil contas sem mudança (verificado)

- **Índices nas colunas quentes:** `vagas(cidade, status, criado_em)`,
  `vagas(categoria)`, `vagas(empresa_id)`, `candidaturas(vaga_id)`,
  `candidaturas(candidato_id)`, `pagamentos(usuario_id)`,
  `inscricoes_push(usuario_id)`, `preferencias_notificacao(cidade)`,
  `usuarios(papel, cidade)`, e os únicos de e-mail/CPF/CNPJ/mp_payment_id.
- **Tabelas de alto giro têm limpeza.** `tentativas_de_acesso` é podada por
  `limpar_tentativas_vencidas`, **chamada junto de cada registro** de limite
  (não por cron que alguém esqueceria de agendar) — a tabela não vira
  cemitério, e a agregação de pressão não degrada.
- **Toda listagem tem `.limit()`** (#203) — nenhuma consulta puxa a tabela
  inteira; o custo não cresce com o volume de dado.
- **Recomendados não tem N+1:** busca vagas, candidaturas e disponíveis em 3
  consultas (`Promise.all`) e casa em memória sobre os arrays já carregados,
  limitados aos dados da própria empresa.
- **Escritas concorrentes são atômicas** (orçamento, visualização, crédito,
  mensalidade, aprovação de pagamento) — `on conflict do update` ou `update
  ... where`, sem ler-decide-grava que perca sob concorrência.
- **Listas cacheadas por 60 s** com chave só de filtros — a rajada de
  navegação de 10 mil contas lendo as mesmas buscas vira poucas consultas.

---

## Panorama das frentes

| Frente | Resultado |
|---|---|
| Superfícies gerais | 2 corrigidos — merged |
| Pagamentos | 1 endurecido — merged |
| Arquivos + headers | HSTS — merged |
| RBAC | sem achados |
| E-mail e tokens | sem achados |
| Push / service worker | SSRF cego no endpoint 🟡 (P1) |
| Observabilidade | e-mail fora da máscara 🟢 (P2) |
| Dados / cache / métricas | sem achados |
| **Escala (10 mil)** | **fan-out de push não escala 🟠 (P3)** |
