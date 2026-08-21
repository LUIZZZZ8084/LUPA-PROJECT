/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { erros } from "@/server/errors";

/** Captura o que foi escrito no log durante a chamada. */
function capturarLog() {
  const linhas: string[] = [];
  const guardar = (s: unknown) => {
    linhas.push(String(s));
  };
  vi.spyOn(console, "log").mockImplementation(guardar);
  vi.spyOn(console, "error").mockImplementation(guardar);
  return {
    linhas,
    objetos: () =>
      linhas.map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return { bruto: l };
        }
      }),
  };
}

describe("criarAcao", () => {
  let logger: ReturnType<typeof capturarLog>;

  beforeEach(() => {
    logger = capturarLog();
  });
  afterEach(() => vi.restoreAllMocks());

  const schema = z.object({
    email: z.email("E-mail inválido."),
    idade: z.coerce.number().min(18, "Precisa ser maior de idade."),
  });

  const acao = criarAcao({
    nome: "teste.exemplo",
    entrada: schema,
    executar: async (dados) => ({ recebido: dados.email }),
  });

  it("valida antes de executar", async () => {
    const executar = vi.fn();
    const comEspiao = criarAcao({
      nome: "teste.espiao",
      entrada: schema,
      executar,
    });

    const r = await comEspiao({ email: "invalido", idade: 30 });

    expect(r.ok).toBe(false);
    expect(executar).not.toHaveBeenCalled();
  });

  it("devolve os campos inválidos para a interface destacar", async () => {
    const r = await acao({ email: "nao-e-email", idade: 15 });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("validacao");
    expect(r.campos?.map((c) => c.campo).sort()).toEqual(["email", "idade"]);
  });

  it("aceita FormData tanto quanto objeto", async () => {
    const fd = new FormData();
    fd.set("email", "joao@teste.com");
    fd.set("idade", "30");

    const r = await acao(fd);
    expect(r.ok && r.dados.recebido).toBe("joao@teste.com");
  });

  /**
   * O ponto do envelope: uma exceção no meio de um cadastro não pode virar
   * a tela de erro genérica do Next com a pessoa perdendo o que digitou.
   */
  it("não deixa exceção escapar para a interface", async () => {
    const explode = criarAcao({
      nome: "teste.explode",
      entrada: z.object({}),
      executar: async () => {
        throw new Error("banco fora do ar");
      },
    });

    const r = await explode({});

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("interno");
    // Mensagem de infraestrutura não chega ao usuário.
    expect(r.mensagem).not.toContain("banco fora do ar");
    expect(r.id).toHaveLength(6);
  });

  it("preserva o código de um AppError lançado de propósito", async () => {
    const semPermissao = criarAcao({
      nome: "teste.permissao",
      entrada: z.object({}),
      executar: async () => {
        throw erros.semPermissao("papel errado");
      },
    });

    const r = await semPermissao({});
    expect(!r.ok && r.codigo).toBe("sem_permissao");
  });

  it("registra ação e duração no caminho feliz", async () => {
    await acao({ email: "joao@teste.com", idade: 30 });

    const linha = logger.objetos().find((o) => o.acao === "teste.exemplo");
    expect(linha).toBeTruthy();
    expect(linha.nivel).toBe("info");
    expect(typeof linha.ms).toBe("number");
    expect(linha.requestId).toHaveLength(8);
  });

  it("registra a falha com o mesmo id que o usuário recebe", async () => {
    const r = await acao({ email: "invalido", idade: 30 });
    expect(r.ok).toBe(false);
    if (r.ok) return;

    const linha = logger.objetos().find((o) => o.erroId);
    expect(linha.erroId).toBe(r.id);
  });

  /** Senha em log é vazamento, mesmo em log interno. */
  it("não escreve senha no log", async () => {
    const comSenha = criarAcao({
      nome: "teste.senha",
      entrada: z.object({ senha: z.string() }),
      executar: async () => ({ feito: true }),
    });

    await comSenha({ senha: "minha-senha-secreta-123" });

    expect(logger.linhas.join(" ")).not.toContain("minha-senha-secreta-123");
  });

  it("funciona sem entrada nenhuma", async () => {
    const semEntrada = criarAcao({
      nome: "teste.vazio",
      entrada: z.object({}),
      executar: async () => "pronto",
    });

    expect(await semEntrada()).toEqual({ ok: true, dados: "pronto" });
  });

  it("cada chamada recebe um requestId próprio", async () => {
    await acao({ email: "a@teste.com", idade: 30 });
    await acao({ email: "b@teste.com", idade: 30 });

    const ids = logger
      .objetos()
      .filter((o) => o.requestId)
      .map((o) => o.requestId);

    expect(new Set(ids).size).toBeGreaterThan(1);
  });
});

/**
 * `redirect()` e `notFound()` do Next sinalizam por exceção. A envelopadora
 * existe para que exceção nenhuma vire tela de erro — mas estas duas não
 * são erro, são navegação.
 *
 * Sem esta distinção, quem escrevesse `redirect()` numa action veria a
 * navegação virar mensagem de erro na tela, sem nada de errado no código.
 * Foi o que impediu o login de redirecionar no servidor.
 */
describe("controle de fluxo do Next não é erro", () => {
  function comDigest(digest: string) {
    return Object.assign(new Error("controle de fluxo"), { digest });
  }

  it("deixa o redirect passar em vez de virar resposta de erro", async () => {
    const acao = criarAcao({
      nome: "teste.redirect",
      entrada: z.object({}),
      executar: async () => {
        throw comDigest("NEXT_REDIRECT;replace;/admin/painel;307;");
      },
    });

    await expect(acao(new FormData())).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("deixa o notFound passar", async () => {
    const acao = criarAcao({
      nome: "teste.notfound",
      entrada: z.object({}),
      executar: async () => {
        throw comDigest("NEXT_NOT_FOUND");
      },
    });

    await expect(acao(new FormData())).rejects.toMatchObject({
      digest: "NEXT_NOT_FOUND",
    });
  });

  /** Erro de verdade continua sendo capturado — é a razão da envelopadora. */
  it("erro comum continua virando resposta, não exceção", async () => {
    const acao = criarAcao({
      nome: "teste.erro",
      entrada: z.object({}),
      executar: async () => {
        throw new Error("banco fora do ar");
      },
    });

    const r = await acao(new FormData());
    expect(r.ok).toBe(false);
  });

  /** `digest` que não é do Next não pode escapar. */
  it("digest de outra origem não escapa", async () => {
    const acao = criarAcao({
      nome: "teste.digest-alheio",
      entrada: z.object({}),
      executar: async () => {
        throw comDigest("ALGUMA_OUTRA_COISA");
      },
    });

    const r = await acao(new FormData());
    expect(r.ok).toBe(false);
  });
});
