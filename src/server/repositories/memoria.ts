import type { Papel } from "../auth/rbac";
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
 * Repositório em memória.
 *
 * Serve a dois propósitos:
 *
 * 1. Modo demonstração. Sem Supabase configurado, dá para criar conta,
 *    entrar e navegar como usuário logado. É o que permite mostrar o
 *    produto funcionando antes de existir infraestrutura.
 * 2. Testes. A mesma lógica de cadastro e login roda contra este
 *    repositório, então o que os testes cobrem é o caminho real.
 *
 * O que ele não é: armazenamento. Em serverless, cada instância tem a sua
 * cópia e tudo some no próximo cold start. A interface avisa isso no nome.
 */
export class RepositorioMemoria implements RepositorioUsuarios {
  private usuarios = new Map<string, Usuario>();
  private porEmailIndice = new Map<string, string>();
  private cnpjs = new Set<string>();
  private cpfs = new Set<string>();

  private empresas = new Map<string, PerfilEmpresa>();
  private prestadores = new Map<string, PerfilPrestador>();
  private candidatos = new Map<string, PerfilCandidato>();

  async porEmail(email: string): Promise<Usuario | null> {
    const id = this.porEmailIndice.get(email.toLowerCase());
    return id ? (this.usuarios.get(id) ?? null) : null;
  }

  async porId(id: string): Promise<Usuario | null> {
    return this.usuarios.get(id) ?? null;
  }

  async criar(dados: DadosNovoUsuario): Promise<Usuario> {
    const email = dados.email.toLowerCase();

    // O índice único também existe no Postgres; aqui é a mesma garantia,
    // para que o teste de e-mail duplicado exercite o mesmo caminho.
    if (this.porEmailIndice.has(email)) {
      throw new Error("email já cadastrado");
    }

    const usuario: Usuario = {
      id: crypto.randomUUID(),
      email,
      senhaHash: dados.senhaHash,
      papel: dados.papel,
      nomeCompleto: dados.nomeCompleto,
      cpf: null,
      telefone: dados.telefone,
      cidade: dados.cidade,
      bairro: dados.bairro ?? null,
      avatarUrl: dados.avatarUrl ?? null,
      emailVerificado: false,
      telefoneVerificado: false,
      docVerificado: false,
      criadoEm: new Date().toISOString(),
      ultimoAcessoEm: null,
    };

    this.usuarios.set(usuario.id, usuario);
    this.porEmailIndice.set(email, usuario.id);
    return usuario;
  }

  async atualizarSenhaHash(id: string, senhaHash: string): Promise<void> {
    const usuario = this.usuarios.get(id);
    if (usuario) this.usuarios.set(id, { ...usuario, senhaHash });
  }

  async atualizarPapel(id: string, papel: Papel): Promise<void> {
    const usuario = this.usuarios.get(id);
    if (usuario) this.usuarios.set(id, { ...usuario, papel });
  }

  async registrarAcesso(id: string): Promise<void> {
    const usuario = this.usuarios.get(id);
    if (usuario) {
      this.usuarios.set(id, {
        ...usuario,
        ultimoAcessoEm: new Date().toISOString(),
      });
    }
  }

  async criarPerfilEmpresa(perfil: PerfilEmpresa): Promise<void> {
    this.empresas.set(perfil.usuarioId, perfil);
    this.cnpjs.add(perfil.cnpj);
  }

  async criarPerfilPrestador(perfil: PerfilPrestador): Promise<void> {
    this.prestadores.set(perfil.usuarioId, perfil);
  }

  async criarPerfilCandidato(perfil: PerfilCandidato): Promise<void> {
    this.candidatos.set(perfil.usuarioId, perfil);
  }

