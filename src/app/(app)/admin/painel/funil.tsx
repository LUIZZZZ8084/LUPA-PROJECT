import { Panel } from "@/components/ui/card";
import type { Funil } from "@/server/metrics/tipos";

/**
 * O caminho de cada papel até virar receita (#471).
 *
 * Três colunas, uma por papel, e cada passo diz quantos chegaram até ali e
 * que fração do primeiro passo isso é. A pergunta que ele responde é a de
 * onde cada um para: muito candidato e pouca candidatura é falta de vaga;
 * muito prestador e pouca vitrine é falta de assinatura.
 *
 * A porcentagem é sempre sobre o primeiro passo da coluna, nunca sobre o
 * passo anterior: "20% das empresas compraram" se lê sem conta; "50% das
 * que publicaram" obriga quem olha a lembrar quantas publicaram.
 */
export function FunilDoPainel({ funil }: { funil: Funil }) {
  return (
    <Panel>
      <h2 className="font-semibold text-sm">Funil</h2>
      <p className="mt-1 text-muted text-xs">
        De quem tem conta até quem gera receita. A porcentagem é sobre a
        primeira linha de cada coluna.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Coluna
          titulo="Candidatos"
          cor="text-vagas"
          passos={[
            ["Com conta", funil.candidatos],
            ["Visíveis para empresas", funil.candidatosVisiveis],
            ["Já se candidataram", funil.candidatosQueSeCandidataram],
          ]}
        />
        <Coluna
          titulo="Prestadores"
          cor="text-servicos"
          passos={[
            ["Com conta", funil.prestadores],
            ["Na vitrine", funil.prestadoresNaVitrine],
            ["Com assinatura ativa", funil.prestadoresAssinantes],
          ]}
        />
        <Coluna
          titulo="Empresas"
          cor="text-empresas"
          passos={[
            ["Com conta", funil.empresas],
            ["Conferidas", funil.empresasVerificadas],
            ["Publicaram vaga", funil.empresasComVaga],
            ["Compraram vaga", funil.empresasQueCompraram],
          ]}
        />
      </div>
    </Panel>
  );
}

function Coluna({
  titulo,
  cor,
  passos,
}: {
  titulo: string;
  cor: string;
  passos: ReadonlyArray<readonly [string, number]>;
}) {
  const base = passos[0][1];

  return (
    <section aria-label={titulo}>
      <h3 className={`font-semibold text-xs ${cor}`}>{titulo}</h3>
      <ol className="mt-2 space-y-1.5">
        {passos.map(([rotulo, valor]) => (
          <li
            key={rotulo}
            className="flex items-baseline justify-between gap-3 text-xs"
          >
            <span className="text-muted">{rotulo}</span>
            <span className="tabular-nums">
              <strong className="text-ink">{valor}</strong>
              <span className="ml-1.5 inline-block w-10 text-right text-muted">
                {porcentagem(valor, base)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "40%", ou um traço quando não há base para dividir. */
export function porcentagem(valor: number, base: number): string {
  if (base === 0) return "—";
  return `${Math.round((valor / base) * 100)}%`;
}
