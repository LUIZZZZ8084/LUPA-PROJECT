"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  JOB_CATEGORIES,
  PILOT_LABEL,
  SERVICE_CATEGORIES,
  SINOP_NEIGHBORHOODS,
} from "@/lib/constants";
import type { Role } from "@/lib/types";
import { signUp, type SignUpState } from "./actions";

const initial: SignUpState = {};

const ACCENT: Record<Role, "vagas" | "servicos" | "empresas"> = {
  candidato_clt: "vagas",
  prestador_servico: "servicos",
  empresa: "empresas",
};

export function SignUpForm({ role }: { role: Role }) {
  const [state, action, pending] = useActionState(signUp, initial);

  if (state.ok) {
    return (
      <Panel className="text-center">
        <CheckCircle2 size={40} className="mx-auto text-vagas" />
        <h2 className="mt-4 text-lg font-bold">Conta criada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {state.demo
            ? "Modo demonstração: nada foi gravado porque o Supabase ainda não está conectado. Com o banco no ar, o próximo passo é a verificação do telefone por SMS."
            : "Confirme seu e-mail e depois verifique seu telefone. Seu perfil fica com status pendente até a revisão do documento."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/" variant={ACCENT[role]} size="sm">
            Ir para o início
          </ButtonLink>
        </div>
      </Panel>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="role" value={role} />

      <Panel className="space-y-5">
        <Field
          label={role === "empresa" ? "Nome do responsável" : "Nome completo"}
          required
          error={state.fieldErrors?.full_name}
        >
          <Input name="full_name" autoComplete="name" required />
        </Field>

        {role === "empresa" && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Nome da empresa"
              required
              error={state.fieldErrors?.company_name}
            >
              <Input name="company_name" required />
            </Field>
            <Field label="CNPJ" required error={state.fieldErrors?.cnpj}>
              <Input
                name="cnpj"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                required
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="E-mail" required error={state.fieldErrors?.email}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field
            label="WhatsApp"
            required
            error={state.fieldErrors?.phone}
            hint="É por onde as pessoas vão falar com você."
          >
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(66) 99999-0000"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Cidade">
            <Input value={PILOT_LABEL} disabled readOnly />
          </Field>
          <Field label="Bairro" error={state.fieldErrors?.neighborhood}>
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

        {role === "candidato_clt" && (
          <Field
            label="Área desejada"
            required
            error={state.fieldErrors?.desired_area}
            hint="Usamos para te avisar de vagas novas nessa área."
          >
            <Select name="desired_area" defaultValue="" required>
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
        )}

        {role === "prestador_servico" && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Categoria do serviço"
                required
                error={state.fieldErrors?.category_id}
              >
                <Select name="category_id" defaultValue="" required>
                  <option value="" disabled>
                    Escolha uma categoria
                  </option>
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Preço a partir de (R$)"
                error={state.fieldErrors?.starting_price}
                hint="Opcional, mas perfis com preço recebem mais contato."
              >
                <Input
                  name="starting_price"
                  type="number"
                  min={0}
                  step={10}
                  inputMode="numeric"
                  placeholder="150"
                />
              </Field>
            </div>

            <Field
              label="Sobre o seu trabalho"
              required
              error={state.fieldErrors?.description}
              hint="O que você faz, onde atende e o que te diferencia."
            >
              <Textarea
                name="description"
                rows={5}
                required
                placeholder="Trabalho com instalações elétricas residenciais e comerciais, manutenção e reparos em geral. Atendo Sinop e região."
              />
            </Field>
          </>
        )}

        <Field
          label="Senha"
          required
          error={state.fieldErrors?.password}
          hint="Mínimo de 8 caracteres."
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        {state.error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        )}

        <p className="text-xs leading-relaxed text-faint">
          Ao criar a conta você concorda com os termos de uso e com o
          tratamento dos seus dados conforme a LGPD. Documento e selfie, quando
          enviados, ficam em armazenamento privado e são apagados após a
          validação.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-xs text-muted">
            Já tem conta?{" "}
            <Link href="/entrar" className="underline hover:text-ink">
              Entrar
            </Link>
          </p>
          <Button type="submit" variant={ACCENT[role]} disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />}
            Criar conta
          </Button>
        </div>
      </Panel>
    </form>
  );
}
