/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
const respostas = new Map<string, Resposta>();

function construtor(tabela: string) {
  const resposta = () => respostas.get(tabela) ?? { data: null, error: null };

  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta(),
    single: async () => resposta(),
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta()).then(resolver),
  };

  for (const metodo of ["select", "eq", "gte", "order", "limit"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({ from: (tabela: string) => construtor(tabela) }),
}));

import { RepositorioMetricasPostgres } from "@/server/metrics/postgres";

describe("RepositorioMetricasPostgres", () => {
  const repo = new RepositorioMetricasPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    respostas.clear();
  });

  it("lê os totais da view e converte para número", async () => {
    respostas.set("metricas_totais", {
      // O Postgres devolve count como string em algumas rotas do PostgREST.
      data: {
        usuarios: "42",
        candidatos: "20",
        prestadores: "15",
        empresas: "7",
        vagas_abertas: "9",
      },
      error: null,
    });

    expect(await repo.totais()).toEqual({
      usuarios: 42,
      candidatos: 20,
      prestadores: 15,
      empresas: 7,
      vagasAbertas: 9,
    });
  });

  it("view vazia devolve zeros, não NaN", async () => {
    respostas.set("metricas_totais", { data: null, error: null });

    const totais = await repo.totais();
    expect(Object.values(totais).every((v) => v === 0)).toBe(true);
  });

  /**
   * Dia sem cadastro precisa aparecer como zero. Se a série pular os vazios,
   * o gráfico mente sobre a constância do crescimento.
   */
  it("monta a série contínua a partir das linhas da view", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    respostas.set("metricas_cadastros_por_dia", {
      data: [{ dia: hoje, papel: "candidato_clt", total: 3 }],
      error: null,
    });

    const serie = await repo.cadastrosPorDia(7);

    expect(serie).toHaveLength(7);
    expect(serie.at(-1)?.dia).toBe(hoje);
    expect(serie.at(-1)?.total).toBe(3);
    expect(serie.at(-1)?.porPapel.candidato_clt).toBe(3);
    expect(serie[0].total).toBe(0);
  });

  it("soma os papéis do mesmo dia", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    respostas.set("metricas_cadastros_por_dia", {
      data: [
        { dia: hoje, papel: "candidato_clt", total: 3 },
        { dia: hoje, papel: "empresa", total: 2 },
      ],
      error: null,
    });

    const serie = await repo.cadastrosPorDia(7);
    expect(serie.at(-1)?.total).toBe(5);
    expect(serie.at(-1)?.porPapel.empresa).toBe(2);
  });

  it("pede só a janela solicitada", async () => {
    respostas.set("metricas_cadastros_por_dia", { data: [], error: null });
    await repo.cadastrosPorDia(7);

    const gte = chamadas.find((c) => c.metodo === "gte");
    expect(gte?.args[0]).toBe("dia");
  });

  /*
   * Estados e cidades vêm de duas views, já somadas por papel no banco
   * (#471). Os estados vêm todos; as cidades, só até o limite, e o banco
   * as ordena — a soma do estado não pode sair das cidades recortadas.
   */
  it("contas por lugar: estados todos, cidades até o limite, números convertidos", async () => {
    respostas.set("metricas_contas_por_estado", {
      data: [
        {
          uf: "MT",
          candidatos: "10",
          prestadores: "4",
          empresas: "2",
          total: "16",
        },
        {
          uf: null,
          candidatos: "1",
          prestadores: "0",
          empresas: "0",
          total: "1",
        },
      ],
      error: null,
    });
    respostas.set("metricas_contas_por_cidade", {
      data: [
        {
          cidade: "Sinop - MT",
          candidatos: "8",
          prestadores: "3",
          empresas: "2",
          total: "13",
        },
      ],
      error: null,
    });

    const lugares = await repo.contasPorLugar(15);

    expect(lugares).toEqual({
      estados: [
        { lugar: "MT", candidatos: 10, prestadores: 4, empresas: 2, total: 16 },
        {
          lugar: "Sem estado",
          candidatos: 1,
          prestadores: 0,
          empresas: 0,
          total: 1,
        },
      ],
      cidades: [
        {
          lugar: "Sinop - MT",
          candidatos: 8,
          prestadores: 3,
          empresas: 2,
          total: 13,
        },
      ],
    });
    expect(
      chamadas.find(
        (c) =>
          c.tabela === "metricas_contas_por_cidade" && c.metodo === "limit",
      )?.args,
    ).toEqual([15]);
    expect(
      chamadas.filter(
        (c) =>
          c.tabela === "metricas_contas_por_estado" && c.metodo === "order",
      )[0]?.args,
    ).toEqual(["total", { ascending: false }]);
  });

  it("contas por lugar: erro de uma das views vira indisponível", async () => {
    respostas.set("metricas_contas_por_cidade", {
      data: null,
      error: { message: "caiu" },
    });

    await expect(repo.contasPorLugar(15)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });

  it("o funil vem da view, convertido para número", async () => {
    respostas.set("metricas_funil", {
      data: {
        candidatos: "20",
        candidatos_visiveis: "5",
        candidatos_que_se_candidataram: "7",
        prestadores: "9",
        prestadores_na_vitrine: "4",
        prestadores_assinantes: "3",
        empresas: "6",
        empresas_verificadas: "4",
        empresas_com_vaga: "2",
        empresas_que_compraram: "1",
        assinaturas_ativas: "3",
        recorrente_ativo_centavos: "5970",
        entrou_30_dias_centavos: "15960",
      },
      error: null,
    });

    expect(await repo.funil()).toEqual({
      candidatos: 20,
      candidatosVisiveis: 5,
      candidatosQueSeCandidataram: 7,
      prestadores: 9,
      prestadoresNaVitrine: 4,
      prestadoresAssinantes: 3,
      empresas: 6,
      empresasVerificadas: 4,
      empresasComVaga: 2,
      empresasQueCompraram: 1,
      receita: {
        assinaturasAtivas: 3,
        recorrenteAtivoCentavos: 5970,
        entrouUltimos30DiasCentavos: 15960,
      },
    });
  });

  it("sem linha na view, o funil é zero e não NaN", async () => {
    const funil = await repo.funil();
    expect(funil.candidatos).toBe(0);
    expect(funil.receita.recorrenteAtivoCentavos).toBe(0);
  });

  /**
   * O caixa vem somado do banco, e o líquido é calculado aqui.
   *
   * A view entrega as parcelas; a subtração mora num lugar só, porque
   * escrevê-la em SQL e de novo em TypeScript é uma chance a mais de as
   * duas divergirem.
   */
  it("o caixa vem da view, e o líquido desconta as duas saídas", async () => {
    respostas.set("metricas_caixa", {
      data: {
        entrou_centavos: "100000",
        estornado_centavos: "2990",
        contestado_centavos: "19990",
        recorrente_centavos: "19900",
        cobrancas: "5",
        contestacoes: "1",
      },
      error: null,
    });

    expect(await repo.caixa()).toEqual({
      entrouCentavos: 100_000,
      estornadoCentavos: 2_990,
      contestadoCentavos: 19_990,
      recorrenteCentavos: 19_900,
      liquidoCentavos: 77_020,
      cobrancas: 5,
      contestacoes: 1,
    });
  });

  /** View vazia é banco sem cobrança nenhuma, não erro. */
  it("sem linha na view, o caixa é zero", async () => {
    respostas.set("metricas_caixa", { data: null, error: null });

    expect(await repo.caixa()).toMatchObject({
      entrouCentavos: 0,
      liquidoCentavos: 0,
    });
  });

  /**
   * A pressão vem agregada da view, e a ordem importa (#207).
   *
   * Bloqueio primeiro porque é o único número que muda uma decisão — é o
   * "abuso medido" que a escolha de pôr limite na borda está esperando.
   * Volume depois, para o dia em que nada estiver bloqueado.
   */
  it("pressão vem da view, ordenada por bloqueio e depois por volume", async () => {
    respostas.set("metricas_pressao", {
      data: [
        {
          rotulo: "vaga.publicar",
          chaves: "2",
          chamadas: "31",
          bloqueadas: "1",
          pico: "22",
        },
        {
          rotulo: "login",
          chaves: "9",
          chamadas: "12",
          bloqueadas: "0",
          pico: "3",
        },
      ],
      error: null,
    });

    const linhas = await repo.pressaoNosTetos(20);

    expect(linhas[0]).toEqual({
      rotulo: "vaga.publicar",
      chaves: 2,
      chamadas: 31,
      bloqueadas: 1,
      pico: 22,
    });

    const ordens = chamadas
      .filter((c) => c.tabela === "metricas_pressao" && c.metodo === "order")
      .map((c) => c.args[0]);
    expect(ordens).toEqual(["bloqueadas", "chamadas"]);

    const limite = chamadas.find(
      (c) => c.tabela === "metricas_pressao" && c.metodo === "limit",
    );
    expect(limite?.args[0]).toBe(20);
  });

  /**
   * A consulta pede `*`, e isso só é seguro porque a view não tem `chave`.
   *
   * `tentativas_de_acesso.chave` é `login:<e-mail>` nas três de
   * autenticação. A projeção acontece em SQL justamente para que nenhuma
   * consulta desta camada consiga trazer endereço de e-mail de volta —
   * este teste trava o contrário: se um dia a view ganhar a coluna e o
   * repositório a repassar, alguém precisa ver vermelho.
   */
  it("nada do que sai da view identifica alguém", async () => {
    respostas.set("metricas_pressao", {
      data: [
        {
          rotulo: "login",
          chaves: "1",
          chamadas: "5",
          bloqueadas: "1",
          pico: "5",
          // A view não devolve isto. Se um dia devolver, não pode passar.
          chave: "login:alguem@exemplo.com",
        },
      ],
      error: null,
    });

    const [linha] = await repo.pressaoNosTetos(20);

    expect(Object.keys(linha).sort()).toEqual([
      "bloqueadas",
      "chamadas",
      "chaves",
      "pico",
      "rotulo",
    ]);
    expect(JSON.stringify(linha)).not.toContain("@");
  });

  it("sem linha na view, a pressão é lista vazia", async () => {
    respostas.set("metricas_pressao", { data: null, error: null });
    expect(await repo.pressaoNosTetos(20)).toEqual([]);
  });

  it("erro de banco vira indisponível, não interno", async () => {
    respostas.set("metricas_totais", {
      data: null,
      error: { message: "conexão recusada" },
    });

    await expect(repo.totais()).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});
