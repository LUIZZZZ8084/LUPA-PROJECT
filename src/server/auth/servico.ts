import { CIDADE_INICIAL } from "@/lib/constants";
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
import { conferirLimite, registrarFalha, registrarSucesso } from "./rate-limit";
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

  const jaExiste = await repo.porEmail(dados.email);
  if (jaExiste) {
    /*
     * No cadastro, dizer que o e-mail já existe é necessário — sem isso a
     * pessoa fica tentando de novo sem entender. No login, o mesmo aviso
     * seria enumeração de contas; lá a mensagem é genérica.
     */
    throw erros.conflito(
      "Já existe uma conta com este e-mail. Tente entrar.",
      "e-mail duplicado no cadastro",
    );
  }

  if (dados.papel === "empresa" && (await repo.cnpjEmUso(dados.cnpj))) {
    throw erros.conflito(
      "Este CNPJ já está cadastrado. Entre com a conta existente.",
      "CNPJ duplicado",
    );
  }

  const senhaHash = await gerarHash(dados.senha);

  const usuario = await repo.criar({
    email: dados.email,
    senhaHash,
    papel: dados.papel,
    nomeCompleto: dados.nomeCompleto,
    telefone: dados.telefone,
    cidade: dados.cidade ?? CIDADE_INICIAL,
    bairro: dados.bairro ?? null,
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
      // Desligado por padrão: aparecer para empresa é escolha, não default.
      visivelParaEmpresas: false,
    });
  } else if (dados.papel === "prestador_servico") {
    await repo.criarPerfilPrestador({
      usuarioId: usuario.id,
      categoriaId: dados.categoriaId,
      descricao: dados.descricao,
      precoInicial: dados.precoInicial ?? null,
      anosExperiencia: dados.anosExperiencia ?? null,
      bairrosAtendidos: dados.bairrosAtendidos ?? [],
    });
  } else {
    await repo.criarPerfilEmpresa({
      usuarioId: usuario.id,
      razaoSocial: dados.razaoSocial,
      cnpj: dados.cnpj,
      setor: dados.setor ?? null,
      porte: dados.porte ?? null,
      site: dados.site ?? null,
      descricao: dados.descricao ?? null,
      logoUrl: null,
      plano: "trial",
    });
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

  const usuario = await repo.porEmail(dados.email);

  if (!usuario) {
    await gastarTempoDeVerificacao(dados.senha);
    await registrarFalha(chave);
    throw credenciaisInvalidas("e-mail não encontrado");
  }

  const confere = await conferirSenha(dados.senha, usuario.senhaHash);

  if (!confere) {
    await registrarFalha(chave);
    throw credenciaisInvalidas("senha incorreta");
  }

  await registrarSucesso(chave);

  // Hash antigo é regravado com os parâmetros atuais, sem pedir troca de
  // senha. Falha aqui não impede a entrada.
  if (precisaRehash(usuario.senhaHash)) {
    try {
      await repo.atualizarSenhaHash(usuario.id, await gerarHash(dados.senha));
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
