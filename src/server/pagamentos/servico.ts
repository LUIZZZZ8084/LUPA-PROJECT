import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Autenticado } from "../auth/rbac";
import {
  creditarVagas,
  debitarVagas,
  estenderPlanoMensal,
  revogarPlanoMensal,
} from "../carteiras/servico";
import { erros } from "../errors";
import { log } from "../logger";
import {
  estenderMensalidade,
  revogarMensalidade,
} from "../prestadores/servico";
import { repositorioUsuarios } from "../repositories";
import { repositorioPagamentos } from "./index";
import {
  cancelarAssinaturaNoMercadoPago,
  consultarAssinatura,
  consultarPagamento,
  consultarParcelaDaAssinatura,
  criarAssinaturaRecorrente,
  criarPreferencia,
  temMercadoPagoConfigurado,
} from "./mercadopago";
import {
  CREDITOS_POR_COMPRA,
  DESCRICAO_PAGAMENTO,
  diasDeTeste,
  ehRecorrente,
  PRECO_CENTAVOS,
} from "./planos";
import type {
  Assinatura,
  Pagamento,
  StatusAssinatura,
  TipoPagamento,
} from "./tipos";

export { temMercadoPagoConfigurado };

function urlBase(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Aplica o que um pagamento aprovado muda no resto do app.
 *
 * Cada domínio conhece a própria regra — `pagamentos` só aciona; é o
 * mesmo raciocínio de camada do resto do servidor: quem decide como a
 * mensalidade se estende é `src/server/prestadores/servico.ts`, não este
 * arquivo.
 */
async function aplicarEfeito(pagamento: Pagamento): Promise<void> {
  switch (pagamento.tipo) {
    case "prestador_mensalidade":
      await estenderMensalidade(pagamento.usuarioId);
      return;

    /*
     * As três compras únicas de vaga viram crédito, e a quantidade sai de
     * `CREDITOS_POR_COMPRA` — nunca de um número escrito aqui. Preço e
     * quantidade moram no mesmo arquivo de propósito: é lá que se
     * confere se "5 vagas por R$ 100" continua sendo cinco.
     */
    case "empresa_vaga_avulsa":
    case "empresa_pacote_5":
    case "empresa_pacote_15":
      await creditarVagas(
        pagamento.usuarioId,
        CREDITOS_POR_COMPRA[pagamento.tipo] ?? 0,
      );
      return;

    case "empresa_mensal":
      await estenderPlanoMensal(pagamento.usuarioId);
      return;

    default: {
      // Exaustividade: se `TipoPagamento` ganhar um novo valor sem que
      // este switch seja atualizado, o build quebra aqui — não em
      // produção, com uma cobrança aprovada e nenhum efeito aplicado.
      const _exaustivo: never = pagamento.tipo;
      throw erros.interno(`tipo de pagamento sem efeito: ${_exaustivo}`);
    }
  }
}

/**
 * Desfaz o que um pagamento aprovado tinha mudado.
 *
 * Espelha `aplicarEfeito`, e com o mesmo `switch` exaustivo pelo mesmo
 * motivo: um `TipoPagamento` novo que ganhe efeito e não ganhe reversão
 * quebra o build aqui, e não em produção com um estorno sem consequência.
 */
async function desfazerEfeitoDoTipo(
  tipo: TipoPagamento,
  usuarioId: string,
): Promise<void> {
  switch (tipo) {
    case "prestador_mensalidade":
      await revogarMensalidade(usuarioId);
      return;

    /*
     * Estorno de pacote tira os créditos que sobraram, e para em zero.
     * A vaga que já foi publicada continua publicada: desfazer aquilo
     * seria apagar o anúncio de uma empresa que talvez já esteja
     * recebendo currículo, por uma contestação que ela pode nem ter
     * feito. O que se recupera é o que ainda não foi usado.
     */
    case "empresa_vaga_avulsa":
    case "empresa_pacote_5":
    case "empresa_pacote_15":
      await debitarVagas(usuarioId, CREDITOS_POR_COMPRA[tipo] ?? 0);
      return;

    case "empresa_mensal":
      await revogarPlanoMensal(usuarioId);
      return;

    default: {
      const _exaustivo: never = tipo;
      throw erros.interno(`tipo de pagamento sem reversão: ${_exaustivo}`);
    }
  }
}

/**
 * A mesma reversão, a partir de uma cobrança — o caso do estorno e do
 * chargeback, que chegam apontando para o pagamento e não para a
 * assinatura.
 */
async function desfazerEfeito(pagamento: Pagamento): Promise<void> {
  await desfazerEfeitoDoTipo(pagamento.tipo, pagamento.usuarioId);
}

// ── Assinar ───────────────────────────────────────────────────────────────

export interface AssinaturaIniciada {
  assinatura: Assinatura;
  /**
   * `null` fora do modo demonstração: a primeira cobrança só existe depois
   * de a pessoa autorizar no Mercado Pago, e é ele quem avisa.
   */
  pagamento: Pagamento | null;
  /**
   * Para onde mandar quem está assinando. `null` em modo demonstração — a
   * assinatura já nasce ativa e a primeira cobrança já foi aplicada.
   */
  checkoutUrl: string | null;
}

/**
 * Cria (ou retoma) a assinatura recorrente da pessoa.
 *
 * A cobrança deixou de ser avulsa em 09/09/2026 (#170): o modelo antigo
 * cobrava uma vez, dava 30 dias, e no dia 31 o perfil sumia da vitrine
 * sem cobrança nova e sem aviso. Agora o Mercado Pago guarda uma
 * autorização (`preapproval`) e cobra sozinho todo mês.
 *
 * **Clicar duas vezes não cria duas assinaturas.** Quem já tem uma
 * `pendente` volta para o mesmo checkout: um `preapproval` novo a cada
 * clique deixaria autorizações órfãs no Mercado Pago, e duas autorizadas
 * seriam duas cobranças por mês na mesma pessoa — o tipo de erro que só
 * aparece na fatura de quem pagou.
 *
 * Sem `MERCADO_PAGO_ACCESS_TOKEN` **e** sem Supabase, a assinatura nasce
 * ativa com a primeira cobrança já aprovada — é o que mantém a suíte e2e
 * (sempre em demonstração) e o `npm run dev` sem credencial exercitando o
 * fluxo inteiro, do clique ao efeito. Com banco de verdade e sem token,
 * recusa: o porquê está no comentário do próprio ramo.
 */
export async function assinar(
  sessao: Autenticado | null,
  tipo: TipoPagamento,
  opcoes: { buscar?: typeof fetch } = {},
): Promise<AssinaturaIniciada> {
  if (!sessao) throw erros.naoAutenticado("sem sessão");

  /*
   * Demonstração é a ausência de infraestrutura inteira, não a de uma
   * credencial.
   *
   * O precedente do Supabase não vale aqui, e a diferença é o modo de
   * falha. Sem Supabase, o app inteiro roda com dados de Sinop e ninguém
   * confunde aquilo com produção. Sem o token do Mercado Pago numa
   * instalação que **tem** Supabase, o que acontece é outra coisa: conta
   * real, prestador real, e a mensalidade aprovada de graça — com um
   * `log.info` dizendo "modo demonstração" e nada na tela. O modo de
   * falha seria "todo mundo passa", que é o pior de todos numa cobrança.
   */
  if (!temMercadoPagoConfigurado && isSupabaseConfigured) {
    throw erros.indisponivel(
      "MERCADO_PAGO_ACCESS_TOKEN ausente em ambiente com banco real",
    );
  }

  const repo = repositorioPagamentos();
  const viva = await repo.assinaturaViva(sessao.usuarioId, tipo);

  if (viva?.status === "ativa") {
    throw erros.validacao([
      {
        campo: "assinatura",
        mensagem: "A sua assinatura já está ativa e renova sozinha.",
      },
    ]);
  }

  // Autorização que a pessoa começou e não terminou: mesmo checkout.
  if (viva?.status === "pendente" && viva.checkoutUrl) {
    return { assinatura: viva, pagamento: null, checkoutUrl: viva.checkoutUrl };
  }

  /*
   * Suspensa pelo Mercado Pago — cartão recusado, quase sempre. Não há
   * como religar sem um meio de pagamento novo, então a saída é encerrar
   * esta e abrir outra. Encerrar antes é o que impede a pessoa de ficar
   * com duas autorizações no Mercado Pago e ser cobrada duas vezes.
   */
  if (viva?.status === "pausada") {
    const encerrada = await encerrarNoMercadoPago(viva, opcoes.buscar);
    if (!encerrada.ok) {
      /*
       * Não deu para encerrar a antiga, então não se abre outra. É a
       * mesma ordem de `pedirEstorno`: primeiro para a obrigação que já
       * existe, depois cria a nova. Seguir aqui deixaria duas
       * autorizações no Mercado Pago — e a suspensa pode voltar a
       * cobrar.
       */
      throw erros.indisponivel(encerrada.motivo);
    }
    await repo.definirStatusAssinatura(viva.id, "cancelada");
  }

  const assinatura = await repo.criarAssinatura({
    usuarioId: sessao.usuarioId,
    tipo,
    valorCentavos: PRECO_CENTAVOS[tipo],
  });

  if (!temMercadoPagoConfigurado) {
    /*
     * O valor devolvido é o da gravação, não o `assinatura` de cima com
     * um `status` remendado à mão: aquela variável foi lida antes desta
     * escrita e continuaria dizendo "pendente". É a armadilha que o
     * `cadastrar()` da #142 já registrou — a conta nascia verificada e a
     * resposta da própria função mentia sobre isso por uma requisição.
     */
    const ativa = await repo.definirStatusAssinatura(assinatura.id, "ativa");

    const pagamento = await repo.criar({
      usuarioId: sessao.usuarioId,
      tipo,
      valorCentavos: PRECO_CENTAVOS[tipo],
      assinaturaId: assinatura.id,
    });
    // Só nasceu, então está "pendente" — `aprovar` não devolve null aqui.
    const aprovado = await repo.aprovar(pagamento.id, null);
    if (aprovado) await aplicarEfeito(aprovado);

    log.info("assinatura ativada em modo demonstração", {
      acao: "pagamentos.assinar",
      tipo,
    });

    return {
      assinatura: ativa ?? assinatura,
      pagamento: aprovado ?? pagamento,
      checkoutUrl: null,
    };
  }

  /*
   * O Mercado Pago exige o e-mail de quem vai pagar para criar o
   * `preapproval` — a cobrança avulsa nunca precisou, porque lá quem
   * digitava o e-mail era a própria pessoa, no checkout.
   */
  const usuario = await repositorioUsuarios().porId(sessao.usuarioId);
  if (!usuario) throw erros.naoEncontrado("Usuário");

  const resultado = await criarAssinaturaRecorrente(
    {
      titulo: DESCRICAO_PAGAMENTO[tipo],
      valorCentavos: assinatura.valorCentavos,
      referenciaExterna: assinatura.id,
      emailPagador: usuario.email,
      urlRetorno: `${urlBase()}/pagamento/retorno?assinatura=${assinatura.id}`,
      diasTeste: diasDeTeste(tipo),
    },
    opcoes.buscar,
  );

  if (!resultado.ok) {
    log.warn("falha ao criar assinatura no Mercado Pago", {
      acao: "pagamentos.assinar",
      tipo,
      motivo: resultado.motivo,
      detalhe: resultado.detalhe,
    });
    throw erros.indisponivel(resultado.motivo);
  }

  const vinculada = await repo.vincularAssinaturaAoMercadoPago(assinatura.id, {
    mpPreapprovalId: resultado.assinatura.id,
    checkoutUrl: resultado.assinatura.initPoint,
  });

  log.info("assinatura criada no Mercado Pago", {
    acao: "pagamentos.assinar",
    tipo,
  });

  return {
    assinatura: vinculada,
    pagamento: null,
    checkoutUrl: resultado.assinatura.initPoint,
  };
}

// ── Comprar uma vez ───────────────────────────────────────────────────────

export interface CompraIniciada {
  pagamento: Pagamento;
  /** `null` em modo demonstração — a compra já nasce aprovada. */
  checkoutUrl: string | null;
}

/**
 * Uma compra que acontece uma vez e acabou — vaga avulsa e os pacotes
 * (#172).
 *
 * É o oposto de `assinar`: aqui não há autorização guardada nem cobrança
 * futura, e por isso não há teste grátis. O que a pessoa compra é
 * crédito, e crédito não expira — o efeito é aplicado quando o Mercado
 * Pago confirma, pelo mesmo `aplicarEfeito` da recorrência.
 *
 * **Recusa tipo recorrente**, em vez de fazer a coisa errada em silêncio:
 * `empresa_mensal` e `prestador_mensalidade` passam por `assinar`, e
 * mandar um deles por aqui criaria uma cobrança única que ninguém
 * renovaria — a pessoa pagaria um mês achando que assinou.
 */
export async function comprar(
  sessao: Autenticado | null,
  tipo: TipoPagamento,
  opcoes: { buscar?: typeof fetch } = {},
): Promise<CompraIniciada> {
  if (!sessao) throw erros.naoAutenticado("sem sessão");

  if (ehRecorrente(tipo)) {
    throw erros.interno(`${tipo} é assinatura — use assinar()`);
  }

  // Mesma razão de `assinar`: com banco de verdade e sem token, isto é
  // configuração faltando, e "todo mundo passa" é o pior modo de falha
  // possível numa cobrança.
  if (!temMercadoPagoConfigurado && isSupabaseConfigured) {
    throw erros.indisponivel(
      "MERCADO_PAGO_ACCESS_TOKEN ausente em ambiente com banco real",
    );
  }

  const repo = repositorioPagamentos();
  const pagamento = await repo.criar({
    usuarioId: sessao.usuarioId,
    tipo,
    valorCentavos: PRECO_CENTAVOS[tipo],
  });

  if (!temMercadoPagoConfigurado) {
    // Só nasceu, então está "pendente" — `aprovar` não devolve null aqui.
    const aprovado = await repo.aprovar(pagamento.id, null);
    if (aprovado) await aplicarEfeito(aprovado);

    log.info("compra aprovada em modo demonstração", {
      acao: "pagamentos.comprar",
      tipo,
    });

    return { pagamento: aprovado ?? pagamento, checkoutUrl: null };
  }

  const resultado = await criarPreferencia(
    {
      titulo: DESCRICAO_PAGAMENTO[tipo],
      valorCentavos: pagamento.valorCentavos,
      referenciaExterna: pagamento.id,
      urlRetorno: `${urlBase()}/pagamento/retorno?compra=${pagamento.id}`,
      urlWebhook: `${urlBase()}/api/webhooks/mercado-pago`,
    },
    opcoes.buscar,
  );

  if (!resultado.ok) {
    log.warn("falha ao criar preferência no Mercado Pago", {
      acao: "pagamentos.comprar",
      tipo,
      motivo: resultado.motivo,
      detalhe: resultado.detalhe,
    });
    throw erros.indisponivel(resultado.motivo);
  }

  const comPreferencia = await repo.definirPreferencia(
    pagamento.id,
    resultado.preferencia.id,
  );

  log.info("preferência criada no Mercado Pago", {
    acao: "pagamentos.comprar",
    tipo,
  });

  return {
    pagamento: comPreferencia,
    checkoutUrl: resultado.preferencia.initPoint,
  };
}

// ── Cancelar a renovação ──────────────────────────────────────────────────

/**
 * Encerra a autorização lá, se houver uma para encerrar.
 *
 * Em demonstração não há nada no Mercado Pago, e `ok` é a resposta certa:
 * o que interessa a quem chama é "as cobranças futuras estão paradas?", e
 * cobrança que nunca existiu está parada.
 */
async function encerrarNoMercadoPago(
  assinatura: Assinatura,
  buscar?: typeof fetch,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!temMercadoPagoConfigurado || !assinatura.mpPreapprovalId) {
    return { ok: true };
  }
  return cancelarAssinaturaNoMercadoPago(assinatura.mpPreapprovalId, buscar);
}

