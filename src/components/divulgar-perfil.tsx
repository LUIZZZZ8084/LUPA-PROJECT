"use client";

import { Check, Copy, Share2, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

/**
 * Divulgar o próprio perfil e pedir avaliação ao cliente (#603).
 *
 * O prestador depende de o cliente achar o perfil sozinho, tanto para
 * contratar quanto para avaliar — e quem tem o contato do cliente é ele. As
 * duas mensagens saem prontas pelo `wa.me/?text=`, sem número: o WhatsApp
 * abre e a pessoa escolhe para quem manda, ou posta no status. O mesmo
 * desenho de divulgar a vaga (#490).
 *
 * O link abre sem login (#603). O de avaliação leva a âncora `#avaliar`: com
 * sessão, cai no formulário; sem, cai no convite para entrar, que volta para
 * o mesmo ponto.
 *
 * O endereço vem de `window.location.origin` na hora do clique, como na
 * vaga: o link copiado é o do domínio em que a pessoa está.
 */
export interface PerfilDivulgado {
  prestadorId: string;
  categoria: string;
  cidade: string;
}

function linkDoPerfil(prestadorId: string): string {
  return `${window.location.origin}/servicos/${encodeURIComponent(prestadorId)}`;
}

/** As duas mensagens, num lugar só, para o teste ler o que vai para o cliente. */
export function mensagemDoPerfil(
  { categoria, cidade }: Omit<PerfilDivulgado, "prestadorId">,
  link: string,
  intencao: "divulgar" | "avaliar",
): string {
  return intencao === "divulgar"
    ? `Faço serviço de ${categoria.toLowerCase()} em ${cidade}. ` +
        `Veja meus trabalhos e avaliações na Lupa e me chame pelo WhatsApp: ${link}`
    : "Obrigado pela confiança no meu serviço! Se puder, deixe sua avaliação " +
        `na Lupa. Leva um minuto e me ajuda muito: ${link}#avaliar`;
}

function abrirWhatsApp(mensagem: string) {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

export function DivulgarPerfil({
  prestadorId,
  categoria,
  cidade,
  className,
}: PerfilDivulgado & { className?: string }) {
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  function enviar(intencao: "divulgar" | "avaliar") {
    abrirWhatsApp(
      mensagemDoPerfil(
        { categoria, cidade },
        linkDoPerfil(prestadorId),
        intencao,
      ),
    );
  }

  async function copiar() {
    setManual(null);
    const link = linkDoPerfil(prestadorId);
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Navegador embutido de rede social não deixa copiar: o link aparece.
      setManual(link);
    }
  }

  return (
    <Panel className={className}>
      <div className="flex items-center gap-2">
        <Share2 size={16} className="text-servicos" aria-hidden />
        <h2 className="font-bold text-sm">Traga clientes para o seu perfil</h2>
      </div>
      <p className="mt-1 text-muted text-sm leading-relaxed">
        O link abre sem login. Poste no status do WhatsApp e, depois de cada
        serviço, peça a avaliação: é ela que põe você na frente na busca.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="servicos"
          size="sm"
          onClick={() => enviar("divulgar")}
        >
          <Share2 size={14} aria-hidden />
          Divulgar no WhatsApp
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => enviar("avaliar")}
        >
          <Star size={14} aria-hidden />
          Pedir avaliação
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copiar}>
          {copiado ? (
            <Check size={14} className="text-servicos" aria-hidden />
          ) : (
            <Copy size={14} aria-hidden />
          )}
          {copiado ? "Link copiado" : "Copiar link"}
        </Button>
      </div>

      {manual && (
        <p className="mt-2 break-all text-muted text-xs" role="status">
          Copie o link: <span className="select-all text-ink">{manual}</span>
        </p>
      )}
    </Panel>
  );
}
