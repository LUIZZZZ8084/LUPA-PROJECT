import "server-only";

import { log } from "../logger";

/**
 * Envio de e-mail transacional.
 *
 * Existe por causa da recuperação de senha (#174), a dívida que a
 * migração `0001` deixou quando trocou o Supabase Auth por autenticação
 * própria: verificação de e-mail e "esqueci minha senha" vinham de graça
 * e passaram a ter de ser construídas.
 *
 * **Sem credencial, o recurso não existe e a tela diz isso** — mesma
 * degradação do Storage sem Supabase e do push sem VAPID. O que não se
 * faz aqui é fingir que enviou: quem pediu para recuperar a senha ficaria
 * esperando um e-mail que nunca sai, e concluiria que a conta sumiu.
 *
 * A chamada é `fetch` cru contra a API do Resend, no mesmo padrão do
 * Mercado Pago e da BrasilAPI — `fetch` injetável para o teste não
 * depender de rede, timeout explícito, e retorno de resultado em vez de
 * exceção. Um SDK aqui traria uma dependência para três campos de JSON.
 */

const BASE = "https://api.resend.com/emails";
const TIMEOUT_MS = 8000;

/** Sem isto, `enviarEmail` recusa e quem chama avisa a pessoa. */
export const temEmailConfigurado = Boolean(
  process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE,
);

export interface Email {
  para: string;
  assunto: string;
  /** Texto puro. Ver a nota sobre HTML abaixo. */
  corpo: string;
}

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; motivo: string; detalhe?: string };

/**
 * Manda o e-mail, ou diz por que não deu.
 *
 * **Só texto puro, sem HTML.** O público daqui abre e-mail no celular, e
 * um template com imagem e botão colorido é o formato que os provedores
 * mais pontuam como promoção — justamente o e-mail que precisa chegar na
 * caixa de entrada, e rápido. Texto também não tem como quebrar a
 * renderização em cliente antigo.
 */
export async function enviarEmail(
  email: Email,
  buscar: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  if (!temEmailConfigurado) {
    return {
      ok: false,
      motivo: "O envio de e-mail não está configurado neste ambiente.",
    };
  }

  try {
    const resposta = await buscar(BASE, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_REMETENTE,
        to: [email.para],
        subject: email.assunto,
        text: email.corpo,
      }),
      cache: "no-store",
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      return {
        ok: false,
        motivo: `O provedor de e-mail recusou o envio (${resposta.status}).`,
        detalhe,
      };
    }

    /*
     * O endereço não vai para o log, nem aqui nem em erro nenhum: numa
     * cidade do tamanho de Sinop, a lista de quem pediu recuperação de
     * senha é a lista de quem tem conta — a mesma informação que o login
     * se recusa a confirmar.
     */
    log.info("e-mail enviado", { acao: "email.enviar" });
    return { ok: true };
  } catch {
    return {
      ok: false,
      motivo: "Não foi possível falar com o provedor de e-mail agora.",
    };
  }
}
