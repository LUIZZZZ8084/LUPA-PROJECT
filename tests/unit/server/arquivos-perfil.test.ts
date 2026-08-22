/**
 * @vitest-environment node
 *
 * Quem pode enviar o quê, e o que acontece quando o Storage não existe.
 *
 * A checagem de papel mora no servidor porque a tela é palpite do cliente:
 * sem ela, um prestador poderia subir currículo — guardando dado pessoal
 * num lugar que a tela dele nunca mostra e que ninguém lembraria de apagar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const armazenamento = vi.hoisted(() => ({
  enviados: [] as { usuarioId: string; especie: string }[],
  removidos: [] as { usuarioId: string; especie: string }[],
  falharEnvio: false,
}));

vi.mock("@/server/arquivos/servico", () => ({
  temArmazenamento: true,
  enviarArquivo: async (usuarioId: string, especie: string) => {
    if (armazenamento.falharEnvio) throw new Error("storage fora do ar");
    armazenamento.enviados.push({ usuarioId, especie });
    return { referencia: `https://exemplo/${especie}/${usuarioId}` };
  },
  removerArquivo: async (usuarioId: string, especie: string) => {
    armazenamento.removidos.push({ usuarioId, especie });
  },
  urlAssinada: async (caminho: string | null) =>
    caminho ? `https://assinada/${caminho}` : null,
}));

const { apagarArquivoDoPerfil, linkDoCurriculo, trocarArquivoDoPerfil } =
  await import("@/server/arquivos/perfil");
const { ehAppError } = await import("@/server/errors");
const { RepositorioMemoria, usarRepositorio } = await import(
  "@/server/repositories"
);

let repo: InstanceType<typeof RepositorioMemoria>;
let restaurar: () => void;

const FOTO = new File(["conteúdo"], "foto.jpg", { type: "image/jpeg" });

async function criar(papel: "candidato_clt" | "prestador_servico" | "empresa") {
  const u = await repo.criar({
    email: `${papel}@teste.lupa`,
    senhaHash: "hash",
    papel,
    nomeCompleto: "Pessoa de Teste",
    telefone: "66999110001",
    cidade: "Sinop",
  });
  return u.id;
}

beforeEach(() => {
  repo = new RepositorioMemoria();
  restaurar = usarRepositorio(repo);
  armazenamento.enviados.length = 0;
  armazenamento.removidos.length = 0;
  armazenamento.falharEnvio = false;
});

afterEach(() => restaurar());

describe("quem pode enviar o quê", () => {
  it("todo mundo pode ter foto", async () => {
    for (const papel of [
      "candidato_clt",
      "prestador_servico",
      "empresa",
    ] as const) {
      const id = await criar(papel);
      await trocarArquivoDoPerfil(id, papel, "avatar", FOTO);
      expect((await repo.porId(id))?.avatarUrl).toContain("avatar");
    }
  });

  /**
   * Currículo é do candidato. Prestador guardando currículo seria dado
   * pessoal num canto que a tela dele nunca mostra.
   */
  it("prestador não envia currículo", async () => {
    const id = await criar("prestador_servico");

    await expect(
      trocarArquivoDoPerfil(id, "prestador_servico", "curriculo", FOTO),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "sem_permissao");

    expect(armazenamento.enviados).toEqual([]);
  });

  it("candidato não envia logo", async () => {
    const id = await criar("candidato_clt");

    await expect(
      trocarArquivoDoPerfil(id, "candidato_clt", "logo", FOTO),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "sem_permissao");
  });

  /** A recusa acontece antes do envio: nada chega ao bucket. */
  it("papel errado não chega a gravar arquivo", async () => {
    const id = await criar("candidato_clt");
    await trocarArquivoDoPerfil(id, "candidato_clt", "logo", FOTO).catch(
      () => {},
    );
    expect(armazenamento.enviados).toEqual([]);
  });
});

