/**
 * O que produção exige para funcionar, conferido quando o processo sobe.
 *
 * Existe por causa de um prejuízo concreto. Em 10/09/2026 a primeira venda
 * de verdade da Lupa — R$ 29,90, aprovada no Mercado Pago — não chegou ao
 * app: o aviso foi entregue na URL certa e **nós o recusamos com 401**,
 * porque o deploy no ar carregava um `MERCADO_PAGO_WEBHOOK_SECRET`
 * diferente do que o Mercado Pago usava para assinar. O dinheiro entrou, a
 * cobrança ficou `pendente` para sempre, e a única pista foi um `log.warn`
 * por notificação — que ninguém lê.
 *
 * **Falha fechada estava certa; silenciosa é que não.** Recusar
 * notificação que não se pode provar é a decisão correta, e continua
 * valendo. O que faltava era a diferença entre "alguém está forjando
 * webhook" e "este deploy subiu sem configuração" — e essa diferença é
 * conhecida no instante em que o processo sobe, não no meio de um
 * pagamento ([#196]).
 *
 * **Tudo de uma vez, não um por deploy.** A lista inteira sai na mesma
 * mensagem: descobrir a segunda variável faltando só depois de corrigir a
 * primeira custa mais um ciclo de deploy, e quem está lendo esse erro está
 * com o site fora do ar.
 *
 * **`VERCEL_ENV`, e não `NODE_ENV`.** A Vercel compila preview com
 * `NODE_ENV=production` também, e o `npm run build` da suíte e2e igual —
 * nenhum dos dois é o site de verdade, e derrubá-los tiraria justamente os
 * ambientes onde se testa antes de publicar. É a mesma escolha de
 * `urlPublica()`, feita pelo mesmo motivo ([#195]).
 *
 * [#195]: https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/195
 * [#196]: https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/196
 */

/**
 * O ambiente como um mapa simples, e nao `NodeJS.ProcessEnv`.
 *
 * O projeto declara as variaveis que conhece, e o tipo resultante exige
 * todas — que e exatamente o que este arquivo nao pode receber para
 * testar "faltando a variavel X". Medir a decisao nao deveria obrigar a
 * montar um ambiente inteiro.
 */
type Ambiente = Record<string, string | undefined>;

/**
 * O tamanho mínimo do segredo que assina a sessão.
 *
 * Mora aqui, e não em `auth/session.ts`, porque este arquivo é carregado
 * pela `instrumentation.ts` e não importa nada — trazer o módulo de sessão
 * para a subida do processo arrastaria `jose` e o logger junto. A sessão
 * importa daqui, e as duas regras são uma só.
 */
export const SEGREDO_DE_SESSAO_MINIMO = 32;

interface Exigencia {
  nome: string;
  /** Por que ela é obrigatória, na voz de quem vai ler o deploy vermelho. */
  porque: string;
  /**
   * `false` tira a exigência da lista.
   *
   * Nem toda variável é obrigatória sempre: o segredo do webhook só faz
   * sentido onde existe cobrança de verdade.
   */
  exigida: (ambiente: Ambiente) => boolean;
  /**
   * Se o valor presente serve. Sem ela, qualquer valor não vazio serve.
   *
   * Existe para o segredo da sessão: um valor curto demais não é
   * "configurado errado, mas funcionando" — `segredo()` o recusa na hora
   * de assinar, e ninguém consegue entrar.
   */
  valida?: (valor: string) => boolean;
}

const sempre = () => true;

