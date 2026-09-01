/**
 * @vitest-environment node
 *
 * Procurar entre quem pediu para ser encontrado.
 *
 * O `AGENTS.md` registra "busca livre de candidatos" como fora do escopo
 * por decisão: em Sinop, quem está empregado e procurando outra coisa pode
 * ter o patrão atual entre as empresas cadastradas. Esta tela não revoga
 * essa decisão — ela se apoia no consentimento que passou a existir.
 *
 * Por isso os testes que mais importam aqui não são os do filtro. São os
 * três que dizem quem pode perguntar, quem aparece na resposta, e o que
 * *não* vem junto.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

let disponiveis: unknown[] = [];
const candidaturas: Record<string, unknown[]> = {};

vi.mock("@/lib/data", () => ({
  empresaDoPainel: (id: string) => id,
  getCandidatosDisponiveis: async () => disponiveis,
  getCompanyApplications: async (empresaId: string) =>
    candidaturas[empresaId] ?? [],
}));

let usuario: unknown = null;

vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({ porId: async () => usuario }),
}));

import type { Autenticado } from "@/server/auth/rbac";
import {
  candidatosDisponiveis,
  perfilDoCandidato,
} from "@/server/candidatos/servico";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const candidato: Autenticado = { usuarioId: "cand-9", papel: "candidato_clt" };
const prestador: Autenticado = {
  usuarioId: "prest-1",
  papel: "prestador_servico",
};
const admin: Autenticado = { usuarioId: "admin-1", papel: "admin" };

function pessoa(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    full_name: `Pessoa ${id}`,
    avatar_url: null,
    city: "Sinop",
    neighborhood: null,
    email: `${id}@teste.lupa`,
    phone: "66900000001",
    desired_area: "Agronegócio",
    availability: "Imediata",
    skills: ["Colheitadeira", "CNH D"],
    ...over,
  };
}

const nomes = (l: { full_name: string }[]) => l.map((x) => x.full_name);

beforeEach(() => {
  disponiveis = [];
  for (const k of Object.keys(candidaturas)) delete candidaturas[k];
  usuario = { id: "empresa-1", cidade: "Sinop", bairro: null };
});

describe("quem pode perguntar", () => {
  it("empresa pode", async () => {
    disponiveis = [pessoa("a")];
    expect(await candidatosDisponiveis(empresa)).toHaveLength(1);
  });

  /*
   * Candidato e prestador não têm nada a fazer nesta lista, e deixá-los
   * entrar transformaria o opt-in "quero que *empresas* me encontrem" em
   * outra coisa — quem consentiu escolheu ser visto por quem contrata.
   */
  it.each([
    ["candidato", candidato],
    ["prestador", prestador],
  ])("%s não pode", async (_nome, sessao) => {
    disponiveis = [pessoa("a")];
    expect(await candidatosDisponiveis(sessao)).toEqual([]);
  });

  /**
   * Admin pode, por decisão do Luiz (31/08): quem administra a ferramenta
   * é o responsável por ela e precisa alcançar o que existe lá dentro para
   * dar suporte.
   *
   * O que continua fora do alcance dele é escrita no lugar de outro papel
   * — publicar vaga, se candidatar, mover candidatura de uma empresa —,
   * porque essas ações têm dono e precisam manter o autor.
   */
  it("admin pode", async () => {
    disponiveis = [pessoa("a")];
    expect(await candidatosDisponiveis(admin)).toHaveLength(1);
  });

  it("sem sessão, nada", async () => {
    disponiveis = [pessoa("a")];
    expect(await candidatosDisponiveis(null)).toEqual([]);
  });
});

