import { Building2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import type { SemanaDaPagina } from "@/server/metrics/tipos";

/** "03/11", a segunda-feira da semana. */
function diaEMes(inicio: string): string {
  const [, mes, dia] = inicio.split("-");
  return `${dia}/${mes}`;
}

/** Conta sobre visita, ou um traço quando não houve visita para dividir. */
function conversao(visitas: number, contas: number): string {
  if (visitas === 0) return "—";
  return `${Math.round((contas / visitas) * 100)}%`;
}

/**
 * A página para empresas, semana a semana (#568).
 *
 * A #559 deu o numerador — quantas contas o botão criou. Faltava o
 * denominador: quantas vezes a página foi aberta por quem ainda não
 * contrata. Com os dois, dá para saber se ela convence, e se uma mudança
 * nela melhorou ou piorou.
 *
 * Da semana mais recente para a mais antiga, que é a pergunta de quem abre
 * o painel: "e esta semana?".
 */
export function PaginaDeEmpresas({ semanas }: { semanas: SemanaDaPagina[] }) {
  const visitas = semanas.reduce((s, l) => s + l.visitas, 0);
  const contas = semanas.reduce((s, l) => s + l.contas, 0);

  return (
    <Panel>
      <h2 className="flex items-center gap-2 font-semibold text-sm">
        <Building2 size={16} className="text-empresas" aria-hidden />
        Página para empresas
      </h2>
      <p className="mt-1 text-muted text-xs">
        Visitas de quem ainda não contrata, e contas criadas pelo botão da
        página, por semana. Recarregar e robô de busca também somam visita: é
        tendência, não audiência.
      </p>

      <p className="mt-3 text-sm">
        <strong className="tabular-nums">{visitas}</strong>{" "}
        {visitas === 1 ? "visita" : "visitas"} e{" "}
        <strong className="tabular-nums">{contas}</strong>{" "}
        {contas === 1 ? "conta" : "contas"} em {semanas.length} semanas
        {visitas > 0 && <> — {conversao(visitas, contas)} de conversão</>}
      </p>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-muted text-xs">
            <th scope="col" className="py-1 font-medium">
              Semana de
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Visitas
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Contas
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Conversão
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...semanas].reverse().map((semana, i) => (
            <tr key={semana.inicio}>
              <th scope="row" className="py-1.5 text-left font-normal">
                {diaEMes(semana.inicio)}
                {i === 0 && (
                  <span className="ml-1 text-muted text-xs">(esta)</span>
                )}
              </th>
              <td className="py-1.5 text-right tabular-nums">
                {semana.visitas}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {semana.contas}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {conversao(semana.visitas, semana.contas)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