/**
 * Interrompe as cobranças futuras, **sem devolver nada** (#170).
 *
 * Cancelar e estornar são coisas diferentes, e a diferença é o mês
 * corrente: quem cancela parou de contratar dali para a frente e continua
 * com o que já pagou até o fim do período — a mensalidade não é tocada
 * aqui de propósito. Quem estorna quer o dinheiro de volta, e aí a
 * mensalidade cai na hora.
 *
 * Sem este botão, uma cobrança recorrente vira armadilha: a pessoa
 * autoriza uma vez e não tem como sair sem procurar o Mercado Pago, onde
 * ela não escolheu ter conta. Foi por isso que a #170 não podia entregar
 * a recorrência sem entregar o cancelamento junto.
 */
export async function cancelarRenovacao(
  sessao: Autenticado | null,
  tipo: TipoPagamento,
  buscar?: typeof fetch,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!sessao) throw erros.naoAutenticado("sem sessão");

  const repo = repositorioPagamentos();
  const assinatura = await repo.assinaturaViva(sessao.usuarioId, tipo);

  if (!assinatura) {
    return { ok: false, motivo: "Não há renovação automática para cancelar." };
  }

  /*
   * Antes de encerrar, pergunta se já houve dinheiro — depois de
   * `definirStatusAssinatura` a resposta continuaria a mesma, mas ler
   * aqui deixa explícito que a decisão é sobre o estado de *antes* do
   * cancelamento.
   */
  const jaPagou = await repo.temParcelaAprovada(assinatura.id);

  const encerrada = await encerrarNoMercadoPago(assinatura, buscar);
  if (!encerrada.ok) {
    log.warn("Mercado Pago recusou o cancelamento da assinatura", {
      acao: "pagamentos.cancelar_renovacao",
    });
    return encerrada;
  }

  await repo.definirStatusAssinatura(assinatura.id, "cancelada");

  /*
   * Cancelar no meio do teste grátis tira da vitrine na hora; cancelar
   * depois de pagar não tira nada.
   *
   * A diferença é o que a pessoa comprou. Quem pagou o mês tem direito ao
   * mês — encurtar ali seria cobrar por 30 dias e entregar 12. Quem está
   * no teste não pagou nada e acabou de dizer que não quer: manter o
   * perfil na busca até o fim dos `DIAS_TESTE_GRATIS` seria entregar o
   * teste inteiro a quem desistiu dele, que é justamente o uso de graça
   * que o fim da carência veio fechar.
   *
   * A tela promete exatamente isto ("seu perfil sai da busca agora"), e
   * promessa na tela é contrato.
   */
  if (!jaPagou) {
    await desfazerEfeitoDoTipo(assinatura.tipo, assinatura.usuarioId);
  }

  log.info("renovação automática cancelada pela pessoa", {
    acao: "pagamentos.cancelar_renovacao",
    tipo: assinatura.tipo,
    jaPagou,
  });

  return { ok: true };
}

