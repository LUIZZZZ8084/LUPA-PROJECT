/**
 * @vitest-environment node
 *
 * Sem as variáveis do Supabase no ambiente (o caso do teste, por padrão,
 * e da demonstração em produção), o painel da empresa mostra sempre a
 * mesma empresa fictícia (`empresaDoPainel`, em `src/lib/data.ts`) —
 * decisão de produto documentada no AGENTS.md. Sem este mapeamento, uma
 * vaga publicada por uma conta de demonstração recém-criada teria um
 * `empresaId` que nunca aparece em nenhum painel: a publicação pareceria
 * ter falhado silenciosamente.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import { DEMO_COMPANY_ID } from "@/lib/mock-data";
import type { Autenticado } from "@/server/auth/rbac";
import { usarRepositorioCarteiras } from "@/server/carteiras";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import { publicarVaga } from "@/server/vagas/servico";
import { carteiraInfinita } from "./carteira-de-teste";

const DADOS = {
  titulo: "Auxiliar Administrativo",
  descricao: "Rotina de recepção, arquivo e atendimento telefônico.",
  categoria: "Administrativo",
  cidade: "Sinop",
  tipoContrato: "CLT",
  endereco: "Av. das Itaúbas, 1200",
};

/*
 * Publicar vaga custa crédito desde a #172, e este arquivo publica como
 * preparação — o que ele mede é outra coisa. A carteira infinita deixa
 * isso explícito; quem mede a carteira é `carteira-de-vagas.test.ts`, e
 * quem mede o portão da publicação é `vagas.test.ts`.
 */
let restaurarCarteiraDoArquivo: () => void;
beforeEach(() => {
  restaurarCarteiraDoArquivo = usarRepositorioCarteiras(carteiraInfinita());
});
afterEach(() => restaurarCarteiraDoArquivo());

describe("vagas em modo demonstração", () => {
  let restaurar: () => void;

  beforeEach(() => {
    restaurar = usarRepositorioVagas(new RepositorioVagasMemoria());
  });

  afterEach(() => {
    restaurar();
  });

  it("qualquer conta de empresa publica sob a empresa fixa de demonstração", async () => {
    const contaNova: Autenticado = {
      usuarioId: crypto.randomUUID(),
      papel: "empresa",
    };

    const vaga = await publicarVaga(contaNova, DADOS);

    expect(vaga.empresaId).toBe(DEMO_COMPANY_ID);
    expect(vaga.empresaId).not.toBe(contaNova.usuarioId);
  });

  it("duas contas de empresa diferentes caem na mesma empresa", async () => {
    const a: Autenticado = { usuarioId: crypto.randomUUID(), papel: "empresa" };
    const b: Autenticado = { usuarioId: crypto.randomUUID(), papel: "empresa" };

    const vagaA = await publicarVaga(a, DADOS);
    const vagaB = await publicarVaga(b, { ...DADOS, titulo: "Outra vaga" });

    expect(vagaA.empresaId).toBe(vagaB.empresaId);
  });
});
