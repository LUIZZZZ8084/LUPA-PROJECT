/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado, Papel } from "@/server/auth/rbac";
import { ehAppError } from "@/server/errors";
import { usarRepositorioMetricas } from "@/server/metrics";
import { CUSTOS_MENSAIS } from "@/server/metrics/custos";
import { RepositorioMetricasMemoria } from "@/server/metrics/memoria";
import { painelAdmin, somarCadastros } from "@/server/metrics/servico";
import type { Funil, RepositorioMetricas } from "@/server/metrics/tipos";
import { RepositorioMemoria } from "@/server/repositories/memoria";

const admin: Autenticado = { usuarioId: "adm", papel: "admin" };
const empresa: Autenticado = { usuarioId: "e1", papel: "empresa" };
const candidato: Autenticado = { usuarioId: "c1", papel: "candidato_clt" };

function repoFalso(
  sobrescrever: Partial<RepositorioMetricas> = {},
): RepositorioMetricas {
  return {
    totais: async () => ({
      usuarios: 0,
      candidatos: 0,
      prestadores: 0,
      empresas: 0,
      vagasAbertas: 0,
    }),
    cadastrosPorDia: async () => [],
    contasPorLugar: async () => ({ estados: [], cidades: [] }),
    funil: async () => funilZerado(),
    caixa: async () => ({
      entrouCentavos: 0,
      estornadoCentavos: 0,
      contestadoCentavos: 0,
      recorrenteCentavos: 0,
      liquidoCentavos: 0,
      cobrancas: 0,
      contestacoes: 0,
    }),
    pressaoNosTetos: async () => [],
    ...sobrescrever,
  };
}

