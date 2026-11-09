/**
 * A primeira linha dos e-mails da Lupa: "Olá, Maria." (#445).
 *
 * O nome é digitado por quem cria a conta, e a conta pode ser criada com o
 * e-mail de outra pessoa — o de confirmação sai sozinho no cadastro. Cortar
 * no espaço comum e levar o resto como veio deixava passar uma frase
 * inteira com link, escrita com outro espaço Unicode entre as palavras,
 * dentro de um e-mail legítimo da Lupa.
 *
 * Por isso a saudação é montada aqui, e não confiada à validação do
 * cadastro: vale também para as contas que já existem. Só o primeiro nome,
 * só letras, apóstrofo e hífen, com teto. Sem nada aproveitável, "Olá.".
 */
const TETO_DO_PRIMEIRO_NOME = 30;

/**
 * O primeiro nome que pode entrar num e-mail da Lupa: só letras, marcas,
 * apóstrofo e hífen, com teto, ou vazio quando não sobra letra nenhuma.
 *
 * Vale para qualquer nome que a Lupa escreve num e-mail, não só o de quem
 * recebe: o nome do candidato no aviso à empresa passa pelo mesmo filtro
 * (#582), porque o texto chega com a assinatura da Lupa.
 */
export function primeiroNomeSeguro(nomeCompleto: string): string {
  const primeiro = nomeCompleto.normalize("NFC").trim().split(/\s+/u)[0] ?? "";
  const limpo = primeiro
    .replace(/[^\p{L}\p{M}'’-]/gu, "")
    .slice(0, TETO_DO_PRIMEIRO_NOME);
  return /\p{L}/u.test(limpo) ? limpo : "";
}

export function saudacao(nomeCompleto: string): string {
  const limpo = primeiroNomeSeguro(nomeCompleto);
  return limpo ? `Olá, ${limpo}.` : "Olá.";
}
