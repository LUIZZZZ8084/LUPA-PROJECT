import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { enviarEmail, temEmailConfigurado } from "../email";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { gerarHash } from "./password";
import { conferirLimite, registrarFalha } from "./rate-limit";

/**
 * "Esqueci minha senha" (#174).
 *
 * A migração `0001` trocou o Supabase Auth por autenticação própria, e o
 * `AGENTS.md` registra desde então o que se perdeu junto: verificação de
 * e-mail e recuperação de senha, que vinham de graça. Até aqui, quem
 * esquecia a senha perdia a conta — e o suporte também não tinha o que
 * fazer, porque não existe como trocar a senha de alguém sem a antiga.
 *
 * Três cuidados, e nenhum deles é decoração:
 *
 * **A resposta é sempre a mesma**, exista a conta ou não. É a mesma razão
 * de o login não dizer se o e-mail existe: aqui, a lista de quem tem
 * conta é a lista de quem está procurando emprego, e numa cidade do
 * tamanho de Sinop isso pode custar o emprego atual de alguém.
 *
 * **O token é guardado em hash.** Quem lesse a tabela — um backup
 * exposto, um acesso de leitura mal concedido — poderia trocar a senha de
 * qualquer conta. O valor original só existe no e-mail que a pessoa
 * recebeu.
 *
 * **O limite é por origem, não por e-mail.** Sem ele, esta tela vira um
 * canal para mandar e-mail em nome da Lupa a qualquer endereço, quantas
 * vezes se quiser — e quem paga a conta de reputação do domínio somos
 * nós. Mesma escolha do limite de cadastro, e pelo mesmo motivo: quem
 * abusa troca de e-mail a cada tentativa.
 */

/** Uma hora. Tempo de abrir o e-mail, não de deixar o link vivo. */
export const VALIDADE_MS = 60 * 60 * 1000;

/** Só para o teste conferir a força do token sem repetir o número. */
export const BYTES_DO_TOKEN = 32;

function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * O que a tela mostra depois de pedir — sempre a mesma coisa, e por isso
 * não há um `{ ok: false }` para "e-mail não existe".
 *
 * `indisponivel` é a única falha que a pessoa precisa distinguir: sem
 * provedor de e-mail configurado, o recurso não existe neste ambiente, e
 * dizer "enviamos" seria mandá-la esperar por algo que nunca sai.
 */
export type PedidoDeRecuperacao = { ok: true } | { ok: false; motivo: string };

export async function pedirRecuperacao(
  email: string,
  opcoes: { origem: string; urlBase: string; buscar?: typeof fetch },
): Promise<PedidoDeRecuperacao> {
  if (!temEmailConfigurado) {
    return {
      ok: false,
      motivo:
        "A recuperação de senha ainda não está disponível. Fale com o suporte pelo WhatsApp.",
    };
  }

  /*
   * O limite conta **toda** tentativa, inclusive as que dão certo — como
   * no cadastro, e ao contrário do login. O que se contém aqui não é
   * adivinhação de senha: é o envio em si.
   */
  await conferirLimite(`recuperacao:${opcoes.origem}`);
  await registrarFalha(`recuperacao:${opcoes.origem}`);

  const repo = repositorioUsuarios();
  const usuario = await repo.porEmail(email.trim().toLowerCase());

  /*
   * Conta que não existe sai por aqui, com a mesma resposta de quem
   * recebeu o e-mail. Nenhum log com o endereço: o log também não pode
   * virar a lista que a tela se recusa a confirmar.
   */
  if (!usuario) {
    log.info("recuperação pedida para e-mail sem conta", {
      acao: "auth.recuperar",
    });
    return { ok: true };
  }

  const token = randomBytes(BYTES_DO_TOKEN).toString("base64url");
  await repo.criarTokenDeRecuperacao({
    usuarioId: usuario.id,
    tokenHash: hashDoToken(token),
    expiraEm: new Date(Date.now() + VALIDADE_MS).toISOString(),
  });

  const link = `${opcoes.urlBase}/redefinir-senha?token=${token}`;
  const resultado = await enviarEmail(
    {
      para: usuario.email,
      assunto: "Redefinir sua senha na Lupa",
      corpo: [
        `Olá, ${usuario.nomeCompleto.split(" ")[0]}.`,
        "",
        "Você pediu para redefinir a sua senha na Lupa. Abra o link abaixo:",
        "",
        link,
        "",
        "O link vale por 1 hora e só pode ser usado uma vez.",
        "",
        "Se não foi você quem pediu, ignore este e-mail — a sua senha continua a mesma.",
      ].join("\n"),
    },
    opcoes.buscar,
  );

  if (!resultado.ok) {
    log.warn("falha ao enviar e-mail de recuperação", {
      acao: "auth.recuperar",
      motivo: resultado.motivo,
    });
    return {
      ok: false,
      motivo:
        "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.",
    };
  }

  log.info("e-mail de recuperação enviado", { acao: "auth.recuperar" });
  return { ok: true };
}

/**
 * Troca a senha, se o token valer.
 *
 * **O token é gasto na mesma instrução que o valida** — `where usado_em is
 * null and expira_em > now()`, no repositório. Dois cliques no mesmo link,
 * ou um link vazado sendo usado em paralelo, passariam os dois por uma
 * leitura anterior.
 *
 * A troca **não** revoga as sessões antigas, e isso não é esquecimento: a
 * sessão é um JWT de 7 dias e não há como invalidá-la antes de expirar —
 * é o preço registrado no `AGENTS.md` desde que a sessão deixou de morar
 * no banco. O que se faz é emitir uma sessão nova para quem acabou de
 * trocar, e quem chama cuida disso.
 */
export async function redefinirSenha(
  token: string,
  novaSenha: string,
): Promise<{ usuarioId: string; papel: string }> {
  const repo = repositorioUsuarios();
  const consumido = await repo.consumirTokenDeRecuperacao(hashDoToken(token));

  if (!consumido) {
    throw erros.validacao(
      [{ campo: "token", mensagem: "Link inválido ou expirado." }],
      "Este link não vale mais. Peça um novo em 'Esqueci minha senha'.",
    );
  }

  const usuario = await repo.porId(consumido.usuarioId);
  if (!usuario) throw erros.naoEncontrado("Usuário");

  await repo.atualizarSenhaHash(usuario.id, await gerarHash(novaSenha));

  log.info("senha redefinida por recuperação", { acao: "auth.redefinir" });
  return { usuarioId: usuario.id, papel: usuario.papel };
}
