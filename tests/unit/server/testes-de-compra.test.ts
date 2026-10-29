/**
 * @vitest-environment node
 *
 * A área de testes de compra do admin (#516).
 *
 * O que se prova: a compra libera o mesmo que a de verdade liberaria — o
 * gerador com o PDF, o crédito, o plano com o limite certo —, sem falar com
 * o Mercado Pago e sem gravar cobrança, que o caixa somaria como receita. E
 * só o admin chega aqui, e só na própria conta.
 *
 * Roda com o banco "ligado" e o token do Mercado Pago presente, que é o
 * cenário de produção: é ali que a compra de verdade recusaria o atalho da
 * demonstração, e é ali que este botão precisa funcionar.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import type { Autenticado, Papel } from "@/server/auth/rbac";
import {
  RepositorioCarteirasMemoria,
  usarRepositorioCarteiras,
} from "@/server/carteiras";
import { ehAppError } from "@/server/errors";
import {
  RepositorioPagamentosMemoria,
  usarRepositorioPagamentos,
} from "@/server/pagamentos";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";
import {
  testarCompraDeVaga,
  testarCompraDoCurriculo,
} from "@/server/testes-de-compra/servico";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";

const UM_DIA = 24 * 60 * 60 * 1000;

describe("testes de compra do admin", () => {
  let usuarios: RepositorioMemoria;
  let pagamentos: RepositorioPagamentosMemoria;
  let restaurar: Array<() => void>;
  let buscar: MockInstance<typeof fetch>;

  beforeEach(() => {
    usuarios = new RepositorioMemoria();
    pagamentos = new RepositorioPagamentosMemoria();
    restaurar = [
      usarRepositorio(usuarios),
      usarRepositorioPagamentos(pagamentos),
      usarRepositorioCarteiras(new RepositorioCarteirasMemoria()),
      usarRepositorioVagas(new RepositorioVagasMemoria()),
    ];
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-token-de-teste");
    // Espião, e não substituto: o gerador de PDF carrega o próprio
    // WebAssembly por `fetch`, e precisa que ele funcione.
    buscar = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const r of restaurar) r();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function sessao(papel: Papel): Promise<Autenticado> {
    const u = await usuarios.criar({
      email: `${papel}@teste.lupa`,
      senhaHash: "hash",
      papel,
      nomeCompleto: "Conta de Teste",
      telefone: "66999990000",
      cidade: "Sinop - MT",
    });
    return { usuarioId: u.id, papel };
  }

  it("o currículo libera o gerador e devolve o PDF, sem o admin ter perfil de candidato", async () => {
    const admin = await sessao("admin");
    expect(await usuarios.perfilCandidato(admin.usuarioId)).toBeNull();

    const pdf = await testarCompraDoCurriculo(admin);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const perfil = await usuarios.perfilCandidato(admin.usuarioId);
    expect(perfil?.geradorCurriculoLiberado).toBe(true);
    // O perfil que nasceu para receber o gerador não aparece para empresa.
    expect(perfil?.visivelParaEmpresas).toBe(false);
  });

  it("testar o currículo duas vezes não falha nem duplica o perfil", async () => {
    const admin = await sessao("admin");

    await testarCompraDoCurriculo(admin);
    const pdf = await testarCompraDoCurriculo(admin);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("a vaga avulsa soma um crédito por clique", async () => {
    const admin = await sessao("admin");

    expect(
      (await testarCompraDeVaga(admin, "empresa_vaga_avulsa")).creditos,
    ).toBe(1);
    expect(
      (await testarCompraDeVaga(admin, "empresa_vaga_avulsa")).creditos,
    ).toBe(2);
  });

  it("cada plano entra com o próprio limite de vagas no ar, por 30 dias", async () => {
    const admin = await sessao("admin");

    for (const [tipo, limite] of [
      ["empresa_plano_5", 5],
      ["empresa_plano_10", 10],
      ["empresa_mensal", null],
    ] as const) {
      const carteira = await testarCompraDeVaga(admin, tipo);
      expect(carteira.mensalAtivo, tipo).toBe(true);
      expect(carteira.limiteNoAr, tipo).toBe(limite);
      expect(carteira.pode, tipo).toBe(true);
    }

    const carteira = await testarCompraDeVaga(admin, "empresa_plano_5");
    const validade = new Date(carteira.mensalidadeValidaAte as string);
    expect(validade.getTime()).toBeGreaterThan(Date.now() + 29 * UM_DIA);
  });

  it("não fala com o Mercado Pago e não grava cobrança nenhuma", async () => {
    const admin = await sessao("admin");

    await testarCompraDoCurriculo(admin);
    await testarCompraDeVaga(admin, "empresa_vaga_avulsa");
    await testarCompraDeVaga(admin, "empresa_mensal");

    const enderecos = buscar.mock.calls.map(([alvo]) => String(alvo));
    expect(enderecos.filter((url) => url.includes("mercadopago"))).toEqual([]);
    // O caixa soma as cobranças aprovadas: teste nenhum vira receita.
    expect(pagamentos.todos()).toEqual([]);
  });

  it("só o admin testa; os outros papéis são recusados antes de qualquer efeito", async () => {
    for (const papel of [
      "candidato_clt",
      "prestador_servico",
      "empresa",
    ] as const) {
      const conta = await sessao(papel);

      for (const tentativa of [
        () => testarCompraDoCurriculo(conta),
        () => testarCompraDeVaga(conta, "empresa_vaga_avulsa"),
      ]) {
        const erro = await tentativa().catch((e: unknown) => e);
        expect(ehAppError(erro) && erro.codigo, papel).toBe("sem_permissao");
      }

      const perfil = await usuarios.perfilCandidato(conta.usuarioId);
      expect(perfil?.geradorCurriculoLiberado ?? false, papel).toBe(false);
    }

    await expect(testarCompraDeVaga(null, "empresa_mensal")).rejects.toThrow();
    expect(pagamentos.todos()).toEqual([]);
  });
});
