/**
 * @vitest-environment node
 *
 * Parcerias: quem usa a Lupa de graça por acordo (#505).
 *
 * O que se prova é a regra que importa de verdade: o benefício só entra com
 * o e-mail confirmado (senão quem se cadastrasse antes com o endereço do
 * parceiro o levaria), entra uma vez só por mais que se conceda de novo, e
 * encerrar tira o que a parceria deu sem tirar o que a conta pagou.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Com o banco "ligado", a empresa da carteira é a da sessão, como em produção.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import { ehSemPrazo } from "@/lib/parceria";
import type { Autenticado, Papel } from "@/server/auth/rbac";
import {
  RepositorioCarteirasMemoria,
  repositorioCarteiras,
  usarRepositorioCarteiras,
} from "@/server/carteiras";
import { direitoDePublicar } from "@/server/carteiras/servico";
import { ehAppError } from "@/server/errors";
import {
  RepositorioParceirosMemoria,
  usarRepositorioParceiros,
} from "@/server/parceiros";
import { schemaNovaParceria } from "@/server/parceiros/schemas";
import {
  autorizarParceiro,
  concederBeneficioDeParceiro,
  ehParceiroSemPrazo,
  encerrarParceria,
  listarParceiros,
} from "@/server/parceiros/servico";
import { estenderMensalidade } from "@/server/prestadores/servico";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";

const admin: Autenticado = { usuarioId: "admin-1", papel: "admin" };
const UM_DIA = 24 * 60 * 60 * 1000;

describe("parcerias", () => {
  let usuarios: RepositorioMemoria;
  let restaurar: Array<() => void>;

  beforeEach(() => {
    usuarios = new RepositorioMemoria();
    restaurar = [
      usarRepositorio(usuarios),
      usarRepositorioCarteiras(new RepositorioCarteirasMemoria()),
      usarRepositorioParceiros(new RepositorioParceirosMemoria()),
      usarRepositorioVagas(new RepositorioVagasMemoria()),
    ];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const r of restaurar) r();
    vi.restoreAllMocks();
  });

  async function conta(
    papel: Papel,
    email: string,
    { confirmado = true } = {},
  ): Promise<string> {
    const u = await usuarios.criar({
      email,
      senhaHash: "hash",
      papel,
      nomeCompleto: "Conta de Teste",
      telefone: "66999990000",
      cidade: "Sinop - MT",
    });
    if (papel === "prestador_servico") {
      await usuarios.criarPerfilPrestador({
        usuarioId: u.id,
        categoriaId: 1,
        descricao: "Instalações elétricas.",
        precoInicial: null,
        anosExperiencia: null,
        instagram: null,
        facebook: null,
        cnpj: null,
        cnpjVerificado: false,
        razaoSocial: null,
        mensalidadeValidaAte: null,
      } as never);
    }
    if (papel === "candidato_clt") {
      await usuarios.criarPerfilCandidato({
        usuarioId: u.id,
        areaDesejada: null,
        resumo: null,
        curriculoUrl: null,
        disponibilidade: null,
        formacao: null,
        habilidades: [],
        experiencias: [],
        visivelParaEmpresas: false,
        geradorCurriculoLiberado: false,
      } as never);
    }
    if (confirmado) await usuarios.definirEmailVerificado(u.id);
    return u.id;
  }

  const autorizar = (email: string, validoAte: string | null = null) =>
    autorizarParceiro(admin, { email, nome: "Agro Norte", validoAte });

  async function erroDe(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      if (ehAppError(e)) return e;
      throw e;
    }
    throw new Error("era para recusar");
  }

  it("empresa com e-mail confirmado ganha o plano ilimitado, sem prazo", async () => {
    const id = await conta("empresa", "rh@agronorte.com");

    await autorizar("rh@agronorte.com");

    const direito = await direitoDePublicar(id);
    expect(direito.mensalAtivo).toBe(true);
    expect(direito.limiteNoAr).toBeNull();
    expect(ehSemPrazo(direito.mensalidadeValidaAte)).toBe(true);
  });

  it("prestador ganha a vitrine; candidato, o gerador de currículo", async () => {
    const prestador = await conta("prestador_servico", "eletricista@lupa.com");
    const candidato = await conta("candidato_clt", "maria@lupa.com");

    await autorizar("eletricista@lupa.com");
    await autorizar("maria@lupa.com");

    expect(
      ehSemPrazo(
        (await usuarios.perfilPrestador(prestador))?.mensalidadeValidaAte,
      ),
    ).toBe(true);
    expect(
      (await usuarios.perfilCandidato(candidato))?.geradorCurriculoLiberado,
    ).toBe(true);
  });

  /**
   * O cadastro não confere e-mail (#227). Sem esta trava, quem se
   * cadastrasse antes com o endereço do parceiro levaria o benefício.
   */
  it("e-mail não confirmado não recebe nada; confirmar libera", async () => {
    const id = await conta("empresa", "rh@agronorte.com", {
      confirmado: false,
    });

    await autorizar("rh@agronorte.com");
    expect((await direitoDePublicar(id)).mensalAtivo).toBe(false);
    expect((await listarParceiros(admin))[0].situacao).toBe(
      "email_nao_confirmado",
    );

    await usuarios.definirEmailVerificado(id);
    expect(await concederBeneficioDeParceiro(id)).toBe(true);
    expect((await direitoDePublicar(id)).mensalAtivo).toBe(true);
    expect((await listarParceiros(admin))[0].situacao).toBe("ativa");
  });

  it("a conta criada depois da autorização recebe ao confirmar", async () => {
    await autorizar("novo@lupa.com");
    expect((await listarParceiros(admin))[0].situacao).toBe("sem_conta");

    const id = await conta("empresa", "novo@lupa.com");
    await concederBeneficioDeParceiro(id);

    expect((await direitoDePublicar(id)).mensalAtivo).toBe(true);
  });

  it("conceder de novo não estende de novo", async () => {
    const id = await conta("empresa", "rh@agronorte.com");
    await autorizar("rh@agronorte.com");
    const antes = (await direitoDePublicar(id)).mensalidadeValidaAte;

    await concederBeneficioDeParceiro(id);
    await concederBeneficioDeParceiro(id);

    expect((await direitoDePublicar(id)).mensalidadeValidaAte).toBe(antes);
  });

  it("com prazo, vale até a data e não além", async () => {
    const id = await conta("empresa", "rh@agronorte.com");
    const ate = new Date(Date.now() + 90 * UM_DIA).toISOString();

    await autorizar("rh@agronorte.com", ate);

    const validade = (await direitoDePublicar(id)).mensalidadeValidaAte;
    expect(ehSemPrazo(validade)).toBe(false);
    expect(
      Math.abs(Date.parse(validade ?? "") - Date.parse(ate)),
    ).toBeLessThanOrEqual(UM_DIA);
  });

  /**
   * O caso de produção (#519): a vitrine vitalícia de 2099 (#245) fazia a
   * tela dizer "Parceria Lupa" a quem nunca foi parceiro. Data longe não é
   * parceria; o registro é.
   */
  it("validade em 2099 sem parceria não é parceria", async () => {
    const id = await conta("prestador_servico", "paulinho@lupa.com");
    await usuarios.definirMensalidadeValidaAte(id, "2099-12-31T00:00:00Z");

    expect(
      ehSemPrazo((await usuarios.perfilPrestador(id))?.mensalidadeValidaAte),
    ).toBe(false);
    expect(await ehParceiroSemPrazo(id)).toBe(false);
  });

  it("é parceira sem prazo a conta que recebeu, até a parceria ser encerrada", async () => {
    const id = await conta("empresa", "rh@agronorte.com");
    expect(await ehParceiroSemPrazo(id)).toBe(false);

    const parceria = await autorizar("rh@agronorte.com");
    expect(await ehParceiroSemPrazo(id)).toBe(true);

    await encerrarParceria(admin, parceria.id);
    expect(await ehParceiroSemPrazo(id)).toBe(false);
  });

  it("parceria com prazo não é a sem prazo", async () => {
    const id = await conta("empresa", "rh@agronorte.com");
    await autorizar(
      "rh@agronorte.com",
      new Date(Date.now() + 90 * UM_DIA).toISOString(),
    );

    expect(await ehParceiroSemPrazo(id)).toBe(false);
  });

  it("um e-mail tem uma parceria aberta por vez", async () => {
    await autorizar("rh@agronorte.com");

    const erro = await erroDe(() => autorizar("rh@agronorte.com"));
    expect(erro.codigo).toBe("conflito");
  });

  it("encerrar tira a vitrine e o plano que a parceria deu", async () => {
    const empresa = await conta("empresa", "rh@agronorte.com");
    const prestador = await conta("prestador_servico", "eletricista@lupa.com");
    const p1 = await autorizar("rh@agronorte.com");
    const p2 = await autorizar("eletricista@lupa.com");

    await encerrarParceria(admin, p1.id);
    await encerrarParceria(admin, p2.id);

    expect((await direitoDePublicar(empresa)).mensalAtivo).toBe(false);
    expect(
      (await usuarios.perfilPrestador(prestador))?.mensalidadeValidaAte ?? null,
    ).toBeNull();
    expect(
      (await listarParceiros(admin)).every((l) => l.situacao === "encerrada"),
    ).toBe(true);
  });

  /**
   * Quem pagou além do prazo da parceria pagou por conta própria: encerrar
   * não leva esses dias junto.
   */
  it("encerrar não tira o que a conta pagou além do prazo da parceria", async () => {
    const id = await conta("prestador_servico", "eletricista@lupa.com");
    const ate = new Date(Date.now() + 10 * UM_DIA).toISOString();
    const parceria = await autorizar("eletricista@lupa.com", ate);
    // Uma parcela paga, que estende 30 dias a partir do prazo da parceria.
    await estenderMensalidade(id, 30);

    await encerrarParceria(admin, parceria.id);

    const validade = (await usuarios.perfilPrestador(id))?.mensalidadeValidaAte;
    expect(Date.parse(validade ?? "")).toBeGreaterThan(Date.parse(ate));
  });

  it("depois de encerrada, o e-mail pode ter outra parceria", async () => {
    const parceria = await autorizar("rh@agronorte.com");
    await encerrarParceria(admin, parceria.id);

    await expect(autorizar("rh@agronorte.com")).resolves.toBeTruthy();
  });

  it("parceria vencida não concede nada", async () => {
    const id = await conta("empresa", "rh@agronorte.com", {
      confirmado: false,
    });
    const ontem = new Date(Date.now() + 1000).toISOString();
    await autorizar("rh@agronorte.com", ontem);
    await new Promise((r) => setTimeout(r, 1100));

    await usuarios.definirEmailVerificado(id);
    expect(await concederBeneficioDeParceiro(id)).toBe(false);
    expect((await listarParceiros(admin))[0].situacao).toBe("vencida");
  });

  it("só o admin lista, autoriza e encerra", async () => {
    const empresa: Autenticado = { usuarioId: "e-1", papel: "empresa" };

    expect((await erroDe(() => listarParceiros(empresa))).codigo).toBe(
      "sem_permissao",
    );
    expect(
      (
        await erroDe(() =>
          autorizarParceiro(empresa, {
            email: "x@lupa.com",
            nome: "Eu mesmo",
            validoAte: null,
          }),
        )
      ).codigo,
    ).toBe("sem_permissao");
    expect(
      (await erroDe(() => encerrarParceria(empresa, "qualquer"))).codigo,
    ).toBe("sem_permissao");
  });

  it("a carteira do admin não muda ao autorizar o e-mail de outra pessoa", async () => {
    await conta("empresa", "rh@agronorte.com");
    await autorizar("rh@agronorte.com");

    expect(await repositorioCarteiras().porUsuario(admin.usuarioId)).toBeNull();
  });
});

describe("o formulário da parceria", () => {
  it("sem prazo é o padrão, e o e-mail vira minúsculas", () => {
    const r = schemaNovaParceria.parse({
      email: "  RH@AgroNorte.com ",
      nome: "Agro Norte",
      prazo: "sem_prazo",
    });
    expect(r).toEqual({
      email: "rh@agronorte.com",
      nome: "Agro Norte",
      validoAte: null,
    });
  });

  it("com prazo, a data vale até o fim do dia em Brasília", () => {
    const r = schemaNovaParceria.parse({
      email: "rh@agronorte.com",
      nome: "Agro Norte",
      prazo: "ate_data",
      ate: "2099-12-31",
    });
    expect(r.validoAte).toBe("2100-01-01T02:59:59.000Z");
  });

  it("recusa prazo sem data, ou com data que já passou", () => {
    for (const ate of [undefined, "", "2020-01-01", "31/12/2099"]) {
      const r = schemaNovaParceria.safeParse({
        email: "rh@agronorte.com",
        nome: "Agro Norte",
        prazo: "ate_data",
        ate,
      });
      expect(r.success, String(ate)).toBe(false);
    }
  });
});
