"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * O e-mail escrito na tela, com botão de copiar.
 *
 * O `mailto` resolve para quem tem cliente de e-mail configurado — e boa
 * parte de quem contrata em Sinop trabalha no webmail, onde `mailto` não
 * abre nada. Mostrar o endereço e deixar copiar é o caminho que funciona
 * nos dois casos.
 */
export function CopiarEmail({ email }: { email: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
      <span className="break-all">{email}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            .writeText(email)
            .then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            })
            /*
             * Navegador antigo, ou página sem HTTPS, recusa a área de
             * transferência. O endereço continua na tela para copiar à
             * mão — o botão some do caminho em vez de dar erro.
             */
            .catch(() => setCopiado(false));
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 font-semibold transition-colors hover:bg-panel-2 hover:text-ink"
      >
        {copiado ? <Check size={12} /> : <Copy size={12} />}
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </p>
  );
}
