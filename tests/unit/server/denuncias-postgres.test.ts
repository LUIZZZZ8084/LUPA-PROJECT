/**
 * @vitest-environment node
 *
 * O caminho com banco do serviço de denúncias (#435), com o cliente da
 * chave de serviço dublado. O que o banco garante por conta própria — o
 * índice único e a decisão numa transação — roda num Postgres de verdade
 * em `schema.test.ts`; aqui se prova o que a aplicação faz com a resposta.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let respostas: Record<string, Resposta> = {};
let semChave = false;

function construtor(tabela: string) {
  const resposta = () => respostas[tabela] ?? { data: null, error: null };
  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta(),
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta()).then(resolver),
  };
  for (const metodo of ["select", "eq", "in", "insert", "order", "limit"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () =>
    semChave
      ? null
      : {
          from: (tabela: string) => construtor(tabela),
          rpc: async (nome: string, args: unknown) => {
            chamadas.push({ tabela: nome, metodo: "rpc", args: [args] });
            return respostas[nome] ?? { data: null, error: null };
          },
          storage: {
            from: (balde: string) => ({
              remove: async (caminhos: string[]) => {
                chamadas.push({
                  tabela: balde,
                  metodo: "remove",
                  args: [caminhos],
                });
                return respostas.storage ?? { data: null, error: null };
              },
            }),
          },
        },
}));

const getJobById = vi.fn();
vi.mock("@/lib/data", () => ({ getJobById: (id: string) => getJobById(id) }));

import type { Autenticado } from "@/server/auth/rbac";
import {
  decidirDenuncia,
  denunciar,
  denunciasAbertas,
} from "@/server/denuncias/servico";
import { ehAppError } from "@/server/errors";

const ana: Autenticado = { usuarioId: "ana", papel: "candidato_clt" };
const admin: Autenticado = { usuarioId: "adm", papel: "admin" };
const VAGA = "22222222-2222-4222-8222-000000000001";
const AVALIACAO = "33333333-3333-4333-8333-000000000001";
const PRESTADOR = "44444444-4444-4444-8444-000000000001";

function codigo(e: unknown) {
  return ehAppError(e) ? e.codigo : String(e);
}

function chamadasDe(tabela: string, metodo: string) {
  return chamadas.filter((c) => c.tabela === tabela && c.metodo === metodo);
}

const BASE = "https://projeto.supabase.co";
const FOTO = "55555555-5555-4555-8555-000000000001";
const AUTOR = "66666666-6666-4666-8666-000000000001";
const ARQUIVO = `trabalho/${AUTOR}/77777777-7777-4777-8777-000000000001.webp`;
const LINHA_DA_FOTO = {
  id: FOTO,
  autor_id: AUTOR,
  titulo: "Muro de arrimo",
  corpo: "Muro levantado em dois dias, com fundação.",
  imagem_url: `${BASE}/storage/v1/object/public/portfolio/${ARQUIVO}?v=1`,
  status: "ativa",
  criado_em: "2026-10-13T10:00:00Z",
  atualizado_em: "2026-10-13T10:00:00Z",
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
  chamadas.length = 0;
  respostas = {};
  semChave = false;
  getJobById.mockReset();
  getJobById.mockResolvedValue({
    id: VAGA,
    company_id: "outra-empresa",
    title: "Operador de colheitadeira",
    company: { company_name: "Agro Norte" },
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("denunciar, com banco", () => {
  it("grava quem denunciou, o alvo e o motivo", async () => {
    await denunciar(ana, {
      alvo: "vaga",
      alvoId: VAGA,
      motivo: "golpe",
      detalhe: "  Pediram pix  ",
    });

    expect(chamadasDe("denuncias", "insert")[0].args[0]).toEqual({
      alvo: "vaga",
      alvo_id: VAGA,
      prestador_id: null,
      denunciante_id: "ana",
      motivo: "golpe",
      detalhe: "Pediram pix",
    });
  });

  it("o índice único vira a mensagem de repetida", async () => {
    respostas.denuncias = {
      data: null,
      error: { message: "duplicate key", code: "23505" },
    };

    const erro = await denunciar(ana, {
      alvo: "vaga",
      alvoId: VAGA,
      motivo: "golpe",
    }).catch((e) => e);

    expect(codigo(erro)).toBe("conflito");
    expect(ehAppError(erro) && erro.mensagem).toMatch(/já denunciou/);
  });

  it("outro erro do banco é indisponível, não sucesso", async () => {
    respostas.denuncias = { data: null, error: { message: "caiu" } };
    await expect(
      denunciar(ana, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" }),
    ).rejects.toSatisfy((e) => codigo(e) === "indisponivel");
  });

  it("avaliação que não é daquele perfil não recebe denúncia", async () => {
    respostas.avaliacoes = { data: null, error: null };

    await expect(
      denunciar(ana, {
        alvo: "avaliacao",
        alvoId: AVALIACAO,
        prestadorId: PRESTADOR,
        motivo: "falsa",
      }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");

    // Conferiu o par, não só o id.
    const filtros = chamadasDe("avaliacoes", "eq").map((c) => c.args);
    expect(filtros).toEqual([
      ["id", AVALIACAO],
      ["prestador_id", PRESTADOR],
    ]);
    expect(chamadasDe("denuncias", "insert")).toHaveLength(0);
  });

  it("avaliação do perfil certo é gravada com o perfil", async () => {
    respostas.avaliacoes = { data: { id: AVALIACAO }, error: null };

    await denunciar(ana, {
      alvo: "avaliacao",
      alvoId: AVALIACAO,
      prestadorId: PRESTADOR,
      motivo: "falsa",
    });

    expect(chamadasDe("denuncias", "insert")[0].args[0]).toMatchObject({
      alvo: "avaliacao",
      prestador_id: PRESTADOR,
    });
  });

  it("sem chave de serviço, recusa em vez de fingir que gravou", async () => {
    semChave = true;
    await expect(
      denunciar(ana, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" }),
    ).rejects.toSatisfy((e) => codigo(e) === "indisponivel");
  });
});

describe("o painel, com banco", () => {
  it("lê só as abertas, agrupa e dá nome a cada alvo", async () => {
    respostas.denuncias = {
      data: [
        {
          alvo: "avaliacao",
          alvo_id: AVALIACAO,
          prestador_id: PRESTADOR,
          motivo: "ofensiva",
          detalhe: null,
          criada_em: "2026-10-13T10:00:00Z",
        },
        {
          alvo: "vaga",
          alvo_id: VAGA,
          prestador_id: null,
          motivo: "golpe",
          detalhe: "Pediram pix",
          criada_em: "2026-10-13T11:00:00Z",
        },
        {
          alvo: "vaga",
          alvo_id: VAGA,
          prestador_id: null,
          motivo: "golpe",
          detalhe: null,
          criada_em: "2026-10-13T12:00:00Z",
        },
      ],
      error: null,
    };
    respostas.avaliacoes = {
      data: [{ id: AVALIACAO, nota: 1, comentario: "Nunca vi esse cara" }],
      error: null,
    };

    const lista = await denunciasAbertas(admin);

    expect(chamadasDe("denuncias", "eq")[0].args).toEqual(["status", "aberta"]);
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({
      alvo: "vaga",
      total: 2,
      titulo: "Operador de colheitadeira — Agro Norte",
      detalhes: ["Pediram pix"],
    });
    expect(lista[1]).toMatchObject({
      alvo: "avaliacao",
      caminho: `/servicos/${PRESTADOR}`,
      titulo: "1 estrela: Nunca vi esse cara",
    });
  });

  it("vaga que já saiu da busca aparece com aviso, não some", async () => {
    getJobById.mockResolvedValue(null);
    respostas.denuncias = {
      data: [
        {
          alvo: "vaga",
          alvo_id: VAGA,
          prestador_id: null,
          motivo: "falsa",
          detalhe: null,
          criada_em: "2026-10-13T10:00:00Z",
        },
      ],
      error: null,
    };

    const [g] = await denunciasAbertas(admin);
    expect(g.titulo).toBe("Vaga já fora da busca");
  });

  it("erro ao ler é indisponível, não lista vazia", async () => {
    respostas.denuncias = { data: null, error: { message: "caiu" } };
    await expect(denunciasAbertas(admin)).rejects.toSatisfy(
      (e) => codigo(e) === "indisponivel",
    );
  });
});

describe("decidir, com banco", () => {
  it("chama a função do banco e devolve quantas fechou", async () => {
    respostas.decidir_denuncia = { data: 3, error: null };

    const n = await decidirDenuncia(admin, {
      alvo: "vaga",
      alvoId: VAGA,
      tirarDoAr: true,
    });

    expect(n).toBe(3);
    expect(chamadasDe("decidir_denuncia", "rpc")[0].args[0]).toEqual({
      p_alvo: "vaga",
      p_alvo_id: VAGA,
      p_tirar_do_ar: true,
    });
  });

  it("erro do banco não vira decisão tomada", async () => {
    respostas.decidir_denuncia = { data: null, error: { message: "caiu" } };
    await expect(
      decidirDenuncia(admin, { alvo: "vaga", alvoId: VAGA, tirarDoAr: false }),
    ).rejects.toSatisfy((e) => codigo(e) === "indisponivel");
  });
});

describe("foto de trabalho, com banco (#452)", () => {
  it("id sem forma de UUID nem chega ao banco", async () => {
    await expect(
      denunciar(ana, { alvo: "publicacao", alvoId: "x", motivo: "ofensiva" }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
    expect(chamadasDe("publicacoes", "select")).toHaveLength(0);
  });

  it("o dono do perfil vem da publicação, não do formulário", async () => {
    respostas.publicacoes = { data: LINHA_DA_FOTO, error: null };

    await denunciar(ana, {
      alvo: "publicacao",
      alvoId: FOTO,
      prestadorId: "outra-pessoa",
      motivo: "ofensiva",
    });

    expect(chamadasDe("denuncias", "insert")[0].args[0]).toMatchObject({
      alvo: "publicacao",
      alvo_id: FOTO,
      prestador_id: AUTOR,
    });
  });

  it("foto arquivada não recebe denúncia", async () => {
    respostas.publicacoes = {
      data: { ...LINHA_DA_FOTO, status: "arquivada" },
      error: null,
    };
    await expect(
      denunciar(ana, { alvo: "publicacao", alvoId: FOTO, motivo: "outro" }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
  });

  it("tirar do ar apaga a publicação pelo banco e o arquivo certo", async () => {
    respostas.publicacoes = { data: LINHA_DA_FOTO, error: null };
    respostas.decidir_denuncia = { data: 1, error: null };

    await decidirDenuncia(admin, {
      alvo: "publicacao",
      alvoId: FOTO,
      tirarDoAr: true,
    });

    expect(chamadasDe("decidir_denuncia", "rpc")).toHaveLength(1);
    expect(chamadasDe("portfolio", "remove")[0].args[0]).toEqual([ARQUIVO]);
  });

  it("o banco que recusa a decisão não apaga arquivo nenhum", async () => {
    respostas.publicacoes = { data: LINHA_DA_FOTO, error: null };
    respostas.decidir_denuncia = { data: null, error: { message: "caiu" } };

    await expect(
      decidirDenuncia(admin, {
        alvo: "publicacao",
        alvoId: FOTO,
        tirarDoAr: true,
      }),
    ).rejects.toSatisfy((e) => codigo(e) === "indisponivel");
    expect(chamadasDe("portfolio", "remove")).toHaveLength(0);
  });

  it("arquivo que não sai do Storage vai ao Sentry, e a decisão vale", async () => {
    respostas.publicacoes = { data: LINHA_DA_FOTO, error: null };
    respostas.decidir_denuncia = { data: 2, error: null };
    respostas.storage = { data: null, error: { message: "fora" } };
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const n = await decidirDenuncia(admin, {
      alvo: "publicacao",
      alvoId: FOTO,
      tirarDoAr: true,
    });

    expect(n).toBe(2);
    expect(erro).toHaveBeenCalled();
  });

  it("descartar não apaga nada", async () => {
    respostas.publicacoes = { data: LINHA_DA_FOTO, error: null };
    await decidirDenuncia(admin, {
      alvo: "publicacao",
      alvoId: FOTO,
      tirarDoAr: false,
    });
    expect(chamadasDe("portfolio", "remove")).toHaveLength(0);
  });

  it("o painel mostra a legenda e a miniatura", async () => {
    respostas.denuncias = {
      data: [
        {
          alvo: "publicacao",
          alvo_id: FOTO,
          prestador_id: AUTOR,
          motivo: "ofensiva",
          detalhe: null,
          criada_em: "2026-10-13T10:00:00Z",
        },
      ],
      error: null,
    };
    respostas.publicacoes = { data: LINHA_DA_FOTO, error: null };

    const [g] = await denunciasAbertas(admin);

    expect(g).toMatchObject({
      alvo: "publicacao",
      titulo: "Muro de arrimo",
      imagemUrl: LINHA_DA_FOTO.imagem_url,
    });
    expect(g.caminho).toMatch(new RegExp(AUTOR));
  });
});
