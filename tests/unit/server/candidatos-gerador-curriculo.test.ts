/**
 * @vitest-environment node
 *
 * `liberarGeradorCurriculo` e `revogarGeradorCurriculo`, isoladas de quem
 * as aciona — a mesma separação de `prestadores-mensalidade.test.ts` para
 * `estenderMensalidade`: a aritmética (aqui, um booleano) é testada à
 * parte de `aplicarEfeito`, que já tem cobertura própria em
 * `pagamentos-compra-de-curriculo.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  liberarGeradorCurriculo,
  revogarGeradorCurriculo,
} from "@/server/candidatos/servico";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

describe("interruptor do gerador de currículo", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;
  let usuarioId: string;

  beforeEach(async () => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const usuario = await repo.criar({
      email: "candidato@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Candidato de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    await repo.criarPerfilCandidato({
      usuarioId: usuario.id,
      areaDesejada: null,
      resumo: null,
      curriculoUrl: null,
      disponibilidade: null,
      formacao: null,
      habilidades: [],
      visivelParaEmpresas: false,
      geradorCurriculoLiberado: false,
    });
    usuarioId = usuario.id;
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  it("liga o interruptor", async () => {
    await liberarGeradorCurriculo(usuarioId);
    const perfil = await repo.perfilCandidato(usuarioId);
    expect(perfil?.geradorCurriculoLiberado).toBe(true);
  });

  it("desliga o interruptor — caminho do estorno", async () => {
    await liberarGeradorCurriculo(usuarioId);
    await revogarGeradorCurriculo(usuarioId);
    const perfil = await repo.perfilCandidato(usuarioId);
    expect(perfil?.geradorCurriculoLiberado).toBe(false);
  });

  it("recusa liberar quem não tem perfil de candidato", async () => {
    const usuario = await repo.criar({
      email: "empresa@teste.lupa",
      senhaHash: "hash",
      papel: "empresa",
      nomeCompleto: "Empresa de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
    });

    await expect(liberarGeradorCurriculo(usuario.id)).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
  });

  it("recusa revogar quem não tem perfil de candidato", async () => {
    const usuario = await repo.criar({
      email: "empresa2@teste.lupa",
      senhaHash: "hash",
      papel: "empresa",
      nomeCompleto: "Outra Empresa",
      telefone: "66999990000",
      cidade: "Sinop",
    });

    await expect(revogarGeradorCurriculo(usuario.id)).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
  });
});
