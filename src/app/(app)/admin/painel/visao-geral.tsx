"use client";

import {
  ArrowDown,
  ArrowUp,
  Map as Mapa,
  Radar,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatMoneyBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CustoMensal } from "@/server/custos/tipos";
import type { PainelAdmin } from "@/server/metrics/tipos";
import {
  dividirEmRetangulos,
  estadosDoPapel,
  fracaoCoberta,
  maioresVazamentos,
  type PapelDoFunil,
  type PapelDoMapa,
  passosDoFunil,
  REGIOES,
  type Regiao,
  ritmoDeCadastros,
} from "./visao-geral-dados";

/*
 * A visão geral do painel do admin (#507), em quatro cards.
 *
 * Nasceu de um modelo de "bento" com gráficos em SVG que o Luiz trouxe como
 * inspiração, e foi adaptado ao que a Lupa precisa saber: está entrando
 * gente, está entrando dinheiro, de onde vem essa gente e onde ela para.
 * Do modelo ficaram a grade, os números que sobem, as curvas suaves, o mapa
 * de área e o radar. Saíram o selo do autor, as fontes buscadas no Google (a
 * CSP não deixa, e a Lupa tem as dela), a animação contínua das ondas (um
 * laço de quadros num painel que fica aberto o dia todo) e as cores fixas: as
 * superfícies e as cores aqui são os tokens do tema, nos dois modos.
 *
 * Nenhum número é inventado: tudo sai do `PainelAdmin` que o polling já traz.
 */

const COR_DO_PAPEL: Record<PapelDoFunil, string> = {
  candidatos: "var(--color-vagas)",
  prestadores: "var(--color-servicos)",
  empresas: "var(--color-empresas)",
};

const COR_DA_REGIAO: Record<Regiao, string> = {
  Norte: "var(--color-vagas)",
  Nordeste: "var(--color-servicos)",
  "Centro-Oeste": "var(--color-empresas)",
  Sudeste: "var(--color-warn)",
  Sul: "var(--color-danger)",
  "Sem estado": "var(--color-faint)",
};

const porcento = (f: number) => `${Math.round(f * 100)}%`;
const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");

/* ---------------- peças compartilhadas ---------------- */

/** Prefere menos movimento? Então o número aparece pronto, sem subir. */
function usaMenosMovimento(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * O número sobe até o valor, do anterior ao novo — quando o polling traz
 * outro número, ele anda até lá em vez de trocar de repente. O leitor de
 * tela lê a cópia escondida, que é o valor de verdade desde o primeiro
 * quadro, e não os números do meio do caminho.
 */
function NumeroQueSobe({
  valor,
  formatar = inteiro,
}: {
  valor: number;
  formatar?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const de = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (usaMenosMovimento() || typeof requestAnimationFrame === "undefined") {
      el.textContent = formatar(valor);
      de.current = valor;
      return;
    }
    const inicio = de.current;
    const t0 = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / 900);
      const v = inicio + (valor - inicio) * (1 - (1 - t) ** 3);
      el.textContent = formatar(v);
      de.current = v;
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, formatar]);

  return (
    <>
      <span ref={ref} aria-hidden>
        {formatar(valor)}
      </span>
      <span className="sr-only">{formatar(valor)}</span>
    </>
  );
}

/** A largura do elemento, que o SVG usa para se desenhar no tamanho certo. */
function useLargura(padrao: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(padrao);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w > 0) setLargura(w);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return [ref, largura] as const;
}

interface Dica {
  x: number;
  y: number;
  titulo: string;
  linhas: { rotulo: string; valor: string; cor?: string }[];
}

