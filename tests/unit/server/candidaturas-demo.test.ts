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

import { getCompanyApplications } from "@/lib/data";
import { DEMO_COMPANY_ID } from "@/lib/mock-data";
import type { Autenticado } from "@/server/auth/rbac";
import {
  RepositorioCandidaturasMemoria,
  usarRepositorioCandidaturas,
} from "@/server/candidaturas";
import { candidatarSe, moverCandidatura } from "@/server/candidaturas/servico";
import { usarRepositorioCarteiras } from "@/server/carteiras";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";
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

/**
 * `candidatoParaDemo`, em `src/lib/data.ts`, monta o candidato de uma
 * candidatura em modo demonstração. Antes da #187 ele sempre devolvia
 * `experiences: []`, mesmo para uma conta real com experiência salva — a
 * empresa nunca via o que o candidato tinha acabado de preencher em
 * `/perfil/editar`. Este teste é o caminho de ponta a ponta que prova o
 * contrário: candidato real, com experiência salva, aparece na ficha que
 * a empresa recebe.
 */
describe("experiência do candidato chega até a empresa, em demonstração", () => {
  let repoUsuarios: RepositorioMemoria;
  let restaurarUsuarios: () => void;
  let restaurarVagas: () => void;
  let restaurarCandidaturas: () => void;

  beforeEach(() => {
    repoUsuarios = new RepositorioMemoria();
    restaurarUsuarios = usarRepositorio(repoUsuarios);
    restaurarVagas = usarRepositorioVagas(new RepositorioVagasMemoria());
    restaurarCandidaturas = usarRepositorioCandidaturas(
      new RepositorioCandidaturasMemoria(),
    );
  });

  afterEach(() => {
    restaurarUsuarios();
    restaurarVagas();
    restaurarCandidaturas();
  });

  it("a experiência salva no perfil aparece na ficha da empresa", async () => {
    const empresa: Autenticado = {
      usuarioId: crypto.randomUUID(),
      papel: "empresa",
    };

    const usuario = await repoUsuarios.criar({
      email: "candidato@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Quem Procura Emprego",
      telefone: "66999110001",
      cidade: "Sinop",
    });
    await repoUsuarios.salvarPerfilCandidato(usuario.id, {
      areaDesejada: null,
      resumo: null,
      formacao: null,
      habilidades: [],
      experiencias: [
        { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
      ],
      disponibilidade: null,
      visivelParaEmpresas: false,
    });

    const vaga = await publicarVaga(empresa, DADOS_VAGA);
    await candidatarSe(
      { usuarioId: usuario.id, papel: "candidato_clt" },
      vaga.id,
    );

    const apps = await getCompanyApplications(DEMO_COMPANY_ID);
    const app = apps.find((a) => a.candidate_id === usuario.id);
    expect(app?.candidate.experiences).toEqual([
      { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
    ]);
  });
});
