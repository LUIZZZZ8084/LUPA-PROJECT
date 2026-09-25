"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ASSUNTOS } from "@/server/suporte/tipos";
import { type EstadoSuporte, enviarComEstado } from "./actions";

/**
 * O formulário de suporte (#235).
 *
 * Existe além do e-mail porque o público deste app abre e-mail no celular e
 * boa parte não tem cliente configurado. Mandar a pessoa "escrever para
 * contato@" é mandar metade dela desistir — e quem escreve para o suporte
 * de uma plataforma de emprego costuma estar com pressa.
 *
 * **Vem preenchido para quem está conectado.** Pedir de novo o nome e o
 * e-mail que a conta já sabe é atrito puro, e aqui ele cai sobre alguém que
 * já está com um problema.
 *
 * **E funciona sem sessão**, que é o caso mais comum: quem não consegue
 * entrar é exatamente quem mais precisa deste formulário.
 */
export function FormularioDeSuporte({
  contato,
}: {
  contato: { nome: string; email: string } | null;
}) {
  const [estado, agir, pendente] = useActionState<EstadoSuporte, FormData>(
    enviarComEstado,
    {},
  );

  if (estado.ok) {
    return (
      <Panel className="mt-5 flex items-start gap-3">
        <CheckCircle2 size={20} className="mt-0.5 flex-none text-vagas" />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold">Recebemos a sua mensagem.</p>
          <p className="mt-1 text-muted">
            Respondemos no e-mail que você informou. Se for sobre os seus dados,
            o prazo é de até 15 dias — normalmente bem antes.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <form action={agir} className="mt-5 space-y-4">
      <Field label="Seu nome" required error={estado.campos?.nome}>
        <Input
          name="nome"
          defaultValue={contato?.nome ?? ""}
          autoComplete="name"
          required
        />
      </Field>

      <Field
        label="Seu e-mail"
        required
        hint="É para onde vamos responder."
        error={estado.campos?.email}
      >
        <Input
          name="email"
          type="email"
          defaultValue={contato?.email ?? ""}
          autoComplete="email"
          required
        />
      </Field>

      <Field label="Assunto" required error={estado.campos?.assunto}>
        <Select name="assunto" defaultValue="conta" required>
          {Object.entries(ASSUNTOS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="O que aconteceu"
        required
        hint="Quanto mais detalhe, mais rápido resolvemos."
        error={estado.campos?.mensagem}
      >
        <Textarea name="mensagem" rows={5} required />
      </Field>

      {estado.erro && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {estado.erro}
        </p>
      )}

      <Button type="submit" variant="vagas" disabled={pendente}>
        {pendente && <Loader2 size={16} className="animate-spin" />}
        Enviar
      </Button>
    </form>
  );
}
