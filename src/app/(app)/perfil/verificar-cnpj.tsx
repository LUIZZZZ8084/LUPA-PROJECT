"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { useActionState } from "react";
import {
  type EstadoVerificacao,
  verificarCnpj,
} from "@/app/(app)/perfil/actions";
import { Button } from "@/components/ui/button";

/**
 * O botão que troca a fila do admin por uma consulta à Receita.
 *
 * Some depois de dar certo porque a própria rota revalida e a empresa
 * chega verificada — deixar o botão ali convidaria ao segundo clique, que
 * não faria nada.
 */
export function VerificarCnpj() {
  const [estado, acao, pendente] = useActionState<EstadoVerificacao, FormData>(
    async () => await verificarCnpj(),
    {},
  );

  return (
    <form action={acao} className="mt-4">
      <div className="rounded-xl border border-empresas/25 bg-empresas/8 p-4">
        <p className="font-medium text-sm">
          Sua empresa ainda não é verificada
        </p>
        <p className="mt-1 text-muted text-sm leading-relaxed">
          Podemos conferir o CNPJ direto na Receita, agora. Estando a empresa
          ativa, você é verificado na hora — sem enviar documento. O nome que
          aparece nas suas vagas passa a ser o que está registrado lá, para não
          depender de digitação.
        </p>

        {estado.mensagem && (
          <p
            role="status"
            className={
              estado.ok
                ? "mt-3 rounded-xl border border-vagas/30 bg-vagas/10 px-4 py-3 text-sm text-vagas"
                : "mt-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn"
            }
          >
            {estado.mensagem}
          </p>
        )}

        <Button
          type="submit"
          variant="empresas"
          size="sm"
          className="mt-3"
          disabled={pendente}
        >
          {pendente ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <BadgeCheck size={15} />
          )}
          Conferir CNPJ agora
        </Button>
      </div>
    </form>
  );
}
