import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import type { Papel } from "../auth/rbac";
import { erros } from "../errors";
import type {
  DadosNovoUsuario,
  EdicaoBasica,
  EdicaoCandidato,
  EdicaoEmpresa,
  EdicaoPrestador,
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
    cpf: (linha.cpf as string | null) ?? null,
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

/**
 * Chave de serviço, não a anônima.
 *
 *  guarda hash de senha e fica sem policy de RLS — a chave
 * anônima não lê nem escreve nada lá, de propósito. Só o servidor alcança.
 */
async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) {
    throw erros.indisponivel("chave de serviço do Supabase não configurada");
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
        cpf: dados.cpf ?? null,
        telefone: dados.telefone,
        cidade: dados.cidade,
        bairro: dados.bairro ?? null,
        avatar_url: dados.avatarUrl ?? null,
      })
      .select("*")
      .single();

    if (error) {
      /*
       * 23505 = violação de índice único. Antes só podia ser o e-mail;
       * agora o CPF também entra nesta mesma inserção, então o índice que
       * a mensagem do Postgres nomeia é quem decide qual.
       *
       * A checagem em `cadastrar` já barra os dois casos antes de chegar
       * aqui — isto é o desempate de uma corrida entre duas inserções
       * simultâneas, não o caminho normal.
       */
      if (error.code === "23505") {
        throw new Error(
          error.message.includes("cpf")
            ? "cpf já cadastrado"
            : "email já cadastrado",
        );
      }
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

  async atualizarPapel(id: string, papel: Papel): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("usuarios")
      .update({ papel })
      .eq("id", id);

    /*
     * Aqui a falha derruba, ao contrário de `registrarAcesso`: quem chama
     * isto vai reemitir a sessão logo em seguida. Gravar o papel novo no
     * cookie sem ter gravado no banco deixaria a pessoa com capacidades
     * que o banco não reconhece — e o desencontro só apareceria no próximo
     * login, dias depois.
     */
    if (error) throw erros.indisponivel(`troca de papel: ${error.message}`);
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
      instagram: perfil.instagram,
      facebook: perfil.facebook,
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
      instagram: perfil.instagram,
      facebook: perfil.facebook,
      cnpj: perfil.cnpj,
      cnpj_verificado: perfil.cnpjVerificado,
      razao_social: perfil.razaoSocial,
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
      visivel_para_empresas: perfil.visivelParaEmpresas,
    });

    if (error)
      throw erros.indisponivel(`perfil de candidato: ${error.message}`);
  }

  /*
   * Existe só para satisfazer o contrato: com banco, quem lê os candidatos
   * visíveis é a view `candidatos_disponiveis`, cujo `where` é a fechadura.
   * Duplicar o filtro aqui daria dois lugares para ele divergir.
   */
  async candidatosVisiveis(): Promise<
    { usuario: Usuario; perfil: PerfilCandidato }[]
  > {
    return [];
  }

  /**
   * Confere nos dois perfis que podem ter CNPJ — empresa e prestador
   * MEI —, porque o mesmo número não pode servir para dois papéis
   * diferentes.
   */
  async cnpjEmUso(cnpj: string, exceto?: string): Promise<boolean> {
    const supabase = await cliente();

    let consultaEmpresa = supabase
      .from("perfis_empresa")
      .select("usuario_id")
      .eq("cnpj", cnpj);
    if (exceto) consultaEmpresa = consultaEmpresa.neq("usuario_id", exceto);

    let consultaPrestador = supabase
      .from("perfis_prestador")
      .select("usuario_id")
      .eq("cnpj", cnpj);
    if (exceto) {
      consultaPrestador = consultaPrestador.neq("usuario_id", exceto);
    }

    const [empresa, prestador] = await Promise.all([
      consultaEmpresa.maybeSingle(),
      consultaPrestador.maybeSingle(),
    ]);

    if (empresa.error || prestador.error) {
      const msg = (empresa.error ?? prestador.error)?.message;
      throw erros.indisponivel(`consulta de CNPJ: ${msg}`);
    }

    return Boolean(empresa.data) || Boolean(prestador.data);
  }

  async cpfEmUso(cpf: string): Promise<boolean> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("usuarios")
      .select("id")
      .eq("cpf", cpf)
      .maybeSingle();

    if (error) throw erros.indisponivel(`consulta de CPF: ${error.message}`);
    return Boolean(data);
  }

  async definirCpf(id: string, cpf: string): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("usuarios")
      .update({ cpf })
      .eq("id", id);

    if (error) throw erros.indisponivel(`gravação de CPF: ${error.message}`);
  }

  async definirDocVerificado(id: string, verificado: boolean): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("usuarios")
      .update({ doc_verificado: verificado })
      .eq("id", id);

    if (error) {
      throw erros.indisponivel(`verificação de documento: ${error.message}`);
    }
  }

  async definirCnpjPrestador(
    usuarioId: string,
    cnpj: string | null,
    verificado: boolean,
    razaoSocial: string | null,
  ): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("perfis_prestador")
      .update({
        cnpj,
        cnpj_verificado: verificado,
        razao_social: razaoSocial,
      })
      .eq("usuario_id", usuarioId);

    if (error) {
      throw erros.indisponivel(`CNPJ de prestador: ${error.message}`);
    }
  }

  /* ---------- Leitura de perfil, para a tela de edição ---------- */

  async perfilEmpresa(usuarioId: string): Promise<PerfilEmpresa | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("perfis_empresa")
      .select("*")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (error) throw erros.indisponivel(`perfil de empresa: ${error.message}`);
    if (!data) return null;

    return {
      usuarioId: String(data.usuario_id),
      razaoSocial: String(data.razao_social),
      cnpj: (data.cnpj as string | null) ?? null,
      setor: (data.setor as string | null) ?? null,
      porte: (data.porte as string | null) ?? null,
      site: (data.site as string | null) ?? null,
      instagram: (data.instagram as string | null) ?? null,
      facebook: (data.facebook as string | null) ?? null,
      descricao: (data.descricao as string | null) ?? null,
      logoUrl: (data.logo_url as string | null) ?? null,
      plano: data.plano as PerfilEmpresa["plano"],
    };
  }

  async perfilPrestador(usuarioId: string): Promise<PerfilPrestador | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("perfis_prestador")
      .select("*")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (error)
      throw erros.indisponivel(`perfil de prestador: ${error.message}`);
    if (!data) return null;

    return {
      usuarioId: String(data.usuario_id),
      categoriaId: Number(data.categoria_id),
      descricao: (data.descricao as string | null) ?? null,
      precoInicial:
        data.preco_inicial === null ? null : Number(data.preco_inicial),
      anosExperiencia:
        data.anos_experiencia === null ? null : Number(data.anos_experiencia),
      bairrosAtendidos: (data.bairros_atendidos as string[] | null) ?? [],
      instagram: (data.instagram as string | null) ?? null,
      facebook: (data.facebook as string | null) ?? null,
      cnpj: (data.cnpj as string | null) ?? null,
      cnpjVerificado: Boolean(data.cnpj_verificado),
      razaoSocial: (data.razao_social as string | null) ?? null,
    };
  }

  async perfilCandidato(usuarioId: string): Promise<PerfilCandidato | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("perfis_candidato")
      .select("*")
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (error)
      throw erros.indisponivel(`perfil de candidato: ${error.message}`);
    if (!data) return null;

    return {
      usuarioId: String(data.usuario_id),
      areaDesejada: (data.area_desejada as string | null) ?? null,
      resumo: (data.resumo as string | null) ?? null,
      curriculoUrl: (data.curriculo_url as string | null) ?? null,
      disponibilidade: (data.disponibilidade as string | null) ?? null,
      formacao: (data.formacao as string | null) ?? null,
      habilidades: (data.habilidades as string[] | null) ?? [],
      visivelParaEmpresas: Boolean(data.visivel_para_empresas),
    };
  }

  /* ---------- Edição ---------- */

  async atualizarBasicos(
    usuarioId: string,
    dados: EdicaoBasica,
  ): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("usuarios")
      .update({
        nome_completo: dados.nomeCompleto,
        telefone: dados.telefone,
        bairro: dados.bairro,
      })
      .eq("id", usuarioId);

    if (error) throw erros.indisponivel(`edição de conta: ${error.message}`);
  }

  /*
   * `upsert` e não `update`: conta criada antes de o campo existir, ou
   * cadastro que não pedia aquele dado, chega aqui sem linha na tabela de
   * perfil. Um `update` não afetaria nada e a tela diria "salvo" sem ter
   * salvo — o pior dos dois mundos.
   */
  async salvarPerfilCandidato(
    usuarioId: string,
    dados: EdicaoCandidato,
  ): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("perfis_candidato").upsert(
      {
        usuario_id: usuarioId,
        area_desejada: dados.areaDesejada,
        resumo: dados.resumo,
        formacao: dados.formacao,
        habilidades: dados.habilidades,
        disponibilidade: dados.disponibilidade,
        visivel_para_empresas: dados.visivelParaEmpresas,
      },
      { onConflict: "usuario_id" },
    );

    if (error)
      throw erros.indisponivel(`perfil de candidato: ${error.message}`);
  }

  async salvarPerfilPrestador(
    usuarioId: string,
    dados: EdicaoPrestador,
  ): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.from("perfis_prestador").upsert(
      {
        usuario_id: usuarioId,
        categoria_id: dados.categoriaId,
        descricao: dados.descricao,
        preco_inicial: dados.precoInicial,
        anos_experiencia: dados.anosExperiencia,
        bairros_atendidos: dados.bairrosAtendidos,
        instagram: dados.instagram,
        facebook: dados.facebook,
      },
      { onConflict: "usuario_id" },
    );

    if (error)
      throw erros.indisponivel(`perfil de prestador: ${error.message}`);
  }

  /*
   * `update` e não `upsert`: a linha da empresa carrega o CNPJ, que não é
   * editável. Criar aqui exigiria inventar um, e uma empresa sem CNPJ é
   * exatamente o que a plataforma não pode ter.
   */
  async salvarPerfilEmpresa(
    usuarioId: string,
    dados: EdicaoEmpresa,
  ): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("perfis_empresa")
      .update({
        razao_social: dados.razaoSocial,
        setor: dados.setor,
        porte: dados.porte,
        site: dados.site,
        instagram: dados.instagram,
        facebook: dados.facebook,
        descricao: dados.descricao,
      })
      .eq("usuario_id", usuarioId);

    if (error) throw erros.indisponivel(`perfil de empresa: ${error.message}`);
  }

  /* ---------- Arquivos ---------- */

  async definirAvatar(usuarioId: string, url: string | null): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("usuarios")
      .update({ avatar_url: url })
      .eq("id", usuarioId);

    if (error) throw erros.indisponivel(`avatar: ${error.message}`);
  }

  async definirCurriculo(
    usuarioId: string,
    caminho: string | null,
  ): Promise<void> {
    const supabase = await cliente();
    /*
     * `upsert`: quem nunca preencheu o currículo em texto não tem linha, e
     * um `update` não afetaria nada — a tela diria "enviado" sem ter
     * guardado a referência, e o arquivo ficaria órfão no bucket.
     */
    const { error } = await supabase
      .from("perfis_candidato")
      .upsert(
        { usuario_id: usuarioId, curriculo_url: caminho },
        { onConflict: "usuario_id" },
      );

    if (error) throw erros.indisponivel(`currículo: ${error.message}`);
  }

  async definirLogo(usuarioId: string, url: string | null): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("perfis_empresa")
      .update({ logo_url: url })
      .eq("usuario_id", usuarioId);

    if (error) throw erros.indisponivel(`logo: ${error.message}`);
  }
}
