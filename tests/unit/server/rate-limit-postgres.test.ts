/**
 * @vitest-environment node
 *
 * O limite de tentativas com contador no banco.
 *
 * O que se confere aqui é o contrato com o banco — que os parâmetros da
 * janela saem daqui, que a limpeza não derruba o login, e que bloqueio
 * vencido não bloqueia. A corrida em si está travada contra Postgres real
 * em `schema.test.ts`; jsdom não tem concorrência de verdade.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const rpcs: { nome: string; args: Record<string, unknown> }[] = [];
const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let resposta: Resposta = { data: null, error: null };
let respostaRpc: Resposta = { data: null, error: null };
let erroDaLimpeza: { message: string } | null = null;

function construtor(tabela: string) {
  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta,
    then: (r: (v: Resposta) => unknown) => Promise.resolve(resposta).then(r),
  };
  for (const metodo of ["select", "eq", "delete"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({
    from: (tabela: string) => construtor(tabela),
    rpc: async (nome: string, args: Record<string, unknown>) => {
      rpcs.push({ nome, args });
      if (nome === "limpar_tentativas_vencidas") {
        return { data: null, error: erroDaLimpeza };
      }
      return respostaRpc;
    },
  }),
}));

import { RepositorioLimitePostgres } from "@/server/auth/rate-limit-postgres";
import { CONFIG_LIMITE } from "@/server/auth/rate-limit-tipos";
import { ehAppError } from "@/server/errors";

describe("RepositorioLimitePostgres", () => {
  const repo = new RepositorioLimitePostgres();

  beforeEach(() => {
    rpcs.length = 0;
    chamadas.length = 0;
    resposta = { data: null, error: null };
    respostaRpc = { data: null, error: null };
    erroDaLimpeza = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("a janela e o teto vão para o banco, não ficam no SQL", async () => {
    await repo.registrarFalha("login:a@teste.lupa");

    const registro = rpcs.find((r) => r.nome === "registrar_falha_de_acesso");
    expect(registro?.args).toEqual({
      p_chave: "login:a@teste.lupa",
      p_janela_segundos: CONFIG_LIMITE.JANELA_MS / 1000,
      p_max_tentativas: CONFIG_LIMITE.MAX_TENTATIVAS,
      p_bloqueio_segundos: CONFIG_LIMITE.BLOQUEIO_MS / 1000,
    });
  });

  it("a limpeza acompanha o registro", async () => {
    await repo.registrarFalha("login:a@teste.lupa");
    expect(rpcs.map((r) => r.nome)).toContain("limpar_tentativas_vencidas");
  });

  /*
   * O limite já foi aplicado quando a limpeza roda. Deixar a falha dela
   * subir transformaria uma tarefa de manutenção em erro de login.
   */
  it("falha na limpeza não derruba o registro", async () => {
    erroDaLimpeza = { message: "deadlock" };
    await expect(
      repo.registrarFalha("login:a@teste.lupa"),
    ).resolves.toBeUndefined();
  });

  it("falha no registro sobe — o limite não pode falhar em silêncio", async () => {
    respostaRpc = { data: null, error: { message: "fora do ar" } };
    await expect(repo.registrarFalha("login:a@teste.lupa")).rejects.toSatisfy(
      ehAppError,
    );
  });

  it("sem linha, a chave não está bloqueada", async () => {
    resposta = { data: null, error: null };
    expect(await repo.bloqueadoAte("login:a@teste.lupa")).toBeNull();
  });

  it("bloqueio no futuro devolve até quando", async () => {
    const futuro = new Date(Date.now() + 60_000).toISOString();
    resposta = { data: { bloqueado_ate: futuro }, error: null };

    const ate = await repo.bloqueadoAte("login:a@teste.lupa");
    expect(ate?.toISOString()).toBe(futuro);
  });

  /*
   * Linha antiga com `bloqueado_ate` no passado não pode bloquear ninguém.
   * Sem esta checagem, quem levou bloqueio uma vez ficaria preso até
   * alguém limpar a tabela.
   */
  it("bloqueio vencido não bloqueia", async () => {
    resposta = {
      data: { bloqueado_ate: new Date(Date.now() - 60_000).toISOString() },
      error: null,
    };
    expect(await repo.bloqueadoAte("login:a@teste.lupa")).toBeNull();
  });

  it("sucesso apaga a linha da chave, e só dela", async () => {
    await repo.registrarSucesso("login:a@teste.lupa");

    expect(chamadas.some((c) => c.metodo === "delete")).toBe(true);
    const eq = chamadas.find((c) => c.metodo === "eq");
    expect(eq?.args).toEqual(["chave", "login:a@teste.lupa"]);
  });
});
