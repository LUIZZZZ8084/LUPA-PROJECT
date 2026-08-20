import type {
  DadosNovoUsuario,
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

  async cnpjEmUso(cnpj: string): Promise<boolean> {
    return this.cnpjs.has(cnpj);
  }

  /* ---------- Só para teste e para o seed da demonstração ---------- */

  async perfilEmpresa(usuarioId: string): Promise<PerfilEmpresa | null> {
    return this.empresas.get(usuarioId) ?? null;
  }

  async perfilPrestador(usuarioId: string): Promise<PerfilPrestador | null> {
    return this.prestadores.get(usuarioId) ?? null;
  }

  async perfilCandidato(usuarioId: string): Promise<PerfilCandidato | null> {
    return this.candidatos.get(usuarioId) ?? null;
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
