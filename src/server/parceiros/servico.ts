import "server-only";

import { VALIDADE_SEM_PRAZO } from "@/lib/parceria";
import { type Autenticado, exigirCapacidade, pode } from "../auth/rbac";
import { liberarGeradorCurriculo } from "../candidatos/servico";
import {
  encerrarPlanoDeParceria,
  garantirPlanoIlimitadoAte,
} from "../carteiras/servico";
import { comoAppError, erros } from "../errors";
import { log } from "../logger";
import {
  encerrarMensalidadeDeParceria,
  garantirMensalidadeAte,
} from "../prestadores/servico";
import { repositorioUsuarios } from "../repositories";
import { repositorioParceiros } from "./index";
import type {
  DadosDaParceria,
  LinhaDeParceria,
  Parceria,
  SituacaoDaParceria,
} from "./tipos";

/**
 * Parcerias: quem usa a Lupa de graça por acordo (#505).
 *
 * **O benefício mora onde o pagamento já mora.** A parceria não cria um
 * caminho novo na vitrine, na publicação ou no painel: ela grava a validade
 * nas mesmas colunas que a cobrança aprovada grava — a mensalidade do
 * prestador e o plano de vagas da carteira —, e o resto do app funciona sem
 * saber que ela existe. "Sem prazo" é a validade no ano 2100
 * (`VALIDADE_SEM_PRAZO`), e as telas que mostram a validade a reconhecem.
 *
 * **Só vale com o e-mail confirmado.** O cadastro não confere e-mail
 * (#227): sem esta trava, quem se cadastrasse antes com o endereço do
 * parceiro levaria o benefício dele. A concessão roda quando o admin
 * autoriza (a conta pode já existir e já ter confirmado), quando a pessoa
 * confirma o e-mail (`confirmarEmail`) e quando ela vira prestador, que é
 * quando ganha a vitrine para ligar.
 *
 * **Tudo o que é pago fica grátis**, e quem decide o quê é a matriz, não o
 * nome do papel: quem publica vaga ganha o plano ilimitado; o prestador, a
 * mensalidade que o põe na vitrine; quem gera currículo, o gerador.
 */

function vencida(p: Parceria, agora: Date): boolean {
  return p.validoAte !== null && Date.parse(p.validoAte) <= agora.getTime();
}

/** As parcerias, com a situação de cada uma. Só o admin. */
export async function listarParceiros(
  sessao: Autenticado | null,
): Promise<LinhaDeParceria[]> {
  exigirCapacidade(sessao, "admin:parceiros");
  const agora = new Date();
  const usuarios = repositorioUsuarios();

  return Promise.all(
    (await repositorioParceiros().listar()).map(async (p) => {
      if (p.encerradoEm) return { ...p, situacao: "encerrada" as const };
      if (vencida(p, agora)) return { ...p, situacao: "vencida" as const };

      const conta = await usuarios.porEmail(p.email);
      const situacao: SituacaoDaParceria = !conta
        ? "sem_conta"
        : !conta.emailVerificado
          ? "email_nao_confirmado"
          : p.usuarioId === conta.id
            ? "ativa"
            : "sem_beneficio";
      return { ...p, situacao };
    }),
  );
}

/**
 * Autoriza um e-mail. Se a conta já existe e já confirmou o endereço, o
 * benefício entra na hora.
 */
export async function autorizarParceiro(
  sessao: Autenticado | null,
  dados: DadosDaParceria,
): Promise<Parceria> {
  const admin = exigirCapacidade(sessao, "admin:parceiros");
  const repo = repositorioParceiros();

  if (await repo.abertaPorEmail(dados.email)) {
    throw erros.conflito(
      "Este e-mail já tem uma parceria aberta. Encerre a atual para trocar o prazo.",
    );
  }

  const parceria = await repo.criar(dados, admin.usuarioId);
  log.info("parceria autorizada", {
    acao: "parceiro.autorizar",
    semPrazo: dados.validoAte === null,
  });

  const conta = await repositorioUsuarios().porEmail(dados.email);
  if (conta) await concederBeneficioDeParceiro(conta.id);

  return (await repo.porId(parceria.id)) ?? parceria;
}

/**
 * Encerra a parceria e tira o que ela deu — menos o que a conta pagou além
 * do prazo dela, e menos o gerador de currículo, que é compra única sem
 * validade: quem o usou de graça fica com ele.
 */
export async function encerrarParceria(
  sessao: Autenticado | null,
  id: string,
): Promise<Parceria> {
  exigirCapacidade(sessao, "admin:parceiros");
  const encerrada = await repositorioParceiros().encerrar(id);
  if (!encerrada) throw erros.naoEncontrado("Parceria");

  if (encerrada.usuarioId && encerrada.concedidoAte) {
    await encerrarPlanoDeParceria(encerrada.usuarioId, encerrada.concedidoAte);
    await encerrarMensalidadeDeParceria(
      encerrada.usuarioId,
      encerrada.concedidoAte,
    );
  }

  log.info("parceria encerrada", { acao: "parceiro.encerrar" });
  return encerrada;
}

/**
 * Dá à conta o que a parceria do e-mail dela promete, se houver uma, se o
 * e-mail estiver confirmado e se ela não venceu. Devolve se concedeu.
 *
 * Roda sem sessão de admin: quem chama é o sistema, no momento em que a
 * conta passa a merecer — e é idempotente, porque a validade é "pelo menos
 * até", e pedir de novo pede zero dias.
 */
export async function concederBeneficioDeParceiro(
  usuarioId: string,
): Promise<boolean> {
  const conta = await repositorioUsuarios().porId(usuarioId);
  if (!conta?.emailVerificado) return false;

  const repo = repositorioParceiros();
  const parceria = await repo.abertaPorEmail(conta.email);
  if (!parceria || vencida(parceria, new Date())) return false;

  const ate = parceria.validoAte ?? VALIDADE_SEM_PRAZO;
  let concedeu = false;

  if (pode(conta.papel, "vaga:publicar")) {
    await garantirPlanoIlimitadoAte(conta.id, ate);
    concedeu = true;
  }
  if (conta.papel === "prestador_servico") {
    concedeu =
      (await garantirMensalidadeAte(conta.id, ate)) !== null || concedeu;
  }
  if (pode(conta.papel, "candidato:gerar_curriculo")) {
    await liberarGeradorCurriculo(conta.id);
    concedeu = true;
  }

  if (!concedeu) return false;

  await repo.registrarConcessao(parceria.id, conta.id, ate);
  log.info("benefício de parceria concedido", {
    acao: "parceiro.conceder",
    papel: conta.papel,
  });
  return true;
}

/**
 * A concessão, chamada de dentro de outro fluxo — confirmar o e-mail, virar
 * prestador. Falhar aqui não pode desfazer o que a pessoa acabou de fazer:
 * vai ao Sentry, e a próxima concessão (o admin autorizando de novo, ou a
 * próxima troca) refaz, porque ela é idempotente.
 */
export async function tentarConcederBeneficioDeParceiro(
  usuarioId: string,
): Promise<void> {
  try {
    await concederBeneficioDeParceiro(usuarioId);
  } catch (e) {
    log.erro(comoAppError(e), { acao: "parceiro.conceder" });
  }
}
