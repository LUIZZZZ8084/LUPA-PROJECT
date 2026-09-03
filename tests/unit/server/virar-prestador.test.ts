/**
 * @vitest-environment node
 *
 * Virar prestador, com o que a troca custa.
 *
 * O que se protege aqui não é a gravação — é a decisão: quem pode ativar,
 * o que é exigido antes, e o fato de que o papel muda de verdade. A troca
 * tira `candidatura:criar` das mãos de alguém; um teste que só conferisse
 * "gravou o perfil" passaria verde com a pessoa continuando candidata.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import { pode } from "@/server/auth/rbac";
import { ehAppError } from "@/server/errors";
import { virarPrestador } from "@/server/prestadores/servico";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

/** Válido pelo dígito verificador — os testes precisam passar por ele. */
const CPF_VALIDO = "52998224725";
const OUTRO_CPF_VALIDO = "16899535009";

const DADOS = {
  cpf: CPF_VALIDO,
  categoriaId: 1,
  descricao: "Instalações elétricas residenciais e comerciais em Sinop.",
  precoInicial: 150,
};

const COM_STORAGE = { temArmazenamento: true };
const SEM_STORAGE = { temArmazenamento: false };

describe("virar prestador", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;

  async function criarCandidato(avatarUrl: string | null = null) {
    const usuario = await repo.criar({
      email: `c${Math.random()}@teste.lupa`,
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Pessoa de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
      bairro: "Centro",
      avatarUrl,
    });

    const sessao: Autenticado = {
      usuarioId: usuario.id,
      papel: "candidato_clt",
    };
    return { usuario, sessao };
  }

  beforeEach(() => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  it("troca o papel no banco, não só cria o perfil", async () => {
    const { usuario, sessao } = await criarCandidato("/foto.png");

    await virarPrestador(sessao, DADOS, COM_STORAGE);

    const depois = await repo.porId(usuario.id);
    expect(depois?.papel).toBe("prestador_servico");
  });

  /**
   * CPF válido e único é a própria verificação, sem fila e sem foto.
   *
   * A tela chegou a prometer "envie documento e selfie", e esse envio
   * nunca existiu no app — nenhuma tela tinha campo de arquivo para isso,
   * e nada além do seed escrevia em `pedidos_verificacao`. Fora da
   * demonstração, todo prestador ficava preso atrás de uma promessa que a
   * tela não cumpria. Este teste é o que impede a volta desse estado: a
   * ativação precisa deixar a conta pronta para a busca, na mesma ação.
   */
  it("confirma o documento na mesma ação que ativa, sem fila", async () => {
    const { usuario, sessao } = await criarCandidato("/foto.png");

    expect((await repo.porId(usuario.id))?.docVerificado).toBe(false);

    await virarPrestador(sessao, DADOS, COM_STORAGE);

    expect((await repo.porId(usuario.id))?.docVerificado).toBe(true);
  });

  /**
   * O ponto da decisão do Luiz: a pessoa perde o que a tela avisou que ia
   * perder — nem mais, nem menos.
   */
  it("quem virou prestador não se candidata mais, mas ainda vê o histórico", () => {
    expect(pode("prestador_servico", "candidatura:criar")).toBe(false);
    expect(pode("prestador_servico", "candidatura:ver_propria")).toBe(true);
  });

  /**
   * O documento fica em `usuarios`, e não no perfil de prestador.
   *
   * `perfis_prestador` tem policy `using (true)` e `grant select` para
   * `anon` — a chave que vai para o navegador. CPF ali seria CPF
   * publicado. Este teste é o que impede alguém de "arrumar" isso movendo
   * o campo para o lugar simétrico ao CNPJ.
   */
  it("grava o CPF no usuário, só em dígitos, e não no perfil público", async () => {
    const { usuario, sessao } = await criarCandidato("/foto.png");

    await virarPrestador(
      sessao,
      { ...DADOS, cpf: "529.982.247-25" },
      COM_STORAGE,
    );

    expect((await repo.porId(usuario.id))?.cpf).toBe(CPF_VALIDO);

    const perfil = await repo.perfilPrestador(usuario.id);
    expect(Object.keys(perfil ?? {})).not.toContain("cpf");
  });

  it("nasce atendendo o próprio bairro", async () => {
    const { usuario, sessao } = await criarCandidato("/foto.png");

    await virarPrestador(sessao, DADOS, COM_STORAGE);

    const perfil = await repo.perfilPrestador(usuario.id);
    expect(perfil?.bairrosAtendidos).toEqual(["Centro"]);
  });

  it("recusa CPF já usado por outro prestador", async () => {
    const primeiro = await criarCandidato("/foto.png");
    await virarPrestador(primeiro.sessao, DADOS, COM_STORAGE);

    const segundo = await criarCandidato("/foto.png");
    await expect(
      virarPrestador(segundo.sessao, DADOS, COM_STORAGE),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.campos?.[0]?.campo === "cpf");
  });

  it("recusa CPF com dígito verificador errado", async () => {
    const { sessao } = await criarCandidato("/foto.png");

    await expect(
      virarPrestador(sessao, { ...DADOS, cpf: "11111111111" }, COM_STORAGE),
    ).rejects.toSatisfy((e) => ehAppError(e));
  });

  it("recusa categoria fora da lista", async () => {
    const { sessao } = await criarCandidato("/foto.png");

    await expect(
      virarPrestador(sessao, { ...DADOS, categoriaId: 999 }, COM_STORAGE),
    ).rejects.toSatisfy(
      (e) => ehAppError(e) && e.campos?.[0]?.campo === "categoriaId",
    );
  });

  /* ---------- Foto de perfil ---------- */

  it("exige foto onde existe Storage", async () => {
    const { sessao } = await criarCandidato(null);

    await expect(virarPrestador(sessao, DADOS, COM_STORAGE)).rejects.toSatisfy(
      (e) => ehAppError(e) && e.campos?.[0]?.campo === "foto",
    );
  });

  /**
   * Sem Storage não há como enviar foto nenhuma. Exigir ali trancaria o
   * fluxo para quem está conhecendo o produto — e para a suíte e2e, que
   * roda sempre em demonstração.
   */
  it("não exige foto onde não há Storage", async () => {
    const { usuario, sessao } = await criarCandidato(null);

    await virarPrestador(sessao, DADOS, SEM_STORAGE);

    expect((await repo.porId(usuario.id))?.papel).toBe("prestador_servico");
  });

  /* ---------- Quem não pode ---------- */

  it.each([
    ["prestador_servico", "prestador-1"],
    ["empresa", "empresa-1"],
    ["admin", "admin-1"],
  ] as const)("recusa %s", async (papel, usuarioId) => {
    await expect(
      virarPrestador(
        { usuarioId, papel },
        { ...DADOS, cpf: OUTRO_CPF_VALIDO },
        SEM_STORAGE,
      ),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "sem_permissao");
  });

  it("recusa sem sessão", async () => {
    await expect(virarPrestador(null, DADOS, SEM_STORAGE)).rejects.toSatisfy(
      (e) => ehAppError(e) && e.codigo === "nao_autenticado",
    );
  });
});
