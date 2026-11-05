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

/**
 * A mensagem pronta com que o candidato chama a empresa (#533).
 *
 * É o caminho de volta do `mensagemParaCandidato`: quem se candidatou e quer
 * adiantar a conversa abre o WhatsApp da empresa com o texto escrito. Ela
 * diz de qual vaga se trata — com o link, para a empresa não procurar —,
 * declara o interesse e a disponibilidade para entrevista, e traz o link do
 * perfil, que é por onde a empresa abre o currículo e põe a pessoa no funil.
 *
 * Sem os dois links a mensagem vira "oi, tenho interesse": a empresa de
 * quem recebe dezenas por dia responde primeiro a quem facilitou.
 */
export function mensagemParaEmpresa({
  empresa,
  candidato,
  vaga,
  linkDaVaga,
  linkDoPerfil,
}: {
  empresa: string;
  candidato: string;
  vaga: string;
  linkDaVaga: string;
  linkDoPerfil: string;
}): string {
  return (
    `Olá, ${empresa}! Me chamo ${candidato.trim()}, estou entrando em ` +
    `contato sobre a vaga de ${vaga} (${linkDaVaga}). Declaro que tenho ` +
    `interesse na vaga e me disponibilizo para eventual entrevista.\n\n` +
    `Este é o link do meu perfil e currículo: ${linkDoPerfil}`
  );
}

/**
 * O convite para a entrevista marcada na ficha (#539).
 *
 * Leva o dia da semana junto da data — "qui, 06/11" se confere de cabeça,
 * "06/11" obriga a abrir o calendário — e pede confirmação, que é o que a
 * empresa precisa saber antes de separar o horário. Sem local, a frase não
 * inventa um: a empresa completa antes de enviar.
 */
export function mensagemDeEntrevista({
  candidato,
  vaga,
  empresa,
  quando,
  local,
}: {
  candidato: string;
  vaga: string;
  empresa: string;
  /** Já formatado, como "qui, 06/11 às 14:30". */
  quando: string;
  local: string | null;
}): string {
  const nome = primeiroNome(candidato);
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  return (
    `${saudacao} Aqui é da ${empresa}. Gostaríamos de convidar você para ` +
    `uma entrevista para a vaga de ${vaga}, ${quando}` +
    `${local ? `, em ${local}` : ""}. Pode confirmar?`
  );
}
