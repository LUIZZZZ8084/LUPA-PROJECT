"use client";

import { Loader2, XCircle } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { encerrarVaga } from "./actions";

/**
 * Encerra uma vaga publicada (#481).
 *
 * **Discreto até a pessoa querer.** Eram um botão vermelho cheio por vaga, e
 * numa lista de quatro vagas era o elemento mais chamativo da tela, mais que o
 * cargo. Agora "Encerrar" é um botão de contorno, como os outros da linha, e o
 * vermelho aparece só na confirmação.
 *
 * **A confirmação é um quadro na própria tela, e não o `confirm()` do
 * navegador.** É o mesmo padrão do cancelamento de assinatura
 * (`CancelarRenovacaoButton`): o quadro diz o que acontece (a vaga some da
 * busca, os currículos continuam), e "Voltar" desiste. A caixa nativa sai da
 * identidade do app e, no app instalado, abre com o nome do site no título.
 *
 * **O botão fica no lugar e abre o quadro** (`aria-expanded`), em vez de
 * sumir e dar lugar a outros dois. Assim o foco do teclado não se perde quando
 * o botão deixaria de existir, e o quadro é o próximo item na ordem de Tab.
 *
 * Devolve dois filhos para a linha da lista, o botão e o quadro. O quadro
 * ocupa a linha inteira (`basis-full`), então a linha precisa ser `flex-wrap`.
 */
export function EncerrarVagaButton({
  id,
  titulo,
}: {
  id: string;
  titulo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idDoQuadro = useId();

  return (
    <>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={confirmando}
          aria-controls={idDoQuadro}
          disabled={pending}
          onClick={() => {
            setErro(null);
            setConfirmando((aberto) => !aberto);
          }}
        >
          <XCircle size={14} />
          Encerrar
        </Button>
        {erro && <p className="text-xs text-danger">{erro}</p>}
      </div>

      {confirmando && (
        <fieldset
          id={idDoQuadro}
          className="min-w-0 basis-full rounded-xl border border-warn/30 bg-warn/8 p-3"
        >
          <legend className="sr-only">
            Confirmar o encerramento de {titulo}
          </legend>
          <p className="text-sm leading-relaxed">
            Encerrar <strong>{titulo}</strong>? A vaga some da busca pública, e
            os currículos já recebidos continuam aqui.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                setErro(null);
                startTransition(async () => {
                  const resposta = await encerrarVaga({ id });
                  if (!resposta.ok) {
                    setErro(resposta.mensagem);
                    setConfirmando(false);
                  }
                });
              }}
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <XCircle size={14} />
              )}
              Encerrar vaga
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmando(false)}
            >
              Voltar
            </Button>
          </div>
        </fieldset>
      )}
    </>
  );
}
