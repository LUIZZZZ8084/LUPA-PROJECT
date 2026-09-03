import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * Ícone do app gerado em build — evita manter PNGs no repositório.
 *
 * `ImageResponse` não lê `@theme`: o hex de `--color-vagas` vem hardcoded
 * aqui e em `apple-icon.tsx`. É onde a troca de paleta esquece.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0f14",
      }}
    >
      <svg width="360" height="360" viewBox="0 0 48 48" fill="none">
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
    </div>,
    size,
  );
}
