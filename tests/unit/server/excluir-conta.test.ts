/**
 * @vitest-environment node
 *
 * Excluir a própria conta (#423).
 *
 * O que se prova aqui é a orquestração: quem pode, a senha, a assinatura
 * cancelada **antes** e o que acontece quando o cancelamento falha. O que
 * sai e o que fica no banco é provado num Postgres de verdade, em
 * `schema.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

import { gerarHash } from "@/server/auth/password";
import { limparLimites } from "@/server/auth/rate-limit";
import type { Autenticado, Papel } from "@/server/auth/rbac";
import { excluirConta } from "@/server/conta/servico";
import { ehAppError } from "@/server/errors";
import {
  RepositorioPagamentosMemoria,
  usarRepositorioPagamentos,
} from "@/server/pagamentos";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

const SENHA = "senha-certa-123";

let repo: RepositorioMemoria;
let pagamentos: RepositorioPagamentosMemoria;
let restaurar: () => void;

async function conta(papel: Papel, email = "pessoa@teste.lupa") {
  const u = await repo.criar({
    email,
    senhaHash: await gerarHash(SENHA),
    papel,
    nomeCompleto: "Pessoa de Teste",
    telefone: "66999110013",
    cidade: "Sinop - MT",
    cpf: "52998224725",
  });
  return { usuarioId: u.id, papel } satisfies Autenticado;
}

function codigo(e: unknown) {
  return ehAppError(e) ? e.codigo : String(e);
}

beforeEach(() => {
  repo = new RepositorioMemoria();
  pagamentos = new RepositorioPagamentosMemoria();
  const r1 = usarRepositorio(repo);
  const r2 = usarRepositorioPagamentos(pagamentos);
  restaurar = () => {
    r1();
    r2();
  };
  limparLimites();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  restaurar();
  vi.restoreAllMocks();
});

describe("excluir a própria conta", () => {
  it("sem sessão, recusa", async () => {
    await expect(excluirConta(null, SENHA)).rejects.toSatisfy(
      (e) => codigo(e) === "nao_autenticado",
    );
  });

  /** A conta que opera a ferramenta sai por suporte, não pela tela. */
  it("o admin não se exclui pela tela", async () => {
    const admin = await conta("admin");
    await expect(excluirConta(admin, SENHA)).rejects.toSatisfy(
      (e) => codigo(e) === "sem_permissao",
    );
    expect((await repo.porId(admin.usuarioId))?.email).toBe(
      "pessoa@teste.lupa",
    );
  });

  it("senha errada não exclui nada, e diz qual campo errou", async () => {
    const sessao = await conta("candidato_clt");

    const erro = await excluirConta(sessao, "senha-errada").catch((e) => e);

    expect(codigo(erro)).toBe("validacao");
    expect(erro.campos).toEqual([
      { campo: "senha", mensagem: "Senha incorreta." },
    ]);
    expect((await repo.porId(sessao.usuarioId))?.nomeCompleto).toBe(
      "Pessoa de Teste",
    );
  });

  /*
   * Excluir é irreversível, e a sessão pode ser de um cookie roubado: a
   * senha é a prova, e adivinhá-la tem o mesmo limite do login.
   */
  it("tentar a senha em sequência esbarra no limite", async () => {
    const sessao = await conta("candidato_clt");
    const codigos: string[] = [];
    for (let i = 0; i < 7; i++) {
      codigos.push(
        codigo(await excluirConta(sessao, `errada-${i}`).catch((e) => e)),
      );
    }
    expect(codigos).toContain("muitas_tentativas");
  });

  it("com a senha, a conta fica sem nada que identifique a pessoa", async () => {
    const sessao = await conta("prestador_servico");

    await excluirConta(sessao, SENHA);

    const depois = await repo.porId(sessao.usuarioId);
    expect(depois).toMatchObject({
      nomeCompleto: "Conta excluída",
      telefone: "0000000000",
      cpf: null,
    });
    expect(depois?.email).not.toBe("pessoa@teste.lupa");
    // As sessões dos outros aparelhos caem.
    expect((await repo.cortesDeSessao(30)).has(sessao.usuarioId)).toBe(true);
    // E a senha antiga não serve mais para nada.
    await expect(excluirConta(sessao, SENHA)).rejects.toSatisfy(
      (e) => codigo(e) === "validacao",
    );
  });

  it("o e-mail e o CPF ficam livres para uma conta nova", async () => {
    const sessao = await conta("candidato_clt");
    await excluirConta(sessao, SENHA);

    const nova = await conta("candidato_clt");
    expect(nova.usuarioId).not.toBe(sessao.usuarioId);
    expect(await repo.porEmail("pessoa@teste.lupa")).toMatchObject({
      id: nova.usuarioId,
    });
  });

  describe("com assinatura", () => {
    async function assinante() {
      const sessao = await conta("prestador_servico");
      const assinatura = await pagamentos.criarAssinatura({
        usuarioId: sessao.usuarioId,
        tipo: "prestador_mensalidade",
        valorCentavos: 1990,
      });
      await pagamentos.definirStatusAssinatura(assinatura.id, "ativa");
      return sessao;
    }

    it("cancela a renovação antes de excluir", async () => {
      const sessao = await assinante();
      const ordem: string[] = [];
      const excluirDoRepo = repo.excluirConta.bind(repo);
      vi.spyOn(repo, "excluirConta").mockImplementation(async (id) => {
        ordem.push("excluir");
        await excluirDoRepo(id);
      });

      await excluirConta(sessao, SENHA, {
        cancelar: async (_s, tipo) => {
          ordem.push(`cancelar:${tipo}`);
          return { ok: true };
        },
      });

      expect(ordem).toEqual(["cancelar:prestador_mensalidade", "excluir"]);
    });

    /*
     * O caso que decide se a funcionalidade é segura: excluir com a
     * assinatura viva deixaria a cobrança correndo para quem não tem mais
     * conta para cancelá-la.
     */
    it("se o Mercado Pago não cancela, nada é excluído", async () => {
      const sessao = await assinante();

      const erro = await excluirConta(sessao, SENHA, {
        cancelar: async () => ({ ok: false, motivo: "fora do ar" }),
      }).catch((e) => e);

      expect(codigo(erro)).toBe("conflito");
      expect(String(erro.message)).toMatch(/assinatura/);
      expect((await repo.porId(sessao.usuarioId))?.email).toBe(
        "pessoa@teste.lupa",
      );
    });
  });
});
