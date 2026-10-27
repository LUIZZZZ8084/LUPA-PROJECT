import { z } from "zod";
import { zEmail, zTexto } from "../validation";

/**
 * O fim do dia escolhido, no horário de Brasília: "até 31/12" vale o dia 31
 * inteiro, e não acaba à meia-noite de Londres.
 */
function fimDoDia(data: string): string {
  return new Date(`${data}T23:59:59-03:00`).toISOString();
}

/**
 * Uma parceria nova (#505). O prazo é **sem prazo** ou **até uma data**; o
 * primeiro é o caso comum, e é por isso que é o padrão da tela.
 */
export const schemaNovaParceria = z
  .object({
    email: zEmail,
    nome: zTexto(2, 80, "O nome da parceria"),
    prazo: z.enum(["sem_prazo", "ate_data"]),
    ate: z.string().trim().optional(),
  })
  .transform((dados, ctx) => {
    if (dados.prazo === "sem_prazo") {
      return { email: dados.email, nome: dados.nome, validoAte: null };
    }

    if (!dados.ate || !/^\d{4}-\d{2}-\d{2}$/.test(dados.ate)) {
      ctx.addIssue({
        code: "custom",
        path: ["ate"],
        message: "Escolha até quando a parceria vale.",
      });
      return z.NEVER;
    }

    const validoAte = fimDoDia(dados.ate);
    if (Date.parse(validoAte) <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["ate"],
        message: "A data precisa ser depois de hoje.",
      });
      return z.NEVER;
    }

    return { email: dados.email, nome: dados.nome, validoAte };
  });

export const schemaIdDeParceria = z.object({ id: z.uuid() });
