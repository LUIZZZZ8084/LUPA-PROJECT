import { Target } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { formatMoneyBRL } from "@/lib/format";
import type { CustoMensal, Funil } from "@/server/metrics/tipos";

/**
 * O Lupa já se paga? (#471)
 *
 * A pergunta do Luiz em 15/10/2026: "precisamos que o Lupa se pague pelo
 * menos o Supabase". O que responde é a receita **que se repete** — as
 * assinaturas ativas, pelo valor de cada uma —, porque o custo é mensal:
 * um mês bom de pacotes paga o mês e não diz nada do seguinte. O que
 * entrou nos últimos 30 dias aparece embaixo, separado, pela mesma razão
 * que o caixa separa recorrente de compra única.
 *
 * Os custos vão em ordem, e a receita cobre o primeiro antes do segundo:
 * a pergunta era "pelo menos o Supabase", e é ele que vem primeiro.
 *
 * A receita é bruta, sem a taxa do Mercado Pago nem imposto, e a tela diz
 * isso: uma barra cheia que esconde 11% de desconto é a mesma mentira do
 * "faturamento estimado" que já saiu deste painel uma vez.
 */
export function CoberturaDosCustos({
  receita,
  custos,
}: {
  receita: Funil["receita"];
  custos: CustoMensal[];
}) {
  const meta = custos.reduce((s, c) => s + c.centavos, 0);
  const recorrente = receita.recorrenteAtivoCentavos;
  const fracao = meta === 0 ? 1 : Math.min(1, recorrente / meta);

  const linhas = cobrirEmOrdem(recorrente, custos);

  return (
    <Panel>
      <h2 className="flex items-center gap-2 font-semibold text-sm">
        <Target size={16} className="text-vagas" aria-hidden />O Lupa já se
        paga?
      </h2>

      <p className="mt-2 font-bold text-3xl text-ink tabular-nums">
        {formatMoneyBRL(recorrente / 100)}
        <span className="ml-1 font-normal text-muted text-sm">por mês</span>
      </p>
      <p className="mt-1 text-muted text-xs">
        de {receita.assinaturasAtivas}{" "}
        {receita.assinaturasAtivas === 1
          ? "assinatura ativa"
          : "assinaturas ativas"}
        , contra {formatMoneyBRL(meta / 100)} de custo mensal
      </p>

      {/*
        A barra é decoração: a porcentagem vem escrita logo embaixo, e é
        ela que o leitor de tela lê.
      */}
      <div
        aria-hidden
        className="mt-3 h-2 overflow-hidden rounded-full bg-panel-3"
      >
        <div
          className="h-full rounded-full bg-vagas"
          style={{ width: `${fracao * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-muted text-xs">
        Cobre <strong className="text-ink">{Math.floor(fracao * 100)}%</strong>{" "}
        do custo mensal.
      </p>

      <ul className="mt-3 space-y-1 text-xs">
        {linhas.map((l) => (
          <li key={l.nome} className="flex justify-between gap-3">
            <span className="text-muted">
              {l.nome} (~{formatMoneyBRL(l.centavos / 100)})
            </span>
            {l.falta === 0 ? (
              <strong className="text-vagas">coberto</strong>
            ) : (
              <span className="text-ink tabular-nums">
                faltam {formatMoneyBRL(l.falta / 100)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 border-line border-t pt-3 text-muted text-xs">
        Entraram{" "}
        <strong className="text-ink">
          {formatMoneyBRL(receita.entrouUltimos30DiasCentavos / 100)}
        </strong>{" "}
        nos últimos 30 dias, pacotes inclusive. Valores brutos, antes da taxa do
        Mercado Pago e do imposto; os custos são estimativas dos planos pagos em
        reais.
      </p>
    </Panel>
  );
}

/**
 * Quanto falta de cada custo, cobrindo um de cada vez, na ordem: a receita
 * paga o primeiro inteiro antes de chegar ao segundo.
 */
function cobrirEmOrdem(recorrente: number, custos: CustoMensal[]) {
  const linhas: (CustoMensal & { falta: number })[] = [];
  let sobra = recorrente;
  for (const custo of custos) {
    const coberto = Math.min(sobra, custo.centavos);
    sobra -= coberto;
    linhas.push({ ...custo, falta: custo.centavos - coberto });
  }
  return linhas;
}
