import "server-only";

import {
  type CandidatoDisponivel,
  empresaDoPainel,
  getCandidatosDisponiveis,
  getCompanyApplications,
} from "@/lib/data";
import { grauDeProximidade, type Origem } from "@/lib/proximidade";
import { formaCanonica } from "@/lib/skills";
import { type Autenticado, pode } from "../auth/rbac";
import { repositorioUsuarios } from "../repositories";

/**
 * Procurar entre quem pediu para ser encontrado.
 *
 * O `AGENTS.md` registra "busca livre de candidatos" como fora do escopo
 * **por decisão**: numa cidade do tamanho de Sinop, quem está empregado e
 * procurando outra coisa pode ter o patrão atual entre as empresas
 * cadastradas. Essa razão não mudou — e é por isso que isto não é uma
 * busca livre.
 *
 * O que mudou foi o consentimento passar a existir. Só aparece aqui quem
 * ligou `visivel_para_empresas` no próprio perfil, desligado por padrão, e
 * a fechadura mora no `where` da view `candidatos_disponiveis` — não na
 * aplicação. Assim nenhum esquecimento de filtro numa tela revela quem não
 * consentiu, e desligar tira a pessoa na mesma consulta.
 *
 * **O que se alcança aqui é contato, não currículo.** São dois
 * consentimentos diferentes: quem se candidata entrega o currículo junto
 * com a candidatura; quem só está visível entregou o contato. A view não
 * traz currículo nem resumo, e é ela que responde a esta tela.
 */

export interface FiltrosDeCandidato {
  /** Casa contra as habilidades declaradas, pela tabela de sinônimos. */
  habilidade?: string;
  /** Uma das `JOB_CATEGORIES`. */
  area?: string;
}

export interface CandidatoNaBusca extends CandidatoDisponivel {
  /** Habilidades que casaram com o filtro, para a tela destacar. */
  casadas: string[];
}

/**
 * Devolve `[]` — e não erro — para quem não pode buscar.
 *
 * A página chama `notFound()` nesse caso, seguindo a regra da casa de
 * responder "não encontrado" em vez de "sem permissão": um 403 confirma
 * que a área existe para quem está sondando.
 */
export async function candidatosDisponiveis(
  sessao: Autenticado | null,
  filtros: FiltrosDeCandidato = {},
): Promise<CandidatoNaBusca[]> {
  if (!sessao || !pode(sessao.papel, "candidato:buscar_disponiveis")) return [];

  const [todos, quemBusca] = await Promise.all([
    getCandidatosDisponiveis(),
    repositorioUsuarios().porId(sessao.usuarioId),
  ]);

  const procurada = filtros.habilidade?.trim()
    ? formaCanonica(filtros.habilidade)
    : null;

  const encontrados: CandidatoNaBusca[] = [];

  for (const c of todos) {
    if (filtros.area && c.desired_area !== filtros.area) continue;

    /*
     * O filtro de habilidade passa pela mesma tabela de sinônimos do
     * casamento com a vaga: quem procura "CNH D" precisa achar quem
     * escreveu "carteira D". Sem isso, o vocabulário de quem digitou o
     * filtro decidiria o resultado.
     */
    const casadas = procurada
      ? c.skills.filter((s) => formaCanonica(s) === procurada)
      : [];

    if (procurada && casadas.length === 0) continue;

    encontrados.push({ ...c, casadas });
  }

  /*
   * Ordena pelo mais perto de quem está contratando, sem filtrar por isso
   * — a mesma escada de `/vagas` e `/servicos`. A empresa de Sinop vê
   * primeiro quem é de Sinop, e continua alcançando quem é de Sorriso.
   *
   * Sem a cidade de quem busca não há de onde medir; aí a ordem é o nome,
   * que ao menos é estável entre recargas.
   */
  const daEmpresa: Origem | null = quemBusca
    ? { cidade: quemBusca.cidade, bairro: quemBusca.bairro }
    : null;

  return encontrados.sort((a, b) => {
    if (daEmpresa) {
      const grau = (c: CandidatoNaBusca) =>
        grauDeProximidade(daEmpresa, {
          cidade: c.city,
          bairro: c.neighborhood,
        });

      const diferenca = grau(a) - grau(b);
      if (diferenca !== 0) return diferenca;
    }

    return a.full_name.localeCompare(b.full_name, "pt-BR");
  });
}

export interface PerfilDeCandidato {
  candidato: CandidatoDisponivel;
  /**
   * Se esta pessoa se candidatou a uma vaga desta empresa, o id da
   * candidatura — que é o caminho para a ficha, com currículo.
   *
   * `null` quer dizer que ela só está disponível: entregou contato, não
   * currículo. São dois consentimentos diferentes, e a ausência aqui é o
   * que impede a tela de oferecer o que o segundo não autorizou.
   */
  candidaturaId: string | null;
}

/**
 * Um candidato, para a tela de perfil.
 *
 * `null` tanto para "não existe" quanto para "não consentiu" quanto para
 * "você não pode" — os três levam a `notFound()`. Distinguir confirmaria,
 * para quem sonda ids, que a pessoa existe e está procurando emprego, que
 * é exatamente a informação que o opt-in protege.
 */
export async function perfilDoCandidato(
  sessao: Autenticado | null,
  id: string,
): Promise<PerfilDeCandidato | null> {
  if (!sessao || !pode(sessao.papel, "candidato:buscar_disponiveis")) {
    return null;
  }

  const todos = await getCandidatosDisponiveis();
  const candidato = todos.find((c) => c.id === id);
  if (!candidato) return null;

  /*
   * A candidatura é procurada entre as *desta* empresa. Buscar por
   * candidato e conferir o dono depois daria o mesmo resultado hoje e
   * deixaria a porta aberta para alguém esquecer a segunda metade — o
   * mesmo raciocínio da ficha em `candidaturas/ficha.ts`.
   */
  const daEmpresa = await getCompanyApplications(
    empresaDoPainel(sessao.usuarioId),
  );

  return {
    candidato,
    candidaturaId: daEmpresa.find((c) => c.candidate_id === id)?.id ?? null,
  };
}
