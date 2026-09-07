/**
 * Contrato do repositório de notificações.
 *
 * Duas coisas separadas de propósito:
 *
 * - **A preferência** é da pessoa: uma cidade e, opcionalmente, uma
 *   categoria. Uma por conta.
 * - **A inscrição** é do aparelho. Quem usa celular e computador quer ser
 *   avisado nos dois, então são várias por pessoa.
 *
 * Juntá-las numa tabela só faria a pessoa perder a preferência ao trocar de
 * telefone, que é exatamente quando ela menos vai lembrar de reconfigurar.
 */

export interface PreferenciaNotificacao {
  usuarioId: string;
  cidade: string;
  /** `null` significa todas as categorias daquela cidade. */
  categoria: string | null;
}

/**
 * O que o navegador devolve ao inscrever o aparelho.
 *
 * `p256dh` e `auth` são as chaves que cifram a mensagem até ele. São
 * segredo por aparelho — quem as tiver manda notificação em nome da Lupa
 * para aquela pessoa — e por isso vivem em tabela que a chave anônima não
 * alcança, como o hash de senha.
 */
export interface InscricaoPush {
  usuarioId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface RepositorioNotificacoes {
  preferencia(usuarioId: string): Promise<PreferenciaNotificacao | null>;

  /** Cria ou substitui: uma preferência por pessoa. */
  salvarPreferencia(pref: PreferenciaNotificacao): Promise<void>;

  removerPreferencia(usuarioId: string): Promise<void>;

  /**
   * Quem pediu para ser avisado de vaga nesta cidade e categoria.
   *
   * `categoria` é a da vaga; quem não escolheu categoria nenhuma recebe
   * tudo o que sai na cidade dela. Devolve as inscrições, não as pessoas:
   * quem envia precisa do aparelho, e resolver isso aqui evita uma segunda
   * consulta por destinatário.
   *
   * **Vaga sem categoria alcança só quem pediu tudo.** O campo é opcional
   * em `vagas`, e nesse caso não há como saber se ela interessa a quem
   * escolheu "Agronegócio" — avisar mesmo assim ensinaria a pessoa a
   * ignorar o aviso, que é o pior desfecho possível para uma notificação.
   */
  inscricoesInteressadas(
    cidade: string,
    categoria: string | null,
  ): Promise<InscricaoPush[]>;

  /** Reinscrever o mesmo aparelho troca a linha, não duplica o aviso. */
  salvarInscricao(inscricao: InscricaoPush): Promise<void>;

  /**
   * Some com a inscrição de um aparelho.
   *
   * Chamado por dois motivos diferentes: a pessoa desligou, ou o serviço
   * de push respondeu que aquele endpoint morreu (404/410). O segundo é o
   * que impede a tabela de virar cemitério de aparelho trocado.
   */
  removerInscricao(endpoint: string): Promise<void>;

  inscricoesDe(usuarioId: string): Promise<InscricaoPush[]>;
}
