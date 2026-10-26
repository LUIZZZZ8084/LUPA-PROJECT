/**
 * @vitest-environment node
 *
 * A carteira de quem publica vaga (#172, #489).
 *
 * Publicar era de graça e sem limite. O que se protege aqui são as duas
 * pontas dessa mudança: que ninguém publique sem ter pago, e que ninguém
 * pague sem receber — as duas falham em silêncio, e a segunda só aparece
 * quando alguém confere a receita no fim do mês.
 *
 * O caso que mais importa do primeiro bloco é o último: **reativar consome
 * crédito**. Sem isso a cobrança inteira vira teatro — a empresa compra
 * uma vaga e a renova para sempre, que é a vaga fantasma paga uma vez.
 *
 * Com os planos por quantidade (#489), o que se acrescenta é o teto: o plano
 * de 5 deixa cinco vagas no ar ao mesmo tempo, e a sexta só sai se alguém
 * abrir lugar ou pagar uma avulsa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Com o banco "ligado" (para o teste), a empresa da vaga é a da sessão —
// o mapeamento da demonstração para a empresa fixa tem teste próprio.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import {
  RepositorioCarteirasMemoria,
  usarRepositorioCarteiras,
} from "@/server/carteiras";
import {
  creditarVagas,
  debitarVagas,
  devolverCobranca,
  direitoDePublicar,
  estenderPlanoMensal,
  gastarParaPublicar,
  revogarPlanoMensal,
} from "@/server/carteiras/servico";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";

const PESSOA = "empresa-1";

const DADOS = {
  empresaId: PESSOA,
  titulo: "Operador de Máquinas",
  descricao: "Operação de colheitadeira e manutenção básica de rotina.",
  categoria: "Agronegócio",
  cidade: "Sinop - MT",
  endereco: "Av. das Itaúbas, 1200",
  tipoContrato: "CLT",
  modalidade: "presencial" as const,
  paraPcd: false,
};

describe("carteira de vagas", () => {
  let repo: RepositorioCarteirasMemoria;
  let vagas: RepositorioVagasMemoria;
  let usuarios: RepositorioMemoria;
  let restaurar: Array<() => void>;

  beforeEach(() => {
    repo = new RepositorioCarteirasMemoria();
    vagas = new RepositorioVagasMemoria();
    usuarios = new RepositorioMemoria();
    restaurar = [
      usarRepositorioCarteiras(repo),
      usarRepositorioVagas(vagas),
      usarRepositorio(usuarios),
    ];
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const r of restaurar) r();
    vi.restoreAllMocks();
  });

  async function publicadas(quantas: number) {
    const criadas = [];
    for (let i = 0; i < quantas; i += 1) criadas.push(await vagas.criar(DADOS));
    return criadas;
  }

  it("quem nunca comprou nada não pode publicar", async () => {
    const direito = await direitoDePublicar(PESSOA);

    expect(direito.pode).toBe(false);
    expect(direito.creditos).toBe(0);
    expect(direito.mensalAtivo).toBe(false);
  });

  it("comprar crédito libera a publicação", async () => {
    await creditarVagas(PESSOA, 5);

    const direito = await direitoDePublicar(PESSOA);
    expect(direito.pode).toBe(true);
    expect(direito.creditos).toBe(5);
  });

  it("publicar gasta um crédito, e só um", async () => {
    await creditarVagas(PESSOA, 5);

    expect(await gastarParaPublicar(PESSOA)).toBe("credito");

    expect((await direitoDePublicar(PESSOA)).creditos).toBe(4);
  });

  /**
   * O portão. Sem ele, a cobrança não existe de fato — a tela cobraria e
   * o servidor deixaria passar assim mesmo.
   */
  it("sem crédito nenhum, não publica", async () => {
    expect(await gastarParaPublicar(PESSOA)).toBeNull();
  });

  it("gastar o último crédito zera, e o próximo é recusado", async () => {
    await creditarVagas(PESSOA, 1);

    expect(await gastarParaPublicar(PESSOA)).toBe("credito");
    expect(await gastarParaPublicar(PESSOA)).toBeNull();
    expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
  });

  /**
   * Quem paga o ilimitado não conta crédito, e os créditos que já tinha
   * ficam guardados — é o que a tela promete, e promessa na tela é
   * contrato.
   */
  describe("plano ilimitado", () => {
    it("publica sem gastar crédito", async () => {
      await creditarVagas(PESSOA, 3);
      await estenderPlanoMensal(PESSOA, null);

      expect(await gastarParaPublicar(PESSOA)).toBe("plano");

      expect(
        (await direitoDePublicar(PESSOA)).creditos,
        "o plano não pode comer os créditos comprados antes",
      ).toBe(3);
    });

    it("libera mesmo com zero crédito", async () => {
      await estenderPlanoMensal(PESSOA, null);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.pode).toBe(true);
      expect(direito.mensalAtivo).toBe(true);
      expect(direito.limiteNoAr).toBeNull();
      expect(direito.creditos).toBe(0);
    });

    it("não tem teto de vagas no ar", async () => {
      await estenderPlanoMensal(PESSOA, null);
      await publicadas(40);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.planoCheio).toBe(false);
      expect(await gastarParaPublicar(PESSOA)).toBe("plano");
    });

    it("renovar antes de vencer soma ao prazo que já valia", async () => {
      await estenderPlanoMensal(PESSOA, null);
      const primeiro = (await direitoDePublicar(PESSOA)).mensalidadeValidaAte;

      await estenderPlanoMensal(PESSOA, null);
      const segundo = (await direitoDePublicar(PESSOA)).mensalidadeValidaAte;

      expect(new Date(segundo as string).getTime()).toBeGreaterThan(
        new Date(primeiro as string).getTime(),
      );
    });

    it("revogado, volta a depender de crédito", async () => {
      await estenderPlanoMensal(PESSOA, null);
      await revogarPlanoMensal(PESSOA);

      expect((await direitoDePublicar(PESSOA)).pode).toBe(false);
      expect(await gastarParaPublicar(PESSOA)).toBeNull();
    });
  });

  /**
   * O teto dos planos de 5 e 10 (#489).
   *
   * O limite é de vagas **no ar ao mesmo tempo**, não de vagas por mês:
   * encerrar uma abre o lugar na hora. Quem contrata devagar nunca esbarra
   * nele, e quem contrata muito escolhe o plano maior.
   */
  describe("plano com limite de vagas no ar", () => {
    it("publica enquanto couber, sem tirar do saldo", async () => {
      await creditarVagas(PESSOA, 2);
      await estenderPlanoMensal(PESSOA, 5);
      await publicadas(4);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.limiteNoAr).toBe(5);
      expect(direito.noAr).toBe(4);
      expect(direito.planoCheio).toBe(false);

      expect(await gastarParaPublicar(PESSOA)).toBe("plano");
      expect((await direitoDePublicar(PESSOA)).creditos).toBe(2);
    });

    it("com o plano cheio e sem saldo, não publica — e diz que está cheio", async () => {
      await estenderPlanoMensal(PESSOA, 5);
      await publicadas(5);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.planoCheio).toBe(true);
      expect(direito.mensalAtivo).toBe(true);
      expect(direito.pode).toBe(false);

      expect(await gastarParaPublicar(PESSOA)).toBeNull();
    });

    /**
     * O saldo avulso é a válvula de escape do plano cheio: a empresa que
     * tem a sexta vaga paga uma avulsa, em vez de trocar de plano por uma
     * vaga só.
     */
    it("com o plano cheio, a vaga avulsa do saldo ainda publica", async () => {
      await estenderPlanoMensal(PESSOA, 5);
      await creditarVagas(PESSOA, 1);
      await publicadas(5);

      expect((await direitoDePublicar(PESSOA)).pode).toBe(true);
      expect(await gastarParaPublicar(PESSOA)).toBe("credito");
      expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
    });

    it("encerrar uma vaga abre o lugar na hora", async () => {
      await estenderPlanoMensal(PESSOA, 5);
      const criadas = await publicadas(5);
      expect(await gastarParaPublicar(PESSOA)).toBeNull();

      await vagas.encerrar(criadas[0].id);

      expect((await direitoDePublicar(PESSOA)).noAr).toBe(4);
      expect(await gastarParaPublicar(PESSOA)).toBe("plano");
    });

    it("vaga vencida não ocupa lugar", async () => {
      await estenderPlanoMensal(PESSOA, 5);
      const [modelo] = await publicadas(1);
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // `semear` é o único jeito de pôr uma vaga já vencida no repositório
      // em memória: ela só vence com o tempo, e `atualizar` não mexe no prazo.
      const limpo = new RepositorioVagasMemoria();
      restaurar.push(usarRepositorioVagas(limpo));
      limpo.semear([
        { ...modelo, id: "v1" },
        { ...modelo, id: "v2" },
        { ...modelo, id: "v3" },
        { ...modelo, id: "v4" },
        { ...modelo, id: "v5", expiraEm: ontem },
      ]);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.noAr).toBe(4);
      expect(direito.planoCheio).toBe(false);
    });

    it("o limite é só de quem publica: a vaga de outra empresa não conta", async () => {
      await estenderPlanoMensal(PESSOA, 5);
      await vagas.criar({ ...DADOS, empresaId: "empresa-2" });
      await vagas.criar({ ...DADOS, empresaId: "empresa-2" });

      expect((await direitoDePublicar(PESSOA)).noAr).toBe(0);
    });

    it("trocar para um plano maior vale o limite novo na hora", async () => {
      await estenderPlanoMensal(PESSOA, 5);
      await publicadas(5);
      expect((await direitoDePublicar(PESSOA)).planoCheio).toBe(true);

      await estenderPlanoMensal(PESSOA, 10);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.limiteNoAr).toBe(10);
      expect(direito.planoCheio).toBe(false);
    });

    it("plano revogado tira o limite junto", async () => {
      await estenderPlanoMensal(PESSOA, 5);
      await revogarPlanoMensal(PESSOA);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.mensalAtivo).toBe(false);
      expect(direito.limiteNoAr).toBeNull();
      expect((await repo.porUsuario(PESSOA))?.planoVagasNoAr).toBeNull();
    });
  });

  /**
   * A primeira vaga grátis (#489).
   *
   * É o que tira o atrito de quem nunca publicou aqui — mas só para quem
   * tem CNPJ conferido na Receita. A conta de empresa por CPF nasce
   * verificada sem consulta nenhuma, e uma vaga grátis atrás disso seria
   * porta de abuso.
   */
  describe("primeira vaga grátis", () => {
    async function empresaComCnpj(cnpj: string | null, verificada = true) {
      const usuario = await usuarios.criar({
        email: `${Math.random()}@teste.lupa`,
        senhaHash: "hash",
        papel: "empresa",
        nomeCompleto: "Responsável",
        telefone: "66999110001",
        cidade: "Sinop - MT",
      });
      await usuarios.criarPerfilEmpresa({
        usuarioId: usuario.id,
        razaoSocial: "Agro Norte Ltda.",
        cnpj,
        setor: null,
        porte: null,
        site: null,
        instagram: null,
        facebook: null,
        descricao: null,
        logoUrl: null,
        plano: "trial",
      });
      await usuarios.definirDocVerificado(usuario.id, verificada);
      return usuario.id;
    }

    it("empresa com CNPJ conferido ganha a primeira", async () => {
      const id = await empresaComCnpj("11222333000181");

      const direito = await direitoDePublicar(id);
      expect(direito.primeiraGratis).toBe(true);
      expect(direito.pode).toBe(true);
      expect(direito.creditos).toBe(0);
    });

    it("usa a primeira sem tirar nada do saldo, e só uma vez", async () => {
      const id = await empresaComCnpj("11222333000181");
      await creditarVagas(id, 2);

      expect(await gastarParaPublicar(id)).toBe("primeira-gratis");
      expect((await direitoDePublicar(id)).creditos).toBe(2);
      expect((await direitoDePublicar(id)).primeiraGratis).toBe(false);

      // A segunda já sai do saldo.
      expect(await gastarParaPublicar(id)).toBe("credito");
      expect((await direitoDePublicar(id)).creditos).toBe(1);
    });

    it("sem saldo, a segunda é recusada", async () => {
      const id = await empresaComCnpj("11222333000181");

      expect(await gastarParaPublicar(id)).toBe("primeira-gratis");
      expect(await gastarParaPublicar(id)).toBeNull();
    });

    /** CPF é conferido só pelo dígito: qualquer número válido serve. */
    it("conta de empresa por CPF (sem CNPJ) não ganha", async () => {
      const id = await empresaComCnpj(null);

      expect((await direitoDePublicar(id)).primeiraGratis).toBe(false);
      expect(await gastarParaPublicar(id)).toBeNull();
    });

    it("conta não verificada não ganha", async () => {
      const id = await empresaComCnpj("11222333000181", false);

      expect((await direitoDePublicar(id)).primeiraGratis).toBe(false);
    });

    it("prestador que contrata não ganha", async () => {
      const usuario = await usuarios.criar({
        email: "eletricista@teste.lupa",
        senhaHash: "hash",
        papel: "prestador_servico",
        nomeCompleto: "João da Silva",
        telefone: "66999110002",
        cidade: "Sinop - MT",
      });
      await usuarios.definirDocVerificado(usuario.id, true);

      expect((await direitoDePublicar(usuario.id)).primeiraGratis).toBe(false);
    });

    it("quem tem plano com lugar publica pelo plano e guarda a primeira", async () => {
      const id = await empresaComCnpj("11222333000181");
      await estenderPlanoMensal(id, 5);

      expect(await gastarParaPublicar(id)).toBe("plano");
      expect((await direitoDePublicar(id)).primeiraGratis).toBe(true);
    });

    it("dois cliques simultâneos usam a primeira uma vez só", async () => {
      const id = await empresaComCnpj("11222333000181");

      const resultados = await Promise.all([
        gastarParaPublicar(id),
        gastarParaPublicar(id),
        gastarParaPublicar(id),
      ]);

      expect(resultados.filter((r) => r === "primeira-gratis")).toHaveLength(1);
      expect(resultados.filter((r) => r === null)).toHaveLength(2);
    });

    it("devolver a primeira (publicação que falhou) libera para a próxima", async () => {
      const id = await empresaComCnpj("11222333000181");
      expect(await gastarParaPublicar(id)).toBe("primeira-gratis");

      await devolverCobranca(id, "primeira-gratis");

      expect((await direitoDePublicar(id)).primeiraGratis).toBe(true);
    });
  });

  describe("estorno e chargeback", () => {
    it("tira os créditos que sobraram", async () => {
      await creditarVagas(PESSOA, 5);

      await debitarVagas(PESSOA, 5);

      expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
    });

    /**
     * Para em zero, nunca vira dívida.
     *
     * Quem comprou 5, publicou 4 e depois contestou a cobrança fica sem
     * o crédito que sobrou — e as 4 vagas continuam publicadas. Deixar o
     * saldo negativo cobraria da próxima compra dela uma dívida que
     * ninguém explicou.
     */
    it("não deixa o saldo negativo", async () => {
      await creditarVagas(PESSOA, 5);
      for (let i = 0; i < 4; i += 1) await gastarParaPublicar(PESSOA);

      await debitarVagas(PESSOA, 5);

      expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
    });
  });

  /**
   * O que foi cobrado volta quando a publicação falha depois de cobrada.
   *
   * A cobrança vem antes da gravação de propósito — na ordem inversa a
   * vaga entraria no ar de graça se a carteira falhasse. O preço dessa
   * escolha é este caminho de volta.
   */
  describe("devolver a cobrança", () => {
    it("devolve o crédito quando a publicação falha depois de cobrada", async () => {
      await creditarVagas(PESSOA, 1);
      const forma = await gastarParaPublicar(PESSOA);
      expect(forma).toBe("credito");

      await devolverCobranca(PESSOA, "credito");

      expect((await direitoDePublicar(PESSOA)).creditos).toBe(1);
    });

    it("quem publicou pelo plano não ganha crédito ao devolver", async () => {
      await estenderPlanoMensal(PESSOA, null);
      expect(await gastarParaPublicar(PESSOA)).toBe("plano");

      await devolverCobranca(PESSOA, "plano");

      expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
    });
  });
});
