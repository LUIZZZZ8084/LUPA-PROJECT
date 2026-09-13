import "server-only";

/**
 * Quanto cada ação pode ser chamada, e por quem (#202).
 *
 * Até aqui só autenticação tinha teto. Todo o resto — candidatar-se,
 * publicar vaga, avaliar, comprar crédito, mexer no perfil — podia ser
 * chamado à vontade. O que acaba nesse caso não é o banco: são 3 conexões
 * de PostgREST servindo consulta indexada, e elas aguentam. O que acaba é
 * a **cota da Vercel** — "cai tudo" por esgotamento de plano, não por
 * sobrecarga.
 *
 * **É uma matriz declarativa, como o RBAC, e pelo mesmo motivo.** Teto
 * espalhado em 31 actions é teto que alguém esquece na trigésima segunda.
 * Aqui a lista inteira cabe numa tela, e há teste que reprova action nova
 * sem entrada nesta tabela — a mesma disciplina de `ROTAS_NAO_VARRIDAS`:
 * quando a cobertura é uma lista, alguém precisa cobrar a lista.
 *
 * ## A chave é o usuário, não o IP
 *
 * O app é **todo fechado por login**, então todo abuso carrega sessão — e
 * limitar por `usuarioId` é preciso.
 *
 * IP seria pior aqui, e não por pouco: em Sinop, uma lan house, um
 * escritório ou um provedor de rádio põem dezenas de pessoas atrás do
 * mesmo endereço. Limitar por IP puniria todas por causa de uma, e o
 * público deste app é exatamente quem usa conexão compartilhada.
 *
 * Sem sessão cai no IP, porque aí não há o que mais usar — e é o que
 * cadastro e recuperação de senha já fazem, onde o IP é a chave certa
 * justamente porque a conta ainda não existe.
 */

export interface Orcamento {
  /** Chamadas que cabem na janela. */
  chamadas: number;
  /** O tamanho da janela. */
  janelaSegundos: number;
}

/**
 * Dez minutos para quase tudo.
 *
 * A janela decide o **custo do engano**, não só o do abuso: quem estourar
 * espera esse tanto. Uma hora puniria demais quem clicou rápido demais de
 * boa-fé; um minuto não conteria robô nenhum. Dez minutos incomoda pouco
 * quem errou e continua inviabilizando quem quer volume.
 */
const JANELA = 10 * 60;

/**
 * Quantas vezes o orçamento cabe além do normal neste ambiente.
 *
 * Existe por causa da suíte e2e, e o motivo é honesto: ela roda **uma
 * conta só** fazendo o trabalho de muitas, em dois navegadores, e na CI
 * com `retries: 2` — cada retentativa republica. Um teto por pessoa
 * enxerga isso como uma pessoa absurdamente ocupada, e foi exatamente o
 * que aconteceu: passou local (sem retentativa) e reprovou na CI.
 *
 * **Não se sobe o teto de produção para caber um teste.** Dez publicações
 * em dez minutos continua sendo mais do que gente faz; quem não é gente é
 * a suíte. Ela declara o próprio multiplicador, como já declara o segredo
 * de sessão e a URL pública, e continua exercitando todo o caminho do
 * limite — o que se perde é só o ponto em que ele morde.
 *
 * Em produção isto é **recusado**, não ignorado: multiplicador ali seria
 * desligar a proteção com uma variável de ambiente que ninguém lembra de
 * conferir. Ver `conferirConfiguracaoDeProducao`.
 */
const MULTIPLICADOR = (() => {
  const cru = Number(process.env.LIMITE_MULTIPLICADOR ?? "1");
  return Number.isFinite(cru) && cru >= 1 ? Math.floor(cru) : 1;
})();

function porJanela(chamadas: number): Orcamento {
  return { chamadas: chamadas * MULTIPLICADOR, janelaSegundos: JANELA };
}