// ── Devolver o dinheiro: nao existe mais porta aqui ───────────────
//
// A #168 tinha construido devolucao self-service, e a #170 chegou a
// restringi-la a primeira cobranca em 30 dias. As duas sairam em
// 09/09/2026, quando o teste gratis passou a ser a janela unica: cancelou
// dentro dos DIAS_TESTE_GRATIS, nada foi cobrado e nao ha o que devolver;
// passou disso, a cobranca vale e a saida e cancelar a renovacao, que para
// o futuro sem mexer no mes corrente.
//
// **Duas janelas para desistir confundiam mais do que protegiam** — a
// pessoa precisava entender teste, prazo de devolucao e cancelamento ao
// mesmo tempo, tres coisas para uma decisao so. E a que sobrou e a mais
// honesta das tres: ninguem paga para depois pedir de volta.
//
// Devolver continua possivel como **caso de suporte**, pelo painel do
// Mercado Pago. Quando o Luiz devolve por la, o webhook `refunded` chega
// aqui e `confirmarPagamento` revoga a mensalidade e encerra a renovacao
// — o mesmo caminho que ja trata chargeback. O que saiu foi o botao, nao
// a reacao ao estorno.

// ── O que a tela mostra ───────────────────────────────────────────────────

export interface EstadoDaAssinatura {
  assinatura: Assinatura | null;
  /**
   * Autorizada, mas ainda sem nenhuma cobrança de verdade — o teste
   * grátis está correndo.
   *
   * Quem decide isto é o servidor, não a tela: é a diferença entre
   * "cancele e não paga nada" e "cancele e fica até o fim do mês que
   * você pagou", e dizer a frase errada em qualquer das duas direções é
   * o tipo de confusão que faz a pessoa não clicar em nada.
   */
  emTesteGratis: boolean;
}

