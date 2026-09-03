/**
 * @vitest-environment node
 *
 * Conferir o CNPJ na Receita.
 *
 * O que se protege aqui é o portão que separa empresa real de anúncio
 * falso. Até então o CNPJ passava por dígito verificador e mais nada — e
 * `11222333000181`, o exemplo desta própria suíte, é uma empresa de
 * verdade no Rio Grande do Sul. Número bem formado nunca foi prova de
 * existência.
 *
 * Nenhum teste daqui fala com a rede: o `fetch` é injetado. Suíte que
 * depende de API de terceiro estar no ar falha vermelho sem ninguém ter
 * mexido em nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import { consultarCnpj, mesmaRazaoSocial } from "@/server/verificacao/cnpj";

function respostaDaReceita(corpo: unknown, status = 200) {
  return (async () =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const naoDeviaConsultar = (() => {
  throw new Error("não devia consultar");
}) as unknown as typeof fetch;

const receitaForaDoAr = (async () => {
  throw new Error("timeout");
}) as unknown as typeof fetch;

const ATIVA = {
  cnpj: "11222333000181",
  razao_social: "AGRO NORTE COMERCIO DE INSUMOS LTDA",
  descricao_situacao_cadastral: "ATIVA",
  uf: "MT",
  municipio: "SINOP",
};

describe("consulta à Receita", () => {
  it("lê os campos que decidem", async () => {
    const r = await consultarCnpj(
      "11.222.333/0001-81",
      respostaDaReceita(ATIVA),
    );

    expect(r.tipo).toBe("encontrado");
    if (r.tipo !== "encontrado") return;
    expect(r.empresa.razaoSocial).toBe("AGRO NORTE COMERCIO DE INSUMOS LTDA");
    expect(r.empresa.situacao).toBe("ATIVA");
    expect(r.empresa.municipio).toBe("SINOP");
  });

  it("404 é não encontrado, não erro", async () => {
    const r = await consultarCnpj("11222333000181", respostaDaReceita({}, 404));
    expect(r.tipo).toBe("nao_encontrado");
  });

  /**
   * A distinção importa porque muda a frase na tela: culpar quem está
   * cadastrando por uma API fora do ar faz a pessoa reconferir um CNPJ que
   * está certo.
   */
  it("500 é indisponível, que é diferente de inexistente", async () => {
    const r = await consultarCnpj("11222333000181", respostaDaReceita({}, 500));
    expect(r.tipo).toBe("indisponivel");
  });

  it("rede fora do ar não lança, vira indisponível", async () => {
    await expect(
      consultarCnpj("11222333000181", receitaForaDoAr),
    ).resolves.toEqual({ tipo: "indisponivel" });
  });

  /** 200 sem os campos que decidem é resposta que não serve. */
  it("resposta incompleta é indisponível", async () => {
    const r = await consultarCnpj(
      "11222333000181",
      respostaDaReceita({ cnpj: "11222333000181" }),
    );
    expect(r.tipo).toBe("indisponivel");
  });

  it("número com tamanho errado nem sai daqui", async () => {
    await expect(consultarCnpj("123", naoDeviaConsultar)).resolves.toEqual({
      tipo: "nao_encontrado",
    });
  });
});

/**
 * A comparação de nome é onde uma verificação boa vira ruim.
 *
 * A Receita grava em caixa alta e sem acento; quem digita escreve com
 * ponto, acento e caixa mista. Exigir igualdade literal reprovaria a
 * empresa certa — e verificação que reprova quem está certo ensina todo
 * mundo a ignorá-la.
 */
describe("razão social", () => {
  it("ignora acento, caixa e pontuação", () => {
    expect(
      mesmaRazaoSocial("Agro Norte Comércio Ltda.", "AGRO NORTE COMERCIO LTDA"),
    ).toBe(true);
  });

  it("ignora espaço repetido", () => {
    expect(mesmaRazaoSocial("Agro   Norte", "AGRO NORTE")).toBe(true);
  });

  /** Palavra a mais é nome diferente, e é isso que se quer enxergar. */
  it("não ignora palavra", () => {
    expect(mesmaRazaoSocial("Agro Norte", "AGRO NORTE COMERCIO LTDA")).toBe(
      false,
    );
  });
});

