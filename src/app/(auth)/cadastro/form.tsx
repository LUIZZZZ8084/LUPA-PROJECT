"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { cadastrarComEstado, type EstadoFormulario } from "@/app/conta/actions";
import {
  CampoBairro,
  CampoCidade,
  useCidade,
} from "@/components/cidade-e-bairro";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { JOB_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/constants";
import type { Role } from "@/lib/types";

const inicial: EstadoFormulario = {};

const ACCENT: Record<Role, "vagas" | "servicos" | "empresas"> = {
  candidato_clt: "vagas",
  prestador_servico: "servicos",
  empresa: "empresas",
};

export function SignUpForm({ role }: { role: Role }) {
  const [state, action, pending] = useActionState(cadastrarComEstado, inicial);
  const [cidade, setCidade] = useCidade();
  /*
   * Nem todo contratante tem CNPJ. Produtor rural e autônomo contratam
   * ajudante sem ter aberto empresa — decisão do Luiz em 03/09/2026
   * (#138). O rádio decide qual dos dois campos é obrigatório; o backend
   * aplica a verificação certa para cada um: Receita para CNPJ, CPF
   * válido e único para o outro.
   */
  const [tipoDocumento, setTipoDocumento] = useState<"cnpj" | "cpf">("cnpj");

  if (state.ok) {
    return (
      <Panel className="text-center">
        <CheckCircle2 size={40} className="mx-auto text-vagas" />
        <h2 className="mt-4 text-lg font-bold">Conta criada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Sua conta já está ativa. O próximo passo é verificar o telefone — é o
          selo que faz as pessoas confiarem no seu perfil.
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
      {/*
        O nome é `papel`, não `role`: o schema é uma união discriminada em
        `papel`, e um campo com outro nome faz o Zod recusar sem descobrir
        qual variante aplicar. O formulário devolvia "Revise os campos
        destacados" sem destacar campo nenhum, porque o que faltava era
        invisível.
      */}
      <input type="hidden" name="papel" value={role} />

      <Panel className="space-y-5">
        <Field
          label={role === "empresa" ? "Nome do responsável" : "Nome completo"}
          required
          error={state.campos?.nomeCompleto}
        >
          <Input name="nomeCompleto" autoComplete="name" required />
        </Field>

        {role === "empresa" ? (
          <>
            <fieldset className="space-y-2">
              <legend className="font-medium text-sm">
                Como você contrata
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    ["cnpj", "Empresa registrada"],
                    ["cpf", "Produtor rural ou autônomo"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <label
                    key={valor}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                      tipoDocumento === valor
                        ? "border-empresas bg-empresas/8 text-ink"
                        : "border-line text-muted hover:border-line-soft"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoDocumento"
                      value={valor}
                      checked={tipoDocumento === valor}
                      onChange={() => setTipoDocumento(valor)}
                      className="accent-empresas"
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={
                  tipoDocumento === "cnpj"
                    ? "Nome da empresa"
                    : "Seu nome ou o da propriedade"
                }
                required
                error={state.campos?.razaoSocial}
              >
                <Input name="razaoSocial" required />
              </Field>
              {tipoDocumento === "cnpj" ? (
                <Field label="CNPJ" required error={state.campos?.cnpj}>
                  <Input
                    key="cnpj"
                    name="cnpj"
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    required
                  />
                </Field>
              ) : (
                <Field
                  label="CPF"
                  required
                  error={state.campos?.cpf}
                  hint="Não aparece no seu perfil público."
                >
                  <Input
                    key="cpf"
                    name="cpf"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    required
                  />
                </Field>
              )}
            </div>
          </>
        ) : (
          /*
           * Pessoa física também tem documento. CNPJ identifica a empresa
           * acima; aqui é a mesma exigência para quem procura vaga ou
           * oferece serviço — sem isso a conta não amarra a ninguém.
           */
          <Field
            label="CPF"
            required
            error={state.campos?.cpf}
            hint="Não aparece no seu perfil público."
          >
            <Input
              name="cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              required
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="E-mail" required error={state.campos?.email}>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field
            label="WhatsApp"
            required
            error={state.campos?.telefone}
            hint="É por onde as pessoas vão falar com você."
          >
            <Input
              name="telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(66) 99999-0000"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CampoCidade
            value={cidade}
            onChange={setCidade}
            error={state.campos?.cidade}
          />
          <CampoBairro
            key={cidade}
            cidade={cidade}
            error={state.campos?.bairro}
          />
        </div>

        {role === "candidato_clt" && (
          <Field
            label="Área desejada"
            required
            error={state.campos?.areaDesejada}
            hint="Usamos para te avisar de vagas novas nessa área."
          >
            <Select name="areaDesejada" defaultValue="" required>
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
                error={state.campos?.categoriaId}
              >
                <Select name="categoriaId" defaultValue="" required>
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
                error={state.campos?.precoInicial}
                hint="Opcional, mas perfis com preço recebem mais contato."
              >
                <Input
                  name="precoInicial"
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
              error={state.campos?.descricao}
              hint="O que você faz, onde atende e o que te diferencia."
            >
              <Textarea
                name="descricao"
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
          error={state.campos?.senha}
          hint="Mínimo de 8 caracteres."
        >
          <Input
            name="senha"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        {state.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.erro}
          </p>
        )}

        <p className="text-xs leading-relaxed text-faint">
          Ao criar a conta você concorda com os termos de uso e com o tratamento
          dos seus dados conforme a LGPD. Documento e selfie, quando enviados,
          ficam em armazenamento privado e são apagados após a validação.
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
