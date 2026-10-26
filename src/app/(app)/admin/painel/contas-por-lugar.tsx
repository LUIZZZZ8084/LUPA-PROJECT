import { MapPin } from "lucide-react";
import { Panel } from "@/components/ui/card";
import type { ContasNoLugar, ContasPorLugar } from "@/server/metrics/tipos";

/**
 * Contas por estado e por cidade, separadas por papel (#471).
 *
 * Substitui "Onde estão", que somava todos os papéis numa barra só e
 * mostrava doze cidades. A pergunta do Luiz era de onde vem cada tipo de
 * conta: uma cidade cheia de candidatos e sem empresa é uma cidade onde
 * falta vender, e a barra única escondia isso.
 *
 * As cores são as das verticais (verde candidato, laranja prestador, azul
 * empresa), e o número de cada papel está escrito ao lado, não só na barra:
 * a cor sozinha não diz nada a quem não a distingue.
 */
export function ContasPorLugarBlocos({ lugares }: { lugares: ContasPorLugar }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Bloco
        titulo="Contas por estado"
        vazio="Ainda sem contas."
        linhas={lugares.estados}
      />
      <Bloco
        titulo="Cidades com mais contas"
        vazio="Ainda sem contas."
        linhas={lugares.cidades}
      />
    </div>
  );
}

function Bloco({
  titulo,
  vazio,
  linhas,
}: {
  titulo: string;
  vazio: string;
  linhas: ContasNoLugar[];
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.total));

  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <MapPin size={16} className="text-vagas" aria-hidden />
          {titulo}
        </h2>
        <Legenda />
      </div>

      {linhas.length === 0 ? (
        <p className="mt-3 text-muted text-sm">{vazio}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {linhas.map((l) => (
            <li key={l.lugar}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="min-w-0 truncate text-ink text-xs"
                  title={l.lugar}
                >
                  {l.lugar}
                </span>
                <span className="flex-none text-muted text-xs tabular-nums">
                  <span className="sr-only">{descrever(l)}. Total: </span>
                  <span aria-hidden>
                    <span className="text-vagas">{l.candidatos}</span>
                    {" · "}
                    <span className="text-servicos">{l.prestadores}</span>
                    {" · "}
                    <span className="text-empresas">{l.empresas}</span>
                    {" = "}
                  </span>
                  <strong className="text-ink">{l.total}</strong>
                </span>
              </div>
              {/*
                A barra mede o lugar contra o maior da lista, e dentro dela
                cada papel ocupa a parte dele. É decoração: os números ao
                lado dizem o mesmo, e o leitor de tela os lê.
              */}
              <div
                aria-hidden
                className="mt-1 flex h-2 overflow-hidden rounded-full bg-panel-3"
              >
                <div
                  className="flex h-full"
                  style={{ width: `${(l.total / maior) * 100}%` }}
                >
                  <Parte valor={l.candidatos} total={l.total} cor="bg-vagas" />
                  <Parte
                    valor={l.prestadores}
                    total={l.total}
                    cor="bg-servicos"
                  />
                  <Parte valor={l.empresas} total={l.total} cor="bg-empresas" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Parte({
  valor,
  total,
  cor,
}: {
  valor: number;
  total: number;
  cor: string;
}) {
  if (valor === 0) return null;
  return (
    <div
      className={`h-full ${cor}`}
      style={{ width: `${(valor / total) * 100}%` }}
    />
  );
}

/** A frase que o leitor de tela lê no lugar dos três números. */
export function descrever(l: ContasNoLugar): string {
  const partes = [
    [l.candidatos, "candidato", "candidatos"],
    [l.prestadores, "prestador", "prestadores"],
    [l.empresas, "empresa", "empresas"],
  ] as const;
  return partes
    .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`)
    .join(", ");
}

export function Legenda() {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      <Item cor="bg-vagas" rotulo="candidatos" />
      <Item cor="bg-servicos" rotulo="prestadores" />
      <Item cor="bg-empresas" rotulo="empresas" />
    </p>
  );
}

function Item({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-2 w-2 rounded-full ${cor}`} />
      {rotulo}
    </span>
  );
}
