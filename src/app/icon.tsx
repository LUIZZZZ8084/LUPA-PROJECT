import { ImageResponse } from "next/og";
import { simbolo } from "@/components/brand/marca";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/*
 * As cores moram aqui, em `apple-icon.tsx` e em `scripts/gerar-favicon.mjs`,
 * com os mesmos nomes: `ImageResponse` não lê o `@theme`, e há teste
 * (`tests/unit/favicon.test.ts`) que cobra que os três não se separem. É
 * onde a troca de paleta esquece.
 */
const FUNDO_DE = "#8cc63f";
const FUNDO_ATE = "#2f5a0b";
const ARO = "#ffffff";
const DISCO = "#1f3f08";
const PESSOA = "#ffffff";

/**
 * Ícone do app gerado em build — evita manter PNGs no repositório.
 *
 * O fundo vai de ponta a ponta, sem cantos: o Android recorta este mesmo
 * arquivo como ícone mascarável (`manifest.ts`), em círculo, quadrado
 * arredondado ou gota. O símbolo fica dentro do círculo central de 80% do
 * lado, que é a zona que nenhum recorte corta — 330 px de quadro deixam o
 * desenho visível com cerca de 193 px do centro até a ponta do cabo, para
 * 205 de zona segura.
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
        background: `linear-gradient(135deg, ${FUNDO_DE}, ${FUNDO_ATE})`,
      }}
    >
      <svg width="330" height="330" viewBox="0 0 64 64" fill="none">
        {simbolo({ aro: ARO, disco: DISCO, pessoa: PESSOA })}
      </svg>
    </div>,
    size,
  );
}
