import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { NovaMensagemDeSuporte, RepositorioSuporte } from "./tipos";

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

export class RepositorioSuportePostgres implements RepositorioSuporte {
  async registrar(dados: NovaMensagemDeSuporte): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("mensagens_suporte").insert({
      usuario_id: dados.usuarioId,
      nome: dados.nome,
      email: dados.email,
      assunto: dados.assunto,
      mensagem: dados.mensagem,
    });

    if (error)
      throw erros.indisponivel(`mensagem de suporte: ${error.message}`);
  }
}