export async function estadoDaAssinatura(
  sessao: Autenticado | null,
  tipo: TipoPagamento,
): Promise<EstadoDaAssinatura> {
  if (!sessao) return { assinatura: null, emTesteGratis: false };

  const repo = repositorioPagamentos();
  const assinatura = await repo.assinaturaViva(sessao.usuarioId, tipo);

  return {
    assinatura,
    emTesteGratis:
      assinatura?.status === "ativa" &&
      !(await repo.temParcelaAprovada(assinatura.id)),
  };
}

// ── O que o Mercado Pago avisa ────────────────────────────────────────────

/** O vocabulário do `preapproval`, traduzido para o nosso. */
function statusDaAssinatura(statusRemoto: string): StatusAssinatura | null {
  switch (statusRemoto) {
    case "authorized":
      return "ativa";
    case "paused":
      return "pausada";
    case "cancelled":
      return "cancelada";
    case "pending":
      return "pendente";
    default:
      return null;
  }
}

/**
 * Espelha aqui o estado da assinatura lá — tópico
 * `subscription_preapproval`.
 *
 * Como em toda confirmação deste arquivo, o status vem de uma nova
 * consulta à API: a assinatura HMAC do webhook prova que a notificação
 * veio do Mercado Pago, não o que ela diz.
 *
 * **A primeira vez que vira `ativa` é o início do teste grátis.** O
 * cartão acabou de ser autorizado, e a cobrança de verdade só acontece
 * `DIAS_TESTE_GRATIS` depois — mas a vitrine precisa mostrar o perfil
 * desde já, senão o teste grátis não seria grátis coisa nenhuma. Por
 * isso a transição *pendente → ativa*, e só ela, concede o acesso; uma
 * reautorização depois de `pausada` não é um teste novo.
 */
