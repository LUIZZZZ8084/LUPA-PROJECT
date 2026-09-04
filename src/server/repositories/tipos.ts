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
  /**
   * CPF de quem oferece serviço, só em dígitos.
   *
   * Mora aqui e não em `PerfilPrestador` por privacidade, não por
   * arrumação: `perfis_prestador` é lida pela chave anônima, que vai para
   * o navegador; `usuarios` só pela chave de serviço. CNPJ é registro
   * público e pode ficar exposto — CPF não.
   *
   * Nulo para quem não é prestador e para quem virou antes do campo
   * existir.
   */
  cpf: string | null;
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
  /**
   * Obrigatório para candidato e prestador desde que o cadastro passou a
   * exigir CPF; `null` só sobra para empresa, que se identifica por CNPJ.
   */
  cpf?: string | null;
  telefone: string;
  cidade: string;
  bairro?: string | null;
  avatarUrl?: string | null;
}

export interface PerfilEmpresa {
  usuarioId: string;
  razaoSocial: string;
  /**
   * Opcional desde 03/09/2026 (#138): contratante pode ser produtor rural
   * ou autônomo, com CPF em vez de CNPJ. `null` significa que o
   * documento é o CPF em `usuarios` — nunca gravado aqui, que é lido pela
   * chave anônima.
   */
  cnpj: string | null;
  setor: string | null;
  porte: string | null;
  site: string | null;
  instagram: string | null;
  facebook: string | null;
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
  instagram: string | null;
  facebook: string | null;
  /**
   * CNPJ de quem é MEI, além de pessoa física — opcional, desde
   * 03/09/2026 (#138). O CPF em `usuarios` continua sendo a verificação
   * de base de todo prestador; isto é selo adicional ("MEI confirmado"),
   * nunca substituto. Pode morar aqui porque CNPJ é registro público.
   */
  cnpj: string | null;
  /** Confirmado na Receita — existe, está ativa, o nome bate. */
  cnpjVerificado: boolean;
}

export interface PerfilCandidato {
  usuarioId: string;
  areaDesejada: string | null;
  resumo: string | null;
  curriculoUrl: string | null;
  disponibilidade: string | null;
  formacao: string | null;
  habilidades: string[];
  /** "Quero que empresas me encontrem." Falso por padrão. */
  visivelParaEmpresas: boolean;
}

/* ============================================================
   Edição de perfil
   ============================================================ */

/** Campos que todo papel edita, guardados em `usuarios`. */
export interface EdicaoBasica {
  nomeCompleto: string;
  telefone: string;
  bairro: string | null;
}

export interface EdicaoCandidato {
  areaDesejada: string | null;
  resumo: string | null;
  formacao: string | null;
  habilidades: string[];
  disponibilidade: string | null;
  visivelParaEmpresas: boolean;
}

export interface EdicaoPrestador {
  categoriaId: number;
  descricao: string;
  precoInicial: number | null;
  anosExperiencia: number | null;
  bairrosAtendidos: string[];
  instagram: string | null;
  facebook: string | null;
}

/**
 * O CNPJ fica de fora de propósito.
 *
 * Ele é a âncora de identidade da empresa e o que separa vaga real de
 * anúncio falso — o risco mais concreto numa plataforma de emprego. Deixar
 * trocar depois permitiria cadastrar com um CNPJ válido, passar pela
 * verificação, e então virar outra empresa. Correção de CNPJ é caso de
 * suporte, com gente olhando.
 */
export interface EdicaoEmpresa {
  razaoSocial: string;
  setor: string | null;
  porte: string | null;
  site: string | null;
  instagram: string | null;
  facebook: string | null;
  descricao: string | null;
}

export interface RepositorioUsuarios {
  porEmail(email: string): Promise<Usuario | null>;
  porId(id: string): Promise<Usuario | null>;
  criar(dados: DadosNovoUsuario): Promise<Usuario>;
  atualizarSenhaHash(id: string, senhaHash: string): Promise<void>;
  registrarAcesso(id: string): Promise<void>;

  /**
   * Troca o papel de uma conta que já existe.
   *
   * Existe para o candidato que vira prestador. O papel é a chave de todo
   * o RBAC, então quem chama isto tem duas obrigações: avisar a pessoa do
   * que ela perde, e reemitir a sessão — o papel vai dentro do JWT, e sem
   * reemitir ela ficaria com as capacidades antigas até o token expirar.
   */
  atualizarPapel(id: string, papel: Papel): Promise<void>;

