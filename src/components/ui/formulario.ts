"use client";

import { type FormEvent, startTransition, useEffect, useRef } from "react";

/**
 * Envia o formulário pela action sem deixar o React apagá-lo (#291).
 *
 * O React 19 limpa todo `<form action={...}>` depois que a action termina,
 * deu certo ou não. Para ele, a action "terminou"; que ela tenha devolvido
 * erro de campo é assunto nosso. O servidor apontava certinho o CPF errado, e
 * a mensagem chegava num formulário já em branco: quem errou um campo
 * preenchia o cadastro inteiro de novo. Relato do Luiz em 25/09/2026.
 *
 * O `onSubmit` cancela o envio padrão e chama a action dentro de uma
 * transição. Nesse caminho o React não chama o reset: ele só limpa quando
 * quem dispara a action é ele próprio, pelo `action` do formulário. O
 * `action` continua no `<form>` mesmo assim, para o envio funcionar antes de
 * o JavaScript carregar, que é quando o Next manda o formulário direto ao
 * servidor.
 *
 * Quando volta erro de campo, a tela rola até o primeiro campo errado e põe o
 * cursor nele. No celular, o CPF fica no topo do cadastro e o botão no fim:
 * sem isto, a mensagem aparece fora da tela e a pessoa acha que nada
 * aconteceu.
 *
 * Uso: `<form action={acao} {...envio}>`, com
 * `const envio = useEnvioQueNaoApaga(acao, estado)`.
 */
export function useEnvioQueNaoApaga(
  acao: (dados: FormData) => void,
  estado: { ok?: boolean; campos?: Record<string, string> },
  opcoes: {
    /**
     * Limpa quando dá certo, para o formulário que continua na tela depois
     * do envio e serve para mandar outro (uma foto nova, mais um trabalho).
     * Os que somem ou navegam depois do sucesso não precisam.
     */
    limparAoConcluir?: boolean;
  } = {},
) {
  const ref = useRef<HTMLFormElement>(null);
  const { limparAoConcluir } = opcoes;

  /*
   * Depende do objeto `estado`, e não de `ok` e `campos` soltos: dois
   * sucessos seguidos deixam `ok` igual a `true` nas duas vezes, e o segundo
   * não limparia nada. Cada resposta da action é um objeto novo.
   */
  useEffect(() => {
    const formulario = ref.current;
    if (!formulario) return;
    const { ok, campos } = estado;

    if (ok) {
      if (limparAoConcluir) formulario.reset();
      return;
    }

    if (!campos || Object.keys(campos).length === 0) return;
    const errado = formulario.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (!errado) return;
    errado.scrollIntoView?.({ block: "center", behavior: "smooth" });
    errado.focus({ preventScroll: true });
  }, [estado, limparAoConcluir]);

  function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    startTransition(() => acao(dados));
  }

  return { ref, onSubmit };
}
