import "server-only";

import { CONTROLADOR } from "@/lib/controlador";
import { conferirLimite, registrarFalha } from "../auth/rate-limit";
import { enviarEmail, temEmailConfigurado } from "../email";
import { log } from "../logger";
import { repositorioSuporte } from "./index";
import { ASSUNTOS, type NovaMensagemDeSuporte } from "./tipos";

/**
 * Receber uma mensagem de suporte (#235).
 *
 * **Grava e avisa, nessa ordem.** Gravar primeiro garante que a mensagem
 * existe mesmo se o provedor de e-mail estiver fora do ar — e quem escreveu
 * não precisa saber que ele estava. Avisar depois é o que faz alguém ler:
 * depender de o admin abrir um painel seria a promessa quebrada que este
 * projeto registra cinco vezes, só que agora prometendo suporte.
 *
 * A ordem inversa perderia a mensagem numa falha de rede, que é exatamente
 * a hora em que a pessoa mais precisa que ela não se perca.
 *
 * **O limite é por origem**, como o cadastro e a recuperação de senha, e
 * pelo mesmo motivo: sem ele este formulário vira um canal para mandar
 * e-mail em nome da Lupa a quantas vezes se quiser, e quem paga a reputação
 * do domínio somos nós. Conta toda tentativa, inclusive as que dão certo.
 */

export interface PedidoDeSuporte {
  nome: string;
  email: string;
  assunto: NovaMensagemDeSuporte["assunto"];
  mensagem: string;
  /** Nulo quando quem escreve não conseguiu entrar. */
  usuarioId: string | null;
  origem: string;
}

export async function receberMensagemDeSuporte(
  pedido: PedidoDeSuporte,
): Promise<void> {
  await conferirLimite(`suporte:${pedido.origem}`);
  await registrarFalha(`suporte:${pedido.origem}`);

  const dados: NovaMensagemDeSuporte = {
    usuarioId: pedido.usuarioId,
    nome: pedido.nome.trim(),
    email: pedido.email.trim().toLowerCase(),
    assunto: pedido.assunto,
    mensagem: pedido.mensagem.trim(),
  };

  await repositorioSuporte().registrar(dados);

  /*
   * O log não recebe e-mail nem o texto da mensagem.
   *
   * Mesma regra da recuperação de senha: um log que reconstrói quem
   * escreveu, e sobre o quê, desfaz o cuidado que a tabela tem. O que serve
   * para operar é saber que chegou e de que assunto.
   */
  log.info("mensagem de suporte recebida", {
    acao: "suporte.receber",
    assunto: pedido.assunto,
    comSessao: Boolean(pedido.usuarioId),
  });

  if (!temEmailConfigurado || !CONTROLADOR.email) return;

  const resultado = await enviarEmail({
    para: CONTROLADOR.email,
    assunto: `[Lupa/${pedido.assunto}] ${dados.nome}`,
    corpo: [
      `Assunto: ${ASSUNTOS[pedido.assunto]}`,
      `De: ${dados.nome} <${dados.email}>`,
      pedido.usuarioId ? `Conta: ${pedido.usuarioId}` : "Sem sessão.",
      "",
      dados.mensagem,
    ].join("\n"),
  });

  /*
   * Falha de envio **não** derruba a ação, e isso é escolha: a mensagem já
   * está gravada. Dizer "não deu certo" faria a pessoa escrever de novo e
   * criar a segunda linha da mesma dúvida — e ela não pode fazer nada a
   * respeito de um provedor fora do ar.
   */
  if (!resultado.ok) {
    log.warn("mensagem de suporte gravada, mas o aviso não saiu", {
      acao: "suporte.receber",
      motivo: resultado.motivo,
    });
  }
}
