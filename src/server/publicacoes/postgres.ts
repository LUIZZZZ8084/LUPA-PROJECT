import "server-only";

import { createClient } from "@/lib/supabase/server";
import { erros } from "../errors";
import type {
  DadosNovaPublicacao,
  Publicacao,
  RepositorioPublicacoes,
  StatusPublicacao,
} from "./tipos";

function paraPublicacao(linha: Record<string, unknown>): Publicacao {
  return {
    id: String(linha.id),
    autorId: String(linha.autor_id),
    titulo: String(linha.titulo),
    corpo: String(linha.corpo),
    imagemUrl: (linha.imagem_url as string | null) ?? null,
    status: linha.status as StatusPublicacao,
    criadoEm: String(linha.criado_em),
    atualizadoEm: String(linha.atualizado_em),
  };
}

async function cliente() {
  const supabase = await createClient();
  if (!supabase) throw erros.indisponivel("Supabase não configurado");
  return supabase;
}

/**
 * O trigger `publicacoes_limite` no Postgres é quem garante o limite de
 * ativas. Aqui traduzimos a violação para a mesma mensagem que o serviço já
 * usa, para que a interface não precise distinguir de onde veio a recusa.
 */
function traduzirErro(mensagem: string): Error {
  if (mensagem.includes("limite de")) {
    return new Error("limite de publicações ativas atingido");
  }
  return erros.indisponivel(mensagem);
}

export class RepositorioPublicacoesPostgres implements RepositorioPublicacoes {
  async porAutor(
    autorId: string,
    status?: StatusPublicacao,
  ): Promise<Publicacao[]> {
    const supabase = await cliente();
    let query = supabase
      .from("publicacoes")
      .select("*")
      .eq("autor_id", autorId)
      .order("criado_em", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw traduzirErro(error.message);
    return (data ?? []).map(paraPublicacao);
  }

  async porId(id: string): Promise<Publicacao | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("publicacoes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw traduzirErro(error.message);
    return data ? paraPublicacao(data) : null;
  }

  async contarAtivas(autorId: string): Promise<number> {
    const supabase = await cliente();
    const { count, error } = await supabase
      .from("publicacoes")
      .select("id", { count: "exact", head: true })
      .eq("autor_id", autorId)
      .eq("status", "ativa");

    if (error) throw traduzirErro(error.message);
    return count ?? 0;
  }

  async criar(dados: DadosNovaPublicacao): Promise<Publicacao> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("publicacoes")
      .insert({
        autor_id: dados.autorId,
        titulo: dados.titulo,
        corpo: dados.corpo,
        imagem_url: dados.imagemUrl ?? null,
      })
      .select("*")
      .single();

    if (error) throw traduzirErro(error.message);
    return paraPublicacao(data);
  }

  async atualizar(
    id: string,
    campos: Partial<Pick<Publicacao, "titulo" | "corpo" | "imagemUrl">>,
  ): Promise<Publicacao> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("publicacoes")
      .update({
        ...(campos.titulo !== undefined ? { titulo: campos.titulo } : {}),
        ...(campos.corpo !== undefined ? { corpo: campos.corpo } : {}),
        ...(campos.imagemUrl !== undefined
          ? { imagem_url: campos.imagemUrl }
          : {}),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw traduzirErro(error.message);
    return paraPublicacao(data);
  }

  async definirStatus(
    id: string,
    status: StatusPublicacao,
  ): Promise<Publicacao> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("publicacoes")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw traduzirErro(error.message);
    return paraPublicacao(data);
  }
}
