/**
 * @vitest-environment node
 *
 * CNPJ de MEI, para quem já é prestador de serviço.
 *
 * Selo adicional ao CPF, que já verifica o prestador na hora de ativar
 * (#133) — nada aqui pode enfraquecer essa garantia. O que se protege é
 * que uma falha na consulta à Receita nunca tire o prestador da busca, e
 * que o mesmo CNPJ não sirva para dois perfis, seja empresa ou prestador.
 *
 * Nenhum teste fala com a rede: o `fetch` é injetado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";

function respostaDaReceita(corpo: unknown, status = 200) {
  return (async () =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

/** O nome do MEI na Receita é o nome da própria pessoa, não uma marca. */
const ATIVA_NO_NOME_DE = (nome: string) => ({
  cnpj: "11222333000181",
  razao_social: nome.toUpperCase(),
  descricao_situacao_cadastral: "ATIVA",
  uf: "MT",
  municipio: "SINOP",
});

const CNPJ_VALIDO = "11222333000181";

describe("CNPJ de MEI do prestador", () => {
  let definir: typeof import("@/server/verificacao/servico").definirCnpjDoPrestador;
  let repo: import("@/server/repositories").RepositorioMemoria;
  let restaurar: () => void;
  let prestadorId: string;

  async function criarPrestador(nome: string, email: string) {
    const usuario = await repo.criar({
      email,
      senhaHash: "hash",
      papel: "prestador_servico",
      nomeCompleto: nome,
      telefone: "66999990000",
      cidade: "Sinop",
    });
    await repo.criarPerfilPrestador({
      usuarioId: usuario.id,
      categoriaId: 1,
      descricao: "Instalações elétricas.",
      precoInicial: null,
      anosExperiencia: null,
      bairrosAtendidos: [],
      instagram: null,
      facebook: null,
      cnpj: null,
      cnpjVerificado: false,
    });
    return usuario.id;
  }

  beforeEach(async () => {
    vi.resetModules();
    const [modulo, repositorios] = await Promise.all([
      import("@/server/verificacao/servico"),
      import("@/server/repositories"),
    ]);
    definir = modulo.definirCnpjDoPrestador;

    repo = new repositorios.RepositorioMemoria();
    restaurar = repositorios.usarRepositorio(repo);

    prestadorId = await criarPrestador("Quem Presta", "prestador@teste.lupa");

    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  function sessao(id = prestadorId): Autenticado {
    return { usuarioId: id, papel: "prestador_servico" };
  }

  it("CNPJ válido, ativo e no nome da pessoa confirma o selo", async () => {
    const r = await definir(
      sessao(),
      CNPJ_VALIDO,
      respostaDaReceita(ATIVA_NO_NOME_DE("Quem Presta")),
    );

    expect(r.ok).toBe(true);
    const perfil = await repo.perfilPrestador(prestadorId);
    expect(perfil?.cnpj).toBe(CNPJ_VALIDO);
    expect(perfil?.cnpjVerificado).toBe(true);
  });

  it("CNPJ mal formado é recusado antes de qualquer consulta", async () => {
    const nuncaChama = (() => {
      throw new Error("não devia consultar");
    }) as unknown as typeof fetch;

    const r = await definir(sessao(), "12345678901234", nuncaChama);

    expect(r.ok).toBe(false);
    expect(await repo.perfilPrestador(prestadorId)).toMatchObject({
      cnpj: null,
      cnpjVerificado: false,
    });
  });

  /**
   * Ao contrário da empresa (#128), uma falha aqui não tira ninguém da
   * busca: o CPF já verificou o perfil. O número fica salvo — dá para
   * tentar de novo sem redigitar.
   */
  it("Receita fora do ar: salva o CNPJ, mas sem o selo", async () => {
    const receitaForaDoAr = (async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;

    const r = await definir(sessao(), CNPJ_VALIDO, receitaForaDoAr);

    expect(r.ok).toBe(false);
    const perfil = await repo.perfilPrestador(prestadorId);
    expect(perfil?.cnpj).toBe(CNPJ_VALIDO);
    expect(perfil?.cnpjVerificado).toBe(false);
  });

  it("situação diferente de ativa: salva sem o selo, e diz qual é", async () => {
    const r = await definir(
      sessao(),
      CNPJ_VALIDO,
      respostaDaReceita({
        ...ATIVA_NO_NOME_DE("Quem Presta"),
        descricao_situacao_cadastral: "BAIXADA",
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("baixada");
    expect((await repo.perfilPrestador(prestadorId))?.cnpjVerificado).toBe(
      false,
    );
  });

  it("nome que não bate com a Receita: salva sem o selo", async () => {
    const r = await definir(
      sessao(),
      CNPJ_VALIDO,
      respostaDaReceita(ATIVA_NO_NOME_DE("Outra Pessoa Qualquer")),
    );

    expect(r.ok).toBe(false);
    expect((await repo.perfilPrestador(prestadorId))?.cnpjVerificado).toBe(
      false,
    );
  });

  it("CNPJ já usado por uma empresa é recusado, sem gravar nada", async () => {
    const empresa = await repo.criar({
      email: "empresa@teste.lupa",
      senhaHash: "hash",
      papel: "empresa",
      nomeCompleto: "Dona da Empresa",
      telefone: "66999990001",
      cidade: "Sinop",
    });
    await repo.criarPerfilEmpresa({
      usuarioId: empresa.id,
      razaoSocial: "Agro Norte Ltda.",
      cnpj: CNPJ_VALIDO,
      setor: null,
      porte: null,
      site: null,
      instagram: null,
      facebook: null,
      descricao: null,
      logoUrl: null,
      plano: "trial",
    });

    const r = await definir(
      sessao(),
      CNPJ_VALIDO,
      respostaDaReceita(ATIVA_NO_NOME_DE("Quem Presta")),
    );

    expect(r.ok).toBe(false);
    expect(await repo.perfilPrestador(prestadorId)).toMatchObject({
      cnpj: null,
    });
  });

  it("CNPJ já usado por outro prestador é recusado", async () => {
    const outroId = await criarPrestador("Outro Prestador", "outro@teste.lupa");
    await repo.definirCnpjPrestador(outroId, CNPJ_VALIDO, true);

    const r = await definir(
      sessao(),
      CNPJ_VALIDO,
      respostaDaReceita(ATIVA_NO_NOME_DE("Quem Presta")),
    );

    expect(r.ok).toBe(false);
  });

  /** Resubmeter o próprio CNPJ não é colisão com si mesmo. */
  it("regravar o próprio CNPJ não conta como já em uso", async () => {
    await definir(
      sessao(),
      CNPJ_VALIDO,
      respostaDaReceita(ATIVA_NO_NOME_DE("Quem Presta")),
    );

    const r = await definir(
      sessao(),
      CNPJ_VALIDO,
      respostaDaReceita(ATIVA_NO_NOME_DE("Quem Presta")),
    );

    expect(r.ok).toBe(true);
  });

  it("candidato e empresa não têm CNPJ de MEI para confirmar", async () => {
    const candidato = await repo.criar({
      email: "candidato@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Quem Procura",
      telefone: "66999990002",
      cidade: "Sinop",
    });

    await expect(
      definir(
        { usuarioId: candidato.id, papel: "candidato_clt" },
        CNPJ_VALIDO,
        respostaDaReceita(ATIVA_NO_NOME_DE("Quem Procura")),
      ),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });
});
