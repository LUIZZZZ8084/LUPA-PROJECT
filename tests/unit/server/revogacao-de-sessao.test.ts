/**
 * @vitest-environment node
 *
 * Trocar a senha derruba as sessões antigas (#225).
 *
 * A sessão continua sendo um JWT fora do banco — a decisão de serverless
 * não mudou. O que entrou foi uma data por pessoa, e a regra de que todo
 * token emitido antes dela deixa de valer.
 *
 * Estes testes cobram as três coisas que decidem se isso funciona ou
 * atrapalha: o corte derruba o token velho, **não** derruba o novo, e a
 * leitura falha aberta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cortes = new Map<string, number>();
let explodir = false;

vi.mock("next/cache", () => ({
  // Sem contexto de requisição não há cache do Next; o que se mede aqui é
  // a regra, e ela não muda por causa da camada de cache.
  unstable_cache: (fn: () => unknown) => fn,
  updateTag: () => {},
}));

vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({
    cortesDeSessao: async () => {
      if (explodir) throw new Error("banco fora do ar");
      return new Map(cortes);
    },
  }),
}));

import { sessaoFoiRevogada } from "@/server/auth/revogacao";
import type { Sessao } from "@/server/auth/session";

const AGORA = Math.floor(Date.now() / 1000);

function sessao(parcial: Partial<Sessao> = {}): Sessao {
  return {
    usuarioId: "u1",
    papel: "candidato_clt",
    expiraEm: AGORA + 1000,
    emitidoEm: AGORA,
    ...parcial,
  };
}

describe("revogação de sessão", () => {
  beforeEach(() => {
    cortes.clear();
    explodir = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sem corte nenhum, toda sessão vale", async () => {
    expect(await sessaoFoiRevogada(sessao())).toBe(false);
  });

  it("token emitido antes do corte cai", async () => {
    cortes.set("u1", AGORA);
    expect(await sessaoFoiRevogada(sessao({ emitidoEm: AGORA - 60 }))).toBe(
      true,
    );
  });

  it("token emitido depois do corte continua valendo", async () => {
    cortes.set("u1", AGORA - 60);
    expect(await sessaoFoiRevogada(sessao({ emitidoEm: AGORA }))).toBe(false);
  });

  /**
   * O caso que decide se a funcionalidade ajuda ou atrapalha.
   *
   * Trocar a senha grava o corte e emite a sessão nova quase no mesmo
   * instante, e os dois são epoch de **segundos**. Com `<=`, a sessão
   * recém-emitida cairia no próprio corte sempre que as duas coisas
   * caíssem no mesmo segundo — a pessoa trocaria a senha e seria
   * deslogada, de forma intermitente e impossível de reproduzir.
   */
  it("a sessão emitida no mesmo segundo do corte sobrevive", async () => {
    cortes.set("u1", AGORA);
    expect(await sessaoFoiRevogada(sessao({ emitidoEm: AGORA }))).toBe(false);
  });

  it("o corte de uma pessoa não derruba a sessão de outra", async () => {
    cortes.set("outra-pessoa", AGORA);
    expect(await sessaoFoiRevogada(sessao({ emitidoEm: AGORA - 600 }))).toBe(
      false,
    );
  });

  /**
   * Falha **aberta**, e é o oposto do webhook de pagamento — de propósito.
   *
   * Lá, deixar passar confirmaria dinheiro que ninguém provou. Aqui,
   * recusar derrubaria **todo mundo** do app por causa de uma consulta que
   * não respondeu. Errar para o lado permissivo custa uma janela a mais
   * numa revogação; errar para o fechado é o app inteiro fora do ar.
   */
  it("banco fora do ar não desloga ninguém", async () => {
    explodir = true;
    cortes.set("u1", AGORA);
    expect(await sessaoFoiRevogada(sessao({ emitidoEm: AGORA - 600 }))).toBe(
      false,
    );
  });
});

/**
 * A lista de cortes, nas duas implementações do repositório.
 *
 * O que se mede aqui é a janela: a lista traz só os últimos `dias`, e é
 * isso que a mantém curta **para sempre** e não só hoje. Token mais velho
 * que a validade da sessão já expirou sozinho, então guardá-lo na lista
 * seria carregar peso morto que cresce com o tempo.
 */
describe("a lista de cortes é curta por construção", () => {
  it("em memória, o corte entra com a troca de senha e sai pela janela", async () => {
    const { RepositorioMemoria } = await import(
      "@/server/repositories/memoria"
    );
    const repo = new RepositorioMemoria();

    const usuario = await repo.criar({
      email: "corte@lupa.test",
      senhaHash: "h",
      papel: "candidato_clt",
      nomeCompleto: "Alguém",
      telefone: "66999110012",
      cidade: "Sinop",
      bairro: null,
    });

    // Nada antes da troca: quem nunca trocou a senha não tem corte.
    expect((await repo.cortesDeSessao(7)).size).toBe(0);

    await repo.atualizarSenhaHash(usuario.id, "novo-hash");

    const cortes = await repo.cortesDeSessao(7);
    expect(cortes.has(usuario.id)).toBe(true);
    expect(cortes.get(usuario.id)).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000),
    );

    /*
     * E oito dias depois ele sai da lista.
     *
     * É isto que mantém a lista curta **para sempre**, e não só hoje: um
     * token com mais de sete dias já expirou sozinho, então carregar o
     * corte dele seria peso morto crescendo com o tempo. O relógio é
     * adiantado de propósito — medir isso com a janela em zero dependeria
     * de dois `Date.now()` caírem em milissegundos diferentes, e teste que
     * depende de corrida é teste que um dia fica vermelho sozinho.
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    expect((await repo.cortesDeSessao(7)).size).toBe(0);
    vi.useRealTimers();
  });
});
