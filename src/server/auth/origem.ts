import "server-only";

import type { Origem } from "@/lib/proximidade";
import { sessaoAtual } from "./cookies";
import { usuarioDaSessao } from "./servico";

/**
 * De onde a pessoa da sessão está olhando, para a busca ordenar por perto.
 *
 * Fica em `src/server/` e não numa tela porque lê cookie e usuário — o
 * mesmo par que `/empresa/vagas/nova` já usa para sugerir a cidade da
 * empresa. Duas telas precisam disto; repetir daria duas chances de uma
 * esquecer o `null`.
 *
 * Devolve `undefined` sem sessão ou sem usuário. A ordenação trata isso
 * empatando todo mundo, o que devolve a lista à ordem anterior — data para
 * vaga, nota para prestador. Comportamento antigo é o lugar seguro para
 * cair; ordem inventada, não.
 */
export async function origemDoUsuario(): Promise<Origem | undefined> {
  const sessao = await sessaoAtual();
  if (!sessao) return undefined;

  const usuario = await usuarioDaSessao(sessao.usuarioId);
  if (!usuario?.cidade) return undefined;

  return { cidade: usuario.cidade, bairro: usuario.bairro };
}
