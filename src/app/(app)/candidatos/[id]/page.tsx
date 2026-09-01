import { Briefcase, CalendarClock, FileText, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { sessaoAtual } from "@/server/auth/cookies";
import { perfilDoCandidato } from "@/server/candidatos/servico";

export const metadata: Metadata = {
  title: "Candidato",
  description: "Quem pediu para ser encontrado por empresas.",
};

export default async function CandidatoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await sessaoAtual();
  const perfil = await perfilDoCandidato(sessao, id);

  /*
   * `null` cobre "não existe", "não consentiu" e "você não pode ver". Os
   * três respondem igual de propósito: distinguir confirmaria, para quem
   * sonda ids, que a pessoa existe e está procurando emprego — que é
   * exatamente o que o opt-in protege.
   */
  if (!perfil) notFound();

  const { candidato: c, candidaturaId } = perfil;

  return (
    <PageShell width="narrow">
      <BackLink href="/candidatos" label="Voltar para candidatos" />

      <Panel>
        <div className="flex items-start gap-4">
          <Avatar name={c.full_name} src={c.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-bold">{c.full_name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <MapPin size={13} />
              {[c.neighborhood, c.city].filter(Boolean).join(", ")}
            </p>
            <div className="mt-2.5">
              <Badge tone="vagas">Disponível para contato</Badge>
            </div>
          </div>
        </div>

        {c.phone && (
          <div className="mt-5">
            <WhatsAppButton
              phone={c.phone}
              providerName={c.full_name}
              context={c.desired_area ?? "uma vaga"}
              size="lg"
              block
            />
          </div>
        )}
      </Panel>

      <Panel className="mt-5">
        <h2 className="text-sm font-semibold">Sobre a pessoa</h2>

        <dl className="mt-3 space-y-3">
          <Linha
            icone={<Briefcase size={14} />}
            rotulo="Área desejada"
            valor={c.desired_area ?? "Não informada"}
          />
          <Linha
            icone={<CalendarClock size={14} />}
            rotulo="Disponibilidade"
            valor={c.availability ?? "Não informada"}
          />
        </dl>

        {c.skills.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs text-muted">Habilidades</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.skills.map((h) => (
                <Badge key={h} tone="vagas">
                  {h}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/*
          Currículo só por candidatura, e é isso que esta seção diz nos dois
          casos.

          São dois consentimentos diferentes: quem se candidata entrega o
          currículo junto com a candidatura; quem só está visível entregou
          contato. Ligar "quero ser encontrado" não pode significar "leia
          meu histórico inteiro" — por isso a view que responde a esta tela
          não traz currículo nem resumo, e não há o que revelar aqui nem
          por engano.
        */}
        <div className="mt-5 border-t border-line pt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <FileText size={13} />
            Currículo
          </p>
          {candidaturaId ? (
            <>
              <p className="mt-1.5 text-sm text-muted">
                Esta pessoa se candidatou a uma das suas vagas — o currículo
                está na ficha da candidatura.
              </p>
              <div className="mt-3">
                <ButtonLink
                  href={`/empresa/candidaturas/${candidaturaId}`}
                  variant="empresas"
                  size="sm"
                >
                  Ver a candidatura
                </ButtonLink>
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted">
              O currículo vem junto com a candidatura. Quem está aqui pediu para
              ser encontrado e entregou o contato — não o histórico.
            </p>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}

function Linha({
  icone,
  rotulo,
  valor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex gap-3">
      <dt className="flex w-36 flex-none items-center gap-1.5 text-xs text-muted">
        {icone}
        {rotulo}
      </dt>
      <dd className="min-w-0 flex-1 text-sm">{valor}</dd>
    </div>
  );
}
