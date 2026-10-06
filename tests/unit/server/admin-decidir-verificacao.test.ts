/**
 * @vitest-environment node
 *
 * Quem pode decidir um pedido de verificação (#360).
 *
 * `decideVerification` é uma server action exportada de um arquivo de
 * `/admin`. O muro do `proxy.ts` guarda a rota, não a chamada, então a
 * checagem de quem pode precisa estar dentro dela.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  sessao: null as { usuarioId: string; papel: string } | null,
  lidos: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => estado.sessao,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    estado.lidos += 1;
    return null; // modo demonstração: devolve ok sem tocar em nada
  },
}));

import { decideVerification } from "@/app/(app)/admin/actions";

describe("decideVerification", () => {
  beforeEach(() => {
    estado.sessao = null;
    estado.lidos = 0;
  });

  it("sem sessão: recusa antes de abrir qualquer cliente de banco", async () => {
    expect(await decideVerification("p1", "aprovado")).toEqual({
      ok: false,
      error: "Sem permissão.",
    });
    expect(estado.lidos).toBe(0);
  });

  it.each(["candidato_clt", "prestador_servico", "empresa"])(
    "%s: recusa",
    async (papel) => {
      estado.sessao = { usuarioId: "u1", papel };
      expect(await decideVerification("p1", "aprovado")).toEqual({
        ok: false,
        error: "Sem permissão.",
      });
      expect(estado.lidos).toBe(0);
    },
  );

  it("admin: segue para a decisão", async () => {
    estado.sessao = { usuarioId: "a1", papel: "admin" };
    expect(await decideVerification("p1", "reprovado")).toEqual({
      ok: true,
      demo: true,
    });
    expect(estado.lidos).toBe(1);
  });
});
