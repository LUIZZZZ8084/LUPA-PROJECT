"use client";

import { Check, Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { candidatarSe } from "@/app/(app)/vagas/[id]/actions";
import { Button } from "@/components/ui/button";
import type { PerguntaDeTriagem } from "@/lib/triagem";

export function ApplyButton({
  jobId,
  perguntas = [],
}: {
  jobId: string;
  /** As perguntas de triagem da vaga (#491), se a empresa fez alguma. */
  perguntas?: PerguntaDeTriagem[];
}) {
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * Com perguntas, "Candidatar-se" abre as perguntas e só o botão seguinte
   * envia. `null` é "ainda não respondeu" — sem isso, "Não" seria o padrão, e
   * uma pessoa distraída se candidataria dizendo que não tem a CNH que tem.
   */
  const [aberto, setAberto] = useState(false);
  const [respostas, setRespostas] = useState<(boolean | null)[]>(() =>
    perguntas.map(() => null),
  );

  const respondeuTudo = respostas.every((r) => r !== null);
  const faltam = respostas.filter((r) => r === null).length;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await candidatarSe({
        vagaId: jobId,
        respostas: perguntas.length > 0 ? respostas : undefined,
      });
      if (result.ok) setApplied(true);
      else setError(result.mensagem);
    });
  }

  if (applied) {
    return (
      // `data-acao-concluida`: a barra fixa da tela solta (#479).
      <div data-acao-concluida className="space-y-2">
        <Button variant="outline" size="lg" block disabled>
          <Check size={18} className="text-vagas" />
          Candidatura enviada
        </Button>
        <p className="text-center text-xs text-muted">
          A empresa recebe seu perfil e currículo. Você acompanha o status em
          &ldquo;Minhas candidaturas&rdquo;.
        </p>
      </div>
    );
  }

  const comPerguntas = perguntas.length > 0;

  return (
    <div className="space-y-2">
      {comPerguntas && aberto && (
        <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-line bg-panel-2 p-3">
          <p className="font-semibold text-sm">
            A empresa quer saber antes de receber seu currículo
          </p>
          {perguntas.map((pergunta, i) => (
            <fieldset key={pergunta.texto} className="min-w-0">
              <legend className="mb-1.5 text-sm leading-snug">
                {pergunta.texto}
                {pergunta.eliminatoria && (
                  <span className="ml-1.5 text-faint text-xs">
                    (indispensável para a vaga)
                  </span>
                )}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    [true, "Sim"],
                    [false, "Não"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <label
                    key={rotulo}
                    className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line px-2 py-2 text-[13px] text-muted transition-colors hover:border-line-soft has-[:checked]:border-vagas has-[:checked]:bg-vagas/8 has-[:checked]:text-ink"
                  >
                    <input
                      type="radio"
                      name={`pergunta-${i}`}
                      checked={respostas[i] === valor}
                      onChange={() =>
                        setRespostas((atuais) =>
                          atuais.map((r, j) => (j === i ? valor : r)),
                        )
                      }
                      className="accent-vagas"
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {!respondeuTudo && (
            <p className="text-faint text-xs">
              {faltam === 1
                ? "Falta responder 1 pergunta para enviar."
                : `Faltam ${faltam} perguntas para enviar.`}
            </p>
          )}
        </div>
      )}

      <Button
        variant="vagas"
        size="lg"
        block
        onClick={comPerguntas && !aberto ? () => setAberto(true) : submit}
        disabled={pending || (comPerguntas && aberto && !respondeuTudo)}
      >
        {pending ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Send size={17} />
        )}
        {comPerguntas && aberto ? "Enviar candidatura" : "Candidatar-se"}
      </Button>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