describe("verificação automática", () => {
  let verificar: typeof import("@/server/verificacao/servico").verificarCnpjAutomatico;
  let repo: import("@/server/repositories").RepositorioMemoria;
  let restaurar: () => void;
  let usuarioId: string;

  beforeEach(async () => {
    vi.resetModules();
    const [modulo, repositorios] = await Promise.all([
      import("@/server/verificacao/servico"),
      import("@/server/repositories"),
    ]);
    verificar = modulo.verificarCnpjAutomatico;

    repo = new repositorios.RepositorioMemoria();
    restaurar = repositorios.usarRepositorio(repo);

    const usuario = await repo.criar({
      email: "empresa@teste.lupa",
      senhaHash: "hash",
      papel: "empresa",
      nomeCompleto: "Quem Representa",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    usuarioId = usuario.id;
    await repo.criarPerfilEmpresa({
      usuarioId,
      razaoSocial: "Agro Norte Comércio de Insumos Ltda.",
      cnpj: "11222333000181",
      setor: null,
      porte: null,
      site: null,
      instagram: null,
      facebook: null,
      descricao: null,
      logoUrl: null,
      plano: "trial",
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  function sessao(): Autenticado {
    return { usuarioId, papel: "empresa" };
  }

  it("empresa ativa com o nome certo fica verificada, sem fila", async () => {
    const r = await verificar(sessao(), respostaDaReceita(ATIVA));

    expect(r.ok).toBe(true);
    expect((await repo.porId(usuarioId))?.docVerificado).toBe(true);
  });

  /**
   * Empresa baixada continua sendo empresa que existiu. Publicar vaga em
   * nome de CNPJ baixado é exatamente o desenho do anúncio falso.
   */
  it("situação diferente de ativa não verifica, e diz qual é", async () => {
    const r = await verificar(
      sessao(),
      respostaDaReceita({ ...ATIVA, descricao_situacao_cadastral: "BAIXADA" }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("baixada");
    expect((await repo.porId(usuarioId))?.docVerificado).toBe(false);
  });

  /** A razão social da Receita vai na mensagem: sem ela, nada a corrigir. */
  it("nome divergente não verifica, e mostra o da Receita", async () => {
    const r = await verificar(
      sessao(),
      respostaDaReceita({ ...ATIVA, razao_social: "OUTRA EMPRESA LTDA" }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("OUTRA EMPRESA LTDA");
    expect((await repo.porId(usuarioId))?.docVerificado).toBe(false);
  });

  it("Receita fora do ar não verifica nem culpa quem está na tela", async () => {
    const r = await verificar(sessao(), receitaForaDoAr);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("Receita");
    expect((await repo.porId(usuarioId))?.docVerificado).toBe(false);
  });

  it("CNPJ inexistente não verifica", async () => {
    const r = await verificar(sessao(), respostaDaReceita({}, 404));

    expect(r.ok).toBe(false);
    expect((await repo.porId(usuarioId))?.docVerificado).toBe(false);
  });

  /**
   * O prestador tem CPF, não CNPJ, e não há consulta pública gratuita para
   * CPF — é a #120. A frase manda para o caminho que existe, em vez de
   * deixar a pessoa num botão que nunca vai funcionar para ela.
   */
  it("sem CNPJ, manda para o envio de documento", async () => {
    const outro = await repo.criar({
      email: "prestador@teste.lupa",
      senhaHash: "hash",
      papel: "prestador_servico",
      nomeCompleto: "Quem Presta",
      telefone: "66999990001",
      cidade: "Sinop",
    });

    const r = await verificar(
      { usuarioId: outro.id, papel: "prestador_servico" },
      respostaDaReceita(ATIVA),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("documento");
  });

  it("sem sessão, nem consulta", async () => {
    await expect(verificar(null, naoDeviaConsultar)).rejects.toThrow();
  });
});
