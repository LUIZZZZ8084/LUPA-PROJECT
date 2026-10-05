import { ImageResponse } from "next/og";
import { LOGO_HORIZONTAL, NOME, simbolo } from "@/components/brand/marca";

export const alt = "Lupa — Trabalho e profissionais perto de você";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * A miniatura do link, quando alguém cola lupapp.com.br no WhatsApp (#259).
 *
 * Desde que o app fechou por login, todo mundo chega por link recebido — e
 * o link, aqui, anda pelo WhatsApp. Sem esta imagem a prévia era duas
 * linhas de texto, na primeira impressão de quem ainda não conhece a Lupa.
 *
 * Mesma paleta de `icon.tsx`, pela mesma razão escrita lá: `ImageResponse`
 * não lê `@theme`, então os hex ficam aqui. É onde a troca de paleta
 * esquece — está dito para não esquecer.
 *
 * O texto não promete nada que o produto não entregue: nada de
 * "verificado" (#237, #243). Diz o que a Lupa é e onde.
 *
 * Esta rota precisa estar no matcher do `proxy.ts`: quem busca a imagem é o
 * servidor do WhatsApp, sem sessão, e o muro o mandaria para `/entrar`.
 */
// A logo sobre o fundo escuro: as mesmas cores do tema escuro do app.
const FUNDO = "#0b0f14";
const TEXTO = "#f2f5f8";
const ARO_DE = "#c8ee6a";
const ARO_ATE = "#7fb02a";

export default function ImagemDoLink() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 96px",
        background: FUNDO,
        color: TEXTO,
      }}
    >
      <svg
        width="420"
        height="150"
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

      <div
        style={{
          marginTop: 44,
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -1.5,
        }}
      >
        Trabalho e profissionais
      </div>
      <div
        style={{
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -1.5,
          color: "#a8d94a",
        }}
      >
        perto de você.
      </div>

      <div style={{ marginTop: 36, fontSize: 32, color: "#9aa7b4" }}>
        Vagas e prestadores de serviço no Brasil inteiro
      </div>
    </div>,
    size,
  );
}
