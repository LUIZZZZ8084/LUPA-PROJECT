/**
 * @vitest-environment node
 *
 * Cada desfecho que o Mercado Pago pode mandar, e o que ele muda aqui.
 *
 * O código tratava três — `approved`, `rejected` e `cancelled`, os dois
 * últimos no mesmo ramo — e deixava `refunded` e `charged_back` caírem num
 * "nada muda ainda". O prestador pagava, ganhava 30 dias de vitrine, pedia
 * estorno, e continuava aparecendo com o dinheiro de volta (#166).
 *
 * A pista de que faltava algo estava no próprio schema: `status_pagamento`
 * declarava `estornado` e `cancelado`, e nada no código produzia nenhum dos
 * dois. Estado declarado sem produtor é a mesma armadilha do
 * `pedidos_verificacao` sem tela de envio — parece tratado e não é.
 *
 * O `fetch` é injetado: nada aqui fala com o Mercado Pago.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const estender = vi.fn(async (_usuarioId: string) => {});
const revogar = vi.fn(async (_usuarioId: string) => {});

vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: (...args: [string]) => estender(...args),
  revogarMensalidade: (...args: [string]) => revogar(...args),
}));

import type { Autenticado } from "@/server/auth/rbac";
import {
  RepositorioPagamentosMemoria,
  usarRepositorioPagamentos,
} from "@/server/pagamentos";
import { assinar, confirmarPagamento } from "@/server/pagamentos/servico";

const sessao: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};

/**
 * A resposta de `/v1/payments/{id}`, com o status que se quer exercitar.
 *
 * O `id` é parametrizável porque o `mp_payment_id` é único: um teste que
 * exercite duas cobranças diferentes precisa de dois ids, senão a segunda
 * é lida como notificação repetida da primeira e não muda nada — que é
 * justamente a idempotência funcionando, mas medindo a coisa errada.
 */
function receita(status: string, referencia: string, id = 987) {
  return (async () =>
    new Response(
      JSON.stringify({ id, status, external_reference: referencia }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
}

describe("desfechos de pagamento", () => {
  let repo: RepositorioPagamentosMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioPagamentosMemoria();
    restaurar = usarRepositorioPagamentos(repo);
    estender.mockClear();
    revogar.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  /** Cria uma cobrança já aprovada — o ponto de partida de um estorno. */
  async function cobrancaAprovada() {
    // Em demonstração, `assinar` já devolve a primeira parcela aprovada.
    const { pagamento } = await assinar(sessao, "prestador_mensalidade");
    if (!pagamento) throw new Error("esperava a primeira parcela aprovada");
    estender.mockClear();
    return pagamento;
  }

  /**
   * Estorno e chargeback tiram a mensalidade **na hora**.
   *
   * Decisão do Luiz em 08/09/2026, escolhendo entre isso e encurtar até a
   * data do estorno. O caso que manda é o chargeback fraudulento: quem
   * contesta a cobrança e continua anunciando fica com o serviço de graça.
   */
  it.each([
    ["refunded", "estornado"],
    ["charged_back", "contestado"],
  ])("%s revoga a mensalidade e grava %s", async (status, gravado) => {
    const pagamento = await cobrancaAprovada();

    await confirmarPagamento("987", receita(status, pagamento.id));

    expect(revogar).toHaveBeenCalledWith(sessao.usuarioId);
    expect((await repo.porId(pagamento.id))?.status).toBe(gravado);
  });

  /**
   * O efeito é o mesmo; o registro não (#179).
   *
   * Os dois desfechos tiram a mensalidade na hora, e foi por isso que os
   * dois viveram no mesmo `estornado` até 10/09/2026. Mas o efeito é o que
   * eles têm em comum, não o que eles são: `charged_back` é o cliente
   * abrindo disputa no cartão — custa taxa do Mercado Pago, é sinal de
   * fraude e dá para contestar de volta.
   *
   * Este teste é o que impede a volta do atalho: a distinção existe só no
   * corpo do webhook e, uma vez gravada como "saiu dinheiro", não há como
   * recuperar qual saída foi qual.
   */
  it("devolução e contestação não viram o mesmo registro", async () => {
    const devolvido = await cobrancaAprovada();
    await confirmarPagamento("987", receita("refunded", devolvido.id));

    const contestado = await cobrancaAprovada();
    await confirmarPagamento(
      "988",
      receita("charged_back", contestado.id, 988),
    );

    expect((await repo.porId(devolvido.id))?.status).toBe("estornado");
    expect((await repo.porId(contestado.id))?.status).toBe("contestado");
  });

  /**
   * O Mercado Pago reenvia notificação. Revogar duas vezes não faria mal
   * hoje, mas a guarda é a mesma que impede a aprovação de estender 60
   * dias — e ela só vale se `estornar` for condicional de verdade.
   */
  it("estorno repetido não revoga duas vezes", async () => {
    const pagamento = await cobrancaAprovada();
    const resposta = receita("refunded", pagamento.id);

    await confirmarPagamento("987", resposta);
    await confirmarPagamento("987", resposta);

    expect(revogar).toHaveBeenCalledTimes(1);
  });

  /**
   * `cancelled` é o comprador desistindo antes de pagar, e agora tem
   * estado próprio. Antes virava `rejeitado`, e `cancelado` era um valor
   * do enum que nada produzia.
   */
  it("cancelled grava cancelado, não rejeitado", async () => {
    const { pagamento } = await criarCobrancaPendente();

    await confirmarPagamento("987", receita("cancelled", pagamento.id));

    expect((await repo.porId(pagamento.id))?.status).toBe("cancelado");
  });

  it("rejected continua gravando rejeitado", async () => {
    const { pagamento } = await criarCobrancaPendente();

    await confirmarPagamento("987", receita("rejected", pagamento.id));

    expect((await repo.porId(pagamento.id))?.status).toBe("rejeitado");
    expect(estender).not.toHaveBeenCalled();
  });

  /** Estado intermediário não decide nada — o Mercado Pago manda outro aviso. */
  it.each(["pending", "in_process", "authorized"])(
    "%s não muda nada",
    async (status) => {
      const { pagamento } = await criarCobrancaPendente();

      await confirmarPagamento("987", receita(status, pagamento.id));

      expect((await repo.porId(pagamento.id))?.status).toBe("pendente");
      expect(estender).not.toHaveBeenCalled();
      expect(revogar).not.toHaveBeenCalled();
    },
  );

  /**
   * Estornar o que nunca foi aprovado não desfaz efeito nenhum — não
   * houve efeito. A guarda parte de `aprovado`, e uma cobrança pendente
   * não casa.
   */
  it("estorno de cobrança nunca aprovada não revoga", async () => {
    const { pagamento } = await criarCobrancaPendente();

    await confirmarPagamento("987", receita("refunded", pagamento.id));

    expect(revogar).not.toHaveBeenCalled();
    expect((await repo.porId(pagamento.id))?.status).toBe("pendente");
  });

  /**
   * Uma cobrança pendente, sem passar por `assinar` — que em
   * demonstração aprova na hora.
   */
  async function criarCobrancaPendente() {
    const pagamento = await repo.criar({
      usuarioId: sessao.usuarioId,
      tipo: "prestador_mensalidade",
      valorCentavos: 1990,
    });
    return { pagamento };
  }
});
