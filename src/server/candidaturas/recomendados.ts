import "server-only";

import {
  empresaDoPainel,
  getCompanyApplications,
  getCompanyJobs,
} from "@/lib/data";
import { casar, type HabilidadeCasada, habilidadesDaVaga } from "@/lib/skills";
import type { ApplicationWithCandidate } from "@/lib/types";
import type { Autenticado } from "../auth/rbac";
import { temPainelDeEmpresa } from "../visualizacoes/servico";

/**
 * "Recomendados para você", no painel da empresa.
 *
 * Ordena **quem já se candidatou** às vagas abertas da empresa, pela
 * quantidade de habilidades que casam com o que a vaga pede.
 *
 * É deliberadamente só entre quem se candidatou. Sugerir gente que não se
 * candidatou seria banco de talentos com busca ativa — fora do escopo por
 * decisão, e não por limitação técnica: hoje a pessoa se expõe a uma
 * empresa no momento em que decide se candidatar a ela. Abrir isso faria
 * qualquer empresa cadastrada ver quem está procurando emprego na cidade,
 * inclusive o patrão atual da pessoa. Se um dia for para abrir, o caminho
 * é consentimento explícito do candidato, não um `if` a menos aqui.
 */

/** Quantos aparecem por vaga. Lista longa não é recomendação, é a lista. */
const POR_VAGA = 3;

export interface Recomendado {
  candidatura: ApplicationWithCandidate;
  /** As habilidades que casaram, com o texto que o candidato escreveu. */
  casadas: HabilidadeCasada[];
  /** Quantas das que a vaga pede. */
  deQuantas: number;
}

export interface VagaComRecomendados {
  vagaId: string;
  titulo: string;
  /** O que a vaga pede — declarado, ou lido do título e da descrição. */
  pedidas: string[];
  recomendados: Recomendado[];
}

export async function recomendadosParaEmpresa(
  sessao: Autenticado | null,
): Promise<VagaComRecomendados[]> {
  if (!sessao || !temPainelDeEmpresa(sessao)) return [];

  const empresaId = empresaDoPainel(sessao.usuarioId);
  const [vagas, candidaturas] = await Promise.all([
    getCompanyJobs(empresaId),
    getCompanyApplications(empresaId),
  ]);

  const abertas = vagas.filter((v) => v.status === "aberta");
  const saida: VagaComRecomendados[] = [];

  for (const vaga of abertas) {
    const pedidas = habilidadesDaVaga({
      habilidades: vaga.skills,
      titulo: vaga.title,
      descricao: vaga.description,
    });

    // Vaga que não pede nada reconhecível não tem como recomendar. Melhor
    // ficar de fora do que ordenar por acaso e chamar isso de recomendação.
    if (pedidas.length === 0) continue;

    const recomendados = candidaturas
      .filter((c) => c.job_id === vaga.id)
      .map((candidatura) => ({
        candidatura,
        ...casar(pedidas, candidatura.candidate.skills),
      }))
      // Quem não casa nada não é recomendado. Bloco vazio é resposta
      // honesta; lista por ordem de chegada disfarçada de recomendação não.
      .filter((r) => r.pontos > 0)
      .sort(ordenar)
      .slice(0, POR_VAGA)
      .map((r) => ({
        candidatura: r.candidatura,
        casadas: r.casadas,
        deQuantas: pedidas.length,
      }));

    if (recomendados.length > 0) {
      saida.push({
        vagaId: vaga.id,
        titulo: vaga.title,
        pedidas,
        recomendados,
      });
    }
  }

  return saida;
}

/**
 * Mais habilidades casadas primeiro; empate desempata pelo mais recente.
 *
 * O desempate importa mais do que parece: sem ele, a ordem entre iguais
 * vem do banco e muda de uma recarga para outra, e uma lista que dança
 * sozinha faz quem está vendo duvidar do critério inteiro.
 */
function ordenar(
  a: { pontos: number; candidatura: ApplicationWithCandidate },
  b: { pontos: number; candidatura: ApplicationWithCandidate },
): number {
  if (b.pontos !== a.pontos) return b.pontos - a.pontos;
  return (
    +new Date(b.candidatura.created_at) - +new Date(a.candidatura.created_at)
  );
}
