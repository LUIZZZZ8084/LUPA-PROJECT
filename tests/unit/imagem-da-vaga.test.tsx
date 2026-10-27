/**
 * @vitest-environment node
 *
 * A miniatura do link da vaga e os dados que as duas imagens mostram (#490).
 *
 * O que se prova: a rota devolve um PNG do tamanho que as redes sociais
 * esperam (1200 × 630), vaga que não existe cai na miniatura genérica em vez
 * de um erro, e **o que vai escrito na imagem é só o que a página pública
 * mostra** — nenhum contato. Uma imagem sai do app para onde não há login, e
 * telefone ou e-mail nela sairiam junto.
 */
import { describe, expect, it, vi } from "vitest";

const vagas = vi.hoisted(() => ({ porId: new Map<string, unknown>() }));
vi.mock("@/lib/data", () => ({
  getJobById: async (id: string) => vagas.porId.get(id) ?? null,
}));

import ImagemDaVaga, { size } from "@/app/(app)/vagas/[id]/opengraph-image";
import { dadosDaImagem } from "@/components/brand/imagem-da-vaga";
import type { JobListing } from "@/lib/types";

const VAGA = {
  id: "vaga-1",
  company_id: "empresa-1",
  title: "Operador de Máquinas",
  city: "Sinop - MT",
  neighborhood: "Centro",
  address: "Av. das Itaúbas, 1200",
  contract_type: "CLT",
  salary_min: 2200,
  salary_max: 2800,
  company: {
    company_name: "Agro Norte",
    site: "https://agronorte.exemplo",
    instagram: "https://instagram.com/agronorte",
    facebook: null,
    doc_verified: true,
  },
} as unknown as JobListing;

describe("miniatura do link da vaga", () => {
  it("devolve um PNG de 1200 × 630", async () => {
    vagas.porId.set("vaga-1", VAGA);

    const resposta = await ImagemDaVaga({
      params: Promise.resolve({ id: "vaga-1" }),
    });
    const bytes = new Uint8Array(await resposta.arrayBuffer());

    expect(resposta.headers.get("content-type")).toBe("image/png");
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint32(16)).toBe(size.width);
    expect(dv.getUint32(20)).toBe(size.height);
  }, 30_000);

  it("vaga que não existe cai na miniatura genérica, não num erro", async () => {
    const resposta = await ImagemDaVaga({
      params: Promise.resolve({ id: "nao-existe" }),
    });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/png");
  }, 30_000);

  it("vaga com cargo enorme ainda renderiza", async () => {
    vagas.porId.set("vaga-2", {
      ...VAGA,
      id: "vaga-2",
      title:
        "Auxiliar de Serviços Gerais e Manutenção Predial com Experiência em ".repeat(
          3,
        ),
    });

    const resposta = await ImagemDaVaga({
      params: Promise.resolve({ id: "vaga-2" }),
    });

    expect(resposta.status).toBe(200);
  }, 30_000);
});

describe("dadosDaImagem", () => {
  it("leva cargo, empresa, local, endereço, salário e contrato", () => {
    expect(dadosDaImagem(VAGA)).toEqual({
      cargo: "Operador de Máquinas",
      empresa: "Agro Norte",
      cidade: "Centro, Sinop - MT",
      endereco: "Av. das Itaúbas, 1200",
      salario: expect.stringContaining("2.200"),
      contrato: "CLT",
    });
  });

  /**
   * Nada de contato nem de rede da empresa: a imagem é pública, e quem a
   * recebe não tem conta.
   */
  it("não carrega site, redes, telefone nem e-mail", () => {
    const texto = JSON.stringify(dadosDaImagem(VAGA));

    expect(texto).not.toMatch(/instagram|agronorte|facebook|site|@|\d{8,}/i);
  });

  it("salário a combinar não vira texto na imagem", () => {
    expect(
      dadosDaImagem({ ...VAGA, salary_min: null, salary_max: null }).salario,
    ).toBeNull();
  });
});