/** A caixinha que segue o ponteiro sobre um gráfico. */
function CaixaDeDica({ dica }: { dica: Dica | null }) {
  if (!dica) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 whitespace-nowrap rounded-xl border border-line bg-panel px-2.5 py-2 text-xs shadow-lg"
      style={{ left: dica.x + 14, top: dica.y - 12 }}
    >
      <p className="mb-1 text-muted">{dica.titulo}</p>
      {dica.linhas.map((l) => (
        <p key={l.rotulo} className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted">
            {l.cor && (
              <i
                className="inline-block size-2 rounded-[2px]"
                style={{ background: l.cor }}
              />
            )}
            {l.rotulo}
          </span>
          <b className="font-semibold tabular-nums">{l.valor}</b>
        </p>
      ))}
    </div>
  );
}

function Variacao({ fracao }: { fracao: number }) {
  const sobe = fracao >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold text-xs",
        sobe ? "bg-vagas/15 text-vagas" : "bg-danger/15 text-danger",
      )}
    >
      {sobe ? (
        <ArrowUp size={11} aria-hidden />
      ) : (
        <ArrowDown size={11} aria-hidden />
      )}
      {porcento(Math.abs(fracao))}
    </span>
  );
}

function Cartao({
  titulo,
  icone,
  className,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel p-5 sm:p-6",
        className,
      )}
    >
      <h2 className="flex items-center gap-2 font-semibold text-muted text-sm">
        <span className="text-ink">{icone}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Curva suave pelos pontos (Catmull-Rom em Bézier cúbica).
 *
 * Os pontos de controle ficam presos entre os dois pontos do trecho. Sem
 * isso a curva passa do ponto antes de um pico e cruza a linha do meio — e
 * nas ondas a linha do meio separa quem procura de quem contrata: um dia de
 * cadastro de candidato desenharia um vale do lado das empresas.
 */
function curva(pontos: [number, number][]): string {
  const n = pontos.length;
  if (n < 2) return "";
  const p = (i: number) => pontos[Math.max(0, Math.min(n - 1, i))];
  const entre = (v: number, a: number, b: number) =>
    Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  let d = `M${p(0)[0]},${p(0)[1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const k = 0.18;
    const y1 = entre(b[1] + (c[1] - a[1]) * k, b[1], c[1]);
    const y2 = entre(c[1] - (e[1] - b[1]) * k, b[1], c[1]);
    d += `C${b[0] + (c[0] - a[0]) * k},${y1} ${c[0] - (e[0] - b[0]) * k},${y2} ${c[0]},${c[1]}`;
  }
  return d;
}

/* ---------------- A: receita que se repete ---------------- */

function Medidor({ fracao }: { fracao: number | null }) {
  const raio = 70;
  const comprimento = Math.PI * raio;
  const preenchido = fracao === null ? 0 : comprimento * fracao;

  return (
    <svg
      viewBox="0 0 180 100"
      className="mx-auto mt-4 block w-full max-w-[260px]"
      role="img"
      aria-label={
        fracao === null
          ? "Sem custo cadastrado para comparar"
          : `A receita cobre ${porcento(fracao)} do custo do mês`
      }
    >
      <path
        d="M20,90 A70,70 0 0 1 160,90"
        fill="none"
        stroke="var(--color-panel-3)"
        strokeWidth={14}
        strokeLinecap="round"
      />
      <path
        d="M20,90 A70,70 0 0 1 160,90"
        fill="none"
        stroke={
          fracao !== null && fracao >= 1
            ? "var(--color-vagas)"
            : "var(--color-empresas)"
        }
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${preenchido} ${comprimento}`}
        className="transition-[stroke-dasharray] duration-1000"
      />
      <text
        x={90}
        y={78}
        textAnchor="middle"
        className="fill-[var(--color-ink)] font-bold"
        fontSize={24}
      >
        {fracao === null ? "—" : porcento(fracao)}
      </text>
      <text
        x={90}
        y={96}
        textAnchor="middle"
        className="fill-[var(--color-muted)]"
        fontSize={10}
      >
        dos custos do mês
      </text>
    </svg>
  );
}

