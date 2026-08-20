"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  CONTRACT_TYPES,
  JOB_CATEGORIES,
  PILOT_LABEL,
  SINOP_NEIGHBORHOODS,
} from "@/lib/constants";
import { type PublishState, publishJob } from "./actions";

const initial: PublishState = {};

export function NewJobForm() {
  const [state, action, pending] = useActionState(publishJob, initial);

  if (state.ok) {
    return (
      <Panel className="text-center">
        <CheckCircle2 size={40} className="mx-auto text-vagas" />
        <h2 className="mt-4 text-lg font-bold">Vaga publicada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {state.demo
            ? "Modo demonstração: a vaga não foi gravada porque o banco ainda não está conectado."
            : "Sua vaga já aparece na busca de quem está procurando emprego em Sinop."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/empresa" variant="empresas" size="sm">
            Ir para o painel
          </ButtonLink>
          <ButtonLink href="/vagas" variant="outline" size="sm">
            Ver na busca
          </ButtonLink>
        </div>
      </Panel>
    );
  }

  return (
    <form action={action}>
      <Panel className="space-y-5">
        <Field
          label="Cargo"
          required
          error={state.fieldErrors?.title}
          hint="Como a pessoa buscaria essa vaga, ex.: Operador de Máquinas Agrícolas."
        >
          <Input
            name="title"
            placeholder="Ex.: Auxiliar Administrativo"
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Categoria" required error={state.fieldErrors?.category}>
            <Select name="category" required defaultValue="">
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
            error={state.fieldErrors?.contract_type}
          >
            <Select name="contract_type" required defaultValue="">
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
          <Field label="Cidade">
            <Input value={PILOT_LABEL} disabled readOnly />
          </Field>

          <Field label="Bairro" hint="Onde a pessoa vai trabalhar.">
            <Select name="neighborhood" defaultValue="">
              <option value="">Não informar</option>
              {SINOP_NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Salário de (R$)"
            hint="Deixe em branco para 'a combinar'."
            error={state.fieldErrors?.salary_min}
          >
            <Input
              name="salary_min"
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              placeholder="1800"
            />
          </Field>

          <Field label="Salário até (R$)" error={state.fieldErrors?.salary_max}>
            <Input
              name="salary_max"
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              placeholder="2200"
            />
          </Field>
        </div>

        <Field
          label="Descrição da vaga"
          required
          error={state.fieldErrors?.description}
          hint="Atividades, requisitos e o que a empresa oferece. Separe em parágrafos."
        >
          <Textarea
            name="description"
            rows={9}
            required
            placeholder={
              "Atividades do dia a dia...\n\nRequisitos: ...\n\nOferecemos: vale-transporte, vale-refeição..."
            }
          />
        </Field>

        {state.error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-xs text-faint">
            A primeira vaga é gratuita.{" "}
            <Link href="/empresa" className="underline hover:text-muted">
              Ver meu plano
            </Link>
          </p>
          <Button type="submit" variant="empresas" disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />}
            Publicar vaga
          </Button>
        </div>
      </Panel>
    </form>
  );
}
