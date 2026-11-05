"use client";

import { Check, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";
import { type EstadoEdicaoVaga, editarVagaComEstado } from "./actions";

const inicial: EstadoEdicaoVaga = {};

/** O que a tela mostra da vaga, já como texto do formulário. */
export interface VagaParaEditar {
  id: string;
  /** Cargo, contrato, modalidade e afins, como a vaga os mostra. */
  travados: { rotulo: string; valor: string }[];
  descricao: string;
  bairro: string;
  endereco: string;
  habilidades: string;
  salarioMin: string;
  salarioMax: string;
  /** Com candidatura, o salário não diminui — a tela avisa antes. */
  temCandidaturas: boolean;
}

/**
 * Corrigir o texto da vaga publicada (#544).
 *
 * O que não muda aparece primeiro, com o cadeado e o porquê: quem abre a
 * tela para trocar o cargo precisa saber, antes de procurar o campo, que o
 * caminho é publicar outra.
 */
export function EditarVagaForm({ vaga }: { vaga: VagaParaEditar }) {
  const [state, action, pendente] = useActionState(
    editarVagaComEstado,
    inicial,
  );
  const envio = useEnvioQueNaoApaga(action, state);

  return (
    <form action={action} {...envio} className="space-y-5">
      <input type="hidden" name="id" value={vaga.id} />

      <Panel className="bg-panel-2">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <Lock size={15} className="text-muted" aria-hidden />O que não muda
        </h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {vaga.travados.map((t) => (
            <div key={t.rotulo} className="flex gap-1.5">
              <dt className="text-muted">{t.rotulo}:</dt>
              <dd className="font-medium">{t.valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-muted text-xs leading-relaxed">
          É o que define a vaga para quem se candidatou. Para mudar, publique
          outra parecida.
        </p>
      </Panel>

      <Field
        label="Descrição da vaga"
        required
        error={state.campos?.descricao}
        hint="Atividades, requisitos e o que a empresa oferece. Separe em parágrafos."
      >
        <Textarea
          name="descricao"
          rows={8}
          required
          defaultValue={vaga.descricao}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Endereço"
          required
          error={state.campos?.endereco}
          hint="Rua, número e um ponto de referência."
        >
          <Input name="endereco" required defaultValue={vaga.endereco} />
        </Field>
        <Field
          label="Bairro"
          error={state.campos?.bairro}
          hint="Opcional. Aparece só no anúncio da vaga."
        >
          <Input name="bairro" maxLength={60} defaultValue={vaga.bairro} />
        </Field>
      </div>

      <Field
        label="Habilidades desejadas"
        hint="Separe por vírgula. É o que o painel usa para recomendar candidatos."
        error={state.campos?.habilidades}
      >
        <Input name="habilidades" defaultValue={vaga.habilidades} />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Salário de (R$)"
          hint={
            vaga.temCandidaturas
              ? "Já há candidaturas: pode subir, não diminuir."
              : "Deixe em branco para 'a combinar'."
          }
          error={state.campos?.salarioMin}
        >
          <Input
            name="salarioMin"
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            defaultValue={vaga.salarioMin}
          />
        </Field>
        <Field label="Salário até (R$)" error={state.campos?.salarioMax}>
          <Input
            name="salarioMax"
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            defaultValue={vaga.salarioMax}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="empresas" disabled={pendente}>
          {pendente && <Loader2 size={16} className="animate-spin" />}
          Salvar alterações
        </Button>
        {state.ok && !pendente && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-muted text-sm"
          >
            <Check size={16} className="text-vagas" aria-hidden />
            Vaga atualizada.{" "}
            <Link href={`/vagas/${vaga.id}`} className="underline">
              Ver como ficou
            </Link>
          </p>
        )}
        {state.erro && (
          <p role="alert" className="text-danger text-sm">
            {state.erro}
          </p>
        )}
      </div>
    </form>
  );
}
