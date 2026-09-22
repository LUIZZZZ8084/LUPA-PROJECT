"use client";

import "./globals.css";
import { ErroDaTela } from "@/components/erro-da-tela";

/**
 * Quando o layout raiz quebra (#249).
 *
 * É a única fronteira que substitui o `<html>` inteiro, então precisa do
 * próprio — e do CSS, que viria do layout que acabou de falhar. A fonte
 * não vem junto: cai na pilha de sistema de `--font-sans`, que é o preço
 * aceitável de uma tela que só aparece quando todo o resto caiu.
 */
export default function ErroGlobal(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-full flex-col bg-bg text-ink antialiased">
        <ErroDaTela {...props} />
      </body>
    </html>
  );
}
