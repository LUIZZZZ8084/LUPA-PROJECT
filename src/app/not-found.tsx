import { LupaMark } from "@/components/brand/logo";
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageShell width="narrow" className="max-w-md pt-16 text-center">
      <LupaMark size={48} className="mx-auto opacity-60" />
      <h1 className="mt-5 text-2xl font-bold tracking-tight">
        Não encontramos essa página
      </h1>
      <p className="mt-2 text-sm text-muted">
        O link pode estar quebrado, ou a vaga ou perfil que você procurava foi
        removido.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/vagas" variant="vagas" size="sm">
          Ver vagas
        </ButtonLink>
        <ButtonLink href="/servicos" variant="outline" size="sm">
          Ver profissionais
        </ButtonLink>
      </div>
    </PageShell>
  );
}
