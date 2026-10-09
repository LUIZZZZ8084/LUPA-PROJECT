import type { Experience } from "@/lib/types";
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
  avatarUrl: string | null;
  emailVerificado: boolean;
  telefoneVerificado: boolean;
  docVerificado: boolean;
  criadoEm: string;
  ultimoAcessoEm: string | null;
}

/** O que pode circular pela aplicação: sem hash de senha. */
/**
 * Para que serve um token de uso único (#227).
 *
 * A tabela nasceu só para recuperação de senha; a verificação de e-mail
 * usa exatamente o mesmo material — segredo aleatório, guardado em hash,
 * de uso único, com prazo. Uma tabela gêmea divergiria na primeira vez que
 * alguém mexesse num lado só.
 *
 * O que ela **não** pode ser é um token que serve para as duas coisas. O
 * de verificação é mandado com mais liberdade — no cadastro, e a cada
 * "reenviar" — e se ele também trocasse senha, cada reenvio seria mais um
 * link de redefinição circulando por aí.
 */
export type FinalidadeToken = "recuperacao" | "verificacao_email";

export interface NovoTokenDeRecuperacao {
  usuarioId: string;
  tokenHash: string;
  expiraEm: string;
  finalidade: FinalidadeToken;
}

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
  instagram: string | null;
  facebook: string | null;
  /**
   * CNPJ de quem presta serviço por uma empresa — MEI, ME, EIRELI, LTDA,
   * tanto faz (#138, corrigido na #140). O CPF em `usuarios` continua
   * sendo a verificação de base de todo prestador; isto é divulgação a
   * mais, nunca substituto. Pode morar aqui porque CNPJ é registro
   * público.
   */
  cnpj: string | null;
  /** Conferido na Receita: existe e está ativa. Não prova posse. */
  cnpjVerificado: boolean;
  /**
   * O nome que a Receita devolveu — não o que a pessoa digitou.
   *
   * É o que dá sentido ao número na tela: quem vai contratar lê o nome da
   * empresa e julga se combina com o serviço anunciado. `null` enquanto o
   * CNPJ não tiver sido conferido.
   */
  razaoSocial: string | null;
  /**
   * Até quando a mensalidade vale. `null` até a primeira cobrança
   * aprovada; passado o prazo, o perfil some da vitrine de `/servicos` —
   * o filtro mora em `getProviders`, não aqui, mesma razão de
   * `docVerified`.
   */
  mensalidadeValidaAte: string | null;
}

export interface PerfilCandidato {
  usuarioId: string;
  areaDesejada: string | null;
  resumo: string | null;
  curriculoUrl: string | null;
  disponibilidade: string | null;
  formacao: string | null;
  habilidades: string[];
  /**
   * Cargo, empresa, período e descrição opcional — mesmo shape da coluna
   * `experiencias`, que guarda o JSON com essas chaves em inglês porque a
   * view `company_applications` o embute direto em
   * `ApplicationWithCandidate.candidate.experiences`, sem tradução.
   */
  experiencias: Experience[];
  /** "Quero que empresas me encontrem." Falso por padrão. */
  visivelParaEmpresas: boolean;
  /**
   * Gerador de currículo pago (#47), liberado para sempre por uma compra
   * única — não expira e não precisa ser comprado de novo depois de
   * editar o perfil.
   */
  geradorCurriculoLiberado: boolean;
}

/* ============================================================
   Edição de perfil
   ============================================================ */

/**
 * Campos que todo papel edita, guardados em `usuarios`.
 *
 * O nome não está aqui (#315). Ele assina as avaliações, e quem podia
 * trocá-lo a qualquer hora avaliava cada prestador com um nome diferente.
 * Correção de nome é caso de suporte, como a cidade e o CNPJ.
 */
export interface EdicaoBasica {
  telefone: string;
}

export interface EdicaoCandidato {
  areaDesejada: string | null;
  resumo: string | null;
  formacao: string | null;
  habilidades: string[];
  experiencias: Experience[];
  disponibilidade: string | null;
  visivelParaEmpresas: boolean;
}

