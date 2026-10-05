import { ImageResponse } from "next/og";
import { simbolo } from "@/components/brand/marca";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// As mesmas cores de `icon.tsx`; ver o comentário de lá.
const FUNDO_DE = "#8cc63f";
const FUNDO_ATE = "#2f5a0b";
const ARO = "#ffffff";
const DISCO = "#1f3f08";
const PESSOA = "#ffffff";

/** iOS não aplica máscara: o fundo precisa vir desenhado no próprio ícone. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${FUNDO_DE}, ${FUNDO_ATE})`,
      }}
    >
      <svg width="116" height="116" viewBox="0 0 64 64" fill="none">
        {simbolo({ aro: ARO, disco: DISCO, pessoa: PESSOA })}
      </svg>
    </div>,
    size,
  );
}
