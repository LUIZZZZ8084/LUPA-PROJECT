/**
 * @vitest-environment node
 *
 * Sem Supabase configurado (o padrão do teste, e da demonstração em
 * produção), toda vaga publicada cai sob a mesma empresa fixa
 * (`empresaDoPainel`, em `src/lib/data.ts`). Mover candidatura verifica
 * dono através da vaga — sem levar essa regra em conta, uma conta de
 * empresa de demonstração jamais moveria a candidatura de uma vaga
 * publicada por outra conta de demonstração, mesmo as duas mostrando o
 * mesmo painel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import type { Autenticado } from "@/server/auth/rbac";
import {
  RepositorioCandidaturasMemoria,
  usarRepositorioCandidaturas,
} from "@/server/candidaturas";
import { candidatarSe, moverCandidatura } from "@/server/candidaturas/servico";
import { usarRepositorioCarteiras } from "@/server/carteiras";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import { publicarVaga } from "@/server/vagas/servico";
import { carteiraInfinita } from "./carteira-de-teste";

const DADOS_VAGA = {
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

describe("mover candidatura em modo demonstração", () => {
  let restaurarVagas: () => void;
  let restaurarCandidaturas: () => void;

  beforeEach(() => {
    restaurarVagas = usarRepositorioVagas(new RepositorioVagasMemoria());
    restaurarCandidaturas = usarRepositorioCandidaturas(
      new RepositorioCandidaturasMemoria(),
    );
  });

  afterEach(() => {
    restaurarVagas();
    restaurarCandidaturas();
  });

  it("outra conta de empresa de demonstração move a mesma candidatura", async () => {
    const empresaQuePublicou: Autenticado = {
      usuarioId: crypto.randomUUID(),
      papel: "empresa",
    };
    const empresaQueMove: Autenticado = {
      usuarioId: crypto.randomUUID(),
      papel: "empresa",
    };
    const candidato: Autenticado = {
      usuarioId: crypto.randomUUID(),
      papel: "candidato_clt",
    };

    const vaga = await publicarVaga(empresaQuePublicou, DADOS_VAGA);
    const candidatura = await candidatarSe(candidato, vaga.id);

    const movida = await moverCandidatura(
      empresaQueMove,
      candidatura.id,
      "entrevista",
    );

    expect(movida.status).toBe("entrevista");
  });
});
