import "server-only";

import {
  type CandidatoDisponivel,
  empresaDoPainel,
  getCandidatosDisponiveis,
  getCompanyApplications,
  getCompanyJobs,
} from "@/lib/data";
import { grauDeProximidade, type Origem } from "@/lib/proximidade";
import { casar, type HabilidadeCasada, habilidadesDaVaga } from "@/lib/skills";
import type { ApplicationWithCandidate } from "@/lib/types";
import type { Autenticado } from "../auth/rbac";
import { temPainelDeEmpresa } from "../visualizacoes/servico";

/**
 * "Recomendados para você", no painel da empresa.
 *
 * Duas listas por vaga, e a separação entre elas é o produto:
 *
 * - **Quem se candidatou.** Levantou a mão para esta vaga. Vem primeiro,
 *   sempre, por melhor que seja o casamento de outro — quem já demonstrou
 *   interesse é mais provável de responder, e ignorar isso seria transformar
 *   a triagem de candidaturas em busca ativa.
 * - **Quem está disponível.** Ligou "quero que empresas me encontrem" no
 *   próprio perfil. Só aparece quem ligou, e desligar tira na hora.
 *
 * A segunda lista não existia por decisão, não por limitação. O que mudou
 * foi o consentimento passar a existir: até então a pessoa se expunha a uma
 * empresa no momento em que decidia se candidatar a ela, e não havia como
 * dizer "pode me procurar". Agora há, desligado por padrão.
 *
 * O que a empresa alcança de quem só está disponível é **contato, não
 * currículo**. Currículo é entregue por quem se candidata.
 */

/** Quantos aparecem por vaga, em cada lista. */
const POR_VAGA = 3;

export interface Recomendado {
  id: string;
  nome: string;
  avatarUrl: string | null;
  /** Onde a pessoa está, para a tela mostrar e a ordem usar. */
  cidade: string | null;
  bairro: string | null;
  telefone: string | null;
  /** As habilidades que casaram, com o texto que a pessoa escreveu. */
  casadas: HabilidadeCasada[];
  /** Quantas das que a vaga pede. */
  deQuantas: number;
  /** Só para quem se candidatou: leva à ficha, com currículo. */
  candidaturaId: string | null;
}

export interface VagaComRecomendados {
  vagaId: string;
  titulo: string;
  cidade: string;
  /** O que a vaga pede — declarado, ou lido do título e da descrição. */
  pedidas: string[];
  /** Quem se candidatou a esta vaga. */
  candidatos: Recomendado[];
  /** Quem pediu para ser encontrado e ainda não se candidatou. */
  disponiveis: Recomendado[];
}

export async function recomendadosParaEmpresa(
  sessao: Autenticado | null,
): Promise<VagaComRecomendados[]> {
  if (!sessao || !temPainelDeEmpresa(sessao)) return [];

  const empresaId = empresaDoPainel(sessao.usuarioId);
  const [vagas, candidaturas, disponiveis] = await Promise.all([
    getCompanyJobs(empresaId),
    getCompanyApplications(empresaId),
    getCandidatosDisponiveis(),
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

    /*
     * A vaga é a origem da proximidade, não a empresa.
     *
     * Uma transportadora de Sinop que contrata em Sorriso quer, na frente,
     * quem está em Sorriso. Medir da sede poria os vizinhos da empresa na
     * frente de quem consegue chegar ao trabalho.
     */
    const perto: Origem = { cidade: vaga.city, bairro: vaga.neighborhood };

    const candidatos = ordenar(
      candidaturas
        .filter((c) => c.job_id === vaga.id)
        .map((c) => deCandidatura(c, pedidas)),
      perto,
    );

    /*
     * Quem já se candidatou sai da lista de disponíveis. Aparecer duas
     * vezes na mesma vaga faria a empresa achar que são duas pessoas — e a
     * segunda entrada mostraria menos do que a primeira, o que é pior que
     * não mostrar.
     */
    const jaSeCandidatou = new Set(
      candidaturas
        .filter((c) => c.job_id === vaga.id)
        .map((c) => c.candidate_id),
    );

    const semCandidatura = ordenar(
      disponiveis
        .filter((d) => !jaSeCandidatou.has(d.id))
        .map((d) => deDisponivel(d, pedidas)),
      perto,
    );

    if (candidatos.length > 0 || semCandidatura.length > 0) {
      saida.push({
        vagaId: vaga.id,
        titulo: vaga.title,
        cidade: vaga.city,
        pedidas,
        candidatos,
        disponiveis: semCandidatura,
      });
    }
  }

  return saida;
}

function deCandidatura(
  c: ApplicationWithCandidate,
  pedidas: string[],
): Recomendado {
  const { casadas } = casar(pedidas, c.candidate.skills);
  return {
    id: c.candidate_id,
    nome: c.candidate.full_name,
    avatarUrl: c.candidate.avatar_url,
    cidade: c.candidate.city,
    bairro: c.candidate.neighborhood,
    telefone: c.candidate.phone,
    casadas,
    deQuantas: pedidas.length,
    candidaturaId: c.id,
  };
}

function deDisponivel(d: CandidatoDisponivel, pedidas: string[]): Recomendado {
  const { casadas } = casar(pedidas, d.skills);
  return {
    id: d.id,
    nome: d.full_name,
    avatarUrl: d.avatar_url,
    cidade: d.city,
    bairro: d.neighborhood,
    telefone: d.phone,
    casadas,
    deQuantas: pedidas.length,
    candidaturaId: null,
  };
}

/**
 * Mais habilidades casadas, depois mais perto, depois o teto.
 *
 * A proximidade entra como desempate e não como critério principal: entre
 * duas pessoas que casam o mesmo, a que mora perto do trabalho é a que tem
 * mais chance de aceitar e de continuar. Mas ninguém sobe por morar perto
 * sem ter o que a vaga pede — seria transformar recomendação em lista de
 * vizinhos.
 *
 * Sem o desempate por proximidade, a ordem entre iguais vinha do banco e
 * mudava de uma recarga para outra. Lista que dança sozinha faz quem está
 * vendo duvidar do critério inteiro.
 */
function ordenar(lista: Recomendado[], perto: Origem): Recomendado[] {
  return lista
    .filter((r) => r.casadas.length > 0)
    .sort((a, b) => {
      if (b.casadas.length !== a.casadas.length) {
        return b.casadas.length - a.casadas.length;
      }

      const grau = (r: Recomendado) =>
        grauDeProximidade(perto, {
          cidade: r.cidade ?? "",
          bairro: r.bairro,
        });

      const diferenca = grau(a) - grau(b);
      if (diferenca !== 0) return diferenca;

      // Último desempate estável: o nome. Sem ele, empate de habilidade e
      // de distância volta a depender da ordem de chegada do banco.
      return a.nome.localeCompare(b.nome, "pt-BR");
    })
    .slice(0, POR_VAGA);
}
