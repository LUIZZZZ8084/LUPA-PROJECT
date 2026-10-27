/**
 * A mensagem pronta com que a empresa chama quem se candidatou (#493).
 *
 * Depois de achar um bom candidato, a empresa abria o WhatsApp e digitava
 * tudo do zero — trabalho a mais num ponto onde a Lupa devia economizar o
 * tempo dela, e quem recebe uma mensagem sem contexto desconfia. A mensagem
 * traz o nome da pessoa, o cargo da vaga e o nome de quem chama: é o que
 * separa um convite de um golpe de WhatsApp.
 *
 * É só o ponto de partida. `wa.me/?text=` abre a conversa com o texto já
 * escrito **no campo de mensagem**, e a empresa edita antes de enviar — um
 * campo de edição a mais aqui seria atrito sem ganho.
 *
 * Mora fora do componente porque a ficha e a lista do painel mandam a mesma
 * mensagem, e duas cópias do texto divergem na primeira vez que alguém muda
 * uma delas.
 */

/** "Maria da Silva" → "Maria". Nome vazio não vira "Olá, !". */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

export function mensagemParaCandidato({
  candidato,
  vaga,
  empresa,
}: {
  candidato: string;
  vaga: string;
  empresa: string;
}): string {
  const nome = primeiroNome(candidato);
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  return (
    `${saudacao} Aqui é da ${empresa}. Vimos sua candidatura para a vaga ` +
    `de ${vaga} na Lupa e gostaríamos de conversar.`
  );
}