export async function confirmarAssinatura(
  mpPreapprovalId: string,
  buscar?: typeof fetch,
): Promise<void> {
  const remota = await consultarAssinatura(mpPreapprovalId, buscar);
  if (!remota) {
    log.warn("Mercado Pago não devolveu uma assinatura reconhecível", {
      acao: "pagamentos.confirmar_assinatura",
    });
    return;
  }

  const repo = repositorioPagamentos();
  const assinatura =
    (await repo.assinaturaPorMpId(mpPreapprovalId)) ??
    (remota.referenciaExterna
      ? await repo.assinaturaPorId(remota.referenciaExterna)
      : null);

  if (!assinatura) {
    log.warn("aviso de assinatura que não existe aqui", {
      acao: "pagamentos.confirmar_assinatura",
    });
    return;
  }

  const status = statusDaAssinatura(remota.status);
  if (!status) return;

  const eraPendente = assinatura.status === "pendente";
  const mudou = await repo.definirStatusAssinatura(assinatura.id, status);
  if (mudou) {
    /*
     * Só a mensalidade de prestador tem teste grátis, e só ela ganha
     * algo aqui.
     *
     * O plano mensal de vagas não tem: quem contrata publica a vaga no
     * primeiro dia e teria o resultado inteiro do mês antes de qualquer
     * cobrança — `diasDeTeste` devolve zero para ele, e o efeito só vem
     * quando a primeira parcela é cobrada de verdade.
     */
    const dias = diasDeTeste(mudou.tipo);
    if (status === "ativa" && eraPendente && dias > 0) {
      await estenderMensalidade(mudou.usuarioId, dias);
    }
    log.info("assinatura mudou de estado", {
      acao: "pagamentos.confirmar_assinatura",
      status,
    });
  }
}

