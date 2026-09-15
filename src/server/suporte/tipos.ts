/**
 * Mensagens de suporte (#235).
 *
 * O canal por formulário existe porque o público deste app abre e-mail no
 * celular e boa parte não tem cliente de e-mail configurado. Mandar a pessoa
 * "escrever para contato@" é mandar metade dela desistir — e quem escreve
 * para o suporte de uma plataforma de emprego costuma estar com um problema
 * que não pode esperar.
 *
 * **A mensagem é gravada e enviada por e-mail.** Só gravar dependeria de
 * alguém abrir o painel do admin, que é a promessa quebrada que este projeto
 * registra cinco vezes; só enviar perderia a mensagem se o provedor
 * estivesse fora do ar. As duas juntas: a linha fica, e o aviso vai para uma
 * caixa que alguém abre.
 */

/**
 * Para onde a mensagem vai ser encaminhada internamente.
 *
 * `privacidade` existe separado de propósito: pedido do art. 18 da LGPD tem
 * prazo legal de resposta, e misturá-lo com "meu anúncio sumiu" é como se
 * perde um prazo.
 */
export type AssuntoSuporte =
  | "conta"
  | "pagamento"
  | "anuncio"
  | "privacidade"
  | "outro";

export const ASSUNTOS: Record<AssuntoSuporte, string> = {
  conta: "Não consigo entrar na minha conta",
  pagamento: "Paguei e algo não aconteceu",
  anuncio: "Meu anúncio ou minha vaga",
  privacidade: "Meus dados (cópia, correção ou exclusão)",
  outro: "Outro assunto",
};

export interface NovaMensagemDeSuporte {
  /** Nulo quando quem escreve não conseguiu entrar — o caso mais comum. */
  usuarioId: string | null;
  nome: string;
  email: string;
  assunto: AssuntoSuporte;
  mensagem: string;
}

export interface RepositorioSuporte {
  registrar(dados: NovaMensagemDeSuporte): Promise<void>;
}
