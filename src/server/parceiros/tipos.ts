/**
 * Uma parceria: quem usa a Lupa de graça por acordo com o Luiz (#505).
 *
 * A chave é o **e-mail**, e não a conta: a parceria costuma ser fechada
 * antes de a pessoa se cadastrar, e o admin só sabe o endereço. O benefício
 * chega à conta com aquele e-mail quando ela confirma que o endereço é dela.
 */
export interface Parceria {
  id: string;
  /** Sempre em minúsculas, como `usuarios.email`. */
  email: string;
  /** Como o admin chama a parceria: "Prefeitura de Sinop", "Agro Norte". */
  nome: string;
  /** Até quando vale, ou `null` para sem prazo. */
  validoAte: string | null;
  criadoEm: string;
  /** Quando o admin encerrou, ou `null` enquanto vale. */
  encerradoEm: string | null;
  /** A conta que recebeu o benefício, quando já recebeu. */
  usuarioId: string | null;
  /**
   * A validade que a parceria gravou na conta. Encerrar compara com ela:
   * se a conta pagou além disso, o que foi pago fica.
   */
  concedidoAte: string | null;
}

/** Em que pé a parceria está, do ponto de vista do admin. */
export type SituacaoDaParceria =
  /** Ninguém se cadastrou com este e-mail ainda. */
  | "sem_conta"
  /** A conta existe, e falta confirmar o e-mail. */
  | "email_nao_confirmado"
  /** O benefício está na conta. */
  | "ativa"
  /** A conta confirmou e não recebeu nada — o papel dela não tem o que pagar. */
  | "sem_beneficio"
  | "vencida"
  | "encerrada";

export interface LinhaDeParceria extends Parceria {
  situacao: SituacaoDaParceria;
}

export interface DadosDaParceria {
  email: string;
  nome: string;
  validoAte: string | null;
}

export interface RepositorioParceiros {
  /** Todas, as abertas primeiro, as mais novas no topo. */
  listar(): Promise<Parceria[]>;
  /** A parceria aberta deste e-mail, ou `null`. Uma por e-mail. */
  abertaPorEmail(email: string): Promise<Parceria | null>;
  porId(id: string): Promise<Parceria | null>;
  criar(dados: DadosDaParceria, criadoPor: string | null): Promise<Parceria>;
  /** Guarda a conta que recebeu e a validade gravada nela. */
  registrarConcessao(
    id: string,
    usuarioId: string,
    concedidoAte: string,
  ): Promise<void>;
  /** `null` quando não existe ou já estava encerrada. */
  encerrar(id: string): Promise<Parceria | null>;
}