export interface EdicaoPrestador {
  categoriaId: number;
  descricao: string;
  precoInicial: number | null;
  anosExperiencia: number | null;
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
 *
 * O nome também fica (#315): é ele que assina vaga e avaliação. Só a
 * conferência na Receita o troca, por `definirRazaoSocialDaReceita`.
 */
export interface EdicaoEmpresa {
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
  /**
   * Grava a senha nova **e** corta as sessões antigas, na mesma instrução
   * (#225).
   *
   * As duas coisas andam juntas de propósito, e num lugar só: quem troca a
   * senha desconfiando de acesso indevido precisa que o invasor caia, e um
   * segundo método para "revogar" seria o que alguém esquece de chamar no
   * terceiro caminho de troca de senha. Este projeto já pagou por isso —
   * `virarPrestador` e `cadastrar`, duas funções irmãs, com a regra
   * corrigida só numa (#142).
   */
  atualizarSenhaHash(id: string, senhaHash: string): Promise<void>;

  /**
   * Regrava o hash **da mesma senha** com os parâmetros atuais do Argon2.
   *
   * Existe só para `entrar()`, quando `precisaRehash` diz que o hash foi
   * gerado com parâmetros antigos (#330). Não corta sessão nenhuma, e é
   * esse o ponto: a senha não mudou, ninguém está sendo expulso. Com
   * `atualizarSenhaHash` ali, o dia em que os parâmetros subissem cada
   * login derrubaria os outros aparelhos da pessoa.
   *
   * **Nunca para troca de senha.** Troca de senha corta as sessões, e é
   * `atualizarSenhaHash` que faz as duas coisas juntas — o aviso acima, da
   * #142, continua valendo para ela.
   */
  regravarHash(id: string, senhaHash: string): Promise<void>;

  /**
   * Quem cortou as próprias sessões nos últimos `dias`, como epoch de
   * segundos por usuário.
   *
   * Lista, e não pergunta por pessoa: perguntar "esta sessão vale?" a cada
   * requisição seria a consulta por requisição que manteve a sessão fora do
   * banco desde o começo. A lista é curta por construção — token com mais
   * de 7 dias já expirou sozinho, então quem trocou a senha mês passado
   * sai dela.
   */
  cortesDeSessao(dias: number): Promise<Map<string, number>>;

  /**
   * Corta as sessões da pessoa sem trocar a senha (#402) — "sair dos
   * outros aparelhos". É o mesmo corte que a troca de senha e a de papel
   * gravam; quem chama emite a sessão nova do aparelho atual **depois**.
   */
  cortarSessoes(id: string): Promise<void>;

  // ── Recuperação de senha (#174) ───────────────────────────────────────

  /**
   * Guarda o **hash** do token, nunca o token.
   *
   * Quem lesse a tabela poderia trocar a senha de qualquer conta; o valor
   * original só existe no e-mail que a pessoa recebeu.
   *
   * **E aposenta os anteriores** da mesma pessoa e finalidade (#398). Quem
   * pede um link novo é porque o antigo se perdeu — ou foi parar onde não
   * devia. Sem isso, o link de recuperação de uma hora atrás continuava
   * trocando a senha depois de a pessoa ter pedido outro.
   */
  criarTokenDeRecuperacao(dados: NovoTokenDeRecuperacao): Promise<void>;

  /**
   * Gasta o token, e só se ele ainda valer.
   *
   * Devolve `null` quando o token não existe, já foi usado ou expirou —
   * os três são a mesma coisa para quem chama, e distinguir daria a quem
   * sonda um link a informação de que ele já existiu.
   *
   * A validação e o consumo acontecem na **mesma instrução**: dois
   * cliques no mesmo link, ou um link vazado sendo usado em paralelo,
   * passariam os dois por uma leitura anterior.
   */
  consumirTokenDeRecuperacao(
    tokenHash: string,
    finalidade: FinalidadeToken,
  ): Promise<{ usuarioId: string } | null>;

  /** Marca o e-mail como confirmado (#227). */
  definirEmailVerificado(id: string): Promise<void>;
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
   * Grava o CNPJ do prestador, com o que a Receita respondeu sobre ele.
   *
   * `null` apaga os três — volta a ser só pessoa física. Vão juntos
   * porque o número sem o resultado da conferência não diz nada, e o
   * nome sem o número não tem a que se referir: é o mesmo raciocínio de
   * `definirCpf` + `definirDocVerificado`, numa gravação só.
   */
  definirCnpjPrestador(
    usuarioId: string,
    cnpj: string | null,
    verificado: boolean,
    razaoSocial: string | null,
  ): Promise<void>;

  /**
   * Grava a nova validade da mensalidade. Quem decide a data — hoje mais
   * 30 dias, ou o prazo que já valia mais 30, para quem renova antes de
   * vencer não perder dias já pagos — é o serviço; o repositório só
   * grava o que chegou pronto.
   */
  /**
   * `null` revoga: é assim que o estorno tira a mensalidade (#166). Sem
   * aceitar `null`, revogar viraria gravar uma data no passado — que
   * funciona por acidente e mente sobre o que aconteceu.
   */
  definirMensalidadeValidaAte(
    usuarioId: string,
    ate: string | null,
  ): Promise<void>;

  /**
   * Estende a mensalidade do prestador **de forma atômica** (#348).
   *
   * A conta — `max(agora, prazo atual) + dias`, para quem renova antes de
   * vencer não perder os dias já pagos — acontece dentro de uma instrução
   * do banco, e não lendo-computando-gravando na aplicação: duas extensões
   * concorrentes para o mesmo prestador leriam a mesma base e uma se
   * perderia. É o mesmo cuidado de `creditar_vaga` e da mensalidade do
   * plano de vaga.
   *
   * `dias = null` revoga (o estorno tira a mensalidade na hora). Devolve
   * `false` quando não há perfil de prestador — o serviço traduz isso no
   * 404 de sempre.
   */
  estenderMensalidadePrestador(
    usuarioId: string,
    dias: number | null,
  ): Promise<boolean>;

  /**
   * A pessoa já usou o teste grátis da mensalidade? (#392)
   *
   * Decide, ao criar a assinatura, se o Mercado Pago recebe `free_trial`: quem
   * já usou assina e é cobrada na hora.
   */
  testeGratisJaUsado(usuarioId: string): Promise<boolean>;

  /**
   * Reivindica o teste grátis, de forma atômica (#392).
   *
   * Devolve `true` para quem o reivindicou agora e `false` se ele já tinha
   * sido usado. É uma instrução só (`where teste_gratis_usado_em is null`), e
   * não "lê, decide, grava": duas ativações simultâneas leriam as duas "não
   * usou" e concederiam o teste duas vezes.
   */
  reivindicarTesteGratis(usuarioId: string): Promise<boolean>;

  /**
   * Devolve o teste grátis reivindicado agora há pouco (#406).
   *
   * Só para quando a extensão dos dias falha logo depois da reivindicação:
   * sem isto, o teste fica gasto sem ter dado nada, e o reenvio do webhook
   * não tem como concedê-lo de novo.
   */
  liberarTesteGratis(usuarioId: string): Promise<void>;

  /**
   * Liga ou desliga o gerador de currículo (#47) — compra única, sem data
   * de validade para gravar, ao contrário da mensalidade.
   */
  definirGeradorCurriculoLiberado(
    usuarioId: string,
    liberado: boolean,
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

  /**
   * A razão social oficial no lugar do nome digitado (#130), e a única
   * troca de nome de empresa que existe (#315). As avaliações que a
   * empresa já fez acompanham pela `renomearAvaliacoesDe`, que é de quem
   * conhece a tabela de avaliações.
   */
  definirRazaoSocialDaReceita(
    usuarioId: string,
    razaoSocial: string,
  ): Promise<void>;

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
