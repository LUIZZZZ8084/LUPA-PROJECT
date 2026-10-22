"use client";

import { Check, Flag, Loader2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import {
  denunciarComEstado,
  type EstadoDenuncia,
} from "@/app/denuncias/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";

const inicial: EstadoDenuncia = {};

/*
 * Os motivos repetem `MOTIVOS_DE_DENUNCIA`, do servidor, porque este é um
 * componente de cliente e aquele módulo é `server-only`. O teste de
 * `denuncias.test.ts` compara os dois.
 */
export const MOTIVOS_NA_TELA = [
  { valor: "golpe", rotulo: "Golpe ou cobrança de taxa" },
  { valor: "falsa", rotulo: "Falsa ou enganosa" },
  { valor: "ofensiva", rotulo: "Ofensiva ou discriminatória" },
  { valor: "outro", rotulo: "Outro motivo" },
] as const;

/**
 * Denunciar uma vaga, uma avaliação ou uma foto de trabalho (#435, #452).
 *
 * Fechado até a pessoa pedir, e discreto: é um recurso de exceção, e um
 * botão vermelho em toda vaga ensinaria a desconfiar de todas. Depois de
 * enviar, diz o que acontece agora — quem decide é quem cuida da Lupa, e o
 * denunciado não fica sabendo quem denunciou.
 */
export function Denunciar({
  alvo,
  alvoId,
  prestadorId,
}: {
  alvo: "vaga" | "avaliacao" | "publicacao";
  alvoId: string;
  prestadorId?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const rotulo =
    alvo === "vaga"
      ? "Denunciar esta vaga"
      : alvo === "publicacao"
        ? "Denunciar esta foto"
        : "Denunciar";

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="-my-3.5 inline-flex items-center gap-1.5 py-3.5 text-xs text-muted underline-offset-2 hover:underline"
      >
        <Flag size={12} />
        {rotulo}
      </button>
    );
  }

  return (
    <FormularioDeDenuncia
      alvo={alvo}
      alvoId={alvoId}
      prestadorId={prestadorId}
      aoCancelar={() => setAberto(false)}
    />
  );
}

function FormularioDeDenuncia({
  alvo,
  alvoId,
  prestadorId,
  aoCancelar,
}: {
  alvo: "vaga" | "avaliacao" | "publicacao";
  alvoId: string;
  prestadorId?: string;
  aoCancelar: () => void;
}) {
  const [state, action, pendente] = useActionState(denunciarComEstado, inicial);
  const envio = useEnvioQueNaoApaga(action, state);
  const id = useId();

  if (state.ok) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 text-sm leading-relaxed text-muted"
      >
        <Check size={16} className="mt-0.5 flex-none text-vagas" />
        Recebemos sua denúncia. Quem cuida da Lupa vai olhar, e quem foi
        denunciado não fica sabendo quem denunciou.
      </p>
    );
  }

  return (
    <form
      action={action}
      {...envio}
      className="w-full space-y-3 rounded-xl border border-line bg-panel-2 p-4"
    >
      <input type="hidden" name="alvo" value={alvo} />
      <input type="hidden" name="alvoId" value={alvoId} />
      {prestadorId && (
        <input type="hidden" name="prestadorId" value={prestadorId} />
      )}

      <fieldset>
        <legend className="text-sm font-semibold">
          {
            {
              vaga: "O que há de errado com esta vaga?",
              avaliacao: "O que há de errado com esta avaliação?",
              publicacao: "O que há de errado com esta foto?",
            }[alvo]
          }
        </legend>
        <div className="mt-2 space-y-1.5">
          {MOTIVOS_NA_TELA.map((m) => (
            <label
              key={m.valor}
              htmlFor={`${id}-${m.valor}`}
              className="flex items-center gap-2 text-sm"
            >
              <input
                id={`${id}-${m.valor}`}
                type="radio"
                name="motivo"
                value={m.valor}
                required
                className="h-4 w-4 accent-danger"
              />
              {m.rotulo}
            </label>
          ))}
        </div>
        {state.campos?.motivo && (
          <p className="mt-1 text-danger text-sm">{state.campos.motivo}</p>
        )}
      </fieldset>

      <Field
        label="Conte o que aconteceu"
        hint="Opcional. Ajuda quem vai decidir."
        error={state.campos?.detalhe}
      >
        <Textarea name="detalhe" rows={3} maxLength={500} />
      </Field>

      {state.erro && !state.campos?.motivo && !state.campos?.detalhe && (
        <p role="alert" className="text-danger text-sm">
          {state.erro}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={aoCancelar}
          disabled={pendente}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="danger" size="sm" disabled={pendente}>
          {pendente && <Loader2 size={15} className="animate-spin" />}
          Enviar denúncia
        </Button>
      </div>
    </form>
  );
}
