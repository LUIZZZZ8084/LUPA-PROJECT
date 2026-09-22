"use client";

import { ErroDaTela } from "@/components/erro-da-tela";

/**
 * Erro fora do grupo `(app)`: telas de entrada e o próprio layout do app
 * (#249). Sem menu, porque o que quebrou pode ter sido justamente ele.
 */
export default function Erro(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDaTela {...props} />;
}
