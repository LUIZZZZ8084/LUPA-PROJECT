import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { enviarEmail, temEmailConfigurado } from "../email";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { conferirLimite, registrarFalha } from "./rate-limit";

/**
 * Verificação de e-mail (#227).
 *
 * A migração `0001` trocou o Supabase Auth por autenticação própria, e o
 * AGENTS.md registra desde então o que se perdeu junto: verificação de
 * e-mail e recuperação de senha. A segunda foi construída na #174; esta é
 * a primeira, e ela fechava também um caso de "estado declarado sem
 * produtor" — `usuarios.email_verificado` existia desde o começo, era lido
 * pelos repositórios, e **nada nunca escrevia nele**.
 *
 * ## Qual é o dano, medido antes de dimensionar
 *
 * **Não é spam.** O único e-mail que a Lupa manda é o de recuperação de
 * senha, e ele só sai quando alguém digita aquele endereço em "esqueci
 * minha senha". Endereço não confirmado não recebe nada que ninguém pediu.
 *
 * **Não é tomar conta alheia.** Quem se cadastra com o e-mail de outra
 * pessoa fica com uma conta sob um endereço que não controla — e o dono
 * de verdade a retoma pela recuperação de senha, que cai na caixa dele.
 *
 * **É o erro de digitação.** Quem erra o próprio e-mail no cadastro fica
 * com uma conta que **não tem como ser recuperada**, e descobre isso no
 * dia em que esquecer a senha. Nesse dia não há suporte possível: não
 * existe como provar que a conta é dele, nem como trocar a senha de
 * alguém sem a antiga.
 *
 * Por isso este arquivo existe, e por isso ele **não bloqueia nada**.
 *
 * ## Não bloqueia, de propósito
 *
 * Nem login, nem candidatar-se, nem publicar. Bloquear puniria as contas
 * que já existem por uma verificação que não existia quando elas foram
 * criadas, e puniria quem está procurando emprego por causa de um provedor
 * de e-mail fora do ar. O valor está em a conta ser recuperável, não em
 * barrar.
 *
 * ## O token não serve para trocar senha
 *
 * Mesma tabela da recuperação, mesma forma — segredo aleatório, guardado
 * em hash, uso único, com prazo —, e uma coluna `finalidade` que entra na
 * **instrução que consome**. Este token sai com muito mais liberdade que o
 * de senha: no cadastro e a cada "reenviar". Sem a separação, cada reenvio
 * seria mais um link de redefinição de senha circulando.
 */

/**
 * Vinte e quatro horas, e não uma como na recuperação.
 *
 * Os dois links respondem a urgências diferentes. Quem pede para redefinir
 * a senha está com o navegador aberto agora, e o prazo curto limita a
 * janela de um link vazado. Aqui o e-mail chega junto com o cadastro, e é
 * comum a pessoa terminar de se cadastrar no celular e só abrir a caixa
 * de entrada à noite — uma hora transformaria a confirmação num link
 * morto, e quem clicasse concluiria que o app está quebrado.
 */
export const VALIDADE_MS = 24 * 60 * 60 * 1000;

const BYTES_DO_TOKEN = 32;

/**
 * SHA-256, e não Argon2 — a mesma escolha da recuperação, pelo mesmo
 * motivo: o segredo é aleatório de 256 bits, não há o que adivinhar, e o
 * custo por tentativa não compra nada.
 */
function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ResultadoDeEnvio {
  ok: boolean;
  motivo?: string;
}

/**
 * Manda (ou remanda) o e-mail de confirmação.
 *
 * `origem` limita o reenvio, e é por origem e não por conta pela mesma
 * razão do cadastro: quem quiser usar isto como canal para mandar e-mail
 * em nome da Lupa troca de conta a cada tentativa, e quem paga a
 * reputação do domínio somos nós.
 */
export async function enviarVerificacaoDeEmail(
  usuarioId: string,
  opcoes: { urlBase: string; origem: string; buscar?: typeof fetch },
): Promise<ResultadoDeEnvio> {
  if (!temEmailConfigurado) {
    return {
      ok: false,
      motivo: "A confirmação por e-mail não está disponível neste ambiente.",
    };
  }

  await conferirLimite(`verificacao:${opcoes.origem}`);
  await registrarFalha(`verificacao:${opcoes.origem}`);

  const repo = repositorioUsuarios();
  const usuario = await repo.porId(usuarioId);
  if (!usuario) throw erros.naoEncontrado("Usuário");

  // Já confirmado é sucesso, não erro: quem clicou duas vezes em
  // "reenviar" não precisa de uma mensagem vermelha.
  if (usuario.emailVerificado) return { ok: true };

  const token = randomBytes(BYTES_DO_TOKEN).toString("base64url");
  await repo.criarTokenDeRecuperacao({
    usuarioId: usuario.id,
    tokenHash: hashDoToken(token),
    expiraEm: new Date(Date.now() + VALIDADE_MS).toISOString(),
    finalidade: "verificacao_email",
  });

  const resultado = await enviarEmail(
    {
      para: usuario.email,
      assunto: "Confirme seu e-mail na Lupa",
      corpo: [
        `Olá, ${usuario.nomeCompleto.split(" ")[0]}.`,
        "",
        "Confirme que este e-mail é seu abrindo o link abaixo:",
        "",
        `${opcoes.urlBase}/verificar-email?token=${token}`,
        "",
        "Isso é o que garante que você consegue recuperar a sua conta se um",
        "dia esquecer a senha. O link vale por 24 horas.",
        "",
        "Se você não criou conta na Lupa, ignore este e-mail.",
      ].join("\n"),
    },
    opcoes.buscar,
  );

  if (!resultado.ok) {
    // O endereço não vai para o log — mesma regra da recuperação.
    log.warn("falha ao enviar confirmação de e-mail", {
      acao: "auth.verificar_email",
      motivo: resultado.motivo,
    });
    return { ok: false, motivo: resultado.motivo };
  }

  return { ok: true };
}

/**
 * Gasta o token e marca o e-mail como confirmado.
 *
 * Devolve `false` para token inexistente, já usado, expirado **ou de outra
 * finalidade** — os quatro são a mesma coisa para quem clicou, e
 * distinguir só informaria quem está sondando.
 */
export async function confirmarEmail(token: string): Promise<boolean> {
  const repo = repositorioUsuarios();
  const consumido = await repo.consumirTokenDeRecuperacao(
    hashDoToken(token),
    "verificacao_email",
  );

  if (!consumido) return false;

  await repo.definirEmailVerificado(consumido.usuarioId);
  log.info("e-mail confirmado", { acao: "auth.verificar_email" });
  return true;
}