const EXIGENCIAS: Exigencia[] = [
  {
    nome: "SESSION_SECRET",
    porque:
      "é a chave que assina o login. Sem ela, ou com menos de " +
      `${SEGREDO_DE_SESSAO_MINIMO} caracteres, o site abriria normalmente ` +
      "e ninguém conseguiria entrar: toda sessão seria lida como " +
      "inexistente, e o login falharia com erro interno. Gere uma com " +
      "node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\" " +
      "e cadastre como Secret",
    exigida: sempre,
    /*
     * A mesma regra de `segredo()`, e não uma parecida (#271).
     *
     * Aquela função já recusava valor curto, só que tarde: na hora de
     * assinar, com `lerSessao` engolindo a exceção em silêncio. Aqui a
     * recusa acontece antes de atender alguém.
     */
    valida: (valor) => valor.length >= SEGREDO_DE_SESSAO_MINIMO,
  },
  {
    nome: "NEXT_PUBLIC_APP_URL",
    porque:
      "é a raiz dos links que saem do app para fora — o webhook e o retorno " +
      "do Mercado Pago, e o link do e-mail de recuperação. Sem ela, esses " +
      "endereços caem na URL gerada do deploy, que muda a cada publicação. " +
      "Use https://lupapp.com.br",
    exigida: sempre,
  },
  {
    nome: "MERCADO_PAGO_WEBHOOK_SECRET",
    porque:
      "é o que prova que uma notificação de pagamento veio mesmo do Mercado " +
      "Pago. Sem ela, toda notificação é recusada com 401 e nenhuma cobrança " +
      "é confirmada — o dinheiro entra e o app não fica sabendo. Copie a " +
      "assinatura secreta em Webhooks > Modo de produção",
    /*
     * Só onde há cobrança de verdade.
     *
     * Sem `MERCADO_PAGO_ACCESS_TOKEN` o app roda em demonstração de
     * pagamento — aprova na hora, sem falar com o Mercado Pago — e não
     * existe webhook nenhum para provar. Exigir o segredo ali derrubaria um
     * ambiente que nunca vai receber notificação.
     */
    exigida: (ambiente) => Boolean(ambiente.MERCADO_PAGO_ACCESS_TOKEN?.trim()),
  },
];

/**
 * Derruba o processo se faltar configuração obrigatória em produção.
 *
 * Chamada por `src/instrumentation.ts`, que o Next executa uma vez por
 * processo, antes de atender qualquer requisição.
 */
export function conferirConfiguracaoDeProducao(
  ambiente: Ambiente = process.env,
): void {
  if (ambiente.VERCEL_ENV !== "production") return;

  const faltando = EXIGENCIAS.filter((e) => {
    if (!e.exigida(ambiente)) return false;
    const valor = ambiente[e.nome]?.trim();
    if (!valor) return true;
    return e.valida ? !e.valida(valor) : false;
  });

  /*
   * O multiplicador de limite é de suíte de teste, e em produção seria
   * uma variável de ambiente desligando a proteção sem ninguém perceber —
   * a mesma classe de coisa que a #195 e a #196 já custaram caro. Vale
   * derrubar: quem a definiu aqui fez por engano.
   */
  const multiplicador = ambiente.LIMITE_MULTIPLICADOR?.trim();
  if (multiplicador && multiplicador !== "1") {
    throw new Error(
      `LIMITE_MULTIPLICADOR está definido como "${multiplicador}" em ` +
        "produção, e isso afrouxa o teto de volume de todas as ações. Ele " +
        "existe só para a suíte e2e, onde uma conta faz o trabalho de " +
        "muitas. Remova a variável na Vercel e republique.",
    );
  }

  /*
   * A chave anônima ainda pelo nome publicável (#221).
   *
   * Avisa, não derruba, e a diferença é a mesma que este arquivo já pesa
   * em todo lugar: derrubar produção por causa de um **nome** de variável
   * trocaria um risco hipotético por uma indisponibilidade real. O valor
   * lido é o mesmo pelos dois nomes; o que muda é a promessa que o nome
   * faz.
   *
   * `NEXT_PUBLIC_` manda o Next embutir o valor no bundle do navegador.
   * Hoje isso não acontece porque nada no cliente importa `supabase/config`
   * — e esse módulo agora é `server-only`, então passou a ser erro de
   * build. O aviso existe para o nome sair da Vercel também, e não ficar
   * de pé como armadilha para quem vier depois.
   */
  const soNomeAntigo =
    !ambiente.SUPABASE_ANON_KEY?.trim() &&
    Boolean(ambiente.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (soNomeAntigo) {
    console.warn(
      "[config] a chave anônima do Supabase ainda vem de " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY. O prefixo manda o Next embutir o " +
        "valor no JavaScript do navegador, e quem a tiver lê telefone de " +
        "todo prestador sem login. Crie SUPABASE_ANON_KEY na Vercel " +
        "(Production) com o mesmo valor, apague a antiga e republique.",
    );
  }

  if (faltando.length === 0) return;

  throw new Error(
    `Configuração obrigatória ausente ou inválida em produção: ${faltando
      .map((e) => e.nome)
      .join(", ")}.\n\n${faltando
      .map((e) => `• ${e.nome} — ${e.porque}.`)
      .join(
        "\n",
      )}\n\nDefina na Vercel, em Production, e republique: variável de ambiente só vale para deploy novo.`,
  );
}
