/**
 * @vitest-environment node
 *
 * Denunciar vaga e avaliação, e a decisão do admin (#435).
 *
 * Em demonstração, com a vaga de exemplo do mock. O que o banco garante —
 * uma aberta por pessoa e por alvo, e a decisão numa transação — é provado
 * num Postgres de verdade, em `schema.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

import { MOTIVOS_NA_TELA } from "@/components/denunciar";
import type { Autenticado } from "@/server/auth/rbac";
import {
  decidirDenuncia,
  denunciar,
  denunciasAbertas,
  limparDenunciasEmMemoria,
  MOTIVOS_DE_DENUNCIA,
} from "@/server/denuncias/servico";
import { ehAppError } from "@/server/errors";
import { repositorioPublicacoes } from "@/server/publicacoes";

const VAGA = "job-operador-maquinas";
const DONO_DA_VAGA: Autenticado = {
  usuarioId: "cmp-agro-norte",
  papel: "empresa",
};
const ana: Autenticado = { usuarioId: "ana", papel: "candidato_clt" };
const bia: Autenticado = { usuarioId: "bia", papel: "candidato_clt" };
const prestador: Autenticado = {
  usuarioId: "prest-1",
  papel: "prestador_servico",
};
const admin: Autenticado = { usuarioId: "adm", papel: "admin" };

function codigo(e: unknown) {
  return ehAppError(e) ? e.codigo : String(e);
}

beforeEach(() => {
  limparDenunciasEmMemoria();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("denunciar", () => {
  it("sem sessão, recusa", async () => {
    await expect(
      denunciar(null, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_autenticado");
  });

  /** O admin decide; denunciar é de quem usa o app. */
  it("o admin não denuncia", async () => {
    await expect(
      denunciar(admin, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" }),
    ).rejects.toSatisfy((e) => codigo(e) === "sem_permissao");
  });

  it("vaga que não existe não recebe denúncia", async () => {
    await expect(
      denunciar(ana, { alvo: "vaga", alvoId: "nao-existe", motivo: "golpe" }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
  });

  it("o dono não denuncia a própria vaga", async () => {
    await expect(
      denunciar(DONO_DA_VAGA, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" }),
    ).rejects.toSatisfy((e) => codigo(e) === "sem_permissao");
  });

  it("a mesma pessoa não denuncia duas vezes o que está em análise", async () => {
    await denunciar(ana, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" });

    const erro = await denunciar(ana, {
      alvo: "vaga",
      alvoId: VAGA,
      motivo: "falsa",
    }).catch((e) => e);

    expect(codigo(erro)).toBe("conflito");
    expect(ehAppError(erro) && erro.mensagem).toMatch(/já denunciou/);
  });

  it("avaliação precisa dizer de qual perfil veio", async () => {
    await expect(
      denunciar(ana, { alvo: "avaliacao", alvoId: "aval-1", motivo: "falsa" }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
  });

  /** Avaliação falsa contra o próprio prestador é o caso mais provável. */
  it("o prestador denuncia avaliação do próprio perfil", async () => {
    await denunciar(prestador, {
      alvo: "avaliacao",
      alvoId: "aval-1",
      prestadorId: prestador.usuarioId,
      motivo: "falsa",
    });
    const [g] = await denunciasAbertas(admin);
    expect(g.caminho).toBe(`/servicos/${prestador.usuarioId}`);
  });
});

describe("o painel do admin", () => {
  it("só o admin lê as denúncias", async () => {
    await expect(denunciasAbertas(ana)).rejects.toSatisfy(
      (e) => codigo(e) === "sem_permissao",
    );
  });

  it("agrupa por alvo, conta os motivos e guarda o que contaram", async () => {
    await denunciar(ana, {
      alvo: "vaga",
      alvoId: VAGA,
      motivo: "golpe",
      detalhe: "Pediram pix de R$ 80 para a entrevista",
    });
    await denunciar(bia, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" });

    const [g] = await denunciasAbertas(admin);

    expect(g).toMatchObject({
      alvo: "vaga",
      alvoId: VAGA,
      caminho: `/vagas/${VAGA}`,
      total: 2,
      motivos: { golpe: 2 },
      detalhes: ["Pediram pix de R$ 80 para a entrevista"],
    });
    expect(g.titulo).toMatch(/Operador/i);
  });

  it("o mais denunciado vem primeiro", async () => {
    await denunciar(ana, {
      alvo: "avaliacao",
      alvoId: "aval-1",
      prestadorId: "prest-1",
      motivo: "ofensiva",
    });
    await denunciar(ana, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" });
    await denunciar(bia, { alvo: "vaga", alvoId: VAGA, motivo: "falsa" });

    const lista = await denunciasAbertas(admin);
    expect(lista.map((g) => g.alvo)).toEqual(["vaga", "avaliacao"]);
  });
});

describe("decidir", () => {
  it("só o admin decide", async () => {
    await expect(
      decidirDenuncia(ana, { alvo: "vaga", alvoId: VAGA, tirarDoAr: true }),
    ).rejects.toSatisfy((e) => codigo(e) === "sem_permissao");
  });

  it("decidir fecha as denúncias do alvo, e só as dele", async () => {
    await denunciar(ana, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" });
    await denunciar(bia, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" });
    await denunciar(ana, {
      alvo: "avaliacao",
      alvoId: "aval-1",
      prestadorId: "prest-1",
      motivo: "falsa",
    });

    const fechadas = await decidirDenuncia(admin, {
      alvo: "vaga",
      alvoId: VAGA,
      tirarDoAr: false,
    });

    expect(fechadas).toBe(2);
    expect((await denunciasAbertas(admin)).map((g) => g.alvo)).toEqual([
      "avaliacao",
    ]);
  });

  it("depois da decisão, a mesma pessoa pode denunciar de novo", async () => {
    await denunciar(ana, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" });
    await decidirDenuncia(admin, {
      alvo: "vaga",
      alvoId: VAGA,
      tirarDoAr: false,
    });

    await denunciar(ana, { alvo: "vaga", alvoId: VAGA, motivo: "golpe" });
    expect(await denunciasAbertas(admin)).toHaveLength(1);
  });
});

/*
 * Foto de trabalho (#452). Tirar do ar apaga a publicação, não arquiva:
 * arquivada, ela seguiria no ar pelo endereço.
 */
describe("foto de trabalho", () => {
  async function foto(autorId = "prest-1") {
    return repositorioPublicacoes().criar({
      autorId,
      titulo: "Telhado refeito",
      corpo: "Troca de telhas e calhas numa casa de dois andares.",
    });
  }

  it("quem olha denuncia, e o painel mostra a legenda", async () => {
    const f = await foto();
    await denunciar(ana, {
      alvo: "publicacao",
      alvoId: f.id,
      motivo: "ofensiva",
    });

    const [g] = await denunciasAbertas(admin);
    expect(g).toMatchObject({
      alvo: "publicacao",
      alvoId: f.id,
      titulo: "Telhado refeito",
      caminho: "/servicos/prest-1",
    });
  });

  it("o dono não denuncia a própria foto", async () => {
    const f = await foto(prestador.usuarioId);
    await expect(
      denunciar(prestador, {
        alvo: "publicacao",
        alvoId: f.id,
        motivo: "outro",
      }),
    ).rejects.toSatisfy((e) => codigo(e) === "sem_permissao");
  });

  it("foto arquivada não recebe denúncia", async () => {
    const f = await foto();
    await repositorioPublicacoes().definirStatus(f.id, "arquivada");
    await expect(
      denunciar(ana, { alvo: "publicacao", alvoId: f.id, motivo: "outro" }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
  });

  it("o perfil vem da publicação, não do formulário", async () => {
    const f = await foto("prest-2");
    await denunciar(ana, {
      alvo: "publicacao",
      alvoId: f.id,
      prestadorId: "outra-pessoa",
      motivo: "falsa",
    });
    const [g] = await denunciasAbertas(admin);
    expect(g.caminho).toBe("/servicos/prest-2");
  });

  it("tirar do ar apaga a publicação, e descartar a mantém", async () => {
    const apagar = await foto();
    const manter = await foto();
    await denunciar(ana, {
      alvo: "publicacao",
      alvoId: apagar.id,
      motivo: "ofensiva",
    });
    await denunciar(ana, {
      alvo: "publicacao",
      alvoId: manter.id,
      motivo: "ofensiva",
    });

    await decidirDenuncia(admin, {
      alvo: "publicacao",
      alvoId: apagar.id,
      tirarDoAr: true,
    });
    await decidirDenuncia(admin, {
      alvo: "publicacao",
      alvoId: manter.id,
      tirarDoAr: false,
    });

    expect(await repositorioPublicacoes().porId(apagar.id)).toBeNull();
    expect((await repositorioPublicacoes().porId(manter.id))?.status).toBe(
      "ativa",
    );
    expect(await denunciasAbertas(admin)).toEqual([]);
  });
});

/** O componente de cliente não alcança o módulo do servidor. */
it("os motivos da tela são os do servidor", () => {
  expect(
    Object.fromEntries(MOTIVOS_NA_TELA.map((m) => [m.valor, m.rotulo])),
  ).toEqual(MOTIVOS_DE_DENUNCIA);
});
