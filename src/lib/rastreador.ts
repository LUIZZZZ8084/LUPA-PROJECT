/**
 * O visitante é um robô de prévia ou de busca? (#490)
 *
 * A vaga abre sem login, e o link anda pelo WhatsApp, pelo Instagram e pelo
 * Facebook: cada um manda um servidor buscar a página para montar a prévia,
 * e o Google vem atrás. Contar essas visitas como visualização faria o
 * número da empresa subir quando ela cola o link numa conversa — mede o
 * robô, não o público.
 *
 * Reconhece pelo `User-Agent`, que é declaratório: robô que se disfarça de
 * navegador passa, e é aceito. O erro para o lado de contar a mais é o mesmo
 * que a recarga já provoca, e a tela diz que a métrica serve para comparar
 * vagas entre si, não para contar pessoas.
 */
const ROBOS =
  /bot\b|crawler|spider|slurp|whatsapp|facebookexternalhit|facebot|telegram|skypeuripreview|linkedinbot|embedly|preview|headless|lighthouse|pingdom|uptime/i;

export function ehRastreador(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return ROBOS.test(userAgent);
}