function CartaoReceita({
  painel,
  custos,
}: {
  painel: PainelAdmin;
  custos: CustoMensal[];
}) {
  const { receita } = painel.funil;
  const custo = custos.reduce((s, c) => s + c.centavos, 0);
  const fracao = fracaoCoberta(receita.recorrenteAtivoCentavos, custo);
  const reais = (centavos: number) => formatMoneyBRL(centavos / 100);

  return (
    <Cartao
      titulo="Receita que se repete"
      icone={<TrendingUp size={16} aria-hidden />}
      className="lg:col-span-5"
    >
      <p className="mt-3 font-bold text-4xl tabular-nums leading-none">
        <NumeroQueSobe
          valor={receita.recorrenteAtivoCentavos}
          formatar={reais}
        />
        <span className="ml-1.5 font-normal text-muted text-sm">por mês</span>
      </p>
      <p className="mt-2 text-muted text-xs">
        {receita.assinaturasAtivas}{" "}
        {receita.assinaturasAtivas === 1
          ? "assinatura ativa"
          : "assinaturas ativas"}{" "}
        · {reais(receita.entrouUltimos30DiasCentavos)} entraram em 30 dias
      </p>
      <Medidor fracao={fracao} />
      <p className="mt-1 text-center text-faint text-xs">
        {fracao === null
          ? "Cadastre os custos em “O Lupa já se paga?” para ver a meta."
          : fracao >= 1
            ? "A receita que se repete já paga os custos do mês."
            : `Faltam ${reais(Math.max(0, custo - receita.recorrenteAtivoCentavos))} por mês para empatar.`}
      </p>
    </Cartao>
  );
}

/* ---------------- B: contas e as ondas de 30 dias ---------------- */

function Ondas({ painel }: { painel: PainelAdmin }) {
  const [ref, largura] = useLargura(560);
  const [dica, setDica] = useState<Dica | null>(null);
  const [foco, setFoco] = useState<number | null>(null);

  const dias = [...painel.cadastros].sort((a, b) => a.dia.localeCompare(b.dia));
  const altura = 150;
  const meio = altura / 2;
  const amplitude = meio - 12;
  const n = dias.length;
  const series = {
    candidatos: dias.map((d) => d.porPapel.candidato_clt ?? 0),
    prestadores: dias.map((d) => d.porPapel.prestador_servico ?? 0),
    empresas: dias.map((d) => d.porPapel.empresa ?? 0),
  };
  const maior = Math.max(
    1,
    ...series.candidatos,
    ...series.prestadores,
    ...series.empresas,
  );
  const X = (i: number) =>
    n <= 1 ? largura / 2 : 12 + (i / (n - 1)) * (largura - 24);
  const linha = (valores: number[], sentido: 1 | -1) =>
    curva(
      valores.map((v, i) => [
        X(i),
        meio - sentido * (2 + (v / maior) * amplitude),
      ]),
    );
  const dataCurta = (dia: string) =>
    new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    if (n === 0) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    const i = Math.max(
      0,
      Math.min(
        n - 1,
        Math.round(((e.clientX - caixa.left - 12) / (largura - 24)) * (n - 1)),
      ),
    );
    setFoco(i);
    setDica({
      x: e.clientX,
      y: e.clientY,
      titulo: dataCurta(dias[i].dia),
      linhas: [
        {
          rotulo: "Candidatos",
          valor: String(series.candidatos[i]),
          cor: COR_DO_PAPEL.candidatos,
        },
        {
          rotulo: "Prestadores",
          valor: String(series.prestadores[i]),
          cor: COR_DO_PAPEL.prestadores,
        },
        {
          rotulo: "Empresas",
          valor: String(series.empresas[i]),
          cor: COR_DO_PAPEL.empresas,
        },
      ],
    });
  };

  return (
    <div
      ref={ref}
      className="relative mt-4 overflow-hidden rounded-2xl border border-line bg-panel-2"
    >
      <svg
        width={largura}
        height={altura}
        className="block"
        role="img"
        aria-label={`Cadastros por dia nos últimos ${n} dias: quem procura acima da linha, quem contrata abaixo`}
      >
        <line
          x1={12}
          x2={largura - 12}
          y1={meio}
          y2={meio}
          stroke="var(--color-line)"
        />
        <text x={14} y={14} fontSize={10} className="fill-[var(--color-faint)]">
          quem procura
        </text>
        <text
          x={14}
          y={altura - 6}
          fontSize={10}
          className="fill-[var(--color-faint)]"
        >
          quem contrata
        </text>
        {n > 1 && (
          <>
            <path
              d={linha(series.prestadores, 1)}
              fill="none"
              stroke={COR_DO_PAPEL.prestadores}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.85}
            />
            <path
              d={linha(series.candidatos, 1)}
              fill="none"
              stroke={COR_DO_PAPEL.candidatos}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <path
              d={linha(series.empresas, -1)}
              fill="none"
              stroke={COR_DO_PAPEL.empresas}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </>
        )}
        {foco !== null && (
          <line
            x1={X(foco)}
            x2={X(foco)}
            y1={4}
            y2={altura - 4}
            stroke="var(--color-muted)"
            strokeOpacity={0.5}
          />
        )}
        <rect
          width={largura}
          height={altura}
          fill="transparent"
          onPointerMove={mover}
          onPointerLeave={() => {
            setFoco(null);
            setDica(null);
          }}
        />
      </svg>
      <CaixaDeDica dica={dica} />
    </div>
  );
}

