"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import {
  type EstadoFormulario,
  excluirContaComEstado,
} from "@/app/conta/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";

const inicial: EstadoFormulario = {};

/**
 * Excluir a própria conta (#423).
 *
 * Fechado até a pessoa pedir: o formulário inteiro aberto no perfil, ao
 * lado de "sair", seria um convite a um clique errado sem volta. Aberto,
 * ele diz o que sai, o que fica e por quê **antes** do botão — promessa na
 * tela é contrato, e esta não tem como ser corrigida depois.
 */
export function ExcluirConta() {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setAberto(true)}
      >
        <Trash2 size={15} />
        Excluir minha conta
      </Button>
    );
  }

  return <FormularioDeExclusao aoCancelar={() => setAberto(false)} />;
}

function FormularioDeExclusao({ aoCancelar }: { aoCancelar: () => void }) {
  const [state, action, pendente] = useActionState(
    excluirContaComEstado,
    inicial,
  );
  const envio = useEnvioQueNaoApaga(action, state);
  const idConfirmo = useId();

  return (
    <form
      action={action}
      {...envio}
      className="w-full space-y-4 rounded-xl border border-danger/30 bg-panel-2 p-4"
    >
      <div className="space-y-2 text-sm leading-relaxed">
        <h3 className="font-bold text-danger">Excluir sua conta</h3>
        <p>
          Saem seu perfil, currículo, candidaturas, fotos de trabalho, vagas
          publicadas, avaliações que você recebeu, avisos de vaga e créditos de
          vaga que não foram usados. Se você tem assinatura, ela é cancelada
          antes, e não há mais cobrança.
        </p>
        <p className="text-muted">
          Avaliações que você escreveu continuam no perfil de quem foi avaliado,
          sem o seu nome. O registro dos pagamentos fica, sem seus dados, porque
          faz parte da contabilidade.
        </p>
        <p className="font-semibold">Não dá para desfazer.</p>
      </div>

      <Field
        label="Sua senha"
        required
        error={state.campos?.senha}
        hint="Para confirmar que é você."
      >
        <Input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="flex items-start gap-3">
        <input
          id={idConfirmo}
          type="checkbox"
          name="confirmo"
          value="sim"
          required
          className="mt-0.5 h-4 w-4 flex-none rounded border-line bg-panel accent-danger"
        />
        <label htmlFor={idConfirmo} className="text-sm">
          Entendo que a exclusão não tem volta
        </label>
      </div>
      {state.campos?.confirmo && (
        <p className="text-danger text-sm">{state.campos.confirmo}</p>
      )}

      {state.erro && !state.campos?.senha && !state.campos?.confirmo && (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm"
        >
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
          Excluir minha conta
        </Button>
      </div>
    </form>
  );
}
