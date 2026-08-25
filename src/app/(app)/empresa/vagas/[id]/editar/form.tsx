"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";
import {
  CampoBairro,
  CampoCidade,
  useCidade,
} from "@/components/cidade-e-bairro";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CONTRACT_TYPES, JOB_CATEGORIES } from "@/lib/constants";
import type { Vaga } from "@/server/vagas/tipos";
import { type EstadoEdicaoVaga, editarVagaComEstado } from "./actions";

const inicial: EstadoEdicaoVaga = {};

export function EditJobForm({ vaga }: { vaga: Vaga }) {
  const [state, action, pending] = useActionState(editarVagaComEstado, inicial);
  const [cidade, setCidade] = useCidade(vaga.cidade);

  if (state.ok) {
    return (
      <Panel className="text-center">
        <CheckCircle2 size={40} className="mx-auto text-vagas" />
        <h2 className="mt-4 text-lg font-bold">Vaga atualizada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          As mudanças já valem para quem está vendo a vaga agora.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/empresa" variant="empresas" size="sm">
            Voltar para o painel
          </ButtonLink>
          <ButtonLink href={`/vagas/${vaga.id}`} variant="outline" size="sm">
            Ver vaga
          </ButtonLink>
        </div>
      </Panel>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="id" value={vaga.id} />
      <Panel className="space-y-5">
        <Field
          label="Cargo"
          required
          error={state.campos?.titulo}
          hint="Como a pessoa buscaria essa vaga, ex.: Operador de Máquinas Agrícolas."
        >
          <Input
            name="titulo"
            defaultValue={vaga.titulo}
            placeholder="Ex.: Auxiliar Administrativo"
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Categoria" required error={state.campos?.categoria}>
            <Select
              name="categoria"
              required
              defaultValue={vaga.categoria ?? ""}
            >
              <option value="" disabled>
                Escolha uma área
              </option>
              {JOB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Tipo de contrato"
            required
            error={state.campos?.tipoContrato}
          >
            <Select
              name="tipoContrato"
              required
              defaultValue={vaga.tipoContrato ?? ""}
            >
              <option value="" disabled>
                Escolha o tipo
              </option>
              {CONTRACT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CampoCidade
            value={cidade}
            onChange={setCidade}
            error={state.campos?.cidade}
            label="Cidade da vaga"
          />
          <CampoBairro
            key={cidade}
            cidade={cidade}
            defaultValue={vaga.bairro}
            error={state.campos?.bairro}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Salário de (R$)"
            hint="Deixe em branco para 'a combinar'."
            error={state.campos?.salarioMin}
          >
            <Input
              name="salarioMin"
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              defaultValue={vaga.salarioMin ?? undefined}
              placeholder="1800"
            />
          </Field>

          <Field label="Salário até (R$)" error={state.campos?.salarioMax}>
            <Input
              name="salarioMax"
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              defaultValue={vaga.salarioMax ?? undefined}
              placeholder="2200"
            />
          </Field>
        </div>

        <Field
          label="Descrição da vaga"
          required
          error={state.campos?.descricao}
          hint="Atividades, requisitos e o que a empresa oferece. Separe em parágrafos."
        >
          <Textarea
            name="descricao"
            rows={9}
            required
            defaultValue={vaga.descricao}
            placeholder={
              "Atividades do dia a dia...\n\nRequisitos: ...\n\nOferecemos: vale-transporte, vale-refeição..."
            }
          />
        </Field>

        {state.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <ButtonLink href="/empresa" variant="outline" size="sm">
            Cancelar
          </ButtonLink>
          <Button type="submit" variant="empresas" disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </Panel>
    </form>
  );
}
