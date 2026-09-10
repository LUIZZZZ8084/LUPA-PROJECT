/**
 * @vitest-environment node
 *
 * `gerarCurriculoDoCandidato` faz as duas perguntas antes de gastar
 * trabalho montando um PDF: o papel pode chegar aqui
 * (`candidato:gerar_curriculo`) e já pagou (`geradorCurriculoLiberado`).
 * As duas precisam ser verdadeiras — sem a primeira, outro papel geraria
 * currículo de graça pelo id certo; sem a segunda, todo candidato geraria
 * sem nunca ter comprado.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import {
  geradorCurriculoLiberado,
  gerarCurriculoDoCandidato,
} from "@/server/curriculo/servico";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

describe("gerarCurriculoDoCandidato", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;
  let candidatoId: string;
  let prestadorId: string;

  beforeEach(async () => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);

    const candidato = await repo.criar({
      email: "candidato@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Candidato de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    await repo.criarPerfilCandidato({
      usuarioId: candidato.id,
      areaDesejada: "Agronegócio",
      resumo: "Um resumo qualquer.",
      curriculoUrl: null,
      disponibilidade: null,
      formacao: null,
      habilidades: [],
      visivelParaEmpresas: false,
      geradorCurriculoLiberado: false,
    });
    candidatoId = candidato.id;

    const prestador = await repo.criar({
      email: "prestador@teste.lupa",
      senhaHash: "hash",
      papel: "prestador_servico",
      nomeCompleto: "Prestador de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    prestadorId = prestador.id;
  });

  afterEach(() => {
    restaurar();
  });

  it("recusa sem sessão", async () => {
    await expect(gerarCurriculoDoCandidato(null)).rejects.toMatchObject({
      codigo: "nao_autenticado",
    });
  });

  it("recusa quem não é candidato", async () => {
    const sessao: Autenticado = {
      usuarioId: prestadorId,
      papel: "prestador_servico",
    };
    await expect(gerarCurriculoDoCandidato(sessao)).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });

  it("recusa candidato que ainda não comprou", async () => {
    const sessao: Autenticado = {
      usuarioId: candidatoId,
      papel: "candidato_clt",
    };
    await expect(gerarCurriculoDoCandidato(sessao)).rejects.toMatchObject({
      codigo: "sem_permissao",
    });
  });

  it("gera o PDF de quem já comprou", async () => {
    await repo.definirGeradorCurriculoLiberado(candidatoId, true);
    const sessao: Autenticado = {
      usuarioId: candidatoId,
      papel: "candidato_clt",
    };

    const pdf = await gerarCurriculoDoCandidato(sessao);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

describe("geradorCurriculoLiberado", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;
  let candidatoId: string;

  beforeEach(async () => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);

    const candidato = await repo.criar({
      email: "candidato2@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Candidato de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    await repo.criarPerfilCandidato({
      usuarioId: candidato.id,
      areaDesejada: null,
      resumo: null,
      curriculoUrl: null,
      disponibilidade: null,
      formacao: null,
      habilidades: [],
      visivelParaEmpresas: false,
      geradorCurriculoLiberado: false,
    });
    candidatoId = candidato.id;
  });

  afterEach(() => {
    restaurar();
  });

  it("falso sem sessão", async () => {
    expect(await geradorCurriculoLiberado(null)).toBe(false);
  });

  it("falso antes de comprar, verdadeiro depois", async () => {
    const sessao: Autenticado = {
      usuarioId: candidatoId,
      papel: "candidato_clt",
    };
    expect(await geradorCurriculoLiberado(sessao)).toBe(false);

    await repo.definirGeradorCurriculoLiberado(candidatoId, true);
    expect(await geradorCurriculoLiberado(sessao)).toBe(true);
  });
});
