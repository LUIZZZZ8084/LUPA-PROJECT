import type { Role } from "@/lib/types";
import { erros } from "../errors";

/**
 * Controle de acesso por papel.
 *
 * A matriz é declarativa de propósito: dá para ler numa tela quem pode o
 * quê. Permissão espalhada em `if` dentro de cada função é como se descobre,
 * meses depois, que uma empresa consegue ver a candidatura de outra.
 */

/** Admin não está em `Role` porque não é um papel de cadastro público. */
export type Papel = Role | "admin";

export const PAPEIS: readonly Papel[] = [
  "candidato_clt",
  "prestador_servico",
  "empresa",
  "admin",
] as const;

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && PAPEIS.includes(valor as Papel);
}

/**
 * Capacidades, nomeadas por recurso e verbo.
 *
 * O sufixo `_propria` é o que importa: dizer que empresa pode "editar vaga"
 * não diz *qual* vaga. A checagem de dono continua sendo feita na consulta,
 * mas o nome da capacidade deixa a exigência explícita.
 */
export type Capacidade =
  // Perfil
  | "perfil:editar_proprio"
  | "perfil:enviar_documento"
  /*
   * Ativar o lado prestador de uma conta que já existe.
   *
   * Só o candidato tem: a empresa não vira prestador (é outra pessoa
   * jurídica, com CNPJ, não CPF), o prestador já é, e o admin não age no
   * lugar de ninguém. Capacidade própria, e não um `if` na tela, porque é
   * a matriz que responde "quem pode virar o quê" — a tela só pergunta.
   *
   * A troca é de mão única de propósito: quem ativa deixa de se candidatar
   * a vagas. Voltar atrás é caso de suporte, como a cidade e o CNPJ.
   */
  | "prestador:ativar"
  // Vagas
  | "vaga:publicar"
  | "vaga:editar_propria"
  | "vaga:encerrar_propria"
  | "vaga:ver_candidaturas_proprias"
  // Candidaturas
  | "candidatura:criar"
  | "candidatura:ver_propria"
  | "candidatura:mover_estagio"
  /*
   * Procurar entre quem pediu para ser encontrado.
   *
   * Capacidade própria, e não uma das de vaga, porque o alcance é outro:
   * as de vaga terminam em quem se candidatou àquela vaga, e esta começa
   * em quem nunca se candidatou a nada. Quem consente é o candidato, no
   * `visivel_para_empresas` — a capacidade só diz quem pode perguntar.
   */
  | "candidato:buscar_disponiveis"
  // Publicações no perfil
  | "publicacao:criar"
  | "publicacao:editar_propria"
  | "publicacao:arquivar_propria"
  // Avaliações
  | "avaliacao:receber"
  /*
   * Avaliar um prestador.
   *
   * Vale para qualquer conta de gente — entrar já é pré-requisito para
   * usar o app, e quem contratou pode ser candidato, outro prestador ou
   * uma empresa. O admin fica de fora pela regra da casa: ele enxerga
   * tudo e não age no lugar de ninguém, e reputação é ação com autor.
   */
  | "avaliacao:escrever"
  // Administração
  | "admin:painel"
  | "admin:metricas"
  | "admin:decidir_verificacao"
  | "admin:moderar";

const NENHUMA: readonly Capacidade[] = [];