  async candidatosVisiveis(): Promise<
    { usuario: Usuario; perfil: PerfilCandidato }[]
  > {
    const saida: { usuario: Usuario; perfil: PerfilCandidato }[] = [];

    for (const [usuarioId, perfil] of this.candidatos) {
      if (!perfil.visivelParaEmpresas) continue;
      const usuario = this.usuarios.get(usuarioId);
      if (usuario?.papel === "candidato_clt") saida.push({ usuario, perfil });
    }

    return saida;
  }

  async cnpjEmUso(cnpj: string): Promise<boolean> {
    return this.cnpjs.has(cnpj);
  }

  async cpfEmUso(cpf: string): Promise<boolean> {
    return this.cpfs.has(cpf);
  }

  async definirCpf(id: string, cpf: string): Promise<void> {
    const usuario = this.usuarios.get(id);
    if (!usuario) return;
    this.usuarios.set(id, { ...usuario, cpf });
    this.cpfs.add(cpf);
  }

  async definirDocVerificado(id: string, verificado: boolean): Promise<void> {
    const usuario = this.usuarios.get(id);
    if (!usuario) return;
    this.usuarios.set(id, { ...usuario, docVerificado: verificado });
  }

  /* ---------- Leitura de perfil ---------- */

  async perfilEmpresa(usuarioId: string): Promise<PerfilEmpresa | null> {
    return this.empresas.get(usuarioId) ?? null;
  }

  async perfilPrestador(usuarioId: string): Promise<PerfilPrestador | null> {
    return this.prestadores.get(usuarioId) ?? null;
  }

  async perfilCandidato(usuarioId: string): Promise<PerfilCandidato | null> {
    return this.candidatos.get(usuarioId) ?? null;
  }

  /* ---------- Edição de perfil ---------- */

  async atualizarBasicos(
    usuarioId: string,
    dados: EdicaoBasica,
  ): Promise<void> {
    const usuario = this.usuarios.get(usuarioId);
    if (!usuario) return;
    this.usuarios.set(usuarioId, { ...usuario, ...dados });
  }

  async salvarPerfilCandidato(
    usuarioId: string,
    dados: EdicaoCandidato,
  ): Promise<void> {
    const atual = this.candidatos.get(usuarioId);
    this.candidatos.set(usuarioId, {
      usuarioId,
      curriculoUrl: atual?.curriculoUrl ?? null,
      ...dados,
    });
  }

  async salvarPerfilPrestador(
    usuarioId: string,
    dados: EdicaoPrestador,
  ): Promise<void> {
    this.prestadores.set(usuarioId, { usuarioId, ...dados });
  }

  async salvarPerfilEmpresa(
    usuarioId: string,
    dados: EdicaoEmpresa,
  ): Promise<void> {
    const atual = this.empresas.get(usuarioId);
    if (!atual) return;
    this.empresas.set(usuarioId, { ...atual, ...dados });
  }

  /* ---------- Arquivos ---------- */

  async definirAvatar(usuarioId: string, url: string | null): Promise<void> {
    const usuario = this.usuarios.get(usuarioId);
    if (!usuario) return;
    this.usuarios.set(usuarioId, { ...usuario, avatarUrl: url });
  }

  async definirCurriculo(
    usuarioId: string,
    caminho: string | null,
  ): Promise<void> {
    const atual = this.candidatos.get(usuarioId);
    if (!atual) return;
    this.candidatos.set(usuarioId, { ...atual, curriculoUrl: caminho });
  }

  async definirLogo(usuarioId: string, url: string | null): Promise<void> {
    const atual = this.empresas.get(usuarioId);
    if (!atual) return;
    this.empresas.set(usuarioId, { ...atual, logoUrl: url });
  }

  /** Todos os usuários. Usado pelas métricas do painel administrativo. */
  todos(): Usuario[] {
    return [...this.usuarios.values()];
  }

  limpar(): void {
    this.usuarios.clear();
    this.porEmailIndice.clear();
    this.cnpjs.clear();
    this.empresas.clear();
    this.prestadores.clear();
    this.candidatos.clear();
  }

  get total(): number {
    return this.usuarios.size;
  }
}
