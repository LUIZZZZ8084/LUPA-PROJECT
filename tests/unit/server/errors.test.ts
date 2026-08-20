/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppError,
  comoAppError,
  ehAppError,
  erros,
  gerarIdErro,
} from "@/server/errors";
import { desempacotar, falha, mapear, ok, tentar } from "@/server/result";

describe("AppError", () => {
  it("separa a mensagem da tela do detalhe técnico", () => {
    const erro = new AppError("interno", {
      mensagem: "Algo deu errado do nosso lado.",
      detalhe: 'relation "profiles" does not exist',
    });

    expect(erro.mensagem).toBe("Algo deu errado do nosso lado.");
    expect(erro.message).toBe('relation "profiles" does not exist');
  });

  /**
   * O que vai para o navegador não pode conter estrutura interna: nome de
   * tabela num erro é mapa para quem estiver sondando o sistema.
   */
  it("paraCliente não vaza detalhe técnico nem stack", () => {
    const erro = new AppError("interno", {
      detalhe: 'relation "profiles" does not exist',
    });
    const payload = erro.paraCliente();

    expect(JSON.stringify(payload)).not.toContain("profiles");
    expect(payload).not.toHaveProperty("stack");
    expect(payload).not.toHaveProperty("detalhe");
    expect(payload.mensagem).toBe(
      "Algo deu errado do nosso lado. Já estamos sabendo.",
    );
  });

  it("carrega um id que aparece para a pessoa e no log", () => {
    const erro = erros.interno("falhou");
    expect(erro.id).toHaveLength(6);
    expect(erro.paraCliente().id).toBe(erro.id);
  });

  it("mapeia cada código para o status HTTP correto", () => {
    expect(new AppError("validacao").status).toBe(422);
    expect(new AppError("nao_autenticado").status).toBe(401);
    expect(new AppError("sem_permissao").status).toBe(403);
    expect(new AppError("nao_encontrado").status).toBe(404);
    expect(new AppError("conflito").status).toBe(409);
    expect(new AppError("muitas_tentativas").status).toBe(429);
    expect(new AppError("indisponivel").status).toBe(503);
    expect(new AppError("interno").status).toBe(500);
  });

  it("mensagem padrão diz o próximo passo, não só o problema", () => {
    expect(new AppError("nao_autenticado").mensagem).toMatch(
      /Entre na sua conta/,
    );
    expect(new AppError("muitas_tentativas").mensagem).toMatch(/tente de novo/);
  });

  it("leva os campos de validação para o cliente", () => {
    const erro = erros.validacao([{ campo: "email", mensagem: "inválido" }]);
    expect(erro.paraCliente().campos).toEqual([
      { campo: "email", mensagem: "inválido" },
    ]);
  });
});

describe("gerarIdErro", () => {
  it("evita caracteres que se confundem ao ditar por telefone", () => {
    const ids = Array.from({ length: 200 }, gerarIdErro).join("");
    expect(ids).not.toMatch(/[01IO]/);
  });

  it("não repete na prática", () => {
    const gerados = new Set(Array.from({ length: 500 }, gerarIdErro));
    expect(gerados.size).toBe(500);
  });
});

describe("comoAppError", () => {
  it("devolve o mesmo objeto quando já é AppError", () => {
    const original = erros.naoEncontrado("Vaga");
    expect(comoAppError(original)).toBe(original);
  });

  /** Mensagem de exceção do banco pode expor coluna e estrutura. */
  it("Error comum vira interno com mensagem genérica na tela", () => {
    const convertido = comoAppError(new Error("duplicate key value violates"));
    expect(convertido.codigo).toBe("interno");
    expect(convertido.mensagem).not.toContain("duplicate key");
    expect(convertido.message).toContain("duplicate key");
  });

  it("valor que não é Error também vira interno", () => {
    expect(comoAppError("string solta").codigo).toBe("interno");
    expect(comoAppError(null).codigo).toBe("interno");
  });

  it("ehAppError distingue corretamente", () => {
    expect(ehAppError(erros.interno())).toBe(true);
    expect(ehAppError(new Error("x"))).toBe(false);
    expect(ehAppError({ codigo: "interno" })).toBe(false);
  });
});