describe("painel administrativo", () => {
  let restaurar: () => void;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar?.();
    vi.restoreAllMocks();
  });

  describe("permissão", () => {
    beforeEach(() => {
      restaurar = usarRepositorioMetricas(repoFalso());
    });

    it("admin acessa", async () => {
      await expect(painelAdmin(admin)).resolves.toBeTruthy();
    });

    it("empresa e candidato não acessam", async () => {
      for (const sessao of [empresa, candidato]) {
        const erro = await capturar(() => painelAdmin(sessao));
        expect(erro.codigo, sessao.papel).toBe("sem_permissao");
      }
    });

    it("sem sessão é 401", async () => {
      const erro = await capturar(() => painelAdmin(null));
      expect(erro.codigo).toBe("nao_autenticado");
    });
  });

  describe("caixa", () => {
    /**
     * O bloco existia como projeção: contava `perfis_empresa.plano` e
     * multiplicava por um preço de tabela. A coluna nunca teve produtor,
     * então o número era sempre zero e se anunciava como receita — o
     * defeito da #179. Agora vem de `pagamentos`.
     */
    it("passa adiante o que entrou, e conta as cobranças", async () => {
      restaurar = usarRepositorioMetricas(
        repoFalso({
          caixa: async () => ({
            entrouCentavos: 49_800,
            estornadoCentavos: 0,
            contestadoCentavos: 0,
            recorrenteCentavos: 19_900,
            liquidoCentavos: 49_800,
            cobrancas: 3,
            contestacoes: 0,
          }),
        }),
      );

      const painel = await painelAdmin(admin);

      expect(painel.caixa.entrouCentavos).toBe(49_800);
      expect(painel.caixa.cobrancas).toBe(3);
      expect(painel.caixa.recorrenteCentavos).toBe(19_900);
    });

    /**
     * As duas saídas não se somam numa só.
     *
     * Devolver dinheiro é decisão da casa; contestação é o cliente abrindo
     * disputa no cartão — custa taxa, é sinal de fraude e dá para
     * contestar de volta. Um total único daria o número certo e a leitura
     * errada, e depois de agregado não há como separar.
     */
    it("mantém devolução e contestação separadas", async () => {
      restaurar = usarRepositorioMetricas(
        repoFalso({
          caixa: async () => ({
            entrouCentavos: 100_000,
            estornadoCentavos: 2_990,
            contestadoCentavos: 19_990,
            recorrenteCentavos: 0,
            liquidoCentavos: 77_020,
            cobrancas: 5,
            contestacoes: 1,
          }),
        }),
      );

      const painel = await painelAdmin(admin);

      expect(painel.caixa.estornadoCentavos).toBe(2_990);
      expect(painel.caixa.contestadoCentavos).toBe(19_990);
      expect(painel.caixa.contestacoes).toBe(1);
    });

    it("sem cobrança nenhuma, o caixa é zero e não quebra", async () => {
      restaurar = usarRepositorioMetricas(repoFalso());
      const painel = await painelAdmin(admin);
      expect(painel.caixa.liquidoCentavos).toBe(0);
      expect(painel.caixa.cobrancas).toBe(0);
    });
  });

  describe("série de cadastros", () => {
    /**
     * Dia sem cadastro precisa aparecer como zero. Se a série pular os dias
     * vazios, o gráfico mente sobre a constância do crescimento.
     */
    it("devolve a série contínua, com dias vazios", async () => {
      const usuarios = new RepositorioMemoria();
      restaurar = usarRepositorioMetricas(
        new RepositorioMetricasMemoria(usuarios),
      );

      const painel = await painelAdmin(admin, 30);

      expect(painel.cadastros).toHaveLength(30);
      expect(painel.cadastros.every((d) => typeof d.total === "number")).toBe(
        true,
      );
    });

    it("os dias vêm em ordem, do mais antigo ao mais novo", async () => {
      restaurar = usarRepositorioMetricas(
        new RepositorioMetricasMemoria(new RepositorioMemoria()),
      );

      const dias = (await painelAdmin(admin, 7)).cadastros.map((d) => d.dia);
      expect(dias).toEqual([...dias].sort());
    });

    it("conta o cadastro de hoje no dia de hoje", async () => {
      const usuarios = new RepositorioMemoria();
      await usuarios.criar({
        email: "novo@teste.lupa",
        senhaHash: "x",
        papel: "candidato_clt",
        nomeCompleto: "Novo",
        telefone: "66999110001",
        cidade: "Sinop - MT",
      });

      restaurar = usarRepositorioMetricas(
        new RepositorioMetricasMemoria(usuarios),
      );

      const painel = await painelAdmin(admin, 30);
      const hoje = painel.cadastros.at(-1);

      expect(hoje?.total).toBe(1);
      expect(hoje?.porPapel.candidato_clt).toBe(1);
    });

    it("somarCadastros fecha com a série", async () => {
      restaurar = usarRepositorioMetricas(
        repoFalso({
          cadastrosPorDia: async () => [
            { dia: "2026-08-01", total: 3, porPapel: zerado(3, 0, 0) },
            { dia: "2026-08-02", total: 5, porPapel: zerado(5, 0, 0) },
          ],
        }),
      );

      expect(somarCadastros(await painelAdmin(admin))).toBe(8);
    });
  });

  describe("contas por lugar e funil (#471)", () => {
    it("pede quinze cidades, e repassa estados e cidades como vieram", async () => {
      const pedidos: number[] = [];
      const lugares = {
        estados: [
          { lugar: "MT", candidatos: 2, prestadores: 1, empresas: 0, total: 3 },
        ],
        cidades: [
          {
            lugar: "Sinop - MT",
            candidatos: 2,
            prestadores: 1,
            empresas: 0,
            total: 3,
          },
        ],
      };
      restaurar = usarRepositorioMetricas(
        repoFalso({
          contasPorLugar: async (limite) => {
            pedidos.push(limite);
            return lugares;
          },
        }),
      );

      const painel = await painelAdmin(admin);

      expect(pedidos).toEqual([15]);
      expect(painel.lugares).toEqual(lugares);
    });

    it("leva o funil e a meta de custo para a tela", async () => {
      const funil = { ...funilZerado(), candidatos: 7 };
      restaurar = usarRepositorioMetricas(
        repoFalso({ funil: async () => funil }),
      );

      const painel = await painelAdmin(admin);

      expect(painel.funil).toEqual(funil);
      expect(painel.custos).toEqual(CUSTOS_MENSAIS);
    });

    /*
     * A meta é o custo dos planos pagos, e a pergunta do Luiz era "pelo
     * menos o Supabase": ele vem primeiro, porque a tela cobre os custos
     * na ordem em que aparecem.
     */
    it("o primeiro custo da meta é o Supabase", () => {
      expect(CUSTOS_MENSAIS[0].nome).toMatch(/supabase/i);
      expect(CUSTOS_MENSAIS.every((c) => c.centavos > 0)).toBe(true);
    });
  });

  it("registra o momento da apuração, para a tela dizer há quanto tempo", async () => {
    restaurar = usarRepositorioMetricas(repoFalso());
    const antes = Date.now();
    const painel = await painelAdmin(admin);

    expect(+new Date(painel.apuradoEm)).toBeGreaterThanOrEqual(antes - 1000);
  });
});

