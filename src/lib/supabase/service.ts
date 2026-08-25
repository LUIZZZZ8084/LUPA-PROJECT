import "server-only";

import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_URL } from "./config";
import { erroDeChaveDeServico } from "./papel-da-chave";

/**
 * Cliente com a chave de serviço.
 *
 * A chave de serviço ignora Row Level Security. É o que permite ao servidor
 * ler e escrever em `usuarios`, que fica fechada para a chave anônima
 * justamente por guardar hash de senha.
 *
 * Duas regras que não podem ser afrouxadas:
 *
 * 1. `server-only` no topo. Se este módulo for importado por um componente
 *    de cliente, o build quebra — que é muito melhor do que a chave vazar
 *    para o navegador.
 * 2. `SUPABASE_SERVICE_ROLE_KEY` nunca tem prefixo `NEXT_PUBLIC_`. Com o
 *    prefixo, o Next a embute no bundle e ela deixa de ser secreta.
 *
 * Sem a chave configurada, devolve null e a camada acima cai para o
 * repositório em memória — o mesmo caminho do modo demonstração.
 */

/**
 * Schema permissivo.
 *
 * Sem os tipos gerados por `supabase gen types`, o cliente infere `never`
 * para qualquer tabela e recusa todo insert. Este tipo mantém o cliente
 * utilizável enquanto o schema não é gerado — o contrato de verdade está
 * nos repositórios, que traduzem coluna por coluna e têm teste para isso.
 *
 * Quando o projeto Supabase existir, rodar:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/tipos-banco.ts
 * e trocar este tipo pelo gerado.
 */
type LinhaGenerica = Record<string, unknown>;

interface SchemaPermissivo {
  public: {
    Tables: Record<
      string,
      {
        Row: LinhaGenerica;
        Insert: LinhaGenerica;
        Update: LinhaGenerica;
        Relationships: [];
      }
    >;
    Views: Record<string, { Row: LinhaGenerica; Relationships: [] }>;
    // Sem assinatura, toda chamada de rpc() vira erro de tipo.
    Functions: Record<string, { Args: LinhaGenerica; Returns: unknown }>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

const CHAVE_SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const temChaveDeServico = Boolean(isSupabaseConfigured && CHAVE_SERVICO);

let cache: ReturnType<typeof criarClienteSupabase<SchemaPermissivo>> | null =
  null;

export function clienteDeServico() {
  if (!temChaveDeServico) return null;

  if (!cache) {
    // A chave anônima aqui só falharia lá no banco, como violação de RLS —
    // mensagem que aponta para policies e schema, onde não há nada errado.
    const erro = erroDeChaveDeServico(CHAVE_SERVICO);
    if (erro) throw new Error(erro);

    cache = criarClienteSupabase<SchemaPermissivo>(
      SUPABASE_URL,
      CHAVE_SERVICO,
      {
        auth: {
          // A sessão é nossa, em cookie próprio. O cliente do Supabase não deve
          // tentar guardar nem renovar token nenhum.
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return cache;
}
