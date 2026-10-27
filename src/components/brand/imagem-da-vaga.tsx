import { LOGO_HORIZONTAL, NOME, simbolo } from "@/components/brand/marca";
import { formatSalaryRange } from "@/lib/format";
import type { JobListing } from "@/lib/types";

/**
 * As duas imagens de uma vaga: a miniatura do link e a arte de story (#490).
 *
 * São a mesma coisa em dois formatos. A miniatura (1200 × 630) é o que o
 * WhatsApp, o Instagram e o Facebook mostram quando o link da vaga é colado;
 * a arte (1080 × 1920) é o que a empresa baixa para postar em story e status.
 * Nas duas, o que vai escrito é **só o que a página pública da vaga já
 * mostra** — cargo, empresa, cidade, endereço e salário. Nenhum contato:
 * uma imagem sai do app para onde não há login, e telefone ou e-mail nela
 * sairiam junto.
 *
 * As cores levam hex escrito, pela mesma razão de `opengraph-image.tsx`:
 * `ImageResponse` não lê o `@theme`. São as do tema escuro do app.
 *
 * Nenhum emoji, de propósito: o renderizador busca o emoji numa CDN em cada
 * imagem, e a miniatura de um link não pode depender de rede de terceiro.
 */
const FUNDO = "#0b0f14";
const PAINEL = "#141b23";
const TEXTO = "#f2f5f8";
const DISCRETO = "#9aa7b4";
const ARO_DE = "#c8ee6a";
const ARO_ATE = "#7fb02a";
const DESTAQUE = "#a8d94a";

export interface DadosDaImagem {
  cargo: string;
  empresa: string;
  cidade: string;
  endereco: string | null;
  salario: string | null;
  contrato: string | null;
}

/** O que a imagem diz de uma vaga, já enxuto: nada de texto que estoure. */
export function dadosDaImagem(job: JobListing): DadosDaImagem {
  const salario = formatSalaryRange(job.salary_min, job.salary_max);
  return {
    cargo: job.title,
    empresa: job.company.company_name,
    cidade: job.neighborhood ? `${job.neighborhood}, ${job.city}` : job.city,
    endereco: job.address,
    salario: salario === "A combinar" ? null : salario,
    contrato: job.contract_type,
  };
}

/** Corta no limite sem deixar a palavra pela metade. */
function resumir(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const corte = texto.slice(0, limite - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`;
}

/** Título que cabe: quanto mais longo o cargo, menor a letra. */
function tamanhoDoCargo(cargo: string, grande: number, medio: number) {
  if (cargo.length <= 28) return grande;
  if (cargo.length <= 48) return medio;
  return Math.round(medio * 0.82);
}

function Logo({ largura }: { largura: number }) {
  return (
    <svg
      role="img"
      aria-label="Lupa"
      width={largura}
      height={Math.round((largura * 64) / 180)}
      viewBox={LOGO_HORIZONTAL.viewBox}
      fill="none"
      style={{ display: "flex" }}
    >
      <defs>
        <linearGradient
          id="aro"
          gradientUnits="userSpaceOnUse"
          x1="6"
          y1="4"
          x2="60"
          y2="58"
        >
          <stop offset="0" stopColor={ARO_DE} />
          <stop offset="1" stopColor={ARO_ATE} />
        </linearGradient>
      </defs>
      {simbolo({ aro: "url(#aro)", disco: TEXTO, pessoa: FUNDO })}
      <path d={NOME.d} fill={TEXTO} transform={LOGO_HORIZONTAL.nome} />
    </svg>
  );
}

/** A miniatura do link, 1200 × 630. */
export function CartaoDaVaga({ vaga }: { vaga: DadosDaImagem }) {
  const detalhes = [vaga.cidade, vaga.salario, vaga.contrato].filter(
    (d): d is string => Boolean(d),
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        background: FUNDO,
        color: TEXTO,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Logo largura={210} />
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: DESTAQUE,
            border: `2px solid ${DESTAQUE}`,
            borderRadius: 999,
            padding: "6px 22px",
          }}
        >
          Vaga aberta
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: tamanhoDoCargo(vaga.cargo, 78, 62),
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -1.5,
          }}
        >
          {resumir(vaga.cargo, 70)}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 38,
            color: DISCRETO,
          }}
        >
          {resumir(vaga.empresa, 48)}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {detalhes.map((d) => (
            <div
              key={d}
              style={{
                display: "flex",
                fontSize: 30,
                background: PAINEL,
                borderRadius: 14,
                padding: "8px 20px",
              }}
            >
              {resumir(d, 36)}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 30,
            fontWeight: 700,
            color: DESTAQUE,
          }}
        >
          Veja a vaga e candidate-se na Lupa
        </div>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: DISCRETO,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        {rotulo}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 8,
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.15,
        }}
      >
        {valor}
      </div>
    </div>
  );
}

/** A arte de story e status, 1080 × 1920. */
export function ArteDaVaga({
  vaga,
  endereco,
}: {
  vaga: DadosDaImagem;
  /** O endereço público da Lupa, sem o esquema: "lupapp.com.br". */
  endereco: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "120px 88px 110px",
        background: FUNDO,
        color: TEXTO,
      }}
    >
      <Logo largura={380} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 38,
            fontWeight: 700,
            color: DESTAQUE,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          Estamos contratando
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: tamanhoDoCargo(vaga.cargo, 128, 104),
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: -3,
          }}
        >
          {resumir(vaga.cargo, 70)}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 48,
            color: DISCRETO,
          }}
        >
          {resumir(vaga.empresa, 48)}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 56,
            paddingTop: 8,
            borderTop: `3px solid ${PAINEL}`,
          }}
        >
          <Linha rotulo="Cidade" valor={vaga.cidade} />
          {vaga.endereco && (
            <Linha rotulo="Endereço" valor={resumir(vaga.endereco, 80)} />
          )}
          {vaga.salario && <Linha rotulo="Salário" valor={vaga.salario} />}
          {vaga.contrato && <Linha rotulo="Contrato" valor={vaga.contrato} />}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: PAINEL,
          borderRadius: 32,
          padding: "44px 52px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 50,
            fontWeight: 700,
            color: DESTAQUE,
          }}
        >
          Candidate-se na Lupa
        </div>
        <div
          style={{ display: "flex", marginTop: 12, fontSize: 38, color: TEXTO }}
        >
          {endereco}
        </div>
      </div>
    </div>
  );
}
