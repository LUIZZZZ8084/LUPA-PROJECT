/**
 * @vitest-environment node
 *
 * "Publicar outra parecida" lê o texto de uma vaga antiga (#492).
 *
 * O id vem da URL (`?modelo=`), e a URL vem de fora: só se lê **a vaga da
 * própria empresa**. Copiar o texto de uma vaga alheia seria ler o que a
 * outra empresa escreveu pela porta do formulário — e o formulário não diz,
 * nem para vaga que não existe, qual dos dois casos foi.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

const vagas = vi.hoisted(() => ({ porId: new Map<string, unknown>() }));
vi.mock("@/lib/data", () => ({
  getJobById: async (id: string) => vagas.porId.get(id) ?? null,
  empresaDoPainel: (usuarioId: string) => usuarioId,
}));

import { modeloDeVaga } from "@/server/vagas/modelo";

const VAGA = {
  id: "vaga-1",
  company_id: "empresa-1",
  title: "Motorista de Carreta",
  description: "Transporte de grãos entre Sorriso e os portos.",
  category: "Logística e Transporte",
  city: "Sorriso - MT",
  neighborhood: "Centro",
  address: "Rua das Palmeiras, 50",
  contract_type: "CLT",
  work_mode: "presencial",
  for_pcd: false,
  salary_min: 3500,
  salary_max: 4200,
  skills: ["CNH E", "direção defensiva"],
};

describe("modeloDeVaga", () => {
  beforeEach(() => {
    vagas.porId.clear();
    vagas.porId.set("vaga-1", VAGA);
  });

  it("a empresa dona recebe os campos como o formulário os espera", async () => {
    expect(await modeloDeVaga("empresa-1", "vaga-1")).toEqual({
      titulo: "Motorista de Carreta",
      categoria: "Logística e Transporte",
      tipoContrato: "CLT",
      modalidade: "presencial",
      paraPcd: "nao",
      cidade: "Sorriso - MT",
      bairro: "Centro",
      endereco: "Rua das Palmeiras, 50",
      habilidades: "CNH E, direção defensiva",
      salarioMin: "3500",
      salarioMax: "4200",
      descricao: "Transporte de grãos entre Sorriso e os portos.",
    });
  });

  it("vaga para PCD volta como 'sim'", async () => {
    vagas.porId.set("vaga-2", { ...VAGA, id: "vaga-2", for_pcd: true });

    expect((await modeloDeVaga("empresa-1", "vaga-2"))?.paraPcd).toBe("sim");
  });

  /**
   * O ponto de segurança: outra empresa não lê o texto desta, e a resposta é
   * a mesma de uma vaga que não existe.
   */
  it("vaga de outra empresa não preenche nada", async () => {
    expect(await modeloDeVaga("empresa-2", "vaga-1")).toBeNull();
  });

  it("vaga que não existe e id ausente também não", async () => {
    expect(await modeloDeVaga("empresa-1", "nao-existe")).toBeNull();
    expect(await modeloDeVaga("empresa-1", undefined)).toBeNull();
    expect(await modeloDeVaga("empresa-1", "")).toBeNull();
  });

  it("vaga antiga sem os campos novos não vira 'null' escrito no formulário", async () => {
    vagas.porId.set("antiga", {
      ...VAGA,
      id: "antiga",
      category: null,
      contract_type: null,
      work_mode: null,
      neighborhood: null,
      address: null,
      salary_min: null,
      salary_max: null,
      skills: [],
    });

    expect(await modeloDeVaga("empresa-1", "antiga")).toMatchObject({
      categoria: "",
      tipoContrato: "",
      modalidade: "",
      bairro: "",
      endereco: "",
      habilidades: "",
      salarioMin: "",
      salarioMax: "",
    });
  });
});
