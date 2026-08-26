/**
 * @vitest-environment node
 *
 * A série do painel da empresa. Antes disto, "Visualizações" era um número
 * fixo vindo do `mock-data` — a empresa via 1.245 com o banco ligado e
 * nenhuma visita registrada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Produção: a empresa é sempre a da sessão, não a empresa de demonstração.
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
import { candidatarSe } from "@/server/candidaturas/servico";
import { ehAppError } from "@/server/errors";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import { publicarVaga } from "@/server/vagas/servico";
import {
  contarVisualizacao,
  RepositorioVisualizacoesMemoria,
  usarRepositorioVisualizacoes,
} from "@/server/visualizacoes";
import {
  DIAS_DA_SERIE,
  serieDoPainel,
  totaisDaSerie,
} from "@/server/visualizacoes/servico";
import { diasAte, montarSerie } from "@/server/visualizacoes/tipos";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const outraEmpresa: Autenticado = { usuarioId: "empresa-2", papel: "empresa" };
const candidato: Autenticado = {
  usuarioId: "candidato-1",
  papel: "candidato_clt",
};
const admin: Autenticado = { usuarioId: "admin-1", papel: "admin" };

const DADOS_VAGA = {
  titulo: "Operador de Empilhadeira",
  descricao: "Movimentação de carga no armazém, turno da manhã.",
  categoria: "Logística",
  cidade: "Sinop",
  tipoContrato: "CLT",
};

const hoje = () => new Date().toISOString().slice(0, 10);

describe("visualizações de vaga", () => {
  let restaurar: Array<() => void> = [];

  beforeEach(() => {
    restaurar = [
      usarRepositorioVagas(new RepositorioVagasMemoria()),
      usarRepositorioCandidaturas(new RepositorioCandidaturasMemoria()),
      usarRepositorioVisualizacoes(new RepositorioVisualizacoesMemoria()),
    ];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const r of restaurar) r();
    vi.restoreAllMocks();
  });

  describe("montagem da série", () => {
    it("preenche os dias sem movimento com zero", () => {
      const dias = diasAte(new Date("2026-08-25T00:00:00Z"), 3);
      const serie = montarSerie(
        dias,
        new Map([["2026-08-25", 4]]),
        new Map([["2026-08-23", 1]]),
      );

      expect(serie).toEqual([
        { dia: "2026-08-23", visualizacoes: 0, candidaturas: 1 },
        { dia: "2026-08-24", visualizacoes: 0, candidaturas: 0 },
        { dia: "2026-08-25", visualizacoes: 4, candidaturas: 0 },
      ]);
    });

    it("vai do dia mais antigo ao mais recente", () => {
      const dias = diasAte(new Date("2026-01-02T00:00:00Z"), 3);
      expect(dias).toEqual(["2025-12-31", "2026-01-01", "2026-01-02"]);
    });

    it("atravessa a virada do mês sem pular dia", () => {
      const dias = diasAte(new Date("2026-03-01T00:00:00Z"), 30);
      expect(dias).toHaveLength(30);
      expect(new Set(dias).size).toBe(30);
      expect(dias[29]).toBe("2026-03-01");
    });
  });

  describe("contagem", () => {
    it("soma visualizações da mesma vaga no mesmo dia", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      await contarVisualizacao(vaga.id);
      await contarVisualizacao(vaga.id);
      await contarVisualizacao(vaga.id);

      const serie = await serieDoPainel(empresa);
      expect(totaisDaSerie(serie).visualizacoes).toBe(3);
    });

    it("a série cobre a janela inteira, mesmo zerada", async () => {
      const serie = await serieDoPainel(empresa);
      expect(serie).toHaveLength(DIAS_DA_SERIE);
      expect(serie.at(-1)?.dia).toBe(hoje());
      expect(totaisDaSerie(serie)).toEqual({
        visualizacoes: 0,
        candidaturas: 0,
      });
    });

    it("candidatura entra na série do dia em que foi feita", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      await candidatarSe(candidato, vaga.id);

      const serie = await serieDoPainel(empresa);
      const dia = serie.find((p) => p.dia === hoje());
      expect(dia?.candidaturas).toBe(1);
    });

    /*
     * O motivo de tudo isto ser um serviço com dono, e não uma consulta
     * solta: métrica de vaga é informação de negócio da empresa. Trocar o
     * id na URL não pode revelar o movimento do concorrente.
     */
    it("uma empresa não vê o movimento da outra", async () => {
      const vaga = await publicarVaga(empresa, DADOS_VAGA);
      await contarVisualizacao(vaga.id);
      await candidatarSe(candidato, vaga.id);

      const serie = await serieDoPainel(outraEmpresa);
      expect(totaisDaSerie(serie)).toEqual({
        visualizacoes: 0,
        candidaturas: 0,
      });
    });

    it("falha ao contar não estoura para quem abriu a vaga", async () => {
      usarRepositorioVisualizacoes({
        registrar: async () => {
          throw new Error("banco fora do ar");
        },
        serieDaEmpresa: async () => [],
      });

      await expect(contarVisualizacao("vaga-1")).resolves.toBeUndefined();
    });
  });

  /*
   * O histórico fictício da demonstração. Não existe em produção: só o
   * repositório em memória semeia, e ele só entra em cena sem Supabase.
   */
  describe("histórico da demonstração", () => {
    const antiga = {
      id: "vaga-antiga",
      empresaId: empresa.usuarioId,
      titulo: "Vaga de ontem",
      descricao: "Publicada antes desta sessão.",
      categoria: null,
      cidade: "Sinop",
      bairro: null,
      tipoContrato: null,
      salarioMin: null,
      salarioMax: null,
      habilidades: [],
      status: "aberta" as const,
      criadoEm: "2026-01-01T00:00:00.000Z",
    };

    function comVaga(vaga: typeof antiga) {
      const repo = new RepositorioVagasMemoria();
      repo.semear([vaga]);
      restaurar.push(usarRepositorioVagas(repo));
    }

    it("vaga anterior à sessão chega com movimento para mostrar", async () => {
      comVaga(antiga);
      const serie = await serieDoPainel(empresa);
      expect(totaisDaSerie(serie).visualizacoes).toBeGreaterThan(0);
    });

    it("o mesmo número a cada leitura — gráfico que dança faz duvidar", async () => {
      comVaga(antiga);
      const primeira = await serieDoPainel(empresa);
      const segunda = await serieDoPainel(empresa);
      expect(segunda).toEqual(primeira);
    });

    it("vaga publicada agora começa do zero", async () => {
      comVaga({
        ...antiga,
        id: "vaga-nova",
        criadoEm: new Date().toISOString(),
      });
      const serie = await serieDoPainel(empresa);
      expect(totaisDaSerie(serie).visualizacoes).toBe(0);
    });
  });

  describe("permissão", () => {
    it("sem sessão é 401, não 403", async () => {
      const erro = await capturar(() => serieDoPainel(null));
      expect(erro.codigo).toBe("nao_autenticado");
    });

    it("candidato não lê a série de ninguém", async () => {
      const erro = await capturar(() => serieDoPainel(candidato));
      expect(erro.codigo).toBe("sem_permissao");
    });

    it("admin também não — administra, não recruta", async () => {
      const erro = await capturar(() => serieDoPainel(admin));
      expect(erro.codigo).toBe("sem_permissao");
    });
  });
});

async function capturar(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (ehAppError(e)) return e;
    throw e;
  }
  throw new Error("esperava um erro, não veio nenhum");
}
