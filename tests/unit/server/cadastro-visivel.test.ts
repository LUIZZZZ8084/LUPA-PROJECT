/**
 * @vitest-environment node
 *
 * "Quero que empresas me encontrem", escolhido no cadastro (#622).
 *
 * O que se prova: o "Sim" que a tela traz marcado vira visível; o "Não"
 * vira invisível; e sem a escolha no envio — formulário antigo, chamada
 * direta — fica desligado, porque ninguém fica visível sem ter visto a
 * escolha.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limparLimites } from "@/server/auth/rate-limit";
import { schemaCadastro } from "@/server/auth/schemas";
import { cadastrar } from "@/server/auth/servico";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";
import { validar } from "@/server/validation";

let seq = 0;
function candidato(extra: Record<string, unknown> = {}) {
  seq += 1;
  return {
    papel: "candidato_clt",
    nomeCompleto: "Pessoa de Teste",
    email: `visivel-${seq}@teste.lupa`,
    senha: "senha-forte-123",
    telefone: "66999999999",
    cidade: "Sinop - MT",
    cpf: ["529.982.247-25", "111.444.777-35", "390.533.447-05"][seq % 3],
    areaDesejada: "Agronegócio",
    ...extra,
  };
}

describe("ser encontrado, escolhido no cadastro", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);
    limparLimites();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  async function cadastrarCom(extra: Record<string, unknown>) {
    const r = validar(schemaCadastro, candidato(extra));
    if (!r.ok) throw new Error(JSON.stringify(r.erro));
    const u = await cadastrar(r.valor, `198.51.100.${seq}`);
    return repo.perfilCandidato(u.id);
  }

  it('"sim" nasce visível', async () => {
    expect(
      (await cadastrarCom({ visivelParaEmpresas: "sim" }))?.visivelParaEmpresas,
    ).toBe(true);
  });

  it('"nao" nasce invisível', async () => {
    expect(
      (await cadastrarCom({ visivelParaEmpresas: "nao" }))?.visivelParaEmpresas,
    ).toBe(false);
  });

  it("sem a escolha no envio, nasce invisível", async () => {
    expect((await cadastrarCom({}))?.visivelParaEmpresas).toBe(false);
  });
});