/**
 * Registra uma parcela da recorrência e estende a mensalidade.
 *
 * Chamado de dois lugares de propósito: pelo tópico
 * `subscription_authorized_payment`, que é o aviso próprio da parcela, e
 * pelo tópico `payment`, quando a cobrança que chegou aponta para uma
 * assinatura em vez de para uma cobrança avulsa. Os dois passam pelo
 * mesmo `registrarLiquidada`, que é idempotente pelo `mpPaymentId` — ser
 * avisado duas vezes não estende 60 dias.
 *
 * A redundância é deliberada: os tópicos são marcados à mão no painel do
 * Mercado Pago, e uma renovação que só funciona se alguém lembrou de
 * marcar a caixa certa é uma renovação que vai falhar em silêncio.
 */
async function registrarParcela(
  assinatura: Assinatura,
  mpPaymentId: string,
  valorCentavos: number | null,
): Promise<void> {
  const repo = repositorioPagamentos();

  const parcela = await repo.registrarLiquidada({
    usuarioId: assinatura.usuarioId,
    tipo: assinatura.tipo,
    valorCentavos: valorCentavos ?? assinatura.valorCentavos,
    assinaturaId: assinatura.id,
    mpPaymentId,
  });

  // `null`: outro aviso já registrou esta mesma parcela.
  if (!parcela) return;

  // Cobrou, logo está autorizada — mesmo que o aviso de autorização
  // ainda não tenha chegado, ou tenha se perdido.
  await repo.definirStatusAssinatura(assinatura.id, "ativa");
  await aplicarEfeito(parcela);

  log.info("parcela da assinatura registrada", {
    acao: "pagamentos.parcela",
    tipo: assinatura.tipo,
  });
}