describe("métricas no modo demonstração", () => {
  let usuarios: RepositorioMemoria;
  let repo: RepositorioMetricasMemoria;

  beforeEach(() => {
    usuarios = new RepositorioMemoria();
    repo = new RepositorioMetricasMemoria(usuarios);
  });

  let sequencia = 0;

  async function criar(papel: Papel) {
    sequencia += 1;
    return usuarios.criar({
      email: `${papel}-${sequencia}@teste.lupa`,
      senhaHash: "x",
      papel,
      nomeCompleto: "Teste",
      telefone: "66999110001",
      cidade: "Sinop - MT",
    });
  }

  /** Painel zerado não mostraria nada do que ele serve para mostrar. */
  it("soma os dados de exemplo, para o painel não abrir vazio", async () => {
    const totais = await repo.totais();
    expect(totais.prestadores).toBeGreaterThan(0);
    expect(totais.vagasAbertas).toBeGreaterThan(0);
  });

  it("conta as contas criadas na sessão junto com os exemplos", async () => {
    const antes = await repo.totais();
    await criar("empresa");
    const depois = await repo.totais();

    expect(depois.empresas).toBe(antes.empresas + 1);
    expect(depois.usuarios).toBe(antes.usuarios + 1);
  });

  /**
   * Conta criada não é dinheiro entrado.
   *
   * O teste antigo era "empresa nova entra como teste, não como
   * assinatura", sobre `perfis_empresa.plano` — coluna que nada escreve.
   * Ele passava sempre, e passaria com a cobrança inteira quebrada: media
   * o cadastro, não o pagamento. O caixa só se mexe quando existe
   * cobrança aprovada.
   */
  it("cadastrar empresa não mexe no caixa", async () => {
    await criar("empresa");
    expect(await repo.caixa()).toMatchObject({
      entrouCentavos: 0,
      cobrancas: 0,
      liquidoCentavos: 0,
    });
  });

  it("respeita o limite de cidades pedido", async () => {
    expect((await repo.contasPorLugar(2)).cidades.length).toBeLessThanOrEqual(
      2,
    );
  });

  it("a mesma cidade aparece uma vez só, com cada papel no seu lugar", async () => {
    const antes = (await repo.contasPorLugar(50)).cidades.find(
      (l) => l.lugar === "Sinop - MT",
    );
    await criar("candidato_clt");
    await criar("empresa");
    const sinop = (await repo.contasPorLugar(50)).cidades.filter(
      (l) => l.lugar === "Sinop - MT",
    );

    expect(sinop).toHaveLength(1);
    expect(sinop[0].candidatos).toBe((antes?.candidatos ?? 0) + 1);
    expect(sinop[0].empresas).toBe((antes?.empresas ?? 0) + 1);
  });

  /*
   * Conta excluída (#423) fica anonimizada no repositório, como no banco,
   * e não é gente: não conta no total, no lugar nem no funil.
   */
  it("conta excluída não conta em lugar nenhum", async () => {
    const conta = await criar("candidato_clt");
    const antes = {
      totais: await repo.totais(),
      lugares: await repo.contasPorLugar(50),
      funil: await repo.funil(),
    };

    await usuarios.excluirConta(conta.id);

    expect((await repo.totais()).usuarios).toBe(antes.totais.usuarios - 1);
    expect((await repo.funil()).candidatos).toBe(antes.funil.candidatos - 1);
    const mt = (l: Awaited<ReturnType<typeof repo.contasPorLugar>>) =>
      l.estados.find((e) => e.lugar === "MT")?.candidatos ?? 0;
    expect(mt(await repo.contasPorLugar(50))).toBe(mt(antes.lugares) - 1);
  });

  it("o funil conta quem tem conta, e os prestadores de exemplo estão nele", async () => {
    const antes = await repo.funil();
    await criar("empresa");
    const depois = await repo.funil();

    expect(depois.empresas).toBe(antes.empresas + 1);
    expect(depois.prestadores).toBeGreaterThan(0);
    expect(depois.prestadoresNaVitrine).toBeLessThanOrEqual(depois.prestadores);
  });
});

function funilZerado(): Funil {
  return {
    candidatos: 0,
    candidatosVisiveis: 0,
    candidatosQueSeCandidataram: 0,
    prestadores: 0,
    prestadoresNaVitrine: 0,
    prestadoresAssinantes: 0,
    empresas: 0,
    empresasVerificadas: 0,
    empresasComVaga: 0,
    empresasQueCompraram: 0,
    receita: {
      assinaturasAtivas: 0,
      recorrenteAtivoCentavos: 0,
      entrouUltimos30DiasCentavos: 0,
    },
  };
}

function zerado(candidatos: number, prestadores: number, empresas: number) {
  return {
    candidato_clt: candidatos,
    prestador_servico: prestadores,
    empresa: empresas,
    admin: 0,
  };
}

async function capturar(fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error("esperava um erro, mas passou");
  } catch (e) {
    if (!ehAppError(e)) throw e;
    return e;
  }
}
