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
import {
  RepositorioCarteirasMemoria,
  usarRepositorioCarteiras,
} from "@/server/carteiras";
import {
  creditarVagas,
  debitarVagas,
  direitoDePublicar,
  estenderPlanoMensal,
} from "@/server/carteiras/servico";
import { ehAppError } from "@/server/errors";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import {
  editarVaga,
  encerrarVaga,
  publicarVaga,
  reativarVaga,
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
  endereco: "Av. das Itaúbas, 1200",
};

describe("vagas do painel da empresa", () => {
  let restaurar: () => void;
  let restaurarCarteira: () => void;

  /*
   * Publicar passou a custar crédito (#172), então quase todo teste deste
   * arquivo precisa de saldo — o que se mede aqui é a regra da vaga, não
   * a da carteira, que tem arquivo próprio em `carteira-de-vagas.test.ts`.
   *
   * O saldo é folgado de propósito: um número apertado faria um teste
   * falhar por causa de outro que publicou antes, e o motivo da falha
   * ("sem crédito") não teria nada a ver com o que ele mede.
   */
  beforeEach(async () => {
    restaurar = usarRepositorioVagas(new RepositorioVagasMemoria());
    restaurarCarteira = usarRepositorioCarteiras(
      new RepositorioCarteirasMemoria(),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    for (const id of [
      empresa.usuarioId,
      outraEmpresa.usuarioId,
      admin.usuarioId,
    ]) {
      await creditarVagas(id, 50);
    }
  });

  afterEach(() => {
    restaurar();
    restaurarCarteira();
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

    /**
     * O portão da cobrança (#172).
     *
     * Sem ele a tabela de preços é enfeite: a tela cobraria e o servidor
     * deixaria passar assim mesmo. É o mesmo raciocínio de "tela não é
     * portão" que este projeto já aplica em toda action.
     */
    it("sem saldo, não publica — e diz o que fazer", async () => {
      await debitarVagas(empresa.usuarioId, 50);

      const erro = await capturar(() => publicarVaga(empresa, DADOS));

      expect(erro.codigo).toBe("validacao");
      /*
       * As duas saídas, escritas por extenso e não por alternativa solta.
       * A versão antiga era `/crédito|plano mensal/i`, e depois que a
       * interface deixou de dizer "crédito" ela continuaria verde
       * casando só com a segunda metade — teste que passa por um motivo
       * que ninguém escolheu.
       */
      expect(erro.mensagem).toMatch(/compre uma vaga/i);
      expect(erro.mensagem).toMatch(/plano mensal/i);
    });

    it("publicar gasta exatamente um crédito", async () => {
      const antes = (await direitoDePublicar(empresa.usuarioId)).creditos;

      await publicarVaga(empresa, DADOS);

      expect((await direitoDePublicar(empresa.usuarioId)).creditos).toBe(
        antes - 1,
      );
    });

    /** Com o plano mensal ativo, publicar não custa crédito nenhum. */
    it("plano mensal publica sem gastar crédito", async () => {
      await debitarVagas(empresa.usuarioId, 50);
      await estenderPlanoMensal(empresa.usuarioId);

      await publicarVaga(empresa, DADOS);

      expect((await direitoDePublicar(empresa.usuarioId)).creditos).toBe(0);
    });
  });

  /**
   * Contratar sem ter aberto empresa (#129).
   *
   * Decisão do Luiz em 03/09/2026: produtor rural, autônomo e prestador
   * contratam ajudante, e barrar isso deixava a aba Empresa mostrando um
   * painel onde não dava para fazer nada.
   */
  describe("prestador contrata como pessoa física", () => {
    let restaurarUsuarios: () => void;
    let repoUsuarios: RepositorioMemoria;
    let prestador: Autenticado;

    beforeEach(async () => {
      repoUsuarios = new RepositorioMemoria();
      restaurarUsuarios = usarRepositorio(repoUsuarios);

      const usuario = await repoUsuarios.criar({
        email: "eletricista@teste.lupa",
        senhaHash: "hash",
        papel: "prestador_servico",
        nomeCompleto: "João da Silva",
        telefone: "66999110001",
        cidade: "Sinop",
      });
      prestador = { usuarioId: usuario.id, papel: "prestador_servico" };
      // Publicar custa crédito desde a #172, e o id só existe aqui.
      await creditarVagas(prestador.usuarioId, 50);
    });

    afterEach(() => restaurarUsuarios());

    /**
     * `job_listings` faz inner join com `perfis_empresa`: sem essa linha a
     * vaga é gravada e **some da busca**. A pessoa veria "publicada", não
     * se acharia em `/vagas`, e concluiria que o app engoliu o anúncio —
     * a mesma família do padrão de cidade que escondia vaga recém-criada.
     */
    it("ganha o perfil de contratante na primeira vaga", async () => {
      expect(await repoUsuarios.perfilEmpresa(prestador.usuarioId)).toBeNull();

      const vaga = await publicarVaga(prestador, DADOS);

      expect(vaga.empresaId).toBe(prestador.usuarioId);
      expect(
        await repoUsuarios.perfilEmpresa(prestador.usuarioId),
      ).toMatchObject({ razaoSocial: "João da Silva", cnpj: null });
    });

    /** O CPF fica em `usuarios`; `perfis_empresa` é lida pela chave anônima. */
    it("o documento não vai para o perfil de contratante", async () => {
      await publicarVaga(prestador, DADOS);

      const perfil = await repoUsuarios.perfilEmpresa(prestador.usuarioId);
      expect(Object.keys(perfil ?? {})).not.toContain("cpf");
    });

    it("a segunda vaga não recria o perfil", async () => {
      await publicarVaga(prestador, DADOS);
      await repoUsuarios.salvarPerfilEmpresa(prestador.usuarioId, {
        razaoSocial: "João da Silva — Elétrica",
        setor: null,
        porte: null,
        site: null,
        instagram: null,
        facebook: null,
        descricao: null,
      });

      await publicarVaga(prestador, { ...DADOS, titulo: "Ajudante" });

      expect(
        await repoUsuarios.perfilEmpresa(prestador.usuarioId),
      ).toMatchObject({ razaoSocial: "João da Silva — Elétrica" });
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

  describe("reativar", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("reativa vaga que passou dos 30 dias, renovando o prazo", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const vaga = await publicarVaga(empresa, DADOS);

      vi.setSystemTime(new Date("2026-02-05T00:00:00Z")); // 35 dias depois
      const reativada = await reativarVaga(empresa, vaga.id);

      expect(reativada.status).toBe("aberta");
      expect(new Date(reativada.expiraEm).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    /**
     * Reativar custa crédito, como publicar (#172).
     *
     * Sem isto a cobrança inteira vira teatro: a empresa compra uma vaga
     * e a renova para sempre — vaga fantasma paga uma vez. Foi a razão de
     * reverter o "gratuito e sem limite de vezes" com que a #157 nasceu,
     * decidido quando publicar ainda não custava nada.
     */
    it("reativar gasta um crédito, como publicar", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const vaga = await publicarVaga(empresa, DADOS);
      const antes = (await direitoDePublicar(empresa.usuarioId)).creditos;

      vi.setSystemTime(new Date("2026-02-05T00:00:00Z"));
      await reativarVaga(empresa, vaga.id);

      expect((await direitoDePublicar(empresa.usuarioId)).creditos).toBe(
        antes - 1,
      );
    });

    it("sem saldo, não reativa", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const vaga = await publicarVaga(empresa, DADOS);
      await debitarVagas(empresa.usuarioId, 50);

      vi.setSystemTime(new Date("2026-02-05T00:00:00Z"));
      const erro = await capturar(() => reativarVaga(empresa, vaga.id));

      expect(erro.codigo).toBe("validacao");
      expect(erro.mensagem).toMatch(/gasta uma vaga do saldo/i);
      expect(erro.mensagem).toMatch(/plano mensal/i);
    });

    it("recusa reativar vaga que ainda não expirou", async () => {
      const vaga = await publicarVaga(empresa, DADOS);
      const erro = await capturar(() => reativarVaga(empresa, vaga.id));
      expect(erro.codigo).toBe("conflito");
    });

    it("recusa reativar vaga encerrada manualmente — não é o mesmo que expirar", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const vaga = await publicarVaga(empresa, DADOS);
      await encerrarVaga(empresa, vaga.id);

      vi.setSystemTime(new Date("2026-02-05T00:00:00Z"));
      const erro = await capturar(() => reativarVaga(empresa, vaga.id));
      expect(erro.codigo).toBe("conflito");
    });

    it("ninguém reativa a vaga expirada de outra empresa", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const dela = await publicarVaga(empresa, DADOS);

      vi.setSystemTime(new Date("2026-02-05T00:00:00Z"));
      const erro = await capturar(() => reativarVaga(outraEmpresa, dela.id));
      expect(erro.codigo).toBe("nao_encontrado");
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
