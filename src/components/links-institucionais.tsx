import Link from "next/link";
import { PRONTO_PARA_PUBLICAR } from "@/lib/controlador";
import { cn } from "@/lib/utils";

/**
 * Os links para Termos, Privacidade e Suporte — quando eles existem (#235).
 *
 * **Devolve `null` enquanto o controlador não estiver preenchido**, porque
 * as três páginas respondem 404 até lá. Link que aparece e devolve erro é a
 * armadilha que o AGENTS.md registra três vezes — e eu tropecei nela hoje,
 * escrevendo esses mesmos links antes de as páginas existirem.
 *
 * Ter um componente só, em vez de repetir a condição em cada tela, é o que
 * evita o caso pior: alguém acrescentar o quarto lugar que mostra os links
 * e esquecer a checagem. É a mesma razão de `revalidarBuscaDeVagas()`
 * existir.
 */
export function LinksInstitucionais({ className }: { className?: string }) {
  if (!PRONTO_PARA_PUBLICAR) return null;

  return (
    <p className={cn("text-xs text-faint", className)}>
      <Link href="/termos" className="underline">
        Termos de Uso
      </Link>
      {" · "}
      <Link href="/privacidade" className="underline">
        Privacidade
      </Link>
      {" · "}
      <Link href="/suporte" className="underline">
        Suporte
      </Link>
    </p>
  );
}
