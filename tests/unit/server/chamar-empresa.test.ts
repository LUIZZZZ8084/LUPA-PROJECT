/**
 * @vitest-environment node
 *
 * O candidato chama a empresa pelo WhatsApp (#533).
 *
 * O que mais importa aqui é de quem é o telefone que sai: só o da empresa de
 * uma vaga a que a própria pessoa se candidatou. A vaga aberta ao público não
 * mostra contato (#490), e esta função não pode virar a porta dos fundos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

const minhas = vi.hoisted(() => ({
  lista: [] as { id: string; job_id: string; job_title: string }[],
  pedidas: [] as string[],
}));

vi.mock("@/lib/data", () => ({
  getMyApplications: async (candidatoId: string) => {
    minhas.pedidas.push(candidatoId);
    return minhas.lista;
  },
  getJobById: async (id: string) =>
    id === "v-sumiu"
      ? null
      : {
          id,
          company_id: `emp-${id}`,
          company: { company_name: "Agro Norte" },
        },
}));

const telefones: Record<string, string | undefined> = {};

vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({
    porId: async (id: string) =>
      id === "cand-1"
        ? { id, nomeCompleto: "Maria da Silva" }
        : telefones[id]
          ? { id, telefone: telefones[id] }
          : null,
  }),
}));

vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lupapp.com.br");

import { linksParaChamarAEmpresa } from "@/server/candidaturas/chamar-empresa";

const candidato = { usuarioId: "cand-1", papel: "candidato_clt" } as const;

function textoDe(link: string) {
  return new URL(link).searchParams.get("text") ?? "";
}

beforeEach(() => {
  minhas.lista = [];
  minhas.pedidas.length = 0;
  for (const k of Object.keys(telefones)) delete telefones[k];
});

describe("linksParaChamarAEmpresa", () => {
  it("monta o WhatsApp da empresa com a vaga e o perfil de quem se candidatou", async () => {
    minhas.lista = [{ id: "c1", job_id: "v1", job_title: "Operador" }];
    telefones["emp-v1"] = "66988887777";

    const links = await linksParaChamarAEmpresa(candidato);
    const link = links.get("c1") as string;

    expect(link.startsWith("https://wa.me/5566988887777?text=")).toBe(true);
    const texto = textoDe(link);
    expect(texto).toContain("Olá, Agro Norte!");
    expect(texto).toContain("Me chamo Maria da Silva");
    expect(texto).toContain("Operador (https://lupapp.com.br/vagas/v1)");
    expect(texto).toContain("https://lupapp.com.br/candidatos/cand-1");
  });

  it("procura entre as candidaturas da própria sessão, e só", async () => {
    minhas.lista = [{ id: "c1", job_id: "v1", job_title: "Operador" }];
    telefones["emp-v1"] = "66988887777";

    await linksParaChamarAEmpresa(candidato);

    expect(minhas.pedidas).toEqual(["cand-1"]);
  });

  it("sem candidatura não sai telefone de empresa nenhuma", async () => {
    telefones["emp-v1"] = "66988887777";

    expect((await linksParaChamarAEmpresa(candidato)).size).toBe(0);
  });

  it("empresa sem telefone ou vaga que sumiu ficam sem botão", async () => {
    minhas.lista = [
      { id: "c1", job_id: "v1", job_title: "Operador" },
      { id: "c2", job_id: "v-sumiu", job_title: "Motorista" },
    ];

    expect((await linksParaChamarAEmpresa(candidato)).size).toBe(0);
  });

  it("quem não tem candidaturas próprias não chama ninguém", async () => {
    minhas.lista = [{ id: "c1", job_id: "v1", job_title: "Operador" }];
    telefones["emp-v1"] = "66988887777";

    const links = await linksParaChamarAEmpresa({
      usuarioId: "emp-9",
      papel: "empresa",
    });

    expect(links.size).toBe(0);
    expect(minhas.pedidas).toEqual([]);
  });
});
