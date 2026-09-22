/**
 * O que chega ao Sentry, e o que não chega (#247).
 *
 * O painel só recebia erro **não tratado**, e o `criarAcao` não deixa
 * nenhum passar — ele existe justamente para que exceção não vire tela de
 * erro do Next. Resultado: o caminho por onde as 31 actions passam nunca
 * ficaria vermelho lá, e o episódio dos R$ 29,90 (#196) não apareceria no
 * painel nem com DSN ligado.
 *
 * O corte que este teste trava é o mesmo que o `log.erro` já usava para
 * decidir o nível da linha: validação, senha errada e sem permissão são o
 * sistema funcionando. Mandá-las para o Sentry daria um alerta que toca o
 * dia inteiro e que todo mundo aprende a ignorar — a razão de o corte
 * existir é essa, e é por isso que ele merece teste próprio em vez de ser
 * lido do código.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const observabilidade = vi.hoisted(() => ({
  isSentryEnabled: true,
  scrubSensitiveData: <T>(evento: T) => evento,
}));

vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@/lib/observability", () => observabilidade);

const { AppError } = await import("@/server/errors");
const { log } = await import("@/server/logger");

describe("erro inesperado chega ao Sentry", () => {
  beforeEach(() => {
    sentry.captureException.mockClear();
    observabilidade.isSentryEnabled = true;
    // O `log.erro` escreve a linha estruturada de qualquer forma; o que
    // este arquivo mede é a chamada ao Sentry, não a saída no console.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("manda o interno, com o código do erro como tag", async () => {
    const erro = new AppError("interno", {
      contexto: { acao: "vaga.publicar" },
    });

    log.erro(erro);

    // O SDK é carregado sob demanda (#255), então o envio é assíncrono.
    await vi.waitFor(() =>
      expect(sentry.captureException).toHaveBeenCalledTimes(1),
    );
    const [enviado, opcoes] = sentry.captureException.mock.calls[0];
    expect(enviado).toBe(erro);
    /*
     * A tag é o que liga o código ditado por telefone ao evento no painel.
     * Sem ela, "deu erro K7M2PQ" não tem onde ser procurado — e a mensagem
     * de `errors.ts` pede exatamente isso à pessoa.
     */
    expect(opcoes.tags.erroId).toBe(erro.id);
    expect(opcoes.tags.codigo).toBe("interno");
    expect(opcoes.extra.acao).toBe("vaga.publicar");
  });

  it("manda o indisponivel, que também é inesperado", async () => {
    log.erro(new AppError("indisponivel"));
    await vi.waitFor(() =>
      expect(sentry.captureException).toHaveBeenCalledTimes(1),
    );
  });

  it("não manda o que é o sistema funcionando", () => {
    for (const codigo of [
      "validacao",
      "nao_autenticado",
      "sem_permissao",
      "nao_encontrado",
      "conflito",
      "limite_excedido",
      "muitas_tentativas",
    ] as const) {
      log.erro(new AppError(codigo));
    }

    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("sem DSN não chama nada, nem para erro interno", () => {
    observabilidade.isSentryEnabled = false;

    log.erro(new AppError("interno"));

    /*
     * `captureException` num SDK não inicializado não quebra, mas passaria
     * a ser uma chamada por erro interno em produção sem monitoramento — e
     * o modo demonstração precisa rodar sem nenhuma peça externa.
     */
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

/*
 * O logger não carrega o SDK no topo (#255).
 *
 * O logger está no grafo de quase todo o servidor. Com o import estático,
 * toda função e todo teste passava a carregar o Sentry — com ou sem DSN —,
 * e o import frio do serviço de pagamentos subiu de 641 para 1.079 ms: o
 * bastante para os testes que reimportam o serviço a cada caso passarem do
 * tempo de hook sob carga. Lê o código-fonte porque o que se protege é o
 * formato do import, não o comportamento.
 */
describe("o logger carrega o Sentry sob demanda", () => {
  it("não há import estático de @sentry/nextjs", async () => {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync("src/server/logger.ts", "utf8");
    expect(fonte).not.toMatch(/^import[^;]*from "@sentry\/nextjs"/m);
  });
});
