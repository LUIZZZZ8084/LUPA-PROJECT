"use client";

import { MailCheck, MailWarning } from "lucide-react";
import { type ReactNode, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type EstadoReenvio, reenviarComEstado } from "./actions-email";

/**
 * O estado da confirmação de e-mail, no perfil (#227).
 *
 * Aparece só para quem ainda não confirmou. Selo verde permanente para
 * quem já confirmou seria ruído: a pessoa não tem nada a fazer com ele, e
 * o perfil já tem selos que **exigem** ação. É a mesma lição do selo de
 * telefone, que saiu na #209 por dizer a mesma coisa para sempre.
 *
 * E o texto não dramatiza. Nada deixa de funcionar sem a confirmação — o
 * que se perde é a capacidade de recuperar a conta um dia, e é isso que a
 * frase diz. Aviso que exagera ensina a ignorar aviso.
 *
 * **No painel de contratação o motivo é outro** (#560): o aviso de
 * candidatura por e-mail (#543) só vai para e-mail confirmado. Lá o texto diz
 * isso — a mesma regra de não dramatizar, com o que de fato se perde ali.
 */
export function ConfirmarEmail({
  verificado,
  texto,
  className,
}: {
  verificado: boolean;
  /** O porquê, para quem vê. Sem ele, o texto do perfil. */
  texto?: ReactNode;
  className?: string;
}) {
  const [estado, agir, pendente] = useActionState<EstadoReenvio>(
    reenviarComEstado,
    {},
  );

  if (verificado) return null;

  return (
    <form
      action={agir}
      className={cn(
        "rounded-xl border border-warn/25 bg-warn/5 p-4",
        className ?? "mt-5",
      )}
    >
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <MailWarning size={15} className="mt-0.5 flex-none text-warn" />
        <span>
          {texto ?? (
            <>
              <strong className="text-ink">E-mail não confirmado.</strong> Nada
              deixa de funcionar por causa disso — mas é a confirmação que
              garante que você consegue recuperar a conta se esquecer a senha.
            </>
          )}
        </span>
      </p>

      {estado.mensagem && (
        <p
          className={`mt-3 flex items-start gap-2 text-xs ${
            estado.ok ? "text-vagas" : "text-danger"
          }`}
        >
          {estado.ok && <MailCheck size={14} className="mt-0.5 flex-none" />}
          {estado.mensagem}
        </p>
      )}

      <Button
        type="submit"
        variant="ghost"
        disabled={pendente}
        className="mt-3 text-xs"
      >
        {pendente ? "Enviando…" : "Reenviar confirmação"}
      </Button>
    </form>
  );
}
