import "server-only";

import { createClient } from "@/lib/supabase/server";
import { erros } from "../errors";
import type {
  DadosNovoUsuario,
  PerfilCandidato,
  PerfilEmpresa,
  PerfilPrestador,
  RepositorioUsuarios,
  Usuario,
} from "./tipos";

/**
 * Repositório em Postgres, via Supabase.
 *
 * A autenticação é nossa (Argon2 + JWT), não a do Supabase Auth. O que se
 * usa daqui é só o Postgres e o storage. Isso mantém o app portátil para
 * qualquer Postgres e deixa o hash de senha sob nosso controle e teste.
 *
 * As escritas usam a chave de serviço porque `usuarios` fica fora do
 * alcance do RLS: a tabela guarda o hash de senha e nenhuma sessão de
 * cliente pode chegar perto dela.
 */

/** `snake_case` do banco para `camelCase` da aplicação. */
function paraUsuario(linha: Record<string, unknown>): Usuario {
  return {
    id: String(linha.id),
    email: String(linha.email),
    senhaHash: String(linha.senha_hash),
    papel: linha.papel as Usuario["papel"],
    nomeCompleto: String(linha.nome_completo),
    telefone: String(linha.telefone),
    cidade: String(linha.cidade),
    bairro: (linha.bairro as string | null) ?? null,
    avatarUrl: (linha.avatar_url as string | null) ?? null,
    emailVerificado: Boolean(linha.email_verificado),
    telefoneVerificado: Boolean(linha.telefone_verificado),
    docVerificado: Boolean(linha.doc_verificado),
    criadoEm: String(linha.criado_em),
    ultimoAcessoEm: (linha.ultimo_acesso_em as string | null) ?? null,
  };
}

async function cliente() {
  const supabase = await createClient();
  if (!supabase) {
    throw erros.indisponivel("Supabase não configurado");
  }
  return supabase;
}

export class RepositorioPostgres implements RepositorioUsuarios {
  async porEmail(email: string): Promise<Usuario | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error)
      throw erros.indisponivel(`consulta por e-mail: ${error.message}`);
    return data ? paraUsuario(data) : null;
  }

  async porId(id: string): Promise<Usuario | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw erros.indisponivel(`consulta por id: ${error.message}`);
    return data ? paraUsuario(data) : null;
  }

  async criar(dados: DadosNovoUsuario): Promise<Usuario> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("usuarios")
      .insert({
        email: dados.email.toLowerCase(),
        senha_hash: dados.senhaHash,
        papel: dados.papel,
        nome_completo: dados.nomeCompleto,
        telefone: dados.telefone,
        cidade: dados.cidade,
        bairro: dados.bairro ?? null,
        avatar_url: dados.avatarUrl ?? null,
      })
      .select("*")
      .single();

    if (error) {
      // 23505 = violação de índice único. Aqui só pode ser o e-mail.
      if (error.code === "23505") throw new Error("email já cadastrado");
      throw erros.indisponivel(`criação de usuário: ${error.message}`);
    }

    return paraUsuario(data);
  }

  async atualizarSenhaHash(id: string, senhaHash: string): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("usuarios")
      .update({ senha_hash: senhaHash })
      .eq("id", id);

    if (error)
      throw erros.indisponivel(`atualização de senha: ${error.message}`);
  }

  async registrarAcesso(id: string): Promise<void> {
    const supabase = await cliente();
    // Falha aqui não pode derrubar o login: é telemetria, não autenticação.
    const { error } = await supabase
      .from("usuarios")
      .update({ ultimo_acesso_em: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      const { log } = await import("../logger");
      log.warn("não foi possível registrar o acesso", {
        acao: "repo.registrarAcesso",
        motivo: error.message,
      });
    }
  }

  async criarPerfilEmpresa(perfil: PerfilEmpresa): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("perfis_empresa").insert({
      usuario_id: perfil.usuarioId,
      razao_social: perfil.razaoSocial,
      cnpj: perfil.cnpj,
      setor: perfil.setor,
      porte: perfil.porte,
      site: perfil.site,
      descricao: perfil.descricao,
      logo_url: perfil.logoUrl,
      plano: perfil.plano,
    });

    if (error) throw erros.indisponivel(`perfil de empresa: ${error.message}`);
  }

  async criarPerfilPrestador(perfil: PerfilPrestador): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("perfis_prestador").insert({
      usuario_id: perfil.usuarioId,
      categoria_id: perfil.categoriaId,
      descricao: perfil.descricao,
      preco_inicial: perfil.precoInicial,
      anos_experiencia: perfil.anosExperiencia,
      bairros_atendidos: perfil.bairrosAtendidos,
    });

    if (error)
      throw erros.indisponivel(`perfil de prestador: ${error.message}`);
  }

  async criarPerfilCandidato(perfil: PerfilCandidato): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("perfis_candidato").insert({
      usuario_id: perfil.usuarioId,
      area_desejada: perfil.areaDesejada,
      resumo: perfil.resumo,
      curriculo_url: perfil.curriculoUrl,
      disponibilidade: perfil.disponibilidade,
    });

    if (error)
      throw erros.indisponivel(`perfil de candidato: ${error.message}`);
  }

  async cnpjEmUso(cnpj: string): Promise<boolean> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("perfis_empresa")
      .select("usuario_id")
      .eq("cnpj", cnpj)
      .maybeSingle();

    if (error) throw erros.indisponivel(`consulta de CNPJ: ${error.message}`);
    return Boolean(data);
  }
}
