import type { PontoDaSerie } from "@/server/visualizacoes";

/**
 * As duas séries do painel, cada uma na sua escala.
 *
 * Não é um gráfico só com duas cores de propósito: visualização costuma ser
 * uma ordem de grandeza maior que candidatura, e na mesma escala a barra de
 * candidatura vira um traço de um pixel — o número que mais importa para a
 * empresa seria o menos visível.
 *
 * Sem biblioteca de gráfico. Trinta barras em `div` custam zero byte de
 * JavaScript, e esta tela abre no celular de quem contrata em Sinop.
 */

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

function rotuloDoDia(dia: string): string {
  return DIA_CURTO.format(new Date(`${dia}T12:00:00Z`));
}

function Barras({
  serie,
  valor,
  cor,
}: {
  serie: PontoDaSerie[];
  valor: (p: PontoDaSerie) => number;
  cor: string;
}) {
  // Piso 1 para não dividir por zero quando o mês inteiro está zerado.
  const maximo = Math.max(1, ...serie.map(valor));

  return (
    <div className="flex h-16 items-end gap-[2px]" aria-hidden="true">
      {serie.map((ponto) => {
        const n = valor(ponto);
        return (
          <div
            key={ponto.dia}
            className="flex-1 rounded-t-[2px] bg-line-soft"
            style={{
              height: "100%",
              background: `linear-gradient(to top, ${cor} ${(n / maximo) * 100}%, var(--color-line-soft) 0)`,
            }}
          />
        );
      })}
    </div>
  );
}

export function SerieGrafico({ serie }: { serie: PontoDaSerie[] }) {
  if (serie.length === 0) return null;

  const primeiro = rotuloDoDia(serie[0].dia);
  const ultimo = rotuloDoDia(serie[serie.length - 1].dia);

  return (
    <div className="mt-5 space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-muted">
          Visualizações por dia
        </p>
        <Barras
          serie={serie}
          valor={(p) => p.visualizacoes}
          cor="var(--color-empresas)"
        />
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-muted">
          Candidaturas por dia
        </p>
        <Barras
          serie={serie}
          valor={(p) => p.candidaturas}
          cor="var(--color-vagas)"
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted tabular-nums">
        <span>{primeiro}</span>
        <span>{ultimo}</span>
      </div>

      {/*
       * O gráfico é decorativo para quem usa leitor de tela; o dado está
       * aqui. Uma tabela de trinta linhas lida em voz é longa, mas é
       * navegável célula a célula — bem melhor que um `aria-label` com o
       * mês inteiro numa frase só.
       */}
      <table className="sr-only">
        <caption>Movimento diário das suas vagas nos últimos 30 dias</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Visualizações</th>
            <th scope="col">Candidaturas</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((p) => (
            <tr key={p.dia}>
              <th scope="row">{rotuloDoDia(p.dia)}</th>
              <td>{p.visualizacoes}</td>
              <td>{p.candidaturas}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[11px] leading-relaxed text-muted">
        Visualização conta cada abertura da vaga, inclusive quando a mesma
        pessoa volta depois. Serve para comparar dias e vagas entre si, não para
        contar quantas pessoas diferentes viram. Suas próprias aberturas não
        entram na conta.
      </p>
    </div>
  );
}
