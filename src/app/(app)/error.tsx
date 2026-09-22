"use client";

import { ErroDaTela } from "@/components/erro-da-tela";

/**
 * Erro dentro do app, com cabeçalho e barra inferior de pé (#249).
 *
 * Fica dentro do grupo `(app)` de propósito: a fronteira substitui só a
 * página, e a pessoa sai dali pela navegação que já conhece — em vez de
 * ficar presa numa tela sem menu, dependendo do botão de voltar do
 * celular.
 */
export default function Erro(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroDaTela {...props} />;
}
