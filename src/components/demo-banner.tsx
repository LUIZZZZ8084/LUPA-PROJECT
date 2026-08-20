import { Info } from "lucide-react";
import { DEMO_CONTACT_PHONE, isDemoMode } from "@/lib/demo";

/**
 * Aviso de demonstração.
 *
 * As vagas e os prestadores das telas são exemplos. Sem este aviso, alguém
 * de Sinop procurando emprego de verdade perderia tempo com uma vaga que
 * não existe — e empresas fictícias com nome plausível seriam confundidas
 * com as reais.
 */
export function DemoBanner() {
  if (!isDemoMode) return null;

  return (
    <div className="border-b border-warn/25 bg-warn/10">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-[12px] leading-relaxed text-warn sm:px-6">
        <Info size={14} className="mt-0.5 flex-none" />
        <span>
          <strong className="font-semibold">Demonstração.</strong> As vagas,
          empresas e profissionais desta página são exemplos criados para
          mostrar como a Lupa funciona — não são ofertas reais.
          {DEMO_CONTACT_PHONE
            ? " O contato leva à equipe da Lupa."
            : " O contato está desativado."}
        </span>
      </p>
    </div>
  );
}