/** Quem pode o quê. Esta é a fonte da verdade. */
const MATRIZ: Record<Papel, readonly Capacidade[]> = {
  candidato_clt: [
    "perfil:editar_proprio",
    "perfil:enviar_documento",
    "candidatura:criar",
    "candidatura:ver_propria",
    "prestador:ativar",
    "avaliacao:escrever",
  ],

  prestador_servico: [
    "perfil:editar_proprio",
    "perfil:enviar_documento",
    /*
     * Ver as candidaturas antigas, sem poder criar novas.
     *
     * Quem virou prestador deixou de se candidatar — mas o que ela já fez
     * continua sendo dela. Sem esta linha, `/perfil/candidaturas`
     * responderia 404 no dia seguinte à troca, e a pessoa concluiria que o
     * app perdeu o histórico dela. `candidatura:criar` fica de fora, que é
     * o que a troca de papel de fato tira.
     */
    "candidatura:ver_propria",
    "publicacao:criar",
    "publicacao:editar_propria",
    "publicacao:arquivar_propria",
    "avaliacao:receber",
    "avaliacao:escrever",
    /*
     * Contratar também é coisa de prestador.
     *
     * Decisão do Luiz em 03/09/2026: a aba Empresa deixa de ser só de PJ.
     * Produtor rural, autônomo e prestador contratam ajudante, e barrar
     * isso deixava a barra inferior mostrando um item que dava 404.
     *
     * Só a leitura do painel entra agora. Publicar vaga exige um perfil de
     * contratante, que hoje pede CNPJ — e passar a aceitar CPF é migração
     * própria, na Issue seguinte.
     */
    "vaga:ver_candidaturas_proprias",
  ],

  empresa: [
    "perfil:editar_proprio",
    "perfil:enviar_documento",
    "vaga:publicar",
    "vaga:editar_propria",
    "vaga:encerrar_propria",
    "vaga:ver_candidaturas_proprias",
    "candidatura:mover_estagio",
    "candidato:buscar_disponiveis",
    "publicacao:criar",
    "publicacao:editar_propria",
    "publicacao:arquivar_propria",
    "avaliacao:escrever",
  ],

  /*
   * Admin enxerga tudo; não age no lugar de ninguém.
   *
   * Decisão do Luiz (31/08): quem administra a ferramenta é o responsável
   * por ela e precisa alcançar o que existe lá dentro para dar suporte —
   * inclusive a lista de candidatos disponíveis.
   *
   * O que continua fora é **escrita no lugar de outro papel**: publicar
   * vaga, se candidatar, mover a candidatura de uma empresa. Não é
   * desconfiança de quem administra; é que essas ações têm dono, e um
   * acesso comprometido que pode agir como empresa não deixa rastro de
   * que não era a empresa. Se um dia for preciso, que seja por
   * personificação registrada em log — aí a ação continua tendo autor.
   */
  admin: [
    "admin:painel",
    "admin:metricas",
    "admin:decidir_verificacao",
    "admin:moderar",
    "perfil:editar_proprio",
    "candidato:buscar_disponiveis",
  ],
};

export function capacidadesDe(papel: Papel): readonly Capacidade[] {
  return MATRIZ[papel] ?? NENHUMA;
}

export function pode(papel: Papel, capacidade: Capacidade): boolean {
  return capacidadesDe(papel).includes(capacidade);
}

/* ============================================================
   Guardas
   ============================================================ */

export interface Autenticado {
  usuarioId: string;
  papel: Papel;
}

/**
 * Exige um dos papéis informados.
 *
 * Sem sessão devolve `nao_autenticado` (401), que a interface traduz em
 * "entre para continuar". Com sessão e papel errado devolve `sem_permissao`.
 */
export function exigirPapel<T extends Autenticado>(
  sessao: T | null,
  ...permitidos: Papel[]
): T {
  if (!sessao) throw erros.naoAutenticado("sem sessão");

  if (!permitidos.includes(sessao.papel)) {
    throw erros.semPermissao(
      `papel ${sessao.papel} fora de [${permitidos.join(", ")}]`,
    );
  }

  return sessao;
}

export function exigirCapacidade<T extends Autenticado>(
  sessao: T | null,
  capacidade: Capacidade,
): T {
  if (!sessao) throw erros.naoAutenticado("sem sessão");

  if (!pode(sessao.papel, capacidade)) {
    throw erros.semPermissao(`${sessao.papel} não tem ${capacidade}`);
  }

  return sessao;
}

/**
 * Exige que o registro pertença a quem está pedindo.
 *
 * Capacidade responde "pode editar vaga?"; isto responde "pode editar *esta*
 * vaga?". Sem a segunda pergunta, qualquer empresa autenticada alcança a
 * vaga de qualquer outra trocando o id na URL.
 */
export function exigirDono(
  sessao: Autenticado | null,
  donoId: string,
  oQue: string,
): void {
  if (!sessao) throw erros.naoAutenticado("sem sessão");
  if (sessao.papel === "admin") return;

  if (sessao.usuarioId !== donoId) {
    // "Não encontrado", e não "sem permissão": responder 403 confirma que o
    // registro existe, e isso já é informação para quem está sondando ids.
    throw erros.naoEncontrado(oQue);
  }
}
