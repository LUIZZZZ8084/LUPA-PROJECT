/**
 * @vitest-environment node
 *
 * Comprar o gerador de currículo (#47): compra única que liga um
 * interruptor, não crédito nem assinatura.
 *
 * Ao contrário da vaga avulsa e do plano mensal, aqui não há quantidade
 * para conferir — só se o interruptor liga na aprovação e desliga na
 * reversão. Usa o repositório de usuários de verdade (em memória), porque
 * `candidatos/servico.ts` é o próprio domínio sob teste — mesmo raciocínio
 * de `pagamentos-compra-de-vaga.test.ts` usando `carteiras/servico` real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: async () => {},
  revogarMensalidade: async () => {},
}));

vi.mock("@/server/carteiras/servico", () => ({
  creditarVagas: async () => {},
  debitarVagas: async () => {},
  estenderPlanoMensal: async () => {},
  revogarPlanoMensal: async () => {},
}));

/**
 * `vi.resetModules()` dá um módulo `@/server/repositories` novo a cada
 * chamada — importar o repositório estaticamente no topo do arquivo o
 * deixaria desalinhado com o que `pagamentos/servico.ts` enxerga depois
 * do reset, e `usarRepositorio` de um passaria batido no outro. Por isso
 * o repositório de usuários também nasce aqui dentro, na mesma leva.
 */
async function carregar() {
  vi.resetModules();
  const servico = await import("@/server/pagamentos/servico");
  const pagamentos = await import("@/server/pagamentos");
  const repositories = await import("@/server/repositories");

  const repoPagamentos = new pagamentos.RepositorioPagamentosMemoria();
  const repoUsuarios = new repositories.RepositorioMemoria();
  const restaurarP = pagamentos.usarRepositorioPagamentos(repoPagamentos);
  const restaurarU = repositories.usarRepositorio(repoUsuarios);

  return {
    servico,
    repoPagamentos,
    repoUsuarios,
    restaurar: () => {
      restaurarP();
      restaurarU();
    },
  };
}

type Contexto = Awaited<ReturnType<typeof carregar>>;

describe("comprar o gerador de currículo", () => {
  let ctx: Contexto;
  let usuarioId: string;

  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
    ctx = await carregar();

    const usuario = await ctx.repoUsuarios.criar({
      email: "candidato@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Candidato de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    await ctx.repoUsuarios.criarPerfilCandidato({
      usuarioId: usuario.id,
      areaDesejada: "Agronegócio",
      resumo: null,
      curriculoUrl: null,
      disponibilidade: null,
      formacao: null,
      habilidades: [],
      experiencias: [],
      visivelParaEmpresas: false,
      geradorCurriculoLiberado: false,
    });
    usuarioId = usuario.id;
  });

  afterEach(() => {
    ctx?.restaurar();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("aprova na hora em demonstração e libera o gerador", async () => {
    const sessao: Autenticado = { usuarioId, papel: "candidato_clt" };

    const { pagamento, checkoutUrl } = await ctx.servico.comprar(
      sessao,
      "curriculo_pdf",
    );

    expect(checkoutUrl).toBeNull();
    expect(pagamento.status).toBe("aprovado");
    expect(pagamento.valorCentavos).toBe(1490);

    const perfil = await ctx.repoUsuarios.perfilCandidato(usuarioId);
    expect(perfil?.geradorCurriculoLiberado).toBe(true);
  });

  it("não mexe no interruptor de quem ainda não comprou", async () => {
    const perfil = await ctx.repoUsuarios.perfilCandidato(usuarioId);
    expect(perfil?.geradorCurriculoLiberado).toBe(false);
  });

  /**
   * Estorno e chargeback desligam o gerador — mesma família de guarda dos
   * outros tipos (`pagamentos-estorno.test.ts`): o webhook releria a API
   * do Mercado Pago, nunca confiaria no corpo do POST. Aqui basta mockar
   * essa releitura.
   */
  it("estorno desliga o gerador de volta", async () => {
    const sessao: Autenticado = { usuarioId, papel: "candidato_clt" };
    const { pagamento } = await ctx.servico.comprar(sessao, "curriculo_pdf");

    const receita = (async () =>
      new Response(
        JSON.stringify({
          id: 987,
          status: "refunded",
          external_reference: pagamento.id,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    await ctx.servico.confirmarPagamento("987", receita);

    const perfil = await ctx.repoUsuarios.perfilCandidato(usuarioId);
    expect(perfil?.geradorCurriculoLiberado).toBe(false);
  });
});
