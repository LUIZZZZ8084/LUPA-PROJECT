/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Com o banco "ligado" (para o teste), a empresa da vaga é sempre a da
// sessão — mesmo comportamento de produção. O mapeamento para a empresa
// fixa de demonstração é testado à parte, em vagas-demo.test.ts.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

// `next/headers` só existe no runtime do Next; o serviço importa
// `@/lib/data` (por causa de `empresaDoPainel`), que importa o cliente.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import type { Autenticado } from "@/server/auth/rbac";
import { ehAppError } from "@/server/errors";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import {
  editarVaga,
  encerrarVaga,
  publicarVaga,
  vagaParaEditar,
} from "@/server/vagas/servico";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const outraEmpresa: Autenticado = { usuarioId: "empresa-2", papel: "empresa" };
const candidato: Autenticado = {
  usuarioId: "candidato-1",
  papel: "candidato_clt",
};
const admin: Autenticado = { usuarioId: "admin-1", papel: "admin" };

const DADOS = {
  titulo: "Operador de Máquinas",
  descricao: "Operação de colheitadeira e manutenção básica de rotina.",
  categoria: "Agronegócio",
  cidade: "Sinop",
  tipoContrato: "CLT",
};

describe("vagas do painel da empresa", () => {
  let restaurar: () => void;

  beforeEach(() => {
    restaurar = usarRepositorioVagas(new RepositorioVagasMemoria());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  describe("publicar", () => {
    it("empresa publica vinculada à própria sessão", async () => {
      const vaga = await publicarVaga(empresa, DADOS);
      expect(vaga.empresaId).toBe(empresa.usuarioId);
      expect(vaga.status).toBe("aberta");
    });

    it("candidato não publica vaga", async () => {
      const erro = await capturar(() => publicarVaga(candidato, DADOS));
      expect(erro.codigo).toBe("sem_permissao");
    });

    it("sem sessão é 401, não 403", async () => {
      const erro = await capturar(() => publicarVaga(null, DADOS));
      expect(erro.codigo).toBe("nao_autenticado");
    });
  });

  describe("dono", () => {
    it("ninguém edita a vaga de outra empresa", async () => {
      const dela = await publicarVaga(empresa, DADOS);

      const erro = await capturar(() =>
        editarVaga(outraEmpresa, dela.id, { titulo: "Invadido" }),
      );
      // 404, não 403: um 403 confirmaria que a vaga existe.
      expect(erro.codigo).toBe("nao_encontrado");
    });

    it("ninguém encerra a vaga de outra empresa", async () => {
      const dela = await publicarVaga(empresa, DADOS);

      const erro = await capturar(() => encerrarVaga(outraEmpresa, dela.id));
      expect(erro.codigo).toBe("nao_encontrado");
    });

    /**
     * Admin administra, mas não publica vaga nem se candidata — a matriz
     * de RBAC nem concede `vaga:editar_propria` ao papel. Dar essa
     * capacidade de graça transformaria um acesso de admin comprometido
     * em controle total sobre o painel de qualquer empresa.
     */
    it("admin não tem a capacidade de editar ou encerrar vaga", async () => {
      const dela = await publicarVaga(empresa, DADOS);

      const erroEditar = await capturar(() =>
        editarVaga(admin, dela.id, { titulo: "Ajustado pelo suporte" }),
      );
      expect(erroEditar.codigo).toBe("sem_permissao");

      const erroEncerrar = await capturar(() => encerrarVaga(admin, dela.id));
      expect(erroEncerrar.codigo).toBe("sem_permissao");
    });

    it("id inexistente é 'não encontrado'", async () => {
      const erro = await capturar(() =>
        editarVaga(empresa, "nao-existe", { titulo: "x" }),
      );
      expect(erro.codigo).toBe("nao_encontrado");
    });
  });

  describe("edição", () => {
    it("a dona edita a própria vaga", async () => {
      const vaga = await publicarVaga(empresa, DADOS);
      const editada = await editarVaga(empresa, vaga.id, {
        titulo: "Título novo",
      });

      expect(editada.titulo).toBe("Título novo");
      expect(editada.descricao).toBe(DADOS.descricao);
    });

    it("campo não informado mantém o valor anterior", async () => {
      const vaga = await publicarVaga(empresa, {
        ...DADOS,
        salarioMin: 1800,
      });
      const editada = await editarVaga(empresa, vaga.id, {
        titulo: "Só o título mudou",
      });

      expect(editada.salarioMin).toBe(1800);
    });
  });

  describe("encerrar", () => {
    it("some da busca (status fechada), mas os dados continuam", async () => {
      const vaga = await publicarVaga(empresa, DADOS);
      const encerrada = await encerrarVaga(empresa, vaga.id);

      expect(encerrada.status).toBe("fechada");
      expect(encerrada.titulo).toBe(DADOS.titulo);
    });

    it("encerrar de novo continua fechada, sem erro", async () => {
      const vaga = await publicarVaga(empresa, DADOS);
      await encerrarVaga(empresa, vaga.id);

      await expect(encerrarVaga(empresa, vaga.id)).resolves.toMatchObject({
        status: "fechada",
      });
    });
  });

  describe("vagaParaEditar", () => {
    it("devolve null sem sessão, sem lançar", async () => {
      expect(await vagaParaEditar(null, "qualquer")).toBeNull();
    });

    it("devolve null para vaga de outra empresa", async () => {
      const vaga = await publicarVaga(empresa, DADOS);
      expect(await vagaParaEditar(outraEmpresa, vaga.id)).toBeNull();
    });

    it("devolve a vaga para a dona", async () => {
      const vaga = await publicarVaga(empresa, DADOS);
      expect(await vagaParaEditar(empresa, vaga.id)).toMatchObject({
        id: vaga.id,
      });
    });
  });

  describe("repositório em memória", () => {
    it("porEmpresa não mistura vagas de empresas diferentes", async () => {
      await publicarVaga(empresa, DADOS);
      await publicarVaga(outraEmpresa, DADOS);

      const repo = new RepositorioVagasMemoria();
      const restaurarLocal = usarRepositorioVagas(repo);
      await publicarVaga(empresa, DADOS);
      await publicarVaga(outraEmpresa, { ...DADOS, titulo: "Outro cargo" });

      expect(await repo.porEmpresa(empresa.usuarioId)).toHaveLength(1);
      expect(await repo.porEmpresa(outraEmpresa.usuarioId)).toHaveLength(1);
      restaurarLocal();
    });

    it("limpar esvazia o repositório", async () => {
      const repo = new RepositorioVagasMemoria();
      const restaurarLocal = usarRepositorioVagas(repo);
      await publicarVaga(empresa, DADOS);

      repo.limpar();

      expect(await repo.listar()).toEqual([]);
      restaurarLocal();
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
