/**
 * @vitest-environment node
 *
 * Avaliar um prestador.
 *
 * O que se protege aqui são as três regras que decidem se a reputação vale
 * alguma coisa: quem pode escrever, que ninguém avalia a si mesmo, e que
 * cada pessoa avalia uma vez. As duas últimas também moram no banco — a
 * checagem na aplicação existe para dar mensagem decente antes de tentar,
 * não no lugar da garantia.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import { pode } from "@/server/auth/rbac";
import type { RepositorioMemoria } from "@/server/repositories";

const PRESTADOR = "prestador-avaliado";

describe("avaliar prestador", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;
  let avaliarPrestador: typeof import("@/server/avaliacoes/servico").avaliarPrestador;
  let jaAvaliou: typeof import("@/server/avaliacoes/servico").jaAvaliou;
  /*
   * `ehAppError` também precisa vir do ciclo novo.
   *
   * Ele testa `instanceof AppError`, e `resetModules` cria uma classe
   * nova: o erro lançado pelo serviço recém-importado não é instância da
   * classe que o import do topo conhece. O teste falharia dizendo que o
   * erro não é um AppError, quando a mensagem na tela estava certa.
   */
  let ehAppError: typeof import("@/server/errors").ehAppError;

  async function criarConta(papel: Autenticado["papel"]): Promise<Autenticado> {
    const usuario = await repo.criar({
      email: `a${Math.random()}@teste.lupa`,
      senhaHash: "hash",
      papel,
      nomeCompleto: "Quem Avalia",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    return { usuarioId: usuario.id, papel };
  }

  beforeEach(async () => {
    /*
     * Import fresco a cada teste: o serviço guarda as avaliações da
     * demonstração num array de módulo, e sem resetar o registro de um
     * teste vazaria para o seguinte.
     *
     * O repositório precisa vir do *mesmo* ciclo de import. Com
     * `resetModules`, o serviço recebe uma cópia nova de
     * `@/server/repositories`; injetar na instância antiga — a do import
     * no topo do arquivo — deixaria o serviço olhando para um repositório
     * vazio, e todo teste falharia com "usuário não encontrado".
     */
    vi.resetModules();
    const [modulo, repositorios, errosDoCiclo] = await Promise.all([
      import("@/server/avaliacoes/servico"),
      import("@/server/repositories"),
      import("@/server/errors"),
    ]);
    avaliarPrestador = modulo.avaliarPrestador;
    jaAvaliou = modulo.jaAvaliou;
    ehAppError = errosDoCiclo.ehAppError;

    repo = new repositorios.RepositorioMemoria();
    restaurar = repositorios.usarRepositorio(repo);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  it("grava a avaliação de quem está logado", async () => {
    const quem = await criarConta("candidato_clt");

    await avaliarPrestador(quem, {
      prestadorId: PRESTADOR,
      nota: 5,
      comentario: "Chegou na hora e explicou tudo antes de começar.",
    });

    expect(await jaAvaliou(quem, PRESTADOR)).toBe(true);
  });

  /** Entrar já é pré-requisito para usar o app: não há portão a mais. */
  it.each(["candidato_clt", "prestador_servico", "empresa"] as const)(
    "%s pode avaliar",
    (papel) => {
      expect(pode(papel, "avaliacao:escrever")).toBe(true);
    },
  );

  /**
   * O admin enxerga tudo e não age no lugar de ninguém — e reputação é
   * ação com autor.
   */
  it("admin não avalia", () => {
    expect(pode("admin", "avaliacao:escrever")).toBe(false);
  });

  it("ninguém avalia a si mesmo", async () => {
    const quem = await criarConta("prestador_servico");

    await expect(
      avaliarPrestador(quem, { prestadorId: quem.usuarioId, nota: 5 }),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "validacao");
  });

  it("cada pessoa avalia uma vez", async () => {
    const quem = await criarConta("candidato_clt");
    await avaliarPrestador(quem, { prestadorId: PRESTADOR, nota: 4 });

    await expect(
      avaliarPrestador(quem, { prestadorId: PRESTADOR, nota: 1 }),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "conflito");
  });

  it("mas duas pessoas diferentes avaliam o mesmo prestador", async () => {
    const primeira = await criarConta("candidato_clt");
    const segunda = await criarConta("empresa");

    await avaliarPrestador(primeira, { prestadorId: PRESTADOR, nota: 5 });
    await avaliarPrestador(segunda, { prestadorId: PRESTADOR, nota: 4 });

    expect(await jaAvaliou(primeira, PRESTADOR)).toBe(true);
    expect(await jaAvaliou(segunda, PRESTADOR)).toBe(true);
  });

  it.each([0, 6, 2.5])("recusa nota %s", async (nota) => {
    const quem = await criarConta("candidato_clt");

    await expect(
      avaliarPrestador(quem, { prestadorId: PRESTADOR, nota }),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "validacao");
  });

  it("recusa sem sessão", async () => {
    await expect(
      avaliarPrestador(null, { prestadorId: PRESTADOR, nota: 5 }),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "nao_autenticado");
  });
});
