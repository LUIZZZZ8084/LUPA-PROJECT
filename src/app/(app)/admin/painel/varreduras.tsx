import { AlarmClock, CircleAlert } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";
import {
  HORAS_ATE_ATRASAR,
  type ResumoDaVarredura,
  ROTULOS_DO_RESUMO,
  type SituacaoDaVarredura,
} from "@/server/varreduras/tipos";

/** "3 vagas vencendo · 0 empresas avisadas", ou o erro quando falhou. */
function resumoPorExtenso(resumo: ResumoDaVarredura): string {
  if (typeof resumo.erro === "string") return `erro: ${resumo.erro}`;
  return Object.entries(resumo)
    .filter(([, v]) => typeof v === "number")
    .map(([chave, v]) => {
      const rotulo = ROTULOS_DO_RESUMO[chave];
      if (!rotulo) return `${chave}: ${v}`;
      return `${v} ${v === 1 ? rotulo[0] : rotulo[1]}`;
    })
    .join(" · ");
}

/**
 * As varreduras diárias, e se alguma parou (#566).
 *
 * O log da Vercel no plano grátis guarda 30 minutos, e "a varredura de hoje
 * rodou?" era pergunta sem resposta fora dele. Atrasada é sem sucesso há
 * mais de 26 horas — o que cobre segredo ausente, segredo divergente e
 * agendamento desligado —, e é o único estado que ganha cor.
 */
export function Varreduras({
  varreduras,
}: {
  varreduras: SituacaoDaVarredura[];
}) {
  return (
    <Panel>
      <h2 className="flex items-center gap-2 font-semibold text-sm">
        <AlarmClock size={16} className="text-empresas" aria-hidden />
        Varreduras diárias
      </h2>
      <p className="mt-1 text-muted text-xs">
        A última execução de cada uma. O histórico de 90 dias fica na aba
        Schedules da Vercel.
      </p>

      <ul className="mt-4 divide-y divide-line">
        {varreduras.map(({ nome, titulo, ultima, atrasada }) => (
          <li key={nome} className="py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 font-medium text-sm">
                {titulo}
              </span>
              {atrasada ? (
                <span className="rounded-full bg-danger/15 px-2 py-0.5 font-semibold text-danger text-xs">
                  Atrasada
                </span>
              ) : ultima ? (
                <span className="text-muted text-xs">
                  {ultima.ok ? "Rodou" : "Falhou"} {timeAgo(ultima.rodouEm)}
                </span>
              ) : null}
            </div>

            {ultima ? (
              <p className="mt-1 text-muted text-xs">
                {resumoPorExtenso(ultima.resumo)}
              </p>
            ) : (
              <p className="mt-1 text-muted text-xs">
                Ainda sem registro. A primeira execução depois deste deploy
                aparece aqui.
              </p>
            )}

            {atrasada && (
              <p className="mt-2 flex items-start gap-2 text-danger text-xs">
                <CircleAlert
                  size={14}
                  className="mt-0.5 flex-none"
                  aria-hidden
                />
                <span>
                  Sem sucesso há mais de {HORAS_ATE_ATRASAR} horas
                  {ultima?.ultimaOkEm
                    ? ` (o último foi ${timeAgo(ultima.ultimaOkEm)})`
                    : ""}
                  . Confira o CRON_SECRET na Vercel e se o agendamento está
                  ativo na aba Schedules.
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
