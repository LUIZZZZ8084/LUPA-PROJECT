/**
 * @vitest-environment node
 *
 * "Recomendados para você".
 *
 * O bloco tem duas listas, e a separação entre elas é o produto: quem se
 * candidatou levantou a mão para a vaga; quem está disponível ligou "quero
 * que empresas me encontrem" no próprio perfil e ainda não escolheu esta
 * empresa.
 *
 * Os testes que mais importam aqui são os do consentimento. Ninguém pode
 * aparecer na segunda lista sem ter ligado a opção — numa cidade do
 * tamanho de Sinop, quem está empregado e procurando outra coisa pode ter
 * o patrão atual entre as empresas cadastradas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

const vagas: Record<string, unknown[]> = {};
const candidaturas: Record<string, unknown[]> = {};
let disponiveis: unknown[] = [];

vi.mock("@/lib/data", () => ({
  empresaDoPainel: (id: string) => id,
  getCompanyJobs: async (empresaId: string) => vagas[empresaId] ?? [],
  getCompanyApplications: async (empresaId: string) =>
    candidaturas[empresaId] ?? [],
  getCandidatosDisponiveis: async () => disponiveis,
}));

import type { Autenticado } from "@/server/auth/rbac";
import { recomendadosParaEmpresa } from "@/server/candidaturas/recomendados";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const outraEmpresa: Autenticado = { usuarioId: "empresa-2", papel: "empresa" };
const candidato: Autenticado = { usuarioId: "cand-1", papel: "candidato_clt" };

function vaga(over: Record<string, unknown> = {}) {
  return {
    id: "vaga-1",
    title: "Operador de Colheitadeira",
    description: "Safra de soja, turno diurno.",
    skills: ["Colheitadeira", "CNH D"],
    city: "Sinop",
    neighborhood: "Setor Industrial",
    status: "aberta",
    ...over,
  };
}

function candidatura(
  id: string,
  skills: string[],
  over: Record<string, unknown> = {},
) {
  return {
    id,
    job_id: "vaga-1",
    candidate_id: `c-${id}`,
    status: "enviada",
    created_at: "2026-08-20T12:00:00.000Z",
    job_title: "Operador de Colheitadeira",
    candidate: {
      full_name: `Pessoa ${id}`,
      avatar_url: null,
      city: "Sinop",
      neighborhood: null,
      phone: "6600000001",
      skills,
    },
    ...over,
  };
}

function disponivel(
  id: string,
  skills: string[],
  over: Record<string, unknown> = {},
) {
  return {
    id,
    full_name: `Disponível ${id}`,
    avatar_url: null,
    city: "Sinop",
    neighborhood: null,
    email: `${id}@teste.lupa`,
    phone: "6600000002",
    desired_area: "Agronegócio",
    availability: "Imediata",
    skills,
    ...over,
  };
}

const nomes = (lista: { nome: string }[]) => lista.map((x) => x.nome);

beforeEach(() => {
  for (const k of Object.keys(vagas)) delete vagas[k];
  for (const k of Object.keys(candidaturas)) delete candidaturas[k];
  disponiveis = [];
  vagas["empresa-1"] = [vaga()];
});

describe("consentimento", () => {
  /*
   * `getCandidatosDisponiveis` só devolve quem ligou a opção — a view no
   * banco tem o `where` e o repositório em memória filtra pelo mesmo
   * campo. Aqui o que se trava é que o bloco não inventa ninguém além do
   * que aquela função entregou.
   */
  it("a lista de disponíveis vem inteira de quem consentiu", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    disponiveis = [disponivel("d1", ["Colheitadeira", "CNH D"])];

    const r = await recomendadosParaEmpresa(empresa);

    expect(nomes(r[0].candidatos)).toEqual(["Pessoa a"]);
    expect(nomes(r[0].disponiveis)).toEqual(["Disponível d1"]);
  });

  it("ninguém consentiu: a segunda lista some, a primeira fica", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    disponiveis = [];

    const r = await recomendadosParaEmpresa(empresa);

    expect(r[0].candidatos).toHaveLength(1);
    expect(r[0].disponiveis).toEqual([]);
  });

  /*
   * Aparecer duas vezes na mesma vaga faria a empresa achar que são duas
   * pessoas — e a segunda entrada mostraria menos que a primeira, porque
   * quem só está disponível não tem ficha nem currículo.
   */
  it("quem já se candidatou não aparece também como disponível", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    disponiveis = [
      disponivel("c-a", ["Colheitadeira", "CNH D"]),
      disponivel("outro", ["Colheitadeira"]),
    ];

    const r = await recomendadosParaEmpresa(empresa);

    expect(nomes(r[0].disponiveis)).toEqual(["Disponível outro"]);
  });

  /*
   * Currículo é entregue por quem se candidata. Quem só está visível
   * entregou contato — e é a ausência de `candidaturaId` que impede a tela
   * de oferecer a ficha, que traz currículo e histórico.
   */
  it("disponível não carrega caminho para a ficha; candidato carrega", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    disponiveis = [disponivel("d1", ["Colheitadeira"])];

    const r = await recomendadosParaEmpresa(empresa);

    expect(r[0].candidatos[0].candidaturaId).toBe("a");
    expect(r[0].disponiveis[0].candidaturaId).toBeNull();
  });
});