/**
 * O orçamento de cada ação, pelo nome que ela declara em `criarAcao`.
 *
 * Os números são generosos de propósito: eles existem para barrar script,
 * não gente apressada. Quem procura emprego numa tarde se candidata a
 * muitas vagas, e a empresa que recebeu trinta currículos move trinta
 * candidaturas de uma sentada — nenhum dos dois pode esbarrar nisto.
 */
export const ORCAMENTOS: Record<string, Orcamento> = {
  // Sair é barato, mas não precisa de rajada.
  "auth.sair": porJanela(20),

  /*
   * Candidatar-se é o verbo mais usado do app, e por quem tem menos
   * paciência com erro. Quinze em dez minutos é mais do que alguém
   * consegue ler e decidir — quem passa disso não está lendo.
   */
  "candidatura.criar": porJanela(15),
  "candidatura.mover_estagio": porJanela(60),

  /*
   * Publicar já custa uma vaga do saldo, então o dinheiro é o primeiro
   * limite. Este é o segundo, para o caso de plano mensal ilimitado — onde
   * não há saldo nenhum contendo volume.
   */
  "vaga.publicar": porJanela(10),
  "vaga.encerrar": porJanela(30),
  "vaga.reativar": porJanela(15),

  /*
   * O banco já garante uma avaliação por par de pessoas. O teto aqui é
   * contra quem varre a lista de prestadores tentando.
   */
  "avaliacao.criar": porJanela(5),

  // O limite de 10 ativas mora no banco; este contém a repetição.
  "publicacao.criar": porJanela(15),
  "publicacao.editar": porJanela(20),
  "publicacao.arquivar": porJanela(20),
  "publicacao.reativar": porJanela(20),
  "publicacao.publicar-trabalho": porJanela(15),
  "publicacao.editar-trabalho": porJanela(20),

  // Edição de perfil: cada formulário é um assunto, e são vários.
  "perfil.conta": porJanela(20),
  "perfil.anuncio": porJanela(20),
  "perfil.empresa": porJanela(20),
  "perfil.curriculo": porJanela(20),

  /*
   * Tudo que fala com o Mercado Pago é mais apertado: cada chamada cria
   * recurso do lado de lá, e rajada aqui vira preferência órfã na conta.
   */
  "prestador.assinar_mensalidade": porJanela(5),
  "prestador.cancelar_renovacao": porJanela(5),
  "empresa.comprar_creditos": porJanela(5),
  "candidato.comprar_gerador_curriculo": porJanela(5),

  // Trocar de papel é caso único na vida da conta.
  "prestador.ativar": porJanela(5),

  "notificacao.inscrever": porJanela(15),
  "notificacao.preferencia": porJanela(15),
  "notificacao.desligar": porJanela(15),
};

/**
 * As ações que **não** passam por este teto, e por quê.
 *
 * Não é lista de esquecidas: é lista de decididas. A razão fica escrita
 * aqui porque "não tem limite" e "tem limite noutro lugar" parecem iguais
 * de fora, e confundir as duas foi o que deixou a fila de verificação
 * prometendo uma tela que nunca existiu.
 */
export const SEM_ORCAMENTO: Record<string, string> = {
  "auth.entrar":
    "tem limite próprio, por e-mail, em `rate-limit.ts` — e a regra lá é " +
    "outra: sucesso zera o contador, porque o que se contém é adivinhação " +
    "de senha, não volume.",
  "auth.cadastrar":
    "tem limite próprio, por origem, e ali o sucesso **conta** — quem cria " +
    "conta em massa troca de e-mail a cada tentativa.",
  "auth.pedir_recuperacao":
    "tem limite próprio, por origem, pela mesma razão do cadastro: o que " +
    "se contém é o envio de e-mail em nome da Lupa.",
  "auth.redefinir_senha":
    "o token é gasto na mesma instrução que o valida, e vale uma vez só — " +
    "não há volume a conter depois disso.",
};
