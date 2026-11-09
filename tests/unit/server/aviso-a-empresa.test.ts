/**
 * @vitest-environment node
 *
 * O aviso à empresa quando chega candidatura (#543).
 *
 * O que se prova: sai um e-mail para a empresa dona, com o primeiro nome, o
 * cargo e o link do funil da área dela, e sem contato nenhum; o segundo
 * dentro da janela não sai; e-mail não confirmado não recebe; e a empresa
 * que não é conta (a das vagas de exemplo) é ignorada sem erro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enviados = vi.hoisted(
  () => [] as { para: string; assunto: string; corpo: string; tipo: string }[],
);
const usuarios = vi.hoisted(
  () =>
    new Map<
      string,
      {
        id: string;
        email: string;
        nomeCompleto: string;
        papel: string;
        emailVerificado: boolean;
        telefone: string;
      }
    >(),
);

vi.mock("@/server/email", () => ({
  enviarEmail: async (email: (typeof enviados)[number]) => {
    enviados.push(email);
    return { ok: true };
  },
}));
vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({
    porId: async (id: string) => usuarios.get(id) ?? null,
  }),
}));
vi.mock("@/server/url-publica", () => ({
  urlPublica: () => "https://lupapp.com.br",
}));

import { limparLimites } from "@/server/auth/rate-limit";
import {
  RepositorioCandidaturasMemoria,
  usarRepositorioCandidaturas,
} from "@/server/candidaturas";
import { avisarEmpresaDaCandidatura } from "@/server/candidaturas/aviso-a-empresa";
import type { Candidatura } from "@/server/candidaturas/tipos";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import type { Vaga } from "@/server/vagas/tipos";

const vaga = (id: string, empresaId: string): Vaga => ({
  id,
  empresaId,
  titulo: "Operador de Máquinas",
  descricao: "Operação de colheitadeira.",
  categoria: null,
  cidade: "Sinop - MT",
  bairro: null,
  endereco: null,
  tipoContrato: null,
  modalidade: null,
  paraPcd: false,
  contratanteConfidencial: null,
  salarioMin: null,
  salarioMax: null,
  habilidades: [],
  perguntas: [],
  status: "aberta",
  criadoEm: "2026-11-01T00:00:00.000Z",
  expiraEm: "2026-12-01T00:00:00.000Z",
});

const candidatura = (
  id: string,
  vagaId: string,
  status: Candidatura["status"] = "enviada",
): Candidatura => ({
  id,
  vagaId,
  candidatoId: "cnd-1",
  status,
  criadoEm: "2026-11-02T00:00:00.000Z",
  respostas: null,
});

describe("avisar a empresa da candidatura", () => {
  const restaurar: (() => void)[] = [];

  beforeEach(() => {
    enviados.length = 0;
    usuarios.clear();
    limparLimites();
    usuarios.set("emp-1", {
      id: "emp-1",
      email: "rh@agronorte.exemplo",
      nomeCompleto: "Agro Norte Ltda",
      papel: "empresa",
      emailVerificado: true,
      telefone: "66999990000",
    });
    usuarios.set("prs-1", {
      id: "prs-1",
      email: "joao@exemplo.com",
      nomeCompleto: "João Prestador",
      papel: "prestador_servico",
      emailVerificado: true,
      telefone: "66999990001",
    });
    usuarios.set("emp-sem-confirmar", {
      id: "emp-sem-confirmar",
      email: "outra@exemplo.com",
      nomeCompleto: "Outra",
      papel: "empresa",
      emailVerificado: false,
      telefone: "66999990002",
    });
    usuarios.set("cnd-1", {
      id: "cnd-1",
      email: "maria@exemplo.com",
      nomeCompleto: "Maria da Silva",
      papel: "candidato_clt",
      emailVerificado: true,
      telefone: "66988887777",
    });

    const vagas = new RepositorioVagasMemoria();
    vagas.semear([
      vaga("v1", "emp-1"),
      vaga("v2", "prs-1"),
      vaga("v3", "emp-sem-confirmar"),
      vaga("v4", "empresa-de-exemplo"),
    ]);
    const candidaturas = new RepositorioCandidaturasMemoria();
    candidaturas.semear([
      candidatura("c1", "v1"),
      candidatura("c2", "v1"),
      candidatura("c3", "v1", "visualizada"),
    ]);
    restaurar.push(
      usarRepositorioVagas(vagas),
      usarRepositorioCandidaturas(candidaturas),
    );
  });

  afterEach(() => {
    while (restaurar.length) restaurar.pop()?.();
  });

  it("avisa a empresa com o primeiro nome, o cargo e o link do funil", async () => {
    expect(
      await avisarEmpresaDaCandidatura({ vagaId: "v1", candidatoId: "cnd-1" }),
    ).toBe("enviado");

    expect(enviados).toHaveLength(1);
    const [email] = enviados;
    expect(email.para).toBe("rh@agronorte.exemplo");
    expect(email.tipo).toBe("aviso_candidatura");
    expect(email.assunto).toBe("Nova candidatura para Operador de Máquinas");
    expect(email.corpo).toContain("Maria se candidatou à vaga de Operador");
    expect(email.corpo).toContain("https://lupapp.com.br/empresa/funil");
    // Duas ainda não abertas (c1 e c2); a vista não conta.
    expect(email.corpo).toContain("Você tem 2 candidaturas esperando");
  });

  /**
   * O nome de quem se candidata entra no e-mail com a assinatura da Lupa, e
   * passa pelo mesmo filtro da saudação (#582): só letras, com teto. O que
   * não for nome cai em "Uma pessoa".
   */
  it("nome que não é nome não entra no e-mail", async () => {
    const cnd = usuarios.get("cnd-1");
    if (!cnd) throw new Error("fixture");
    usuarios.set("cnd-1", {
      ...cnd,
      nomeCompleto: "https://exemplo.invalid/pagar Silva",
    });

    await avisarEmpresaDaCandidatura({ vagaId: "v1", candidatoId: "cnd-1" });

    const corpo = enviados[0].corpo;
    expect(corpo).not.toContain("exemplo");
    expect(corpo).toContain("Uma pessoa se candidatou à vaga de Operador");
  });

  it("não leva contato nem sobrenome de quem se candidatou", async () => {
    await avisarEmpresaDaCandidatura({ vagaId: "v1", candidatoId: "cnd-1" });
    const corpo = enviados[0].corpo;
    expect(corpo).not.toContain("da Silva");
    expect(corpo).not.toContain("66988887777");
    expect(corpo).not.toContain("maria@exemplo.com");
  });

  it("o segundo aviso da mesma empresa, dentro da janela, não sai", async () => {
    await avisarEmpresaDaCandidatura({ vagaId: "v1", candidatoId: "cnd-1" });
    expect(
      await avisarEmpresaDaCandidatura({ vagaId: "v1", candidatoId: "cnd-1" }),
    ).toBe("na_janela");
    expect(enviados).toHaveLength(1);
  });

  it("o prestador que contrata recebe o link da área dele", async () => {
    await avisarEmpresaDaCandidatura({ vagaId: "v2", candidatoId: "cnd-1" });
    expect(enviados[0].corpo).toContain(
      "https://lupapp.com.br/contratar/funil",
    );
  });

  it("e-mail não confirmado não recebe", async () => {
    expect(
      await avisarEmpresaDaCandidatura({ vagaId: "v3", candidatoId: "cnd-1" }),
    ).toBe("email_nao_confirmado");
    expect(enviados).toHaveLength(0);
  });

  it("empresa que não é conta, e vaga que não existe, passam sem erro", async () => {
    expect(
      await avisarEmpresaDaCandidatura({ vagaId: "v4", candidatoId: "cnd-1" }),
    ).toBe("sem_empresa");
    expect(
      await avisarEmpresaDaCandidatura({
        vagaId: "nao-existe",
        candidatoId: "cnd-1",
      }),
    ).toBe("sem_empresa");
    expect(enviados).toHaveLength(0);
  });
});
