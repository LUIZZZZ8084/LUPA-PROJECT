/**
 * @vitest-environment node
 *
 * O serviço de edição não conhece requisição nem cookie: recebe o id de
 * quem está editando e trabalha só com ele.
 *
 * Isso não é estilo — é o que elimina a classe de bug em que alguém troca
 * um id na requisição e edita o perfil de outra pessoa. Não existe id de
 * alvo para trocar. O mesmo vale para o papel, que vem da sessão: aceitar
 * do formulário deixaria um candidato postar campos de prestador e ganhar
 * um anúncio na busca sem passar pelo cadastro de prestador.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ehAppError } from "@/server/errors";
import { schemaBasico, schemaEmpresa } from "@/server/perfil/schemas";
import {
  perfilParaEditar,
  salvarBasicos,
  salvarPerfilDoPapel,
} from "@/server/perfil/servico";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

let repo: RepositorioMemoria;
let restaurar: () => void;

async function criar(papel: "candidato_clt" | "prestador_servico" | "empresa") {
  const u = await repo.criar({
    email: `${papel}@teste.lupa`,
    senhaHash: "hash",
    papel,
    nomeCompleto: "Pessoa de Teste",
    telefone: "66999110001",
    cidade: "Sinop - MT",
  });
  return u.id;
}

beforeEach(() => {
  repo = new RepositorioMemoria();
  restaurar = usarRepositorio(repo);
});

afterEach(() => restaurar());

describe("carregar o perfil para editar", () => {
  it("traz a conta de quem está editando", async () => {
    const id = await criar("candidato_clt");
    const perfil = await perfilParaEditar(id, "candidato_clt");
    expect(perfil.usuario.nomeCompleto).toBe("Pessoa de Teste");
  });

  /** Hash de senha nunca sobe da camada de repositório. */
  it("não traz o hash de senha junto", async () => {
    const id = await criar("candidato_clt");
    const perfil = await perfilParaEditar(id, "candidato_clt");
    expect("senhaHash" in perfil.usuario).toBe(false);
  });

  /**
   * Buscar os três perfis para mostrar um seria três consultas e abriria
   * caminho para a tela renderizar campo de papel que a pessoa não tem.
   */
  it("só busca o perfil do papel de quem entrou", async () => {
    const id = await criar("candidato_clt");
    await repo.salvarPerfilCandidato(id, {
      areaDesejada: "Agronegócio",
      resumo: null,
      formacao: null,
      habilidades: [],
      experiencias: [],
      disponibilidade: null,
      visivelParaEmpresas: false,
    });

    const perfil = await perfilParaEditar(id, "candidato_clt");
    expect(perfil.candidato?.areaDesejada).toBe("Agronegócio");
    expect(perfil.prestador).toBeNull();
    expect(perfil.empresa).toBeNull();
  });

  it("usuário que não existe é não-encontrado", async () => {
    await expect(
      perfilParaEditar("nao-existe", "candidato_clt"),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "nao_encontrado");
  });
});

describe("salvar os dados da conta", () => {
  it("grava o telefone", async () => {
    const id = await criar("candidato_clt");

    await salvarBasicos(id, { telefone: "66999110005" });

    const u = await repo.porId(id);
    expect(u?.telefone).toBe("66999110005");
  });

  it("não mexe no e-mail nem no papel", async () => {
    const id = await criar("candidato_clt");
    const antes = await repo.porId(id);

    await salvarBasicos(id, { telefone: "66999110005" });

    const depois = await repo.porId(id);
    expect(depois?.email).toBe(antes?.email);
    expect(depois?.papel).toBe("candidato_clt");
  });

  /**
   * O nome assina as avaliações, e quem o trocava a qualquer hora avaliava
   * cada prestador com um nome diferente (#315). O caminho inteiro, do
   * formulário ao banco: um `nomeCompleto` forjado passa pelo schema e não
   * chega a lugar nenhum.
   */
  it("o nome não muda, nem com o campo forjado no formulário", async () => {
    const id = await criar("candidato_clt");
    const antes = await repo.porId(id);

    const forjado = schemaBasico.parse({
      nomeCompleto: "Nome Trocado",
      telefone: "66999110005",
    });
    await salvarBasicos(id, forjado);

    expect((await repo.porId(id))?.nomeCompleto).toBe(antes?.nomeCompleto);
  });
});

