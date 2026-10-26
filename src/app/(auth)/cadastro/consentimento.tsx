import Link from "next/link";
import { PRONTO_PARA_PUBLICAR } from "@/lib/controlador";

/**
 * O que a pessoa aceita ao criar a conta, e só o que existe para aceitar.
 *
 * A frase dizia "você concorda com os termos de uso" sempre — inclusive
 * enquanto `/termos` responde 404, porque o controlador ainda não está
 * identificado. Consentimento a um documento que a pessoa não consegue ler
 * não vale nada, e a tela afirmava um acordo que não podia existir. Achado
 * na varredura de lançamento de 22/09/2026, lendo o cadastro de empresa.
 *
 * A condição é a mesma de `LinksInstitucionais`, pelo mesmo motivo: as
 * páginas e a frase que aponta para elas nascem juntas. Quando o CNPJ da
 * PALU entrar em `controlador.ts`, a frase aparece com os links, sem
 * ninguém lembrar deste arquivo.
 *
 * O parágrafo sobre CPF e CNPJ não muda: foi reescrito na #233 lendo o
 * schema, e continua sendo verdade com ou sem termos publicados.
 */
export function ConsentimentoDoCadastro() {
  return (
    <p className="text-xs leading-relaxed text-faint">
      {PRONTO_PARA_PUBLICAR && (
        <>
          Ao criar a conta você concorda com os{" "}
          <Link href="/termos" className="underline">
            Termos de Uso
          </Link>{" "}
          e com a{" "}
          <Link href="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .{" "}
        </>
      )}
      Seu CPF fica guardado numa área fechada, que só o servidor alcança, e
      nunca aparece para outras pessoas — ele serve para conferir que é válido e
      que não está em uso por outra conta. O CNPJ, por ser registro público,
      fica visível no seu perfil. Não pedimos documento nem selfie.
    </p>
  );
}