/**
 * Tópico `subscription_authorized_payment`.
 *
 * O `data.id` deste aviso **não é** um id de pagamento: é o id de uma
 * fatura da assinatura, que por dentro carrega o pagamento. Consultar
 * `/v1/payments/{id}` com ele responderia 404, e a renovação nunca seria
 * registrada.
 */
export async function confirmarParcelaDaAssinatura(
  authorizedPaymentId: string,
  buscar?: typeof fetch,
): Promise<void> {
  const parcela = await consultarParcelaDaAssinatura(
    authorizedPaymentId,
    buscar,
  );

  if (!parcela?.mpPaymentId || parcela.statusPagamento !== "approved") {
    // Recusada ou ainda em processamento: o Mercado Pago avisa de novo
    // quando o estado avançar, e um estorno chega pelo tópico `payment`.
    return;
  }

  const assinatura = await repositorioPagamentos().assinaturaPorMpId(
    parcela.preapprovalId,
  );

  if (!assinatura) {
    log.warn("parcela de uma assinatura que não existe aqui", {
      acao: "pagamentos.parcela",
    });
    return;
  }

  await registrarParcela(
    assinatura,
    parcela.mpPaymentId,
    parcela.valorCentavos,
  );
}

/**
 * Relê o pagamento na API do Mercado Pago e aplica o efeito se aprovado.
 *
 * Chamado pelo webhook depois da assinatura validada — mas a assinatura
 * só prova que a notificação veio do Mercado Pago, não o que ela diz;
 * por isso o status em si vem sempre de uma nova chamada à API, nunca do
 * corpo do POST.
 */