describe("quem aparece", () => {
  /*
   * A fechadura mora no `where` da view `candidatos_disponiveis`, não
   * aqui. O que se trava é que a busca não inventa ninguém além do que
   * aquela consulta entregou — nem por filtro vazio.
   */
  it("a lista vem inteira de quem consentiu", async () => {
    disponiveis = [pessoa("a"), pessoa("b")];
    expect(nomes(await candidatosDisponiveis(empresa))).toEqual([
      "Pessoa a",
      "Pessoa b",
    ]);
  });

  it("ninguém consentiu: lista vazia, sem erro", async () => {
    disponiveis = [];
    expect(await candidatosDisponiveis(empresa)).toEqual([]);
  });
});

/**
 * O que **não** vem junto.
 *
 * São dois consentimentos diferentes: quem se candidata entrega o
 * currículo com a candidatura; quem só está visível entregou contato.
 * Ligar "quero ser encontrado" não pode significar "leia meu histórico
 * inteiro" — e a garantia é a view não trazer esses campos.
 */
describe("currículo não vaza por aqui", () => {
  it("o objeto devolvido não tem currículo nem resumo", async () => {
    disponiveis = [pessoa("a")];
    const [encontrado] = await candidatosDisponiveis(empresa);

    for (const proibida of [
      "resume_url",
      "curriculoUrl",
      "summary",
      "resumo",
      "experiences",
      "education",
    ]) {
      expect(
        Object.hasOwn(encontrado, proibida),
        `${proibida} não pode chegar à busca de candidatos`,
      ).toBe(false);
    }
  });
});

describe("filtro por habilidade", () => {
  it("acha quem tem a habilidade procurada", async () => {
    disponiveis = [pessoa("a"), pessoa("b", { skills: ["Excel"] })];

    const r = await candidatosDisponiveis(empresa, {
      habilidade: "Colheitadeira",
    });
    expect(nomes(r)).toEqual(["Pessoa a"]);
  });

  /**
   * O filtro passa pela mesma tabela de sinônimos do casamento com a
   * vaga: quem digita "carteira D" precisa achar quem escreveu "CNH D".
   * Sem isso, o vocabulário de quem procurou decidiria o resultado.
   */
  it("usa a tabela de sinônimos", async () => {
    disponiveis = [pessoa("a", { skills: ["carteira D"] })];

    const r = await candidatosDisponiveis(empresa, { habilidade: "CNH D" });
    expect(nomes(r)).toEqual(["Pessoa a"]);
  });

  it("diz quais habilidades casaram, para a tela destacar", async () => {
    disponiveis = [pessoa("a")];
    const [r] = await candidatosDisponiveis(empresa, {
      habilidade: "colhedora",
    });
    expect(r.casadas).toEqual(["Colheitadeira"]);
  });

  it("sem filtro, não destaca nada", async () => {
    disponiveis = [pessoa("a")];
    const [r] = await candidatosDisponiveis(empresa);
    expect(r.casadas).toEqual([]);
  });

  it("habilidade em branco não filtra", async () => {
    disponiveis = [pessoa("a"), pessoa("b")];
    expect(
      await candidatosDisponiveis(empresa, { habilidade: "  " }),
    ).toHaveLength(2);
  });
});

describe("filtro por área desejada", () => {
  it("separa por área", async () => {
    disponiveis = [
      pessoa("a"),
      pessoa("b", { desired_area: "Administrativo" }),
    ];

    const r = await candidatosDisponiveis(empresa, { area: "Administrativo" });
    expect(nomes(r)).toEqual(["Pessoa b"]);
  });

  it("os dois filtros somam, não competem", async () => {
    disponiveis = [
      pessoa("a"),
      pessoa("b", { desired_area: "Administrativo" }),
      pessoa("c", { desired_area: "Administrativo", skills: ["Excel"] }),
    ];

    const r = await candidatosDisponiveis(empresa, {
      area: "Administrativo",
      habilidade: "Excel",
    });
    expect(nomes(r)).toEqual(["Pessoa c"]);
  });
});

/**
 * Ordenar não é filtrar — a mesma regra de `/vagas` e `/servicos`. Nada
 * sai da lista por estar longe; a empresa de Sinop só vê primeiro quem
 * está perto dela.
 */