describe("o escopo continua sendo da empresa da sessão", () => {
  it("outra empresa não recebe nada da minha", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    expect(await recomendadosParaEmpresa(outraEmpresa)).toEqual([]);
  });

  it("candidato não recebe recomendação de candidato", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    expect(await recomendadosParaEmpresa(candidato)).toEqual([]);
  });

  it("sem sessão, nada", async () => {
    expect(await recomendadosParaEmpresa(null)).toEqual([]);
  });

  it("candidatura de outra vaga da mesma empresa não se mistura", async () => {
    vagas["empresa-1"] = [vaga(), vaga({ id: "vaga-2", title: "Outra" })];
    candidaturas["empresa-1"] = [
      candidatura("a", ["Colheitadeira"]),
      candidatura("b", ["Colheitadeira"], { job_id: "vaga-2" }),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    expect(
      nomes(r.find((v) => v.vagaId === "vaga-1")?.candidatos ?? []),
    ).toEqual(["Pessoa a"]);
  });
});

describe("a ordem, e o porquê dela", () => {
  it("mais habilidades casadas vem primeiro", async () => {
    candidaturas["empresa-1"] = [
      candidatura("uma", ["Colheitadeira"]),
      candidatura("duas", ["Colhedora", "Carteira D"]),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    expect(nomes(r[0].candidatos)).toEqual(["Pessoa duas", "Pessoa uma"]);
  });

  /*
   * A proximidade entra como desempate, não como critério principal: entre
   * duas pessoas que casam o mesmo, a que mora perto do trabalho tem mais
   * chance de aceitar e de continuar.
   */
  it("empate de habilidade desempata pelo mais perto do local da vaga", async () => {
    disponiveis = [
      disponivel("longe", ["Colheitadeira"], { city: "Cuiabá" }),
      disponivel("perto", ["Colheitadeira"], { city: "Sinop" }),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    expect(nomes(r[0].disponiveis)).toEqual([
      "Disponível perto",
      "Disponível longe",
    ]);
  });

  /*
   * Mas ninguém sobe por morar perto sem ter o que a vaga pede — seria
   * transformar recomendação em lista de vizinhos.
   */
  it("morar perto não passa na frente de quem casa mais", async () => {
    disponiveis = [
      disponivel("vizinho", ["Colheitadeira"], {
        city: "Sinop",
        neighborhood: "Setor Industrial",
      }),
      disponivel("distante", ["Colhedora", "Carteira D"], { city: "Cuiabá" }),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    expect(nomes(r[0].disponiveis)[0]).toBe("Disponível distante");
  });

  /*
   * A vaga é a origem, não a sede da empresa: uma transportadora de Sinop
   * que contrata em Sorriso quer, na frente, quem está em Sorriso.
   */
  it("a distância é medida do local da vaga, não da empresa", async () => {
    vagas["empresa-1"] = [vaga({ city: "Sorriso", neighborhood: null })];
    disponiveis = [
      disponivel("deSinop", ["Colheitadeira"], { city: "Sinop" }),
      disponivel("deSorriso", ["Colheitadeira"], { city: "Sorriso" }),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    expect(nomes(r[0].disponiveis)[0]).toBe("Disponível deSorriso");
  });

  it("mostra no máximo três por lista", async () => {
    candidaturas["empresa-1"] = Array.from({ length: 6 }, (_, i) =>
      candidatura(`c${i}`, ["Colheitadeira", "CNH D"]),
    );
    disponiveis = Array.from({ length: 6 }, (_, i) =>
      disponivel(`d${i}`, ["Colheitadeira"]),
    );

    const r = await recomendadosParaEmpresa(empresa);
    expect(r[0].candidatos).toHaveLength(3);
    expect(r[0].disponiveis).toHaveLength(3);
  });

  it("diz quais habilidades casaram, com o texto da pessoa", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colhedora", "Solda"])];

    const r = await recomendadosParaEmpresa(empresa);
    const primeiro = r[0].candidatos[0];

    expect(primeiro.casadas.map((c) => c.texto)).toEqual(["Colhedora"]);
    expect(primeiro.deQuantas).toBe(2);
  });
});

describe("quando não há o que recomendar", () => {
  /*
   * Bloco vazio é resposta honesta. Listar por ordem de chegada e chamar
   * de recomendação é pior que não recomendar: a empresa segue o critério
   * uma vez, não dá certo, e para de olhar o bloco para sempre.
   */
  it("quem não casa nada não aparece, em nenhuma das listas", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Excel", "Recepção"])];
    disponiveis = [disponivel("d1", ["Pintura"])];

    expect(await recomendadosParaEmpresa(empresa)).toEqual([]);
  });

  it("vaga fechada fica de fora", async () => {
    vagas["empresa-1"] = [vaga({ status: "fechada" })];
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];

    expect(await recomendadosParaEmpresa(empresa)).toEqual([]);
  });

  it("vaga sem habilidade reconhecível não entra", async () => {
    vagas["empresa-1"] = [
      vaga({
        skills: [],
        title: "Profissional dedicado",
        description: "Buscamos alguém pontual e comprometido.",
      }),
    ];
    candidaturas["empresa-1"] = [candidatura("a", ["Excel"])];

    expect(await recomendadosParaEmpresa(empresa)).toEqual([]);
  });
});

/**
 * Toda vaga publicada antes do campo existir chega sem habilidade
 * declarada. Sem a leitura do texto, o bloco nasceria vazio para todo
 * mundo — e ninguém preenche um campo cujo resultado nunca viu.
 */
describe("vaga antiga, sem habilidades declaradas", () => {
  it("casa pelo título e pela descrição", async () => {
    vagas["empresa-1"] = [
      vaga({
        skills: [],
        title: "Operador de Empilhadeira",
        description: "Movimentação de carga e controle de estoque.",
      }),
    ];
    candidaturas["empresa-1"] = [candidatura("a", ["Empilhadeira"])];

    const r = await recomendadosParaEmpresa(empresa);
    expect(nomes(r[0].candidatos)).toEqual(["Pessoa a"]);
  });
});
