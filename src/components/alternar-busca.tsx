import Link from "next/link";
import { cn } from "@/lib/utils";

export type TipoDeBusca = "vagas" | "servicos";

const OPCOES: { tipo: TipoDeBusca; rotulo: string; ativa: string }[] = [
  { tipo: "vagas", rotulo: "Vagas", ativa: "bg-vagas/15 text-vagas" },
  {
    tipo: "servicos",
    rotulo: "Serviços",
    ativa: "bg-servicos/15 text-servicos",
  },
];

/**
 * Troca entre a busca de vagas e a de serviços, sem recomeçar.
 *
 * Quem procura "diarista" em Sinop e descobre que queria uma vaga de
 * auxiliar de limpeza não deveria voltar à home e digitar tudo de novo. O
 * termo, o estado e a cidade seguem junto.
 *
 * **Categoria, tipo de contrato e avaliação não vão.** Vagas e serviços têm
 * vocabulários diferentes ("Construção Civil" não é um slug de serviço), e
 * carregar o valor errado deixaria a outra lista vazia sem explicar por
 * quê — a mesma armadilha do estado com a cidade de outro estado (#301).
 *
 * São links, não botões: a troca é navegação, funciona sem JavaScript e a
 * página nova tem o próprio endereço compartilhável.
 */
export function AlternarBusca({
  atual,
  q,
  uf,
  cidade,
}: {
  atual: TipoDeBusca;
  q?: string;
  uf?: string;
  cidade?: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (uf) params.set("uf", uf);
  if (cidade) params.set("cidade", cidade);
  const qs = params.toString();

  return (
    <nav
      aria-label="Tipo de busca"
      className="mb-4 inline-flex rounded-full border border-line bg-panel p-1"
    >
      {OPCOES.map(({ tipo, rotulo, ativa }) => (
        <Link
          key={tipo}
          href={qs ? `/${tipo}?${qs}` : `/${tipo}`}
          aria-current={tipo === atual ? "page" : undefined}
          className={cn(
            "inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors",
            tipo === atual ? ativa : "text-muted hover:text-ink",
          )}
        >
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}