describe("salvar o perfil do papel", () => {
  it("candidato grava currículo", async () => {
    const id = await criar("candidato_clt");

    await salvarPerfilDoPapel(id, "candidato_clt", {
      areaDesejada: "Agronegócio",
      resumo: "Operador de colheitadeira.",
      formacao: "Ensino médio completo",
      habilidades: ["CNH categoria C"],
      experiencias: [
        { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
      ],
      disponibilidade: "Imediata",
      visivelParaEmpresas: false,
    });

    const p = await repo.perfilCandidato(id);
    expect(p?.formacao).toBe("Ensino médio completo");
    expect(p?.habilidades).toEqual(["CNH categoria C"]);
    expect(p?.experiencias).toEqual([
      { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
    ]);
  });

  /**
   * Conta criada antes de o campo existir chega aqui sem linha de perfil.
   * Falhar obrigaria a pessoa a "criar" antes de "editar" — distinção que
   * só faz sentido para quem escreveu o banco.
   */
  it("grava mesmo que o perfil ainda não exista", async () => {
    const id = await criar("prestador_servico");
    expect(await repo.perfilPrestador(id)).toBeNull();

    await salvarPerfilDoPapel(id, "prestador_servico", {
      categoriaId: 1,
      descricao: "Instalações elétricas residenciais.",
      precoInicial: 150,
      anosExperiencia: 7,
      instagram: null,
      facebook: null,
    });

    expect((await repo.perfilPrestador(id))?.categoriaId).toBe(1);
  });

  /**
   * A checagem de papel acontece aqui, e não só na tela: um formulário é
   * palpite do cliente sobre o que existe, e o servidor não confia nele.
   */
  it("candidato não consegue gravar anúncio de prestador", async () => {
    const id = await criar("candidato_clt");

    await salvarPerfilDoPapel(id, "candidato_clt", {
      categoriaId: 1,
      descricao: "Tentando virar prestador sem cadastro.",
      precoInicial: null,
      anosExperiencia: null,
    } as never);

    expect(await repo.perfilPrestador(id)).toBeNull();
  });

  /**
   * Empresa sem linha não pode ser criada aqui: exigiria inventar um CNPJ,
   * e empresa sem CNPJ é exatamente o que a plataforma não pode ter.
   */
  it("empresa sem cadastro é não-encontrada, não criada às cegas", async () => {
    const id = await criar("empresa");

    await expect(
      salvarPerfilDoPapel(id, "empresa", {
        setor: null,
        porte: null,
        site: null,
        instagram: null,
        facebook: null,
        descricao: null,
      }),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "nao_encontrado");
  });

  it("empresa cadastrada grava e mantém o CNPJ e o nome", async () => {
    const id = await criar("empresa");
    await repo.criarPerfilEmpresa({
      usuarioId: id,
      razaoSocial: "Agro Norte Ltda.",
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

    await salvarPerfilDoPapel(
      id,
      "empresa",
      schemaEmpresa.parse({
        razaoSocial: "Nome Trocado S.A.",
        setor: "Agronegócio",
        porte: "Média",
        site: "",
        instagram: "",
        facebook: "",
        descricao: "",
      }),
    );

    const e = await repo.perfilEmpresa(id);
    expect(e?.setor).toBe("Agronegócio");
    expect(e?.razaoSocial, "o nome não muda na edição (#315)").toBe(
      "Agro Norte Ltda.",
    );
    expect(e?.cnpj, "o CNPJ não pode mudar na edição").toBe("11222333000181");
  });

  /** Admin administra; não tem perfil profissional para editar. */
  it("admin recebe recusa explícita, não silêncio", async () => {
    const id = await criar("candidato_clt");

    await expect(
      salvarPerfilDoPapel(id, "admin", {
        areaDesejada: null,
        resumo: null,
        formacao: null,
        habilidades: [],
        experiencias: [],
        disponibilidade: null,
        visivelParaEmpresas: false,
      }),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "sem_permissao");
  });
});
