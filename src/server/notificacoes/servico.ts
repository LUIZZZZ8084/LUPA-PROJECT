import "server-only";

import { ehCidadeAtendida, JOB_CATEGORIES } from "@/lib/constants";
import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioNotificacoes } from "./index";
import { type Aviso, enviarPush } from "./push";
import type { InscricaoPush, PreferenciaNotificacao } from "./tipos";

/**
 * Avisar quem procura, quando aparece o que ela procura (#48).
 *
 * Numa plataforma que saiu da busca do Google, ninguém chega sozinho: uma
 * vaga só é vista por quem resolver abrir o app naquele dia, e vaga boa em
 * Sinop some em dois dias. O push é o que devolve a pessoa ao app sem ela
 * ter de lembrar.
 *
 * **Bairro ficou de fora**, e é decisão de 26/08/2026: não existe catálogo
 * de bairro para os 142 municípios de Mato Grosso, só para Sinop. Notificar
 * por bairro funcionaria bem numa cidade e mal nas outras 141.
 */

/** Sem capacidade própria: qualquer conta com sessão escolhe ser avisada. */
function sessaoValida(sessao: Autenticado | null): Autenticado {
  return exigirCapacidade(sessao, "perfil:editar_proprio");
}

export async function preferenciaAtual(
  sessao: Autenticado | null,
): Promise<PreferenciaNotificacao | null> {
  const autenticado = sessaoValida(sessao);
  return repositorioNotificacoes().preferencia(autenticado.usuarioId);
}

/**
 * Guarda a cidade e, opcionalmente, a categoria.
 *
 * As duas são validadas contra as mesmas listas do resto do app. Cidade
 * livre viraria "Sinop", "sinop" e "Sinop-MT" na mesma base, e o casamento
 * com a vaga deixaria de acontecer — a pessoa marcaria a preferência e não
 * receberia nada, sem nunca saber por quê.
 */
export async function salvarPreferencia(
  sessao: Autenticado | null,
  dados: { cidade: string; categoria: string | null },
): Promise<void> {
  const autenticado = sessaoValida(sessao);

  if (!ehCidadeAtendida(dados.cidade)) {
    throw erros.validacao([
      { campo: "cidade", mensagem: "Escolha uma cidade de Mato Grosso." },
    ]);
  }

  if (
    dados.categoria !== null &&
    !(JOB_CATEGORIES as readonly string[]).includes(dados.categoria)
  ) {
    throw erros.validacao([
      { campo: "categoria", mensagem: "Escolha uma área da lista." },
    ]);
  }

  await repositorioNotificacoes().salvarPreferencia({
    usuarioId: autenticado.usuarioId,
    cidade: dados.cidade,
    categoria: dados.categoria,
  });

  log.info("preferência de aviso salva", {
    acao: "notificacao.preferencia",
    papel: autenticado.papel,
  });
}

/**
 * Desligar apaga tudo: a preferência e os aparelhos.
 *
 * "Dá para desativar facilmente" é critério de aceite da Issue, e desativar
 * pela metade — parar de avisar mas guardar o que a pessoa procurava — seria
 * manter justamente o dado que este projeto evita guardar.
 */
export async function desligarAvisos(
  sessao: Autenticado | null,
): Promise<void> {
  const autenticado = sessaoValida(sessao);
  const repo = repositorioNotificacoes();

  const inscricoes = await repo.inscricoesDe(autenticado.usuarioId);
  await Promise.all(inscricoes.map((i) => repo.removerInscricao(i.endpoint)));
  await repo.removerPreferencia(autenticado.usuarioId);

  log.info("avisos desligados", { acao: "notificacao.desligar" });
}

/** O aparelho se inscreve; o id de quem é vem da sessão, nunca do cliente. */
export async function inscreverAparelho(
  sessao: Autenticado | null,
  inscricao: Omit<InscricaoPush, "usuarioId">,
): Promise<void> {
  const autenticado = sessaoValida(sessao);

  if (!inscricao.endpoint || !inscricao.p256dh || !inscricao.auth) {
    throw erros.validacao([
      { campo: "endpoint", mensagem: "Inscrição de aparelho incompleta." },
    ]);
  }

  await repositorioNotificacoes().salvarInscricao({
    ...inscricao,
    usuarioId: autenticado.usuarioId,
  });
}

/**
 * Avisa quem pediu, quando uma vaga nasce.
 *
 * Roda em `after()`, depois da resposta: quem publicou quer a vaga no ar, e
 * o aviso é consequência. Falha aqui vai para o log e a publicação segue —
 * a mesma disciplina do registro de visualização e da busca sem resultado.
 *
 * **Ninguém é avisado da própria vaga.** Parece óbvio, e não é: quem
 * publica está na mesma cidade e quase sempre na mesma categoria, então
 * sem esta linha a primeira notificação que a pessoa recebe é a dela mesma
 * — e a conclusão dela é que o aviso está quebrado.
 */
export async function avisarVagaNova(vaga: {
  id: string;
  titulo: string;
  categoria: string | null;
  cidade: string;
  empresaId: string;
}): Promise<void> {
  const repo = repositorioNotificacoes();
  const inscricoes = await repo.inscricoesInteressadas(
    vaga.cidade,
    vaga.categoria,
  );

  const destinatarios = inscricoes.filter(
    (i) => i.usuarioId !== vaga.empresaId,
  );
  if (!destinatarios.length) return;

  const aviso: Aviso = {
    titulo: `Vaga nova em ${vaga.cidade}`,
    corpo: vaga.titulo,
    url: `/vagas/${vaga.id}`,
  };

  const resultados = await Promise.all(
    destinatarios.map(async (i) => ({
      endpoint: i.endpoint,
      viva: await enviarPush(i, aviso),
    })),
  );

  /*
   * Aparelho que respondeu 404/410 sai da tabela. Sem isso ela vira
   * cemitério de telefone trocado, e toda vaga publicada gasta uma
   * tentativa por aparelho que sumiu há meses.
   */
  const mortas = resultados.filter((r) => !r.viva);
  await Promise.all(mortas.map((r) => repo.removerInscricao(r.endpoint)));

  log.info("avisos de vaga enviados", {
    acao: "notificacao.vaga",
    enviados: destinatarios.length - mortas.length,
    removidos: mortas.length,
  });
}
