"use client";

import { Check, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";
import {
  type EstadoAcompanhamento,
  salvarAcompanhamentoComEstado,
} from "./acompanhamento-actions";

const inicial: EstadoAcompanhamento = {};

/**
 * A anotação e a entrevista da ficha (#539), num formulário só.
 *
 * Um botão para as duas coisas porque elas mudam juntas: quem marca a
 * entrevista costuma escrever, na mesma hora, o que combinou. O formulário
 * fica na tela depois de salvar — é um caderno, não um envio —, e os campos
 * continuam com o que foi escrito.
 */
export function FormularioDeAcompanhamento({
  candidaturaId,
  anotacao,
  entrevistaEm,
  entrevistaLocal,
}: {
  candidaturaId: string;
  anotacao: string;
  entrevistaEm: string | null;
  entrevistaLocal: string | null;
}) {
  const [state, action, pendente] = useActionState(
    salvarAcompanhamentoComEstado,
    inicial,
  );
  const envio = useEnvioQueNaoApaga(action, state);

  return (
    <form action={action} {...envio} className="mt-4 space-y-4">
      <input type="hidden" name="candidaturaId" value={candidaturaId} />

      <Field
        label="Anotações"
        error={state.campos?.anotacao}
        hint="O que conversaram, o que a pessoa pediu, o que falta conferir."
      >
        <Textarea
          name="anotacao"
          rows={4}
          maxLength={2000}
          defaultValue={anotacao}
          placeholder="Ex.: Boa conversa por telefone. Pede R$ 2.500 e pode começar dia 10."
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Field
          label="Entrevista"
          error={state.campos?.entrevistaEm}
          hint="Dia e hora. Em branco, sem entrevista."
        >
          <Input
            type="datetime-local"
            name="entrevistaEm"
            defaultValue={entrevistaEm ?? ""}
          />
        </Field>
        <Field
          label="Local da entrevista"
          error={state.campos?.entrevistaLocal}
        >
          <Input
            name="entrevistaLocal"
            maxLength={200}
            defaultValue={entrevistaLocal ?? ""}
            placeholder="Ex.: Av. das Itaúbas, 1200, sala 3"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="empresas" disabled={pendente}>
          {pendente && <Loader2 size={16} className="animate-spin" />}
          Salvar
        </Button>
        {state.ok && !pendente && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-sm text-muted"
          >
            <Check size={16} className="text-vagas" aria-hidden />
            Salvo
          </p>
        )}
        {state.erro && !state.campos && (
          <p role="alert" className="text-danger text-sm">
            {state.erro}
          </p>
        )}
      </div>
    </form>
  );
}
