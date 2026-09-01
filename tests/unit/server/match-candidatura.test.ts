/**
 * @vitest-environment node
 *
 * A % de match na lista de currículos recebidos.
 *
 * O número decide a ordem em que a empresa liga para as pessoas, então o
 * que se trava aqui é menos a aritmética e mais as duas afirmações que ele
 * faz sem querer: "este candidato tem pouco do que pedimos" e "este tem
 * tudo". Nenhuma das duas pode sair de um cálculo que não sabe o que a
 * vaga pede.
 */
import { describe, expect, it } from "vitest";
import type { ApplicationWithCandidate, JobListing } from "@/lib/types";
import { matchPorCandidatura } from "@/server/candidaturas/match";

function vaga(over: Partial<JobListing> = {}): JobListing {
  return {
    id: "vaga-1",
    company_id: "empresa-1",
    title: "Operador de Colheitadeira",
    description: "Safra de soja.",
    category: "Agronegócio",
    city: "Sinop",
    neighborhood: null,
    address: null,
    contract_type: "CLT",
    salary_min: null,
    salary_max: null,
    skills: ["Colheitadeira", "CNH D", "Manutenção básica"],
    status: "aberta",
    created_at: "2026-08-20T12:00:00.000Z",
    company: {
      company_name: "Agro Norte",
      logo_url: null,
      doc_verified: true,
      site: null,
      instagram: null,
      facebook: null,
    },
    applicant_count: 1,
    ...over,
  };
}

function candidatura(
  id: string,
  skills: string[],
  over: Partial<ApplicationWithCandidate> = {},
): ApplicationWithCandidate {
  return {
    id,
    job_id: "vaga-1",
    candidate_id: `c-${id}`,
    status: "enviada",
    created_at: "2026-08-21T12:00:00.000Z",
    job_title: "Operador de Colheitadeira",
    candidate: {
      full_name: `Pessoa ${id}`,
      avatar_url: null,
      neighborhood: null,
      city: "Sinop",
      email: null,
      phone: null,
      desired_area: null,
      availability: null,
      summary: null,
      experiences: [],
      education: null,
      skills,
      resume_url: null,
    },
    ...over,
  };
}

describe("match por candidatura", () => {
  it("conta quantas das pedidas o candidato tem", () => {
    const m = matchPorCandidatura(
      [candidatura("a", ["Colheitadeira", "CNH D"])],
      [vaga()],
    );

    expect(m.get("a")).toEqual({
      pontos: 2,
      deQuantas: 3,
      porcentagem: 67,
    });
  });

  it("quem tem tudo dá 100", () => {
    const m = matchPorCandidatura(
      [candidatura("a", ["Colheitadeira", "CNH D", "Manutenção básica"])],
      [vaga()],
    );
    expect(m.get("a")?.porcentagem).toBe(100);
  });

  /**
   * O casamento passa pela tabela de sinônimos de `skills.ts` — é ela que
   * faz "carteira D" e "CNH D" serem a mesma exigência. Sem isso, o
   * vocabulário de quem preencheu decidiria a nota.
   */
  it("usa a tabela de sinônimos, não a letra do que a pessoa escreveu", () => {
    const m = matchPorCandidatura(
      [candidatura("a", ["carteira D", "colhedora"])],
      [vaga()],
    );
    expect(m.get("a")?.pontos).toBe(2);
  });

  /**
   * A distinção que o selo depende: ausência não é zero.
   *
   * Vaga que não declara habilidade e cujo título não dá pista não permite
   * afirmar nada sobre o candidato. Entrar no mapa com 0% seria dizer que
   * ele não tem nada do que se pede — quando ninguém disse o que se pede.
   */
  it("vaga sem nada reconhecível fica fora do mapa, não vira zero", () => {
    const m = matchPorCandidatura(
      [candidatura("a", ["Colheitadeira"])],
      [vaga({ skills: [], title: "Vaga", description: "Venha trabalhar." })],
    );

    expect(m.has("a")).toBe(false);
  });

  /** Zero de verdade — a vaga pede, e o candidato não tem — aparece. */
  it("candidato sem nenhuma das pedidas dá zero, e isso é dito", () => {
    const m = matchPorCandidatura(
      [candidatura("a", ["Costura", "Corte e costura"])],
      [vaga()],
    );

    expect(m.get("a")).toMatchObject({ pontos: 0, porcentagem: 0 });
  });

  it("candidatura de vaga que não veio na lista fica de fora", () => {
    const m = matchPorCandidatura(
      [candidatura("a", ["Colheitadeira"], { job_id: "vaga-que-nao-veio" })],
      [vaga()],
    );
    expect(m.size).toBe(0);
  });

  it("cada vaga é medida pelo que ela mesma pede", () => {
    const m = matchPorCandidatura(
      [
        candidatura("a", ["Colheitadeira"]),
        candidatura("b", ["Excel"], { job_id: "vaga-2" }),
      ],
      [
        vaga(),
        vaga({ id: "vaga-2", skills: ["Excel"], title: "Auxiliar Adm" }),
      ],
    );

    expect(m.get("a")?.deQuantas).toBe(3);
    expect(m.get("b")).toMatchObject({ deQuantas: 1, porcentagem: 100 });
  });

  /**
   * A outra metade da mesma regra, e o caso comum — não o raro.
   *
   * O cadastro de candidato não pede habilidade: ela entra depois, em
   * `/perfil/editar`. Sem esta guarda, todo recém-cadastrado apareceria
   * com "0%" ao lado do nome — a empresa aprenderia a ignorar o selo, ou
   * descartaria quem só não preencheu um campo.
   *
   * Encontrado testando na tela, não lendo o código: a primeira conta de
   * teste criada mostrou 0% justamente por isso.
   */
  it("candidato que não declarou habilidade fica fora, não vira zero", () => {
    const m = matchPorCandidatura([candidatura("a", [])], [vaga()]);
    expect(m.has("a")).toBe(false);
  });
});
