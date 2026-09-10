import { Check, Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { geradorCurriculoLiberado } from "@/server/curriculo/servico";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";
import { ComprarGeradorButton } from "./comprar-button";

export const metadata: Metadata = {
  title: "Gerador de currículo",
};

const BENEFICIOS = [
  "Gere quantas vezes quiser, para sempre — sem comprar de novo",
  "O PDF é montado com o que estiver salvo no seu perfil na hora do download",
  "Currículo limpo, pronto para anexar em qualquer candidatura",
];

export default async function GeradorDeCurriculoPage() {
  const sessao = await sessaoAtual();
  if (!sessao || !pode(sessao.papel, "candidato:gerar_curriculo")) {
    notFound();
  }

  const liberado = await geradorCurriculoLiberado(sessao);
  const preco = formatPrecoBRL(PRECO_CENTAVOS.curriculo_pdf / 100);

  return (
    <PageShell width="narrow">
      <BackLink href="/perfil" label="Voltar para o perfil" />
      <PageTitle
        title="Gerador de currículo"
        description="Um currículo em PDF, pronto para anexar, a partir do seu perfil."
      />

      <Panel>
        <div className="flex items-start gap-3">
          <FileText size={20} className="mt-0.5 flex-none text-vagas" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">Currículo em PDF</h2>
              {liberado && <Badge tone="vagas">Liberado</Badge>}
            </div>

            {liberado ? (
              <p className="mt-1.5 text-muted text-sm leading-relaxed">
                Você já pagou por isto — baixe quando quiser, quantas vezes
                precisar. Editou o perfil? O próximo download já sai atualizado.
              </p>
            ) : (
              <>
                <p className="mt-1.5 text-muted text-sm leading-relaxed">
                  Pagamento único. Depois de liberado, o gerador é seu para
                  sempre — sem mensalidade e sem limite de downloads.
                </p>
                <ul className="mt-3 space-y-1.5 text-muted text-sm">
                  {BENEFICIOS.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check
                        size={15}
                        className="mt-0.5 flex-none text-vagas"
                      />
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-bold text-2xl text-vagas">{preco}</p>
              </>
            )}

            {liberado ? (
              <ButtonAnchor
                href="/api/curriculo"
                variant="vagas"
                size="sm"
                className="mt-4"
              >
                <Download size={14} />
                Baixar currículo em PDF
              </ButtonAnchor>
            ) : (
              <ComprarGeradorButton />
            )}
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
