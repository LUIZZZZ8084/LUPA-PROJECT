/**
 * @vitest-environment node
 *
 * Quem pode decidir um pedido de verificação (#360), e com que chave
 * (#419).
 *
 * `decideVerification` é uma server action exportada de um arquivo de
 * `/admin`. O muro do `proxy.ts` guarda a rota, não a chamada, então a
 * checagem de quem pode precisa estar dentro dela.
 *
 * E ela precisa da chave de serviço: `pedidos_verificacao` e `usuarios` são
 * fechadas para a anônima, e com ela toda decisão respondia "Pedido não
 * encontrado".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  sessao: null as { usuarioId: string; papel: string } | null,
  configurado: false,
  abertos: 0,
  chamadas: [] as { alvo: string; metodo: string; args: unknown[] }[],
  erroAoApagar: null as { message: string } | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => estado.sessao,
}));
vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return estado.configurado;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    throw new Error("a decisão não pode usar o cliente da chave anônima");
  },
}));

function consulta(tabela: string) {
  const registrar =
    (metodo: string) =>
    (...args: unknown[]) => {
      estado.chamadas.push({ alvo: tabela, metodo, args });
      return construtor;
    };
  const construtor: Record<string, unknown> = {
    select: registrar("select"),
    update: registrar("update"),
    eq: registrar("eq"),
    maybeSingle: async () => ({
      data: {
        id: "p1",
        usuario_id: "u9",
        documento_path: "u9/documento.jpg",
        selfie_path: "u9/selfie.jpg",
      },
      error: null,
    }),
    // O builder do Supabase é thenable: `await` numa consulta a executa.
    then: (resolver: (r: { error: null }) => unknown) =>
      resolver({ error: null }),
  };
  return construtor;
}

vi.mock("@/lib/supabase/service", () => ({
  // A action do admin alcança o serviço de arquivos pela denúncia de
  // foto (#452), que lê esta constante na importação.
  temChaveDeServico: true,
  clienteDeServico: () => {
    estado.abertos += 1;
    return {
      from: consulta,
      storage: {
        from: (bucket: string) => ({
          remove: async (caminhos: string[]) => {
            estado.chamadas.push({
              alvo: `storage:${bucket}`,
              metodo: "remove",
              args: [caminhos],
            });
            return { error: estado.erroAoApagar };
          },
        }),
      },
    };
  },
}));

import { decideVerification } from "@/app/(app)/admin/actions";

describe("decideVerification", () => {
  beforeEach(() => {
    estado.sessao = null;
    estado.configurado = false;
    estado.abertos = 0;
    estado.chamadas = [];
    estado.erroAoApagar = null;
  });

  it("sem sessão: recusa antes de abrir qualquer cliente de banco", async () => {
    estado.configurado = true;
    expect(await decideVerification("p1", "aprovado")).toEqual({
      ok: false,
      error: "Sem permissão.",
    });
    expect(estado.abertos).toBe(0);
  });

  it.each(["candidato_clt", "prestador_servico", "empresa"])(
    "%s: recusa",
    async (papel) => {
      estado.configurado = true;
      estado.sessao = { usuarioId: "u1", papel };
      expect(await decideVerification("p1", "aprovado")).toEqual({
        ok: false,
        error: "Sem permissão.",
      });
      expect(estado.abertos).toBe(0);
    },
  );

  it("admin, em demonstração: devolve ok sem tocar em nada", async () => {
    estado.sessao = { usuarioId: "a1", papel: "admin" };
    expect(await decideVerification("p1", "reprovado")).toEqual({
      ok: true,
      demo: true,
    });
    expect(estado.abertos).toBe(0);
  });

  it("admin, com banco: decide pela chave de serviço e apaga os arquivos", async () => {
    estado.configurado = true;
    estado.sessao = { usuarioId: "a1", papel: "admin" };

    expect(await decideVerification("p1", "aprovado")).toEqual({ ok: true });

    expect(estado.abertos).toBe(1);
    const atualizados = estado.chamadas
      .filter((c) => c.metodo === "update")
      .map((c) => c.alvo);
    expect(atualizados).toEqual(["pedidos_verificacao", "usuarios"]);
    expect(estado.chamadas.at(-1)).toEqual({
      alvo: "storage:verificacao",
      metodo: "remove",
      args: [["u9/documento.jpg", "u9/selfie.jpg"]],
    });
  });

  /*
   * Apagar é a obrigação de retenção. Falha aqui deixava o documento no
   * bucket sem ninguém saber.
   */
  it("falha ao apagar os arquivos vai ao Sentry, sem os caminhos", async () => {
    estado.configurado = true;
    estado.sessao = { usuarioId: "a1", papel: "admin" };
    estado.erroAoApagar = { message: "bucket fora do ar" };
    const saida = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await decideVerification("p1", "reprovado")).toEqual({ ok: true });

    const linhas = saida.mock.calls.map(([l]) => String(l));
    expect(linhas.some((l) => /"nivel":"error"/.test(l))).toBe(true);
    expect(linhas.join("\n")).not.toContain("u9/");
    saida.mockRestore();
  });
});
