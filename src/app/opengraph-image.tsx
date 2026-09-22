import { ImageResponse } from "next/og";

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
        background: "#0b0f14",
        color: "#f2f5f8",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width="120" height="120" viewBox="0 0 48 48" fill="none">
          <circle cx="21" cy="21" r="14" stroke="#a8d94a" strokeWidth="4" />
          <line
            x1="31"
            y1="31"
            x2="43"
            y2="43"
            stroke="#a8d94a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M15 21 L19 25 L28 15"
            stroke="#f2f5f8"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>
          Lupa
        </div>
      </div>

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
        Vagas e prestadores de serviço em Sinop e todo o Mato Grosso
      </div>
    </div>,
    size,
  );
}
