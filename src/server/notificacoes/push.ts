import "server-only";

import webpush from "web-push";
import { log } from "../logger";
import type { InscricaoPush } from "./tipos";

/**
 * O envio em si — a única parte que fala com o serviço de push.
 *
 * Separado do serviço de propósito: a regra de negócio ("quem quer saber
 * disto?") é testável sem rede, e este arquivo é o pedaço que precisa de
 * credencial. É a mesma divisão que `verificacao/cnpj.ts` faz com a
 * consulta à Receita.
 */

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const CHAVE_PRIVADA = process.env.VAPID_PRIVATE_KEY ?? "";
const CONTATO = process.env.VAPID_SUBJECT ?? "mailto:contato@lupapp.com.br";

/**
 * Sem as chaves, o push simplesmente não existe — como o Storage sem
 * Supabase.
 *
 * O app inteiro continua funcionando; a tela é que deixa de oferecer o
 * aviso, em vez de oferecer e engolir o pedido em silêncio. É requisito do
 * modo demonstração, que precisa rodar sem infraestrutura nenhuma.
 */
export const pushConfigurado = Boolean(CHAVE_PUBLICA && CHAVE_PRIVADA);

if (pushConfigurado) {
  webpush.setVapidDetails(CONTATO, CHAVE_PUBLICA, CHAVE_PRIVADA);
}

export interface Aviso {
  titulo: string;
  corpo: string;
  /** Caminho relativo — o service worker abre no mesmo domínio. */
  url: string;
}

/**
 * Manda para um aparelho. Devolve `false` quando aquele endpoint morreu.
 *
 * 404 e 410 são a resposta do serviço de push para "este aparelho não
 * existe mais" — desinstalou o app, limpou os dados, trocou de telefone. É
 * a única forma de saber, porque o navegador não avisa ninguém. Quem chama
 * usa o `false` para apagar a linha; sem isso a tabela vira cemitério e
 * cada vaga publicada tenta falar com aparelhos que sumiram há meses.
 *
 * Qualquer outra falha é do momento — rede, serviço fora do ar — e não
 * apaga nada: some com a inscrição de quem só estava sem sinal seria pior
 * que não avisar uma vez.
 */
export async function enviarPush(
  inscricao: InscricaoPush,
  aviso: Aviso,
): Promise<boolean> {
  if (!pushConfigurado) return true;

  try {
    await webpush.sendNotification(
      {
        endpoint: inscricao.endpoint,
        keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
      },
      JSON.stringify(aviso),
    );
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;

    if (status === 404 || status === 410) return false;

    /*
     * Não relança: o envio roda em `after()`, depois da resposta. Uma vaga
     * publicada não pode falhar porque o serviço de push soluçou — quem
     * publicou quer a vaga no ar, e o aviso é consequência.
     */
    log.warn("falha ao enviar push", {
      acao: "notificacao.enviar",
      status: status ?? 0,
    });
    return true;
  }
}