  criarPerfilEmpresa(perfil: PerfilEmpresa): Promise<void>;
  criarPerfilPrestador(perfil: PerfilPrestador): Promise<void>;
  criarPerfilCandidato(perfil: PerfilCandidato): Promise<void>;

  /**
   * Para o cadastro de empresa e para o CNPJ de MEI do prestador: CNPJ é
   * único na plataforma, não importa o papel de quem o declarou.
   *
   * `exceto` exclui um usuário da checagem — para quem está regravando o
   * próprio CNPJ sem mudar o número, o que não pode contar como colisão.
   */
  cnpjEmUso(cnpj: string, exceto?: string): Promise<boolean>;

  /**
   * Mesma regra do CNPJ: um CPF, uma conta.
   *
   * Consultado no cadastro de candidato e prestador, e de novo em
   * `virarPrestador` — para quem criou a conta antes de o CPF virar
   * obrigatório e ainda não tem um gravado.
   */
  cpfEmUso(cpf: string): Promise<boolean>;

  /**
   * Grava o CPF de quem virou prestador sem ter um no cadastro.
   *
   * Separado de `atualizarPapel` porque são duas garantias diferentes, e
   * quem lê o serviço precisa ver as duas acontecendo. Quem já se
   * cadastrou com CPF não passa por aqui de novo — ver `virarPrestador`.
   */
  definirCpf(id: string, cpf: string): Promise<void>;

  /**
   * Marca a conta como verificada, sem passar pela fila do admin.
   *
   * Existe para a conferência automática de CNPJ: quando a Receita
   * responde que a empresa existe, está ativa e tem aquela razão social,
   * não há o que um humano acrescentar olhando um documento.
   *
   * Continua sendo escrita com dono — quem chama confere a sessão antes.
   */
  definirDocVerificado(id: string, verificado: boolean): Promise<void>;

  /**
   * Grava o CNPJ de MEI do prestador, com o resultado da verificação.
   *
   * `null` apaga o CNPJ — volta a ser só pessoa física. Os dois campos
   * juntos porque o CNPJ sem o resultado da checagem não diz nada: é o
   * mesmo raciocínio de `definirCpf` + `definirDocVerificado`, só que
   * numa gravação só, já que aqui as duas sempre mudam juntas.
   */
  definirCnpjPrestador(
    usuarioId: string,
    cnpj: string | null,
    verificado: boolean,
  ): Promise<void>;

  /**
   * Candidatos que ligaram "quero que empresas me encontrem".
   *
   * Só existe para o modo demonstração: com banco, a view
   * `candidatos_disponiveis` já faz o filtro, e fazer o filtro no banco é
   * o que impede um esquecimento na aplicação de revelar quem não
   * consentiu.
   */
  candidatosVisiveis(): Promise<
    { usuario: Usuario; perfil: PerfilCandidato }[]
  >;

  /* ---------- Leitura de perfil, para a tela de edição ---------- */

  perfilEmpresa(usuarioId: string): Promise<PerfilEmpresa | null>;
  perfilPrestador(usuarioId: string): Promise<PerfilPrestador | null>;
  perfilCandidato(usuarioId: string): Promise<PerfilCandidato | null>;

  /* ---------- Edição ---------- */

  atualizarBasicos(usuarioId: string, dados: EdicaoBasica): Promise<void>;

  /**
   * Grava mesmo que o perfil ainda não exista.
   *
   * Conta criada antes de o campo existir, ou cadastro que não pedia
   * aquele dado, chega aqui sem linha na tabela de perfil. Falhar nesse
   * caso obrigaria a pessoa a "criar" antes de "editar" — distinção que só
   * faz sentido para quem escreveu o banco.
   */
  salvarPerfilCandidato(
    usuarioId: string,
    dados: EdicaoCandidato,
  ): Promise<void>;
  salvarPerfilPrestador(
    usuarioId: string,
    dados: EdicaoPrestador,
  ): Promise<void>;
  salvarPerfilEmpresa(usuarioId: string, dados: EdicaoEmpresa): Promise<void>;

  /* ---------- Arquivos ---------- */

  /**
   * Guarda a referência do arquivo; o arquivo em si vive no Storage.
   *
   * `null` apaga a referência — é como a remoção chega aqui. O objeto no
   * bucket é apagado à parte, pelo serviço de arquivos: banco e Storage são
   * dois sistemas, e fingir que a gravação é atômica esconderia o caso em
   * que um dos dois falha.
   */
  definirAvatar(usuarioId: string, url: string | null): Promise<void>;
  definirCurriculo(usuarioId: string, caminho: string | null): Promise<void>;
  definirLogo(usuarioId: string, url: string | null): Promise<void>;
}
