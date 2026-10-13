/**
 * @vitest-environment node
 *
 * Apagar de vez um trabalho guardado, com a foto (#454).
 *
 * "Remover" arquiva, e o arquivo continua no bucket público, acessível
 * pelo endereço. Isto é para quando a foto precisa deixar de existir: só o
 * dono, só o que já saiu do feed, o registro primeiro e o arquivo depois.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apagarFoto = vi.hoisted(() =>
  vi.fn(async (_autor: string, _url: string | null) => true),
);
vi.mock("@/server/arquivos/servico", () => ({
  apagarFotoDeTrabalho: apagarFoto,
  enviarArquivo: vi.fn(),
  temArmazenamento: false,
}));

import type { Autenticado } from "@/server/auth/rbac";
import { ehAppError } from "@/server/errors";
import {
  RepositorioPublicacoesMemoria,
  usarRepositorioPublicacoes,
} from "@/server/publicacoes";
import { apagarPublicacao } from "@/server/publicacoes/servico";

const prestador: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};
const candidato: Autenticado = {
  usuarioId: "candidato-1",
  papel: "candidato_clt",
};
const outro: Autenticado = {
  usuarioId: "prestador-2",
  papel: "prestador_servico",
};
const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const admin: Autenticado = { usuarioId: "adm", papel: "admin" };

const FOTO = "https://projeto.supabase.co/storage/v1/object/public/portfolio/x";

function codigo(e: unknown) {
  return ehAppError(e) ? e.codigo : String(e);
}

describe("apagar de vez", () => {
  let repo: RepositorioPublicacoesMemoria;
  let restaurar: () => void;

  async function guardado(autorId = prestador.usuarioId) {
    const p = await repo.criar({
      autorId,
      titulo: "Fachada pintada",
      corpo: "Pintura completa da fachada, com massa nas trincas.",
      imagemUrl: FOTO,
    });
    return repo.definirStatus(p.id, "arquivada");
  }

  beforeEach(() => {
    repo = new RepositorioPublicacoesMemoria();
    restaurar = usarRepositorioPublicacoes(repo);
    apagarFoto.mockReset();
    apagarFoto.mockResolvedValue(true);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  it("o dono apaga o trabalho guardado, e a foto sai junto", async () => {
    const p = await guardado();

    await apagarPublicacao(prestador, p.id);

    expect(await repo.porId(p.id)).toBeNull();
    expect(apagarFoto).toHaveBeenCalledWith(prestador.usuarioId, FOTO);
  });

  it("o candidato também apaga o dele", async () => {
    const p = await guardado(candidato.usuarioId);
    await apagarPublicacao(candidato, p.id);
    expect(await repo.porId(p.id)).toBeNull();
  });

  it("o que está no feed não se apaga: primeiro sai do perfil", async () => {
    const p = await repo.criar({
      autorId: prestador.usuarioId,
      titulo: "Piso novo",
      corpo: "Piso cerâmico na sala e na cozinha.",
    });

    await expect(apagarPublicacao(prestador, p.id)).rejects.toSatisfy(
      (e) => codigo(e) === "validacao",
    );
    expect(await repo.porId(p.id)).not.toBeNull();
    expect(apagarFoto).not.toHaveBeenCalled();
  });

  it("o de outra pessoa responde 'não encontrado'", async () => {
    const p = await guardado();
    await expect(apagarPublicacao(outro, p.id)).rejects.toSatisfy(
      (e) => codigo(e) === "nao_encontrado",
    );
    expect(await repo.porId(p.id)).not.toBeNull();
  });

  it.each([
    ["empresa", empresa],
    ["admin", admin],
  ])("%s não apaga trabalho de ninguém", async (_nome, quem) => {
    const p = await guardado();
    await expect(apagarPublicacao(quem, p.id)).rejects.toSatisfy(
      (e) => codigo(e) === "sem_permissao",
    );
  });

  it("arquivo que fica no Storage vai ao Sentry, e o registro já saiu", async () => {
    const p = await guardado();
    apagarFoto.mockResolvedValueOnce(false);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    await apagarPublicacao(prestador, p.id);

    expect(await repo.porId(p.id)).toBeNull();
    expect(erro).toHaveBeenCalled();
  });
});
