import "server-only";

import { empresaDoPainel, getCompanyApplications } from "@/lib/data";
import { formaCanonica } from "@/lib/skills";
import type { Autenticado } from "../auth/rbac";
import { temPainelDeEmpresa } from "../visualizacoes/servico";

/**
 * Quem já se candidatou a esta empresa, sem repetir (#494).
 *
 * O post do Instagram some em horas, e quem se candidatou a uma vaga antiga da
 * empresa ficava acessível só vaga por vaga: ao abrir outra vaga parecida, ela
 * começava do zero, mesmo tendo uma lista de gente que já se candidatou e
 * combina.
 *
 * **Isto não é um banco de talentos aberto.** O `AGENTS.md` registra a busca
 * livre de candidatos como fora do escopo por decisão, e a razão não mudou: o
 * patrão atual de alguém pode estar entre as empresas cadastradas. O limite
 * aqui é um fato do arranjo, o mesmo da ficha: **a empresa vê esta pessoa
 * porque ela se candidatou a uma vaga dela** — e só a essa empresa. Outra
 * empresa nunca alcança a candidatura, e a lista nunca sai das candidaturas
 * da própria empresa da sessão.
 *
 * O que muda é o alcance dentro da mesma empresa: a candidatura a uma vaga
 * continua disponível para as outras vagas dela. A Política de Privacidade diz
 * isso, e quem exclui a conta sai da lista — a candidatura é apagada junto.
 */

export interface Talento {
  /** Pessoa, e não candidatura: quem se candidatou a três vagas é uma linha. */
  candidatoId: string;
  nome: string;
  avatarUrl: string | null;
  cidade: string | null;
  areaDesejada: string | null;
  /** Habilidades que casaram com o filtro, para a tela destacar. */
  casadas: string[];
  /** A candidatura mais recente — é por ela que se abre a ficha. */
  ultima: {
    candidaturaId: string;
    vagaTitulo: string;
    em: string;
  };
  /** Em quantas vagas desta empresa a pessoa já se candidatou. */
  vagas: number;
}

export interface FiltrosDeTalentos {
  /** Casa contra as habilidades declaradas, pela tabela de sinônimos. */
  habilidade?: string;
  /** Uma das `JOB_CATEGORIES`. */
  area?: string;
}

/**
 * Devolve `[]` — e não erro — para quem não tem painel de empresa; a página
 * responde 404 nesse caso, pela regra da casa.
 */
export async function talentosDaEmpresa(
  sessao: Autenticado | null,
  filtros: FiltrosDeTalentos = {},
): Promise<Talento[]> {
  if (!sessao || !temPainelDeEmpresa(sessao)) return [];

  const candidaturas = await getCompanyApplications(
    empresaDoPainel(sessao.usuarioId),
  );

  /*
   * Mesma tabela de sinônimos do casamento com a vaga e da busca de
   * candidatos: quem procura "CNH D" precisa achar quem escreveu "carteira D".
   */
  const procurada = filtros.habilidade?.trim()
    ? formaCanonica(filtros.habilidade)
    : null;

  const porPessoa = new Map<string, Talento>();

  for (const c of candidaturas) {
    const existente = porPessoa.get(c.candidate_id);
    if (existente) {
      existente.vagas += 1;
      // `getCompanyApplications` vem da mais nova para a mais velha, mas a
      // regra não deve depender disso: a última é a de data maior.
      if (+new Date(c.created_at) > +new Date(existente.ultima.em)) {
        existente.ultima = {
          candidaturaId: c.id,
          vagaTitulo: c.job_title,
          em: c.created_at,
        };
      }
      continue;
    }

    const casadas = procurada
      ? c.candidate.skills.filter((s) => formaCanonica(s) === procurada)
      : [];
    if (procurada && casadas.length === 0) continue;
    if (filtros.area && c.candidate.desired_area !== filtros.area) continue;

    porPessoa.set(c.candidate_id, {
      candidatoId: c.candidate_id,
      nome: c.candidate.full_name,
      avatarUrl: c.candidate.avatar_url,
      cidade: c.candidate.city,
      areaDesejada: c.candidate.desired_area,
      casadas,
      ultima: {
        candidaturaId: c.id,
        vagaTitulo: c.job_title,
        em: c.created_at,
      },
      vagas: 1,
    });
  }

  return [...porPessoa.values()].sort(
    (a, b) => +new Date(b.ultima.em) - +new Date(a.ultima.em),
  );
}