describe("ordem entre bucket e banco", () => {
  /**
   * O arquivo vai primeiro. Se o banco falhar depois, sobra um objeto órfão
   * — invisível e substituído no próximo envio, porque o caminho é fixo. Na
   * ordem inversa, o banco apontaria para arquivo inexistente e a tela
   * mostraria imagem quebrada para quem abrisse o perfil.
   */
  it("falha no envio não deixa referência no banco", async () => {
    const id = await criar("candidato_clt");
    armazenamento.falharEnvio = true;

    await expect(
      trocarArquivoDoPerfil(id, "candidato_clt", "avatar", FOTO),
    ).rejects.toThrow();

    expect((await repo.porId(id))?.avatarUrl).toBeNull();
  });

  /** Na remoção a ordem se inverte, pela mesma razão. */
  it("remover limpa a referência e depois o objeto", async () => {
    const id = await criar("candidato_clt");
    await trocarArquivoDoPerfil(id, "candidato_clt", "avatar", FOTO);

    await apagarArquivoDoPerfil(id, "candidato_clt", "avatar");

    expect((await repo.porId(id))?.avatarUrl).toBeNull();
    expect(armazenamento.removidos).toEqual([
      { usuarioId: id, especie: "avatar" },
    ]);
  });
});

describe("currículo", () => {
  it("guarda o caminho e devolve link assinado", async () => {
    const id = await criar("candidato_clt");
    await repo.salvarPerfilCandidato(id, {
      areaDesejada: null,
      resumo: null,
      formacao: null,
      habilidades: [],
      disponibilidade: null,
    });

    await trocarArquivoDoPerfil(id, "candidato_clt", "curriculo", FOTO);

    const caminho = (await repo.perfilCandidato(id))?.curriculoUrl;
    expect(caminho).toBeTruthy();
    expect(await linkDoCurriculo(caminho ?? null)).toContain("assinada");
  });

  it("sem currículo não há link", async () => {
    expect(await linkDoCurriculo(null)).toBeNull();
  });
});

describe("cada espécie grava na sua coluna", () => {
  it("logo vai para o perfil da empresa", async () => {
    const id = await criar("empresa");
    await repo.criarPerfilEmpresa({
      usuarioId: id,
      razaoSocial: "Agro Norte Ltda.",
      cnpj: "11222333000181",
      setor: null,
      porte: null,
      site: null,
      descricao: null,
      logoUrl: null,
      plano: "trial",
    });

    await trocarArquivoDoPerfil(id, "empresa", "logo", FOTO);

    expect((await repo.perfilEmpresa(id))?.logoUrl).toContain("logo");
    // A logo não é a foto da pessoa: são campos diferentes.
    expect((await repo.porId(id))?.avatarUrl).toBeNull();
  });

  it("remover a logo limpa só a logo", async () => {
    const id = await criar("empresa");
    await repo.criarPerfilEmpresa({
      usuarioId: id,
      razaoSocial: "Agro Norte Ltda.",
      cnpj: "11222333000181",
      setor: null,
      porte: null,
      site: null,
      descricao: null,
      logoUrl: null,
      plano: "trial",
    });
    await trocarArquivoDoPerfil(id, "empresa", "logo", FOTO);
    await trocarArquivoDoPerfil(id, "empresa", "avatar", FOTO);

    await apagarArquivoDoPerfil(id, "empresa", "logo");

    expect((await repo.perfilEmpresa(id))?.logoUrl).toBeNull();
    expect((await repo.porId(id))?.avatarUrl).toContain("avatar");
  });

  it("remover o currículo limpa a referência e o objeto", async () => {
    const id = await criar("candidato_clt");
    await repo.salvarPerfilCandidato(id, {
      areaDesejada: null,
      resumo: null,
      formacao: null,
      habilidades: [],
      disponibilidade: null,
    });
    await trocarArquivoDoPerfil(id, "candidato_clt", "curriculo", FOTO);

    await apagarArquivoDoPerfil(id, "candidato_clt", "curriculo");

    expect((await repo.perfilCandidato(id))?.curriculoUrl).toBeNull();
    expect(armazenamento.removidos).toContainEqual({
      usuarioId: id,
      especie: "curriculo",
    });
  });

  /** Remoção com papel errado também é barrada, não só o envio. */
  it("papel errado não apaga arquivo de outro tipo", async () => {
    const id = await criar("candidato_clt");

    await expect(
      apagarArquivoDoPerfil(id, "candidato_clt", "logo"),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "sem_permissao");

    expect(armazenamento.removidos).toEqual([]);
  });
});
