/**
 * Vagas do painel da empresa.
 *
 * Publicar, editar e encerrar seguem o mesmo contrato de duas
 * implementações que o resto do servidor: o que os testes exercitam é o
 * mesmo caminho que roda em produção, e o modo demonstração continua
 * funcionando sem banco.
 */

import type { PerguntaDeTriagem } from "@/lib/triagem";
import type { WorkMode } from "@/lib/types";

export type StatusVaga = "aberta" | "fechada";

export interface Vaga {
  id: string;
  empresaId: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  cidade: string;
  bairro: string | null;
  /** Rua, número, referência — texto livre, informativo. `null` em vaga
   * publicada antes deste campo existir; nunca decide ranking. */
  endereco: string | null;
  tipoContrato: string | null;
  /** Presencial, home office ou híbrido (#300). `null` em vaga publicada
   * antes deste campo existir. */
  modalidade: WorkMode | null;
  /** Vaga para pessoa com deficiência (#456). Antiga é `false`. */
  paraPcd: boolean;
  /**
   * A vaga é para um cliente de quem publicou, e esta é a descrição dele,
   * sem o nome (#538). `null` é a vaga comum, da própria empresa.
   */
  contratanteConfidencial: string | null;
  /**
   * Quando a moderação tirou a vaga do ar (#577). Ausente ou nulo é a vaga
   * que não foi removida — encerrar pela própria empresa não marca isto.
   */
  removidaEm?: string | null;
  salarioMin: number | null;
  salarioMax: number | null;
  habilidades: string[];
  /**
   * Até três perguntas de sim ou não para quem se candidata (#491). Vazio na
   * maioria das vagas e em toda vaga publicada antes de elas existirem.
   * Não se edita depois de publicada (#544): mudar a pergunta mudaria o
   * critério para quem já respondeu.
   */
  perguntas: PerguntaDeTriagem[];
  status: StatusVaga;
  criadoEm: string;
  /** 30 dias após publicar, ou após a última reativação manual. Nunca é
   * lido sozinho — sempre junto de `status`, por `vagaExpirada`. */
  expiraEm: string;
}

export interface DadosNovaVaga {
  empresaId: string;
  titulo: string;
  descricao: string;
  categoria: string;
  cidade: string;
  bairro?: string | null;
  endereco: string;
  tipoContrato: string;
  modalidade: WorkMode;
  paraPcd: boolean;
  contratanteConfidencial?: string | null;
  salarioMin?: number | null;
  salarioMax?: number | null;
  habilidades?: string[];
  perguntas?: PerguntaDeTriagem[];
  /**
   * Quem publicou — só o repositório em memória usa (#489).
   *
   * Em demonstração toda conta publica sob a mesma empresa fictícia, e sem
   * saber quem publicou o limite do plano contaria as vagas de exemplo e as
   * das outras contas: o Plano 5 de uma conta nova já nasceria cheio. No
   * banco a empresa é a conta, e o campo não faz nada.
   */
  publicadaPor?: string;
}

export type EdicaoVaga = Partial<
  Pick<
    Vaga,
    | "titulo"
    | "descricao"
    | "categoria"
    | "cidade"
    | "bairro"
    | "endereco"
    | "habilidades"
    | "tipoContrato"
    | "modalidade"
    | "paraPcd"
    | "salarioMin"
    | "salarioMax"
  >
>;

export interface RepositorioVagas {
  porId(id: string): Promise<Vaga | null>;
  porEmpresa(empresaId: string): Promise<Vaga[]>;
  /** Todas as vagas, de qualquer empresa — usado pela busca pública. */
  listar(): Promise<Vaga[]>;
  /**
   * As vagas abertas que ainda estão no ar e vencem até `limite` (#561),
   * da que vence primeiro para a última. É a lista do aviso de vencimento.
   */
  vencendoAte(agora: string, limite: string): Promise<Vaga[]>;
  /**
   * Quantas vagas da empresa estão no ar agora: abertas e dentro dos 30
   * dias (#489). É o número que o limite dos planos compara — vaga
   * encerrada ou vencida não ocupa lugar.
   *
   * `publicadaPor` separa o que cada conta publicou quando várias dividem
   * a mesma empresa — a demonstração. No banco é ignorado.
   */
  contarNoAr(empresaId: string, publicadaPor?: string): Promise<number>;
  criar(dados: DadosNovaVaga): Promise<Vaga>;
  atualizar(id: string, campos: EdicaoVaga): Promise<Vaga>;
  /** `pelaModeracao` marca a vaga como removida, além de encerrada (#577). */
  encerrar(id: string, opcoes?: { pelaModeracao?: boolean }): Promise<Vaga>;
  /** Renova o prazo por mais 30 dias. Não mexe em `status` — só quem
   * ficou "aberta" e passou do prazo tinha o que reativar. */
  reativar(id: string): Promise<Vaga>;
}
