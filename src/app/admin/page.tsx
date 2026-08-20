import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageShell, PageTitle } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/constants";
import { getVerificationQueue } from "@/lib/data";
import { formatPhone, timeAgo } from "@/lib/format";
import { VerificationActions } from "./actions-ui";

export const metadata: Metadata = {
  title: "Verificações",
  description: "Fila de aprovação manual de documentos.",
};

export default async function AdminPage() {
  const queue = await getVerificationQueue();

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Verificações"
        accent="text-warn"
        description="Aprovação manual de documento e selfie. No V0 a revisão é feita pelo fundador."
      />

      <Panel className="mb-5 border-warn/25 bg-warn/5">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-ink">Retenção de dados:</strong> ao aprovar ou
          reprovar, a imagem do documento é excluída do storage e apenas o
          status permanece no perfil. Isso mantém a Lupa em conformidade com a
          LGPD sem guardar documento de ninguém.
        </p>
      </Panel>

      {queue.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="Nenhuma verificação pendente"
          description="Assim que alguém enviar documento e selfie, o pedido aparece aqui."
        />
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-card)] border border-line bg-panel p-4"
            >
              <div className="flex items-start gap-3.5">
                <Avatar
                  name={item.full_name}
                  square={item.role === "empresa"}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {item.full_name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {ROLE_LABELS[item.role]}
                    {item.category ? ` · ${item.category}` : ""} · {item.city}
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {formatPhone(item.phone)} · enviado {timeAgo(item.submitted_at)}
                  </p>
                </div>
                <Badge tone="warn">Em análise</Badge>
              </div>

              <VerificationActions
                requestId={item.id}
                name={item.full_name}
                className="mt-4"
              />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