function CartaoContas({ painel }: { painel: PainelAdmin }) {
  const ritmo = ritmoDeCadastros(painel.cadastros);
  const papeis = [
    ["Candidatos", painel.totais.candidatos, COR_DO_PAPEL.candidatos],
    ["Prestadores", painel.totais.prestadores, COR_DO_PAPEL.prestadores],
    ["Empresas", painel.totais.empresas, COR_DO_PAPEL.empresas],
  ] as const;

  return (
    <Cartao
      titulo="Contas"
      icone={<Users size={16} aria-hidden />}
      className="lg:col-span-7"
    >
      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="flex items-center gap-2 font-bold text-4xl tabular-nums leading-none">
            <NumeroQueSobe valor={painel.totais.usuarios} />
            {ritmo.variacao !== null && <Variacao fracao={ritmo.variacao} />}
          </p>
          <p className="mt-2 text-muted text-xs">
            {ritmo.ultimos7} {ritmo.ultimos7 === 1 ? "cadastro" : "cadastros"}{" "}
            nos últimos 7 dias
            {ritmo.variacao !== null &&
              `, contra ${ritmo.anteriores7} na semana anterior`}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {papeis.map(([rotulo, valor, cor]) => (
            <div key={rotulo}>
              <dt className="flex items-center gap-1.5 text-muted">
                <i
                  className="inline-block h-0.5 w-3.5 rounded-sm"
                  style={{ background: cor }}
                />
                {rotulo}
              </dt>
              <dd className="mt-0.5 font-semibold text-base text-ink tabular-nums">
                {inteiro(valor)}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-muted">Vagas abertas</dt>
            <dd className="mt-0.5 font-semibold text-base text-ink tabular-nums">
              {inteiro(painel.totais.vagasAbertas)}
            </dd>
          </div>
        </dl>
      </div>
      <Ondas painel={painel} />
    </Cartao>
  );
}

/* ---------------- C: onde estão as contas ---------------- */

const PAPEIS_DO_MAPA: { valor: PapelDoMapa; rotulo: string }[] = [
  { valor: "total", rotulo: "Todos" },
  { valor: "candidatos", rotulo: "Candidatos" },
  { valor: "prestadores", rotulo: "Prestadores" },
  { valor: "empresas", rotulo: "Empresas" },
];

function CartaoMapa({ painel }: { painel: PainelAdmin }) {
  const [papel, setPapel] = useState<PapelDoMapa>("total");
  const [ref, largura] = useLargura(600);
  const [dica, setDica] = useState<Dica | null>(null);
  const altura = 260;
  const vao = 6;

  const estados = estadosDoPapel(painel.lugares.estados, papel);
  const total = estados.reduce((s, e) => s + e.contas, 0);
  const retangulos = dividirEmRetangulos(
    estados.map((e) => ({ item: e, valor: e.contas })),
    largura + vao,
    altura + vao,
  );
  const regioesPresentes = REGIOES.filter((r) =>
    estados.some((e) => e.regiao === r),
  );

  return (
    <Cartao
      titulo="Onde estão as contas"
      icone={<Mapa size={16} aria-hidden />}
      className="lg:col-span-7"
    >
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <fieldset className="inline-flex rounded-xl bg-panel-2 p-0.5">
          <legend className="sr-only">Papel no mapa</legend>
          {PAPEIS_DO_MAPA.map((p) => (
            <button
              key={p.valor}
              type="button"
              aria-pressed={papel === p.valor}
              onClick={() => setPapel(p.valor)}
              className={cn(
                "min-h-10 rounded-[10px] px-3 font-medium text-xs transition-colors",
                papel === p.valor
                  ? "bg-panel text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </fieldset>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted text-xs">
          {regioesPresentes.map((r) => (
            <li key={r} className="inline-flex items-center gap-1.5">
              <i
                className="inline-block size-2 rounded-[2px]"
                style={{ background: COR_DA_REGIAO[r] }}
              />
              {r}
            </li>
          ))}
        </ul>
      </div>

      {estados.length === 0 ? (
        <p className="mt-6 text-muted text-sm">
          Nenhuma conta neste papel ainda.
        </p>
      ) : (
        <div
          ref={ref}
          className="relative mt-4"
          style={{ height: altura }}
          role="img"
          aria-label={`Contas por estado: ${estados
            .map((e) => `${e.uf} ${e.contas}`)
            .join(", ")}`}
        >
          {retangulos.map((r) => {
            const w = r.w - vao;
            const h = r.h - vao;
            const cor = COR_DA_REGIAO[r.item.regiao];
            const parte = porcento(r.item.contas / total);
            return (
              <div
                key={r.item.uf}
                className="absolute flex flex-col justify-between overflow-hidden rounded-xl border p-2.5 text-ink transition-[left,top,width,height] duration-500"
                style={{
                  left: r.x,
                  top: r.y,
                  width: Math.max(0, w),
                  height: Math.max(0, h),
                  background: `color-mix(in oklab, ${cor} 22%, var(--color-panel))`,
                  borderColor: `color-mix(in oklab, ${cor} 45%, transparent)`,
                }}
                onPointerMove={(e) =>
                  setDica({
                    x: e.clientX,
                    y: e.clientY,
                    titulo: `${r.item.uf} · ${r.item.regiao}`,
                    linhas: [
                      {
                        rotulo: "Contas",
                        valor: inteiro(r.item.contas),
                        cor,
                      },
                      { rotulo: "Do total", valor: parte },
                    ],
                  })
                }
                onPointerLeave={() => setDica(null)}
              >
                {w > 44 && h > 30 && (
                  <span className="font-semibold text-xs">{r.item.uf}</span>
                )}
                {w > 70 && h > 64 && (
                  <span className="flex items-end justify-between gap-1">
                    <span className="font-bold text-2xl tabular-nums leading-none">
                      {inteiro(r.item.contas)}
                    </span>
                    <span className="rounded-md bg-panel px-1.5 py-0.5 font-medium text-[10px] text-muted">
                      {parte}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <CaixaDeDica dica={dica} />
    </Cartao>
  );
}

/* ---------------- D: onde o funil vaza ---------------- */

function RadarDoFunil({ painel }: { painel: PainelAdmin }) {
  const passos = passosDoFunil(painel.funil);
  const lado = 300;
  const centro = lado / 2;
  const raio = centro - 52;
  const angulo = (i: number) =>
    -Math.PI / 2 + (i / passos.length) * Math.PI * 2;
  const ponto = (i: number, f: number): [number, number] => [
    centro + Math.cos(angulo(i)) * raio * Math.max(0.04, f),
    centro + Math.sin(angulo(i)) * raio * Math.max(0.04, f),
  ];
  const forma = `${passos
    .map((p, i) => ponto(i, p.fracao ?? 0))
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join("")}Z`;

  return (
    <svg
      viewBox={`0 0 ${lado} ${lado}`}
      className="mx-auto mt-2 block w-full max-w-[320px]"
      role="img"
      aria-label={`Fração de cada papel que chega a cada passo: ${passos
        .map(
          (p) =>
            `${p.rotulo} ${p.fracao === null ? "sem contas" : porcento(p.fracao)}`,
        )
        .join(", ")}`}
    >
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={passos
            .map((_, i) =>
              ponto(i, k)
                .map((v) => v.toFixed(1))
                .join(","),
            )
            .join(" ")}
          fill="none"
          stroke="var(--color-line)"
        />
      ))}
      {passos.map((p, i) => {
        const [x, y] = ponto(i, 1);
        const [tx, ty] = [
          centro + Math.cos(angulo(i)) * (raio + 26),
          centro + Math.sin(angulo(i)) * (raio + 26),
        ];
        return (
          <g key={`${p.papel}-${p.rotulo}`}>
            <line
              x1={centro}
              y1={centro}
              x2={x}
              y2={y}
              stroke="var(--color-line)"
            />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              style={{ fill: COR_DO_PAPEL[p.papel] }}
              className="font-semibold"
            >
              {p.rotulo}
            </text>
          </g>
        );
      })}
      <path
        d={forma}
        fill="var(--color-vagas)"
        fillOpacity={0.14}
        stroke="var(--color-vagas)"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {passos.map((p, i) => {
        const [x, y] = ponto(i, p.fracao ?? 0);
        return (
          <circle
            key={`${p.papel}-${p.rotulo}-ponto`}
            cx={x}
            cy={y}
            r={3.5}
            style={{ fill: COR_DO_PAPEL[p.papel] }}
            stroke="var(--color-panel)"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

function CartaoFunil({ painel }: { painel: PainelAdmin }) {
  const vazamentos = maioresVazamentos(passosDoFunil(painel.funil));

  return (
    <Cartao
      titulo="Onde o funil vaza"
      icone={<Radar size={16} aria-hidden />}
      className="lg:col-span-5"
    >
      <p className="mt-2 text-muted text-xs">
        Quanto de cada papel chega a cada passo. Quanto mais perto do centro,
        mais gente para ali.
      </p>
      <RadarDoFunil painel={painel} />
      {vazamentos.length > 0 && (
        <ul className="mt-2 divide-y divide-line border-line border-t text-sm">
          {vazamentos.map((p) => (
            <li
              key={`${p.papel}-${p.rotulo}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="text-muted">
                <span
                  className="font-semibold"
                  style={{ color: COR_DO_PAPEL[p.papel] }}
                >
                  {p.papel[0].toUpperCase() + p.papel.slice(1)}
                </span>{" "}
                · {p.rotulo.toLowerCase()}
              </span>
              <span className="tabular-nums">
                <b className="text-ink">{p.chegaram}</b>
                <span className="text-muted"> de {p.de}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/* ---------------- a grade ---------------- */

export function VisaoGeral({ painel }: { painel: PainelAdmin }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <CartaoReceita painel={painel} custos={painel.custos} />
      <CartaoContas painel={painel} />
      <CartaoMapa painel={painel} />
      <CartaoFunil painel={painel} />
    </div>
  );
}