export async function confirmarPagamento(
  mpPaymentId: string,
  buscar?: typeof fetch,
): Promise<void> {
  const infoRemota = await consultarPagamento(mpPaymentId, buscar);

  if (!infoRemota) {
    log.warn("Mercado Pago não devolveu um pagamento reconhecível", {
      acao: "pagamentos.confirmar",
      mpPaymentId,
    });
    return;
  }

  const repo = repositorioPagamentos();

  /*
   * Duas formas de reconhecer a cobrança, e a ordem importa.
   *
   * Uma parcela da recorrência não tem referência externa própria: o
   * `external_reference` do `preapproval` é herdado por todos os
   * pagamentos que ele gera, então a referência dela é a da
   * **assinatura**. Procurar só por `porId` acharia `null` e o estorno
   * ou o chargeback de uma renovação passaria batido — e o chargeback
   * fraudulento é justamente o caso que fez a revogação existir.
   *
   * Por isso se pergunta primeiro pelo id do Mercado Pago, que toda
   * parcela já registrada tem.
   */
  const pagamento =
    (await repo.porMpPaymentId(infoRemota.id)) ??
    (infoRemota.referenciaExterna
      ? await repo.porId(infoRemota.referenciaExterna)
      : null);

  if (!pagamento) {
    /*
     * Não conhecemos esta cobrança: ou é a primeira notícia de uma
     * parcela da recorrência, ou é aviso de algo que não é nosso.
     *
     * Este ramo é o que mantém a renovação funcionando mesmo com o
     * tópico `subscription_authorized_payment` desmarcado no painel do
     * Mercado Pago — e os tópicos são marcados à mão.
     */
    const assinatura = infoRemota.referenciaExterna
      ? await repo.assinaturaPorId(infoRemota.referenciaExterna)
      : null;

    if (assinatura && infoRemota.status === "approved") {
      await registrarParcela(assinatura, infoRemota.id, null);
      return;
    }

    if (!assinatura) {
      log.warn("webhook aponta para uma cobrança que não existe aqui", {
        acao: "pagamentos.confirmar",
        mpPaymentId,
        referencia: infoRemota.referenciaExterna,
      });
    }
    return;
  }

  if (infoRemota.status === "approved") {
    const aprovado = await repo.aprovar(pagamento.id, infoRemota.id);
    // `null`: outra notificação já tinha aprovado ou rejeitado antes —
    // o efeito já foi aplicado (ou nunca deveria ser), e reaplicar
    // dobraria o que a cobrança compra.
    if (aprovado) {
      await aplicarEfeito(aprovado);
      log.info("pagamento aprovado", {
        acao: "pagamentos.confirmar",
        tipo: pagamento.tipo,
      });
    }
    return;
  }

  if (infoRemota.status === "rejected") {
    await repo.rejeitar(pagamento.id, infoRemota.id);
    log.info("pagamento rejeitado", {
      acao: "pagamentos.confirmar",
      tipo: pagamento.tipo,
      status: infoRemota.status,
    });
    return;
  }

  if (infoRemota.status === "cancelled") {
    await repo.cancelar(pagamento.id, infoRemota.id);
    log.info("pagamento cancelado", {
      acao: "pagamentos.confirmar",
      tipo: pagamento.tipo,
    });
    return;
  }

  /*
   * Estorno e chargeback desfazem o que a aprovação comprou.
   *
   * Estes dois chegam **depois** de o dinheiro ter entrado, sobre uma
   * cobrança já `aprovado` — por isso `estornar` parte de "aprovado" e não
   * de "pendente", como os outros três.
   *
   * Sem este ramo, os dois caíam no "nada muda ainda" logo abaixo: o
   * prestador pagava, ganhava 30 dias, pedia estorno e continuava na
   * vitrine com o dinheiro de volta. Os valores `estornado` e `cancelado`
   * existiam no enum sem que nada no código os produzisse — estado
   * declarado sem produtor, que é a armadilha do `pedidos_verificacao` sem
   * tela de envio (#166).
   */
  if (
    infoRemota.status === "refunded" ||
    infoRemota.status === "charged_back"
  ) {
    const estornado = await repo.estornar(pagamento.id, infoRemota.id);
    // `null`: outra notificação já estornou, e o efeito já foi desfeito.
    if (estornado) {
      await desfazerEfeito(estornado);
      /*
       * E a renovação para junto.
       *
       * Quem pede a devolução pela Lupa já passa por aqui com a
       * assinatura cancelada — `pedirEstorno` cancela antes de mover o
       * dinheiro. Este ramo é para o outro caso: estorno pedido no
       * Mercado Pago, ou chargeback. Deixar a autorização viva ali
       * cobraria de novo no mês seguinte alguém que acabou de contestar
       * a cobrança.
       */
      if (estornado.assinaturaId) {
        const assinatura = await repo.assinaturaPorId(estornado.assinaturaId);
        if (assinatura) {
          await encerrarNoMercadoPago(assinatura, buscar);
          await repo.definirStatusAssinatura(assinatura.id, "cancelada");
        }
      }

      log.info("pagamento estornado", {
        acao: "pagamentos.confirmar",
        tipo: pagamento.tipo,
        status: infoRemota.status,
      });
    }
    return;
  }

  // "pending", "in_process" etc.: nada muda ainda — o Mercado Pago manda
  // outra notificação quando o status avançar.
}
