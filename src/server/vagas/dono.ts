import { empresaDoPainel } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * De quem é a vaga que esta conta publica.
 *
 * Em produção a empresa é sempre a da sessão. Em demonstração o painel
 * mostra sempre a mesma empresa fictícia (`empresaDoPainel`, em
 * `src/lib/data.ts`) — sem isso, uma vaga publicada por uma conta de
 * demonstração recém-criada nunca apareceria no painel que a exibe.
 *
 * Mora aqui, e não dentro de `servico.ts`, porque a carteira também
 * precisa saber de quem contar as vagas no ar (#489), e `servico.ts`
 * importa a carteira: o arquivo comum desfaz o ciclo.
 */
export function idDaEmpresaDoUsuario(usuarioId: string): string {
  return isSupabaseConfigured ? usuarioId : empresaDoPainel(usuarioId);
}
