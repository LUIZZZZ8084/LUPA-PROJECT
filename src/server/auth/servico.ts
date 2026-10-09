import { AppError, erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { semSenha, type UsuarioPublico } from "../repositories/tipos";
import {
  conferirSenha,
  gastarTempoDeVerificacao,
  gerarHash,
  precisaRehash,
} from "./password";
import {
  conferirLimite,
  consumirOrcamento,
  registrarFalha,
  registrarSucesso,
  reservarTentativa,
} from "./rate-limit";
import { LIMITE_DE_CONFLITOS_NO_CADASTRO } from "./rate-limit-tipos";
import type { DadosCadastro, DadosLogin } from "./schemas";

/**
 * Regras de cadastro e login.
 *
 * Sem `next/headers` nem cookie: só a decisão de negócio. Quem grava o
 * cookie é a server action, na camada de cima. Essa separação é o que
 * permite testar todo o fluxo — inclusive senha errada, e-mail duplicado e
 * bloqueio por tentativas — sem subir um servidor.
 */

/**
 * Cria a conta.
 *
 * `origem` identifica de onde veio a tentativa — o IP, quando a camada de
 * cima consegue lê-lo. O serviço não conhece requisição de propósito, então
 * recebe a string pronta em vez de ir buscá-la; é o que mantém o cadastro
 * inteiro testável sem subir servidor.
 *
 * O limite é por origem, e não por e-mail como no login: quem cria conta em
 * massa troca de e-mail a cada tentativa, e limitar por e-mail não conteria
 * nada. Neste produto o abuso dói exatamente aqui — é o cadastro que vira
 * lead, e conta falsa em massa envenena a única métrica que importa.
 */
export async function cadastrar(
  dados: DadosCadastro,
  origem = "desconhecida",
): Promise<UsuarioPublico> {
  const repo = repositorioUsuarios();
  const chave = `cadastro:${origem}`;

  // Antes de qualquer trabalho: bloqueado não gasta Argon2 nem consulta.
  await conferirLimite(chave);

  /*
   * Quem testa se um e-mail, CPF ou CNPJ está cadastrado precisa de volume,
   * e o limite acima só soma conta criada (#390). Os conflitos têm teto
   * próprio, e origem já bloqueada por ele é recusada aqui, antes de
   * qualquer consulta: senão continuaria perguntando e sendo respondida.
   */
  const chaveDeConflitos = `cadastro-conflito:${origem}`;
  await conferirLimite(chaveDeConflitos);

  /**
   * Soma o conflito e devolve o erro para lançar. Passando do teto, quem
   * lança é a recusa por excesso — o conflito deixa de ser dito, que é o
   * ponto: a décima primeira pergunta não ganha resposta.
   */
  const conflito = async (mensagem: string, detalhe: string) => {
    await consumirOrcamento(chaveDeConflitos, LIMITE_DE_CONFLITOS_NO_CADASTRO);
    return erros.conflito(mensagem, detalhe);
  };

  const jaExiste = await repo.porEmail(dados.email);
  if (jaExiste) {
    /*
     * No cadastro, dizer que o e-mail já existe é necessário — sem isso a
     * pessoa fica tentando de novo sem entender. No login, o mesmo aviso
     * seria enumeração de contas; lá a mensagem é genérica.
     */
    throw await conflito(
      "Já existe uma conta com este e-mail. Tente entrar.",
      "e-mail duplicado no cadastro",
    );
  }

  /*
   * A empresa escolhe o documento; os dois outros papéis só têm CPF.
   * `dados.papel !== "empresa"` é o que dá ao Zod a variante certa da
   * união — só candidato e prestador têm `cpf` obrigatório.
   *
   * O que falta informar aparece antes de qualquer consulta ao banco:
   * "informe o CNPJ" não devia esperar uma verificação de duplicidade
   * que não faz sentido sem o número.
   */
  const empresaViaCpf =
    dados.papel === "empresa" && dados.tipoDocumento === "cpf";
  const empresaViaCnpj =
    dados.papel === "empresa" && dados.tipoDocumento === "cnpj";

  if (empresaViaCnpj && !dados.cnpj) {
    throw erros.validacao([{ campo: "cnpj", mensagem: "Informe o CNPJ." }]);
  }
  if (empresaViaCpf && !dados.cpf) {
    throw erros.validacao([{ campo: "cpf", mensagem: "Informe o CPF." }]);
  }

  if (empresaViaCnpj && dados.cnpj && (await repo.cnpjEmUso(dados.cnpj))) {
    throw await conflito(
      "Este CNPJ já está cadastrado. Entre com a conta existente.",
      "CNPJ duplicado",
    );
  }

  if (dados.papel !== "empresa" && (await repo.cpfEmUso(dados.cpf))) {
    throw await conflito(
      "Este CPF já está cadastrado. Entre com a conta existente.",
      "CPF duplicado",
    );
  }

  if (empresaViaCpf && dados.cpf && (await repo.cpfEmUso(dados.cpf))) {
    throw await conflito(
      "Este CPF já está cadastrado. Entre com a conta existente.",
      "CPF duplicado",
    );
  }

  const senhaHash = await gerarHash(dados.senha);

  let usuario = await repo.criar({
    email: dados.email,
    senhaHash,
    papel: dados.papel,
    nomeCompleto: dados.nomeCompleto,
    cpf: dados.papel === "empresa" ? (dados.cpf ?? null) : dados.cpf,
    telefone: dados.telefone,
    cidade: dados.cidade,
  });

  // O perfil específico do papel é criado junto: um usuário sem perfil
  // aparece quebrado em todas as telas.
  if (dados.papel === "candidato_clt") {
    await repo.criarPerfilCandidato({
      usuarioId: usuario.id,
      areaDesejada: dados.areaDesejada,
      resumo: null,
      curriculoUrl: null,
      disponibilidade: null,
      formacao: null,
      habilidades: [],
      experiencias: [],
      // Desligado por padrão: aparecer para empresa é escolha, não default.
      visivelParaEmpresas: false,
      // Gerador de currículo pago (#47) — libera na compra, não no cadastro.
      geradorCurriculoLiberado: false,
    });
  } else if (dados.papel === "prestador_servico") {
    await repo.criarPerfilPrestador({
      usuarioId: usuario.id,
      categoriaId: dados.categoriaId,
      descricao: dados.descricao,
      precoInicial: dados.precoInicial ?? null,
      anosExperiencia: dados.anosExperiencia ?? null,
      instagram: null,
      facebook: null,
      // MEI é declarado depois, em Editar perfil — o cadastro já pede CPF.
      cnpj: null,
      cnpjVerificado: false,
      razaoSocial: null,
      // Sem carência — mesma regra de `virarPrestador` desde a #170. O
      // teste grátis começa em `/perfil/assinatura`, quando o cartão é
      // autorizado, não no cadastro.
      mensalidadeValidaAte: null,
    });

    /*
     * CPF válido e único é a própria verificação (#133), sem fila e sem
     * foto — a mesma regra que `virarPrestador` já aplica ao converter
     * uma conta existente, e que `empresaViaCpf` logo abaixo também
     * aplica. Faltava aqui: quem entrava direto como prestador, pelo
     * cadastro e não pela conversão, nunca tinha o CPF confirmado e
     * ficava para sempre fora de `/servicos` — a busca só lista quem tem
     * `doc_verified` — sem nada além do aviso genérico do perfil
     * explicando por quê (#142).
     */
    await repo.definirDocVerificado(usuario.id, true);
    // Mesmo motivo do `usuario = { ...usuario, docVerificado: true }` logo
    // abaixo, para empresa: sem atualizar a referência local, o retorno
    // desta função mentiria "não verificado" para uma conta que acabou de
    // ser marcada como verificada.
    usuario = { ...usuario, docVerificado: true };
  } else {
    await repo.criarPerfilEmpresa({
      usuarioId: usuario.id,
      razaoSocial: dados.razaoSocial,
      cnpj: empresaViaCnpj ? (dados.cnpj ?? null) : null,
      setor: dados.setor ?? null,
      porte: dados.porte ?? null,
      site: dados.site ?? null,
      instagram: null,
      facebook: null,
      descricao: dados.descricao ?? null,
      logoUrl: null,
      plano: "trial",
    });

    /*
     * Quem contrata com CPF em vez de CNPJ é verificado na hora, sem
     * chamada de rede — mesma regra que já vale para o prestador (#133):
     * CPF válido e único é a verificação em si. O caminho do CNPJ
     * continua sendo o botão "Conferir CNPJ agora" em `/perfil`, porque
     * aquele sim depende da Receita responder.
     */
    if (empresaViaCpf) {
      await repo.definirDocVerificado(usuario.id, true);
      // `usuario` já foi lido antes desta gravação — sem atualizar a
      // referência local, o retorno desta função mentiria dizendo
      // `docVerificado: false` para uma conta que acabou de ser marcada
      // como verificada.
      usuario = { ...usuario, docVerificado: true };
    }
  }

  log.info("conta criada", {
    acao: "auth.cadastrar",
    papel: dados.papel,
    cidade: usuario.cidade,
  });

  /*
   * Conta o sucesso, não só a falha. No login o que se contém é adivinhação
   * de senha, então sucesso zera o contador; aqui o que se contém é a
   * criação em si, e zerar a cada conta criada deixaria o limite inútil
   * justamente contra quem consegue criar.
   */
  await registrarFalha(chave);

  return semSenha(usuario);
}

/**
 * Autentica e devolve o usuário.
 *
 * Mensagem única para e-mail inexistente e senha errada, e tempo de resposta
 * equivalente nos dois casos. Descobrir quem tem conta aqui é descobrir quem
 * está procurando emprego — informação que pode custar o emprego atual de
 * alguém.
 */
export async function entrar(dados: DadosLogin): Promise<UsuarioPublico> {
  const repo = repositorioUsuarios();
  const chave = `login:${dados.email}`;

  // Antes de qualquer trabalho: se está bloqueado, não gasta Argon2.
  await conferirLimite(chave);

  /*
   * A tentativa é reservada aqui, de forma atômica, e não registrada depois
   * da verificação (#386): requisições simultâneas passavam todas pela
   * conferência acima antes de a primeira falha ser registrada, e o teto de
   * 5 virava uma rajada. A falha, portanto, já está contada; o sucesso zera.
   */
  await reservarTentativa(chave);

  const usuario = await repo.porEmail(dados.email);

  if (!usuario) {
    await gastarTempoDeVerificacao(dados.senha);
    throw credenciaisInvalidas("e-mail não encontrado");
  }

  const confere = await conferirSenha(dados.senha, usuario.senhaHash);

  if (!confere) {
    throw credenciaisInvalidas("senha incorreta");
  }

  await registrarSucesso(chave);

  // Hash antigo é regravado com os parâmetros atuais, sem pedir troca de
  // senha e sem derrubar os outros aparelhos (#330): a senha é a mesma.
  // Falha aqui não impede a entrada.
  if (precisaRehash(usuario.senhaHash)) {
    try {
      await repo.regravarHash(usuario.id, await gerarHash(dados.senha));
    } catch {
      log.warn("não foi possível regravar o hash", {
        acao: "auth.entrar",
        papel: usuario.papel,
      });
    }
  }

  await repo.registrarAcesso(usuario.id);

  log.info("entrada bem-sucedida", {
    acao: "auth.entrar",
    papel: usuario.papel,
  });

  return semSenha(usuario);
}

/**
 * Uma mensagem só para e-mail inexistente e senha errada. Distinguir os
 * dois casos entrega uma lista de quem tem conta na plataforma.
 */
function credenciaisInvalidas(detalhe: string) {
  return new AppError("nao_autenticado", {
    mensagem: "E-mail ou senha incorretos.",
    detalhe,
  });
}

/** Perfil público de quem está na sessão. */
export async function usuarioDaSessao(
  usuarioId: string,
): Promise<UsuarioPublico | null> {
  const usuario = await repositorioUsuarios().porId(usuarioId);
  return usuario ? semSenha(usuario) : null;
}

/**
 * Sair dos outros aparelhos (#402).
 *
 * Grava o corte de sessões — o mesmo que a troca de senha e a de papel
 * gravam (#225, #352) — sem mexer na senha. É para quem esqueceu a conta
 * aberta numa lan house, ou perdeu o celular, e não desconfia de que
 * alguém saiba a senha: trocá-la seria pedir uma senha nova a quem só
 * queria fechar uma porta.
 *
 * Quem chama emite a sessão nova do aparelho atual **depois** do corte. A
 * comparação é estrita (`emitidoEm < corte`, em segundos), então a sessão
 * emitida no mesmo segundo do corte continua valendo.
 */
export async function sairDosOutrosAparelhos(
  usuarioId: string | null,
): Promise<void> {
  if (!usuarioId) throw erros.naoAutenticado("sem sessão");
  await repositorioUsuarios().cortarSessoes(usuarioId);
  log.info("sessões cortadas pelo dono", { acao: "auth.sair_dos_outros" });
}
