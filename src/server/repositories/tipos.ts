import type { Papel } from "../auth/rbac";

/**
 * Contrato de persistência.
 *
 * A interface existe para que a lógica de cadastro e login seja testável
 * sem banco, e para que o modo demonstração continue funcionando. As duas
 * implementações — memória e Postgres — respondem exatamente ao mesmo
 * contrato, então o que os testes exercitam é o mesmo caminho que roda em
 * produção.
 */

export interface Usuario {
  id: string;
  email: string;
  /** Nunca sai deste módulo para cima. */
  senhaHash: string;
  papel: Papel;
  nomeCompleto: string;
  telefone: string;
  cidade: string;
  bairro: string | null;
  avatarUrl: string | null;
  emailVerificado: boolean;
  telefoneVerificado: boolean;
  docVerificado: boolean;
  criadoEm: string;
  ultimoAcessoEm: string | null;
}

/** O que pode circular pela aplicação: sem hash de senha. */
export type UsuarioPublico = Omit<Usuario, "senhaHash">;

export function semSenha(usuario: Usuario): UsuarioPublico {
  const { senhaHash: _, ...resto } = usuario;
  return resto;
}

export interface DadosNovoUsuario {
  email: string;
  senhaHash: string;
  papel: Papel;
  nomeCompleto: string;
  telefone: string;
  cidade: string;
  bairro?: string | null;
  avatarUrl?: string | null;
}

export interface PerfilEmpresa {
  usuarioId: string;
  razaoSocial: string;
  cnpj: string;
  setor: string | null;
  porte: string | null;
  site: string | null;
  descricao: string | null;
  logoUrl: string | null;
  plano: "trial" | "mensal";
}

export interface PerfilPrestador {
  usuarioId: string;
  categoriaId: number;
  descricao: string | null;
  precoInicial: number | null;
  anosExperiencia: number | null;
  bairrosAtendidos: string[];
}

export interface PerfilCandidato {
  usuarioId: string;
  areaDesejada: string | null;
  resumo: string | null;
  curriculoUrl: string | null;
  disponibilidade: string | null;
}

export interface RepositorioUsuarios {
  porEmail(email: string): Promise<Usuario | null>;
  porId(id: string): Promise<Usuario | null>;
  criar(dados: DadosNovoUsuario): Promise<Usuario>;
  atualizarSenhaHash(id: string, senhaHash: string): Promise<void>;
  registrarAcesso(id: string): Promise<void>;

  criarPerfilEmpresa(perfil: PerfilEmpresa): Promise<void>;
  criarPerfilPrestador(perfil: PerfilPrestador): Promise<void>;
  criarPerfilCandidato(perfil: PerfilCandidato): Promise<void>;

  /** Para o cadastro de empresa: CNPJ é único na plataforma. */
  cnpjEmUso(cnpj: string): Promise<boolean>;
}
