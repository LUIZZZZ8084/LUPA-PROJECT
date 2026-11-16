"use client";

import { Bookmark, BookmarkCheck, Loader2, Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";
import {
  definirTalento,
  type EstadoContato,
  registrarContatoComEstado,
} from "./ficha-actions";

const inicial: EstadoContato = {};

/**
 * Registrar um contato com a pessoa (#618): uma nota curta que entra no
 * histórico da candidatura. A lista vem do servidor; depois de registrar,
 * a revalidação traz a linha nova e a página remonta este formulário vazio
 * (a `key` é o tamanho do histórico).
 */
export function RegistrarContato({ candidaturaId }: { candidaturaId: string }) {
  const [state, action, pendente] = useActionState(
    registrarContatoComEstado,
    inicial,
  );
  const envio = useEnvioQueNaoApaga(action, state);

  return (
    <form action={action} {...envio} className="mt-4 space-y-3">
      <input type="hidden" name="candidaturaId" value={candidaturaId} />
      <Field
        label="Registrar contato"
        error={state.campos?.nota}
        hint="Ligação, mensagem, recado: o que foi falado e o que ficou combinado. Cada contato entra como uma linha nova, com a data."
      >
        <Textarea
          name="nota"
          rows={2}
          maxLength={500}
          required
          placeholder="Ex.: Liguei às 10h, retorna amanhã depois do almoço."
        />
      </Field>
      {state.erro && !state.campos?.nota && (
        <p role="alert" className="text-danger text-xs">
          {state.erro}
        </p>
      )}
      <Button type="submit" variant="empresas" size="sm" disabled={pendente}>
        {pendente ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <Plus size={14} aria-hidden />
        )}
        Registrar no histórico
      </Button>
    </form>
  );
}

/**
 * Guardar nos talentos (#618). A mudança aparece na hora e volta se o
 * servidor recusar, com o motivo — o mesmo desenho do seletor de etapa.
 */
export function SalvarNosTalentos({
  candidaturaId,
  salvo: salvoInicial,
}: {
  candidaturaId: string;
  salvo: boolean;
}) {
  const [salvo, setSalvo] = useState(salvoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function alternar() {
    const novo = !salvo;
    setSalvo(novo);
    setErro(null);
    iniciar(async () => {
      const resposta = await definirTalento({ candidaturaId, salvo: novo });
      if (!resposta.ok) {
        setSalvo(!novo);
        setErro(resposta.mensagem);
      }
    });
  }

  return (
    <div>
      <Button
        type="button"
        variant={salvo ? "empresas" : "outline"}
        size="sm"
        aria-pressed={salvo}
        disabled={pendente}
        onClick={alternar}
      >
        {salvo ? (
          <BookmarkCheck size={15} aria-hidden />
        ) : (
          <Bookmark size={15} aria-hidden />
        )}
        {salvo ? "Guardado nos talentos" : "Guardar nos talentos"}
      </Button>
      {erro && (
        <p role="alert" className="mt-1 text-danger text-xs">
          {erro}
        </p>
      )}
    </div>
  );
}
