/**
 * @vitest-environment node
 *
 * O repositório de notificações contra o Postgres.
 *
 * O que estes testes protegem é o formato das consultas — que tabela, que
 * filtro, que valor —, e uma regra em particular: **nenhum filtro montado
 * por concatenação**. O `or()` do PostgREST recebe uma string numa
 * linguagem onde a vírgula separa condições, e este projeto já perdeu a
 * base inteira por interpolar um termo de busca ali.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let porTabela: Record<string, Resposta> = {};

function construtor(tabela: string) {
  const resposta = () => porTabela[tabela] ?? { data: [], error: null };

  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta(),
    single: async () => resposta(),
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta()).then(resolver),
  };

  for (const metodo of ["select", "eq", "is", "in", "upsert", "delete"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

const estado = vi.hoisted(() => ({ temChave: true }));

vi.mock("@/lib/supabase/service", () => ({
  clienteDeServico: () =>
    estado.temChave ? { from: (tabela: string) => construtor(tabela) } : null,
}));

import { RepositorioNotificacoesPostgres } from "@/server/notificacoes/postgres";

describe("repositório de notificações no Postgres", () => {
  let repo: RepositorioNotificacoesPostgres;

  beforeEach(() => {
    chamadas.length = 0;
    porTabela = {};
    estado.temChave = true;
    repo = new RepositorioNotificacoesPostgres();
  });

  function metodos(tabela: string) {
    return chamadas.filter((c) => c.tabela === tabela).map((c) => c.metodo);
  }

  it("lê a preferência da pessoa", async () => {
    porTabela.preferencias_notificacao = {
      data: { usuario_id: "u1", cidade: "Sinop", categoria: "Agronegócio" },
      error: null,
    };

    expect(await repo.preferencia("u1")).toEqual({
      usuarioId: "u1",
      cidade: "Sinop",
      categoria: "Agronegócio",
    });
  });

  it("sem preferência devolve null, não erro", async () => {
    porTabela.preferencias_notificacao = { data: null, error: null };
    expect(await repo.preferencia("u1")).toBeNull();
  });

  it("categoria ausente vira null, e não string vazia", async () => {
    porTabela.preferencias_notificacao = {
      data: { usuario_id: "u1", cidade: "Sinop", categoria: null },
      error: null,
    };
    expect((await repo.preferencia("u1"))?.categoria).toBeNull();
  });

  /** Uma preferência por pessoa: gravar de novo troca, não acumula. */
  it("salvar preferência é upsert por usuario_id", async () => {
    await repo.salvarPreferencia({
      usuarioId: "u1",
      cidade: "Sinop",
      categoria: null,
    });

    const upsert = chamadas.find((c) => c.metodo === "upsert");
    expect(upsert?.tabela).toBe("preferencias_notificacao");
    expect(upsert?.args[1]).toMatchObject({ onConflict: "usuario_id" });
  });

  /**
   * A regra que mais importa neste arquivo.
   *
   * Nenhuma chamada pode montar filtro por string: `eq` e `is` recebem o
   * valor por parâmetro. Se alguém "simplificar" isto para um
   * `or("categoria.is.null,categoria.eq.X")`, este teste reprova.
   */
  it("filtra por eq e is, nunca por or com string montada", async () => {
    porTabela.preferencias_notificacao = {
      data: [{ usuario_id: "u1" }],
      error: null,
    };
    porTabela.inscricoes_push = {
      data: [{ usuario_id: "u1", endpoint: "e1", p256dh: "p", auth: "a" }],
      error: null,
    };

    await repo.inscricoesInteressadas("Sinop", "Agronegócio");

    expect(metodos("preferencias_notificacao")).not.toContain("or");
    expect(metodos("preferencias_notificacao")).toContain("is");
    expect(metodos("preferencias_notificacao")).toContain("eq");
  });

  /**
   * Vaga sem categoria só alcança quem pediu a cidade inteira — então a
   * segunda consulta nem sai. Sem isto seria um `eq("categoria", null)`,
   * que no PostgREST não é o mesmo que `is null` e devolveria vazio.
   */
  it("vaga sem categoria não consulta a segunda condição", async () => {
    porTabela.preferencias_notificacao = { data: [], error: null };

    await repo.inscricoesInteressadas("Sinop", null);

    const eqs = chamadas.filter(
      (c) => c.tabela === "preferencias_notificacao" && c.metodo === "eq",
    );
    // Só o `eq` da cidade; nenhum `eq` de categoria.
    expect(eqs).toHaveLength(1);
    expect(eqs[0].args[0]).toBe("cidade");
  });

  it("ninguém interessado não vai buscar inscrição", async () => {
    porTabela.preferencias_notificacao = { data: [], error: null };

    expect(await repo.inscricoesInteressadas("Sinop", "Agronegócio")).toEqual(
      [],
    );
    expect(metodos("inscricoes_push")).toEqual([]);
  });

  /** A mesma pessoa nas duas consultas não vira dois avisos. */
  it("não repete usuário que casou nas duas condições", async () => {
    porTabela.preferencias_notificacao = {
      data: [{ usuario_id: "u1" }],
      error: null,
    };
    porTabela.inscricoes_push = { data: [], error: null };

    await repo.inscricoesInteressadas("Sinop", "Agronegócio");

    const dentro = chamadas.find(
      (c) => c.tabela === "inscricoes_push" && c.metodo === "in",
    );
    expect(dentro?.args[1]).toEqual(["u1"]);
  });

  it("inscrição é upsert por endpoint — reinscrever troca a linha", async () => {
    await repo.salvarInscricao({
      usuarioId: "u1",
      endpoint: "https://push/x",
      p256dh: "p",
      auth: "a",
    });

    const upsert = chamadas.find((c) => c.metodo === "upsert");
    expect(upsert?.tabela).toBe("inscricoes_push");
    expect(upsert?.args[1]).toMatchObject({ onConflict: "endpoint" });
  });

  it("remover inscrição apaga pelo endpoint", async () => {
    await repo.removerInscricao("https://push/x");

    expect(metodos("inscricoes_push")).toContain("delete");
    const eq = chamadas.find((c) => c.metodo === "eq");
    expect(eq?.args).toEqual(["endpoint", "https://push/x"]);
  });

  it("remover preferência apaga pelo usuário", async () => {
    await repo.removerPreferencia("u1");

    expect(metodos("preferencias_notificacao")).toContain("delete");
  });

  it("lista as inscrições da pessoa", async () => {
    porTabela.inscricoes_push = {
      data: [{ usuario_id: "u1", endpoint: "e1", p256dh: "p", auth: "a" }],
      error: null,
    };

    expect(await repo.inscricoesDe("u1")).toEqual([
      { usuarioId: "u1", endpoint: "e1", p256dh: "p", auth: "a" },
    ]);
  });

  /** Erro do banco vira `indisponivel`, não passa em silêncio. */
  it("erro do banco não é engolido", async () => {
    porTabela.preferencias_notificacao = {
      data: null,
      error: { message: "conexão perdida" },
    };

    await expect(
      repo.salvarPreferencia({
        usuarioId: "u1",
        cidade: "Sinop",
        categoria: null,
      }),
    ).rejects.toMatchObject({ codigo: "indisponivel" });
  });

  /**
   * Sem chave de serviço não há como alcançar estas tabelas: elas não têm
   * grant para `anon` nem para `authenticated`, de propósito.
   */
  it("sem chave de serviço, recusa em vez de tentar", async () => {
    estado.temChave = false;

    await expect(repo.preferencia("u1")).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});
