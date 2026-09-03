"use client";

import { Check, Loader2, Star } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { avaliarComEstado, type EstadoAvaliacao } from "./actions";

const inicial: EstadoAvaliacao = {};

/**
 * Escolher a nota clicando nas estrelas.
 *
 * O valor viaja num `input` escondido, e não num estado que o servidor
 * nunca vê: assim o formulário continua sendo um formulário de verdade —
 * envia sem JavaScript e é lido por leitor de tela como um grupo de
 * botões de opção, que é o que ele é.
 */
function Nota({ erro }: { erro?: string }) {
  const [nota, setNota] = useState(0);
  const grupo = useId();

  return (
    <fieldset>
      <legend className="mb-2 font-medium text-sm">
        Sua nota <span className="text-danger">*</span>
      </legend>

      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded-lg p-1 focus-within:ring-2 focus-within:ring-servicos"
          >
            <input
              type="radio"
              name="nota"
              value={n}
              id={`${grupo}-${n}`}
              checked={nota === n}
              onChange={() => setNota(n)}
              className="sr-only"
              required
            />
            <Star
              size={26}
              aria-hidden
              className={
                n <= nota
                  ? "fill-star text-star"
                  : "text-line transition-colors hover:text-muted"
              }
            />
            <span className="sr-only">
              {n} {n === 1 ? "estrela" : "estrelas"}
            </span>
          </label>
        ))}
      </div>

      {erro && <p className="mt-2 text-danger text-sm">{erro}</p>}
    </fieldset>
  );
}

export function FormularioDeAvaliacao({
  prestadorId,
  nomeDoPrestador,
}: {
  prestadorId: string;
  nomeDoPrestador: string;
}) {
  const [state, action, pendente] = useActionState(avaliarComEstado, inicial);

  if (state.ok) {
    return (
      <Panel className="mt-5 border-vagas/30 bg-vagas/8">
        <div className="flex items-start gap-3">
          <Check size={20} className="mt-0.5 flex-none text-vagas" />
          <div>
            <h2 className="font-bold text-base">Avaliação enviada</h2>
            <p className="mt-1.5 text-muted text-sm leading-relaxed">
              Obrigado. É isto que ajuda a próxima pessoa a decidir.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <form action={action}>
      <Panel className="mt-5 space-y-5">
        <div>
          <h2 className="font-bold text-base">
            Você foi atendido por {nomeDoPrestador.split(" ")[0]}?
          </h2>
          <p className="mt-1 text-muted text-sm leading-relaxed">
            Sua avaliação fica no perfil e ajuda quem vai contratar depois. Cada
            pessoa avalia uma vez.
          </p>
        </div>

        <input type="hidden" name="prestadorId" value={prestadorId} />

        <Nota erro={state.campos?.nota} />

        <Field
          label="Como foi o serviço"
          error={state.campos?.comentario}
          hint="Opcional, mas é o que mais ajuda: o que foi feito, se cumpriu o combinado, se você chamaria de novo."
        >
          <Textarea
            name="comentario"
            rows={3}
            placeholder="Chegou na hora e explicou o que ia fazer antes de começar."
          />
        </Field>

        {state.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
            {state.erro}
          </p>
        )}

        <div className="flex justify-end border-line border-t pt-5">
          <Button type="submit" variant="servicos" disabled={pendente}>
            {pendente && <Loader2 size={16} className="animate-spin" />}
            Enviar avaliação
          </Button>
        </div>
      </Panel>
    </form>
  );
}
