/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Produção: a empresa da vaga é sempre a da sessão.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

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
import { ehAppError } from "@/server/errors";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import { publicarVaga } from "@/server/vagas/servico";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const outraEmpresa: Autenticado = { usuarioId: "empresa-2", papel: "empresa" };
const candidato: Autenticado = {
  usuarioId: "candidato-1",
  papel: "candidato_clt",
};
const outroCandidato: Autenticado = {
  usuarioId: "candidato-2",
  papel: "candidato_clt",
};
const prestador: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};

const DADOS_VAGA = {
  titulo: "Auxiliar Administrativo",
  descricao: "Rotina de recepção, arquivo e atendimento telefônico.",
  categoria: "Administrativo",
  cidade: "Sinop",
  tipoContrato: "CLT",
};

describe("candidaturas", () => {
  let restaurarVagas: () => void;
  let restaurarCandidaturas: () => void;

  beforeEach(() => {
    restaurarVagas = usarRepositorioVagas(new RepositorioVagasMemoria());
    restaurarCandidaturas = usarRepositorioCandidaturas(
      new RepositorioCandidaturasMemoria(),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurarVagas();
    restaurarCandidaturas();
    vi.restoreAllMocks();
  });

  describe("candidatar-se", () => {
    it("candidato se candidata", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      const candidatura = await candidatarSe(candidato, vaga.id);

      expect(candidatura.status).toBe("enviada");
      expect(candidatura.candidatoId).toBe(candidato.usuarioId);
    });

    it("empresa não se candidata", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      const erro = await capturar(() => candidatarSe(empresa, vaga.id));
      expect(erro.codigo).toBe("sem_permissao");
    });

    it("não se candidata duas vezes à mesma vaga", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      await candidatarSe(candidato, vaga.id);

      const erro = await capturar(() => candidatarSe(candidato, vaga.id));
      expect(erro.codigo).toBe("conflito");
    });

    it("sem sessão é 401, não 403", async () => {
      const erro = await capturar(() => candidatarSe(null, "vaga-1"));
      expect(erro.codigo).toBe("nao_autenticado");
    });
  });

  describe("mover estágio", () => {
    it("a dona da vaga move a candidatura", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      const candidatura = await candidatarSe(candidato, vaga.id);

      const movida = await moverCandidatura(
        empresa,
        candidatura.id,
        "entrevista",
      );
      expect(movida.status).toBe("entrevista");
    });

    /**
     * Capacidade responde "pode mover candidatura"; não responde "pode
     * mover *esta*". Sem a checagem de dono — feita através da vaga, já
     * que a candidatura não guarda o id da empresa —, qualquer empresa
     * autenticada alcança a candidatura de outra trocando o id.
     */
    it("outra empresa não move a candidatura", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      const candidatura = await candidatarSe(candidato, vaga.id);

      const erro = await capturar(() =>
        moverCandidatura(outraEmpresa, candidatura.id, "entrevista"),
      );
      // 404, não 403: um 403 confirmaria que a candidatura existe.
      expect(erro.codigo).toBe("nao_encontrado");
    });

    it("candidato não move candidatura", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      const candidatura = await candidatarSe(candidato, vaga.id);

      const erro = await capturar(() =>
        moverCandidatura(candidato, candidatura.id, "entrevista"),
      );
      expect(erro.codigo).toBe("sem_permissao");
    });

    it("prestador não tem a capacidade", async () => {
      const erro = await capturar(() =>
        moverCandidatura(prestador, "candidatura-1", "entrevista"),
      );
      expect(erro.codigo).toBe("sem_permissao");
    });

    it("id inexistente é 'não encontrado'", async () => {
      const erro = await capturar(() =>
        moverCandidatura(empresa, "nao-existe", "entrevista"),
      );
      expect(erro.codigo).toBe("nao_encontrado");
    });

    it("não mistura candidaturas de candidatos diferentes", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      const dele = await candidatarSe(candidato, vaga.id);
      const dela = await candidatarSe(outroCandidato, vaga.id);

      const movidaDele = await moverCandidatura(empresa, dele.id, "aprovada");
      const movidaDela = await moverCandidatura(empresa, dela.id, "rejeitada");

      expect(movidaDele.status).toBe("aprovada");
      expect(movidaDela.status).toBe("rejeitada");
    });
  });

  describe("repositório em memória", () => {
    it("porVaga e porCandidato filtram certo", async () => {
      const vagaA = await publicarVaga(empresa, DADOS_VAGA);
      const vagaB = await publicarVaga(empresa, {
        ...DADOS_VAGA,
        titulo: "Outro cargo",
      });
      await candidatarSe(candidato, vagaA.id);
      await candidatarSe(candidato, vagaB.id);
      await candidatarSe(outroCandidato, vagaA.id);

      const repo = new RepositorioCandidaturasMemoria();
      const restaurar = usarRepositorioCandidaturas(repo);
      await candidatarSe(candidato, vagaA.id);
      await candidatarSe(outroCandidato, vagaA.id);

      expect(await repo.porVaga(vagaA.id)).toHaveLength(2);
      expect(await repo.porCandidato(candidato.usuarioId)).toHaveLength(1);
      restaurar();
    });

    it("limpar esvazia o repositório", async () => {
      const repo = new RepositorioCandidaturasMemoria();
      const restaurar = usarRepositorioCandidaturas(repo);
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      await candidatarSe(candidato, vaga.id);

      repo.limpar();

      expect(await repo.listar()).toEqual([]);
      restaurar();
    });
  });
});

async function capturar(fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error("esperava um erro, mas passou");
  } catch (e) {
    if (!ehAppError(e)) throw e;
    return e;
  }
}