describe("Resultado", () => {
  it("ok carrega o valor", () => {
    const r = ok(42);
    expect(r.ok && r.valor).toBe(42);
  });

  it("falha carrega o erro", () => {
    const r = falha(erros.naoEncontrado("Vaga"));
    expect(!r.ok && r.erro.codigo).toBe("nao_encontrado");
  });

  it("tentar captura exceção em vez de deixar escapar", async () => {
    const r = await tentar(() => {
      throw new Error("explodiu");
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe("interno");
  });

  it("tentar devolve o valor quando não lança", async () => {
    const r = await tentar(async () => "tudo certo");
    expect(r.ok && r.valor).toBe("tudo certo");
  });

  it("tentar preserva AppError já classificado", async () => {
    const r = await tentar(() => {
      throw erros.semPermissao("papel errado");
    });
    expect(!r.ok && r.erro.codigo).toBe("sem_permissao");
  });

  it("mapear age só no caminho feliz", () => {
    expect(mapear(ok(2), (n) => n * 10)).toEqual({ ok: true, valor: 20 });

    const comErro = falha<number>(erros.interno());
    const transformado = mapear(comErro, (n) => n * 10);
    expect(transformado.ok).toBe(false);
  });

  it("desempacotar lança o AppError original", () => {
    expect(() => desempacotar(falha(erros.conflito("já existe")))).toThrow(
      AppError,
    );
    expect(desempacotar(ok("valor"))).toBe("valor");
  });
});

describe("log", () => {
  afterEach(() => vi.restoreAllMocks());

  async function capturar(fn: () => void) {
    const saida: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => saida.push(String(s)));
    vi.spyOn(console, "error").mockImplementation((s) => saida.push(String(s)));
    fn();
    return saida;
  }

  it("emite JSON de uma linha", async () => {
    const { log } = await import("@/server/logger");
    const [linha] = await capturar(() =>
      log.info("cadastro concluído", { acao: "auth.signup", papel: "empresa" }),
    );
    const objeto = JSON.parse(linha);
    expect(objeto.nivel).toBe("info");
    expect(objeto.acao).toBe("auth.signup");
    expect(objeto.papel).toBe("empresa");
    expect(objeto.hora).toBeTruthy();
  });

  /** Nem no nosso log: telefone e CPF são dado pessoal em qualquer lugar. */
  it("remove dado pessoal antes de escrever", async () => {
    const { log } = await import("@/server/logger");
    const [linha] = await capturar(() =>
      log.info("tentativa", {
        phone: "66999110001",
        texto: "contato 66999110001",
      }),
    );
    expect(linha).not.toContain("66999110001");
    expect(linha).toContain("[removido]");
  });

  /**
   * Erro esperado é o sistema funcionando. Se senha errada virar `error`, o
   * alerta toca o dia inteiro e ninguém olha mais quando importa.
   */
  it("erro esperado sai como warn; inesperado, como error com stack", async () => {
    const { log } = await import("@/server/logger");

    const [esperado] = await capturar(() =>
      log.erro(erros.validacao([{ campo: "email", mensagem: "inválido" }])),
    );
    expect(JSON.parse(esperado).nivel).toBe("warn");
    expect(JSON.parse(esperado).stack).toBeUndefined();

    const [inesperado] = await capturar(() => log.erro(erros.interno("boom")));
    expect(JSON.parse(inesperado).nivel).toBe("error");
    expect(JSON.parse(inesperado).stack).toBeTruthy();
  });

  it("o identificador do erro entra no log", async () => {
    const { log } = await import("@/server/logger");
    const erro = erros.interno("falhou");
    const [linha] = await capturar(() => log.erro(erro));
    expect(JSON.parse(linha).erroId).toBe(erro.id);
  });
});
