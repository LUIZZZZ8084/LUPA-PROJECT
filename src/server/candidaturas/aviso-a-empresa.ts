import "server-only";

import { primeiroNome } from "@/lib/chamada";
import { consumirOrcamento } from "../auth/rate-limit";
import { enviarEmail } from "../email";
import { saudacao } from "../email/saudacao";
import { AppError } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { urlPublica } from "../url-publica";
import { repositorioVagas } from "../vagas";
import { repositorioCandidaturas } from "./index";
import type { Candidatura } from "./tipos";

/**
 * Avisar a empresa por e-mail quando chega candidatura (#543).
 *
 * Até aqui a Lupa não avisava a empresa de nada: ela só descobria uma
 * candidatura abrindo o painel, e a agência que publica e não volta perdia
 * o candidato — que ficava sem resposta, achando que a vaga era de mentira.
 *
 * **Um e-mail por empresa a cada duas horas, no máximo.** Vaga boa recebe
 * dez candidaturas numa manhã, e dez e-mails ensinam a mandar a Lupa para o
 * spam — além de gastar a cota do Resend, o gargalo já registrado para os
 * 10 mil usuários. O e-mail que sai diz quantas candidaturas estão esperando
 * olhar, não só a que o disparou: quem abre o painel vê todas. As que chegam
 * dentro da janela entram na conta do próximo aviso, ou no painel.
 *
 * **Só para e-mail confirmado.** A conta pode ter sido criada com o e-mail
 * de outra pessoa, e o aviso leva o nome de quem se candidatou: a um
 * endereço que a empresa nunca confirmou, seria entregar esse nome a um
 * estranho.
 *
 * **O e-mail não leva contato nenhum** — nem telefone, nem currículo, nem
 * respostas da triagem. Só o primeiro nome, o cargo e o link do painel; o
 * resto está atrás do login.
 *
 * Roda depois da resposta (`after`), e falhar aqui nunca desfaz a
 * candidatura: o aviso é consequência, e o painel continua mostrando tudo.
 */

const JANELA_DO_AVISO_SEGUNDOS = 2 * 60 * 60;

/** Onde a empresa abre o funil: a porta depende do papel (#189). */
function baseDaArea(papel: string): string {
  return papel === "prestador_servico" ? "/contratar" : "/empresa";
}

async function cabeAviso(empresaId: string): Promise<boolean> {
  try {
    await consumirOrcamento(`aviso-candidatura:${empresaId}`, {
      chamadas: 1,
      janelaSegundos: JANELA_DO_AVISO_SEGUNDOS,
    });
    return true;
  } catch (erro) {
    if (erro instanceof AppError && erro.codigo === "muitas_tentativas") {
      return false;
    }
    throw erro;
  }
}

/** Quantas candidaturas desta empresa ninguém abriu ainda. */
async function novasParaOlhar(empresaId: string): Promise<number> {
  const vagas = await repositorioVagas().porEmpresa(empresaId);
  const porVaga = await Promise.all(
    vagas.map((v) => repositorioCandidaturas().porVaga(v.id)),
  );
  return porVaga.flat().filter((c) => c.status === "enviada").length;
}

export type ResultadoDoAviso =
  | "enviado"
  | "sem_empresa"
  | "email_nao_confirmado"
  | "na_janela"
  | "falhou";

export async function avisarEmpresaDaCandidatura(
  candidatura: Pick<Candidatura, "vagaId" | "candidatoId">,
  buscar?: typeof fetch,
): Promise<ResultadoDoAviso> {
  const vaga = await repositorioVagas().porId(candidatura.vagaId);
  if (!vaga) return "sem_empresa";

  const usuarios = repositorioUsuarios();
  const empresa = await usuarios.porId(vaga.empresaId);
  // Em demonstração a empresa das vagas de exemplo não é uma conta.
  if (!empresa) return "sem_empresa";
  if (!empresa.emailVerificado) return "email_nao_confirmado";
  if (!(await cabeAviso(empresa.id))) return "na_janela";

  const candidato = await usuarios.porId(candidatura.candidatoId);
  const nome = primeiroNome(candidato?.nomeCompleto ?? "");
  const novas = await novasParaOlhar(empresa.id);
  const link = `${urlPublica()}${baseDaArea(empresa.papel)}/funil`;

  const resultado = await enviarEmail(
    {
      para: empresa.email,
      assunto: `Nova candidatura para ${vaga.titulo}`,
      tipo: "aviso_candidatura",
      corpo: [
        saudacao(empresa.nomeCompleto),
        "",
        `${nome || "Uma pessoa"} se candidatou à vaga de ${vaga.titulo} na Lupa.`,
        novas > 1 ? `Você tem ${novas} candidaturas esperando para olhar.` : "",
        "",
        "Abra o painel para ver o currículo e chamar no WhatsApp:",
        link,
        "",
        "Quem responde rápido contrata primeiro: a pessoa costuma se",
        "candidatar a várias vagas no mesmo dia.",
        "",
        "Você recebe no máximo um aviso destes a cada duas horas.",
      ]
        .filter((linha, i, todas) => !(linha === "" && todas[i - 1] === ""))
        .join("\n"),
    },
    buscar,
  );

  if (!resultado.ok) {
    // O endereço não vai para o log — mesma regra da recuperação de senha.
    log.warn("falha ao avisar a empresa da candidatura", {
      acao: "candidatura.aviso_empresa",
      motivo: resultado.motivo,
    });
    return "falhou";
  }
  return "enviado";
}