describe("ordem", () => {
  it("mais perto de quem contrata primeiro", async () => {
    disponiveis = [
      pessoa("longe", { city: "Cuiabá" }),
      pessoa("perto", { city: "Sinop" }),
    ];

    expect(nomes(await candidatosDisponiveis(empresa))).toEqual([
      "Pessoa perto",
      "Pessoa longe",
    ]);
  });

  it("quem está longe continua na lista", async () => {
    disponiveis = [pessoa("longe", { city: "Cuiabá" })];
    expect(await candidatosDisponiveis(empresa)).toHaveLength(1);
  });

  /*
   * Sem cidade de quem busca não há de onde medir. A ordem cai no nome,
   * que ao menos é estável entre recargas — lista que dança sozinha faz
   * quem vê duvidar do critério inteiro.
   */
  it("sem saber de onde a empresa é, ordena pelo nome", async () => {
    usuario = null;
    disponiveis = [pessoa("z"), pessoa("a")];

    expect(nomes(await candidatosDisponiveis(empresa))).toEqual([
      "Pessoa a",
      "Pessoa z",
    ]);
  });
});

describe("perfil de um candidato", () => {
  it("empresa abre o perfil de quem consentiu", async () => {
    disponiveis = [pessoa("a")];
    const p = await perfilDoCandidato(empresa, "a");
    expect(p?.candidato.full_name).toBe("Pessoa a");
  });

  /*
   * "Não existe", "não consentiu" e "você não pode" respondem igual. Um
   * erro diferente para cada caso confirmaria, para quem sonda ids, que a
   * pessoa existe e está procurando emprego — que é o que o opt-in
   * protege.
   */
  it("quem não consentiu é indistinguível de quem não existe", async () => {
    disponiveis = [];
    expect(await perfilDoCandidato(empresa, "a")).toBeNull();
    expect(await perfilDoCandidato(empresa, "nao-existe")).toBeNull();
  });

  it("candidato não abre perfil de candidato", async () => {
    disponiveis = [pessoa("a")];
    expect(await perfilDoCandidato(candidato, "a")).toBeNull();
  });

  /**
   * Admin abre para dar suporte — mas sem vagas próprias, não há
   * candidatura dele para autorizar currículo. O caminho para a ficha
   * nasce da relação empresa↔candidatura, e o admin não tem essa relação.
   */
  it("admin abre o perfil, e continua sem caminho para o currículo", async () => {
    disponiveis = [pessoa("a")];
    const p = await perfilDoCandidato(admin, "a");

    expect(p?.candidato.full_name).toBe("Pessoa a");
    expect(p?.candidaturaId).toBeNull();
  });

  it("sem candidatura na minha empresa, não há caminho para o currículo", async () => {
    disponiveis = [pessoa("a")];
    const p = await perfilDoCandidato(empresa, "a");
    expect(p?.candidaturaId).toBeNull();
  });

  /**
   * Quem se candidatou entregou o currículo junto — e aí o caminho para a
   * ficha aparece. É o ato de se candidatar que autoriza, e é ele que
   * delimita o alcance.
   */
  it("com candidatura minha, o caminho para a ficha aparece", async () => {
    disponiveis = [pessoa("a")];
    candidaturas["empresa-1"] = [{ id: "cand-abc", candidate_id: "a" }];

    const p = await perfilDoCandidato(empresa, "a");
    expect(p?.candidaturaId).toBe("cand-abc");
  });

  /**
   * Candidatura de *outra* empresa não abre a ficha para esta. A busca é
   * feita entre as candidaturas desta empresa, e não por candidato com
   * conferência de dono depois — o mesmo raciocínio da ficha.
   */
  it("candidatura em outra empresa não vale como autorização", async () => {
    disponiveis = [pessoa("a")];
    candidaturas["outra-empresa"] = [{ id: "cand-xyz", candidate_id: "a" }];

    const p = await perfilDoCandidato(empresa, "a");
    expect(p?.candidaturaId).toBeNull();
  });
});
