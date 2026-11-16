import { describe, expect, it } from "vitest";
import {
  ehPeriodo,
  filtrarCandidaturas,
  semAcento,
} from "@/lib/lista-de-candidaturas";

const AGORA = new Date("2026-11-16T12:00:00Z");
const ha = (dias: number) =>
  new Date(AGORA.getTime() - dias * 86_400_000).toISOString();
const c = (
  nome: string,
  job_id: string,
  status: "enviada" | "entrevista",
  dias: number,
) => ({ job_id, status, created_at: ha(dias), candidate: { full_name: nome } });

const TODAS = [
  c("João Pereira", "v1", "enviada", 2),
  c("Maria Souza", "v1", "entrevista", 10),
  c("Ana Lima", "v2", "enviada", 40),
];
const nomes = (l: typeof TODAS) => l.map((x) => x.candidate.full_name);

describe("filtros da lista de candidatos (#620)", () => {
  it("sem filtro, todas", () => {
    expect(filtrarCandidaturas(TODAS, {}, AGORA)).toHaveLength(3);
  });

  it("nome sem acento nem maiúscula", () => {
    expect(
      nomes(filtrarCandidaturas(TODAS, { nome: " JOAO " }, AGORA)),
    ).toEqual(["João Pereira"]);
    expect(semAcento("Ação")).toBe("acao");
  });

  it("vaga e etapa juntas", () => {
    expect(
      nomes(
        filtrarCandidaturas(
          TODAS,
          { vaga: "v1", estagio: "entrevista" },
          AGORA,
        ),
      ),
    ).toEqual(["Maria Souza"]);
  });

  it("período conta a partir de agora", () => {
    expect(nomes(filtrarCandidaturas(TODAS, { periodo: "7" }, AGORA))).toEqual([
      "João Pereira",
    ]);
    expect(filtrarCandidaturas(TODAS, { periodo: "30" }, AGORA)).toHaveLength(
      2,
    );
  });

  it("período só vale se for um dos conhecidos", () => {
    expect(ehPeriodo("7")).toBe(true);
    expect(ehPeriodo("365")).toBe(false);
    expect(ehPeriodo(undefined)).toBe(false);
  });
});
