import "server-only";

import { consumirOrcamento } from "../auth/rate-limit";
import { enviarEmail } from "../email";
import { saudacao } from "../email/saudacao";
import { AppError } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { urlPublica } from "../url-publica";
import { repositorioVagas } from "./index";
import type { Vaga } from "./tipos";

/**
 * Avisar a empresa por e-mail antes de a vaga vencer (#561).
 *
 * A vaga sai do ar em 30 dias, e o aviso de "vence em até 3 dias" só existia
 * no painel, para quem o abre. Quem publica e não volta perdia a vaga sem
 * perceber — e a reativação, que custa uma vaga, nunca acontecia.
 *
 * **Uma varredura por dia, pelo cron** que já existia, e **um e-mail por
 * empresa**, com todas as vagas dela que vencem nos próximos três dias: três
 * vagas vencendo juntas são um e-mail, não três.
 *
 * **Cada vaga entra uma vez por prazo.** A chave do aviso leva o id e a data
 * de vencimento, e vale por quatro dias: a vaga avisada hoje não volta no
 * e-mail de amanhã, e a reativada ganha prazo novo — e, com ele, chave nova.
 * O contador é o mesmo dos tetos de ação, sem tabela nova.
 *
 * As mesmas regras do aviso de candidatura (#543): só para e-mail
 * confirmado, link para a área certa (`/empresa` ou `/contratar`), e nada
 * além do cargo e do dia no texto.
 */

const DIAS_DE_ANTECEDENCIA = 3;
const DIA_MS = 24 * 60 * 60 * 1000;

function baseDaArea(papel: string): string {
  return papel === "prestador_servico" ? "/contratar" : "/empresa";
}

/** "sexta, 07/11", no horário de Brasília. */
function diaDoVencimento(expiraEm: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  })
    .format(new Date(expiraEm))
    .replace("-feira", "");
}

async function primeiroAviso(vaga: Vaga): Promise<boolean> {
  try {
    await consumirOrcamento(`aviso-vencimento:${vaga.id}:${vaga.expiraEm}`, {
      chamadas: 1,
      janelaSegundos: (DIAS_DE_ANTECEDENCIA + 1) * 24 * 60 * 60,
    });
    return true;
  } catch (erro) {
    if (erro instanceof AppError && erro.codigo === "muitas_tentativas") {
      return false;
    }
    throw erro;
  }
}

export interface ResultadoDoAvisoDeVencimento {
  vagasVencendo: number;
  empresasAvisadas: number;
}

export async function avisarVagasVencendo(
  agora: Date = new Date(),
  buscar?: typeof fetch,
): Promise<ResultadoDoAvisoDeVencimento> {
  const vencendo = await repositorioVagas().vencendoAte(
    agora.toISOString(),
    new Date(agora.getTime() + DIAS_DE_ANTECEDENCIA * DIA_MS).toISOString(),
  );

  const porEmpresa = new Map<string, Vaga[]>();
  for (const vaga of vencendo) {
    porEmpresa.set(vaga.empresaId, [
      ...(porEmpresa.get(vaga.empresaId) ?? []),
      vaga,
    ]);
  }

  let empresasAvisadas = 0;
  for (const [empresaId, vagas] of porEmpresa) {
    const empresa = await repositorioUsuarios().porId(empresaId);
    // Sem conta (as vagas de exemplo) ou sem e-mail confirmado, não sai.
    if (!empresa?.emailVerificado) continue;

    const novas: Vaga[] = [];
    for (const vaga of vagas) {
      if (await primeiroAviso(vaga)) novas.push(vaga);
    }
    if (novas.length === 0) continue;

    const uma = novas.length === 1;
    const resultado = await enviarEmail(
      {
        para: empresa.email,
        assunto: uma
          ? `Sua vaga de ${novas[0].titulo} vai vencer`
          : `${novas.length} vagas suas vão vencer`,
        tipo: "aviso_vencimento",
        corpo: [
          saudacao(empresa.nomeCompleto),
          "",
          uma
            ? "Esta vaga sai do ar nos próximos dias:"
            : "Estas vagas saem do ar nos próximos dias:",
          ...novas.map(
            (v) => `- ${v.titulo}: vence ${diaDoVencimento(v.expiraEm)}`,
          ),
          "",
          "Se ainda está contratando, reative na aba Vagas para continuar",
          "recebendo candidaturas por mais 30 dias:",
          `${urlPublica()}${baseDaArea(empresa.papel)}/vagas`,
          "",
          "Se a vaga já foi preenchida, não precisa fazer nada.",
        ].join("\n"),
      },
      buscar,
    );

    if (resultado.ok) {
      empresasAvisadas += 1;
    } else {
      log.warn("falha ao avisar vencimento de vaga", {
        acao: "vagas.aviso_vencimento",
        motivo: resultado.motivo,
      });
    }
  }

  return { vagasVencendo: vencendo.length, empresasAvisadas };
}
