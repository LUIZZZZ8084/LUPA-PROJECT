/**
 * @vitest-environment node
 *
 * Os custos mensais do painel do admin (#473): o valor digitado em reais,
 * quem pode mexer e o teto da lista.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import {
  RepositorioCustosMemoria,
  usarRepositorioCustos,
} from "@/server/custos";
import { CUSTOS_INICIAIS } from "@/server/custos/iniciais";
import {
  reaisEmCentavos,
  schemaEdicaoDeCusto,
  schemaNovoCusto,
} from "@/server/custos/schemas";
import {
  adicionarCusto,
  editarCusto,
  LIMITE_DE_CUSTOS,
  listarCustos,
  removerCusto,
} from "@/server/custos/servico";
import { ehAppError } from "@/server/errors";

const admin: Autenticado = { usuarioId: "adm", papel: "admin" };

async function codigoDoErro(promessa: Promise<unknown>) {
  try {
    await promessa;
  } catch (e) {
    return ehAppError(e) ? e.codigo : "outro";
  }
  return "passou";
}

describe("valor em reais", () => {
  it.each([
    ["300", 30_000],
    ["300,00", 30_000],
    ["1.234,56", 123_456],
    ["1234,56", 123_456],
    ["R$ 133,00", 13_300],
    [" 99,9 ", 9_990],
    // Sem vírgula, o ponto é milhar...
    ["1.500", 150_000],
    ["10.000", 1_000_000],
    // ...a não ser que venham um ou dois dígitos depois dele.
    ["133.50", 13_350],
    ["133.5", 13_350],
  ])("%j vira %i centavos", (texto, centavos) => {
    expect(reaisEmCentavos(texto)).toBe(centavos);
  });

  it.each(["", "abc", "1,2,3", "-50", "12,345", "R$"])(
    "%j não é valor",
    (texto) => {
      expect(reaisEmCentavos(texto)).toBeNull();
    },
  );

  it("o formulário recusa zero e o que passa de R$ 100.000,00", () => {
    for (const valor of ["0", "0,00", "100.000,01"]) {
      const r = schemaNovoCusto.safeParse({ nome: "Aluguel", valor });
      expect(r.success, valor).toBe(false);
    }
    const ok = schemaNovoCusto.safeParse({
      nome: "  Aluguel  ",
      valor: "100.000,00",
    });
    expect(ok.success && ok.data).toEqual({
      nome: "Aluguel",
      valor: 10_000_000,
    });
  });

  it("o nome tem de 2 a 60 caracteres, e a edição exige o id", () => {
    expect(schemaNovoCusto.safeParse({ nome: "A", valor: "10" }).success).toBe(
      false,
    );
    expect(
      schemaEdicaoDeCusto.safeParse({ nome: "Aluguel", valor: "10" }).success,
    ).toBe(false);
    expect(
      schemaEdicaoDeCusto.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
        nome: "Aluguel",
        valor: "10",
      }).success,
    ).toBe(true);
  });
});

describe("custos do mês", () => {
  let repo: RepositorioCustosMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioCustosMemoria();
    restaurar = usarRepositorioCustos(repo);
  });

  afterEach(() => restaurar());

  it("nasce com os custos iniciais, o Supabase primeiro", async () => {
    const lista = await listarCustos(admin);
    expect(lista.map(({ nome, centavos }) => ({ nome, centavos }))).toEqual(
      CUSTOS_INICIAIS,
    );
    expect(lista[0].nome).toMatch(/supabase/i);
  });

  it("o admin acrescenta no fim, edita e remove", async () => {
    const contador = await adicionarCusto(admin, {
      nome: "Contador",
      centavos: 30_000,
    });
    expect((await listarCustos(admin)).at(-1)).toEqual(contador);

    await editarCusto(admin, contador.id, {
      nome: "Contabilidade",
      centavos: 35_000,
    });
    expect((await listarCustos(admin)).at(-1)).toMatchObject({
      nome: "Contabilidade",
      centavos: 35_000,
    });

    await removerCusto(admin, contador.id);
    expect(await listarCustos(admin)).toHaveLength(CUSTOS_INICIAIS.length);
  });

  it.each([
    ["candidato", { usuarioId: "c", papel: "candidato_clt" }],
    ["empresa", { usuarioId: "e", papel: "empresa" }],
    ["prestador", { usuarioId: "p", papel: "prestador_servico" }],
  ] as const)("%s não lê nem mexe", async (_nome, sessao) => {
    expect(await codigoDoErro(listarCustos(sessao))).toBe("sem_permissao");
    expect(
      await codigoDoErro(adicionarCusto(sessao, { nome: "X", centavos: 1 })),
    ).toBe("sem_permissao");
    expect(await repo.listar()).toHaveLength(CUSTOS_INICIAIS.length);
  });

  it("sem sessão, não autenticado", async () => {
    expect(await codigoDoErro(listarCustos(null))).toBe("nao_autenticado");
  });

  it("custo que não existe é 'não encontrado', ao editar e ao remover", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      await codigoDoErro(editarCusto(admin, id, { nome: "X", centavos: 1 })),
    ).toBe("nao_encontrado");
    expect(await codigoDoErro(removerCusto(admin, id))).toBe("nao_encontrado");
  });

  it(`a lista tem teto de ${LIMITE_DE_CUSTOS}`, async () => {
    while ((await repo.listar()).length < LIMITE_DE_CUSTOS) {
      await repo.criar({ nome: "Item", centavos: 100 });
    }
    expect(
      await codigoDoErro(
        adicionarCusto(admin, { nome: "Um a mais", centavos: 100 }),
      ),
    ).toBe("limite_excedido");
    expect(await repo.listar()).toHaveLength(LIMITE_DE_CUSTOS);
  });
});
